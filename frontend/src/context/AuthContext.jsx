import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [hasToken, setHasToken] = useState(() => !!localStorage.getItem('token'));
  const [user, setUser] = useState(null);

  const loadUser = useCallback(() => {
    if (!localStorage.getItem('token')) return;
    api.get('/auth/me/')
      .then((res) => setUser(res.data))
      .catch(() => { setUser(null); setHasToken(false); });
  }, []);

  useEffect(() => {
    if (hasToken && !user) loadUser();
  }, [hasToken, user, loadUser]);

  useEffect(() => {
    const sync = () => setHasToken(!!localStorage.getItem('token'));
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  const setLoggedIn = () => {
    setHasToken(true);
    setUser(null);
    loadUser();
  };
  const setLoggedOut = () => {
    setHasToken(false);
    setUser(null);
    localStorage.removeItem('token');
  };

  const isAdmin = user?.role === 'admin';

  return (
    <AuthContext.Provider value={{ hasToken, isAdmin, user, setLoggedIn, setLoggedOut, refreshUser: loadUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
