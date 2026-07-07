'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { api } from './api';

const AuthContext = createContext(null);
const PUBLIC_PATHS = ['/login', '/register'];

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
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
      setLoading(false);
    })();
  }, [refresh]);

  useEffect(() => {
    if (loading) return;
    const isPublic = PUBLIC_PATHS.includes(pathname);
    // The real weekly-logout enforcement happens server-side (the JWT cookie
    // itself expires after 7 days — see backend JWT_EXPIRES_IN). This redirect
    // just makes the frontend react immediately once /api/auth/me says the
    // session is gone, instead of showing a broken page.
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

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
