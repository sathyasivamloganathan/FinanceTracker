'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { api } from './api';
import { useAuth } from './AuthContext';

const FinanceContext = createContext(null);

// Keys of the server response that belong in client state.
const STATE_KEYS = [
  'otherAssets', 'holdings', 'transactions', 'expenses', 'bankAccounts', 'fds', 'insurance',
  'liabilities', 'goals', 'netWorthSnapshots', 'recurring', 'targets', 'financialProfile',
  'privacyModeDefault', 'darkModeDefault',
];

export function FinanceProvider({ children }) {
  const { user } = useAuth();
  const [state, setState] = useState(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const [toasts, setToasts] = useState([]);
  const queue = useRef(Promise.resolve());

  const dismissToast = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const notify = useCallback((message, kind = 'error') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t.slice(-3), { id, message, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 8000 : 4000);
  }, []);

  const load = useCallback(async () => {
    setReady(false);
    setError(null);
    try {
      setState(await api.get('/api/data'));
    } catch (e) {
      setState(null);
      setError(e.message || 'Failed to load data');
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    if (user) load();
    else { setState(null); setReady(true); setError(null); }
  }, [user, load]);

  const apply = useCallback((r) => {
    if (!r || typeof r !== 'object') return;
    setState((s) => {
      if (!s) return s;
      const next = { ...s };
      for (const k of STATE_KEYS) if (r[k] !== undefined) next[k] = r[k];
      if (r.name !== undefined) next.profile = { ...(s.profile || {}), name: r.name };
      return next;
    });
  }, []);

  // Every mutation goes through here:
  //  • requests run one at a time, in order, so a slow response can never
  //    overwrite a newer one;
  //  • failures are shown to the user (toast) instead of vanishing;
  //  • resolves to the server's response (truthy) on success, or `false` on
  //    failure, so forms can stay open when saving failed.
  const mutate = useCallback((method, path, body) => {
    const job = queue.current.then(async () => {
      try {
        const r = await (method === 'delete' ? api.delete(path) : api[method](path, body));
        apply(r);
        return r || true;
      } catch (e) {
        if (e && e.status === 401) return false; // handled globally (session ended)
        notify(e?.message || 'Something went wrong');
        return false;
      }
    });
    queue.current = job.catch(() => {});
    return job;
  }, [apply, notify]);

  const A = '/api/assets', BA = '/api/bank-accounts', FD = '/api/fds', H = '/api/holdings', T = '/api/transactions',
    E = '/api/expenses', R = '/api/recurring', I = '/api/insurance', L = '/api/liabilities', G = '/api/goals', S = '/api/snapshots';

  const value = {
    state, ready, error, reload: load, notify, toasts, dismissToast,
    // Other assets
    addOtherAsset: (a) => mutate('post', A, a),
    updateOtherAsset: (id, amount) => mutate('patch', `${A}/${id}`, { amount }),
    deleteOtherAsset: (id) => mutate('delete', `${A}/${id}`),
    addAssetSnapshot: (aId, date, amount) => mutate('post', `${A}/${aId}/snapshots`, { date, amount }),
    updateAssetSnapshot: (aId, sId, date, amount) => mutate('patch', `${A}/${aId}/snapshots/${sId}`, { date, amount }),
    deleteAssetSnapshot: (aId, sId) => mutate('delete', `${A}/${aId}/snapshots/${sId}`),
    // Bank accounts
    addBankAccount: (a) => mutate('post', BA, a),
    updateBankAccount: (id, f) => mutate('patch', `${BA}/${id}`, f),
    deleteBankAccount: (id) => mutate('delete', `${BA}/${id}`),
    transferBetweenAccounts: (p) => mutate('post', `${BA}/transfer`, p),
    // FDs
    addFD: (f) => mutate('post', FD, f),
    updateFD: (id, f) => mutate('patch', `${FD}/${id}`, f),
    deleteFD: (id) => mutate('delete', `${FD}/${id}`),
    matureFD: (id, early = false) => mutate('post', `${FD}/${id}/mature`, early ? { early: true } : {}),
    // Holdings
    addHolding: (h) => mutate('post', H, h),
    updateHoldingRate: (id, rate) => mutate('patch', `${H}/${id}/rate`, { currentRate: rate }),
    updateHolding: (id, f) => mutate('patch', `${H}/${id}`, f),
    deleteHolding: (id) => mutate('delete', `${H}/${id}`),
    syncHoldingNow: (id) => mutate('post', `${H}/${id}/sync-now`, {}),
    // Transactions
    addTransaction: (t) => mutate('post', T, t),
    updateTransaction: (id, f) => mutate('patch', `${T}/${id}`, f),
    deleteTransaction: (id) => mutate('delete', `${T}/${id}`),
    // Expenses
    addExpense: (e) => mutate('post', E, e),
    updateExpense: (id, f) => mutate('patch', `${E}/${id}`, f),
    deleteExpense: (id) => mutate('delete', `${E}/${id}`),
    // Recurring
    addRecurring: (r) => mutate('post', R, r),
    updateRecurring: (id, f) => mutate('patch', `${R}/${id}`, f),
    deleteRecurring: (id) => mutate('delete', `${R}/${id}`),
    generateRecurring: () => mutate('post', `${R}/generate`, {}),
    // Budget
    saveBudget: async (monthKey, budget) => {
      const r = await mutate('put', `/api/budget/${monthKey}`, { budget });
      if (r && r.budget) setState((s) => ({ ...s, budgets: { ...(s.budgets || {}), [monthKey]: r.budget } }));
      return r;
    },
    // Insurance
    addInsurance: (p) => mutate('post', I, p),
    updateInsurance: (id, f) => mutate('patch', `${I}/${id}`, f),
    deleteInsurance: (id) => mutate('delete', `${I}/${id}`),
    // Targets
    updateTarget: (cat, val) => mutate('put', `/api/targets/${encodeURIComponent(cat)}`, { value: val }),
    addTargetCategory: (name, val) => mutate('put', `/api/targets/${encodeURIComponent(name)}`, { value: val }),
    // Liabilities
    addLiability: (l) => mutate('post', L, l),
    updateLiability: (id, f) => mutate('patch', `${L}/${id}`, f),
    deleteLiability: (id) => mutate('delete', `${L}/${id}`),
    // Goals
    addGoal: (g) => mutate('post', G, g),
    updateGoal: (id, f) => mutate('patch', `${G}/${id}`, f),
    deleteGoal: (id) => mutate('delete', `${G}/${id}`),
    achieveGoal: (id) => mutate('post', `${G}/${id}/achieve`, {}),
    reopenGoal: (id) => mutate('post', `${G}/${id}/reopen`, {}),
    // Snapshots
    takeSnapshot: () => mutate('post', S, {}),
    addPastSnapshot: (date, netWorth, notes) => mutate('post', `${S}/manual`, { date, netWorth, notes }),
    deleteSnapshot: (id) => mutate('delete', `${S}/${id}`),
    // Profile & settings
    updateFinancialProfile: (f) => mutate('patch', '/api/profile', f),
    updateSettings: (f) => mutate('patch', '/api/data/settings', f),
  };

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

export function useFinance() {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error('useFinance must be used inside FinanceProvider');
  return ctx;
}
