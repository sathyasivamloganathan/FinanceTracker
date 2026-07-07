'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { api } from './api';
import { useFinance } from './FinanceContext';

const PrivacyContext = createContext(null);

export function PrivacyProvider({ children }) {
  const { state, ready } = useFinance();
  const [hidden, setHidden] = useState(true); // default to hidden until we know the user's saved preference
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (ready && state && !initialized) {
      setHidden(state.privacyModeDefault !== false);
      setInitialized(true);
    }
  }, [ready, state, initialized]);

  function toggle() {
    setHidden((h) => {
      const next = !h;
      api.patch('/api/data/settings', { privacyModeDefault: next }).catch(() => {});
      return next;
    });
  }

  return <PrivacyContext.Provider value={{ hidden, toggle }}>{children}</PrivacyContext.Provider>;
}

export function usePrivacy() {
  const ctx = useContext(PrivacyContext);
  if (!ctx) throw new Error('usePrivacy must be used inside PrivacyProvider');
  return ctx;
}

// Wrap any monetary/sensitive value with this. Renders a dot-mask of similar
// width instead of the real value while privacy mode is on.
export function Amount({ children, className = '' }) {
  const { hidden } = usePrivacy();
  if (!hidden) return <span className={className}>{children}</span>;
  const text = String(children ?? '');
  const maskLength = Math.min(10, Math.max(4, text.length));
  return (
    <span className={className} aria-label="hidden" title="Hidden — tap the eye icon to reveal">
      {'•'.repeat(maskLength)}
    </span>
  );
}
