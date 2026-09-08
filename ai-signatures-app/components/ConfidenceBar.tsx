export default function ConfidenceBar({ value, colorClass = 'bg-accent' }: { value: number; colorClass?: string }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-white/10">
      <div
        className={`h-1.5 rounded-full ${colorClass} transition-all duration-500`}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  )
}
