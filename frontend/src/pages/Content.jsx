import { useEffect, useState } from 'react';
import { useAccounts } from '../contexts/AccountContext';
import { api } from '../lib/api';
import PostCard from '../components/PostCard';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const SORT_OPTIONS = [
  { value: 'engagement_rate', label: 'Engagement' },
  { value: 'likes_count', label: 'Likes' },
  { value: 'views_count', label: 'Views' },
  { value: 'comments_count', label: 'Comments' },
];

const COLORS = ['#6366f1', '#818cf8', '#a5b4fc', '#c7d2fe', '#e0e7ff'];

export default function Content() {
  const { activeAccount } = useAccounts();
  const [posts, setPosts] = useState([]);
  const [contentTypes, setContentTypes] = useState([]);
  const [sort, setSort] = useState('engagement_rate');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!activeAccount?.id) return;
    setLoading(true);
    Promise.all([
      api.getTopPosts(activeAccount.id, sort),
      api.getContentTypes(activeAccount.id),
    ]).then(([p, ct]) => {
      setPosts(p);
      setContentTypes(ct);
    }).catch(console.error).finally(() => setLoading(false));
  }, [activeAccount?.id, sort]);

  const pieData = contentTypes.map(ct => ({
    name: ct.content_type || 'unknown',
    value: parseInt(ct.post_count),
    engagement: parseFloat(ct.avg_engagement || 0).toFixed(2),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-white text-2xl font-bold">Content Performance</h1>
        <div className="flex gap-1">
          {SORT_OPTIONS.map(o => (
            <button
              key={o.value}
              onClick={() => setSort(o.value)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${sort === o.value ? 'bg-accent text-white' : 'bg-dark-700 text-gray-400 hover:text-white'}`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {contentTypes.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-dark-800 border border-dark-600 rounded-2xl p-6">
            <h2 className="text-white font-semibold mb-4">Content Type Breakdown</h2>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#111118', border: '1px solid #2e2e3d', borderRadius: 12 }}
                  formatter={(v, n, p) => [`${v} posts (${p.payload.engagement}% avg eng)`, n]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-dark-800 border border-dark-600 rounded-2xl p-6">
            <h2 className="text-white font-semibold mb-4">Avg Engagement by Type</h2>
            <div className="space-y-3">
              {contentTypes.map((ct, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <span className="text-gray-300 text-sm capitalize flex-1">{ct.content_type || 'unknown'}</span>
                  <span className="text-accent font-semibold text-sm">{parseFloat(ct.avg_engagement || 0).toFixed(2)}%</span>
                  <span className="text-gray-500 text-xs">{ct.post_count} posts</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div>
        <h2 className="text-white font-semibold mb-3">Posts ranked by {SORT_OPTIONS.find(o => o.value === sort)?.label}</h2>
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => <div key={i} className="bg-dark-800 border border-dark-600 rounded-2xl h-20 animate-pulse" />)}
          </div>
        ) : posts.length > 0 ? (
          <div className="space-y-3">
            {posts.map((post, i) => <PostCard key={post.id} post={post} rank={i + 1} />)}
          </div>
        ) : (
          <div className="bg-dark-800 border border-dark-600 rounded-2xl p-8 text-center text-gray-500">
            No posts yet. Trigger a scrape from the sidebar.
          </div>
        )}
      </div>
    </div>
  );
}
