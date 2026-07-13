import { Manrope, IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/AuthContext';
import { FinanceProvider } from '@/lib/FinanceContext';
import { PrivacyProvider } from '@/lib/PrivacyContext';
import AppShell from '@/components/AppShell';
import PWARegister from '@/components/PWARegister';

const manrope = Manrope({ subsets: ['latin'], weight: ['500', '600', '700', '800'], variable: '--font-manrope' });
const plexSans = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-plex-sans' });
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-plex-mono' });

export const metadata = {
  title: 'Vantage — Personal Finance Command Center',
  description: 'Track net worth, holdings, allocation, daily spends, and insurance — privately.',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Vantage' },
};

export const viewport = {
  themeColor: '#0B1220',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${manrope.variable} ${plexSans.variable} ${plexMono.variable}`}>
      <body className="bg-paper text-ink font-sans min-h-screen">
        <AuthProvider>
          <FinanceProvider>
            <PrivacyProvider>
              <AppShell>{children}</AppShell>
            </PrivacyProvider>
          </FinanceProvider>
        </AuthProvider>
        <PWARegister />
      </body>
    </html>
  );
}
