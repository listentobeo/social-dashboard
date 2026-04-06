const cron = require('node-cron');
const pool = require('../db/client');
const { runActor, normalizeProfile, normalizePosts } = require('./apify');

async function scrapeAccount(account) {
  console.log(`[CRON] Scraping ${account.platform}:${account.handle}`);
  try {
    const { items } = await runActor(account.platform, account.handle);

    const profile = normalizeProfile(account.platform, items);
    const posts = normalizePosts(account.platform, items, account.id);

    if (profile) {
      await pool.query(
        `UPDATE accounts SET display_name=$1, profile_picture_url=$2, followers_count=$3,
         following_count=$4, posts_count=$5, bio=$6, last_scraped_at=NOW() WHERE id=$7`,
        [profile.display_name, profile.profile_picture_url, profile.followers_count,
         profile.following_count, profile.posts_count, profile.bio, account.id]
      );

      // Daily snapshot
      await pool.query(
        `INSERT INTO metrics_snapshots (account_id, followers_count, following_count, posts_count)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (account_id, snapshot_date) DO UPDATE
         SET followers_count=$2, following_count=$3, posts_count=$4`,
        [account.id, profile.followers_count, profile.following_count, profile.posts_count]
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
        [account.id, post.platform_post_id, post.content_type, post.caption,
         post.media_url, post.thumbnail_url, post.post_url, post.likes_count,
         post.comments_count, post.shares_count, post.saves_count, post.views_count,
         post.engagement_rate, post.posted_at]
      );
    }

    console.log(`[CRON] Done: ${account.platform}:${account.handle} — ${posts.length} posts`);
  } catch (err) {
    console.error(`[CRON] Failed ${account.platform}:${account.handle}:`, err.message);
  }
}

async function scrapeCompetitor(competitor) {
  console.log(`[CRON] Scraping competitor ${competitor.platform}:${competitor.handle}`);
  try {
    const { items } = await runActor(competitor.platform, competitor.handle);

    const profile = normalizeProfile(competitor.platform, items);
    const posts = normalizePosts(competitor.platform, items, competitor.id);

    if (profile) {
      const avgEngagement = posts.length
        ? posts.reduce((s, p) => s + (p.engagement_rate || 0), 0) / posts.length
        : 0;

      await pool.query(
        `UPDATE competitors SET display_name=$1, profile_picture_url=$2, followers_count=$3,
         posts_count=$4, avg_engagement_rate=$5, last_scraped_at=NOW() WHERE id=$6`,
        [profile.display_name, profile.profile_picture_url, profile.followers_count,
         profile.posts_count, avgEngagement.toFixed(3), competitor.id]
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
        [competitor.id, post.platform_post_id, post.content_type, post.caption,
         post.media_url, post.thumbnail_url, post.post_url, post.likes_count,
         post.comments_count, post.shares_count, post.views_count,
         post.engagement_rate, post.posted_at]
      );
    }
  } catch (err) {
    console.error(`[CRON] Failed competitor ${competitor.platform}:${competitor.handle}:`, err.message);
  }
}

async function runAllScrapes() {
  const { rows: accounts } = await pool.query('SELECT * FROM accounts');
  const { rows: competitors } = await pool.query('SELECT * FROM competitors');

  for (const account of accounts) await scrapeAccount(account);
  for (const competitor of competitors) await scrapeCompetitor(competitor);
}

function startCron() {
  // Run every 6 hours
  const schedule = process.env.SCRAPE_CRON || '0 */6 * * *';
  cron.schedule(schedule, runAllScrapes);
  console.log(`[CRON] Scheduled: ${schedule}`);
}

module.exports = { startCron, runAllScrapes, scrapeAccount, scrapeCompetitor };
