'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { api, API_BASE } from './api';

const AuthContext = createContext(null);
const PUBLIC_PATHS = ['/login', '/register'];

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [showSetPassword, setShowSetPassword] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const refresh = useCallback(async () => {
    try {
      const { user } = await api.get('/api/auth/me');
      setUser(user);
      return user;
    } catch (e) {
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await refresh();
      try {
        const { googleEnabled } = await api.get('/api/auth/config');
        setGoogleEnabled(googleEnabled);
      } catch (e) {
        setGoogleEnabled(false);
      }
      setLoading(false);
    })();
  }, [refresh]);

  // After a Google OAuth redirect back from the backend, prompt to set a
  // password if the account doesn't have one yet (Google-only accounts).
  useEffect(() => {
    if (loading || typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('googleAuth') === '1') {
      if (params.get('needsPassword') === '1') setShowSetPassword(true);
      window.history.replaceState({}, '', window.location.pathname); // strip query params from the URL
    }
  }, [loading]);

  useEffect(() => {
    if (loading) return;
    const isPublic = PUBLIC_PATHS.includes(pathname);
    if (!user && !isPublic) router.replace('/login');
    if (user && isPublic) router.replace('/');
  }, [user, loading, pathname, router]);

  async function login(email, password) {
    const { user } = await api.post('/api/auth/login', { email, password });
    setUser(user);
    return user;
  }
  async function register(name, email, password) {
    const { user } = await api.post('/api/auth/register', { name, email, password });
    setUser(user);
    return user;
  }
  async function logout() {
    await api.post('/api/auth/logout', {});
    setUser(null);
    router.replace('/login');
  }
  async function changePassword(currentPassword, newPassword) {
    const { user } = await api.post('/api/auth/change-password', { currentPassword, newPassword });
    setUser(user);
    return user;
  }
  function googleLoginUrl() {
    return `${API_BASE}/api/auth/google`;
  }

  return (
    <AuthContext.Provider
      value={{ user, loading, googleEnabled, login, register, logout, refresh, changePassword, googleLoginUrl, showSetPassword, setShowSetPassword }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
