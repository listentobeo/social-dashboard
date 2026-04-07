const router = require('express').Router();
const pool = require('../db/client');

router.get('/', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM profiles ORDER BY created_at ASC');
  res.json(rows);
});

router.post('/', async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  const { rows } = await pool.query(
    'INSERT INTO profiles (name) VALUES ($1) RETURNING *',
    [name.trim()]
  );
  res.json(rows[0]);
});

router.patch('/:id', async (req, res) => {
  const { name } = req.body;
  const { rows } = await pool.query(
    'UPDATE profiles SET name=$1 WHERE id=$2 RETURNING *',
    [name, req.params.id]
  );
  res.json(rows[0]);
});

router.delete('/:id', async (req, res) => {
  await pool.query('DELETE FROM profiles WHERE id=$1', [req.params.id]);
  res.json({ success: true });
});

module.exports = router;
