require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const auth = require('./middleware/auth');

const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
}));
app.use(express.json());

// Health check — no auth
app.get('/health', (req, res) => res.json({ status: 'ok', ts: new Date() }));

// Auth check endpoint for frontend login
app.post('/auth/verify', (req, res) => {
  const { password } = req.body;
  if (password === process.env.DASHBOARD_PASSWORD) {
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Invalid password' });
  }
});

// Vercel cron endpoint — secured with CRON_SECRET
app.post('/cron/scrape', async (req, res) => {
  if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const { runAllScrapes } = require('./services/cron');
  res.json({ message: 'Scrape started' });
  runAllScrapes().catch(console.error);
});

// Webhook — no auth (called by Apify)
app.use('/webhooks', require('./routes/webhooks'));

// All API routes behind auth
app.use('/api/accounts', auth, require('./routes/accounts'));
app.use('/api/competitors', auth, require('./routes/competitors'));
app.use('/api/analytics', auth, require('./routes/analytics'));
app.use('/api/ai', auth, require('./routes/ai'));
app.use('/api/scrape', auth, require('./routes/scrape'));
app.use('/api/scripts', auth, require('./routes/scripts'));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

// Local dev
if (require.main === module) {
  const { startCron } = require('./services/cron');
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    startCron();
  });
}

module.exports = app;
