'use client';

import Logo from './Logo';

export default function AuthCard({ subtitle, children }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm bg-paperCard border border-line rounded-card shadow-card p-7">
        <div className="flex items-center gap-2.5 mb-1"><Logo size={30} /><span className="font-display font-bold text-[22px] text-ink">FinanceTracer</span></div>
        {subtitle && <p className="text-inkMuted text-[13px] mb-6">{subtitle}</p>}
        {children}
      </div>
    </div>
  );
}

export function PasswordInput({ value, onChange, autoComplete, placeholder = '••••••••', id, required = true }) {
  return (
    <input
      id={id}
      type="password"
      required={required}
      minLength={8}
      maxLength={72}
      autoComplete={autoComplete}
      className="w-full px-2.5 py-2 border border-line rounded-md bg-white text-[13.5px] text-ink focus:outline-none focus:ring-2 focus:ring-accentLight focus:border-accent placeholder-gray-400"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
    />
  );
}
