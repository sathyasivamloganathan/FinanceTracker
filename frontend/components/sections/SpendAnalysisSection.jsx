'use client';

import { useState, useMemo } from 'react';
import SectionLoader from '@/components/SectionLoader';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { useFinance } from '@/lib/FinanceContext';
import { Card, SectionTitle, StatCard, Tag, EmptyState, inputClass } from '@/components/ui';
import { Amount } from "@/lib/PrivacyContext";
import { fmtINR, monthKey, monthLabel, shiftMonthKey } from '@/lib/utils';
import { CHART_COLORS } from '@/lib/constants';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function HeatCell({ value, max }) {
  const intensity = max > 0 ? value / max : 0;
  const bg = intensity === 0
    ? 'bg-line dark:bg-gray-700'
    : intensity < 0.33
    ? 'bg-accentLight'
    : intensity < 0.66
    ? 'bg-accent/60'
    : 'bg-accent';
  return (
    <div className={`w-7 h-7 rounded-sm ${bg} flex items-center justify-center`}
      title={value > 0 ? fmtINR(value) : 'No spend'}>
      {value > 0 && <span className="text-[8px] text-white font-mono leading-none">{Math.round(value / 1000) || ''}{value >= 1000 ? 'k' : ''}</span>}
    </div>
  );
}

