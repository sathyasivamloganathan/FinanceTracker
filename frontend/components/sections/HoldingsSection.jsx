'use client';

import { useState } from 'react';
import { useFinance } from '@/lib/FinanceContext';
import { Card, Tag, EmptyState, Btn, IconBtn, Field, inputClass } from '@/components/ui';
import { Amount } from '@/lib/PrivacyContext';
import Modal, { ModalActions } from '@/components/Modal';
import EditableNumber from '@/components/EditableNumber';
import { IconPlus, IconTrash, IconRefresh, IconDownload } from '@/components/Icons';
import { holdingInvestedValue, holdingCurrentValue, fmtINR, fmtNum, fmtPct, todayStr } from '@/lib/utils';
import { HOLDING_TYPES, API_BASE } from '@/lib/constants';

const SYNC_BADGE = {
  ok: { cls: 'bg-emeraldBg text-emerald', label: 'Synced' },
  failed: { cls: 'bg-clayBg text-clay', label: 'Sync failed' },
  pending: { cls: 'bg-warnBg text-warn', label: 'Not synced yet' },
  'no-symbol': { cls: 'bg-[#EDEEF0] text-inkMuted', label: 'Manual' },
};

export default function HoldingsSection() {
  const { state, ready, addTransaction, updateHoldingRate, updateHolding, deleteHolding, syncHoldingNow } = useFinance();
  const [modalOpen, setModalOpen] = useState(false);
  const [historyFor, setHistoryFor] = useState(null);
  const [editSymbolFor, setEditSymbolFor] = useState(null);
  const [syncingId, setSyncingId] = useState(null);
  const [form, setForm] = useState({ name: '', symbol: '', assetType: 'Stock', qty: '', price: '', date: todayStr() });

  if (!ready || !state) return null;

  function submit() {
    const name = form.name.trim();
    const qty = Number(form.qty) || 0;
    const price = Number(form.price) || 0;
    if (!name) return alert('Enter a name');
    if (qty <= 0 || price <= 0) return alert('Enter quantity and the price you paid');
    addTransaction({
      date: form.date || todayStr(),
      type: 'Buy',
      assetType: form.assetType,
      name,
      symbol: form.symbol.trim(),
      qty,
      price,
      amount: qty * price,
      notes: '',
    });
    setForm({ name: '', symbol: '', assetType: 'Stock', qty: '', price: '', date: todayStr() });
    setModalOpen(false);
  }

  async function syncNow(id) {
    setSyncingId(id);
    try {
      await syncHoldingNow(id);
    } catch (e) {
      alert(e.message);
    } finally {
      setSyncingId(null);
    }
  }

  const historyRows = historyFor
    ? state.transactions
        .filter((t) => t.name.toLowerCase() === historyFor.name.toLowerCase() && t.assetType === historyFor.assetType)
        .sort((a, b) => b.date.localeCompare(a.date))
    : [];

  return (
    <>
      <p className="text-inkMuted text-[13.5px] max-w-xl mb-5">
        For stocks, paste whatever symbol Google shows under the name — e.g. <b>NSE:GOLDBEES</b> or just <b>DATAPATTNS</b> — no
        need to convert the format yourself. For mutual funds, you often don't need a symbol at all: leave it blank and it's
        matched by the fund's name automatically. Rates refresh once a day. Leave auto-sync off (or the symbol blank) to manage a
        rate by hand instead.
      </p>

      <div className="flex justify-end mb-3">
        <a href={`${API_BASE}/api/export/holdings.csv`} className="inline-flex">
          <Btn variant="secondary">
            <IconDownload /> Export holdings CSV
          </Btn>
        </a>
      </div>

      {state.holdings.length ? (
        <Card padded={false} className="p-2 overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Instrument</th>
                <th>Type</th>
                <th className="num">Qty</th>
                <th className="num">Avg Rate</th>
                <th className="num">Current Rate</th>
                <th>Sync</th>
                <th className="num">Invested</th>
                <th className="num">Current Value</th>
                <th className="num">P/L</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {state.holdings.map((h) => {
                const inv = holdingInvestedValue(h);
                const cur = holdingCurrentValue(h);
                const pl = cur - inv;
                const plPct = inv ? (pl / inv) * 100 : 0;
                const badge = SYNC_BADGE[h.symbol ? h.lastSyncStatus : 'no-symbol'] || SYNC_BADGE.pending;
                return (
                  <tr key={h.id}>
                    <td>
                      <button className="text-left hover:underline" onClick={() => setHistoryFor(h)} title="View purchase history">
                        <b>{h.name}</b>
                      </button>
                      <div className="text-inkMuted text-xs">
                        <button className="hover:underline" onClick={() => setEditSymbolFor(h)}>
                          {h.symbol || 'add symbol'}
                        </button>{' '}
                        · Updated {h.updatedAt || '—'}
                      </div>
                    </td>
                    <td>
                      <Tag tone={h.assetType === 'Stock' ? 'stock' : h.assetType === 'Gold' ? 'gold' : 'mf'}>{h.assetType}</Tag>
                    </td>
                    <td className="num">{fmtNum(h.qty)}</td>
                    <td className="num">
                      <Amount>{fmtINR(h.avgRate, 2)}</Amount>
                    </td>
                    <td className="num">
                      <EditableNumber
                        value={h.currentRate}
                        onCommit={(val) => updateHoldingRate(h.id, val)}
                        className={`${inputClass} w-[90px] sm:w-[100px] text-right`}
                      />
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <span className={`font-mono text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap ${badge.cls}`}>{badge.label}</span>
                        {h.symbol && (
                          <IconBtn danger={false} onClick={() => syncNow(h.id)} title="Sync now">
                            <IconRefresh spinning={syncingId === h.id} />
                          </IconBtn>
                        )}
                      </div>
                      {h.lastSyncStatus === 'failed' && h.lastSyncMessage && (
                        <div className="text-clay text-[10px] mt-0.5 max-w-[130px]">{h.lastSyncMessage}</div>
                      )}
                    </td>
                    <td className="num">
                      <Amount>{fmtINR(inv)}</Amount>
                    </td>
                    <td className="num">
                      <Amount>{fmtINR(cur)}</Amount>
                    </td>
                    <td className={`num ${pl >= 0 ? 'text-emerald' : 'text-clay'}`}>
                      <Amount>{fmtINR(pl)}</Amount>
                      <div className="text-inkMuted text-xs">{fmtPct(plPct)}</div>
                    </td>
                    <td>
                      <IconBtn onClick={() => deleteHolding(h.id)} title="Delete holding">
                        <IconTrash />
                      </IconBtn>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      ) : (
        <EmptyState title="No holdings yet">Log a purchase to start tracking a stock, mutual fund, or gold holding.</EmptyState>
      )}

      <div className="mt-4">
        <Btn onClick={() => setModalOpen(true)}>
          <IconPlus /> Log a purchase
        </Btn>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Log a purchase">
        <p className="text-[12px] text-inkMuted mb-3">
          Buying more of something you already hold? Use the same name and type — it merges into the existing holding with a
          weighted-average rate instead of creating a duplicate row.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <Field label="Instrument name">
            <input
              className={inputClass}
              placeholder="e.g. HDFC Bank"
              list="holding-names"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <datalist id="holding-names">
              {[...new Set(state.holdings.map((h) => h.name))].map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </Field>
          <Field label="Type">
            <select className={inputClass} value={form.assetType} onChange={(e) => setForm({ ...form, assetType: e.target.value })}>
              {HOLDING_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field
          label="Symbol (optional, enables auto-sync)"
          hint={
            form.assetType === 'Mutual Fund'
              ? 'Usually leave this blank — matched by the fund name automatically. Or type the exact AMFI scheme code (a plain number) if you know it.'
              : form.assetType === 'Stock'
              ? 'Paste exactly what Google shows under the name, e.g. "NSE:GOLDBEES" or "DATAPATTNS" — it gets converted automatically.'
              : 'Gold has no free auto-sync source — leave blank and update the rate by hand.'
          }
        >
          <input className={inputClass} placeholder="e.g. NSE:GOLDBEES" value={form.symbol} onChange={(e) => setForm({ ...form, symbol: e.target.value })} />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
          <Field label="Date">
            <input type="date" className={inputClass} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </Field>
          <Field label="Quantity bought">
            <input type="number" step="0.0001" className={inputClass} placeholder="0" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} />
          </Field>
          <Field label="Price you paid">
            <input type="number" step="0.01" className={inputClass} placeholder="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
          </Field>
        </div>
        <ModalActions>
          <Btn variant="secondary" onClick={() => setModalOpen(false)}>
            Cancel
          </Btn>
          <Btn onClick={submit}>Save purchase</Btn>
        </ModalActions>
      </Modal>

      <Modal open={!!historyFor} onClose={() => setHistoryFor(null)} title={`Purchase history — ${historyFor?.name || ''}`}>
        {historyRows.length ? (
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th className="num">Qty</th>
                <th className="num">Rate</th>
                <th className="num">Amount</th>
              </tr>
            </thead>
            <tbody>
              {historyRows.map((t) => (
                <tr key={t.id}>
                  <td className="mono">{t.date}</td>
                  <td>
                    <Tag tone={t.type === 'Buy' ? 'buy' : 'sell'}>{t.type}</Tag>
                  </td>
                  <td className="num">{t.qty}</td>
                  <td className="num">
                    <Amount>{fmtINR(t.price, 2)}</Amount>
                  </td>
                  <td className="num">
                    <Amount>{fmtINR(t.amount)}</Amount>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-inkMuted text-[13px]">No purchases logged for this holding yet.</p>
        )}
        <ModalActions>
          <Btn variant="secondary" onClick={() => setHistoryFor(null)}>
            Close
          </Btn>
        </ModalActions>
      </Modal>

      <Modal open={!!editSymbolFor} onClose={() => setEditSymbolFor(null)} title={`Symbol for ${editSymbolFor?.name || ''}`}>
        <Field
          label="Symbol"
          hint={
            editSymbolFor?.assetType === 'Mutual Fund'
              ? 'Leave blank to match by fund name automatically, or enter an exact AMFI scheme code.'
              : editSymbolFor?.assetType === 'Stock'
              ? 'Paste what Google shows under the name, e.g. "NSE:GOLDBEES" or "DATAPATTNS".'
              : 'Gold has no auto-sync source.'
          }
        >
          <input className={inputClass} defaultValue={editSymbolFor?.symbol} id="edit-symbol-input" />
        </Field>
        <ModalActions>
          <Btn variant="secondary" onClick={() => setEditSymbolFor(null)}>
            Cancel
          </Btn>
          <Btn
            onClick={() => {
              const symbol = document.getElementById('edit-symbol-input').value;
              updateHolding(editSymbolFor.id, { symbol });
              setEditSymbolFor(null);
            }}
          >
            Save
          </Btn>
        </ModalActions>
      </Modal>
    </>
  );
}
