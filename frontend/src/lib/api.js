const BASE = import.meta.env.VITE_API_URL || '';

function getPassword() {
  return localStorage.getItem('dashboard_password') || '';
}

async function request(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getPassword()}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    localStorage.removeItem('dashboard_password');
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const api = {
  // Auth
  verify: (password) =>
    fetch(`${BASE}/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    }).then(r => r.json()),

  // Profiles
  getProfiles: () => request('GET', '/api/profiles'),
  addProfile: (name) => request('POST', '/api/profiles', { name }),
  deleteProfile: (id) => request('DELETE', `/api/profiles/${id}`),

  // Accounts
  getAccounts: () => request('GET', '/api/accounts'),
  addAccount: (platform, handle, profileId) => request('POST', '/api/accounts', { platform, handle, profileId }),
  deleteAccount: (id) => request('DELETE', `/api/accounts/${id}`),
  scrapeAccount: (id) => request('POST', `/api/accounts/${id}/scrape`),
  getAccountSummary: (id) => request('GET', `/api/accounts/${id}/summary`),

  // Competitors
  getCompetitors: (profileId) => request('GET', `/api/competitors${profileId ? `?profileId=${profileId}` : ''}`),
  addCompetitor: (platform, handle, notes, profileId) => request('POST', '/api/competitors', { platform, handle, notes, profileId }),
  updateCompetitor: (id, notes) => request('PATCH', `/api/competitors/${id}`, { notes }),
  deleteCompetitor: (id) => request('DELETE', `/api/competitors/${id}`),
  getCompetitor: (id) => request('GET', `/api/competitors/${id}`),
  scrapeCompetitor: (id) => request('POST', `/api/competitors/${id}/scrape`),

  // Analytics
  getGrowth: (accountId, days = 30) => request('GET', `/api/analytics/growth/${accountId}?days=${days}`),
  getTopPosts: (accountId, sort = 'engagement_rate') => request('GET', `/api/analytics/top-posts/${accountId}?sort=${sort}`),
  getContentTypes: (accountId) => request('GET', `/api/analytics/content-types/${accountId}`),
  getPostingPatterns: (accountId) => request('GET', `/api/analytics/posting-patterns/${accountId}`),
  getOverview: () => request('GET', '/api/analytics/overview'),

  // AI
  analyzeAccount: (accountId, force = false) => request('POST', `/api/ai/analyze/${accountId}`, { force }),
  analyzeCompetitor: (competitorId, accountId) => request('POST', `/api/ai/competitor/${competitorId}`, { accountId }),
  getInsightHistory: (accountId) => request('GET', `/api/ai/history/${accountId}`),

  // Scrape all
  scrapeAll: () => request('POST', '/api/scrape/all'),

  // Poll Apify run status (webhook fallback)
  pollScrapeStatus: (runId, type, id) =>
    request('GET', `/api/scrape/status/${runId}?type=${type}&id=${id}`),

  // Scripts
  getScriptPosts: (accountId) => request('GET', `/api/scripts/posts/${accountId}`),
  getCompetitorScriptPosts: (competitorId) => request('GET', `/api/scripts/competitor-posts/${competitorId}`),
  getScriptCompetitors: (accountId) => request('GET', `/api/scripts/competitors/${accountId}`),
  generateScript: (accountId, topic, competitorId) =>
    request('POST', '/api/scripts/generate', { accountId, topic, competitorId }),
  getGeneratedScripts: (accountId) => request('GET', `/api/scripts/generated/${accountId}`),
  deleteGeneratedScript: (id) => request('DELETE', `/api/scripts/generated/${id}`),
};