export default function SpendAnalysisSection() {
  const { state, ready } = useFinance();
  const [range, setRange] = useState('3m');
  const [drillCat, setDrillCat] = useState(null);

  if (!ready || !state) return <SectionLoader />;

  const expenses = (state.expenses || []).filter(e => e.expenseType === 'expense' || !e.expenseType);

  // ── Date range ──────────────────────────────────────────────────────
  const now = new Date();
  const cutoff = useMemo(() => {
    if (range === '1m') return shiftMonthKey(monthKey(now), -1) + '-01';
    if (range === '3m') return shiftMonthKey(monthKey(now), -3) + '-01';
    if (range === '6m') return shiftMonthKey(monthKey(now), -6) + '-01';
    if (range === '1y') return (now.getFullYear() - 1) + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-01';
    return '2000-01-01';
  }, [range]);

  const filtered = expenses.filter(e => e.date >= cutoff);

  // ── Total & averages ────────────────────────────────────────────────
  const total = filtered.reduce((s, e) => s + Number(e.amount || 0), 0);
  const txCount = filtered.length;

  // ── By category ─────────────────────────────────────────────────────
  const byCat = {};
  filtered.forEach(e => { byCat[e.category] = (byCat[e.category] || 0) + Number(e.amount || 0); });
  const catData = Object.entries(byCat).sort((a, b) => b[1] - a[1]);

  // ── Monthly trend ────────────────────────────────────────────────────
  const monthCount = range === '1m' ? 1 : range === '3m' ? 3 : range === '6m' ? 6 : 12;
  const monthlyTrend = useMemo(() => {
    return Array.from({ length: monthCount }, (_, i) => {
      const mk = shiftMonthKey(monthKey(now), -(monthCount - 1 - i));
      const val = expenses.filter(e => e.date.slice(0, 7) === mk).reduce((s, e) => s + Number(e.amount || 0), 0);
      return { name: monthLabel(mk).slice(0, 3), value: val };
    });
  }, [expenses, monthCount]);

  // ── Day-of-week pattern ──────────────────────────────────────────────
  const byDow = [0, 0, 0, 0, 0, 0, 0];
  filtered.forEach(e => { const d = new Date(e.date).getDay(); byDow[d] += Number(e.amount || 0); });
  const dowData = DAY_NAMES.map((name, i) => ({ name, value: byDow[i] }));
  const maxDow = Math.max(...byDow);

  // ── Spend calendar heatmap (current month) ───────────────────────────
  const thisMonth = monthKey(now);
  const [calY, calM] = thisMonth.split('-').map(Number);
  const daysInMonth = new Date(calY, calM, 0).getDate();
  const firstDow = new Date(calY, calM - 1, 1).getDay();
  const calSpend = {};
  expenses.filter(e => e.date.slice(0, 7) === thisMonth).forEach(e => {
    const day = Number(e.date.slice(8, 10));
    calSpend[day] = (calSpend[day] || 0) + Number(e.amount || 0);
  });
  const maxCalDay = Math.max(...Object.values(calSpend), 1);

  // ── Merchant/description frequency ──────────────────────────────────
  const merchantMap = {};
  filtered.filter(e => e.description).forEach(e => {
    const key = e.description.trim();
    if (!merchantMap[key]) merchantMap[key] = { count: 0, total: 0 };
    merchantMap[key].count++;
    merchantMap[key].total += Number(e.amount || 0);
  });
  const topMerchants = Object.entries(merchantMap).sort((a, b) => b[1].total - a[1].total).slice(0, 8);

  // ── 3-month rolling avg per category ─────────────────────────────────
  const rollingAvg = {};
  [1, 2, 3].forEach(i => {
    const mk = shiftMonthKey(monthKey(now), -i);
    expenses.filter(e => e.date.slice(0, 7) === mk).forEach(e => {
      rollingAvg[e.category] = (rollingAvg[e.category] || 0) + Number(e.amount || 0);
    });
  });
  Object.keys(rollingAvg).forEach(k => { rollingAvg[k] = rollingAvg[k] / 3; });

  // ── Drill-down into one category ─────────────────────────────────────
  const drillData = drillCat
    ? filtered.filter(e => e.category === drillCat).sort((a, b) => b.amount - a.amount)
    : [];
  const drillMonthly = drillCat ? Array.from({ length: monthCount }, (_, i) => {
    const mk = shiftMonthKey(monthKey(now), -(monthCount - 1 - i));
    return { name: monthLabel(mk).slice(0, 3), value: expenses.filter(e => e.date.slice(0, 7) === mk && e.category === drillCat).reduce((s, e) => s + Number(e.amount || 0), 0) };
  }) : [];

  if (!filtered.length) {
    return <EmptyState title="Not enough data yet">Add more spending entries to see detailed analysis.</EmptyState>;
  }

  return (
    <>
      {/* Range picker */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <p className="text-inkMuted dark:text-gray-400 text-[13.5px]">
          Deep-dive into every dimension of your spending.
        </p>
        <div className="inline-flex border border-line dark:border-gray-600 rounded-lg overflow-hidden">
          {[['1m','1 month'],['3m','3 months'],['6m','6 months'],['1y','1 year'],['all','All time']].map(([val, label]) => (
            <button key={val} onClick={() => setRange(val)}
              className={`px-3 py-1.5 text-xs font-medium border-r border-line dark:border-gray-600 last:border-r-0 transition-colors ${range === val ? 'bg-ink text-white dark:bg-gray-700' : 'bg-white dark:bg-gray-800 text-inkMuted hover:text-ink dark:text-gray-400'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <StatCard label="Total spent" value={fmtINR(total)} />
        <StatCard label="Transactions" value={String(txCount)} />
        <StatCard label="Avg per transaction" value={fmtINR(txCount ? total / txCount : 0)} />
        <StatCard label="Top category" value={catData[0]?.[0] || '—'} delta={catData[0] ? fmtINR(catData[0][1]) : ''} deltaClass="text-inkMuted dark:text-gray-400" />
      </div>

      {/* Category breakdown + drill-down */}
      <SectionTitle>Spend by category</SectionTitle>
      <p className="text-inkMuted dark:text-gray-400 text-xs mb-3">Tap a category to drill into its transactions and monthly trend.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
        <Card padded={false} className="overflow-hidden">
          <div className="h-[260px] p-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={catData.map(([name, value]) => ({ name, value }))} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                <XAxis type="number" tickFormatter={v => '₹' + (v >= 1000 ? Math.round(v / 1000) + 'k' : v)} fontSize={10} />
                <YAxis type="category" dataKey="name" width={100} fontSize={11} />
                <Tooltip formatter={v => fmtINR(v)} contentStyle={{ fontSize: 12 }} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} cursor="pointer" onClick={d => setDrillCat(drillCat === d.name ? null : d.name)}>
                  {catData.map(([name], i) => <Cell key={i} fill={drillCat === name ? '#0B1220' : CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card padded={false} className="overflow-x-auto">
          <table>
            <thead><tr><th>Category</th><th className="num">Spent</th><th className="num">3-mo avg</th><th className="num">%</th></tr></thead>
            <tbody>
              {catData.map(([cat, amt], i) => {
                const avg = rollingAvg[cat] || 0;
                const pct = total ? (amt / total * 100).toFixed(1) : 0;
                const overAvg = avg > 0 && amt > avg * 1.1;
                return (
                  <tr key={cat} className={`cursor-pointer ${drillCat === cat ? 'bg-accentBg dark:bg-gray-700' : ''}`}
                    onClick={() => setDrillCat(drillCat === cat ? null : cat)}>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                        <span className="text-ink dark:text-gray-200">{cat}</span>
                      </div>
                    </td>
                    <td className="num font-mono">{fmtINR(amt)}</td>
                    <td className={`num font-mono text-xs ${overAvg ? 'text-clay' : 'text-inkMuted dark:text-gray-400'}`}>{avg > 0 ? fmtINR(avg) : '—'}</td>
                    <td className="num text-inkMuted dark:text-gray-400 text-xs">{pct}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      </div>

      {/* Drill-down */}
      {drillCat && (
        <>
          <SectionTitle action={<button onClick={() => setDrillCat(null)} className="text-xs text-clay hover:underline">✕ Clear</button>}>
            {drillCat} — detailed view
          </SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
            <Card>
              <div className="text-xs text-inkMuted dark:text-gray-400 mb-2 font-mono uppercase tracking-wide">Monthly trend</div>
              <div className="h-[160px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={drillMonthly}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis dataKey="name" fontSize={10} />
                    <YAxis tickFormatter={v => '₹' + (v >= 1000 ? Math.round(v / 1000) + 'k' : v)} fontSize={10} />
                    <Tooltip formatter={v => fmtINR(v)} contentStyle={{ fontSize: 12 }} />
                    <Bar dataKey="value" fill="#2563EB" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card padded={false} className="overflow-x-auto">
              <table>
                <thead><tr><th>Date</th><th>Description</th><th>Notes</th><th className="num">Amount</th></tr></thead>
                <tbody>
                  {drillData.slice(0, 8).map(e => (
                    <tr key={e.id}>
                      <td className="mono text-inkMuted dark:text-gray-400 text-xs whitespace-nowrap">{e.date}</td>
                      <td className="text-ink dark:text-gray-200 text-[12.5px]">{e.description || '—'}</td>
                      <td className="text-inkMuted dark:text-gray-500 text-xs">{e.notes || '—'}</td>
                      <td className="num font-mono">{fmtINR(e.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
        </>
      )}

      {/* Monthly trend */}
      <SectionTitle>Monthly spend trend</SectionTitle>
      <Card className="mb-5">
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={monthlyTrend}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
              <XAxis dataKey="name" fontSize={10.5} />
              <YAxis tickFormatter={v => '₹' + (v >= 1000 ? Math.round(v / 1000) + 'k' : v)} fontSize={10} />
              <Tooltip formatter={v => fmtINR(v)} contentStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="value" stroke="#059669" strokeWidth={2.5} dot={{ r: 4, fill: '#059669' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Day-of-week pattern */}
      <SectionTitle>Day-of-week pattern</SectionTitle>
      <Card className="mb-5">
        <p className="text-xs text-inkMuted dark:text-gray-400 mb-3">Which days do you spend the most?</p>
        <div className="h-[160px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dowData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
              <XAxis dataKey="name" fontSize={11} />
              <YAxis tickFormatter={v => '₹' + (v >= 1000 ? Math.round(v / 1000) + 'k' : v)} fontSize={10} />
              <Tooltip formatter={v => fmtINR(v)} contentStyle={{ fontSize: 12 }} />
              <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                {dowData.map((d, i) => <Cell key={i} fill={d.value === maxDow ? '#0B1220' : '#2563EB'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs text-inkMuted dark:text-gray-400 mt-2">Darkest bar = highest spend day</p>
      </Card>

      {/* Calendar heatmap */}
      <SectionTitle>Spend calendar — {monthLabel(thisMonth)}</SectionTitle>
      <Card className="mb-5">
        <div className="grid grid-cols-7 gap-1 mb-2">
          {DAY_NAMES.map(d => <div key={d} className="text-[10px] text-center text-inkMuted dark:text-gray-500 font-mono">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: firstDow }, (_, i) => <div key={'pad' + i} className="w-7 h-7" />)}
          {Array.from({ length: daysInMonth }, (_, i) => (
            <div key={i} className="flex flex-col items-center gap-0.5">
              <HeatCell value={calSpend[i + 1] || 0} max={maxCalDay} />
              <span className="text-[8px] text-inkMuted dark:text-gray-600">{i + 1}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 mt-3">
          <span className="text-[10px] text-inkMuted dark:text-gray-500">Less</span>
          {['bg-line dark:bg-gray-700', 'bg-accentLight', 'bg-accent/60', 'bg-accent'].map((c, i) => (
            <div key={i} className={`w-5 h-5 rounded-sm ${c}`} />
          ))}
          <span className="text-[10px] text-inkMuted dark:text-gray-500">More</span>
        </div>
      </Card>

      {/* Top merchants */}
      <SectionTitle>Where does money go most often</SectionTitle>
      {topMerchants.length ? (
        <Card padded={false} className="overflow-x-auto">
          <table>
            <thead><tr><th>Description / Merchant</th><th className="num">Times</th><th className="num">Total spent</th><th className="num">Avg per time</th></tr></thead>
            <tbody>
              {topMerchants.map(([name, { count, total }]) => (
                <tr key={name}>
                  <td className="text-ink dark:text-gray-200">{name}</td>
                  <td className="num text-inkMuted dark:text-gray-400">{count}×</td>
                  <td className="num font-mono">{fmtINR(total)}</td>
                  <td className="num text-inkMuted dark:text-gray-400 text-xs">{fmtINR(total / count)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : (
        <EmptyState title="Add descriptions to your expenses">Descriptions like "Swiggy", "Petrol", "Amazon" will appear here.</EmptyState>
      )}
    </>
  );
}
