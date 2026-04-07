const router = require('express').Router();
const { runAllScrapes } = require('../services/cron');

// POST trigger full scrape of all accounts + competitors
router.post('/all', async (req, res) => {
  try {
    await runAllScrapes();
    res.json({ message: 'All scrapes started — Apify will call webhooks when done' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
