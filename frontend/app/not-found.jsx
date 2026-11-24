import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-paper px-4">
      <div className="max-w-sm text-center">
        <h1 className="font-display text-[22px] font-semibold text-ink mb-2">Page not found</h1>
        <p className="text-inkMuted text-[13px] mb-5">That page doesn’t exist.</p>
        <Link href="/" className="text-accent font-semibold text-[13px]">Back to Vantage</Link>
      </div>
    </div>
  );
}
