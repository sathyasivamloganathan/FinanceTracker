export const NAV_SECTIONS = [
  { id: 'overview', label: 'Overview', href: '/', icon: 'grid' },
  { id: 'wealth', label: 'Wealth', href: '/wealth', icon: 'layers' },
  { id: 'money', label: 'Money', href: '/money', icon: 'wallet' },
  { id: 'more', label: 'More', href: '/more', icon: 'dots' },
];

// Transactions lives under Wealth (equity/investment activity), not Money —
// Daily Spends (cash) and investment activity are kept fully separate.
export const WEALTH_TABS = [
  { id: 'networth', label: 'Net Worth' },
  { id: 'holdings', label: 'Holdings' },
  { id: 'transactions', label: 'Transactions' },
  { id: 'liabilities', label: 'Liabilities' },
  { id: 'allocation', label: 'Allocation' },
  { id: 'advisor', label: 'Buy/Sell/Hold' },
];

export const MONEY_TABS = [{ id: 'expenses', label: 'Daily Spends' }];

export const MORE_TABS = [
  { id: 'insurance', label: 'Insurance' },
  { id: 'health', label: 'Health Check' },
  { id: 'goals', label: 'Goals' },
  { id: 'settings', label: 'Settings' },
];

export const EXPENSE_CATEGORIES = [
  'Groceries',
  'Food & Dining',
  'Transport',
  'Utilities',
  'Rent',
  'Shopping',
  'Health',
  'Entertainment',
  'Travel',
  'Education',
  'EMI/Loan',
  'Other',
];

export const HOLDING_TYPES = ['Stock', 'Mutual Fund', 'Gold'];

export const ASSET_TYPE_TO_CATEGORY = {
  Stock: 'Stocks',
  'Mutual Fund': 'Mutual Funds',
  Gold: 'Gold',
};

export const DEFAULT_ASSET_CATEGORIES = ['Cash', 'Fixed Deposit', 'Real Estate', 'Other'];

export const INSURANCE_TYPES = ['Life', 'Health', 'Vehicle', 'Home', 'Other'];
export const PREMIUM_FREQUENCIES = ['Yearly', 'Half-yearly', 'Quarterly', 'Monthly', 'One-time'];
export const LIABILITY_TYPES = ['Home Loan', 'Personal Loan', 'Car Loan', 'Credit Card', 'Education Loan', 'Other'];

export const STORAGE_KEY = 'Finance Tracker-finance-data-v1';
export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
