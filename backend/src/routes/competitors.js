const router = require('express').Router();
const pool = require('../db/client');
const { scrapeCompetitor } = require('../services/cron');

// GET all competitors
router.get('/', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM competitors ORDER BY created_at DESC');
  res.json(rows);
});

// POST add competitor
router.post('/', async (req, res) => {
  const { platform, handle, notes } = req.body;
  if (!platform || !handle) return res.status(400).json({ error: 'platform and handle required' });

  try {
    const { rows } = await pool.query(
      `INSERT INTO competitors (platform, handle, notes) VALUES ($1, $2, $3)
       ON CONFLICT (platform, handle) DO UPDATE SET notes=$3 RETURNING *`,
      [platform, handle.replace('@', '').trim(), notes || null]
    );

    // Auto-trigger first scrape
    scrapeCompetitor(rows[0]).catch(console.error);

    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH update competitor notes
router.patch('/:id', async (req, res) => {
  const { notes } = req.body;
  const { rows } = await pool.query(
    'UPDATE competitors SET notes=$1 WHERE id=$2 RETURNING *',
    [notes, req.params.id]
  );
  res.json(rows[0]);
});

// DELETE competitor
router.delete('/:id', async (req, res) => {
  await pool.query('DELETE FROM competitors WHERE id=$1', [req.params.id]);
  res.json({ success: true });
});

// GET competitor details + posts
router.get('/:id', async (req, res) => {
  const { rows: [competitor] } = await pool.query(
    'SELECT * FROM competitors WHERE id=$1', [req.params.id]
  );
  if (!competitor) return res.status(404).json({ error: 'Not found' });

  const { rows: posts } = await pool.query(
    `SELECT * FROM competitor_posts WHERE competitor_id=$1 ORDER BY posted_at DESC LIMIT 50`,
    [req.params.id]
  );

  res.json({ competitor, posts });
});

// POST trigger manual rescrape
router.post('/:id/scrape', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM competitors WHERE id=$1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Not found' });

  res.json({ message: 'Scrape started' });
  scrapeCompetitor(rows[0]).catch(console.error);
});

module.exports = router;
