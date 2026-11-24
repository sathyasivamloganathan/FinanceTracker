// The browser only ever talks to THIS origin. Requests to /api/* are forwarded
// to the backend (BACKEND_URL), so the session cookie is first-party: it works
// in Safari/iOS and installed PWAs, needs no CORS, and can stay SameSite=Lax.
const BACKEND_URL = (process.env.BACKEND_URL || 'http://localhost:4000').replace(/\/+$/, '');
const isDev = process.env.NODE_ENV !== 'production';

// Legacy cross-site setups (NEXT_PUBLIC_API_URL) must be allowed to connect.
let legacyApiOrigin = '';
try { if (process.env.NEXT_PUBLIC_API_URL) legacyApiOrigin = new URL(process.env.NEXT_PUBLIC_API_URL).origin; } catch { /* ignore */ }

const csp = [
  "default-src 'self'",
  // Next.js injects small inline bootstrap scripts; a nonce-based CSP would force fully dynamic rendering.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${legacyApiOrigin ? ` ${legacyApiOrigin}` : ''}${isDev ? ' ws:' : ''}`,
  "manifest-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ['upgrade-insecure-requests']),
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  ...(isDev ? [] : [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }]),
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${BACKEND_URL}/api/:path*` }];
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      // API responses (proxied) must never be cached by the browser or a CDN.
      { source: '/api/:path*', headers: [{ key: 'Cache-Control', value: 'no-store' }] },
    ];
  },
};

export default nextConfig;
