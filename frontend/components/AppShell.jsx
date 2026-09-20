'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useFinance } from '@/lib/FinanceContext';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';
import TopBar from './TopBar';
import SetPasswordPrompt from './SetPasswordPrompt';

function DarkModeSync() {
  const { state } = useFinance();
  useEffect(() => {
    if (state?.darkModeDefault) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [state?.darkModeDefault]);
  return null;
}

export default function AppShell({ children, section }) {
  const { user, loading } = useAuth();
  // mounted ensures we never SSR the shell — avoids hydration mismatch entirely
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Before client mounts, render nothing (prevents SSR/client mismatch)
  if (!mounted) return null;

  // Auth still checking — show minimal skeleton (client-only, no SSR)
  if (loading) {
    return (
      <div className="flex min-h-screen bg-paper">
        <div className="w-[220px] shrink-0 bg-[#0B1220] hidden md:block" />
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="h-[46px] border-b border-gray-200 bg-white" />
          <main className="px-4 sm:px-6 md:px-10 py-7 max-w-5xl w-full mx-auto">
            <div className="animate-pulse space-y-4">
              <div className="h-8 w-48 bg-gray-200 rounded-md" />
              <div className="grid grid-cols-4 gap-3">
                {[1,2,3,4].map(i => <div key={i} className="h-24 bg-gray-200 rounded-xl" />)}
              </div>
              <div className="h-64 bg-gray-200 rounded-xl" />
            </div>
          </main>
        </div>
      </div>
    );
  }

  // Not logged in — just render children (login/register page)
  if (!user) return <>{children}</>;

  return (
    <div className="flex min-h-screen bg-paper dark:bg-gray-900">
      <DarkModeSync />
      <Sidebar section={section} />
      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar />
        <main className="px-4 sm:px-6 md:px-10 py-7 pb-24 md:pb-10 max-w-5xl w-full mx-auto">
          {children}
        </main>
      </div>
      <MobileNav />
      <SetPasswordPrompt />
    </div>
  );
}
