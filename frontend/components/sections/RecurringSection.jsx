'use client';

import { useState } from 'react';
import SectionLoader from '@/components/SectionLoader';
import { useFinance } from '@/lib/FinanceContext';
import { Card, SectionTitle, StatCard, Btn, IconBtn, Field, inputClass, EmptyState, Tag } from '@/components/ui';
import Modal, { ModalActions } from '@/components/Modal';
import { IconPlus, IconTrash, IconEdit, IconRefresh } from '@/components/Icons';
import { fmtINR, todayStr } from '@/lib/utils';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, RECURRING_FREQUENCIES } from '@/lib/constants';

const blank = { name: '', amount: '', category: 'Groceries', accountId: '', frequency: 'monthly', type: 'expense', startDate: todayStr(), endDate: '', notes: '' };

function freqLabel(f) {
  return RECURRING_FREQUENCIES.find(r => r.value === f)?.label || f;
}

function nextDue(startDate, frequency, lastGenerated) {
  const base = lastGenerated || startDate;
  const d = new Date(base);
  if (frequency === 'daily') d.setDate(d.getDate() + 1);
  else if (frequency === 'weekly') d.setDate(d.getDate() + 7);
  else if (frequency === 'fortnightly') d.setDate(d.getDate() + 14);
  else if (frequency === 'monthly') d.setMonth(d.getMonth() + 1);
  else if (frequency === 'quarterly') d.setMonth(d.getMonth() + 3);
  else if (frequency === 'yearly') d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

export default function RecurringSection() {
  const { state, ready, addRecurring, updateRecurring, deleteRecurring, generateRecurring } = useFinance();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(null);
  const [form, setForm] = useState(blank);

  if (!ready || !state) return <SectionLoader />;

  const recurring = state.recurring || [];
  const bankAccounts = state.bankAccounts || [];
  const activeItems = recurring.filter(r => r.active);
  const totalMonthlyExpense = recurring.filter(r => r.active && r.type === 'expense').reduce((s, r) => {
    const multiplier = { daily: 30, weekly: 4.3, fortnightly: 2.15, monthly: 1, quarterly: 1 / 3, yearly: 1 / 12 }[r.frequency] || 1;
    return s + r.amount * multiplier;
  }, 0);
  const totalMonthlyIncome = recurring.filter(r => r.active && r.type === 'income').reduce((s, r) => {
    const multiplier = { daily: 30, weekly: 4.3, fortnightly: 2.15, monthly: 1, quarterly: 1 / 3, yearly: 1 / 12 }[r.frequency] || 1;
    return s + r.amount * multiplier;
  }, 0);

  function openAdd() { setEditingId(null); setForm(blank); setModalOpen(true); }
  function openEdit(r) {
    setEditingId(r.id);
    setForm({ name: r.name, amount: String(r.amount), category: r.category, accountId: r.accountId || '', frequency: r.frequency, type: r.type, startDate: r.startDate, endDate: r.endDate || '', notes: r.notes || '' });
    setModalOpen(true);
  }

  function submit() {
    if (!form.name.trim()) return alert('Enter a name');
    if (!(Number(form.amount) > 0)) return alert('Enter a valid amount');
    const payload = { name: form.name.trim(), amount: Number(form.amount), category: form.category, accountId: form.accountId, frequency: form.frequency, type: form.type, startDate: form.startDate, endDate: form.endDate, notes: form.notes.trim() };
    if (editingId) updateRecurring(editingId, payload);
    else addRecurring(payload);
    setModalOpen(false);
  }

  async function handleGenerate() {
    setGenerating(true);
    setGenerated(null);
    try {
      await generateRecurring();
      setGenerated('Done — any due entries have been added to your spends.');
    } catch (e) { setGenerated('Error generating entries.'); }
    finally { setGenerating(false); }
  }

  const allCategories = form.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  return (
    <>
      <p className="text-inkMuted dark:text-gray-400 text-[13.5px] max-w-2xl mb-5">
        Set up rent, SIPs, salary, EMIs, and subscriptions once — they get logged automatically. Tap <b>Generate now</b> anytime to create due entries, or let the daily cron do it automatically.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <StatCard label="Active templates" value={String(activeItems.length)} />
        <StatCard label="Monthly expense" value={fmtINR(totalMonthlyExpense)} delta="estimated" deltaClass="text-inkMuted dark:text-gray-400" />
        <StatCard label="Monthly income" value={fmtINR(totalMonthlyIncome)} deltaClass="text-emerald" />
        <StatCard label="Net monthly" value={fmtINR(totalMonthlyIncome - totalMonthlyExpense)} deltaClass={totalMonthlyIncome >= totalMonthlyExpense ? 'text-emerald' : 'text-clay'} />
      </div>

      <div className="flex items-center gap-2 flex-wrap mb-5">
        <Btn onClick={openAdd}><IconPlus /> Add recurring</Btn>
        <Btn variant="secondary" onClick={handleGenerate} disabled={generating}>
          <IconRefresh spinning={generating} /> {generating ? 'Generating…' : 'Generate now'}
        </Btn>
        {generated && <span className="text-[12.5px] text-emerald">{generated}</span>}
      </div>

      {recurring.length ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {recurring.map(r => {
            const acct = bankAccounts.find(a => a.id === r.accountId);
            const due = nextDue(r.startDate, r.frequency, r.lastGeneratedDate);
            const isIncome = r.type === 'income';
            return (
              <Card key={r.id} className={`dark:bg-gray-800 dark:border-gray-700 ${!r.active ? 'opacity-50' : ''}`}>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-[14px] text-ink dark:text-gray-100 truncate">{r.name}</span>
                      <Tag tone={isIncome ? 'buy' : 'sell'}>{isIncome ? 'Income' : 'Expense'}</Tag>
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Tag>{r.category}</Tag>
                      <span className="text-inkMuted dark:text-gray-400 text-[11px]">{freqLabel(r.frequency)}</span>
                      {acct && <span className="text-[10px] font-mono px-2 py-0.5 rounded-full" style={{ background: acct.color + '22', color: acct.color }}>{acct.name}</span>}
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <IconBtn danger={false} onClick={() => openEdit(r)} title="Edit"><IconEdit /></IconBtn>
                    <IconBtn onClick={() => updateRecurring(r.id, { active: !r.active })} title={r.active ? 'Pause' : 'Resume'} className="text-xs px-1">
                      {r.active ? '⏸' : '▶'}
                    </IconBtn>
                    <IconBtn onClick={() => deleteRecurring(r.id)} title="Delete"><IconTrash /></IconBtn>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className={`text-[20px] font-display font-semibold ${isIncome ? 'text-emerald' : 'text-ink dark:text-gray-100'}`}>
                    {isIncome ? '+' : ''}{fmtINR(r.amount)}
                  </span>
                  <div className="text-right">
                    <div className="text-[10px] text-inkMuted dark:text-gray-500">Next due</div>
                    <div className="text-[12px] font-mono text-ink dark:text-gray-300">{r.active ? due : '—'}</div>
                  </div>
                </div>
                {r.endDate && <div className="text-[11px] text-inkMuted dark:text-gray-500 mt-1">Ends {r.endDate}</div>}
                {r.notes && <div className="text-[11px] text-inkMuted dark:text-gray-500 mt-1 border-t dark:border-gray-700 pt-1">{r.notes}</div>}
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState title="No recurring templates yet">
          Add rent, salary, SIP, or any repeating transaction. It will be logged automatically on its due date.
        </EmptyState>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? 'Edit recurring' : 'Add recurring transaction'}>
        <div className="inline-flex border border-line dark:border-gray-600 rounded-lg overflow-hidden mb-4">
          {[['expense', 'Expense'], ['income', 'Income']].map(([val, label]) => (
            <button key={val} onClick={() => setForm({ ...form, type: val, category: val === 'income' ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0] })}
              className={`px-4 py-1.5 text-xs font-semibold border-r border-line dark:border-gray-600 last:border-r-0 ${form.type === val ? 'bg-ink text-white dark:bg-gray-700' : 'bg-white dark:bg-gray-800 text-inkMuted'}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <Field label="Name" hint="e.g. Rent, Netflix, SBI SIP">
            <input className={inputClass} placeholder="e.g. Monthly rent" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Amount">
            <input type="number" step="0.01" className={inputClass} placeholder="0" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <Field label="Category">
            <select className={inputClass} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
              {allCategories.map(c => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Frequency">
            <select className={inputClass} value={form.frequency} onChange={e => setForm({ ...form, frequency: e.target.value })}>
              {RECURRING_FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <Field label="Start date">
            <input type="date" className={inputClass} value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} />
          </Field>
          <Field label="End date (optional)">
            <input type="date" className={inputClass} value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <Field label="Account (optional)">
            <select className={inputClass} value={form.accountId} onChange={e => setForm({ ...form, accountId: e.target.value })}>
              <option value="">— No account —</option>
              {bankAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </Field>
          <Field label="Notes (optional)">
            <input className={inputClass} placeholder="e.g. Annual subscription" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
          </Field>
        </div>
        <ModalActions>
          <Btn variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Btn>
          <Btn onClick={submit}>{editingId ? 'Save changes' : 'Add'}</Btn>
        </ModalActions>
      </Modal>
    </>
  );
}
