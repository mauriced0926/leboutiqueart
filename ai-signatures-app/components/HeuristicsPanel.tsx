import { HeuristicReport } from '@/lib/types'
import ConfidenceBar from './ConfidenceBar'

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-wide text-dim">{label}</div>
      <div className="mt-0.5 font-mono text-lg tabular-nums text-text">{value}</div>
    </div>
  )
}

export default function HeuristicsPanel({ heuristics }: { heuristics: HeuristicReport }) {
  return (
    <div className="rounded-2xl bg-surface p-6 shadow-card">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] uppercase tracking-wide text-muted">
          Local stylometric scan
        </span>
        <span className="font-mono text-[10px] uppercase tracking-wide text-dim">
          not authoritative
        </span>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <span className="whitespace-nowrap font-mono text-[11px] uppercase tracking-wide text-dim">
          AI-tell score
        </span>
        <ConfidenceBar value={heuristics.aiTellScore} colorClass="bg-warn" />
        <span className="font-mono text-xs tabular-nums text-muted">{heuristics.aiTellScore}/100</span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3">
        <Stat label="Words" value={heuristics.wordCount} />
        <Stat label="Sentences" value={heuristics.sentenceCount} />
        <Stat label="Avg len" value={heuristics.avgSentenceLength} />
        <Stat label="Len σ" value={heuristics.sentenceLengthStdDev} />
        <Stat label="Vocab diversity" value={heuristics.typeTokenRatio} />
        <Stat label="Em dash /1000w" value={heuristics.emDashPer1000Words} />
      </div>

      {heuristics.flaggedPhrases.length > 0 && (
        <div className="mt-5">
          <div className="font-mono text-[10px] uppercase tracking-wide text-dim">
            Flagged phrases
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {heuristics.flaggedPhrases.map((f) => (
              <span
                key={f.phrase}
                className="rounded-md bg-bg px-2 py-1 font-mono text-[11px] text-muted"
              >
                {f.phrase} <span className="text-dim">×{f.count}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
