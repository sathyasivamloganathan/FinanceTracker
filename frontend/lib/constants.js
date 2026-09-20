export const NAV_SECTIONS = [
  { id: 'overview', label: 'Overview', href: '/', icon: 'grid' },
  { id: 'wealth', label: 'Wealth', href: '/wealth', icon: 'layers' },
  { id: 'money', label: 'Money', href: '/money', icon: 'wallet' },
  { id: 'more', label: 'More', href: '/more', icon: 'dots' },
];

export const WEALTH_TABS = [
  { id: 'networth',     label: 'Net Worth' },
  { id: 'holdings',    label: 'Holdings' },
  { id: 'transactions',label: 'Transactions' },
  { id: 'fds',         label: 'Fixed Deposits' },
  { id: 'liabilities', label: 'Liabilities' },
  { id: 'allocation',  label: 'Allocation' },
  { id: 'advisor',     label: 'Buy/Sell/Hold' },
];

export const MONEY_TABS = [
  { id: 'expenses',  label: 'Daily Spends' },
  { id: 'budget',    label: 'Budget' },
  { id: 'recurring', label: 'Recurring' },
  { id: 'accounts',  label: 'Accounts' },
];

export const MORE_TABS = [
  { id: 'insights',  label: 'Insights' },
  { id: 'analysis',  label: 'Spend Analysis' },
  { id: 'insurance', label: 'Insurance' },
  { id: 'health',    label: 'Health Check' },
  { id: 'goals',     label: 'Goals' },
  { id: 'settings',  label: 'Settings' },
];

export const EXPENSE_CATEGORIES = [
  'Groceries', 'Food & Dining', 'Transport', 'Utilities', 'Rent',
  'Shopping', 'Health', 'Entertainment', 'Travel', 'Education',
  'EMI/Loan', 'Transfer', 'ATM Withdrawal', 'Other',
];

export const INCOME_CATEGORIES = [
  'Salary', 'Freelance', 'Rental Income', 'Interest', 'Dividend',
  'Business', 'Gift', 'Refund', 'Other Income',
];

export const RECURRING_FREQUENCIES = [
  { value: 'daily',       label: 'Daily' },
  { value: 'weekly',      label: 'Weekly' },
  { value: 'fortnightly', label: 'Every 2 weeks' },
  { value: 'monthly',     label: 'Monthly' },
  { value: 'quarterly',   label: 'Quarterly' },
  { value: 'yearly',      label: 'Yearly' },
];

export const HOLDING_TYPES = ['Stock', 'Mutual Fund', 'Gold'];
export const ASSET_TYPE_TO_CATEGORY = { Stock: 'Stocks', 'Mutual Fund': 'Mutual Funds', Gold: 'Gold' };
export const DEFAULT_ASSET_CATEGORIES = ['Cash', 'Fixed Deposit', 'Real Estate', 'Other'];
export const INSURANCE_TYPES = ['Life', 'Health', 'Vehicle', 'Home', 'Other'];
export const PREMIUM_FREQUENCIES = ['Yearly', 'Half-yearly', 'Quarterly', 'Monthly', 'One-time'];
export const LIABILITY_TYPES = ['Home Loan', 'Personal Loan', 'Car Loan', 'Credit Card', 'Education Loan', 'Other'];
export const BANK_ACCOUNT_TYPES = ['Savings', 'Current', 'Salary', 'NRE', 'NRO', 'Other'];
export const FD_COMPOUNDING = ['Monthly', 'Quarterly', 'Half-yearly', 'Yearly', 'On maturity'];
export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export const CHART_COLORS = [
  '#2563EB', '#059669', '#C2410C', '#7C3AED',
  '#0891B2', '#D97706', '#BE185D', '#16A34A',
  '#DC2626', '#9333EA', '#B45309', '#6B7280',
];
