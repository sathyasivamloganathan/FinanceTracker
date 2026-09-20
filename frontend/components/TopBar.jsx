'use client';

import { usePrivacy } from '@/lib/PrivacyContext';
import { useAuth } from '@/lib/AuthContext';
import { useFinance } from '@/lib/FinanceContext';

export default function TopBar() {
  const { hidden, toggle } = usePrivacy();
  const { user, logout }   = useAuth();
  const { state, updateSettings } = useFinance();
  const darkMode = state?.darkModeDefault || false;

  async function toggleDark() {
    const next = !darkMode;
    if (next) document.documentElement.classList.add('dark');
    else      document.documentElement.classList.remove('dark');
    try { await updateSettings({ darkModeDefault: next }); } catch {}
  }

  return (
    <div className="h-[46px] border-b border-line dark:border-gray-700 bg-paperCard dark:bg-gray-800 flex items-center justify-between px-4 md:px-8 flex-shrink-0">
      <span className="text-[12.5px] text-inkMuted dark:text-gray-400 hidden sm:block">
        {user ? <>Signed in as <b className="text-ink dark:text-gray-200">{user.email}</b></> : ''}
      </span>
      <div className="flex items-center gap-2 ml-auto">
        {/* Privacy toggle — works on all pages */}
        <button
          onClick={toggle}
          className={`flex items-center gap-1.5 border rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors ${
            hidden
              ? 'bg-ink dark:bg-gray-700 text-white border-ink dark:border-gray-600'
              : 'bg-white dark:bg-gray-700 text-ink dark:text-gray-200 border-line dark:border-gray-600 hover:border-accent'
          }`}
          title={hidden ? 'Amounts hidden — click to show' : 'Amounts visible — click to hide'}
        >
          {hidden ? (
            <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>Hidden</>
          ) : (
            <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>Visible</>
          )}
        </button>
        {/* Dark mode toggle */}
        <button
          onClick={toggleDark}
          className="w-8 h-8 flex items-center justify-center border border-line dark:border-gray-600 rounded-full bg-white dark:bg-gray-700 hover:border-accent transition-colors text-[14px]"
          title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {darkMode ? '☀️' : '🌙'}
        </button>
        <button onClick={logout} className="text-[12px] font-medium text-inkMuted dark:text-gray-400 hover:text-clay px-2 transition-colors">
          Log out
        </button>
      </div>
    </div>
  );
}
