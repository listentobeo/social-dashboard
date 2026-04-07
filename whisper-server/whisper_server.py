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

# Load Whisper model once at startup (change to "small" or "medium" for better accuracy)
print("Loading Whisper model (small)...")
model = whisper.load_model("small")
print("Whisper ready.")

gemini_client = genai.Client(api_key=os.environ['GEMINI_API_KEY'])


def get_db():
    return psycopg2.connect(os.environ['DATABASE_URL'])


@app.route('/health')
def health():
    return jsonify({'status': 'ok', 'whisper_model': 'base'})


@app.route('/transcribe', methods=['POST'])
def transcribe():
    data = request.json
    url = data.get('url')
    post_id = data.get('post_id')        # UUID in posts or competitor_posts table
    post_type = data.get('type')         # 'account' or 'competitor'

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

            # Find downloaded file
            files = os.listdir(tmpdir)
            if not files:
                return jsonify({'error': 'Download failed — no file found'}), 500

            audio_path = os.path.join(tmpdir, files[0])

            # Transcribe
            result = model.transcribe(audio_path)
            transcript = result['text'].strip()

        if not transcript:
            return jsonify({'error': 'Transcription returned empty — video may have no speech'}), 400

        # Analyze structure with Gemini
        analysis = analyze_script(transcript)

        # Save to DB
        if post_id and post_type:
            save_script(post_id, post_type, url, transcript, analysis)

        return jsonify({
            'transcript': transcript,
            'analysis': analysis,
            'post_id': post_id,
        })

    except Exception as e:
        print(f'[ERROR] {e}')
        return jsonify({'error': str(e)}), 500


def analyze_script(transcript):
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
  "estimated_duration": "short (under 30s) / medium (30-60s) / long (60s+)"
}}"""

    result = gemini_client.models.generate_content(model='gemini-3.1-flash-lite-preview', contents=prompt)
    text = result.text.strip()


    # Strip markdown code blocks if Gemini wraps it
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
    other_col = 'post_id' if post_type == 'competitor' else 'competitor_post_id'

    cur.execute(f"""
        INSERT INTO post_scripts ({col}, post_url, transcript, hook, hook_type,
                                  body_structure, cta, tone, key_phrases, analyzed_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
        ON CONFLICT ({col}) DO UPDATE SET
            transcript = EXCLUDED.transcript,
            hook = EXCLUDED.hook,
            hook_type = EXCLUDED.hook_type,
            body_structure = EXCLUDED.body_structure,
            cta = EXCLUDED.cta,
            tone = EXCLUDED.tone,
            key_phrases = EXCLUDED.key_phrases,
            analyzed_at = NOW()
    """, (
        post_id, url, transcript,
        analysis.get('hook'), analysis.get('hook_type'),
        analysis.get('body_structure'), analysis.get('cta'),
        analysis.get('tone'),
        json.dumps(analysis.get('key_phrases', [])),
    ))

    conn.commit()
    cur.close()
    conn.close()
    print(f'[DB] Saved script for {post_type} post {post_id}')


if __name__ == '__main__':
    print('Whisper server starting on http://localhost:5001')
    print('Keep this running while using the Scripts tab in the dashboard.')
    app.run(port=5001, debug=False)
