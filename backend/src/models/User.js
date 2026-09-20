const mongoose = require('mongoose');
const { Schema } = mongoose;

const AssetSnapshotSchema = new Schema({ date: { type: String, required: true }, amount: { type: Number, required: true, min: 0 } }, { _id: true });
const OtherAssetSchema = new Schema({ category: { type: String, required: true, trim: true, maxlength: 60 }, name: { type: String, required: true, trim: true, maxlength: 120 }, amount: { type: Number, required: true, default: 0, min: 0 }, updatedAt: { type: String, default: () => new Date().toISOString().slice(0, 10) }, history: { type: [AssetSnapshotSchema], default: [] } }, { _id: true });
const HoldingSchema = new Schema({ name: { type: String, required: true, trim: true, maxlength: 120 }, symbol: { type: String, trim: true, maxlength: 30, default: '' }, assetType: { type: String, enum: ['Stock', 'Mutual Fund', 'Gold'], required: true }, qty: { type: Number, required: true, default: 0, min: 0 }, avgRate: { type: Number, required: true, default: 0, min: 0 }, currentRate: { type: Number, required: true, default: 0, min: 0 }, autoSync: { type: Boolean, default: true }, lastSyncedAt: { type: Date, default: null }, lastSyncStatus: { type: String, enum: ['ok', 'failed', 'no-symbol', 'pending'], default: 'pending' }, lastSyncMessage: { type: String, default: '' }, updatedAt: { type: String, default: () => new Date().toISOString().slice(0, 10) } }, { _id: true });
const TransactionSchema = new Schema({ date: { type: String, required: true }, type: { type: String, enum: ['Buy', 'Sell'], required: true }, assetType: { type: String, enum: ['Stock', 'Mutual Fund', 'Gold'], required: true }, name: { type: String, required: true, trim: true, maxlength: 120 }, symbol: { type: String, trim: true, maxlength: 30, default: '' }, qty: { type: Number, required: true, min: 0.000001 }, price: { type: Number, required: true, min: 0 }, amount: { type: Number, required: true, min: 0 }, notes: { type: String, trim: true, maxlength: 300, default: '' } }, { _id: true });

const ExpenseSchema = new Schema({
  date: { type: String, required: true },
  category: { type: String, required: true, trim: true, maxlength: 60 },
  description: { type: String, trim: true, maxlength: 200, default: '' },
  amount: { type: Number, required: true, min: 0 },
  accountId: { type: String, default: '' },
  expenseType: { type: String, enum: ['expense', 'transfer', 'atm_withdrawal', 'income'], default: 'expense' },
  transferToAccountId: { type: String, default: '' },
  notes: { type: String, trim: true, maxlength: 300, default: '' }, // feature #7
}, { _id: true });

const BankAccountSchema = new Schema({ name: { type: String, required: true, trim: true, maxlength: 120 }, type: { type: String, enum: ['Savings', 'Current', 'Salary', 'NRE', 'NRO', 'Other'], default: 'Savings' }, balance: { type: Number, required: true, default: 0 }, color: { type: String, default: '#2563EB' }, notes: { type: String, trim: true, maxlength: 200, default: '' }, updatedAt: { type: String, default: () => new Date().toISOString().slice(0, 10) } }, { _id: true });
const FDSchema = new Schema({ bankName: { type: String, required: true, trim: true, maxlength: 120 }, accountId: { type: String, default: '' }, principal: { type: Number, required: true, min: 0 }, interestRate: { type: Number, required: true, min: 0 }, startDate: { type: String, required: true }, maturityDate: { type: String, required: true }, maturityAmount: { type: Number, default: 0 }, compounding: { type: String, enum: ['Monthly', 'Quarterly', 'Half-yearly', 'Yearly', 'On maturity'], default: 'Quarterly' }, autoRenew: { type: Boolean, default: false }, creditToAccountId: { type: String, default: '' }, status: { type: String, enum: ['active', 'matured', 'renewed', 'broken'], default: 'active' }, notes: { type: String, trim: true, maxlength: 300, default: '' } }, { _id: true });
const InsuranceSchema = new Schema({ name: { type: String, required: true, trim: true, maxlength: 120 }, type: { type: String, enum: ['Life', 'Health', 'Vehicle', 'Home', 'Other'], required: true }, insurer: { type: String, trim: true, maxlength: 120, default: '' }, policyNumber: { type: String, trim: true, maxlength: 60, default: '' }, premium: { type: Number, default: 0, min: 0 }, frequency: { type: String, enum: ['Yearly', 'Half-yearly', 'Quarterly', 'Monthly', 'One-time'], default: 'Yearly' }, coverage: { type: Number, default: 0, min: 0 }, dueDate: { type: String, default: '' }, notes: { type: String, trim: true, maxlength: 400, default: '' }, lastReminderSentAt: { type: Date, default: null } }, { _id: true });
const LiabilitySchema = new Schema({ name: { type: String, required: true, trim: true, maxlength: 120 }, type: { type: String, enum: ['Home Loan', 'Personal Loan', 'Car Loan', 'Credit Card', 'Education Loan', 'Other'], default: 'Other' }, amount: { type: Number, required: true, default: 0, min: 0 }, interestRate: { type: Number, default: 0, min: 0 }, updatedAt: { type: String, default: () => new Date().toISOString().slice(0, 10) }, notes: { type: String, trim: true, maxlength: 300, default: '' } }, { _id: true });
const GoalSchema = new Schema({ name: { type: String, required: true, trim: true, maxlength: 120 }, targetAmount: { type: Number, required: true, min: 0 }, targetDate: { type: String, default: '' }, notes: { type: String, trim: true, maxlength: 300, default: '' }, createdAt: { type: String, default: () => new Date().toISOString().slice(0, 10) }, achieved: { type: Boolean, default: false }, achievedDate: { type: String, default: '' }, achievedNetWorth: { type: Number, default: null } }, { _id: true });
const NetWorthSnapshotSchema = new Schema({ date: { type: String, required: true }, netWorth: { type: Number, required: true }, invested: { type: Number, required: true }, breakdown: { type: Map, of: Number, default: () => new Map() }, notes: { type: String, default: '' } }, { _id: true });

