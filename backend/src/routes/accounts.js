const router = require('express').Router();
const pool = require('../db/client');
const { scrapeAccount } = require('../services/cron');
const { runActor, normalizeProfile, normalizePosts } = require('../services/apify');

// GET all accounts
router.get('/', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM accounts ORDER BY created_at ASC');
  res.json(rows);
});

// POST add account
router.post('/', async (req, res) => {
  const { platform, handle, profileId } = req.body;
  if (!platform || !handle || !profileId) return res.status(400).json({ error: 'platform, handle, and profileId required' });

  try {
    const { rows } = await pool.query(
      `INSERT INTO accounts (platform, handle, profile_id) VALUES ($1, $2, $3)
       ON CONFLICT (platform, handle) DO UPDATE SET profile_id=$3 RETURNING *`,
      [platform, handle.replace('@', '').trim(), profileId]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE account
router.delete('/:id', async (req, res) => {
  await pool.query('DELETE FROM accounts WHERE id=$1', [req.params.id]);
  res.json({ success: true });
});

// POST trigger manual scrape for one account
router.post('/:id/scrape', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM accounts WHERE id=$1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Account not found' });

  try {
    const runId = await scrapeAccount(rows[0]);
    res.json({ message: 'Scrape started', runId, type: 'account', id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET account summary (for overview cards)
router.get('/:id/summary', async (req, res) => {
  const { id } = req.params;

  const { rows: [account] } = await pool.query('SELECT * FROM accounts WHERE id=$1', [id]);
  if (!account) return res.status(404).json({ error: 'Not found' });

  const { rows: snapshots } = await pool.query(
    `SELECT * FROM metrics_snapshots WHERE account_id=$1 ORDER BY snapshot_date DESC LIMIT 30`,
    [id]
  );

  const { rows: posts } = await pool.query(
    `SELECT * FROM posts WHERE account_id=$1 ORDER BY posted_at DESC LIMIT 50`,
    [id]
  );

  const avgEngagement = posts.length
    ? (posts.reduce((s, p) => s + parseFloat(p.engagement_rate || 0), 0) / posts.length).toFixed(2)
    : 0;

  // Follower growth (compare latest vs 7 days ago)
  const latestSnapshot = snapshots[0];
  const weekAgoSnapshot = snapshots[6];
  const followerGrowth = latestSnapshot && weekAgoSnapshot
    ? latestSnapshot.followers_count - weekAgoSnapshot.followers_count
    : 0;

  res.json({
    account,
    snapshots,
    posts,
    stats: {
      avg_engagement: avgEngagement,
      follower_growth_7d: followerGrowth,
      total_posts: posts.length,
    },
  });
});

module.exports = router;
