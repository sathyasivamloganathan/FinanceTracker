'use client';

import { useState } from 'react';
import SectionLoader from '@/components/SectionLoader';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import { useFinance } from '@/lib/FinanceContext';
import { Card, SectionTitle, StatCard, EmptyState, Btn, IconBtn, Field, inputClass } from '@/components/ui';
import { Amount } from '@/lib/PrivacyContext';
import Modal, { ModalActions } from '@/components/Modal';
import { IconPlus, IconTrash } from '@/components/Icons';
import {
  netWorth, totalInvested, totalCurrentEquityValue, totalInvestedEquityValue,
  totalLiabilities, computeCategoryTotals, categoryColor,
  fmtINR, fmtPct, todayStr, confirmDelete,
} from '@/lib/utils';

export default function NetWorthSection() {
  const {
    state, ready,
    takeSnapshot, addPastSnapshot, deleteSnapshot,
  } = useFinance();
  const [pastModalOpen, setPastModalOpen] = useState(false);
  const [pastForm, setPastForm] = useState({ date: '', netWorth: '', notes: '' });

  if (!ready || !state) return <SectionLoader />;

  const nw            = netWorth(state);
  const inv           = totalInvested(state);
  const pl            = nw - inv;
  const plPct         = inv ? (pl / inv) * 100 : 0;
  const eqCur         = totalCurrentEquityValue(state);
  const eqInv         = totalInvestedEquityValue(state);
  const eqPl          = eqCur - eqInv;
  const eqPlPct       = eqInv ? (eqPl / eqInv) * 100 : 0;
  const liabTotal     = totalLiabilities(state);
  const totals        = computeCategoryTotals(state);
  const pieData       = Object.entries(totals).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }));
  const snapshots     = [...state.netWorthSnapshots].sort((a, b) => a.date.localeCompare(b.date));
  const chartData     = snapshots.map(s => ({ name: s.date, value: s.netWorth }));
  const first         = snapshots[0];
  const last          = snapshots[snapshots.length - 1];
  const growth        = first && last ? last.netWorth - first.netWorth : null;
  const growthPct     = first && first.netWorth ? (growth / first.netWorth) * 100 : null;

  function submitPast() {
    if (!pastForm.date) return alert('Enter a date');
    const nwVal = Number(pastForm.netWorth);
    if (isNaN(nwVal) || nwVal < 0) return alert('Enter a valid net worth amount');
    addPastSnapshot(pastForm.date, nwVal, pastForm.notes);
    setPastModalOpen(false);
    setPastForm({ date: '', netWorth: '', notes: '' });
  }

  return (
    <>
      {/* Top stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard
          label="Net Worth"
          value={<Amount>{fmtINR(nw)}</Amount>}
          delta={<Amount>{`${pl >= 0 ? '▲' : '▼'} ${fmtINR(Math.abs(pl))} (${fmtPct(plPct)})`}</Amount>}
          deltaClass={pl >= 0 ? 'text-emerald' : 'text-clay'}
        />
        <StatCard label="Total Invested" value={<Amount>{fmtINR(inv)}</Amount>} delta="across all instruments" deltaClass="text-inkMuted dark:text-gray-400" />
        <StatCard
          label="Market P/L"
          value={<Amount><span className={eqPl >= 0 ? 'text-emerald' : 'text-clay'}>{fmtINR(eqPl)}</span></Amount>}
          delta={fmtPct(eqPlPct)}
          deltaClass={eqPl >= 0 ? 'text-emerald' : 'text-clay'}
        />
        <StatCard
          label="Liabilities"
          value={<Amount><span className={liabTotal ? 'text-clay' : ''}>{fmtINR(liabTotal)}</span></Amount>}
          delta="loans & debts"
          deltaClass="text-inkMuted dark:text-gray-400"
        />
      </div>

      {/* Snapshot chart */}
      <SectionTitle
        action={
          <div className="flex gap-2">
            <Btn variant="secondary" onClick={() => takeSnapshot()}><IconPlus /> Today's snapshot</Btn>
            <Btn variant="secondary" onClick={() => { setPastForm({ date: '', netWorth: '', notes: '' }); setPastModalOpen(true); }}>+ Past entry</Btn>
          </div>
        }
      >
        Net worth over time
      </SectionTitle>

      {snapshots.length ? (
        <>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <StatCard
              label="Growth since first snapshot"
              value={growth === null ? '—' : <Amount>{fmtINR(growth)}</Amount>}
              delta={growthPct === null ? 'Take more snapshots to compare' : fmtPct(growthPct)}
              deltaClass={growth >= 0 ? 'text-emerald' : 'text-clay'}
            />
            <StatCard label="Snapshots" value={String(snapshots.length)} delta={`since ${first?.date || '—'}`} deltaClass="text-inkMuted dark:text-gray-400" />
          </div>
          <Card className="mb-4">
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis dataKey="name" fontSize={10} />
                  <YAxis tickFormatter={v => '₹' + (v >= 100000 ? Math.round(v/100000)+'L' : v >= 1000 ? Math.round(v/1000)+'k' : v)} fontSize={10} width={52} />
                  <Tooltip formatter={v => fmtINR(v)} contentStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="value" stroke="#2563EB" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card padded={false} className="overflow-x-auto mb-6">
            <table>
              <thead><tr><th>Date</th><th className="num">Net Worth</th><th className="num">Invested</th><th></th></tr></thead>
              <tbody>
                {[...snapshots].reverse().map(s => (
                  <tr key={s.id}>
                    <td className="mono dark:text-gray-300">{s.date}</td>
                    <td className="num"><Amount>{fmtINR(s.netWorth)}</Amount></td>
                    <td className="num"><Amount>{fmtINR(s.invested)}</Amount></td>
                    <td>
                      <IconBtn onClick={() => confirmDelete('Delete this snapshot?') && deleteSnapshot(s.id)}>
                        <IconTrash />
                      </IconBtn>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      ) : (
        <EmptyState title="No snapshots yet">
          Take a snapshot once a month to start building your net worth history.
        </EmptyState>
      )}

      {/* Net worth composition */}
      <SectionTitle>Portfolio composition</SectionTitle>
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <div className="h-[240px]">
            {pieData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="82%" paddingAngle={2}>
                    {pieData.map(d => <Cell key={d.name} fill={categoryColor(d.name)} />)}
                  </Pie>
                  <Tooltip formatter={v => fmtINR(v)} contentStyle={{ fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontFamily: 'var(--font-plex-sans)', fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState title="No assets yet">Add holdings or accounts to see your mix.</EmptyState>
            )}
          </div>
        </Card>
        <Card padded={false} className="overflow-x-auto">
          <table>
            <thead><tr><th>Category</th><th className="num">Value</th><th className="num">Share</th></tr></thead>
            <tbody>
              {pieData.length ? (
                [...pieData].sort((a, b) => b.value - a.value).map(({ name, value }) => (
                  <tr key={name}>
                    <td>
                      <span className="inline-block w-2.5 h-2.5 rounded-sm mr-2" style={{ background: categoryColor(name) }} />
                      <span className="dark:text-gray-200">{name}</span>
                    </td>
                    <td className="num"><Amount>{fmtINR(value)}</Amount></td>
                    <td className="num text-inkMuted dark:text-gray-400">{nw ? ((value / nw) * 100).toFixed(1) : '0.0'}%</td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={3} className="text-center text-inkMuted py-4">No assets yet</td></tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>

      {/* Past net worth entry modal */}
      <Modal open={pastModalOpen} onClose={() => setPastModalOpen(false)} title="Add a past net worth entry">
        <p className="text-[12.5px] text-inkMuted dark:text-gray-400 mb-4">
          Enter a historical figure from your spreadsheet to fill in the chart going back further.
        </p>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <Field label="Date">
            <input type="date" className={inputClass} value={pastForm.date} onChange={e => setPastForm({ ...pastForm, date: e.target.value })} />
          </Field>
          <Field label="Net worth on that date">
            <input type="number" step="1000" className={inputClass} placeholder="e.g. 500000" value={pastForm.netWorth} onChange={e => setPastForm({ ...pastForm, netWorth: e.target.value })} />
          </Field>
        </div>
        <Field label="Notes (optional)">
          <input className={inputClass} placeholder="e.g. From FY24 spreadsheet" value={pastForm.notes} onChange={e => setPastForm({ ...pastForm, notes: e.target.value })} />
        </Field>
        <ModalActions>
          <Btn variant="secondary" onClick={() => setPastModalOpen(false)}>Cancel</Btn>
          <Btn onClick={submitPast}>Save entry</Btn>
        </ModalActions>
      </Modal>
    </>
  );
}
