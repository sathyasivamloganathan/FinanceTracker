'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { api } from '@/lib/api';
import { applyTheme } from '@/lib/theme';
import { useFinance } from '@/lib/FinanceContext';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';
import TopBar from './TopBar';
import SetPasswordPrompt from './SetPasswordPrompt';

function DarkModeSync() {
  const { state } = useFinance();
  useEffect(() => {
    if (state) applyTheme(!!state.darkModeDefault);
  }, [state?.darkModeDefault, state]);
  return null;
}

// Shown until the e-mail address is confirmed.
function VerifyBanner() {
  const { user } = useAuth();
  const { notify } = useFinance();
  const [sent, setSent] = useState(false);
  if (!user || user.emailVerified) return null;
  async function resend() {
    try { await api.post('/api/auth/resend-verification', {}); setSent(true); notify('Verification e-mail sent - check your inbox.', 'info'); }
    catch (e) { notify(e.message); }
  }
  return (
    <div className="bg-warnBg text-warn dark:bg-amber-950 dark:text-amber-200 text-[12.5px] px-4 md:px-8 py-2 flex items-center gap-3 flex-wrap" role="status">
      <span>Please confirm your e-mail address ({user.email}) - we sent you a link.</span>
      <button type="button" onClick={resend} disabled={sent} className="underline font-semibold disabled:opacity-50">{sent ? 'Sent' : 'Resend verification'}</button>
    </div>
  );
}

export default function AppShell({ children, section }) {
  const { user, loading } = useAuth();
  // mounted ensures we never SSR the shell - avoids hydration mismatch entirely
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Auth still checking (or before mount) - show a neutral skeleton instead of a blank page
  if (!mounted || loading) {
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

  // Not logged in - just render children (login/register page)
  if (!user) return <>{children}</>;

  return (
    <div className="flex min-h-screen bg-paper dark:bg-gray-900">
      <DarkModeSync />
      <Sidebar section={section} />
      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar />
        <VerifyBanner />
        <main className="px-4 sm:px-6 md:px-10 py-7 pb-24 md:pb-10 max-w-5xl w-full mx-auto">
          {children}
        </main>
      </div>
      <MobileNav />
      <SetPasswordPrompt />
    </div>
  );
}
