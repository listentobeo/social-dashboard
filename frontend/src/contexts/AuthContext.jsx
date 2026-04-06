import { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [authed, setAuthed] = useState(() => !!localStorage.getItem('dashboard_password'));

  async function login(password) {
    const res = await api.verify(password);
    if (res.success) {
      localStorage.setItem('dashboard_password', password);
      setAuthed(true);
      return true;
    }
    return false;
  }

  function logout() {
    localStorage.removeItem('dashboard_password');
    setAuthed(false);
  }

  return (
    <AuthContext.Provider value={{ authed, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
