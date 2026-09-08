const META = {
  claude: { letter: 'C', color: '#e08a5e', name: 'Claude' },
  gemini: { letter: 'G', color: '#5b9dff', name: 'Gemini' },
} as const

export default function ProviderBadge({ provider }: { provider: 'claude' | 'gemini' }) {
  const m = META[provider]
  return (
    <span
      className="flex h-6 w-6 items-center justify-center rounded-md font-mono text-[11px] font-bold"
      style={{ backgroundColor: `${m.color}1f`, color: m.color, border: `1px solid ${m.color}55` }}
    >
      {m.letter}
    </span>
  )
}

export function providerName(provider: 'claude' | 'gemini') {
  return META[provider].name
}
