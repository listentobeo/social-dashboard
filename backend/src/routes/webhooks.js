const router = require('express').Router();
const { processAccountWebhook, processCompetitorWebhook } = require('../services/cron');

// Apify calls this when a scrape run completes
// URL: /webhooks/apify?type=account&id=xxx OR ?type=competitor&id=xxx
router.post('/apify', async (req, res) => {
  const { type, id } = req.query;
  const { datasetId, status } = req.body;

  // Acknowledge immediately so Apify doesn't retry
  res.json({ received: true });

  if (status !== 'SUCCEEDED') {
    console.error(`[WEBHOOK] Run failed for ${type}:${id} — status: ${status}`);
    return;
  }

  if (!datasetId) {
    console.error(`[WEBHOOK] No datasetId for ${type}:${id}`);
    return;
  }

  try {
    if (type === 'account') {
      await processAccountWebhook(id, datasetId);
    } else if (type === 'competitor') {
      await processCompetitorWebhook(id, datasetId);
    }
  } catch (err) {
    console.error(`[WEBHOOK] Processing error for ${type}:${id}:`, err.message);
  }
});

module.exports = router;
