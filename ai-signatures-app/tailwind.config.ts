import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        bg: '#05070a',
        surface: '#0c1017',
        surface2: '#121824',
        border: '#1e2733',
        'border-hi': '#2c3849',
        text: '#eef1f6',
        muted: '#7c8798',
        dim: '#4b5563',
        accent: '#5eead4',
        'accent-dim': '#0f766e',
        claude: '#e08a5e',
        gemini: '#5b9dff',
        good: '#34d399',
        warn: '#fbbf24',
        bad: '#f87171',
      },
      fontFamily: {
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      backgroundImage: {
        'dot-grid':
          'radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)',
      },
      backgroundSize: {
        grid: '22px 22px',
      },
      keyframes: {
        'pulse-dot': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.35' },
        },
      },
      animation: {
        'pulse-dot': 'pulse-dot 1.6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}

export default config
