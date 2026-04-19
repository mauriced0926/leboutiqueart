import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Light mode
        'lm-bg': '#ffffff',
        'lm-surface': '#f7f6f3',
        'lm-border': '#e8e8e4',
        'lm-text': '#1a1a1a',
        'lm-muted': '#888884',
        // Dark mode
        'dm-bg': '#0a0a0a',
        'dm-surface': '#141414',
        'dm-border': '#2a2a2a',
        'dm-text': '#f5f0e8',
        'dm-muted': '#888888',
        // Shared accent
        gold: '#c9a84c',
        'gold-light': '#e8d4a0',
      },
      fontFamily: {
        serif: ['var(--font-cormorant)', 'Cormorant Garamond', 'Georgia', 'serif'],
        sans: ['var(--font-dm-sans)', 'DM Sans', 'system-ui', 'sans-serif'],
      },
      letterSpacing: {
        widest: '0.25em',
        ultra: '0.35em',
      },
      transitionDuration: {
        '400': '400ms',
        '600': '600ms',
      },
    },
  },
  plugins: [],
}

export default config
