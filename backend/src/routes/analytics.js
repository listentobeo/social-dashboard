const router = require('express').Router();
const pool = require('../db/client');

// GET growth chart data for an account
router.get('/growth/:accountId', async (req, res) => {
  const { accountId } = req.params;
  const { days = 30 } = req.query;

  const { rows } = await pool.query(
    `SELECT snapshot_date, followers_count, following_count, posts_count, avg_engagement_rate
     FROM metrics_snapshots
     WHERE account_id=$1 AND snapshot_date >= CURRENT_DATE - INTERVAL '${parseInt(days)} days'
     ORDER BY snapshot_date ASC`,
    [accountId]
  );

  res.json(rows);
});

// GET top posts for an account
router.get('/top-posts/:accountId', async (req, res) => {
  const { accountId } = req.params;
  const { limit = 20, sort = 'engagement_rate' } = req.query;

  const validSort = ['engagement_rate', 'likes_count', 'views_count', 'comments_count'].includes(sort)
    ? sort : 'engagement_rate';

  const { rows } = await pool.query(
    `SELECT * FROM posts WHERE account_id=$1 ORDER BY ${validSort} DESC LIMIT $2`,
    [accountId, parseInt(limit)]
  );

  res.json(rows);
});

// GET engagement breakdown by content type
router.get('/content-types/:accountId', async (req, res) => {
  const { accountId } = req.params;

  const { rows } = await pool.query(
    `SELECT content_type,
            COUNT(*) as post_count,
            AVG(engagement_rate) as avg_engagement,
            AVG(likes_count) as avg_likes,
            AVG(views_count) as avg_views,
            AVG(comments_count) as avg_comments
     FROM posts
     WHERE account_id=$1
     GROUP BY content_type
     ORDER BY avg_engagement DESC`,
    [accountId]
  );

  res.json(rows);
});

// GET posting frequency vs engagement correlation
router.get('/posting-patterns/:accountId', async (req, res) => {
  const { accountId } = req.params;

  // Posts per day of week
  const { rows: byDay } = await pool.query(
    `SELECT EXTRACT(DOW FROM posted_at) as day_of_week,
            COUNT(*) as post_count,
            AVG(engagement_rate) as avg_engagement
     FROM posts WHERE account_id=$1 AND posted_at IS NOT NULL
     GROUP BY day_of_week ORDER BY day_of_week`,
    [accountId]
  );

  // Posts per hour of day
  const { rows: byHour } = await pool.query(
    `SELECT EXTRACT(HOUR FROM posted_at) as hour_of_day,
            COUNT(*) as post_count,
            AVG(engagement_rate) as avg_engagement
     FROM posts WHERE account_id=$1 AND posted_at IS NOT NULL
     GROUP BY hour_of_day ORDER BY hour_of_day`,
    [accountId]
  );

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  res.json({
    by_day: byDay.map(r => ({ ...r, day_name: days[r.day_of_week] })),
    by_hour: byHour,
  });
});

// GET cross-account overview (all accounts summary)
router.get('/overview', async (req, res) => {
  const { rows: accounts } = await pool.query(`
    SELECT a.*,
      COALESCE((SELECT AVG(p.engagement_rate) FROM posts p WHERE p.account_id = a.id), 0) as avg_engagement,
      COALESCE((SELECT COUNT(*) FROM posts p WHERE p.account_id = a.id), 0) as scraped_posts
    FROM accounts a
    ORDER BY a.platform, a.handle
  `);

  const { rows: [totals] } = await pool.query(`
    SELECT
      SUM(a.followers_count) as total_followers,
      COUNT(DISTINCT a.id) as total_accounts,
      COUNT(DISTINCT p.id) as total_posts
    FROM accounts a
    LEFT JOIN posts p ON p.account_id = a.id
  `);

  res.json({ accounts, totals });
});

module.exports = router;
