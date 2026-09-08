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
        bg: '#faf9f7',
        surface: '#ffffff',
        'border-soft': '#efeeea',
        border: '#e5e3df',
        text: '#141414',
        muted: '#5c5c58',
        dim: '#adada8',
        track: '#eeece7',
        accent: 'oklch(55% 0.09 220)',
        'accent-soft': 'oklch(55% 0.09 220 / 0.08)',
        claude: '#e08a5e',
        gemini: '#5b9dff',
        warn: 'oklch(65% 0.15 70)',
        bad: '#d9483f',
      },
      fontFamily: {
        sans: ['var(--font-body)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(20,20,20,0.04), 0 8px 24px -8px rgba(20,20,20,0.08)',
      },
    },
  },
  plugins: [],
}

export default config
