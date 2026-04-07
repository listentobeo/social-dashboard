const router = require('express').Router();
const { runAllScrapes, processAccountWebhook, processCompetitorWebhook } = require('../services/cron');
const { getRunStatus } = require('../services/apify');

// POST trigger full scrape of all accounts + competitors
router.post('/all', async (req, res) => {
  try {
    await runAllScrapes();
    res.json({ message: 'All scrapes started — Apify will call webhooks when done' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET poll Apify run status — if SUCCEEDED, process the data immediately
// Used as webhook fallback when BACKEND_URL is not set or webhook fails
// Frontend polls this every 15s after triggering a scrape
router.get('/status/:runId', async (req, res) => {
  const { runId } = req.params;
  const { type, id } = req.query;

  if (!runId || !type || !id) {
    return res.status(400).json({ error: 'runId, type, and id are required' });
  }

  try {
    const run = await getRunStatus(runId);
    const { status, defaultDatasetId } = run;

    if (status === 'SUCCEEDED' && defaultDatasetId) {
      console.log(`[POLL] Run ${runId} succeeded — processing ${type}:${id}`);
      if (type === 'account') {
        await processAccountWebhook(id, defaultDatasetId);
      } else if (type === 'competitor') {
        await processCompetitorWebhook(id, defaultDatasetId);
      }
      return res.json({ done: true, runStatus: status });
    }

    if (status === 'FAILED' || status === 'ABORTED' || status === 'TIMED-OUT') {
      return res.json({ done: true, runStatus: status, error: `Apify run ${status.toLowerCase()}` });
    }

    // Still running
    res.json({ done: false, runStatus: status });
  } catch (err) {
    console.error('[POLL] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
