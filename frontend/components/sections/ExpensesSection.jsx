'use client';

import { useState, useMemo } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useFinance } from '@/lib/FinanceContext';
import { Card, SectionTitle, StatCard, Tag, EmptyState, Btn, IconBtn, Field, inputClass } from '@/components/ui';
import Modal, { ModalActions } from '@/components/Modal';
import { IconPlus, IconTrash, IconEdit, IconDownload } from '@/components/Icons';
import { fmtINR, todayStr, monthKey, monthLabel, shiftMonthKey } from '@/lib/utils';
import { EXPENSE_CATEGORIES, API_BASE } from '@/lib/constants';

export default function ExpensesSection() {
  const { state, ready, addExpense, updateExpense, deleteExpense } = useFinance();
  const [selectedMonth, setSelectedMonth] = useState(monthKey(new Date()));
  const [perspective, setPerspective] = useState('category');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [exportScope, setExportScope] = useState('month');
  const [form, setForm] = useState({ date: todayStr(), category: EXPENSE_CATEGORIES[0], description: '', amount: '' });

  const monthExpenses = useMemo(() => {
    if (!state) return [];
    return state.expenses.filter((e) => e.date.slice(0, 7) === selectedMonth).sort((a, b) => b.date.localeCompare(a.date));
  }, [state, selectedMonth]);

  if (!ready || !state) return null;

  const total = monthExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const byCat = {};
  monthExpenses.forEach((e) => (byCat[e.category] = (byCat[e.category] || 0) + Number(e.amount || 0)));
  const topCat = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];
  const [y, m] = selectedMonth.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const avgDay = monthExpenses.length ? total / daysInMonth : 0;

  let chartData = [];
  if (perspective === 'category') {
    chartData = Object.entries(byCat)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }));
  } else if (perspective === 'daily') {
    const byDay = new Array(daysInMonth).fill(0);
    monthExpenses.forEach((e) => {
      const d = Number(e.date.slice(8, 10));
      byDay[d - 1] += Number(e.amount || 0);
    });
    chartData = byDay.map((v, i) => ({ name: String(i + 1), value: v }));
  } else {
    const months = [];
    for (let i = 5; i >= 0; i--) months.push(shiftMonthKey(selectedMonth, -i));
    chartData = months.map((mk) => ({
      name: monthLabel(mk),
      value: state.expenses.filter((e) => e.date.slice(0, 7) === mk).reduce((s, e) => s + Number(e.amount || 0), 0),
    }));
  }

  function openAdd() {
    setEditingId(null);
    setForm({ date: todayStr(), category: EXPENSE_CATEGORIES[0], description: '', amount: '' });
    setModalOpen(true);
  }
  function openEdit(e) {
    setEditingId(e.id);
    setForm({ date: e.date, category: e.category, description: e.description || '', amount: String(e.amount) });
    setModalOpen(true);
  }

  function submit() {
    const amount = Number(form.amount) || 0;
    if (amount <= 0) return alert('Enter an amount');
    const date = form.date || todayStr();
    if (editingId) {
      updateExpense(editingId, { date, category: form.category, description: form.description.trim(), amount });
    } else {
      addExpense({ date, category: form.category, description: form.description.trim(), amount });
    }
    setSelectedMonth(date.slice(0, 7));
    setModalOpen(false);
  }

  const exportUrl =
    exportScope === 'month'
      ? `${API_BASE}/api/export/expenses.csv?scope=month&month=${selectedMonth}`
      : exportScope === 'year'
      ? `${API_BASE}/api/export/expenses.csv?scope=year&year=${selectedMonth.slice(0, 4)}`
      : `${API_BASE}/api/export/expenses.csv?scope=all`;

  return (
    <>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <div className="flex items-center gap-3.5">
          <button onClick={() => setSelectedMonth(shiftMonthKey(selectedMonth, -1))} className="border border-line rounded-md w-[30px] h-[30px] text-ink">
            ‹
          </button>
          <span className="font-display text-[17px] font-semibold min-w-[150px] text-center">{monthLabel(selectedMonth)}</span>
          <button onClick={() => setSelectedMonth(shiftMonthKey(selectedMonth, 1))} className="border border-line rounded-md w-[30px] h-[30px] text-ink">
            ›
          </button>
        </div>
        <Btn onClick={openAdd}>
          <IconPlus /> Add spend
        </Btn>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <div className="inline-flex border border-line rounded-lg overflow-hidden">
          {[
            ['category', 'By Category'],
            ['daily', 'Daily Trend'],
            ['months', '6-Month Trend'],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setPerspective(key)}
              className={`px-3.5 py-1.5 text-xs font-medium border-r border-line last:border-r-0 ${
                perspective === key ? 'bg-ink text-white' : 'bg-white text-inkMuted'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <select className={`${inputClass} w-auto`} value={exportScope} onChange={(e) => setExportScope(e.target.value)}>
            <option value="month">Export {monthLabel(selectedMonth)}</option>
            <option value="year">Export {selectedMonth.slice(0, 4)}</option>
            <option value="all">Export all data</option>
          </select>
          <a href={exportUrl}>
            <Btn variant="secondary">
              <IconDownload /> CSV
            </Btn>
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Total this month" value={fmtINR(total)} />
        <StatCard label="Top category" value={topCat ? topCat[0] : '—'} delta={topCat ? fmtINR(topCat[1]) : ''} deltaClass="text-inkMuted" />
        <StatCard label="Average per day" value={fmtINR(avgDay)} />
      </div>

      <SectionTitle>Spend pattern</SectionTitle>
      <Card>
        <div className="h-[260px]">
          {chartData.some((d) => d.value > 0) ? (
            <ResponsiveContainer width="100%" height="100%">
              {perspective === 'category' ? (
                <BarChart data={chartData} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tickFormatter={(v) => '₹' + v} fontSize={11} />
                  <YAxis type="category" dataKey="name" width={110} fontSize={11.5} />
                  <Tooltip formatter={(v) => fmtINR(v)} />
                  <Bar dataKey="value" fill="#1C2430" radius={[0, 4, 4, 0]} />
                </BarChart>
              ) : perspective === 'daily' ? (
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" fontSize={10.5} label={{ value: 'Day of month', position: 'insideBottom', offset: -5, fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => '₹' + v} fontSize={11} />
                  <Tooltip formatter={(v) => fmtINR(v)} />
                  <Bar dataKey="value" fill="#0F766E" radius={[3, 3, 0, 0]} />
                </BarChart>
              ) : (
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" fontSize={10.5} />
                  <YAxis tickFormatter={(v) => '₹' + v} fontSize={11} />
                  <Tooltip formatter={(v) => fmtINR(v)} />
                  <Line type="monotone" dataKey="value" stroke="#276B47" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              )}
            </ResponsiveContainer>
          ) : (
            <EmptyState title="Nothing to chart yet">Add a spend for this month to see the pattern.</EmptyState>
          )}
        </div>
      </Card>

      <SectionTitle>Entries — {monthLabel(selectedMonth)}</SectionTitle>
      {monthExpenses.length ? (
        <Card padded={false} className="p-2 overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Category</th>
                <th>Description</th>
                <th className="num">Amount</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {monthExpenses.map((e) => (
                <tr key={e.id}>
                  <td className="mono">{e.date}</td>
                  <td>
                    <Tag>{e.category}</Tag>
                  </td>
                  <td>{e.description}</td>
                  <td className="num">{fmtINR(e.amount)}</td>
                  <td>
                    <div className="flex items-center">
                      <IconBtn danger={false} onClick={() => openEdit(e)} title="Edit">
                        <IconEdit />
                      </IconBtn>
                      <IconBtn onClick={() => deleteExpense(e.id)} title="Delete">
                        <IconTrash />
                      </IconBtn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : (
        <EmptyState title="Nothing logged this month">Add a spend to start tracking {monthLabel(selectedMonth)}.</EmptyState>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? 'Edit spend' : 'Add a spend'}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <Field label="Date">
            <input type="date" className={inputClass} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </Field>
          <Field label="Category">
            <select className={inputClass} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Description">
          <input
            className={inputClass}
            placeholder="e.g. Weekly groceries, cab to airport"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </Field>
        <div className="mt-3">
          <Field label="Amount">
            <input type="number" step="0.01" className={inputClass} placeholder="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </Field>
        </div>
        <ModalActions>
          <Btn variant="secondary" onClick={() => setModalOpen(false)}>
            Cancel
          </Btn>
          <Btn onClick={submit}>{editingId ? 'Save changes' : 'Add spend'}</Btn>
        </ModalActions>
      </Modal>
    </>
  );
}
