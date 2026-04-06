import { useState, useEffect } from 'react';
import { useAccounts } from '../contexts/AccountContext';
import { api } from '../lib/api';
import { Sparkles, RefreshCw, Clock } from 'lucide-react';

export default function AIInsights() {
  const { activeAccount } = useAccounts();
  const [insight, setInsight] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [cached, setCached] = useState(false);

  useEffect(() => {
    if (!activeAccount?.id) return;
    api.getInsightHistory(activeAccount.id).then(setHistory).catch(console.error);
  }, [activeAccount?.id]);

  async function handleAnalyze(force = false) {
    if (!activeAccount?.id) return;
    setLoading(true);
    try {
      const res = await api.analyzeAccount(activeAccount.id, force);
      setInsight(res.insight);
      setCached(res.cached);
      if (!res.cached) {
        const h = await api.getInsightHistory(activeAccount.id);
        setHistory(h);
      }
    } catch (err) {
      alert(err.message);
    }
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white text-2xl font-bold">AI Insights</h1>
          <p className="text-gray-500 text-sm mt-0.5">Why your content performs the way it does</p>
        </div>
        <div className="flex gap-2">
          {insight && (
            <button
              onClick={() => handleAnalyze(true)}
              disabled={loading}
              className="flex items-center gap-2 bg-dark-700 hover:bg-dark-600 text-gray-300 px-4 py-2 rounded-xl text-sm transition-colors disabled:opacity-50"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          )}
          <button
            onClick={() => handleAnalyze(false)}
            disabled={loading}
            className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-white px-4 py-2 rounded-xl text-sm transition-colors disabled:opacity-50"
          >
            <Sparkles size={14} />
            {loading ? 'Analyzing...' : 'Analyze My Content'}
          </button>
        </div>
      </div>

      {loading && (
        <div className="bg-dark-800 border border-dark-600 rounded-2xl p-8 flex flex-col items-center justify-center gap-3">
          <div className="w-10 h-10 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400 text-sm">Gemini is analyzing your content patterns...</p>
        </div>
      )}

      {insight && !loading && (
        <div className="bg-dark-800 border border-dark-600 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-accent" />
              <span className="text-white font-semibold">@{activeAccount?.handle} Analysis</span>
            </div>
            {cached && (
              <span className="flex items-center gap-1 text-gray-500 text-xs">
                <Clock size={12} /> Cached result
              </span>
            )}
          </div>
          <div
            className="ai-content text-gray-300 text-sm leading-relaxed"
            dangerouslySetInnerHTML={{
              __html: insight
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\n/g, '<br />')
            }}
          />
        </div>
      )}

      {!insight && !loading && (
        <div className="bg-dark-800 border border-dark-600 rounded-2xl p-12 text-center">
          <Sparkles size={32} className="text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 mb-2">No analysis yet</p>
          <p className="text-gray-600 text-sm mb-6">
            You need at least 3 posts scraped before running AI analysis.
            Results are cached for 24 hours.
          </p>
          <button
            onClick={() => handleAnalyze(false)}
            className="bg-accent hover:bg-accent-hover text-white px-6 py-2.5 rounded-xl text-sm transition-colors"
          >
            Run Analysis
          </button>
        </div>
      )}

      {history.length > 0 && (
        <div>
          <h2 className="text-white font-semibold mb-3">Analysis History</h2>
          <div className="space-y-3">
            {history.slice(0, 5).map(h => (
              <div
                key={h.id}
                className="bg-dark-800 border border-dark-600 rounded-2xl p-4 cursor-pointer hover:border-dark-500 transition-colors"
                onClick={() => setInsight(h.content)}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-300 capitalize">{h.insight_type} analysis</span>
                  <span className="text-xs text-gray-600">{new Date(h.generated_at).toLocaleString()}</span>
                </div>
                <p className="text-gray-500 text-xs line-clamp-2">{h.content?.slice(0, 120)}...</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
