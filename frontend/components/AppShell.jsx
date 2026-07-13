'use client';

import { useAuth } from '@/lib/AuthContext';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';
import TopBar from './TopBar';
import SetPasswordPrompt from './SetPasswordPrompt';

export default function AppShell({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-paper text-inkMuted text-sm">Loading…</div>;
  }

  if (!user) {
    // Login / register render full-screen with no app chrome.
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar />
        <main className="px-4 sm:px-6 md:px-10 py-7 pb-24 md:pb-10 max-w-5xl w-full mx-auto">{children}</main>
      </div>
      <MobileNav />
      <SetPasswordPrompt />
    </div>
  );
}
