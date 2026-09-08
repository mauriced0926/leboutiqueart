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
        bg: '#0b0d12',
        surface: '#12151c',
        border: '#232833',
        text: '#e8eaed',
        muted: '#8b93a1',
        accent: '#7c9eff',
        claude: '#d97757',
        gemini: '#4285f4',
        good: '#4ade80',
        warn: '#facc15',
        bad: '#f87171',
      },
    },
  },
  plugins: [],
}

export default config
