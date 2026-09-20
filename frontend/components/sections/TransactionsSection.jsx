'use client';

import { useState, useMemo } from 'react';
import SectionLoader from '@/components/SectionLoader';
import { useFinance } from '@/lib/FinanceContext';
import { Card, Tag, EmptyState, Btn, IconBtn, Field, inputClass, StatCard, SectionTitle } from '@/components/ui';
import { Amount } from '@/lib/PrivacyContext';
import Modal, { ModalActions } from '@/components/Modal';
import { IconPlus, IconTrash, IconEdit, IconDownload } from '@/components/Icons';
import { fmtINR, todayStr, monthKey, monthLabel, shiftMonthKey, confirmDelete } from '@/lib/utils';
import { HOLDING_TYPES, API_BASE } from '@/lib/constants';

const PAGE_SIZE = 10;

export default function TransactionsSection() {
  const { state, ready, addTransaction, updateTransaction, deleteTransaction } = useFinance();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterAsset, setFilterAsset] = useState('all');
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({
    date: todayStr(), type: 'Buy', assetType: 'Stock',
    name: '', symbol: '', qty: '', price: '', amount: '', notes: '',
  });

  const availableMonths = useMemo(() => {
    if (!state) return [];
    return [...new Set(state.transactions.map(t => t.date.slice(0, 7)))].sort((a, b) => b.localeCompare(a));
  }, [state]);

  if (!ready || !state) return <SectionLoader />;

  const allFiltered = [...state.transactions]
    .filter(t => selectedMonth === 'all' || t.date.slice(0, 7) === selectedMonth)
    .filter(t => filterType === 'all' || t.type === filterType)
    .filter(t => filterAsset === 'all' || t.assetType === filterAsset)
    .sort((a, b) => b.date.localeCompare(a.date));

  const totalPages = Math.max(1, Math.ceil(allFiltered.length / PAGE_SIZE));
  const rows = allFiltered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Reset to page 1 when filters change
  function applyFilter(setter, val) { setter(val); setPage(1); }

  // Month totals (buy only)
  const buyRows = allFiltered.filter(t => t.type === 'Buy');
  const totalBuy    = buyRows.reduce((s, t) => s + Number(t.amount || 0), 0);
  const stockTotal  = buyRows.filter(t => t.assetType === 'Stock').reduce((s, t) => s + Number(t.amount || 0), 0);
  const mfTotal     = buyRows.filter(t => t.assetType === 'Mutual Fund').reduce((s, t) => s + Number(t.amount || 0), 0);
  const goldTotal   = buyRows.filter(t => t.assetType === 'Gold').reduce((s, t) => s + Number(t.amount || 0), 0);

  const knownNames = [...new Set(state.holdings.map(h => h.name))];

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
    } else {
      const name = form.name.trim();
      if (!name) return alert('Enter an instrument name');
      addTransaction({ date: form.date || todayStr(), type: form.type, assetType: form.assetType, name, symbol: form.symbol.trim(), qty, price, amount, notes: form.notes.trim() });
    }
    setModalOpen(false);
  }

  return (
    <>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <select className={`${inputClass} w-auto`} value={selectedMonth} onChange={e => applyFilter(setSelectedMonth, e.target.value)}>
            <option value="all">All months</option>
            {availableMonths.map(mk => <option key={mk} value={mk}>{monthLabel(mk)}</option>)}
          </select>
          <select className={`${inputClass} w-auto`} value={filterType} onChange={e => applyFilter(setFilterType, e.target.value)}>
            <option value="all">Buy & Sell</option>
            <option value="Buy">Buy only</option>
            <option value="Sell">Sell only</option>
          </select>
          <select className={`${inputClass} w-auto`} value={filterAsset} onChange={e => applyFilter(setFilterAsset, e.target.value)}>
            <option value="all">All types</option>
            <option value="Stock">Stocks</option>
            <option value="Mutual Fund">Mutual Funds</option>
            <option value="Gold">Gold</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <a href={`${API_BASE}/api/export/transactions.csv`}><Btn variant="secondary"><IconDownload /> CSV</Btn></a>
          <Btn onClick={openAdd}><IconPlus /> Log transaction</Btn>
        </div>
      </div>

      {/* Month investment totals */}
      {buyRows.length > 0 && (
        <>
          <SectionTitle>
            {selectedMonth === 'all' ? 'All-time invested (buys only)' : `Invested in ${monthLabel(selectedMonth)}`}
          </SectionTitle>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <StatCard label="Total invested" value={<Amount>{fmtINR(totalBuy)}</Amount>} />
            <StatCard label="Stocks" value={<Amount>{fmtINR(stockTotal)}</Amount>} />
            <StatCard label="Mutual Funds" value={<Amount>{fmtINR(mfTotal)}</Amount>} />
            <StatCard label="Gold" value={<Amount>{fmtINR(goldTotal)}</Amount>} />
          </div>
        </>
      )}

      {/* Result count */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-inkMuted dark:text-gray-400 text-[12.5px]">
          {allFiltered.length} transaction{allFiltered.length !== 1 ? 's' : ''}
          {totalPages > 1 && ` — page ${page} of ${totalPages}`}
        </span>
      </div>

      {rows.length ? (
        <Card padded={false} className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Date</th><th>Type</th><th>Instrument</th><th>Category</th>
                <th className="num">Qty</th><th className="num">Rate</th><th className="num">Amount</th>
                <th>Notes</th><th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(t => (
                <tr key={t.id}>
                  <td className="mono dark:text-gray-300 whitespace-nowrap">{t.date}</td>
                  <td><Tag tone={t.type === 'Buy' ? 'buy' : 'sell'}>{t.type}</Tag></td>
                  <td><b className="dark:text-gray-100">{t.name}</b></td>
                  <td><Tag tone={t.assetType === 'Stock' ? 'stock' : t.assetType === 'Gold' ? 'gold' : 'mf'}>{t.assetType}</Tag></td>
                  <td className="num dark:text-gray-300">{t.qty}</td>
                  <td className="num"><Amount>{fmtINR(t.price, 2)}</Amount></td>
                  <td className="num"><Amount>{fmtINR(t.amount)}</Amount></td>
                  <td className="max-w-[140px] text-inkMuted dark:text-gray-500 text-xs">{t.notes}</td>
                  <td>
                    <div className="flex items-center">
                      <IconBtn danger={false} onClick={() => openEdit(t)} title="Edit"><IconEdit /></IconBtn>
                      <IconBtn onClick={() => confirmDelete('Delete this transaction?') && deleteTransaction(t.id)} title="Delete"><IconTrash /></IconBtn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : (
        <EmptyState title="Nothing here yet">
          {selectedMonth === 'all' ? 'Log your first buy to start building your holdings.' : `No transactions in ${monthLabel(selectedMonth)}.`}
        </EmptyState>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <Btn variant="secondary" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>‹ Prev</Btn>
          <div className="flex gap-1">
            {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
              let pg = i + 1;
              if (totalPages > 7) {
                if (page <= 4) pg = i + 1;
                else if (page >= totalPages - 3) pg = totalPages - 6 + i;
                else pg = page - 3 + i;
              }
              return (
                <button key={pg} onClick={() => setPage(pg)}
                  className={`w-8 h-8 rounded-md text-[12px] font-medium border transition-colors ${pg === page ? 'bg-ink text-white border-ink dark:bg-gray-700 dark:border-gray-600' : 'border-line dark:border-gray-600 text-inkMuted dark:text-gray-400 hover:border-ink dark:hover:border-gray-400'}`}>
                  {pg}
                </button>
              );
            })}
          </div>
          <Btn variant="secondary" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next ›</Btn>
        </div>
      )}

      {/* Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? `Edit — ${form.name}` : 'Log a transaction'}>
        {editingId && (
          <p className="text-[12px] text-inkMuted mb-3">Instrument, type, and asset class can't be changed — delete and re-add if needed.</p>
        )}
        {!editingId && (
          <>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <Field label="Date"><input type="date" className={inputClass} value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></Field>
              <Field label="Type"><select className={inputClass} value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}><option>Buy</option><option>Sell</option></select></Field>
              <Field label="Asset type"><select className={inputClass} value={form.assetType} onChange={e => setForm({ ...form, assetType: e.target.value })}>{HOLDING_TYPES.map(t => <option key={t}>{t}</option>)}</select></Field>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <Field label="Instrument name">
                <input list="tx-names" className={inputClass} placeholder="e.g. Nippon India Small Cap" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                <datalist id="tx-names">{knownNames.map(n => <option key={n} value={n} />)}</datalist>
              </Field>
              <Field label="Symbol (optional)" hint="e.g. NSE:GOLDBEES">
                <input className={inputClass} placeholder="e.g. NSE:GOLDBEES" value={form.symbol} onChange={e => setForm({ ...form, symbol: e.target.value })} />
              </Field>
            </div>
          </>
        )}
        {editingId && (
          <div className="flex gap-2 mb-3">
            <Tag tone={form.type === 'Buy' ? 'buy' : 'sell'}>{form.type}</Tag>
            <Tag tone={form.assetType === 'Stock' ? 'stock' : form.assetType === 'Gold' ? 'gold' : 'mf'}>{form.assetType}</Tag>
            <Field label="Date"><input type="date" className={inputClass} value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></Field>
          </div>
        )}
        <div className="grid grid-cols-3 gap-3 mt-2">
          <Field label="Qty / units"><input type="number" step="0.0001" className={inputClass} placeholder="0" value={form.qty} onChange={e => onQtyOrPriceChange({ ...form, qty: e.target.value })} /></Field>
          <Field label="Price / NAV"><input type="number" step="0.01" className={inputClass} placeholder="0" value={form.price} onChange={e => onQtyOrPriceChange({ ...form, price: e.target.value })} /></Field>
          <Field label="Amount"><input type="number" step="0.01" className={inputClass} placeholder="0" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></Field>
        </div>
        <Field label="Notes (optional)">
          <input className={inputClass} placeholder="Brokerage, SIP number, reason…" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
        </Field>
        <ModalActions>
          <Btn variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Btn>
          <Btn onClick={submit}>{editingId ? 'Save changes' : 'Save transaction'}</Btn>
        </ModalActions>
      </Modal>
    </>
  );
}
