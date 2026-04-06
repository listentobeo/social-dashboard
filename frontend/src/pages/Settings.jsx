import { useAccounts } from '../contexts/AccountContext';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import { useState } from 'react';
import { RefreshCw, Trash2 } from 'lucide-react';
import { PlatformBadge } from '../components/AccountSwitcher';

export default function Settings() {
  const { accounts, removeAccount, refreshAccounts } = useAccounts();
  const { logout } = useAuth();
  const [scraping, setScraping] = useState({});

  async function handleScrape(id) {
    setScraping(s => ({ ...s, [id]: true }));
    await api.scrapeAccount(id).catch(console.error);
    setTimeout(() => {
      refreshAccounts();
      setScraping(s => ({ ...s, [id]: false }));
    }, 3000);
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-white text-2xl font-bold">Settings</h1>

      {/* Accounts */}
      <div className="bg-dark-800 border border-dark-600 rounded-2xl p-6">
        <h2 className="text-white font-semibold mb-4">Connected Accounts</h2>
        <div className="space-y-3">
          {accounts.map(acc => (
            <div key={acc.id} className="flex items-center gap-3 p-3 bg-dark-700 rounded-xl">
              <PlatformBadge platform={acc.platform} size="lg" />
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium">@{acc.handle}</p>
                <p className="text-gray-500 text-xs capitalize">
                  {acc.platform} • {acc.followers_count?.toLocaleString() || 0} followers
                  {acc.last_scraped_at && ` • Last scraped ${new Date(acc.last_scraped_at).toLocaleDateString()}`}
                </p>
              </div>
              <button
                onClick={() => handleScrape(acc.id)}
                disabled={scraping[acc.id]}
                className="p-2 text-gray-500 hover:text-white hover:bg-dark-600 rounded-xl transition-colors disabled:opacity-50"
                title="Scrape now"
              >
                <RefreshCw size={14} className={scraping[acc.id] ? 'animate-spin' : ''} />
              </button>
              <button
                onClick={() => removeAccount(acc.id)}
                className="p-2 text-gray-500 hover:text-red-400 hover:bg-dark-600 rounded-xl transition-colors"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {accounts.length === 0 && (
            <p className="text-gray-500 text-sm">No accounts. Add one from the sidebar.</p>
          )}
        </div>
      </div>

      {/* Scrape schedule info */}
      <div className="bg-dark-800 border border-dark-600 rounded-2xl p-6">
        <h2 className="text-white font-semibold mb-2">Auto-Refresh Schedule</h2>
        <p className="text-gray-400 text-sm">All accounts and competitors are scraped every 6 hours automatically.</p>
        <p className="text-gray-500 text-xs mt-1">Change by setting <code className="bg-dark-600 px-1 rounded">SCRAPE_CRON</code> env var on Railway.</p>
      </div>

      {/* Danger */}
      <div className="bg-dark-800 border border-red-900/30 rounded-2xl p-6">
        <h2 className="text-white font-semibold mb-4">Session</h2>
        <button
          onClick={logout}
          className="bg-red-500/20 hover:bg-red-500/30 text-red-300 px-4 py-2 rounded-xl text-sm transition-colors"
        >
          Logout
        </button>
      </div>
    </div>
  );
}
