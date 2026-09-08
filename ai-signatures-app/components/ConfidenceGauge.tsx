const RING_COLORS: Record<string, string> = {
  accent: '#5eead4',
  claude: '#e08a5e',
  gemini: '#5b9dff',
}

export default function ConfidenceGauge({
  value,
  ring = 'accent',
}: {
  value: number
  ring?: 'accent' | 'claude' | 'gemini'
}) {
  const pct = Math.max(0, Math.min(100, value))
  const color = RING_COLORS[ring]

  return (
    <div
      className="relative h-28 w-28 shrink-0 rounded-full transition-[background] duration-700"
      style={{
        background: `conic-gradient(${color} ${pct * 3.6}deg, rgba(255,255,255,0.07) 0deg)`,
      }}
    >
      <div className="absolute inset-[7px] flex flex-col items-center justify-center rounded-full bg-surface">
        <span className="font-mono text-2xl font-semibold tabular-nums text-text">{pct}</span>
        <span className="font-mono text-[9px] uppercase tracking-widest text-dim">percent</span>
      </div>
    </div>
  )
}
