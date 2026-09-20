'use client';

import { useState, useMemo, useRef, useCallback } from 'react';
import SectionLoader from '@/components/SectionLoader';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useFinance } from '@/lib/FinanceContext';
import { Amount } from '@/lib/PrivacyContext';
import { Card, SectionTitle, StatCard, Tag, EmptyState, Btn, IconBtn, Field, inputClass } from '@/components/ui';
import Modal, { ModalActions } from '@/components/Modal';
import { IconPlus, IconTrash, IconEdit, IconDownload } from '@/components/Icons';
import { fmtINR, todayStr, monthKey, monthLabel, shiftMonthKey } from '@/lib/utils';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, API_BASE, CHART_COLORS } from '@/lib/constants';

function useUndo() {
  const [toast, setToast] = useState(null);
  const timerRef = useRef(null);
  const show = useCallback((message, onUndo) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast({ message, onUndo });
    timerRef.current = setTimeout(() => setToast(null), 5000);
  }, []);
  const dismiss = useCallback(() => { if (timerRef.current) clearTimeout(timerRef.current); setToast(null); }, []);
  return { toast, show, dismiss };
}

const EXPENSE_TYPE_LABELS = {
  expense: 'Expense',
  income: 'Income',
  transfer: 'Transfer',
  atm_withdrawal: 'ATM',
};

const TYPE_TAG_TONE = {
  expense: 'sell',
  income: 'buy',
  transfer: 'mf',
  atm_withdrawal: 'gold',
};

