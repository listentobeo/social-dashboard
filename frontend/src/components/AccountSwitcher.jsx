import { useState } from 'react';
import { useAccounts } from '../contexts/AccountContext';
import { useProfiles } from '../contexts/ProfileContext';
import { ChevronDown, Plus, Trash2, User } from 'lucide-react';

const PLATFORM_COLORS = {
  instagram: 'from-purple-500 to-pink-500',
  tiktok: 'from-gray-800 to-gray-600',
  facebook: 'from-blue-600 to-blue-500',
  youtube: 'from-red-600 to-red-500',
  x: 'from-gray-700 to-gray-600',
};

const PLATFORM_LABELS = {
  instagram: 'IG',
  tiktok: 'TT',
  facebook: 'FB',
  youtube: 'YT',
  x: 'X',
};

function PlatformBadge({ platform, size = 'sm' }) {
  const s = size === 'sm' ? 'w-6 h-6 text-xs' : 'w-8 h-8 text-sm';
  return (
    <div className={`${s} rounded-lg bg-gradient-to-br ${PLATFORM_COLORS[platform] || 'from-gray-700 to-gray-600'} flex items-center justify-center text-white font-bold flex-shrink-0`}>
      {PLATFORM_LABELS[platform] || '?'}
    </div>
  );
}

function ProfileSwitcher() {
  const { profiles, activeProfile, switchProfile, addProfile, removeProfile } = useProfiles();
  const [open, setOpen] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [adding, setAdding] = useState(false);

  async function handleAdd(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setAdding(true);
    try {
      await addProfile(name.trim());
      setName('');
      setShowAdd(false);
      setOpen(false);
    } catch (err) { alert(err.message); }
    setAdding(false);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-dark-700 transition-colors"
      >
        <div className="w-6 h-6 rounded-lg bg-accent/20 flex items-center justify-center flex-shrink-0">
          <User size={12} className="text-accent" />
        </div>
        <div className="flex-1 text-left min-w-0">
          <p className="text-gray-400 text-xs">Profile</p>
          <p className="text-white text-xs font-semibold truncate">{activeProfile?.name || 'No profile'}</p>
        </div>
        <ChevronDown size={12} className={`text-gray-500 transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-dark-700 border border-dark-500 rounded-xl shadow-xl z-50 overflow-hidden">
          {profiles.map(p => (
            <div
              key={p.id}
              className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-dark-600 transition-colors group ${p.id === activeProfile?.id ? 'bg-dark-600' : ''}`}
              onClick={() => { switchProfile(p.id); setOpen(false); }}
            >
              <div className="w-5 h-5 rounded-md bg-accent/20 flex items-center justify-center flex-shrink-0">
                <User size={10} className="text-accent" />
              </div>
              <span className="text-white text-xs flex-1 truncate">{p.name}</span>
              {profiles.length > 1 && (
                <button
                  onClick={e => { e.stopPropagation(); removeProfile(p.id); }}
                  className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-all"
                >
                  <Trash2 size={11} />
                </button>
              )}
            </div>
          ))}
          <div className="border-t border-dark-500">
            {showAdd ? (
              <form onSubmit={handleAdd} className="p-2 space-y-1.5">
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Profile name (e.g. _beoarts)"
                  className="w-full bg-dark-800 border border-dark-500 rounded-lg px-2 py-1.5 text-white text-xs placeholder-gray-600 focus:outline-none focus:border-accent"
                  autoFocus
                />
                <div className="flex gap-1.5">
                  <button type="submit" disabled={adding} className="flex-1 bg-accent text-white text-xs py-1.5 rounded-lg disabled:opacity-50">
                    {adding ? '...' : 'Create'}
                  </button>
                  <button type="button" onClick={() => setShowAdd(false)} className="flex-1 bg-dark-600 text-gray-400 text-xs py-1.5 rounded-lg">
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => setShowAdd(true)}
                className="flex items-center gap-2 w-full px-3 py-2 text-gray-400 hover:text-white hover:bg-dark-600 transition-colors text-xs"
              >
                <Plus size={12} />
                New Profile
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function AccountSwitcher() {
  const { accounts, activeAccount, switchAccount, addAccount, removeAccount } = useAccounts();
  const [open, setOpen] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [platform, setPlatform] = useState('instagram');
  const [handle, setHandle] = useState('');
  const [adding, setAdding] = useState(false);

  async function handleAdd(e) {
    e.preventDefault();
    if (!handle.trim()) return;
    setAdding(true);
    try {
      await addAccount(platform, handle.trim());
      setHandle('');
      setShowAdd(false);
      setOpen(false);
    } catch (err) { alert(err.message); }
    setAdding(false);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 p-2 rounded-xl hover:bg-dark-700 transition-colors"
      >
        {activeAccount ? (
          <>
            <PlatformBadge platform={activeAccount.platform} />
            <div className="flex-1 text-left min-w-0">
              <p className="text-white text-xs font-medium truncate">@{activeAccount.handle}</p>
              <p className="text-gray-500 text-xs capitalize">{activeAccount.platform}</p>
            </div>
          </>
        ) : (
          <span className="text-gray-500 text-xs">No accounts</span>
        )}
        <ChevronDown size={14} className={`text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-dark-700 border border-dark-500 rounded-xl shadow-xl z-50 overflow-hidden">
          {accounts.map(acc => (
            <div
              key={acc.id}
              className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-dark-600 transition-colors group ${acc.id === activeAccount?.id ? 'bg-dark-600' : ''}`}
              onClick={() => { switchAccount(acc.id); setOpen(false); }}
            >
              <PlatformBadge platform={acc.platform} />
              <div className="flex-1 min-w-0">
                <p className="text-white text-xs font-medium truncate">@{acc.handle}</p>
                <p className="text-gray-500 text-xs">{acc.followers_count?.toLocaleString()} followers</p>
              </div>
              <button
                onClick={e => { e.stopPropagation(); removeAccount(acc.id); }}
                className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-all"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
          <div className="border-t border-dark-500">
            {showAdd ? (
              <form onSubmit={handleAdd} className="p-3 space-y-2">
                <select
                  value={platform}
                  onChange={e => setPlatform(e.target.value)}
                  className="w-full bg-dark-800 border border-dark-500 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-accent"
                >
                  {['instagram','tiktok','facebook','youtube','x'].map(p => (
                    <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                  ))}
                </select>
                <input
                  value={handle}
                  onChange={e => setHandle(e.target.value)}
                  placeholder="username (no @)"
                  className="w-full bg-dark-800 border border-dark-500 rounded-lg px-2 py-1.5 text-white text-xs placeholder-gray-600 focus:outline-none focus:border-accent"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button type="submit" disabled={adding} className="flex-1 bg-accent text-white text-xs py-1.5 rounded-lg disabled:opacity-50">
                    {adding ? '...' : 'Add'}
                  </button>
                  <button type="button" onClick={() => setShowAdd(false)} className="flex-1 bg-dark-600 text-gray-400 text-xs py-1.5 rounded-lg">
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => setShowAdd(true)}
                className="flex items-center gap-2 w-full px-3 py-2.5 text-gray-400 hover:text-white hover:bg-dark-600 transition-colors text-xs"
              >
                <Plus size={14} />
                Add account
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default AccountSwitcher;
export { PlatformBadge, ProfileSwitcher };
