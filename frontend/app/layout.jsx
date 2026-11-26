import { Manrope, IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/AuthContext';
import { FinanceProvider } from '@/lib/FinanceContext';
import { PrivacyProvider } from '@/lib/PrivacyContext';
import PWARegister from '@/components/PWARegister';
import Toaster from '@/components/Toaster';

const manrope = Manrope({ subsets: ['latin'], weight: ['500', '600', '700', '800'], variable: '--font-manrope' });
const plexSans = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-plex-sans' });
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-plex-mono' });

export const metadata = {
  title: 'FinanceTracer - Personal Finance Command Center',
  description: 'Track net worth, holdings, allocation, daily spends, and insurance - privately.',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'FinanceTracer' },
};

export const viewport = {
  themeColor: '#0B1220',
  width: 'device-width',
  initialScale: 1,
};

// Applies the cached theme before first paint (no flash of light mode).
const THEME_SCRIPT = "try{if(localStorage.getItem('FinanceTracer-theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}";

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${manrope.variable} ${plexSans.variable} ${plexMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="bg-paper text-ink font-sans min-h-screen">
        <AuthProvider>
          <FinanceProvider>
            <PrivacyProvider>
              {children}
              <Toaster />
            </PrivacyProvider>
          </FinanceProvider>
        </AuthProvider>
        <PWARegister />
      </body>
    </html>
  );
}
