import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';

const AccountContext = createContext(null);

export function AccountProvider({ children }) {
  const [accounts, setAccounts] = useState([]);
  const [activeAccountId, setActiveAccountId] = useState(() => localStorage.getItem('active_account_id'));
  const [loading, setLoading] = useState(true);

  const fetchAccounts = useCallback(async () => {
    try {
      const data = await api.getAccounts();
      setAccounts(data);
      if (!activeAccountId && data.length > 0) {
        setActiveAccountId(data[0].id);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  function switchAccount(id) {
    setActiveAccountId(id);
    localStorage.setItem('active_account_id', id);
  }

  const activeAccount = accounts.find(a => a.id === activeAccountId) || accounts[0] || null;

  async function addAccount(platform, handle) {
    const acc = await api.addAccount(platform, handle);
    await fetchAccounts();
    switchAccount(acc.id);
    return acc;
  }

  async function removeAccount(id) {
    await api.deleteAccount(id);
    const remaining = accounts.filter(a => a.id !== id);
    setAccounts(remaining);
    if (activeAccountId === id) {
      switchAccount(remaining[0]?.id || null);
    }
  }

  return (
    <AccountContext.Provider value={{
      accounts,
      activeAccount,
      activeAccountId,
      switchAccount,
      addAccount,
      removeAccount,
      refreshAccounts: fetchAccounts,
      loading,
    }}>
      {children}
    </AccountContext.Provider>
  );
}

export const useAccounts = () => useContext(AccountContext);
