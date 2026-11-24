const mongoose = require('mongoose');
const { Schema } = mongoose;
const { isValidDateStr } = require('../utils/validate');
const { todayStr } = require('../utils/dates');

mongoose.set('strictQuery', true); // unknown keys in query filters are dropped

const today = () => todayStr();

// 'YYYY-MM-DD' that must be a real calendar date.
const dateField = (opts = {}) => ({
  type: String,
  validate: { validator: (v) => isValidDateStr(v), message: 'Invalid date (YYYY-MM-DD)' },
  ...opts,
});
// Same, but '' is allowed (optional date).
const optionalDate = (opts = {}) => ({
  type: String,
  default: '',
  validate: { validator: (v) => v === '' || v == null || isValidDateStr(v), message: 'Invalid date (YYYY-MM-DD)' },
  ...opts,
});

// A single user document is limited to 16 MB by MongoDB; hard caps keep a
// runaway client / import from making the account permanently unsaveable.
const cap = (n, label) => ({
  validator: (arr) => !arr || arr.length <= n,
  message: `Limit of ${n} ${label} reached`,
});

const money = (extra = {}) => ({ type: Number, min: 0, max: 1e12, ...extra });

const AssetSnapshotSchema = new Schema({
  date: dateField({ required: true }),
  amount: money({ required: true }),
}, { _id: true });

const OtherAssetSchema = new Schema({
  category: { type: String, required: true, trim: true, maxlength: 60 },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  amount: money({ required: true, default: 0 }),
  updatedAt: dateField({ default: today }),
  history: { type: [AssetSnapshotSchema], default: [], validate: cap(2000, 'snapshots per asset') },
}, { _id: true });

const HoldingSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  symbol: { type: String, trim: true, maxlength: 30, default: '' },
  assetType: { type: String, enum: ['Stock', 'Mutual Fund', 'Gold'], required: true },
  qty: money({ required: true, default: 0 }),
  avgRate: money({ required: true, default: 0 }),
  currentRate: money({ required: true, default: 0 }),
  autoSync: { type: Boolean, default: true },
  lastSyncedAt: { type: Date, default: null },
  lastSyncStatus: { type: String, enum: ['ok', 'failed', 'no-symbol', 'pending'], default: 'pending' },
  lastSyncMessage: { type: String, default: '', maxlength: 300 },
  updatedAt: dateField({ default: today }),
}, { _id: true });

const TransactionSchema = new Schema({
  date: dateField({ required: true }),
  type: { type: String, enum: ['Buy', 'Sell'], required: true },
  assetType: { type: String, enum: ['Stock', 'Mutual Fund', 'Gold'], required: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  symbol: { type: String, trim: true, maxlength: 30, default: '' },
  qty: { type: Number, required: true, min: 0.000001, max: 1e12 },
  price: money({ required: true }),
  amount: money({ required: true }),
  notes: { type: String, trim: true, maxlength: 300, default: '' },
}, { _id: true });

const ExpenseSchema = new Schema({
  date: dateField({ required: true }),
  category: { type: String, required: true, trim: true, maxlength: 60 },
  description: { type: String, trim: true, maxlength: 200, default: '' },
  amount: money({ required: true }),
  accountId: { type: String, default: '', maxlength: 40 },
  expenseType: { type: String, enum: ['expense', 'transfer', 'atm_withdrawal', 'income'], default: 'expense' },
  transferToAccountId: { type: String, default: '', maxlength: 40 },
  notes: { type: String, trim: true, maxlength: 300, default: '' },
  sourceId: { type: String, default: '', maxlength: 40 }, // recurring template that generated this row
}, { _id: true });

const BankAccountSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  type: { type: String, enum: ['Savings', 'Current', 'Salary', 'NRE', 'NRO', 'Other'], default: 'Savings' },
  balance: { type: Number, required: true, default: 0, min: -1e12, max: 1e12 },
  color: { type: String, default: '#2563EB', match: /^#[0-9a-fA-F]{3,8}$/ },
  notes: { type: String, trim: true, maxlength: 200, default: '' },
  updatedAt: dateField({ default: today }),
}, { _id: true });

