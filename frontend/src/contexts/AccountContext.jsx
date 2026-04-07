import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { useProfiles } from './ProfileContext';

const AccountContext = createContext(null);

export function AccountProvider({ children }) {
  const { activeProfileId } = useProfiles();
  const [allAccounts, setAllAccounts] = useState([]);
  const [activeAccountId, setActiveAccountId] = useState(() => localStorage.getItem('active_account_id'));
  const [loading, setLoading] = useState(true);

  const fetchAccounts = useCallback(async () => {
    try {
      const data = await api.getAccounts();
      setAllAccounts(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  // When profile changes, reset active account to first account of new profile
  useEffect(() => {
    if (!activeProfileId || allAccounts.length === 0) return;
    const profileAccounts = allAccounts.filter(a => a.profile_id === activeProfileId);
    const current = profileAccounts.find(a => a.id === activeAccountId);
    if (!current && profileAccounts.length > 0) {
      switchAccount(profileAccounts[0].id);
    }
  }, [activeProfileId, allAccounts]);

  // Only show accounts belonging to the active profile
  const accounts = allAccounts.filter(a => a.profile_id === activeProfileId);
  const activeAccount = accounts.find(a => a.id === activeAccountId) || accounts[0] || null;

  function switchAccount(id) {
    setActiveAccountId(id);
    localStorage.setItem('active_account_id', id);
  }

  async function addAccount(platform, handle) {
    const acc = await api.addAccount(platform, handle, activeProfileId);
    await fetchAccounts();
    switchAccount(acc.id);
    return acc;
  }

  async function removeAccount(id) {
    await api.deleteAccount(id);
    setAllAccounts(prev => prev.filter(a => a.id !== id));
    if (activeAccountId === id) {
      const remaining = accounts.filter(a => a.id !== id);
      switchAccount(remaining[0]?.id || null);
    }
  }

  return (
    <AccountContext.Provider value={{
      accounts, activeAccount, activeAccountId,
      switchAccount, addAccount, removeAccount,
      refreshAccounts: fetchAccounts, loading,
    }}>
      {children}
    </AccountContext.Provider>
  );
}

export const useAccounts = () => useContext(AccountContext);
