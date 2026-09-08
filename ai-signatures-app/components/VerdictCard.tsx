import { FinalVerdict } from '@/lib/types'
import ConfidenceGauge from './ConfidenceGauge'

export default function VerdictCard({ final }: { final: FinalVerdict }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border-hi bg-surface p-6 sm:p-7">
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-accent/10 blur-3xl" />

      <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
        <ConfidenceGauge value={final.confidence} ring="accent" />

        <div className="min-w-0 flex-1">
          <div className="font-mono text-[11px] uppercase tracking-widest text-accent">
            Ensemble verdict
          </div>
          <div className="mt-1 text-2xl font-semibold sm:text-3xl">{final.label}</div>
          <p className="mt-3 text-sm leading-relaxed text-text/80">{final.summary}</p>
          {final.caveats && (
            <p className="mt-3 border-l-2 border-warn/40 pl-3 font-mono text-xs leading-relaxed text-muted">
              {final.caveats}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
