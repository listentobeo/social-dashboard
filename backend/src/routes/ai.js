const router = require('express').Router();
const pool = require('../db/client');
const { analyzePerformance, analyzeCompetitor } = require('../services/gemini');

// GET cached or generate performance analysis for account
router.post('/analyze/:accountId', async (req, res) => {
  const { accountId } = req.params;
  const { force = false } = req.body;

  // Check cache
  if (!force) {
    const { rows: cached } = await pool.query(
      `SELECT * FROM ai_insights
       WHERE account_id=$1 AND insight_type='performance' AND expires_at > NOW()
       ORDER BY generated_at DESC LIMIT 1`,
      [accountId]
    );
    if (cached.length) return res.json({ insight: cached[0].content, cached: true });
  }

  const { rows: [account] } = await pool.query('SELECT * FROM accounts WHERE id=$1', [accountId]);
  if (!account) return res.status(404).json({ error: 'Account not found' });

  const { rows: posts } = await pool.query(
    'SELECT * FROM posts WHERE account_id=$1 ORDER BY posted_at DESC LIMIT 100',
    [accountId]
  );

  const { rows: competitors } = await pool.query(
    'SELECT * FROM competitors WHERE platform=$1 AND profile_id=$2',
    [account.platform, account.profile_id]
  );

  if (posts.length < 3) {
    return res.status(400).json({ error: 'Need at least 3 posts scraped before AI analysis' });
  }

  try {
    const insight = await analyzePerformance(account, posts, competitors);

    await pool.query(
      `INSERT INTO ai_insights (account_id, insight_type, content, raw_data)
       VALUES ($1, 'performance', $2, $3)`,
      [accountId, insight, JSON.stringify({ post_count: posts.length })]
    );

    res.json({ insight, cached: false });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST competitor intelligence analysis
router.post('/competitor/:competitorId', async (req, res) => {
  const { competitorId } = req.params;
  const { accountId, force = false } = req.body;

  if (!force) {
    const { rows: cached } = await pool.query(
      `SELECT * FROM ai_insights
       WHERE insight_type='competitor' AND raw_data->>'competitor_id'=$1 AND expires_at > NOW()
       ORDER BY generated_at DESC LIMIT 1`,
      [competitorId]
    );
    if (cached.length) return res.json({ insight: cached[0].content, cached: true });
  }

  const { rows: [competitor] } = await pool.query('SELECT * FROM competitors WHERE id=$1', [competitorId]);
  if (!competitor) return res.status(404).json({ error: 'Competitor not found' });

  const { rows: competitorPosts } = await pool.query(
    'SELECT * FROM competitor_posts WHERE competitor_id=$1 ORDER BY posted_at DESC LIMIT 50',
    [competitorId]
  );

  let myPosts = [];
  if (accountId) {
    const { rows } = await pool.query(
      'SELECT * FROM posts WHERE account_id=$1 ORDER BY posted_at DESC LIMIT 30',
      [accountId]
    );
    myPosts = rows;
  }

  if (competitorPosts.length < 3) {
    return res.status(400).json({ error: 'Need at least 3 competitor posts. Trigger a scrape first.' });
  }

  try {
    const insight = await analyzeCompetitor(competitor, competitorPosts, myPosts);

    await pool.query(
      `INSERT INTO ai_insights (account_id, insight_type, content, raw_data)
       VALUES ($1, 'competitor', $2, $3)`,
      [accountId || null, insight, JSON.stringify({ competitor_id: competitorId })]
    );

    res.json({ insight, cached: false });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET all insights for account
router.get('/history/:accountId', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, insight_type, content, generated_at FROM ai_insights
     WHERE account_id=$1 ORDER BY generated_at DESC LIMIT 20`,
    [req.params.accountId]
  );
  res.json(rows);
});

module.exports = router;
