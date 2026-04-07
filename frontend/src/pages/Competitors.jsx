import { useEffect, useRef, useState } from 'react';
import { useAccounts } from '../contexts/AccountContext';
import { useProfiles } from '../contexts/ProfileContext';
import { api } from '../lib/api';
import { Plus, Trash2, RefreshCw, Brain, ChevronDown, ChevronUp } from 'lucide-react';
import { PlatformBadge } from '../components/AccountSwitcher';
import PostCard from '../components/PostCard';

export default function Competitors() {
  const { activeAccount } = useAccounts();
  const { activeProfile } = useProfiles();
  const [competitors, setCompetitors] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [expandedData, setExpandedData] = useState({});
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ platform: activeAccount?.platform || 'instagram', handle: '', notes: '' });
  const [adding, setAdding] = useState(false);
  const [analyzing, setAnalyzing] = useState(null);
  const [insights, setInsights] = useState({});
  const [loading, setLoading] = useState(false);
  const [scraping, setScraping] = useState({}); // { [competitorId]: 'polling' | 'done' | 'failed' }
  const pollRefs = useRef({});

  // Reset form platform when active account changes
  useEffect(() => {
    setForm(f => ({ ...f, platform: activeAccount?.platform || 'instagram' }));
  }, [activeAccount?.platform]);

  useEffect(() => {
    fetchCompetitors();
    return () => {
      Object.values(pollRefs.current).forEach(clearInterval);
    };
  }, []);

  async function fetchCompetitors() {
    setLoading(true);
    try {
      const data = await api.getCompetitors(activeProfile?.id);
      setCompetitors(data);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  // Filter competitors by active account platform
  const filteredCompetitors = activeAccount
    ? competitors.filter(c => c.platform === activeAccount.platform)
    : competitors;

  function startPolling(runId, competitorId) {
    setScraping(s => ({ ...s, [competitorId]: 'polling' }));
    let attempts = 0;
    const maxAttempts = 20;
    pollRefs.current[competitorId] = setInterval(async () => {
      attempts++;
      try {
        const result = await api.pollScrapeStatus(runId, 'competitor', competitorId);
        if (result.done) {
          clearInterval(pollRefs.current[competitorId]);
          setScraping(s => ({ ...s, [competitorId]: result.error ? 'failed' : 'done' }));
          if (!result.error) {
            // Reload competitor data
            await fetchCompetitors();
            setExpandedData(d => { const copy = { ...d }; delete copy[competitorId]; return copy; });
          }
          setTimeout(() => setScraping(s => { const c = { ...s }; delete c[competitorId]; return c; }), 3000);
        }
      } catch (err) {
        console.error('Poll error:', err);
      }
      if (attempts >= maxAttempts) {
        clearInterval(pollRefs.current[competitorId]);
        setScraping(s => ({ ...s, [competitorId]: 'failed' }));
        setTimeout(() => setScraping(s => { const c = { ...s }; delete c[competitorId]; return c; }), 3000);
      }
    }, 15000);
  }

  async function handleAdd(e) {
    e.preventDefault();
    setAdding(true);
    try {
      const result = await api.addCompetitor(form.platform, form.handle, form.notes, activeProfile?.id);
      setForm(f => ({ ...f, handle: '', notes: '' }));
      setShowAdd(false);
      await fetchCompetitors();
      // Auto-poll if runId returned
      if (result.runId && result.id) {
        startPolling(result.runId, result.id);
      }
    } catch (err) {
      alert(err.message);
    }
    setAdding(false);
  }

  async function handleDelete(id) {
    await api.deleteCompetitor(id);
    clearInterval(pollRefs.current[id]);
    setCompetitors(c => c.filter(x => x.id !== id));
    if (expanded === id) setExpanded(null);
  }

  async function handleExpand(id) {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    if (!expandedData[id]) {
      const data = await api.getCompetitor(id).catch(() => null);
      if (data) setExpandedData(d => ({ ...d, [id]: data }));
    }
  }

  async function handleRefresh(c) {
    try {
      const result = await api.scrapeCompetitor(c.id);
      if (result.runId) startPolling(result.runId, c.id);
    } catch (err) {
      console.error('Scrape error:', err);
    }
  }

  async function handleAnalyze(competitorId) {
    setAnalyzing(competitorId);
    try {
      const res = await api.analyzeCompetitor(competitorId, activeAccount?.id);
      setInsights(i => ({ ...i, [competitorId]: res.insight }));
    } catch (err) {
      alert(err.message);
    }
    setAnalyzing(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-white text-2xl font-bold">Competitors</h1>
        <button
          onClick={() => setShowAdd(o => !o)}
          className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-white px-4 py-2 rounded-xl text-sm transition-colors"
        >
          <Plus size={16} />
          Add Competitor
        </button>
      </div>

      {showAdd && (
        <div className="bg-dark-800 border border-dark-600 rounded-2xl p-6">
          <h2 className="text-white font-semibold mb-4">Track a Competitor</h2>
          <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <select
              value={form.platform}
              onChange={e => setForm(f => ({ ...f, platform: e.target.value }))}
              className="bg-dark-700 border border-dark-500 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-accent"
            >
              {['instagram', 'tiktok', 'facebook', 'youtube', 'x'].map(p => (
                <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
              ))}
            </select>
            <input
              value={form.handle}
              onChange={e => setForm(f => ({ ...f, handle: e.target.value }))}
              placeholder="username (no @)"
              required
              className="bg-dark-700 border border-dark-500 rounded-xl px-3 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-accent"
            />
            <input
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Notes (optional)"
              className="bg-dark-700 border border-dark-500 rounded-xl px-3 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-accent"
            />
            <div className="md:col-span-3 flex gap-3">
              <button type="submit" disabled={adding} className="bg-accent hover:bg-accent-hover text-white px-6 py-2.5 rounded-xl text-sm disabled:opacity-50 transition-colors">
                {adding ? 'Adding & scraping...' : 'Add & Start Tracking'}
              </button>
              <button type="button" onClick={() => setShowAdd(false)} className="bg-dark-700 text-gray-400 px-6 py-2.5 rounded-xl text-sm hover:text-white transition-colors">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="bg-dark-800 border border-dark-600 rounded-2xl h-24 animate-pulse" />)}
        </div>
      ) : filteredCompetitors.length === 0 ? (
        <div className="bg-dark-800 border border-dark-600 rounded-2xl p-8 text-center text-gray-500">
          {activeAccount
            ? `No ${activeAccount.platform} competitors tracked yet. Add one above.`
            : 'No competitors tracked yet. Add one above.'}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredCompetitors.map(c => (
            <div key={c.id} className="bg-dark-800 border border-dark-600 rounded-2xl overflow-hidden">
              {/* Competitor row */}
              <div className="p-4 flex items-center gap-4">
                <PlatformBadge platform={c.platform} size="lg" />
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium">@{c.handle}</p>
                  <p className="text-gray-500 text-sm">
                    {c.followers_count?.toLocaleString()} followers •{' '}
                    {parseFloat(c.avg_engagement_rate || 0).toFixed(2)}% engagement
                    {c.notes && ` • ${c.notes}`}
                  </p>
                  {scraping[c.id] && (
                    <p className={`text-xs mt-0.5 ${scraping[c.id] === 'polling' ? 'text-yellow-400' : scraping[c.id] === 'done' ? 'text-green-400' : 'text-red-400'}`}>
                      {scraping[c.id] === 'polling' ? '⬤ Scraping...' : scraping[c.id] === 'done' ? '✓ Updated' : '✗ Failed'}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleRefresh(c)}
                    disabled={!!scraping[c.id]}
                    className="p-2 text-gray-500 hover:text-white hover:bg-dark-600 rounded-xl transition-colors disabled:opacity-40"
                    title="Refresh data"
                  >
                    <RefreshCw size={14} className={scraping[c.id] === 'polling' ? 'animate-spin' : ''} />
                  </button>
                  <button
                    onClick={() => handleAnalyze(c.id)}
                    disabled={analyzing === c.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 rounded-xl text-xs transition-colors disabled:opacity-50"
                  >
                    <Brain size={12} />
                    {analyzing === c.id ? 'Analyzing...' : 'AI Intel'}
                  </button>
                  <button
                    onClick={() => handleExpand(c.id)}
                    className="p-2 text-gray-500 hover:text-white hover:bg-dark-600 rounded-xl transition-colors"
                  >
                    {expanded === c.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                  <button
                    onClick={() => handleDelete(c.id)}
                    className="p-2 text-gray-500 hover:text-red-400 hover:bg-dark-600 rounded-xl transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* AI Insight */}
              {insights[c.id] && (
                <div className="border-t border-dark-600 p-4 bg-dark-700">
                  <div className="flex items-center gap-2 mb-3">
                    <Brain size={14} className="text-indigo-400" />
                    <span className="text-indigo-300 text-sm font-medium">AI Competitor Intelligence</span>
                  </div>
                  <div className="ai-content text-gray-300 text-sm" dangerouslySetInnerHTML={{
                    __html: insights[c.id].replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                  }} />
                </div>
              )}

              {/* Expanded posts */}
              {expanded === c.id && (
                <div className="border-t border-dark-600 p-4">
                  <h3 className="text-white text-sm font-medium mb-3">Top Posts</h3>
                  {expandedData[c.id] ? (
                    expandedData[c.id].posts?.length > 0 ? (
                      <div className="space-y-2">
                        {expandedData[c.id].posts.slice(0, 10).map(post => (
                          <PostCard key={post.id} post={post} />
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-sm">No posts scraped yet. Hit the refresh button.</p>
                    )
                  ) : (
                    <div className="h-16 animate-pulse bg-dark-700 rounded-xl" />
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