export default function ExpensesSection() {
  const { state, ready, addExpense, updateExpense, deleteExpense } = useFinance();
  const [selectedMonth, setSelectedMonth] = useState(monthKey(new Date()));
  const [perspective, setPerspective] = useState('category');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [exportScope, setExportScope] = useState('month');
  const [filterAccount, setFilterAccount] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterType, setFilterType] = useState('expense'); // default: show expenses
  const [sortBy, setSortBy] = useState('date');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ date: todayStr(), category: EXPENSE_CATEGORIES[0], description: '', amount: '', accountId: '', expenseType: 'expense', notes: '' });
  const { toast, show: showToast, dismiss: dismissToast } = useUndo();

  // Hooks MUST run on every render.
  const allMonthEntries = useMemo(() => {
    if (!state?.expenses) return [];

    return state.expenses.filter((e) => e.date.slice(0, 7) === selectedMonth);
  }, [state?.expenses, selectedMonth]);

  const filteredRows = useMemo(() => {
    return allMonthEntries
      .filter(
        (e) =>
          filterType === "all" ||
          e.expenseType === filterType ||
          (!e.expenseType && filterType === "expense"),
      )
      .filter((e) => filterAccount === "all" || e.accountId === filterAccount)
      .filter((e) => filterCategory === "all" || e.category === filterCategory)
      .filter(
        (e) =>
          !search ||
          e.description?.toLowerCase().includes(search.toLowerCase()) ||
          e.category.toLowerCase().includes(search.toLowerCase()) ||
          (e.notes || "").toLowerCase().includes(search.toLowerCase()),
      )
      .sort((a, b) =>
        sortBy === "amount"
          ? b.amount - a.amount
          : b.date.localeCompare(a.date),
      );
  }, [
    allMonthEntries,
    filterType,
    filterAccount,
    filterCategory,
    search,
    sortBy,
  ]);

  // Conditional rendering AFTER all hooks.
  if (!ready || !state) return <SectionLoader />;

  const bankAccounts = state.bankAccounts || [];

  const onlyExpenses = allMonthEntries.filter(
    (e) => e.expenseType === "expense" || !e.expenseType,
  );

  const onlyIncome = allMonthEntries.filter((e) => e.expenseType === "income");


  const totalSpend  = onlyExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const totalIncome = onlyIncome.reduce((s, e) => s + Number(e.amount || 0), 0);
  const byCat = {};
  onlyExpenses.forEach(e => (byCat[e.category] = (byCat[e.category] || 0) + Number(e.amount || 0)));
  const topCat = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];
  const [y, m] = selectedMonth.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const avgDay = totalSpend / daysInMonth;
  const prevMonth = shiftMonthKey(selectedMonth, -1);
  const prevTotal = (state.expenses || []).filter(e => e.date.slice(0, 7) === prevMonth && (e.expenseType === 'expense' || !e.expenseType)).reduce((s, e) => s + Number(e.amount || 0), 0);
  const diff = totalSpend - prevTotal;

  // Chart data (expenses only)
  let chartData = [];
  if (perspective === 'category') chartData = Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
  else if (perspective === 'daily') {
    const byDay = new Array(daysInMonth).fill(0);
    onlyExpenses.forEach(e => { byDay[Number(e.date.slice(8, 10)) - 1] += Number(e.amount || 0); });
    chartData = byDay.map((v, i) => ({ name: String(i + 1), value: v }));
  } else if (perspective === 'months') {
    const months = []; for (let i = 5; i >= 0; i--) months.push(shiftMonthKey(selectedMonth, -i));
    chartData = months.map(mk => ({ name: monthLabel(mk).slice(0, 3), value: state.expenses.filter(e => e.date.slice(0, 7) === mk && (e.expenseType === 'expense' || !e.expenseType)).reduce((s, e) => s + Number(e.amount || 0), 0) }));
  } else if (perspective === 'pie') {
    chartData = Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
  }

  const uniqueCategories = [...new Set(allMonthEntries.map(e => e.category))];

  function openAdd() {
    setEditingId(null);
    setForm({ date: todayStr(), category: EXPENSE_CATEGORIES[0], description: '', amount: '', accountId: '', expenseType: 'expense', notes: '' });
    setModalOpen(true);
  }
  function openEdit(e) {
    setEditingId(e.id);
    setForm({ date: e.date, category: e.category, description: e.description || '', amount: String(e.amount), accountId: e.accountId || '', expenseType: e.expenseType || 'expense', notes: e.notes || '' });
    setModalOpen(true);
  }
  function openClone(e) {
    setEditingId(null);
    setForm({ date: todayStr(), category: e.category, description: e.description || '', amount: String(e.amount), accountId: e.accountId || '', expenseType: e.expenseType || 'expense', notes: e.notes || '' });
    setModalOpen(true);
  }

  function submit() {
    const amount = Number(form.amount) || 0;
    if (amount <= 0) return alert('Enter an amount');
    const date = form.date || todayStr();
    const payload = { date, category: form.category, description: form.description.trim(), amount, accountId: form.accountId, expenseType: form.expenseType, notes: form.notes.trim() };
    if (editingId) updateExpense(editingId, payload);
    else addExpense(payload);
    setSelectedMonth(date.slice(0, 7));
    setModalOpen(false);
  }

  function handleDelete(e) {
    const snapshot = { ...e };
    deleteExpense(e.id);
    showToast(`Deleted "${e.description || e.category}"`, () => {
      addExpense({ date: snapshot.date, category: snapshot.category, description: snapshot.description, amount: snapshot.amount, accountId: snapshot.accountId, expenseType: snapshot.expenseType || 'expense', notes: snapshot.notes || '' });
    });
  }

  const exportUrl = exportScope === 'month' ? `${API_BASE}/api/export/expenses.csv?scope=month&month=${selectedMonth}`
    : exportScope === 'year' ? `${API_BASE}/api/export/expenses.csv?scope=year&year=${selectedMonth.slice(0, 4)}`
    : `${API_BASE}/api/export/expenses.csv?scope=all`;

  const allCategories = form.expenseType === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  return (
    <>
      {/* Undo toast */}
      {toast && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-ink dark:bg-gray-700 text-white px-4 py-2.5 rounded-xl shadow-xl text-[13px] font-medium">
          <span>{toast.message}</span>
          <button
            onClick={() => {
              toast.onUndo();
              dismissToast();
            }}
            className="text-accentLight hover:text-white border border-accentLight/40 rounded-md px-2.5 py-1 text-xs"
          >
            Undo
          </button>
          <button
            onClick={dismissToast}
            className="text-gray-400 hover:text-white ml-1 text-lg leading-none"
          >
            ✕
          </button>
        </div>
      )}

      {/* Month nav */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSelectedMonth(shiftMonthKey(selectedMonth, -1))}
            className="border border-line dark:border-gray-600 rounded-md w-8 h-8 text-ink dark:text-gray-200 hover:bg-paper dark:hover:bg-gray-700 transition-colors"
          >
            ‹
          </button>
          <span className="font-display text-[17px] font-semibold min-w-[160px] text-center text-ink dark:text-gray-100">
            {monthLabel(selectedMonth)}
          </span>
          <button
            onClick={() => setSelectedMonth(shiftMonthKey(selectedMonth, 1))}
            className="border border-line dark:border-gray-600 rounded-md w-8 h-8 text-ink dark:text-gray-200 hover:bg-paper dark:hover:bg-gray-700 transition-colors"
          >
            ›
          </button>
        </div>
        <Btn onClick={openAdd}>
          <IconPlus /> Add entry
        </Btn>
      </div>

      {/* Stats - show both spend and income */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        <StatCard
          label="Spent this month"
          value={<Amount>{fmtINR(totalSpend)}</Amount>}
        />

        <StatCard
          label="Daily average"
          value={<Amount>{fmtINR(avgDay)}</Amount>}
          delta="per calendar day"
          deltaClass="text-inkMuted dark:text-gray-400"
        />

        {/* <StatCard
          label="Income this month"
          value={
            <Amount>
              <span className="text-emerald">{fmtINR(totalIncome)}</span>
            </Amount>
          }
        /> */}

        <StatCard
          label="Top spend category"
          value={topCat ? topCat[0] : "—"}
          delta={topCat ? fmtINR(topCat[1]) : ""}
          deltaClass="text-inkMuted dark:text-gray-400"
        />

        <StatCard
          label="vs last month"
          value={
            diff === 0
              ? "—"
              : `${diff > 0 ? "▲" : "▼"} ${fmtINR(Math.abs(diff))}`
          }
          deltaClass={diff > 0 ? "text-clay" : "text-emerald"}
        />
      </div>

      {/* Chart */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div className="inline-flex border border-line dark:border-gray-600 rounded-lg overflow-hidden">
          {[
            ["category", "By Category"],
            ["pie", "Pie"],
            ["daily", "Daily"],
            ["months", "6-Month"],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setPerspective(key)}
              className={`px-3 py-1.5 text-xs font-medium border-r border-line dark:border-gray-600 last:border-r-0 transition-colors ${perspective === key ? "bg-ink text-white dark:bg-gray-700" : "bg-white dark:bg-gray-800 text-inkMuted dark:text-gray-400 hover:text-ink"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <select
            className={`${inputClass} w-auto`}
            value={exportScope}
            onChange={(e) => setExportScope(e.target.value)}
          >
            <option value="month">This month</option>
            <option value="year">This year</option>
            <option value="all">All time</option>
          </select>
          <a href={exportUrl}>
            <Btn variant="secondary">
              <IconDownload /> CSV
            </Btn>
          </a>
        </div>
      </div>

      <Card className="mb-5">
        <div className="h-[220px]">
          {chartData.some((d) => d.value > 0) ? (
            <ResponsiveContainer width="100%" height="100%">
              {perspective === "category" ? (
                <BarChart
                  data={chartData}
                  layout="vertical"
                  margin={{ left: 8, right: 8 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    horizontal={false}
                    stroke="#E5E7EB"
                  />
                  <XAxis
                    type="number"
                    tickFormatter={(v) =>
                      "₹" + (v >= 1000 ? Math.round(v / 1000) + "k" : v)
                    }
                    fontSize={10.5}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={105}
                    fontSize={11}
                  />
                  <Tooltip
                    formatter={(v) => fmtINR(v)}
                    contentStyle={{ fontSize: 12 }}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {chartData.map((_, i) => (
                      <Cell
                        key={i}
                        fill={CHART_COLORS[i % CHART_COLORS.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              ) : perspective === "pie" ? (
                <PieChart>
                  <Pie
                    data={chartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    innerRadius={40}
                    label={({ name, percent }) =>
                      `${name.slice(0, 10)} ${(percent * 100).toFixed(0)}%`
                    }
                    labelLine={false}
                    fontSize={10}
                  >
                    {chartData.map((_, i) => (
                      <Cell
                        key={i}
                        fill={CHART_COLORS[i % CHART_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v) => fmtINR(v)}
                    contentStyle={{ fontSize: 12 }}
                  />
                </PieChart>
              ) : perspective === "daily" ? (
                <BarChart data={chartData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#E5E7EB"
                  />
                  <XAxis dataKey="name" fontSize={10} />
                  <YAxis
                    tickFormatter={(v) =>
                      "₹" + (v >= 1000 ? Math.round(v / 1000) + "k" : v)
                    }
                    fontSize={10}
                  />
                  <Tooltip
                    formatter={(v) => fmtINR(v)}
                    contentStyle={{ fontSize: 12 }}
                  />
                  <Bar dataKey="value" fill="#2563EB" radius={[3, 3, 0, 0]} />
                </BarChart>
              ) : (
                <LineChart data={chartData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#E5E7EB"
                  />
                  <XAxis dataKey="name" fontSize={10.5} />
                  <YAxis
                    tickFormatter={(v) =>
                      "₹" + (v >= 1000 ? Math.round(v / 1000) + "k" : v)
                    }
                    fontSize={10}
                  />
                  <Tooltip
                    formatter={(v) => fmtINR(v)}
                    contentStyle={{ fontSize: 12 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#059669"
                    strokeWidth={2}
                    dot={{ r: 4, fill: "#059669" }}
                  />
                </LineChart>
              )}
            </ResponsiveContainer>
          ) : (
            <EmptyState title="Nothing to chart yet">
              Add an entry to see patterns.
            </EmptyState>
          )}
        </div>
      </Card>

      {/* Filters - including type filter to show income/ATM/transfers */}
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <div className="relative flex-1 min-w-[160px]">
          <input
            className={`${inputClass} pl-8`}
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-inkMuted text-sm pointer-events-none">
            ⌕
          </span>
        </div>
        <select
          className={`${inputClass} w-auto`}
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
        >
          <option value="all">All types</option>
          <option value="expense">Expenses</option>
          <option value="income">Income</option>
          <option value="transfer">Transfers</option>
          <option value="atm_withdrawal">ATM Withdrawals</option>
        </select>
        <select
          className={`${inputClass} w-auto`}
          value={filterAccount}
          onChange={(e) => setFilterAccount(e.target.value)}
        >
          <option value="all">All accounts</option>
          {bankAccounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
          <option value="">Unlinked</option>
        </select>
        <select
          className={`${inputClass} w-auto`}
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
        >
          <option value="all">All categories</option>
          {uniqueCategories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          className={`${inputClass} w-auto`}
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
        >
          <option value="date">Date</option>
          <option value="amount">Amount ↓</option>
        </select>
      </div>

      <SectionTitle>
        {monthLabel(selectedMonth)} — {filteredRows.length} entr
        {filteredRows.length === 1 ? "y" : "ies"}
      </SectionTitle>

      {filteredRows.length ? (
        <Card padded={false} className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th className="pt-4 pb-3">Date</th>
                {/* <th className="pt-4 pb-3">Type</th> */}
                <th className="pt-4 pb-3">Category</th>
                <th className="pt-4 pb-3">Description</th>
                <th className="pt-4 pb-3">Account</th>
                <th className="pt-4 pb-3">Notes</th>
                <th className="num pt-4 pb-3">Amount</th>
                <th className="pt-4 pb-3"></th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((e) => {
                const acct = bankAccounts.find((a) => a.id === e.accountId);
                const eType = e.expenseType || "expense";
                const isIncome = eType === "income";
                return (
                  <tr key={e.id}>
                    <td className="mono text-inkMuted dark:text-gray-400 whitespace-nowrap text-xs">
                      {e.date}
                    </td>
                    {/* <td>
                      <Tag tone={TYPE_TAG_TONE[eType] || "def"}>
                        {EXPENSE_TYPE_LABELS[eType] || eType}
                      </Tag>
                    </td> */}
                    <td>
                      <Tag>{e.category}</Tag>
                    </td>
                    <td className="text-ink dark:text-gray-200 max-w-[140px] text-[12.5px]">
                      {e.description || (
                        <span className="text-inkMuted">—</span>
                      )}
                    </td>
                    <td>
                      {acct ? (
                        <span
                          className="text-[10px] font-mono px-2 py-0.5 rounded-full whitespace-nowrap"
                          style={{
                            background: acct.color + "22",
                            color: acct.color,
                          }}
                        >
                          {acct.name}
                        </span>
                      ) : (
                        <span className="text-inkMuted dark:text-gray-600 text-xs">
                          —
                        </span>
                      )}
                    </td>
                    <td className="text-inkMuted dark:text-gray-500 text-xs max-w-[100px]">
                      {e.notes || "—"}
                    </td>
                    <td
                      className={`num font-mono ${isIncome ? "text-emerald" : "text-ink dark:text-gray-100"}`}
                    >
                      <Amount>
                        {isIncome ? "+" : ""}
                        {fmtINR(e.amount)}
                      </Amount>
                    </td>
                    <td>
                      <div className="flex items-center gap-0.5">
                        <IconBtn
                          danger={false}
                          onClick={() => openEdit(e)}
                          title="Edit"
                        >
                          <IconEdit />
                        </IconBtn>
                        <IconBtn
                          danger={false}
                          onClick={() => openClone(e)}
                          title="Clone"
                          className="text-[13px]"
                        >
                          ⧉
                        </IconBtn>
                        <IconBtn onClick={() => handleDelete(e)} title="Delete">
                          <IconTrash />
                        </IconBtn>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      ) : (
        <EmptyState
          title={
            search || filterType !== "all"
              ? "No matches"
              : "Nothing logged this month"
          }
        >
          {search
            ? `No entries match "${search}"`
            : filterType !== "all"
              ? `No ${EXPENSE_TYPE_LABELS[filterType] || filterType} entries this month.`
              : `Add an entry to start tracking ${monthLabel(selectedMonth)}.`}
        </EmptyState>
      )}

      {/* Add/Edit modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? "Edit entry" : "Add entry"}
      >
        <div className="inline-flex border border-line dark:border-gray-600 rounded-lg overflow-hidden mb-4">
          {[
            ["expense", "Expense"],
            ["income", "Income"],
          ].map(([val, label]) => (
            <button
              key={val}
              onClick={() =>
                setForm({
                  ...form,
                  expenseType: val,
                  category:
                    val === "income"
                      ? INCOME_CATEGORIES[0]
                      : EXPENSE_CATEGORIES[0],
                })
              }
              className={`px-4 py-1.5 text-xs font-semibold border-r border-line dark:border-gray-600 last:border-r-0 ${form.expenseType === val ? "bg-ink text-white dark:bg-gray-700" : "bg-white dark:bg-gray-800 text-inkMuted"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <Field label="Date">
            <input
              type="date"
              className={inputClass}
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </Field>
          <Field label="Category">
            <select
              className={inputClass}
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {allCategories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Description">
          <input
            className={inputClass}
            placeholder={
              form.expenseType === "income"
                ? "e.g. June salary, freelance project"
                : "e.g. Swiggy order, cab to office"
            }
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <Field label="Amount">
            <input
              type="number"
              step="0.01"
              className={inputClass}
              placeholder="0"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
          </Field>
          <Field
            label="Account"
            hint={
              form.expenseType === "income"
                ? "Credits to balance."
                : "Deducts from balance."
            }
          >
            <select
              className={inputClass}
              value={form.accountId}
              onChange={(e) => setForm({ ...form, accountId: e.target.value })}
            >
              <option value="">— No account —</option>
              {bankAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field
          label="Notes (optional)"
          hint="Split with, reimbursable, occasion…"
        >
          <input
            className={inputClass}
            placeholder="e.g. Split with Arjun · Client reimbursable"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </Field>
        <ModalActions>
          <Btn variant="secondary" onClick={() => setModalOpen(false)}>
            Cancel
          </Btn>
          <Btn onClick={submit}>{editingId ? "Save changes" : "Add"}</Btn>
        </ModalActions>
      </Modal>
    </>
  );
}
