export default function ConfidenceBar({ value, colorClass = 'bg-accent' }: { value: number; colorClass?: string }) {
  return (
    <div className="h-1 w-full flex-1 rounded-full bg-white/[0.06]">
      <div
        className={`h-1 rounded-full ${colorClass} transition-all duration-700`}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  )
}
