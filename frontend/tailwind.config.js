/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
    './lib/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        paper: '#EDEEF0',
        paperCard: '#F8F8F6',
        ink: '#1C2430',
        ink2: '#3A4453',
        inkMuted: '#707886',
        brass: '#0F766E',
        brassLight: '#99F6E4',
        brassBg: '#F0FDFA',
        warn: '#C2410C',
        warnBg: '#FFF7ED',
        emerald: '#276B47',
        emeraldBg: '#E1EEE5',
        clay: '#AE4A2C',
        clayBg: '#F3E1D9',
        line: '#D3D5DA',
        sidebar: '#1C2430',
      },
      fontFamily: {
        display: ['var(--font-fraunces)', 'serif'],
        sans: ['var(--font-plex-sans)', 'sans-serif'],
        mono: ['var(--font-plex-mono)', 'monospace'],
      },
      borderRadius: {
        card: '10px',
      },
    },
  },
  plugins: [],
};
