'use client';

import { useState, useMemo } from 'react';
import SectionLoader from '@/components/SectionLoader';
import { useFinance } from '@/lib/FinanceContext';
import { Card, SectionTitle, StatCard, Btn, Field, inputClass, EmptyState } from '@/components/ui';
import { fmtINR, monthKey, monthLabel, shiftMonthKey } from '@/lib/utils';
import { EXPENSE_CATEGORIES } from '@/lib/constants';

function BudgetBar({ category, budgeted, spent, onEdit }) {
  const pct = budgeted > 0 ? Math.min((spent / budgeted) * 100, 100) : 0;
  const over = spent > budgeted && budgeted > 0;
  const warn = pct >= 80 && !over;
  const barColor = over ? '#DC2626' : warn ? '#C2410C' : '#2563EB';
  const bgColor = over ? '#FEF2F2' : warn ? '#FFF7ED' : '#EFF6FF';

  return (
    <div className="py-3 border-b border-line dark:border-gray-700 last:border-b-0">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[13.5px] font-medium text-ink dark:text-gray-100">{category}</span>
        <div className="flex items-center gap-3">
          <span className={`text-[12.5px] font-mono ${over ? 'text-clay font-semibold' : 'text-inkMuted dark:text-gray-400'}`}>
            {fmtINR(spent)} / {fmtINR(budgeted)}
          </span>
          {over && <span className="text-[10px] bg-clayBg text-clay px-2 py-0.5 rounded-full font-semibold">Over by {fmtINR(spent - budgeted)}</span>}
          {warn && <span className="text-[10px] bg-warnBg text-warn px-2 py-0.5 rounded-full font-semibold">{Math.round(pct)}% used</span>}
          <button onClick={onEdit} className="text-[11px] text-accent hover:underline">edit</button>
        </div>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: bgColor }}>
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: barColor }} />
      </div>
      {!over && budgeted > 0 && (
        <div className="text-[11px] text-inkMuted dark:text-gray-500 mt-1">{fmtINR(budgeted - spent)} remaining</div>
      )}
    </div>
  );
}

