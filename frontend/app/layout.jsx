import { Fraunces, IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/AuthContext';
import { FinanceProvider } from '@/lib/FinanceContext';
import { PrivacyProvider } from '@/lib/PrivacyContext';
import AppShell from '@/components/AppShell';
import PWARegister from '@/components/PWARegister';

const fraunces = Fraunces({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-fraunces' });
const plexSans = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-plex-sans' });
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-plex-mono' });

export const metadata = {
  title: 'Finance Tracker — Personal Finance Command Center',
  description: 'Track net worth, holdings, allocation, daily spends, and insurance — privately.',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Finance Tracker' },
};

export const viewport = {
  themeColor: '#1C2430',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${plexSans.variable} ${plexMono.variable}`}>
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
