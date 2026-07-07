'use client';

import { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import { useFinance } from '@/lib/FinanceContext';
import { Card, SectionTitle, StatCard, Tag, EmptyState, Btn, IconBtn, Field, inputClass } from '@/components/ui';
import { Amount } from '@/lib/PrivacyContext';
import Modal, { ModalActions } from '@/components/Modal';
import EditableNumber from '@/components/EditableNumber';
import { IconPlus, IconTrash } from '@/components/Icons';
import {
  netWorth,
  totalInvested,
  totalCurrentEquityValue,
  totalInvestedEquityValue,
  totalLiabilities,
  computeCategoryTotals,
  categoryColor,
  fmtINR,
  fmtPct,
  todayStr,
} from '@/lib/utils';
import { DEFAULT_ASSET_CATEGORIES } from '@/lib/constants';

export default function NetWorthSection() {
  const {
    state,
    ready,
    addOtherAsset,
    updateOtherAsset,
    deleteOtherAsset,
    addAssetSnapshot,
    updateAssetSnapshot,
    deleteAssetSnapshot,
    takeSnapshot,
    deleteSnapshot,
  } = useFinance();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ category: 'Cash', name: '', amount: '' });
  const [historyFor, setHistoryFor] = useState(null);

  if (!ready || !state) return null;

  const nw = netWorth(state);
  const inv = totalInvested(state);
  const pl = nw - inv;
  const plPct = inv ? (pl / inv) * 100 : 0;
  const eqCur = totalCurrentEquityValue(state);
  const eqInv = totalInvestedEquityValue(state);
  const eqPl = eqCur - eqInv;
  const eqPlPct = eqInv ? (eqPl / eqInv) * 100 : 0;
  const totals = computeCategoryTotals(state);
  const pieData = Object.entries(totals).map(([name, value]) => ({ name, value }));
  const categoryOptions = [...new Set([...DEFAULT_ASSET_CATEGORIES, ...Object.keys(state.targets)])];

  function submit() {
    if (!form.name.trim()) return alert('Enter a name');
    addOtherAsset({ category: form.category, name: form.name.trim(), amount: Number(form.amount) || 0 });
    setForm({ category: 'Cash', name: '', amount: '' });
    setModalOpen(false);
  }

  const historyAsset = historyFor ? state.otherAssets.find((a) => a.id === historyFor) : null;
  const historyChartData = historyAsset
    ? [...historyAsset.history].sort((a, b) => a.date.localeCompare(b.date)).map((h) => ({ name: h.date, value: h.amount }))
    : [];

  const liabilitiesTotal = totalLiabilities(state);
  const snapshots = [...state.netWorthSnapshots].sort((a, b) => a.date.localeCompare(b.date));
  const snapshotChartData = snapshots.map((s) => ({ name: s.date, value: s.netWorth }));
  const firstSnapshot = snapshots[0];
  const lastSnapshot = snapshots[snapshots.length - 1];
  const growthSinceStart = firstSnapshot && lastSnapshot ? lastSnapshot.netWorth - firstSnapshot.netWorth : null;
  const growthPct = firstSnapshot && firstSnapshot.netWorth ? (growthSinceStart / firstSnapshot.netWorth) * 100 : null;

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          label="Total Net Worth"
          value={<Amount>{fmtINR(nw)}</Amount>}
          delta={<Amount>{`${pl >= 0 ? '▲' : '▼'} ${fmtINR(Math.abs(pl))} (${fmtPct(plPct)}) overall`}</Amount>}
          deltaClass={pl >= 0 ? 'text-emerald' : 'text-clay'}
        />
        <StatCard label="Total Invested" value={<Amount>{fmtINR(inv)}</Amount>} delta="across all instruments" deltaClass="text-inkMuted" />
        <StatCard
          label="Equity + MF + Gold P/L"
          value={
            <Amount>
              <span className={eqPl >= 0 ? 'text-emerald' : 'text-clay'}>{fmtINR(eqPl)}</span>
            </Amount>
          }
          delta={fmtPct(eqPlPct) + ' return'}
          deltaClass={eqPl >= 0 ? 'text-emerald' : 'text-clay'}
        />
        <StatCard
          label="Liabilities"
          value={
            <Amount>
              <span className={liabilitiesTotal ? 'text-clay' : ''}>{fmtINR(liabilitiesTotal)}</span>
            </Amount>
          }
          delta="loans & debts owed"
          deltaClass="text-inkMuted"
        />
      </div>

      <SectionTitle
        action={
          <Btn variant="secondary" onClick={() => takeSnapshot()}>
            <IconPlus /> Take snapshot
          </Btn>
        }
      >
        Net worth over time
      </SectionTitle>
      {snapshots.length ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-4">
            <StatCard
              label="Growth since first snapshot"
              value={growthSinceStart === null ? '—' : <Amount>{fmtINR(growthSinceStart)}</Amount>}
              delta={growthPct === null ? 'Take another snapshot to compare' : fmtPct(growthPct)}
              deltaClass={growthSinceStart >= 0 ? 'text-emerald' : 'text-clay'}
            />
            <StatCard label="Snapshots taken" value={String(snapshots.length)} delta={`since ${firstSnapshot?.date || '—'}`} deltaClass="text-inkMuted" />
          </div>
          <Card className="mb-4">
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={snapshotChartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" fontSize={10} />
                  <YAxis tickFormatter={(v) => '₹' + v} fontSize={10} width={55} />
                  <Tooltip formatter={(v) => fmtINR(v)} />
                  <Line type="monotone" dataKey="value" stroke="#276B47" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card padded={false} className="p-2 overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th className="num">Net Worth</th>
                  <th className="num">Invested</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {[...snapshots].reverse().map((s) => (
                  <tr key={s.id}>
                    <td className="mono">{s.date}</td>
                    <td className="num">
                      <Amount>{fmtINR(s.netWorth)}</Amount>
                    </td>
                    <td className="num">
                      <Amount>{fmtINR(s.invested)}</Amount>
                    </td>
                    <td>
                      <IconBtn onClick={() => deleteSnapshot(s.id)}>
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
          Take a snapshot any time (e.g. once a month) to start tracking net worth growth over time.
        </EmptyState>
      )}

      <SectionTitle>Net worth composition</SectionTitle>
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <div className="h-[240px] sm:h-[260px]">
            {pieData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="85%" paddingAngle={2}>
                    {pieData.map((d) => (
                      <Cell key={d.name} fill={categoryColor(d.name)} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => fmtINR(v)} />
                  <Legend wrapperStyle={{ fontFamily: 'var(--font-plex-sans)', fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState title="No assets yet">Add a holding or asset to see the mix.</EmptyState>
            )}
          </div>
        </Card>
        <Card padded={false} className="p-2 overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th className="num">Value</th>
                <th className="num">Share</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(totals).length ? (
                Object.entries(totals)
                  .sort((a, b) => b[1] - a[1])
                  .map(([cat, val]) => (
                    <tr key={cat}>
                      <td>
                        <span className="inline-block w-[9px] h-[9px] rounded-sm mr-2" style={{ background: categoryColor(cat) }} />
                        {cat}
                      </td>
                      <td className="num">
                        <Amount>{fmtINR(val)}</Amount>
                      </td>
                      <td className="num">{nw ? ((val / nw) * 100).toFixed(1) : '0.0'}%</td>
                    </tr>
                  ))
              ) : (
                <tr>
                  <td colSpan={3} className="text-center text-inkMuted">
                    No assets added yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>

      <SectionTitle
        action={
          <Btn variant="secondary" onClick={() => setModalOpen(true)}>
            <IconPlus /> Add asset
          </Btn>
        }
      >
        Cash, FD & other non-market assets
      </SectionTitle>
      <p className="text-inkMuted text-xs -mt-2 mb-3">
        Editing the amount records today as a new monthly entry automatically — tap a name to see or edit past months.
      </p>
      {state.otherAssets.length ? (
        <Card padded={false} className="p-2 overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Category</th>
                <th className="num">Amount</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {state.otherAssets.map((a) => (
                <tr key={a.id}>
                  <td>
                    <button className="text-left hover:underline" onClick={() => setHistoryFor(a.id)} title="View monthly history">
                      {a.name}
                    </button>
                  </td>
                  <td>
                    <Tag>{a.category}</Tag>
                  </td>
                  <td className="num">
                    <EditableNumber value={a.amount} onCommit={(val) => updateOtherAsset(a.id, val)} className={`${inputClass} w-[100px] sm:w-[120px] text-right`} />
                  </td>
                  <td>
                    <IconBtn onClick={() => deleteOtherAsset(a.id)}>
                      <IconTrash />
                    </IconBtn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : (
        <EmptyState title="No cash or other assets logged">Add your bank balance, FDs, or anything else outside holdings.</EmptyState>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add a net worth item">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <Field label="Category">
            <select className={inputClass} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {categoryOptions.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Name">
            <input className={inputClass} placeholder="e.g. Emergency Fund" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
        </div>
        <Field label="Amount">
          <input type="number" step="0.01" className={inputClass} placeholder="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        </Field>
        <ModalActions>
          <Btn variant="secondary" onClick={() => setModalOpen(false)}>
            Cancel
          </Btn>
          <Btn onClick={submit}>Save</Btn>
        </ModalActions>
      </Modal>

      <Modal open={!!historyFor} onClose={() => setHistoryFor(null)} title={`Monthly history — ${historyAsset?.name || ''}`}>
        {historyAsset && (
          <>
            {historyChartData.length > 1 && (
              <div className="h-[140px] mb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={historyChartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" fontSize={10} />
                    <YAxis tickFormatter={(v) => '₹' + v} fontSize={10} width={50} />
                    <Tooltip formatter={(v) => fmtINR(v)} />
                    <Line type="monotone" dataKey="value" stroke="#276B47" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th className="num">Amount</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {[...historyAsset.history]
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map((h) => (
                    <tr key={h.id}>
                      <td>
                        <input
                          type="date"
                          defaultValue={h.date}
                          className={`${inputClass} w-[140px]`}
                          onBlur={(e) => {
                            if (e.target.value && e.target.value !== h.date) updateAssetSnapshot(historyAsset.id, h.id, e.target.value, h.amount);
                          }}
                        />
                      </td>
                      <td className="num">
                        <EditableNumber
                          value={h.amount}
                          onCommit={(val) => updateAssetSnapshot(historyAsset.id, h.id, h.date, val)}
                          className={`${inputClass} w-[110px] text-right`}
                        />
                      </td>
                      <td>
                        <IconBtn onClick={() => deleteAssetSnapshot(historyAsset.id, h.id)}>
                          <IconTrash />
                        </IconBtn>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
            <div className="mt-3">
              <Btn
                variant="secondary"
                onClick={() => {
                  const date = prompt('Date for this entry (YYYY-MM-DD)?', todayStr());
                  if (!date) return;
                  const amount = prompt('Amount for this date?', String(historyAsset.amount));
                  if (amount === null) return;
                  addAssetSnapshot(historyAsset.id, date, amount);
                }}
              >
                <IconPlus /> Add a past month
              </Btn>
            </div>
          </>
        )}
        <ModalActions>
          <Btn variant="secondary" onClick={() => setHistoryFor(null)}>
            Close
          </Btn>
        </ModalActions>
      </Modal>
    </>
  );
}
