'use client';

import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useFinance } from './FinanceContext';

const PrivacyContext = createContext(null);

export function PrivacyProvider({ children }) {
  const { state } = useFinance();
  // Start hidden (safe default) until the user's own preference has loaded.
  const [hidden, setHidden] = useState(true);
  const initialised = useRef(false);
  const toggle = useCallback(() => setHidden((h) => !h), []);

  useEffect(() => {
    if (!state) { initialised.current = false; return; }
    if (!initialised.current) {
      initialised.current = true;
      setHidden(state.privacyModeDefault !== false);
    }
  }, [state]);

  return <PrivacyContext.Provider value={{ hidden, toggle }}>{children}</PrivacyContext.Provider>;
}

export function usePrivacy() {
  const ctx = useContext(PrivacyContext);
  if (!ctx) throw new Error('usePrivacy must be inside PrivacyProvider');
  return ctx;
}

// Wrap any monetary value — when hidden shows ••••
export function Amount({ children }) {
  const { hidden } = usePrivacy();
  if (hidden) return <span className="select-none tracking-widest text-inkMuted dark:text-gray-500" aria-label="Hidden amount">••••</span>;
  return <>{children}</>;
}
