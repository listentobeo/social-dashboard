import { useEffect, useState } from 'react';
import { Users, TrendingUp, FileText, Zap } from 'lucide-react';
import { useAccounts } from '../contexts/AccountContext';
import { api } from '../lib/api';
import MetricCard from '../components/MetricCard';
import PostCard from '../components/PostCard';
import { PlatformBadge } from '../components/AccountSwitcher';

export default function Overview() {
  const { activeAccount } = useAccounts();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!activeAccount?.id) return;
    setLoading(true);
    api.getAccountSummary(activeAccount.id)
      .then(setSummary)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [activeAccount?.id]);

  if (!activeAccount) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
        <p>No accounts connected. Add one from the sidebar.</p>
      </div>
    );
  }

  const topPosts = summary?.posts
    ? [...summary.posts].sort((a, b) => (b.engagement_rate || 0) - (a.engagement_rate || 0)).slice(0, 5)
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <PlatformBadge platform={activeAccount.platform} size="lg" />
        <div>
          <h1 className="text-white text-2xl font-bold">@{activeAccount.handle}</h1>
          <p className="text-gray-500 text-sm capitalize">{activeAccount.platform} • {activeAccount.last_scraped_at ? `Updated ${new Date(activeAccount.last_scraped_at).toLocaleDateString()}` : 'Not scraped yet'}</p>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-dark-800 border border-dark-600 rounded-2xl p-5 animate-pulse h-28" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              label="Followers"
              value={activeAccount.followers_count?.toLocaleString() || '0'}
              icon={Users}
              trend={summary?.stats?.follower_growth_7d}
              sub="7-day change"
              accent="bg-indigo-500/20"
            />
            <MetricCard
              label="Avg Engagement"
              value={`${summary?.stats?.avg_engagement || 0}%`}
              icon={Zap}
              sub="across all posts"
              accent="bg-yellow-500/20"
            />
            <MetricCard
              label="Posts Tracked"
              value={summary?.stats?.total_posts || 0}
              icon={FileText}
              accent="bg-blue-500/20"
            />
            <MetricCard
              label="Following"
              value={activeAccount.following_count?.toLocaleString() || '0'}
              icon={TrendingUp}
              accent="bg-green-500/20"
            />
          </div>

          {topPosts.length > 0 && (
            <div>
              <h2 className="text-white font-semibold mb-3">Top Performing Posts</h2>
              <div className="space-y-3">
                {topPosts.map((post, i) => (
                  <PostCard key={post.id} post={post} rank={i + 1} />
                ))}
              </div>
            </div>
          )}

          {topPosts.length === 0 && (
            <div className="bg-dark-800 border border-dark-600 rounded-2xl p-8 text-center">
              <p className="text-gray-500 mb-3">No posts scraped yet.</p>
              <button
                onClick={() => api.scrapeAccount(activeAccount.id)}
                className="bg-accent hover:bg-accent-hover text-white px-4 py-2 rounded-xl text-sm transition-colors"
              >
                Scrape Now
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
