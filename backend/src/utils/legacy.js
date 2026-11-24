// One-off clean-up for data written by v1.0.
// The old recurring generator appended "[recurring:<templateId>]" to the visible
// description of every entry it created. Move that id into the proper
// `sourceId` field and leave only the name.
const TAG = /\s*\[recurring:([a-f0-9]{24})\]/i;

// Mutates `user`; returns how many entries were cleaned.
function stripRecurringTags(user) {
  let n = 0;
  for (const e of user.expenses) {
    const m = TAG.exec(e.description || '');
    if (!m) continue;
    e.description = e.description.replace(TAG, '').trim();
    if (!e.sourceId) e.sourceId = m[1];
    n += 1;
  }
  return n;
}

async function migrateRecurringTags() {
  const User = require('../models/User');
  const { withUser } = require('../services/withUser');
  const cursor = User.find({ 'expenses.description': { $regex: '\\[recurring:[a-fA-F0-9]{24}\\]' } }).select('_id').lean().cursor();
  let users = 0; let entries = 0;
  for await (const { _id } of cursor) {
    try { entries += (await withUser(_id, (u) => stripRecurringTags(u))) || 0; users += 1; }
    catch (e) { console.error(`[migrate] recurring tags for ${_id}:`, e.message); }
  }
  if (entries) console.log(`[migrate] removed the recurring id tag from ${entries} entries (${users} users)`);
}

module.exports = { stripRecurringTags, migrateRecurringTags, TAG };
