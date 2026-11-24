// Recurring-entry generation shared by POST /api/recurring/generate and the
// nightly job, so both behave identically (including bank-balance effects).
const { dueOccurrences } = require('./dates');
const { applyEntry } = require('./ledger');

function generateRecurringForUser(user, today) {
  const generated = [];
  for (const r of user.recurring) {
    if (!r.active) continue;
    const id = String(r._id);
    const dates = dueOccurrences(r, today);
    if (!dates.length) continue;
    const legacyTag = `[recurring:${id}]`;
    for (const date of dates) {
      const exists = user.expenses.some((e) => e.date === date && (e.sourceId === id || (e.description && e.description.includes(legacyTag))));
      if (exists) continue;
      const entry = {
        date, category: r.category || 'Other', description: r.name, amount: r.amount,
        accountId: r.accountId || '', expenseType: r.type === 'income' ? 'income' : 'expense',
        notes: r.notes || '', sourceId: id,
      };
      user.expenses.push(entry);
      applyEntry(user, entry);
      generated.push({ name: r.name, date });
    }
    r.lastGeneratedDate = dates[dates.length - 1];
  }
  return generated;
}

module.exports = { generateRecurringForUser };
