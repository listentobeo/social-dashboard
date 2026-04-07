const pool = require('../db/client');
const { startActorRun, fetchDataset, normalizeProfile, normalizePosts } = require('./apify');

// Trigger a scrape for an account — fires Apify run, returns immediately
// Pulls 30 posts so we can show best AND worst performing
async function scrapeAccount(account) {
  const webhookUrl = `${process.env.BACKEND_URL}/webhooks/apify?type=account&id=${account.id}`;
  console.log(`[SCRAPE] Starting ${account.platform}:${account.handle} — webhook: ${webhookUrl}`);
  try {
    const runId = await startActorRun(account.platform, account.handle, webhookUrl, 30);
    console.log(`[SCRAPE] Run started: ${runId}`);
    return runId;
  } catch (err) {
    console.error(`[SCRAPE] Failed to start ${account.platform}:${account.handle}:`, err.message);
    throw err;
  }
}

// Trigger a scrape for a competitor — pull 20, keep top 10 by engagement
async function scrapeCompetitor(competitor) {
  const webhookUrl = `${process.env.BACKEND_URL}/webhooks/apify?type=competitor&id=${competitor.id}`;
  console.log(`[SCRAPE] Starting competitor ${competitor.platform}:${competitor.handle} — webhook: ${webhookUrl}`);
  try {
    const runId = await startActorRun(competitor.platform, competitor.handle, webhookUrl, 20);
    console.log(`[SCRAPE] Competitor run started: ${runId}`);
    return runId;
  } catch (err) {
    console.error(`[SCRAPE] Failed to start competitor ${competitor.platform}:${competitor.handle}:`, err.message);
    throw err;
  }
}

// Process webhook result for an account
async function processAccountWebhook(accountId, datasetId) {
  const { rows: [account] } = await pool.query('SELECT * FROM accounts WHERE id=$1', [accountId]);
  if (!account) return;

  const items = await fetchDataset(datasetId);
  const profile = normalizeProfile(account.platform, items);
  const posts = normalizePosts(account.platform, items);

  if (profile) {
    await pool.query(
      `UPDATE accounts SET display_name=$1, profile_picture_url=$2, followers_count=$3,
       following_count=$4, posts_count=$5, bio=$6, last_scraped_at=NOW() WHERE id=$7`,
      [profile.display_name, profile.profile_picture_url, profile.followers_count,
       profile.following_count, profile.posts_count, profile.bio, accountId]
    );

    await pool.query(
      `INSERT INTO metrics_snapshots (account_id, followers_count, following_count, posts_count)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (account_id, snapshot_date) DO UPDATE
       SET followers_count=$2, following_count=$3, posts_count=$4`,
      [accountId, profile.followers_count, profile.following_count, profile.posts_count]
    );
  }

  for (const post of posts) {
    if (!post.platform_post_id) continue;
    await pool.query(
      `INSERT INTO posts (account_id, platform_post_id, content_type, caption, media_url,
       thumbnail_url, post_url, likes_count, comments_count, shares_count, saves_count,
       views_count, engagement_rate, posted_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       ON CONFLICT (account_id, platform_post_id) DO UPDATE
       SET likes_count=$8, comments_count=$9, shares_count=$10, saves_count=$11,
       views_count=$12, engagement_rate=$13, scraped_at=NOW()`,
      [accountId, post.platform_post_id, post.content_type, post.caption,
       post.media_url, post.thumbnail_url, post.post_url, post.likes_count,
       post.comments_count, post.shares_count, post.saves_count, post.views_count,
       post.engagement_rate, post.posted_at]
    );
  }

  console.log(`[WEBHOOK] Account ${accountId} updated — ${posts.length} posts`);
}

// Process webhook result for a competitor
async function processCompetitorWebhook(competitorId, datasetId) {
  const { rows: [competitor] } = await pool.query('SELECT * FROM competitors WHERE id=$1', [competitorId]);
  if (!competitor) return;

  const items = await fetchDataset(datasetId);
  const profile = normalizeProfile(competitor.platform, items);
  // Keep only top 10 by engagement rate
  const allPosts = normalizePosts(competitor.platform, items);
  const posts = allPosts
    .sort((a, b) => (b.engagement_rate || 0) - (a.engagement_rate || 0))
    .slice(0, 10);

  if (profile) {
    const avgEngagement = posts.length
      ? posts.reduce((s, p) => s + (p.engagement_rate || 0), 0) / posts.length
      : 0;

    await pool.query(
      `UPDATE competitors SET display_name=$1, profile_picture_url=$2, followers_count=$3,
       posts_count=$4, avg_engagement_rate=$5, last_scraped_at=NOW() WHERE id=$6`,
      [profile.display_name, profile.profile_picture_url, profile.followers_count,
       profile.posts_count, avgEngagement.toFixed(3), competitorId]
    );
  }

  for (const post of posts) {
    if (!post.platform_post_id) continue;
    await pool.query(
      `INSERT INTO competitor_posts (competitor_id, platform_post_id, content_type, caption,
       media_url, thumbnail_url, post_url, likes_count, comments_count, shares_count,
       views_count, engagement_rate, posted_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT (competitor_id, platform_post_id) DO UPDATE
       SET likes_count=$8, comments_count=$9, shares_count=$10, views_count=$11,
       engagement_rate=$12, scraped_at=NOW()`,
      [competitorId, post.platform_post_id, post.content_type, post.caption,
       post.media_url, post.thumbnail_url, post.post_url, post.likes_count,
       post.comments_count, post.shares_count, post.views_count,
       post.engagement_rate, post.posted_at]
    );
  }

  console.log(`[WEBHOOK] Competitor ${competitorId} updated — ${posts.length} posts`);
}

async function runAllScrapes() {
  const { rows: accounts } = await pool.query('SELECT * FROM accounts');
  const { rows: competitors } = await pool.query('SELECT * FROM competitors');
  for (const account of accounts) await scrapeAccount(account).catch(console.error);
  for (const competitor of competitors) await scrapeCompetitor(competitor).catch(console.error);
}

// No-op on Vercel — cron handled via vercel.json + /cron/scrape endpoint
function startCron() {}

module.exports = { startCron, runAllScrapes, scrapeAccount, scrapeCompetitor, processAccountWebhook, processCompetitorWebhook };