export default function BudgetSection() {
  const { state, ready, saveBudget } = useFinance();

  const [selectedMonth, setSelectedMonth] = useState(monthKey(new Date()));
  const [editingCat, setEditingCat] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [addingCat, setAddingCat] = useState("");
  const [addingAmt, setAddingAmt] = useState("");
  const [copyOpen, setCopyOpen] = useState(false);

  const monthSpend = useMemo(() => {
    const bycat = {};

    (state?.expenses || [])
      .filter(
        (e) =>
          e.date.slice(0, 7) === selectedMonth &&
          (e.expenseType === "expense" || !e.expenseType),
      )
      .forEach((e) => {
        bycat[e.category] = (bycat[e.category] || 0) + Number(e.amount || 0);
      });

    return bycat;
  }, [state?.expenses, selectedMonth]);

  if (!ready || !state) return <SectionLoader />;

  const budgets = state.budgets || {};
  const monthBudget = budgets[selectedMonth] || {};

  const totalBudgeted = Object.values(monthBudget).reduce((s, v) => s + v, 0);
  const totalSpent = Object.keys(monthBudget).reduce((s, cat) => s + (monthSpend[cat] || 0), 0);
  const overCount = Object.keys(monthBudget).filter(cat => (monthSpend[cat] || 0) > monthBudget[cat]).length;

  async function saveEdit(cat, val) {
    const amt = Number(val);
    const updated = { ...monthBudget };
    if (amt > 0) updated[cat] = amt;
    else delete updated[cat];
    await saveBudget(selectedMonth, updated);
    setEditingCat(null);
  }

  async function addCategory() {
    if (!addingCat || !(Number(addingAmt) > 0)) return;
    const updated = { ...monthBudget, [addingCat]: Number(addingAmt) };
    await saveBudget(selectedMonth, updated);
    setAddingCat(''); setAddingAmt('');
  }

  async function copyFromLastMonth() {
    const lastBudget = budgets[shiftMonthKey(selectedMonth, -1)] || {};
    if (!Object.keys(lastBudget).length) return alert('No budget found for last month.');
    await saveBudget(selectedMonth, { ...lastBudget });
    setCopyOpen(false);
  }

  async function autoFillFromAvg() {
    // Compute 3-month average spend per category
    const months = [1, 2, 3].map(i => shiftMonthKey(selectedMonth, -i));
    const avgBycat = {};
    months.forEach(mk => {
      (state.expenses || [])
        .filter(e => e.date.slice(0, 7) === mk && (e.expenseType === 'expense' || !e.expenseType))
        .forEach(e => { avgBycat[e.category] = (avgBycat[e.category] || 0) + Number(e.amount || 0); });
    });
    const updated = {};
    Object.entries(avgBycat).forEach(([cat, total]) => {
      updated[cat] = Math.ceil((total / 3) / 100) * 100; // round up to nearest 100
    });
    if (!Object.keys(updated).length) return alert('Not enough expense history to auto-fill.');
    await saveBudget(selectedMonth, updated);
  }

  const budgetCategories = Object.keys(monthBudget);
  const unbudgetedSpend = Object.entries(monthSpend)
    .filter(([cat]) => !monthBudget[cat])
    .reduce((s, [, v]) => s + v, 0);

  return (
    <>
      <p className="text-inkMuted dark:text-gray-400 text-[13.5px] max-w-2xl mb-5">
        Set a spending limit per category. Bars turn amber at 80%, red when exceeded. Auto-fill uses your last 3 months average.
      </p>

      {/* Month nav */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <div className="flex items-center gap-3">
          <button onClick={() => setSelectedMonth(shiftMonthKey(selectedMonth, -1))}
            className="border border-line dark:border-gray-600 rounded-md w-8 h-8 text-ink dark:text-gray-200 hover:bg-paper dark:hover:bg-gray-700 transition-colors">‹</button>
          <span className="font-display text-[17px] font-semibold min-w-[160px] text-center text-ink dark:text-gray-100">{monthLabel(selectedMonth)}</span>
          <button onClick={() => setSelectedMonth(shiftMonthKey(selectedMonth, 1))}
            className="border border-line dark:border-gray-600 rounded-md w-8 h-8 text-ink dark:text-gray-200 hover:bg-paper dark:hover:bg-gray-700 transition-colors">›</button>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Btn variant="secondary" onClick={autoFillFromAvg}>Auto-fill from avg</Btn>
          <Btn variant="secondary" onClick={copyFromLastMonth}>Copy last month</Btn>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <StatCard label="Total budgeted" value={fmtINR(totalBudgeted)} />
        <StatCard label="Total spent" value={fmtINR(totalSpent)}
          deltaClass={totalSpent > totalBudgeted ? 'text-clay' : 'text-emerald'} />
        <StatCard label="Remaining" value={fmtINR(Math.max(0, totalBudgeted - totalSpent))}
          deltaClass={totalSpent > totalBudgeted ? 'text-clay' : 'text-emerald'} />
        <StatCard label="Categories over" value={String(overCount)}
          deltaClass={overCount > 0 ? 'text-clay' : 'text-emerald'} />
      </div>

      {budgetCategories.length > 0 ? (
        <Card className="mb-5">
          {budgetCategories.map(cat => (
            editingCat === cat ? (
              <div key={cat} className="py-3 border-b border-line dark:border-gray-700 last:border-b-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13.5px] font-medium text-ink dark:text-gray-100 flex-1">{cat}</span>
                  <input type="number" autoFocus className={`${inputClass} w-28`} value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveEdit(cat, editValue); if (e.key === 'Escape') setEditingCat(null); }} />
                  <Btn onClick={() => saveEdit(cat, editValue)}>Save</Btn>
                  <Btn variant="secondary" onClick={() => setEditingCat(null)}>Cancel</Btn>
                  <Btn variant="danger" onClick={() => saveEdit(cat, 0)}>Remove</Btn>
                </div>
              </div>
            ) : (
              <BudgetBar key={cat} category={cat} budgeted={monthBudget[cat]} spent={monthSpend[cat] || 0}
                onEdit={() => { setEditingCat(cat); setEditValue(String(monthBudget[cat])); }} />
            )
          ))}
        </Card>
      ) : (
        <EmptyState title="No budget set for this month">
          Use "Auto-fill from avg" to set budgets based on your last 3 months, or add categories manually below.
        </EmptyState>
      )}

      {unbudgetedSpend > 0 && (
        <div className="text-[12.5px] text-inkMuted dark:text-gray-400 mb-4">
          ⚠ {fmtINR(unbudgetedSpend)} spent in categories without a budget this month.
        </div>
      )}

      {/* Add category */}
      <SectionTitle>Add a budget category</SectionTitle>
      <Card>
        <div className="flex items-end gap-3 flex-wrap">
          <Field label="Category">
            <select className={`${inputClass} w-44`} value={addingCat} onChange={e => setAddingCat(e.target.value)}>
              <option value="">— Select —</option>
              {EXPENSE_CATEGORIES.filter(c => !monthBudget[c]).map(c => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Budget amount">
            <input type="number" step="100" className={`${inputClass} w-32`} placeholder="0" value={addingAmt}
              onChange={e => setAddingAmt(e.target.value)} />
          </Field>
          <Btn onClick={addCategory} disabled={!addingCat || !addingAmt}><span>Add</span></Btn>
        </div>
      </Card>
    </>
  );
}
