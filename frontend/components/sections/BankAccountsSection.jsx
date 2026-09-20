'use client';

import { useState } from 'react';
import SectionLoader from '@/components/SectionLoader';
import { useFinance } from '@/lib/FinanceContext';
import { Card, SectionTitle, StatCard, Btn, IconBtn, Field, inputClass, EmptyState, Tag } from '@/components/ui';
import { Amount } from '@/lib/PrivacyContext';
import Modal, { ModalActions } from '@/components/Modal';
import { IconPlus, IconTrash, IconEdit } from '@/components/Icons';
import { fmtINR, todayStr, confirmDelete, monthKey, monthLabel } from '@/lib/utils';
import { BANK_ACCOUNT_TYPES } from '@/lib/constants';

const ACCOUNT_COLORS = ['#2563EB','#059669','#7C3AED','#C2410C','#0891B2','#BE185D','#D97706','#16A34A'];

const TYPE_LABEL = { expense: 'Expense', income: 'Income', transfer: 'Transfer', atm_withdrawal: 'ATM' };
const TYPE_TONE  = { expense: 'sell', income: 'buy', transfer: 'mf', atm_withdrawal: 'gold' };

export default function BankAccountsSection() {
  const { state, ready, addBankAccount, updateBankAccount, deleteBankAccount, transferBetweenAccounts, addExpense } = useFinance();
  const [modalOpen, setModalOpen]     = useState(false);
  const [editingId, setEditingId]     = useState(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [atmOpen, setAtmOpen]         = useState(false);
  const [incomeOpen, setIncomeOpen]   = useState(false);
  const [selectedAcct, setSelectedAcct] = useState(null); // for history drill-down
  const [form, setForm]               = useState({ name: '', type: 'Savings', balance: '', color: ACCOUNT_COLORS[0], notes: '' });
  const [txForm, setTxForm]           = useState({ fromId: '', toId: '', amount: '', date: todayStr(), notes: '' });
  const [atmForm, setAtmForm]         = useState({ fromId: '', amount: '', date: todayStr(), notes: '' });
  const [incForm, setIncForm]         = useState({ toId: '', amount: '', date: todayStr(), description: '' });

  if (!ready || !state) return <SectionLoader />;

  const accounts    = state.bankAccounts || [];
  const allExpenses = state.expenses     || [];
  const thisMonth   = monthKey(new Date());
  const totalBalance = accounts.reduce((s, a) => s + Number(a.balance || 0), 0);

  function accountHistory(accountId) {
    return allExpenses
      .filter(e => e.accountId === accountId)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 50);
  }

  function accountSpend(accountId) {
    return allExpenses
      .filter(e => e.accountId === accountId && e.date.slice(0, 7) === thisMonth && (e.expenseType === 'expense' || !e.expenseType))
      .reduce((s, e) => s + Number(e.amount || 0), 0);
  }

  function openAdd() {
    setEditingId(null);
    setForm({ name: '', type: 'Savings', balance: '', color: ACCOUNT_COLORS[accounts.length % ACCOUNT_COLORS.length], notes: '' });
    setModalOpen(true);
  }
  function openEdit(a) {
    setEditingId(a.id);
    setForm({ name: a.name, type: a.type, balance: String(a.balance), color: a.color, notes: a.notes || '' });
    setModalOpen(true);
  }

  function submit() {
    if (!form.name.trim()) return alert('Enter account name');
    if (editingId) updateBankAccount(editingId, { name: form.name.trim(), type: form.type, balance: Number(form.balance) || 0, color: form.color, notes: form.notes.trim() });
    else addBankAccount({ name: form.name.trim(), type: form.type, balance: Number(form.balance) || 0, color: form.color, notes: form.notes.trim() });
    setModalOpen(false);
  }

  function submitTransfer() {
    const amt = Number(txForm.amount);
    if (!txForm.fromId) return alert('Select source account');
    if (!txForm.toId)   return alert('Select destination account');
    if (txForm.fromId === txForm.toId) return alert('Source and destination must differ');
    if (!(amt > 0)) return alert('Enter a valid amount');
    transferBetweenAccounts({ fromId: txForm.fromId, toId: txForm.toId, amount: amt, date: txForm.date, notes: txForm.notes });
    setTransferOpen(false);
    setTxForm({ fromId: '', toId: '', amount: '', date: todayStr(), notes: '' });
  }

  function submitAtm() {
    const amt = Number(atmForm.amount);
    if (!atmForm.fromId) return alert('Select account');
    if (!(amt > 0)) return alert('Enter a valid amount');
    transferBetweenAccounts({ fromId: atmForm.fromId, toId: null, amount: amt, date: atmForm.date, notes: atmForm.notes || 'ATM Withdrawal' });
    setAtmOpen(false);
    setAtmForm({ fromId: '', amount: '', date: todayStr(), notes: '' });
  }

  function submitIncome() {
    const amt = Number(incForm.amount);
    if (!incForm.toId) return alert('Select account');
    if (!(amt > 0)) return alert('Enter amount');
    const acct = accounts.find(a => a.id === incForm.toId);
    updateBankAccount(incForm.toId, { balance: (acct?.balance || 0) + amt });
    addExpense({ date: incForm.date, category: 'Income', description: incForm.description || 'Income credited', amount: amt, accountId: incForm.toId, expenseType: 'income' });
    setIncomeOpen(false);
    setIncForm({ toId: '', amount: '', date: todayStr(), description: '' });
  }

  const drillHistory = selectedAcct ? accountHistory(selectedAcct.id) : [];

  return (
    <>
      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
        <StatCard label="Total across accounts" value={<Amount>{fmtINR(totalBalance)}</Amount>} />
        <StatCard label="Accounts tracked" value={String(accounts.length)} />
        <StatCard label="Spent this month" value={<Amount>{fmtINR(
          allExpenses.filter(e => e.date.slice(0, 7) === thisMonth && (e.expenseType === 'expense' || !e.expenseType)).reduce((s, e) => s + Number(e.amount || 0), 0)
        )}</Amount>} />
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 flex-wrap mb-5">
        <Btn onClick={openAdd}><IconPlus /> Add account</Btn>
        {accounts.length >= 2 && <Btn variant="secondary" onClick={() => setTransferOpen(true)}>↔ Transfer</Btn>}
        {accounts.length >= 1 && <Btn variant="secondary" onClick={() => setAtmOpen(true)}>🏧 ATM Withdrawal</Btn>}
        {accounts.length >= 1 && <Btn variant="secondary" onClick={() => setIncomeOpen(true)}>+ Credit Income</Btn>}
      </div>

      {/* Account cards */}
      {accounts.length ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {accounts.map(a => {
              const spend = accountSpend(a.id);
              return (
                <Card key={a.id} className="dark:bg-gray-800 dark:border-gray-700 cursor-pointer hover:border-accent transition-colors"
                  onClick={() => setSelectedAcct(selectedAcct?.id === a.id ? null : a)}>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: a.color }} />
                      <div>
                        <div className="font-semibold text-[14px] dark:text-gray-100">{a.name}</div>
                        <Tag>{a.type}</Tag>
                      </div>
                    </div>
                    <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                      <IconBtn danger={false} onClick={() => openEdit(a)} title="Edit"><IconEdit /></IconBtn>
                      <IconBtn onClick={() => confirmDelete(`Delete "${a.name}"?`) && deleteBankAccount(a.id)} title="Delete"><IconTrash /></IconBtn>
                    </div>
                  </div>
                  <div className="text-[24px] font-display font-semibold dark:text-gray-100">
                    <Amount>{fmtINR(a.balance)}</Amount>
                  </div>
                  <div className="text-inkMuted dark:text-gray-400 text-xs mt-1">
                    <Amount>{fmtINR(spend)}</Amount> spent this month
                  </div>
                  {a.notes && <div className="text-inkMuted dark:text-gray-500 text-xs mt-2 border-t dark:border-gray-700 pt-2">{a.notes}</div>}
                  <div className="text-inkMuted dark:text-gray-600 text-[10px] mt-1">Tap to see transaction history</div>
                </Card>
              );
            })}
          </div>

          {/* Transaction history drill-down */}
          {selectedAcct && (
            <>
              <SectionTitle action={<button onClick={() => setSelectedAcct(null)} className="text-xs text-clay hover:underline">✕ Close</button>}>
                {selectedAcct.name} — transaction history
              </SectionTitle>
              {drillHistory.length ? (
                <Card padded={false} className="overflow-x-auto mb-4">
                  <table>
                    <thead><tr><th>Date</th><th>Type</th><th>Category</th><th>Description</th><th>Notes</th><th className="num">Amount</th></tr></thead>
                    <tbody>
                      {drillHistory.map(e => {
                        const eType = e.expenseType || 'expense';
                        const isIncome = eType === 'income';
                        return (
                          <tr key={e.id}>
                            <td className="mono text-inkMuted dark:text-gray-400 whitespace-nowrap text-xs">{e.date}</td>
                            <td><Tag tone={TYPE_TONE[eType] || 'def'}>{TYPE_LABEL[eType] || eType}</Tag></td>
                            <td><Tag>{e.category}</Tag></td>
                            <td className="text-ink dark:text-gray-200 text-[12.5px] max-w-[150px]">{e.description || '—'}</td>
                            <td className="text-inkMuted dark:text-gray-500 text-xs">{e.notes || '—'}</td>
                            <td className={`num font-mono ${isIncome ? 'text-emerald' : 'text-ink dark:text-gray-100'}`}>
                              <Amount>{isIncome ? '+' : ''}{fmtINR(e.amount)}</Amount>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </Card>
              ) : (
                <EmptyState title="No transactions linked to this account">
                  Link expenses, income, transfers, or ATM withdrawals to this account to see them here.
                </EmptyState>
              )}
            </>
          )}
        </>
      ) : (
        <EmptyState title="No accounts yet">
          Add your bank accounts to track balances and link your daily spends.
        </EmptyState>
      )}

      {/* Add/Edit Account Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? 'Edit account' : 'Add bank account'}>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <Field label="Account name" hint="e.g. SBI Savings, HDFC Salary">
            <input className={inputClass} placeholder="e.g. SBI Savings" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Account type">
            <select className={inputClass} value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
              {BANK_ACCOUNT_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <Field label="Current balance">
            <input type="number" step="0.01" className={inputClass} placeholder="0" value={form.balance} onChange={e => setForm({ ...form, balance: e.target.value })} />
          </Field>
          <Field label="Colour label">
            <div className="flex gap-2 flex-wrap mt-1">
              {ACCOUNT_COLORS.map(c => (
                <button key={c} onClick={() => setForm({ ...form, color: c })}
                  className={`w-6 h-6 rounded-full border-2 transition-transform ${form.color === c ? 'border-ink dark:border-white scale-110' : 'border-transparent'}`}
                  style={{ background: c }} />
              ))}
            </div>
          </Field>
        </div>
        <Field label="Notes (optional)">
          <input className={inputClass} placeholder="e.g. Primary salary account" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
        </Field>
        <ModalActions>
          <Btn variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Btn>
          <Btn onClick={submit}>{editingId ? 'Save changes' : 'Add account'}</Btn>
        </ModalActions>
      </Modal>

      {/* Transfer Modal */}
      <Modal open={transferOpen} onClose={() => setTransferOpen(false)} title="Transfer between accounts">
        <p className="text-[12px] text-inkMuted mb-3">Moves money between accounts and logs the transfer in your history.</p>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <Field label="From account">
            <select className={inputClass} value={txForm.fromId} onChange={e => setTxForm({ ...txForm, fromId: e.target.value })}>
              <option value="">— Select —</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({fmtINR(a.balance)})</option>)}
            </select>
          </Field>
          <Field label="To account">
            <select className={inputClass} value={txForm.toId} onChange={e => setTxForm({ ...txForm, toId: e.target.value })}>
              <option value="">— Select —</option>
              {accounts.filter(a => a.id !== txForm.fromId).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <Field label="Amount"><input type="number" step="0.01" className={inputClass} placeholder="0" value={txForm.amount} onChange={e => setTxForm({ ...txForm, amount: e.target.value })} /></Field>
          <Field label="Date"><input type="date" className={inputClass} value={txForm.date} onChange={e => setTxForm({ ...txForm, date: e.target.value })} /></Field>
        </div>
        <Field label="Notes (optional)"><input className={inputClass} placeholder="Reason for transfer" value={txForm.notes} onChange={e => setTxForm({ ...txForm, notes: e.target.value })} /></Field>
        <ModalActions>
          <Btn variant="secondary" onClick={() => setTransferOpen(false)}>Cancel</Btn>
          <Btn onClick={submitTransfer}>Transfer</Btn>
        </ModalActions>
      </Modal>

      {/* ATM Modal */}
      <Modal open={atmOpen} onClose={() => setAtmOpen(false)} title="ATM Withdrawal">
        <p className="text-[12px] text-inkMuted mb-3">Deducts from account balance and logs the withdrawal.</p>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <Field label="From account">
            <select className={inputClass} value={atmForm.fromId} onChange={e => setAtmForm({ ...atmForm, fromId: e.target.value })}>
              <option value="">— Select —</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({fmtINR(a.balance)})</option>)}
            </select>
          </Field>
          <Field label="Amount withdrawn"><input type="number" step="0.01" className={inputClass} placeholder="0" value={atmForm.amount} onChange={e => setAtmForm({ ...atmForm, amount: e.target.value })} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date"><input type="date" className={inputClass} value={atmForm.date} onChange={e => setAtmForm({ ...atmForm, date: e.target.value })} /></Field>
          <Field label="Notes"><input className={inputClass} placeholder="e.g. ATM near office" value={atmForm.notes} onChange={e => setAtmForm({ ...atmForm, notes: e.target.value })} /></Field>
        </div>
        <ModalActions>
          <Btn variant="secondary" onClick={() => setAtmOpen(false)}>Cancel</Btn>
          <Btn onClick={submitAtm}>Log withdrawal</Btn>
        </ModalActions>
      </Modal>

      {/* Income Modal */}
      <Modal open={incomeOpen} onClose={() => setIncomeOpen(false)} title="Credit Income">
        <p className="text-[12px] text-inkMuted mb-3">Credits the account balance and logs it as income. Appears in Daily Spends under the Income filter.</p>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <Field label="Credit to account">
            <select className={inputClass} value={incForm.toId} onChange={e => setIncForm({ ...incForm, toId: e.target.value })}>
              <option value="">— Select —</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </Field>
          <Field label="Amount"><input type="number" step="0.01" className={inputClass} placeholder="0" value={incForm.amount} onChange={e => setIncForm({ ...incForm, amount: e.target.value })} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date"><input type="date" className={inputClass} value={incForm.date} onChange={e => setIncForm({ ...incForm, date: e.target.value })} /></Field>
          <Field label="Description"><input className={inputClass} placeholder="e.g. June salary" value={incForm.description} onChange={e => setIncForm({ ...incForm, description: e.target.value })} /></Field>
        </div>
        <ModalActions>
          <Btn variant="secondary" onClick={() => setIncomeOpen(false)}>Cancel</Btn>
          <Btn onClick={submitIncome}>Credit</Btn>
        </ModalActions>
      </Modal>
    </>
  );
}