const FDSchema = new Schema({
  bankName: { type: String, required: true, trim: true, maxlength: 120 },
  accountId: { type: String, default: '', maxlength: 40 },
  principal: money({ required: true }),
  interestRate: { type: Number, required: true, min: 0, max: 100 },
  startDate: dateField({ required: true }),
  maturityDate: dateField({ required: true }),
  maturityAmount: money({ default: 0 }),
  manualMaturity: { type: Boolean, default: false }, // user supplied the bank-quoted maturity value
  compounding: { type: String, enum: ['Monthly', 'Quarterly', 'Half-yearly', 'Yearly', 'On maturity'], default: 'Quarterly' },
  autoRenew: { type: Boolean, default: false },
  creditToAccountId: { type: String, default: '', maxlength: 40 },
  status: { type: String, enum: ['active', 'matured', 'renewed', 'broken'], default: 'active' },
  notes: { type: String, trim: true, maxlength: 300, default: '' },
}, { _id: true });

const InsuranceSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  type: { type: String, enum: ['Life', 'Health', 'Vehicle', 'Home', 'Other'], required: true },
  insurer: { type: String, trim: true, maxlength: 120, default: '' },
  policyNumber: { type: String, trim: true, maxlength: 60, default: '' },
  premium: money({ default: 0 }),
  frequency: { type: String, enum: ['Yearly', 'Half-yearly', 'Quarterly', 'Monthly', 'One-time'], default: 'Yearly' },
  coverage: money({ default: 0 }),
  dueDate: optionalDate(),
  notes: { type: String, trim: true, maxlength: 400, default: '' },
  lastReminderSentAt: { type: Date, default: null },
}, { _id: true });

const LiabilitySchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  type: { type: String, enum: ['Home Loan', 'Personal Loan', 'Car Loan', 'Credit Card', 'Education Loan', 'Other'], default: 'Other' },
  amount: money({ required: true, default: 0 }),
  interestRate: { type: Number, default: 0, min: 0, max: 100 },
  updatedAt: dateField({ default: today }),
  notes: { type: String, trim: true, maxlength: 300, default: '' },
}, { _id: true });

const GoalSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  targetAmount: money({ required: true }),
  targetDate: optionalDate(),
  notes: { type: String, trim: true, maxlength: 300, default: '' },
  createdAt: dateField({ default: today }),
  achieved: { type: Boolean, default: false },
  achievedDate: optionalDate(),
  achievedNetWorth: { type: Number, default: null },
}, { _id: true });

const NetWorthSnapshotSchema = new Schema({
  date: dateField({ required: true }),
  netWorth: { type: Number, required: true, min: -1e13, max: 1e13 },
  invested: { type: Number, required: true, min: -1e13, max: 1e13 },
  breakdown: { type: Map, of: Number, default: () => new Map() },
  notes: { type: String, default: '', maxlength: 300 },
}, { _id: true });

const RecurringSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  amount: money({ required: true }),
  category: { type: String, trim: true, maxlength: 60, default: 'Other' },
  accountId: { type: String, default: '', maxlength: 40 },
  frequency: { type: String, enum: ['daily', 'weekly', 'fortnightly', 'monthly', 'quarterly', 'yearly'], required: true },
  type: { type: String, enum: ['expense', 'income'], default: 'expense' },
  startDate: dateField({ required: true }),
  endDate: optionalDate(),
  active: { type: Boolean, default: true },
  lastGeneratedDate: optionalDate(),
  notes: { type: String, trim: true, maxlength: 200, default: '' },
}, { _id: true });

const UserSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },

  // Never loaded unless explicitly requested with .select('+passwordHash').
  passwordHash: { type: String, default: null, select: false },
  hasPassword: { type: Boolean, default: false },
  authProvider: { type: String, enum: ['local', 'google'], default: 'local' },
  // Uniqueness is enforced by the partial index below (a sparse index would
  // still index explicit nulls and reject the 2nd local account).
  googleId: { type: String },

  emailVerified: { type: Boolean, default: false },
  emailVerifyTokenHash: { type: String, select: false },
  emailVerifyExpires: { type: Date, select: false },
  resetTokenHash: { type: String, select: false },
  resetTokenExpires: { type: Date, select: false },

  // Bumped on password change / "sign out everywhere"; embedded in the JWT.
  tokenVersion: { type: Number, default: 0 },

  emailPrefs: {
    weekly: { type: Boolean, default: true },
    monthly: { type: Boolean, default: true },
    reminders: { type: Boolean, default: true }, // insurance + FD maturity
  },

  privacyModeDefault: { type: Boolean, default: true },
  darkModeDefault: { type: Boolean, default: false },

  otherAssets: { type: [OtherAssetSchema], default: [], validate: cap(500, 'assets') },
  holdings: { type: [HoldingSchema], default: [], validate: cap(1000, 'holdings') },
  transactions: { type: [TransactionSchema], default: [], validate: cap(20000, 'transactions') },
  expenses: { type: [ExpenseSchema], default: [], validate: cap(40000, 'expense entries') },
  bankAccounts: { type: [BankAccountSchema], default: [], validate: cap(100, 'bank accounts') },
  fds: { type: [FDSchema], default: [], validate: cap(500, 'fixed deposits') },
  insurance: { type: [InsuranceSchema], default: [], validate: cap(200, 'policies') },
  liabilities: { type: [LiabilitySchema], default: [], validate: cap(200, 'liabilities') },
  goals: { type: [GoalSchema], default: [], validate: cap(200, 'goals') },
  netWorthSnapshots: { type: [NetWorthSnapshotSchema], default: [], validate: cap(5000, 'net-worth snapshots') },
  recurring: { type: [RecurringSchema], default: [], validate: cap(300, 'recurring items') },
  budgets: { type: Schema.Types.Mixed, default: {} }, // "YYYY-MM" → { category: amount }
  targets: { type: Map, of: Number, default: () => new Map([['Stocks', 40], ['Mutual Funds', 30], ['Gold', 10], ['Cash', 15], ['Other', 5]]) },

  financialProfile: {
    dateOfBirth: { type: String, default: null, validate: { validator: (v) => v == null || v === '' || isValidDateStr(v), message: 'Invalid date of birth' } },
    monthlyIncome: { type: Number, default: null, min: 0, max: 1e10 },
  },

  lastMonthlyEmailSentFor: { type: String, default: '' },
  lastWeeklyEmailSentFor: { type: String, default: '' },
  failedLoginAttempts: { type: Number, default: 0 },
  lockUntil: { type: Date, default: null },
}, { timestamps: true, minimize: false });

UserSchema.index(
  { googleId: 1 },
  { unique: true, partialFilterExpression: { googleId: { $type: 'string' } }, name: 'googleId_partial_unique' }
);

UserSchema.methods.toSafeJSON = function () {
  const { serializeList } = require('../utils/serialize');
  return {
    id: String(this._id),
    name: this.name,
    email: this.email,
    authProvider: this.authProvider,
    hasPassword: !!this.hasPassword,
    emailVerified: !!this.emailVerified,
    emailPrefs: {
      weekly: this.emailPrefs?.weekly !== false,
      monthly: this.emailPrefs?.monthly !== false,
      reminders: this.emailPrefs?.reminders !== false,
    },
    privacyModeDefault: this.privacyModeDefault,
    darkModeDefault: this.darkModeDefault,
    otherAssets: serializeList(this.otherAssets),
    holdings: serializeList(this.holdings),
    transactions: serializeList(this.transactions),
    expenses: serializeList(this.expenses),
    bankAccounts: serializeList(this.bankAccounts),
    fds: serializeList(this.fds),
    insurance: serializeList(this.insurance),
    liabilities: serializeList(this.liabilities),
    goals: serializeList(this.goals),
    netWorthSnapshots: serializeList(this.netWorthSnapshots),
    recurring: serializeList(this.recurring),
    budgets: this.budgets || {},
    targets: Object.fromEntries(this.targets || []),
    financialProfile: this.financialProfile,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.models.User || mongoose.model('User', UserSchema);
