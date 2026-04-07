const axios = require('axios');

const BASE_URL = 'https://api.apify.com/v2';
const TOKEN = () => process.env.APIFY_TOKEN;

const ACTORS = {
  instagram: 'apify/instagram-profile-scraper',
  tiktok: 'clockworks/free-tiktok-scraper',
  facebook: 'apify/facebook-pages-scraper',
  youtube: 'streamers/youtube-channel-scraper',
  x: 'quacker/twitter-scraper',
};

function buildInput(platform, handle, limit = 30) {
  switch (platform) {
    case 'instagram':
      return { usernames: [handle] };
    case 'tiktok':
      return { profiles: [`https://www.tiktok.com/@${handle}`], resultsPerPage: limit };
    case 'facebook':
      return { startUrls: [{ url: `https://www.facebook.com/${handle}` }], maxPosts: limit };
    case 'youtube':
      return { startUrls: [{ url: `https://www.youtube.com/@${handle}` }], maxResults: limit };
    case 'x':
      return { searchTerms: [`from:${handle}`], maxTweets: limit };
    default:
      throw new Error(`Unknown platform: ${platform}`);
  }
}

// Start actor run and return immediately with runId (no waiting)
// Apify will POST to our webhook when done
async function startActorRun(platform, handle, webhookUrl, limit = 30) {
  const actorId = ACTORS[platform];
  const input = buildInput(platform, handle, limit);

  const params = new URLSearchParams({ token: TOKEN() });

  // Attach webhook if URL provided
  const webhooks = webhookUrl ? [
    {
      eventTypes: ['ACTOR.RUN.SUCCEEDED', 'ACTOR.RUN.FAILED'],
      requestUrl: webhookUrl,
      payloadTemplate: JSON.stringify({
        runId: '{{runId}}',
        datasetId: '{{defaultDatasetId}}',
        status: '{{status}}',
      }),
    }
  ] : [];

  // free-tiktok-scraper is a free actor that doesn't support webhooks — strip them to avoid 402
  const webhooksToAttach = platform === 'tiktok' ? [] : webhooks;
  const body = { ...input };
  if (webhooksToAttach.length) body.__webhooks = webhooksToAttach;

  const runRes = await axios.post(
    `${BASE_URL}/acts/${encodeURIComponent(actorId)}/runs?${params}`,
    body
  );

  return runRes.data.data.id;
}

// Fetch dataset items by datasetId (called from webhook handler)
async function fetchDataset(datasetId) {
  const res = await axios.get(
    `${BASE_URL}/datasets/${datasetId}/items?token=${TOKEN()}&limit=50`
  );
  return res.data;
}

// Synchronous run — only used for local dev, not Vercel
async function runActor(platform, handle) {
  const actorId = ACTORS[platform];
  const input = buildInput(platform, handle);

  const runRes = await axios.post(
    `${BASE_URL}/acts/${encodeURIComponent(actorId)}/runs?token=${TOKEN()}&waitForFinish=120`,
    input
  );

  const { defaultDatasetId, id: runId } = runRes.data.data;
  const dataRes = await axios.get(
    `${BASE_URL}/datasets/${defaultDatasetId}/items?token=${TOKEN()}&limit=50`
  );
  return { runId, items: dataRes.data };
}

function normalizeProfile(platform, items) {
  if (!items || items.length === 0) return null;

  switch (platform) {
    case 'instagram': {
      const p = items[0];
      return {
        display_name: p.fullName || p.username,
        profile_picture_url: p.profilePicUrl,
        followers_count: p.followersCount || 0,
        following_count: p.followingCount || 0,
        posts_count: p.postsCount || 0,
        bio: p.biography,
      };
    }
    case 'tiktok': {
      // free-tiktok-scraper returns flat dot-notation keys; no follower data available
      const p = items[0];
      return {
        display_name: p['authorMeta.name'] || p['authorMeta.nickName'] || null,
        profile_picture_url: p['authorMeta.avatar'] || null,
        followers_count: p['authorMeta.fans'] || 0,
        following_count: 0,
        posts_count: 0,
        bio: p['authorMeta.signature'] || null,
      };
    }
    case 'facebook': {
      const p = items[0];
      return {
        display_name: p.title || p.name,
        profile_picture_url: p.pageInfo?.profilePic,
        followers_count: p.likes || p.followers || 0,
        following_count: 0,
        posts_count: 0,
        bio: p.about,
      };
    }
    case 'youtube': {
      const p = items.find(i => i.type === 'channel') || items[0];
      return {
        display_name: p.channelName || p.title,
        profile_picture_url: p.channelThumbnail || p.thumbnailUrl,
        followers_count: parseInt(String(p.numberOfSubscribers || '0').replace(/[^0-9]/g, '')) || 0,
        following_count: 0,
        posts_count: parseInt(String(p.totalVideos || '0').replace(/[^0-9]/g, '')) || 0,
        bio: p.channelDescription,
      };
    }
    case 'x': {
      const p = items[0];
      return {
        display_name: p.user?.name,
        profile_picture_url: p.user?.profileImageUrl,
        followers_count: p.user?.followersCount || 0,
        following_count: p.user?.friendsCount || 0,
        posts_count: p.user?.statusesCount || 0,
        bio: p.user?.description,
      };
    }
    default:
      return null;
  }
}

