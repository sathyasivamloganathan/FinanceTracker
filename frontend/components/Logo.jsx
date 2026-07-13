export default function Logo({ size = 26, mono = false }) {
  const fg = mono ? 'currentColor' : '#2563EB';
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="8" fill={mono ? 'transparent' : '#0B1220'} />
      <path d="M8 21L16 9L24 21" stroke={fg} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12.3 21L16 15.3L19.7 21" stroke={fg} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" opacity="0.55" />
    </svg>
  );
}
