import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';

const ProfileContext = createContext(null);

export function ProfileProvider({ children }) {
  const [profiles, setProfiles] = useState([]);
  const [activeProfileId, setActiveProfileId] = useState(
    () => localStorage.getItem('active_profile_id')
  );
  const [loading, setLoading] = useState(true);

  const fetchProfiles = useCallback(async () => {
    try {
      const data = await api.getProfiles();
      setProfiles(data);
      if (data.length > 0) {
        const stored = localStorage.getItem('active_profile_id');
        const valid = data.find(p => p.id === stored);
        if (!valid) {
          setActiveProfileId(data[0].id);
          localStorage.setItem('active_profile_id', data[0].id);
        }
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchProfiles(); }, [fetchProfiles]);

  function switchProfile(id) {
    setActiveProfileId(id);
    localStorage.setItem('active_profile_id', id);
    localStorage.removeItem('active_account_id');
  }

  async function addProfile(name) {
    const p = await api.addProfile(name);
    await fetchProfiles();
    switchProfile(p.id);
    return p;
  }

  async function removeProfile(id) {
    await api.deleteProfile(id);
    const remaining = profiles.filter(p => p.id !== id);
    setProfiles(remaining);
    if (activeProfileId === id && remaining.length > 0) {
      switchProfile(remaining[0].id);
    }
  }

  const activeProfile = profiles.find(p => p.id === activeProfileId) || profiles[0] || null;

  return (
    <ProfileContext.Provider value={{
      profiles, activeProfile, activeProfileId,
      switchProfile, addProfile, removeProfile,
      refreshProfiles: fetchProfiles, loading,
    }}>
      {children}
    </ProfileContext.Provider>
  );
}

export const useProfiles = () => useContext(ProfileContext);
