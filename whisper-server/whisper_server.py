"""
Local Whisper transcription server for social-dashboard.
Run this when you want to transcribe posts.
Requires: pip install -r requirements.txt
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import whisper
import yt_dlp
import os
import tempfile
import psycopg2
from psycopg2.extras import RealDictCursor
from google import genai
import json
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

print("Loading Whisper model (small)...")
model = whisper.load_model("small")
print("Whisper ready.")

gemini_client = genai.Client(api_key=os.environ['GEMINI_API_KEY'])
LONG_FORM_THRESHOLD = 180  # seconds — videos over 3 minutes get long-form analysis


def get_db():
    return psycopg2.connect(os.environ['DATABASE_URL'])


@app.route('/health')
def health():
    return jsonify({'status': 'ok', 'whisper_model': 'small'})


@app.route('/transcribe', methods=['POST'])
def transcribe():
    data = request.json
    url = data.get('url')
    post_id = data.get('post_id')
    post_type = data.get('type')  # 'account' or 'competitor'

    if not url:
        return jsonify({'error': 'url required'}), 400

    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            out_template = os.path.join(tmpdir, 'audio.%(ext)s')
            ydl_opts = {
                'format': 'bestaudio/best',
                'outtmpl': out_template,
                'quiet': True,
                'postprocessors': [{
                    'key': 'FFmpegExtractAudio',
                    'preferredcodec': 'mp3',
                    'preferredquality': '128',
                }],
            }
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([url])

            files = os.listdir(tmpdir)
            if not files:
                return jsonify({'error': 'Download failed — no file found'}), 500

            audio_path = os.path.join(tmpdir, files[0])
            result = model.transcribe(audio_path)
            transcript = result['text'].strip()

        if not transcript:
            return jsonify({'error': 'Transcription returned empty — video may have no speech'}), 400

        # Detect duration from Whisper segments
        segments = result.get('segments', [])
        duration_seconds = int(segments[-1]['end']) if segments else 0
        is_long_form = duration_seconds >= LONG_FORM_THRESHOLD

        print(f'[TRANSCRIBE] Duration: {duration_seconds}s — {"long-form" if is_long_form else "short-form"} analysis')

        # Use appropriate analysis based on duration
        if is_long_form:
            analysis = analyze_long_form(transcript, segments, duration_seconds)
        else:
            analysis = analyze_short_form(transcript)

        analysis['duration_seconds'] = duration_seconds
        analysis['content_format'] = 'long' if is_long_form else 'short'

        if post_id and post_type:
            save_script(post_id, post_type, url, transcript, analysis)

        return jsonify({
            'transcript': transcript,
            'analysis': analysis,
            'post_id': post_id,
            'duration_seconds': duration_seconds,
            'is_long_form': is_long_form,
        })

    except Exception as e:
        print(f'[ERROR] {e}')
        return jsonify({'error': str(e)}), 500


def analyze_short_form(transcript):
    prompt = f"""Analyze this short-form video script transcript and extract the content structure.

TRANSCRIPT:
{transcript}

Return ONLY valid JSON (no markdown, no explanation):
{{
  "hook": "the exact opening line or first sentence",
  "hook_type": "one of: question / shock / story / challenge / how-to / contrarian / relatable",
  "body_structure": "describe how the content builds in 2-3 sentences",
  "cta": "the closing call to action or final line",
  "tone": "one of: casual / energetic / educational / inspirational / vulnerable / direct",
  "key_phrases": ["memorable phrase 1", "memorable phrase 2", "memorable phrase 3"],
  "sections": []
}}"""
    return _call_gemini(prompt)


def analyze_long_form(transcript, segments, duration_seconds):
    # Build a rough timeline by splitting segments into ~5 equal chunks
    section_count = min(6, max(3, duration_seconds // 120))
    chunk_size = len(segments) // section_count if segments else 1
    timeline_hints = []
    for i in range(section_count):
        start_seg = segments[i * chunk_size] if i * chunk_size < len(segments) else segments[-1]
        start_time = int(start_seg['start'])
        mins, secs = divmod(start_time, 60)
        timeline_hints.append(f"[{mins}:{secs:02d}] {start_seg['text'][:80].strip()}...")

    timeline_str = '\n'.join(timeline_hints)

    prompt = f"""Analyze this long-form video transcript. Duration: {duration_seconds // 60} minutes.

TRANSCRIPT (first 4000 chars):
{transcript[:4000]}

TIMELINE HINTS (approximate section starts):
{timeline_str}

Return ONLY valid JSON (no markdown, no explanation):
{{
  "hook": "the exact opening line — what grabs attention in the first 10 seconds",
  "hook_type": "one of: question / shock / story / challenge / how-to / contrarian / relatable",
  "body_structure": "overall arc of the video in 2-3 sentences",
  "cta": "the closing call to action",
  "tone": "one of: casual / energetic / educational / inspirational / vulnerable / direct",
  "key_phrases": ["most memorable phrase 1", "most memorable phrase 2", "most memorable phrase 3", "most memorable phrase 4", "most memorable phrase 5"],
  "sections": [
    {{"timestamp": "0:00", "title": "section name", "summary": "what happens here in 1 sentence"}},
    {{"timestamp": "1:30", "title": "section name", "summary": "what happens here in 1 sentence"}}
  ],
  "recurring_themes": ["theme or topic that comes up repeatedly 1", "theme 2"],
  "content_pillars": ["main topic 1", "main topic 2", "main topic 3"]
}}"""
    return _call_gemini(prompt)


def _call_gemini(prompt):
    result = gemini_client.models.generate_content(
        model='gemini-3.1-flash-lite-preview',
        contents=prompt
    )
    text = result.text.strip()

    if '```' in text:
        parts = text.split('```')
        for part in parts:
            part = part.strip()
            if part.startswith('json'):
                part = part[4:].strip()
            try:
                return json.loads(part)
            except:
                continue

    return json.loads(text)


def save_script(post_id, post_type, url, transcript, analysis):
    conn = get_db()
    cur = conn.cursor()
    col = 'competitor_post_id' if post_type == 'competitor' else 'post_id'

    cur.execute(f"""
        INSERT INTO post_scripts ({col}, post_url, transcript, hook, hook_type,
                                  body_structure, cta, tone, key_phrases,
                                  sections, duration_seconds, content_format, analyzed_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
        ON CONFLICT ({col}) DO UPDATE SET
            transcript = EXCLUDED.transcript,
            hook = EXCLUDED.hook,
            hook_type = EXCLUDED.hook_type,
            body_structure = EXCLUDED.body_structure,
            cta = EXCLUDED.cta,
            tone = EXCLUDED.tone,
            key_phrases = EXCLUDED.key_phrases,
            sections = EXCLUDED.sections,
            duration_seconds = EXCLUDED.duration_seconds,
            content_format = EXCLUDED.content_format,
            analyzed_at = NOW()
    """, (
        post_id, url, transcript,
        analysis.get('hook'), analysis.get('hook_type'),
        analysis.get('body_structure'), analysis.get('cta'),
        analysis.get('tone'),
        json.dumps(analysis.get('key_phrases', [])),
        json.dumps(analysis.get('sections', [])),
        analysis.get('duration_seconds', 0),
        analysis.get('content_format', 'short'),
    ))

    conn.commit()
    cur.close()
    conn.close()
    print(f'[DB] Saved {analysis.get("content_format","short")} script for {post_type} post {post_id}')


if __name__ == '__main__':
    print('Whisper server starting on http://localhost:5001')
    print('Keep this running while using the Scripts tab in the dashboard.')
    app.run(port=5001, debug=False)
