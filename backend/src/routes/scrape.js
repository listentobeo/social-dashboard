const router = require('express').Router();
const { runAllScrapes } = require('../services/cron');

// POST trigger full scrape of all accounts + competitors
router.post('/all', async (req, res) => {
  res.json({ message: 'Full scrape started in background' });
  runAllScrapes().catch(console.error);
});

module.exports = router;
