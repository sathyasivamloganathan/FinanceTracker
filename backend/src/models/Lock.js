// Tiny distributed lease so that, when the API runs on several instances,
// scheduled jobs execute on exactly one of them.
const mongoose = require('mongoose');

const LockSchema = new mongoose.Schema({
  _id: { type: String },            // job name
  owner: { type: String, required: true },
  expiresAt: { type: Date, required: true },
}, { versionKey: false });

module.exports = mongoose.models.Lock || mongoose.model('Lock', LockSchema);
