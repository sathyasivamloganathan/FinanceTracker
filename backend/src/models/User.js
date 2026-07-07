const mongoose = require('mongoose');
const { Schema } = mongoose;

/*
 * Design note: for a personal-finance app used by one person per account,
 * embedding everything as subdocuments on the User keeps reads simple (one
 * query per page) and is plenty for realistic personal data volumes.
 * If this ever needs to scale to many users with heavy transaction volume,
 * split these into their own top-level collections with a `userId` index —
 * the route handlers are organized so that's a contained change.
 */

const AssetSnapshotSchema = new Schema(
  {
    date: { type: String, required: true }, // "YYYY-MM-DD"
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: true }
);

const OtherAssetSchema = new Schema(
  {
    category: { type: String, required: true, trim: true, maxlength: 60 },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    amount: { type: Number, required: true, default: 0, min: 0 }, // mirrors the latest snapshot
    updatedAt: { type: String, default: () => new Date().toISOString().slice(0, 10) },
    history: { type: [AssetSnapshotSchema], default: [] },
  },
  { _id: true }
);

const HoldingSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    // Auto-sync code: for Stocks, a Yahoo Finance-style symbol (e.g. "INFY.NS");
    // for Mutual Funds, the AMFI scheme code (e.g. "119551"). Leave blank (or
    // set autoSync to false) to manage the rate manually instead.
    symbol: { type: String, trim: true, maxlength: 30, default: '' },
    assetType: { type: String, enum: ['Stock', 'Mutual Fund', 'Gold'], required: true },
    qty: { type: Number, required: true, default: 0, min: 0 },
    avgRate: { type: Number, required: true, default: 0, min: 0 },
    currentRate: { type: Number, required: true, default: 0, min: 0 },
    autoSync: { type: Boolean, default: true },
    lastSyncedAt: { type: Date, default: null },
    lastSyncStatus: { type: String, enum: ['ok', 'failed', 'no-symbol', 'pending'], default: 'pending' },
    lastSyncMessage: { type: String, default: '' },
    updatedAt: { type: String, default: () => new Date().toISOString().slice(0, 10) },
  },
  { _id: true }
);

const TransactionSchema = new Schema(
  {
    date: { type: String, required: true },
    type: { type: String, enum: ['Buy', 'Sell'], required: true },
    assetType: { type: String, enum: ['Stock', 'Mutual Fund', 'Gold'], required: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    symbol: { type: String, trim: true, maxlength: 30, default: '' },
    qty: { type: Number, required: true, min: 0.000001 },
    price: { type: Number, required: true, min: 0 },
    amount: { type: Number, required: true, min: 0 },
    notes: { type: String, trim: true, maxlength: 300, default: '' },
  },
  { _id: true }
);

const ExpenseSchema = new Schema(
  {
    date: { type: String, required: true },
    category: { type: String, required: true, trim: true, maxlength: 60 },
    description: { type: String, trim: true, maxlength: 200, default: '' },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: true }
);

const InsuranceSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    type: { type: String, enum: ['Life', 'Health', 'Vehicle', 'Home', 'Other'], required: true },
    insurer: { type: String, trim: true, maxlength: 120, default: '' },
    policyNumber: { type: String, trim: true, maxlength: 60, default: '' },
    premium: { type: Number, default: 0, min: 0 },
    frequency: { type: String, enum: ['Yearly', 'Half-yearly', 'Quarterly', 'Monthly', 'One-time'], default: 'Yearly' },
    coverage: { type: Number, default: 0, min: 0 },
    dueDate: { type: String, default: '' },
    notes: { type: String, trim: true, maxlength: 400, default: '' },
    lastReminderSentAt: { type: Date, default: null },
  },
  { _id: true }
);

const LiabilitySchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    type: { type: String, enum: ['Home Loan', 'Personal Loan', 'Car Loan', 'Credit Card', 'Education Loan', 'Other'], default: 'Other' },
    amount: { type: Number, required: true, default: 0, min: 0 }, // outstanding balance
    interestRate: { type: Number, default: 0, min: 0 },
    updatedAt: { type: String, default: () => new Date().toISOString().slice(0, 10) },
    notes: { type: String, trim: true, maxlength: 300, default: '' },
  },
  { _id: true }
);

const GoalSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    targetAmount: { type: Number, required: true, min: 0 },
    targetDate: { type: String, default: '' },
    notes: { type: String, trim: true, maxlength: 300, default: '' },
    createdAt: { type: String, default: () => new Date().toISOString().slice(0, 10) },
  },
  { _id: true }
);

const NetWorthSnapshotSchema = new Schema(
  {
    date: { type: String, required: true }, // "YYYY-MM-DD"
    netWorth: { type: Number, required: true },
    invested: { type: Number, required: true },
    breakdown: { type: Map, of: Number, default: () => new Map() }, // category -> value, for your own record
  },
  { _id: true }
);

const UserSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },

    privacyModeDefault: { type: Boolean, default: true },

    otherAssets: { type: [OtherAssetSchema], default: [] },
    holdings: { type: [HoldingSchema], default: [] },
    transactions: { type: [TransactionSchema], default: [] },
    expenses: { type: [ExpenseSchema], default: [] },
    insurance: { type: [InsuranceSchema], default: [] },
    liabilities: { type: [LiabilitySchema], default: [] },
    goals: { type: [GoalSchema], default: [] },
    netWorthSnapshots: { type: [NetWorthSnapshotSchema], default: [] },
    targets: { type: Map, of: Number, default: () => new Map([['Stocks', 40], ['Mutual Funds', 30], ['Gold', 10], ['Cash', 15], ['Other', 5]]) },

    // Financial profile for the Health Check section — all optional.
    financialProfile: {
      age: { type: Number, default: null },
      monthlyIncome: { type: Number, default: null },
    },

    lastMonthlyEmailSentFor: { type: String, default: '' },

    failedLoginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date, default: null },
  },
  { timestamps: true }
);

UserSchema.methods.toSafeJSON = function () {
  const { serializeList } = require('../utils/serialize');
  return {
    id: String(this._id),
    name: this.name,
    email: this.email,
    privacyModeDefault: this.privacyModeDefault,
    otherAssets: serializeList(this.otherAssets),
    holdings: serializeList(this.holdings),
    transactions: serializeList(this.transactions),
    expenses: serializeList(this.expenses),
    insurance: serializeList(this.insurance),
    liabilities: serializeList(this.liabilities),
    goals: serializeList(this.goals),
    netWorthSnapshots: serializeList(this.netWorthSnapshots),
    targets: Object.fromEntries(this.targets),
    financialProfile: this.financialProfile,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model('User', UserSchema);
