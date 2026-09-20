/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
    './lib/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        paper: '#F7F8FA',
        paperCard: '#FFFFFF',
        ink: '#0B1220',
        ink2: '#3C4257',
        inkMuted: '#6B7280',
        accent: '#2563EB',
        accentLight: '#BFDBFE',
        accentBg: '#EFF6FF',
        warn: '#C2410C',
        warnBg: '#FFF7ED',
        emerald: '#059669',
        emeraldBg: '#ECFDF5',
        clay: '#DC2626',
        clayBg: '#FEF2F2',
        line: '#E5E7EB',
        sidebar: '#0B1220',
      },
      fontFamily: {
        display: ['var(--font-manrope)', 'sans-serif'],
        sans: ['var(--font-plex-sans)', 'sans-serif'],
        mono: ['var(--font-plex-mono)', 'monospace'],
      },
      borderRadius: {
        card: '12px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(11, 18, 32, 0.04), 0 1px 3px rgba(11, 18, 32, 0.06)',
      },
    },
  },
  plugins: [],
};
