'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from './api';
import { useAuth } from './AuthContext';

const FinanceContext = createContext(null);

export function FinanceProvider({ children }) {
  const { user } = useAuth();
  const [state, setState] = useState(null);
  const [ready, setReady] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.get('/api/data');
      setState(data);
    } catch (e) {
      setState(null);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    if (user) load();
    else {
      setState(null);
      setReady(true);
    }
  }, [user, load]);

  // ---------- Other assets ----------
  const addOtherAsset = useCallback(async (asset) => {
    const { otherAssets } = await api.post('/api/assets', asset);
    setState((s) => ({ ...s, otherAssets }));
  }, []);
  const updateOtherAsset = useCallback(async (id, amount) => {
    const { otherAssets } = await api.patch(`/api/assets/${id}`, { amount });
    setState((s) => ({ ...s, otherAssets }));
  }, []);
  const deleteOtherAsset = useCallback(async (id) => {
    const { otherAssets } = await api.delete(`/api/assets/${id}`);
    setState((s) => ({ ...s, otherAssets }));
  }, []);
  const addAssetSnapshot = useCallback(async (assetId, date, amount) => {
    const { otherAssets } = await api.post(`/api/assets/${assetId}/snapshots`, { date, amount });
    setState((s) => ({ ...s, otherAssets }));
  }, []);
  const updateAssetSnapshot = useCallback(async (assetId, snapshotId, date, amount) => {
    const { otherAssets } = await api.patch(`/api/assets/${assetId}/snapshots/${snapshotId}`, { date, amount });
    setState((s) => ({ ...s, otherAssets }));
  }, []);
  const deleteAssetSnapshot = useCallback(async (assetId, snapshotId) => {
    const { otherAssets } = await api.delete(`/api/assets/${assetId}/snapshots/${snapshotId}`);
    setState((s) => ({ ...s, otherAssets }));
  }, []);

  // ---------- Holdings ----------
  const addHolding = useCallback(async (holding) => {
    const { holdings } = await api.post('/api/holdings', holding);
    setState((s) => ({ ...s, holdings }));
  }, []);
  const updateHoldingRate = useCallback(async (id, rate) => {
    const { holdings } = await api.patch(`/api/holdings/${id}/rate`, { currentRate: rate });
    setState((s) => ({ ...s, holdings }));
  }, []);
  const updateHolding = useCallback(async (id, fields) => {
    const { holdings } = await api.patch(`/api/holdings/${id}`, fields);
    setState((s) => ({ ...s, holdings }));
  }, []);
  const deleteHolding = useCallback(async (id) => {
    const { holdings } = await api.delete(`/api/holdings/${id}`);
    setState((s) => ({ ...s, holdings }));
  }, []);
  const syncHoldingNow = useCallback(async (id) => {
    const { holdings } = await api.post(`/api/holdings/${id}/sync-now`, {});
    setState((s) => ({ ...s, holdings }));
  }, []);

  // ---------- Transactions ----------
  const addTransaction = useCallback(async (tx) => {
    const { transactions, holdings } = await api.post('/api/transactions', tx);
    setState((s) => ({ ...s, transactions, holdings }));
  }, []);
  const updateTransaction = useCallback(async (id, fields) => {
    const { transactions } = await api.patch(`/api/transactions/${id}`, fields);
    setState((s) => ({ ...s, transactions }));
  }, []);
  const deleteTransaction = useCallback(async (id) => {
    const { transactions } = await api.delete(`/api/transactions/${id}`);
    setState((s) => ({ ...s, transactions }));
  }, []);

  // ---------- Expenses ----------
  const addExpense = useCallback(async (expense) => {
    const { expenses } = await api.post('/api/expenses', expense);
    setState((s) => ({ ...s, expenses }));
  }, []);
  const updateExpense = useCallback(async (id, fields) => {
    const { expenses } = await api.patch(`/api/expenses/${id}`, fields);
    setState((s) => ({ ...s, expenses }));
  }, []);
  const deleteExpense = useCallback(async (id) => {
    const { expenses } = await api.delete(`/api/expenses/${id}`);
    setState((s) => ({ ...s, expenses }));
  }, []);

  // ---------- Insurance ----------
  const addInsurance = useCallback(async (policy) => {
    const { insurance } = await api.post('/api/insurance', policy);
    setState((s) => ({ ...s, insurance }));
  }, []);
  const updateInsurance = useCallback(async (id, fields) => {
    const { insurance } = await api.patch(`/api/insurance/${id}`, fields);
    setState((s) => ({ ...s, insurance }));
  }, []);
  const deleteInsurance = useCallback(async (id) => {
    const { insurance } = await api.delete(`/api/insurance/${id}`);
    setState((s) => ({ ...s, insurance }));
  }, []);

  // ---------- Allocation targets ----------
  const updateTarget = useCallback(async (cat, val) => {
    const { targets } = await api.put(`/api/targets/${encodeURIComponent(cat)}`, { value: val });
    setState((s) => ({ ...s, targets }));
  }, []);
  const addTargetCategory = useCallback(async (name, val) => {
    const { targets } = await api.put(`/api/targets/${encodeURIComponent(name)}`, { value: val });
    setState((s) => ({ ...s, targets }));
  }, []);

  // ---------- Liabilities ----------
  const addLiability = useCallback(async (liability) => {
    const { liabilities } = await api.post('/api/liabilities', liability);
    setState((s) => ({ ...s, liabilities }));
  }, []);
  const updateLiability = useCallback(async (id, fields) => {
    const { liabilities } = await api.patch(`/api/liabilities/${id}`, fields);
    setState((s) => ({ ...s, liabilities }));
  }, []);
  const deleteLiability = useCallback(async (id) => {
    const { liabilities } = await api.delete(`/api/liabilities/${id}`);
    setState((s) => ({ ...s, liabilities }));
  }, []);

  // ---------- Goals ----------
  const addGoal = useCallback(async (goal) => {
    const { goals } = await api.post('/api/goals', goal);
    setState((s) => ({ ...s, goals }));
  }, []);
  const updateGoal = useCallback(async (id, fields) => {
    const { goals } = await api.patch(`/api/goals/${id}`, fields);
    setState((s) => ({ ...s, goals }));
  }, []);
  const deleteGoal = useCallback(async (id) => {
    const { goals } = await api.delete(`/api/goals/${id}`);
    setState((s) => ({ ...s, goals }));
  }, []);

  // ---------- Net worth snapshots ----------
  const takeSnapshot = useCallback(async () => {
    const { netWorthSnapshots } = await api.post('/api/snapshots', {});
    setState((s) => ({ ...s, netWorthSnapshots }));
  }, []);
  const deleteSnapshot = useCallback(async (id) => {
    const { netWorthSnapshots } = await api.delete(`/api/snapshots/${id}`);
    setState((s) => ({ ...s, netWorthSnapshots }));
  }, []);

  // ---------- Financial profile (Health Check) ----------
  const updateFinancialProfile = useCallback(async (fields) => {
    const { financialProfile } = await api.patch('/api/profile', fields);
    setState((s) => ({ ...s, financialProfile }));
  }, []);

  const value = {
    state,
    ready,
    reload: load,
    addOtherAsset,
    updateOtherAsset,
    deleteOtherAsset,
    addAssetSnapshot,
    updateAssetSnapshot,
    deleteAssetSnapshot,
    addHolding,
    updateHoldingRate,
    updateHolding,
    deleteHolding,
    syncHoldingNow,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    addExpense,
    updateExpense,
    deleteExpense,
    addInsurance,
    updateInsurance,
    deleteInsurance,
    updateTarget,
    addTargetCategory,
    addLiability,
    updateLiability,
    deleteLiability,
    addGoal,
    updateGoal,
    deleteGoal,
    takeSnapshot,
    deleteSnapshot,
    updateFinancialProfile,
  };

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

export function useFinance() {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error('useFinance must be used inside FinanceProvider');
  return ctx;
}
