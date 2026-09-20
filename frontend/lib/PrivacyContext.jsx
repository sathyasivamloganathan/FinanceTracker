'use client';

import { createContext, useContext, useState, useCallback } from 'react';

const PrivacyContext = createContext(null);

export function PrivacyProvider({ children }) {
  const [hidden, setHidden] = useState(false);
  const toggle = useCallback(() => setHidden(h => !h), []);
  return (
    <PrivacyContext.Provider value={{ hidden, toggle }}>
      {children}
    </PrivacyContext.Provider>
  );
}

export function usePrivacy() {
  const ctx = useContext(PrivacyContext);
  if (!ctx) throw new Error('usePrivacy must be inside PrivacyProvider');
  return ctx;
}

// Wrap any monetary value — when hidden shows ••••
export function Amount({ children }) {
  const { hidden } = usePrivacy();
  if (hidden) return <span className="select-none tracking-widest text-inkMuted dark:text-gray-500">••••</span>;
  return <>{children}</>;
}
