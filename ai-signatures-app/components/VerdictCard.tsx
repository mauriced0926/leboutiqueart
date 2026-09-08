import { FinalVerdict } from '@/lib/types'
import ConfidenceBar from './ConfidenceBar'

export default function VerdictCard({ final }: { final: FinalVerdict }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-6">
      <div className="text-xs uppercase tracking-widest text-muted">Ensemble verdict</div>
      <div className="mt-2 flex items-baseline gap-3">
        <span className="text-3xl font-semibold">{final.label}</span>
        <span className="text-lg text-muted">{final.confidence}% confidence</span>
      </div>
      <div className="mt-4">
        <ConfidenceBar value={final.confidence} />
      </div>
      <p className="mt-4 text-sm leading-relaxed text-text/90">{final.summary}</p>
      {final.caveats && (
        <p className="mt-3 text-xs leading-relaxed text-muted italic">Caveat: {final.caveats}</p>
      )}
    </div>
  )
}
