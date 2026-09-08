const RING_COLORS: Record<string, string> = {
  accent: 'oklch(55% 0.09 220)',
  claude: '#e08a5e',
  gemini: '#5b9dff',
}

const RADIUS = 48
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export default function ConfidenceGauge({
  value,
  ring = 'accent',
  size = 112,
}: {
  value: number
  ring?: 'accent' | 'claude' | 'gemini'
  size?: number
}) {
  const pct = Math.max(0, Math.min(100, value))
  const color = RING_COLORS[ring]
  const offset = CIRCUMFERENCE * (1 - pct / 100)
  const c = size / 2

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <circle cx={c} cy={c} r={RADIUS} fill="none" stroke="#eeece7" strokeWidth="10" />
      <circle
        cx={c}
        cy={c}
        r={RADIUS}
        fill="none"
        stroke={color}
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${c} ${c})`}
        style={{ transition: 'stroke-dashoffset 0.7s ease' }}
      />
      <text
        x={c}
        y={c - 4}
        textAnchor="middle"
        fontFamily="var(--font-mono), monospace"
        fontSize="30"
        fontWeight="600"
        fill="#141414"
      >
        {pct}
      </text>
      <text
        x={c}
        y={c + 14}
        textAnchor="middle"
        fontFamily="var(--font-mono), monospace"
        fontSize="10"
        letterSpacing="0.1em"
        fill="#adada8"
      >
        PERCENT
      </text>
    </svg>
  )
}