// Recurring template schema (feature #1)
const RecurringSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  amount: { type: Number, required: true, min: 0 },
  category: { type: String, trim: true, maxlength: 60, default: 'Other' },
  accountId: { type: String, default: '' },
  frequency: { type: String, enum: ['daily','weekly','fortnightly','monthly','quarterly','yearly'], required: true },
  type: { type: String, enum: ['expense','income'], default: 'expense' },
  startDate: { type: String, required: true },
  endDate: { type: String, default: '' },
  active: { type: Boolean, default: true },
  lastGeneratedDate: { type: String, default: '' },
  notes: { type: String, trim: true, maxlength: 200, default: '' },
}, { _id: true });

const UserSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, default: null },
  authProvider: { type: String, enum: ['local', 'google'], default: 'local' },
  googleId: { type: String, default: null, unique: true, sparse: true },

  privacyModeDefault: { type: Boolean, default: true },
  darkModeDefault: { type: Boolean, default: false },

  otherAssets: { type: [OtherAssetSchema], default: [] },
  holdings: { type: [HoldingSchema], default: [] },
  transactions: { type: [TransactionSchema], default: [] },
  expenses: { type: [ExpenseSchema], default: [] },
  bankAccounts: { type: [BankAccountSchema], default: [] },
  fds: { type: [FDSchema], default: [] },
  insurance: { type: [InsuranceSchema], default: [] },
  liabilities: { type: [LiabilitySchema], default: [] },
  goals: { type: [GoalSchema], default: [] },
  netWorthSnapshots: { type: [NetWorthSnapshotSchema], default: [] },
  recurring: { type: [RecurringSchema], default: [] }, // feature #1
  budgets: { type: Schema.Types.Mixed, default: {} }, // feature #2: "YYYY-MM" → {cat: amount}
  targets: { type: Map, of: Number, default: () => new Map([['Stocks', 40], ['Mutual Funds', 30], ['Gold', 10], ['Cash', 15], ['Other', 5]]) },

  financialProfile: {
    dateOfBirth: { type: String, default: null },
    monthlyIncome: { type: Number, default: null },
  },

  lastMonthlyEmailSentFor: { type: String, default: '' },
  lastWeeklyEmailSentFor: { type: String, default: '' },
  failedLoginAttempts: { type: Number, default: 0 },
  lockUntil: { type: Date, default: null },
}, { timestamps: true });

mongoose.set('strictQuery', true);

UserSchema.methods.toSafeJSON = function () {
  const { serializeList } = require('../utils/serialize');
  return {
    id: String(this._id),
    name: this.name,
    email: this.email,
    authProvider: this.authProvider,
    hasPassword: !!this.passwordHash,
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
    targets: Object.fromEntries(this.targets),
    financialProfile: this.financialProfile,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model('User', UserSchema);
