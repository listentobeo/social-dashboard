import { useEffect, useState } from 'react';
import { useAccounts } from '../contexts/AccountContext';
import { api } from '../lib/api';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend
} from 'recharts';

const DAYS_OPTIONS = [7, 14, 30, 60, 90];

export default function Growth() {
  const { activeAccount } = useAccounts();
  const [snapshots, setSnapshots] = useState([]);
  const [patterns, setPatterns] = useState(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!activeAccount?.id) return;
    setLoading(true);
    Promise.all([
      api.getGrowth(activeAccount.id, days),
      api.getPostingPatterns(activeAccount.id),
    ]).then(([snap, pat]) => {
      setSnapshots(snap);
      setPatterns(pat);
    }).catch(console.error).finally(() => setLoading(false));
  }, [activeAccount?.id, days]);

  const chartData = snapshots.map(s => ({
    date: new Date(s.snapshot_date).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
    followers: s.followers_count,
    engagement: parseFloat(s.avg_engagement_rate || 0),
  }));

  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-white text-2xl font-bold">Growth</h1>
        <div className="flex gap-1">
          {DAYS_OPTIONS.map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${days === d ? 'bg-accent text-white' : 'bg-dark-700 text-gray-400 hover:text-white'}`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="bg-dark-800 border border-dark-600 rounded-2xl p-6 animate-pulse h-72" />
      ) : (
        <>
          {/* Follower Growth */}
          <div className="bg-dark-800 border border-dark-600 rounded-2xl p-6">
            <h2 className="text-white font-semibold mb-4">Follower Growth</h2>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="followersGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a1a24" />
                  <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#111118', border: '1px solid #2e2e3d', borderRadius: 12 }}
                    labelStyle={{ color: '#e5e7eb' }}
                    itemStyle={{ color: '#818cf8' }}
                  />
                  <Area type="monotone" dataKey="followers" stroke="#6366f1" strokeWidth={2} fill="url(#followersGrad)" name="Followers" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-gray-500 text-center py-16">No snapshot data yet. Scrape your account to start tracking.</p>
            )}
          </div>

          {/* Best days to post */}
          {patterns?.by_day?.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-dark-800 border border-dark-600 rounded-2xl p-6">
                <h2 className="text-white font-semibold mb-4">Engagement by Day of Week</h2>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={patterns.by_day}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a1a24" />
                    <XAxis dataKey="day_name" tick={{ fill: '#6b7280', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#111118', border: '1px solid #2e2e3d', borderRadius: 12 }}
                      labelStyle={{ color: '#e5e7eb' }}
                    />
                    <Bar dataKey="avg_engagement" fill="#6366f1" radius={[4, 4, 0, 0]} name="Avg Engagement %" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-dark-800 border border-dark-600 rounded-2xl p-6">
                <h2 className="text-white font-semibold mb-4">Engagement by Hour</h2>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={patterns.by_hour}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a1a24" />
                    <XAxis dataKey="hour_of_day" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#111118', border: '1px solid #2e2e3d', borderRadius: 12 }}
                      labelStyle={{ color: '#e5e7eb' }}
                    />
                    <Bar dataKey="avg_engagement" fill="#818cf8" radius={[4, 4, 0, 0]} name="Avg Engagement %" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
