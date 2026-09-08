import { FinalVerdict } from '@/lib/types'
import ConfidenceGauge from './ConfidenceGauge'

export default function VerdictCard({ final }: { final: FinalVerdict }) {
  return (
    <div className="flex flex-col items-center gap-6 rounded-2xl bg-surface p-8 shadow-card sm:flex-row sm:items-center sm:p-9">
      <ConfidenceGauge value={final.confidence} ring="accent" />

      <div className="min-w-0 flex-1 text-center sm:text-left">
        <div className="font-mono text-[11px] uppercase tracking-wide text-accent">
          Ensemble verdict
        </div>
        <div className="mt-1 font-display text-[28px] font-semibold text-text">{final.label}</div>
        <p className="mx-auto mt-2.5 max-w-xl text-[14.5px] leading-relaxed text-muted sm:mx-0">
          {final.summary}
        </p>
        {final.caveats && (
          <p className="mt-3 font-mono text-xs leading-relaxed text-dim">{final.caveats}</p>
        )}
      </div>
    </div>
  )
}
