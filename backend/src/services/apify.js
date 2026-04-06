const axios = require('axios');

const BASE_URL = 'https://api.apify.com/v2';
const TOKEN = () => process.env.APIFY_TOKEN;

// Actor IDs per platform
const ACTORS = {
  instagram: 'apify/instagram-profile-scraper',
  tiktok: 'clockworks/free-tiktok-scraper',
  facebook: 'apify/facebook-pages-scraper',
  youtube: 'streamers/youtube-channel-scraper',
  x: 'quacker/twitter-scraper',
};

// Build actor input per platform
function buildInput(platform, handle) {
  switch (platform) {
    case 'instagram':
      return { usernames: [handle] };
    case 'tiktok':
      return { profiles: [`https://www.tiktok.com/@${handle}`], resultsPerPage: 30 };
    case 'facebook':
      return { startUrls: [{ url: `https://www.facebook.com/${handle}` }], maxPosts: 30 };
    case 'youtube':
      return { startUrls: [{ url: `https://www.youtube.com/@${handle}` }], maxResults: 30 };
    case 'x':
      return { searchTerms: [`from:${handle}`], maxTweets: 30 };
    default:
      throw new Error(`Unknown platform: ${platform}`);
  }
}

async function runActor(platform, handle) {
  const actorId = ACTORS[platform];
  const input = buildInput(platform, handle);

  // Start actor run
  const runRes = await axios.post(
    `${BASE_URL}/acts/${encodeURIComponent(actorId)}/runs?token=${TOKEN()}&waitForFinish=120`,
    input
  );

  const { defaultDatasetId, id: runId } = runRes.data.data;

  // Fetch dataset items
  const dataRes = await axios.get(
    `${BASE_URL}/datasets/${defaultDatasetId}/items?token=${TOKEN()}&limit=50`
  );

  return { runId, items: dataRes.data };
}

// Normalize scraped data into common schema
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
      const p = items[0];
      return {
        display_name: p.authorMeta?.name || p.authorMeta?.nickName,
        profile_picture_url: p.authorMeta?.avatar,
        followers_count: p.authorMeta?.fans || 0,
        following_count: p.authorMeta?.following || 0,
        posts_count: p.authorMeta?.video || 0,
        bio: p.authorMeta?.signature,
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

function normalizePosts(platform, items, accountIdOrCompetitorId) {
  if (!items || items.length === 0) return [];

  switch (platform) {
    case 'instagram':
      return items
        .filter(i => i.type === 'Image' || i.type === 'Video' || i.type === 'Sidecar')
        .map(p => ({
          platform_post_id: p.id || p.shortCode,
          content_type: p.type?.toLowerCase() || 'photo',
          caption: p.caption,
          media_url: p.displayUrl || p.videoUrl,
          thumbnail_url: p.displayUrl,
          post_url: p.url,
          likes_count: p.likesCount || 0,
          comments_count: p.commentsCount || 0,
          shares_count: 0,
          saves_count: 0,
          views_count: p.videoViewCount || 0,
          engagement_rate: calcEngagement(p.likesCount, p.commentsCount, 0, p.followersCount),
          posted_at: p.timestamp ? new Date(p.timestamp * 1000) : null,
        }));

    case 'tiktok':
      return items.map(p => ({
        platform_post_id: p.id,
        content_type: 'video',
        caption: p.text,
        media_url: p.videoMeta?.downloadAddr,
        thumbnail_url: p.videoMeta?.coverUrl,
        post_url: p.webVideoUrl,
        likes_count: p.diggCount || 0,
        comments_count: p.commentCount || 0,
        shares_count: p.shareCount || 0,
        saves_count: p.collectCount || 0,
        views_count: p.playCount || 0,
        engagement_rate: calcEngagement(p.diggCount, p.commentCount, p.shareCount, p.authorMeta?.fans),
        posted_at: p.createTimeISO ? new Date(p.createTimeISO) : null,
      }));

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
          posted_at: p.time ? new Date(p.time) : null,
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
          posted_at: p.date ? new Date(p.date) : null,
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
          posted_at: p.created_at ? new Date(p.created_at) : null,
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

module.exports = { runActor, normalizeProfile, normalizePosts };
