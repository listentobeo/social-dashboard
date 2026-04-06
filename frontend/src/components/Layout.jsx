import { NavLink } from 'react-router-dom';
import { BarChart3, TrendingUp, FileText, Users, Sparkles, Settings, LogOut, RefreshCw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useAccounts } from '../contexts/AccountContext';
import AccountSwitcher from './AccountSwitcher';
import { api } from '../lib/api';
import { useState } from 'react';

const NAV = [
  { to: '/overview', icon: BarChart3, label: 'Overview' },
  { to: '/growth', icon: TrendingUp, label: 'Growth' },
  { to: '/content', icon: FileText, label: 'Content' },
  { to: '/competitors', icon: Users, label: 'Competitors' },
  { to: '/ai', icon: Sparkles, label: 'AI Insights' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Layout({ children }) {
  const { logout } = useAuth();
  const { refreshAccounts } = useAccounts();
  const [scraping, setScraping] = useState(false);

  async function handleScrapeAll() {
    setScraping(true);
    try {
      await api.scrapeAll();
      setTimeout(() => { refreshAccounts(); setScraping(false); }, 3000);
    } catch (e) {
      setScraping(false);
    }
  }

  return (
    <div className="flex h-screen bg-dark-900 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 bg-dark-800 border-r border-dark-600 flex flex-col flex-shrink-0">
        {/* Logo */}
        <div className="p-5 border-b border-dark-600">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
              <BarChart3 size={16} className="text-white" />
            </div>
            <span className="text-white font-semibold text-sm">Social Dashboard</span>
          </div>
        </div>

        {/* Account Switcher */}
        <div className="p-3 border-b border-dark-600">
          <AccountSwitcher />
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                  isActive
                    ? 'bg-accent text-white font-medium'
                    : 'text-gray-400 hover:text-white hover:bg-dark-700'
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Bottom actions */}
        <div className="p-3 border-t border-dark-600 space-y-1">
          <button
            onClick={handleScrapeAll}
            disabled={scraping}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-400 hover:text-white hover:bg-dark-700 transition-colors w-full disabled:opacity-50"
          >
            <RefreshCw size={16} className={scraping ? 'animate-spin' : ''} />
            {scraping ? 'Refreshing...' : 'Refresh All'}
          </button>
          <button
            onClick={logout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-400 hover:text-red-400 hover:bg-dark-700 transition-colors w-full"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
