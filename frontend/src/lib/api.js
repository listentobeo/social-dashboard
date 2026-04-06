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

  // Accounts
  getAccounts: () => request('GET', '/api/accounts'),
  addAccount: (platform, handle) => request('POST', '/api/accounts', { platform, handle }),
  deleteAccount: (id) => request('DELETE', `/api/accounts/${id}`),
  scrapeAccount: (id) => request('POST', `/api/accounts/${id}/scrape`),
  getAccountSummary: (id) => request('GET', `/api/accounts/${id}/summary`),

  // Competitors
  getCompetitors: () => request('GET', '/api/competitors'),
  addCompetitor: (platform, handle, notes) => request('POST', '/api/competitors', { platform, handle, notes }),
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
};
