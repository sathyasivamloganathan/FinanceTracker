'use client';

import { useState, useMemo } from 'react';
import { useFinance } from '@/lib/FinanceContext';
import { Card, Tag, EmptyState, Btn, IconBtn, Field, inputClass } from '@/components/ui';
import { Amount } from '@/lib/PrivacyContext';
import Modal, { ModalActions } from '@/components/Modal';
import { IconPlus, IconTrash, IconEdit, IconDownload } from '@/components/Icons';
import { fmtINR, todayStr, monthKey, monthLabel, shiftMonthKey } from '@/lib/utils';
import { HOLDING_TYPES, API_BASE } from '@/lib/constants';

export default function TransactionsSection() {
  const { state, ready, addTransaction, updateTransaction, deleteTransaction } = useFinance();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [form, setForm] = useState({
    date: todayStr(),
    type: 'Buy',
    assetType: 'Stock',
    name: '',
    symbol: '',
    qty: '',
    price: '',
    amount: '',
    notes: '',
  });

  const availableMonths = useMemo(() => {
    if (!state) return [];
    return [...new Set(state.transactions.map((t) => t.date.slice(0, 7)))].sort((a, b) => b.localeCompare(a));
  }, [state]);

  if (!ready || !state) return null;

  const rows = [...state.transactions]
    .filter((t) => selectedMonth === 'all' || t.date.slice(0, 7) === selectedMonth)
    .sort((a, b) => b.date.localeCompare(a.date));
  const knownNames = [...new Set(state.holdings.map((h) => h.name))];

  function onQtyOrPriceChange(next) {
    const q = Number(next.qty) || 0;
    const p = Number(next.price) || 0;
    setForm({ ...next, amount: q && p ? String((q * p).toFixed(2)) : next.amount });
  }

  function openAdd() {
    setEditingId(null);
    setForm({ date: todayStr(), type: 'Buy', assetType: 'Stock', name: '', symbol: '', qty: '', price: '', amount: '', notes: '' });
    setModalOpen(true);
  }
  function openEdit(t) {
    setEditingId(t.id);
    setForm({ date: t.date, type: t.type, assetType: t.assetType, name: t.name, symbol: t.symbol || '', qty: String(t.qty), price: String(t.price), amount: String(t.amount), notes: t.notes || '' });
    setModalOpen(true);
  }

  function submit() {
    const qty = Number(form.qty) || 0;
    const price = Number(form.price) || 0;
    if (qty <= 0 || price <= 0) return alert('Enter quantity and price');
    const amount = Number(form.amount) || qty * price;

    if (editingId) {
      updateTransaction(editingId, { date: form.date, qty, price, amount, notes: form.notes.trim() });
      setModalOpen(false);
      return;
    }

    const name = form.name.trim();
    if (!name) return alert('Enter an instrument name');
    addTransaction({
      date: form.date || todayStr(),
      type: form.type,
      assetType: form.assetType,
      name,
      symbol: form.symbol.trim(),
      qty,
      price,
      amount,
      notes: form.notes.trim(),
    });
    setModalOpen(false);
  }

  return (
    <>
      <p className="text-inkMuted text-[13.5px] max-w-xl mb-4">
        Every buy or sell you log here updates the matching holding&apos;s quantity and average rate automatically — this is your
        source-of-truth purchase snapshot, and it feeds directly into the consolidated view under Wealth → Holdings.
      </p>

      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <select className={`${inputClass} w-auto`} value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
          <option value="all">All months</option>
          {availableMonths.map((mk) => (
            <option key={mk} value={mk}>
              {monthLabel(mk)}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          <a href={`${API_BASE}/api/export/transactions.csv`}>
            <Btn variant="secondary">
              <IconDownload /> CSV
            </Btn>
          </a>
          <Btn onClick={openAdd}>
            <IconPlus /> Log transaction
          </Btn>
        </div>
      </div>

      {rows.length ? (
        <Card padded={false} className="p-2 overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Instrument</th>
                <th>Category</th>
                <th className="num">Qty</th>
                <th className="num">Rate</th>
                <th className="num">Amount</th>
                <th>Notes</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id}>
                  <td className="mono">{t.date}</td>
                  <td>
                    <Tag tone={t.type === 'Buy' ? 'buy' : 'sell'}>{t.type}</Tag>
                  </td>
                  <td>
                    <b>{t.name}</b>
                  </td>
                  <td>
                    <Tag tone={t.assetType === 'Stock' ? 'stock' : t.assetType === 'Gold' ? 'gold' : 'mf'}>{t.assetType}</Tag>
                  </td>
                  <td className="num">{t.qty}</td>
                  <td className="num">
                    <Amount>{fmtINR(t.price, 2)}</Amount>
                  </td>
                  <td className="num">
                    <Amount>{fmtINR(t.amount)}</Amount>
                  </td>
                  <td className="max-w-[160px] text-inkMuted text-xs">{t.notes}</td>
                  <td>
                    <div className="flex items-center">
                      <IconBtn danger={false} onClick={() => openEdit(t)} title="Edit">
                        <IconEdit />
                      </IconBtn>
                      <IconBtn onClick={() => deleteTransaction(t.id)} title="Delete">
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
        <EmptyState title="Nothing here yet">
          {selectedMonth === 'all' ? 'Log your first buy to start building your holdings automatically.' : `No transactions in ${monthLabel(selectedMonth)}.`}
        </EmptyState>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? `Edit — ${form.name}` : 'Log a transaction'}>
        {editingId ? (
          <p className="text-[12px] text-inkMuted mb-3">
            Instrument, type, and buy/sell can&apos;t be changed here (that would break the holding it's linked to) — delete and
            re-add if you need to change those. You can fix the date, quantity, price, amount, and notes.
          </p>
        ) : null}
        {!editingId && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
            <Field label="Date">
              <input type="date" className={inputClass} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </Field>
            <Field label="Type">
              <select className={inputClass} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option>Buy</option>
                <option>Sell</option>
              </select>
            </Field>
            <Field label="Instrument type">
              <select className={inputClass} value={form.assetType} onChange={(e) => setForm({ ...form, assetType: e.target.value })}>
                {HOLDING_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Field>
          </div>
        )}
        {!editingId && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Instrument name">
              <input
                list="tx-names"
                className={inputClass}
                placeholder="e.g. Nippon India Small Cap Fund"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <datalist id="tx-names">
                {knownNames.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
            </Field>
            <Field label="Symbol (optional)" hint="Stocks: paste what Google shows, e.g. NSE:GOLDBEES. Mutual funds: usually fine to leave blank.">
              <input className={inputClass} placeholder="e.g. NSE:GOLDBEES" value={form.symbol} onChange={(e) => setForm({ ...form, symbol: e.target.value })} />
            </Field>
          </div>
        )}
        {editingId && (
          <div className="flex gap-2 mb-3">
            <Tag tone={form.type === 'Buy' ? 'buy' : 'sell'}>{form.type}</Tag>
            <Tag tone={form.assetType === 'Stock' ? 'stock' : form.assetType === 'Gold' ? 'gold' : 'mf'}>{form.assetType}</Tag>
          </div>
        )}
        {editingId && (
          <Field label="Date">
            <input type="date" className={inputClass} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </Field>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
          <Field label="Quantity / units">
            <input
              type="number"
              step="0.0001"
              className={inputClass}
              placeholder="0"
              value={form.qty}
              onChange={(e) => onQtyOrPriceChange({ ...form, qty: e.target.value })}
            />
          </Field>
          <Field label="Price / NAV per unit">
            <input
              type="number"
              step="0.01"
              className={inputClass}
              placeholder="0"
              value={form.price}
              onChange={(e) => onQtyOrPriceChange({ ...form, price: e.target.value })}
            />
          </Field>
          <Field label="Amount">
            <input type="number" step="0.01" className={inputClass} placeholder="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </Field>
        </div>
        <Field label="Notes (optional)">
          <input className={inputClass} placeholder="Brokerage, reason, SIP no. etc." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </Field>
        <ModalActions>
          <Btn variant="secondary" onClick={() => setModalOpen(false)}>
            Cancel
          </Btn>
          <Btn onClick={submit}>{editingId ? 'Save changes' : 'Save transaction'}</Btn>
        </ModalActions>
      </Modal>
    </>
  );
}
