'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from './api';
import { useAuth } from './AuthContext';

const FinanceContext = createContext(null);

export function FinanceProvider({ children }) {
  const { user } = useAuth();
  const [state, setState] = useState(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setReady(false);
    setError(null);
    try {
      const data = await api.get('/api/data');
      setState(data);
      setError(null);
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

  // Other assets
  const addOtherAsset = useCallback(async (a) => { const { otherAssets } = await api.post('/api/assets', a); setState(s => ({ ...s, otherAssets })); }, []);
  const updateOtherAsset = useCallback(async (id, amount) => { const { otherAssets } = await api.patch(`/api/assets/${id}`, { amount }); setState(s => ({ ...s, otherAssets })); }, []);
  const deleteOtherAsset = useCallback(async (id) => { const { otherAssets } = await api.delete(`/api/assets/${id}`); setState(s => ({ ...s, otherAssets })); }, []);
  const addAssetSnapshot = useCallback(async (aId, date, amount) => { const { otherAssets } = await api.post(`/api/assets/${aId}/snapshots`, { date, amount }); setState(s => ({ ...s, otherAssets })); }, []);
  const updateAssetSnapshot = useCallback(async (aId, sId, date, amount) => { const { otherAssets } = await api.patch(`/api/assets/${aId}/snapshots/${sId}`, { date, amount }); setState(s => ({ ...s, otherAssets })); }, []);
  const deleteAssetSnapshot = useCallback(async (aId, sId) => { const { otherAssets } = await api.delete(`/api/assets/${aId}/snapshots/${sId}`); setState(s => ({ ...s, otherAssets })); }, []);

  // Bank accounts
  const addBankAccount = useCallback(async (a) => { const { bankAccounts } = await api.post('/api/bank-accounts', a); setState(s => ({ ...s, bankAccounts })); }, []);
  const updateBankAccount = useCallback(async (id, f) => { const { bankAccounts } = await api.patch(`/api/bank-accounts/${id}`, f); setState(s => ({ ...s, bankAccounts })); }, []);
  const deleteBankAccount = useCallback(async (id) => { const { bankAccounts } = await api.delete(`/api/bank-accounts/${id}`); setState(s => ({ ...s, bankAccounts })); }, []);
  const transferBetweenAccounts = useCallback(async (p) => { const { bankAccounts, expenses } = await api.post('/api/bank-accounts/transfer', p); setState(s => ({ ...s, bankAccounts, expenses })); }, []);

  // FDs
  const addFD = useCallback(async (f) => { const { fds } = await api.post('/api/fds', f); setState(s => ({ ...s, fds })); }, []);
  const updateFD = useCallback(async (id, f) => { const { fds } = await api.patch(`/api/fds/${id}`, f); setState(s => ({ ...s, fds })); }, []);
  const deleteFD = useCallback(async (id) => { const { fds } = await api.delete(`/api/fds/${id}`); setState(s => ({ ...s, fds })); }, []);
  const matureFD = useCallback(async (id) => { const { fds, bankAccounts } = await api.post(`/api/fds/${id}/mature`, {}); setState(s => ({ ...s, fds, bankAccounts: bankAccounts || s.bankAccounts })); }, []);

  // Holdings
  const addHolding = useCallback(async (h) => { const { holdings } = await api.post('/api/holdings', h); setState(s => ({ ...s, holdings })); }, []);
  const updateHoldingRate = useCallback(async (id, rate) => { const { holdings } = await api.patch(`/api/holdings/${id}/rate`, { currentRate: rate }); setState(s => ({ ...s, holdings })); }, []);
  const updateHolding = useCallback(async (id, f) => { const { holdings } = await api.patch(`/api/holdings/${id}`, f); setState(s => ({ ...s, holdings })); }, []);
  const deleteHolding = useCallback(async (id) => { const { holdings } = await api.delete(`/api/holdings/${id}`); setState(s => ({ ...s, holdings })); }, []);
  const syncHoldingNow = useCallback(async (id) => { const { holdings } = await api.post(`/api/holdings/${id}/sync-now`, {}); setState(s => ({ ...s, holdings })); }, []);

  // Transactions
  const addTransaction = useCallback(async (t) => { const { transactions, holdings } = await api.post('/api/transactions', t); setState(s => ({ ...s, transactions, holdings })); }, []);
  const updateTransaction = useCallback(async (id, f) => { const { transactions } = await api.patch(`/api/transactions/${id}`, f); setState(s => ({ ...s, transactions })); }, []);
  const deleteTransaction = useCallback(async (id) => { const { transactions } = await api.delete(`/api/transactions/${id}`); setState(s => ({ ...s, transactions })); }, []);

  // Expenses
  const addExpense = useCallback(async (e) => { const r = await api.post('/api/expenses', e); setState(s => ({ ...s, expenses: r.expenses, bankAccounts: r.bankAccounts || s.bankAccounts })); }, []);
  const updateExpense = useCallback(async (id, f) => { const { expenses } = await api.patch(`/api/expenses/${id}`, f); setState(s => ({ ...s, expenses })); }, []);
  const deleteExpense = useCallback(async (id) => { const { expenses } = await api.delete(`/api/expenses/${id}`); setState(s => ({ ...s, expenses })); }, []);

  // Recurring
  const addRecurring = useCallback(async (r) => { const { recurring } = await api.post('/api/recurring', r); setState(s => ({ ...s, recurring })); }, []);
  const updateRecurring = useCallback(async (id, f) => { const { recurring } = await api.patch(`/api/recurring/${id}`, f); setState(s => ({ ...s, recurring })); }, []);
  const deleteRecurring = useCallback(async (id) => { const { recurring } = await api.delete(`/api/recurring/${id}`); setState(s => ({ ...s, recurring })); }, []);
  const generateRecurring = useCallback(async () => { const r = await api.post('/api/recurring/generate', {}); setState(s => ({ ...s, expenses: r.expenses, bankAccounts: r.bankAccounts || s.bankAccounts })); return r; }, []);

  // Budget
  const saveBudget = useCallback(async (monthKey, budget) => {
    const { budget: saved } = await api.put(`/api/budget/${monthKey}`, { budget });
    setState(s => ({ ...s, budgets: { ...(s.budgets || {}), [monthKey]: saved } }));
  }, []);

  // Insurance
  const addInsurance = useCallback(async (p) => { const { insurance } = await api.post('/api/insurance', p); setState(s => ({ ...s, insurance })); }, []);
  const updateInsurance = useCallback(async (id, f) => { const { insurance } = await api.patch(`/api/insurance/${id}`, f); setState(s => ({ ...s, insurance })); }, []);
  const deleteInsurance = useCallback(async (id) => { const { insurance } = await api.delete(`/api/insurance/${id}`); setState(s => ({ ...s, insurance })); }, []);

  // Targets
  const updateTarget = useCallback(async (cat, val) => { const { targets } = await api.put(`/api/targets/${encodeURIComponent(cat)}`, { value: val }); setState(s => ({ ...s, targets })); }, []);
  const addTargetCategory = useCallback(async (name, val) => { const { targets } = await api.put(`/api/targets/${encodeURIComponent(name)}`, { value: val }); setState(s => ({ ...s, targets })); }, []);

  // Liabilities
  const addLiability = useCallback(async (l) => { const { liabilities } = await api.post('/api/liabilities', l); setState(s => ({ ...s, liabilities })); }, []);
  const updateLiability = useCallback(async (id, f) => { const { liabilities } = await api.patch(`/api/liabilities/${id}`, f); setState(s => ({ ...s, liabilities })); }, []);
  const deleteLiability = useCallback(async (id) => { const { liabilities } = await api.delete(`/api/liabilities/${id}`); setState(s => ({ ...s, liabilities })); }, []);

  // Goals
  const addGoal = useCallback(async (g) => { const { goals } = await api.post('/api/goals', g); setState(s => ({ ...s, goals })); }, []);
  const updateGoal = useCallback(async (id, f) => { const { goals } = await api.patch(`/api/goals/${id}`, f); setState(s => ({ ...s, goals })); }, []);
  const deleteGoal = useCallback(async (id) => { const { goals } = await api.delete(`/api/goals/${id}`); setState(s => ({ ...s, goals })); }, []);
  const achieveGoal = useCallback(async (id) => { const { goals } = await api.post(`/api/goals/${id}/achieve`, {}); setState(s => ({ ...s, goals })); }, []);
  const reopenGoal = useCallback(async (id) => { const { goals } = await api.post(`/api/goals/${id}/reopen`, {}); setState(s => ({ ...s, goals })); }, []);

  // Snapshots
  const takeSnapshot = useCallback(async () => { const { netWorthSnapshots } = await api.post('/api/snapshots', {}); setState(s => ({ ...s, netWorthSnapshots })); }, []);
  const addPastSnapshot = useCallback(async (date, netWorth, notes) => { const { netWorthSnapshots } = await api.post('/api/snapshots/manual', { date, netWorth, notes }); setState(s => ({ ...s, netWorthSnapshots })); }, []);
  const deleteSnapshot = useCallback(async (id) => { const { netWorthSnapshots } = await api.delete(`/api/snapshots/${id}`); setState(s => ({ ...s, netWorthSnapshots })); }, []);

  // Profile & settings
  const updateFinancialProfile = useCallback(async (f) => { const { financialProfile } = await api.patch('/api/profile', f); setState(s => ({ ...s, financialProfile })); }, []);
  const updateSettings = useCallback(async (f) => { const result = await api.patch('/api/data/settings', f); setState(s => ({ ...s, ...result })); return result; }, []);

  const value = {
    state, ready, error, reload: load,
    addOtherAsset, updateOtherAsset, deleteOtherAsset, addAssetSnapshot, updateAssetSnapshot, deleteAssetSnapshot,
    addBankAccount, updateBankAccount, deleteBankAccount, transferBetweenAccounts,
    addFD, updateFD, deleteFD, matureFD,
    addHolding, updateHoldingRate, updateHolding, deleteHolding, syncHoldingNow,
    addTransaction, updateTransaction, deleteTransaction,
    addExpense, updateExpense, deleteExpense,
    addRecurring, updateRecurring, deleteRecurring, generateRecurring,
    saveBudget,
    addInsurance, updateInsurance, deleteInsurance,
    updateTarget, addTargetCategory,
    addLiability, updateLiability, deleteLiability,
    addGoal, updateGoal, deleteGoal, achieveGoal, reopenGoal,
    takeSnapshot, addPastSnapshot, deleteSnapshot,
    updateFinancialProfile, updateSettings,
  };

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

export function useFinance() {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error('useFinance must be used inside FinanceProvider');
  return ctx;
}
