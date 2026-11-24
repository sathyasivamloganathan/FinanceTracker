'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { api, API_BASE, UNAUTHORIZED_EVENT } from './api';

const AuthContext = createContext(null);
const PUBLIC_PATHS = ['/login', '/register', '/forgot-password', '/reset-password', '/verify-email'];

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [showSetPassword, setShowSetPassword] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const refresh = useCallback(async () => {
    try {
      const { user: u } = await api.get('/api/auth/me');
      setUser(u);
      return u;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [, configResult] = await Promise.allSettled([refresh(), api.get('/api/auth/config')]);
      if (configResult.status === 'fulfilled') setGoogleEnabled(configResult.value?.googleEnabled ?? false);
      setLoading(false);
    })();
  }, [refresh]);

  // The API tells us (once, globally) when the session has ended.
  useEffect(() => {
    const onExpired = () => setUser(null);
    window.addEventListener(UNAUTHORIZED_EVENT, onExpired);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onExpired);
  }, []);

  // Back from Google: offer to set a password on Google-only accounts.
  useEffect(() => {
    if (loading || typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('googleAuth') === '1') {
      if (params.get('needsPassword') === '1') setShowSetPassword(true);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [loading]);

  useEffect(() => {
    if (loading) return;
    const isPublic = PUBLIC_PATHS.includes(pathname);
    if (!user && !isPublic) router.replace('/login');
    // verify-email must stay reachable while signed in (the link is opened from an e-mail)
    if (user && isPublic && pathname !== '/verify-email') router.replace('/');
  }, [user, loading, pathname, router]);

  async function login(email, password) {
    const { user: u } = await api.post('/api/auth/login', { email, password });
    setUser(u);
    return u;
  }
  async function register(name, email, password) {
    const { user: u } = await api.post('/api/auth/register', { name, email, password });
    setUser(u);
    return u;
  }
  async function logout() {
    try { await api.post('/api/auth/logout', {}); } catch { /* cookie may already be gone */ }
    finally { setUser(null); router.replace('/login'); }
  }
  async function logoutEverywhere() {
    await api.post('/api/auth/logout-all', {});
    setUser(null);
    router.replace('/login');
  }
  async function changePassword(currentPassword, newPassword) {
    const body = currentPassword ? { currentPassword, newPassword } : { newPassword };
    const { user: u } = await api.post('/api/auth/change-password', body);
    setUser(u);
    return u;
  }
  const updateUser = useCallback((patch) => setUser((u) => (u ? { ...u, ...patch } : u)), []);
  const googleLoginUrl = () => `${API_BASE}/api/auth/google`;

  return (
    <AuthContext.Provider
      value={{ user, loading, googleEnabled, login, register, logout, logoutEverywhere, refresh, changePassword, updateUser, googleLoginUrl, showSetPassword, setShowSetPassword }}
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