function normalizePosts(platform, items) {
  if (!items || items.length === 0) return [];

  switch (platform) {
    case 'instagram': {
      // instagram-profile-scraper returns 1 profile object with latestPosts[] nested inside
      const profile = items[0] || {};
      const followers = profile.followersCount || 0;
      const posts = profile.latestPosts || [];
      return posts.map(p => ({
        platform_post_id: p.id || p.shortCode,
        content_type: (p.type || 'Image').toLowerCase(),
        caption: p.caption,
        media_url: p.displayUrl || p.videoUrl,
        thumbnail_url: p.displayUrl,
        post_url: p.url || (p.shortCode ? `https://www.instagram.com/p/${p.shortCode}/` : null),
        likes_count: p.likesCount || 0,
        comments_count: p.commentsCount || 0,
        shares_count: 0,
        saves_count: 0,
        views_count: p.videoViewCount || p.videoPlayCount || 0,
        engagement_rate: calcEngagement(p.likesCount, p.commentsCount, 0, followers),
        posted_at: safeDate(p.timestamp ? p.timestamp * 1000 : null),
      }));
    }

    case 'tiktok':
      return items
        .filter(p => p.webVideoUrl || p.id)
        .map(p => {
          // free-tiktok-scraper: no follower data, use views-based engagement instead
          const likes = p.diggCount || 0;
          const comments = p.commentCount || 0;
          const shares = p.shareCount || 0;
          const views = p.playCount || 0;
          const engagementRate = views > 0
            ? parseFloat((((likes + comments + shares) / views) * 100).toFixed(3))
            : 0;
          return {
            platform_post_id: p.id || p.webVideoUrl?.split('/').pop() || null,
            content_type: 'video',
            caption: p.text,
            media_url: null,
            thumbnail_url: null,
            post_url: p.webVideoUrl,
            likes_count: likes,
            comments_count: comments,
            shares_count: shares,
            saves_count: 0,
            views_count: views,
            engagement_rate: engagementRate,
            posted_at: safeDate(p.createTimeISO),
          };
        });

    case 'facebook':
      return items
        .filter(i => i.postId)
        .map(p => ({
          platform_post_id: p.postId,
          content_type: p.media?.length ? 'photo' : 'text',
          caption: p.text,
          media_url: p.media?.[0]?.image?.uri,
          thumbnail_url: p.media?.[0]?.image?.uri,
          post_url: p.url,
          likes_count: p.likes || 0,
          comments_count: p.comments || 0,
          shares_count: p.shares || 0,
          saves_count: 0,
          views_count: 0,
          engagement_rate: calcEngagement(p.likes, p.comments, p.shares, null),
          posted_at: safeDate(p.time),
        }));

    case 'youtube':
      return items
        .filter(i => i.type === 'video' || i.videoId)
        .map(p => ({
          platform_post_id: p.id || p.videoId,
          content_type: 'video',
          caption: p.title,
          media_url: p.url,
          thumbnail_url: p.thumbnailUrl,
          post_url: p.url,
          likes_count: parseInt(p.likes || '0') || 0,
          comments_count: parseInt(p.commentsCount || '0') || 0,
          shares_count: 0,
          saves_count: 0,
          views_count: parseInt(p.viewCount || p.views || '0') || 0,
          engagement_rate: calcEngagement(parseInt(p.likes || '0'), parseInt(p.commentsCount || '0'), 0, null),
          posted_at: safeDate(p.date),
        }));

    case 'x':
      return items
        .filter(i => i.id_str)
        .map(p => ({
          platform_post_id: p.id_str,
          content_type: p.entities?.media?.[0]?.type === 'video' ? 'video' : p.entities?.media ? 'photo' : 'tweet',
          caption: p.full_text || p.text,
          media_url: p.entities?.media?.[0]?.media_url_https,
          thumbnail_url: p.entities?.media?.[0]?.media_url_https,
          post_url: `https://x.com/i/web/status/${p.id_str}`,
          likes_count: p.favorite_count || 0,
          comments_count: p.reply_count || 0,
          shares_count: p.retweet_count || 0,
          saves_count: 0,
          views_count: p.views?.count || 0,
          engagement_rate: calcEngagement(p.favorite_count, p.reply_count, p.retweet_count, p.user?.followersCount),
          posted_at: safeDate(p.created_at),
        }));

    default:
      return [];
  }
}

function calcEngagement(likes = 0, comments = 0, shares = 0, followers = null) {
  const total = (likes || 0) + (comments || 0) + (shares || 0);
  if (!followers || followers === 0) return 0;
  return parseFloat(((total / followers) * 100).toFixed(3));
}

// Returns a valid Date or null — prevents "Invalid Date" from crashing pg inserts
function safeDate(val) {
  if (val == null) return null;
  const d = val instanceof Date ? val : new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

// Check run status — fast, just reads Apify metadata
async function getRunStatus(runId) {
  const res = await axios.get(`${BASE_URL}/actor-runs/${runId}?token=${TOKEN()}`);
  return res.data.data; // { status, defaultDatasetId, ... }
}

module.exports = { startActorRun, fetchDataset, runActor, getRunStatus, normalizeProfile, normalizePosts };
