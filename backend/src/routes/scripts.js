const router = require('express').Router();
const pool = require('../db/client');
const { GoogleGenerativeAI } = require('@google/generative-ai');

function getGemini() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  return genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite-preview' });
}

// GET posts for an account that have a video URL (transcribable)
router.get('/posts/:accountId', async (req, res) => {
  const { rows } = await pool.query(`
    SELECT p.id, p.caption, p.thumbnail_url, p.post_url, p.engagement_rate,
           p.likes_count, p.comments_count, p.views_count, p.content_type, p.posted_at,
           a.platform, a.handle, 'account' AS type,
           ps.id AS script_id, ps.hook, ps.hook_type, ps.tone,
           ps.body_structure, ps.cta, ps.key_phrases, ps.sections,
           ps.duration_seconds, ps.content_format, ps.analyzed_at
    FROM posts p
    JOIN accounts a ON p.account_id = a.id
    LEFT JOIN post_scripts ps ON ps.post_id = p.id
    WHERE p.account_id = $1 AND p.post_url IS NOT NULL
    ORDER BY p.engagement_rate DESC NULLS LAST
  `, [req.params.accountId]);
  res.json(rows);
});

// GET competitor posts that have a video URL (transcribable)
router.get('/competitor-posts/:competitorId', async (req, res) => {
  const { rows } = await pool.query(`
    SELECT cp.id, cp.caption, cp.thumbnail_url, cp.post_url, cp.engagement_rate,
           cp.likes_count, cp.comments_count, cp.views_count, cp.content_type, cp.posted_at,
           c.platform, c.handle, 'competitor' AS type,
           ps.id AS script_id, ps.hook, ps.hook_type, ps.tone,
           ps.body_structure, ps.cta, ps.key_phrases, ps.sections,
           ps.duration_seconds, ps.content_format, ps.analyzed_at
    FROM competitor_posts cp
    JOIN competitors c ON cp.competitor_id = c.id
    LEFT JOIN post_scripts ps ON ps.competitor_post_id = cp.id
    WHERE cp.competitor_id = $1 AND cp.post_url IS NOT NULL
    ORDER BY cp.engagement_rate DESC NULLS LAST
  `, [req.params.competitorId]);
  res.json(rows);
});

// GET all competitors for an account's platform (for script page selector)
router.get('/competitors/:accountId', async (req, res) => {
  const { rows: [account] } = await pool.query('SELECT platform FROM accounts WHERE id=$1', [req.params.accountId]);
  if (!account) return res.status(404).json({ error: 'Account not found' });

  const { rows } = await pool.query(
    'SELECT id, handle, platform, followers_count FROM competitors WHERE platform=$1 AND profile_id=$2 ORDER BY followers_count DESC',
    [account.platform, account.profile_id]
  );
  res.json(rows);
});

// POST generate a script using stored transcripts + Gemini
router.post('/generate', async (req, res) => {
  const { accountId, topic, competitorId } = req.body;
  if (!topic) return res.status(400).json({ error: 'topic required' });

  // Get my top performing transcribed posts (my voice profile)
  const { rows: myScripts } = await pool.query(`
    SELECT ps.hook, ps.hook_type, ps.tone, ps.key_phrases, ps.body_structure, p.engagement_rate
    FROM post_scripts ps
    JOIN posts p ON ps.post_id = p.id
    WHERE p.account_id = $1
    ORDER BY p.engagement_rate DESC NULLS LAST
    LIMIT 5
  `, [accountId]);

  // Optionally pull competitor hook patterns
  let compScripts = [];
  if (competitorId) {
    const { rows } = await pool.query(`
      SELECT ps.hook, ps.hook_type, ps.tone, ps.body_structure
      FROM post_scripts ps
      JOIN competitor_posts cp ON ps.competitor_post_id = cp.id
      WHERE cp.competitor_id = $1
      ORDER BY cp.engagement_rate DESC NULLS LAST
      LIMIT 3
    `, [competitorId]);
    compScripts = rows;
  }

  const myVoiceSection = myScripts.length > 0
    ? `## YOUR VOICE PROFILE (top performing videos)\n` +
      myScripts.map(s => {
        const phrases = Array.isArray(s.key_phrases) ? s.key_phrases : JSON.parse(s.key_phrases || '[]');
        return `- Hook: "${s.hook}" (${s.hook_type})\n  Tone: ${s.tone}\n  Key phrases: ${phrases.join(', ')}`;
      }).join('\n\n')
    : '(No transcripts yet — write in an engaging, direct, personal tone)';

  const compSection = compScripts.length > 0
    ? `## COMPETITOR HOOK PATTERNS TO BORROW\n` +
      compScripts.map(s => `- ${s.hook_type}: "${s.hook}"\n  Body: ${s.body_structure}`).join('\n\n')
    : '';

  const prompt = `You are a social media scriptwriter for a visual artist and creative entrepreneur in Lagos, Nigeria.
Write a short-form video script (Instagram Reel or TikTok) for this creator.

TOPIC: ${topic}

${myVoiceSection}

${compSection}

Rules:
- Match the creator's tone and sentence style exactly
- Short punchy sentences — no more than 12 words per line
- If competitor patterns provided, use their hook structure but make it authentic
- Do NOT write generic advice or filler

FORMAT OUTPUT EXACTLY LIKE THIS:

**HOOK (0-3s)**
[opening line]

**BODY**
[0:04] ...
[0:15] ...
[0:30] ...

**CTA**
[closing line]

**ESTIMATED DURATION:** X seconds`;

  try {
    const model = getGemini();
    const result = await model.generateContent(prompt);
    const fullScript = result.response.text();

    // Save generated script
    const { rows: [saved] } = await pool.query(
      `INSERT INTO generated_scripts (account_id, inspired_by_competitor_id, topic, full_script)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [accountId, competitorId || null, topic, fullScript]
    );

    res.json({ script: fullScript, id: saved.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET saved generated scripts for account
router.get('/generated/:accountId', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT gs.*, c.handle AS competitor_handle
     FROM generated_scripts gs
     LEFT JOIN competitors c ON gs.inspired_by_competitor_id = c.id
     WHERE gs.account_id = $1
     ORDER BY gs.created_at DESC LIMIT 20`,
    [req.params.accountId]
  );
  res.json(rows);
});

// DELETE generated script
router.delete('/generated/:id', async (req, res) => {
  await pool.query('DELETE FROM generated_scripts WHERE id=$1', [req.params.id]);
  res.json({ success: true });
});

module.exports = router;
