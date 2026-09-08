import { HeuristicReport } from '@/lib/types'
import ConfidenceBar from './ConfidenceBar'

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="text-xs text-muted">{label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  )
}

export default function HeuristicsPanel({ heuristics }: { heuristics: HeuristicReport }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted">Local stylometric scan</span>
        <span className="text-xs text-muted">not authoritative</span>
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between text-xs text-muted">
          <span>&ldquo;AI-tell&rdquo; composite score</span>
          <span>{heuristics.aiTellScore}/100</span>
        </div>
        <div className="mt-1">
          <ConfidenceBar value={heuristics.aiTellScore} colorClass="bg-warn" />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Words" value={heuristics.wordCount} />
        <Stat label="Sentences" value={heuristics.sentenceCount} />
        <Stat label="Avg sentence length" value={heuristics.avgSentenceLength} />
        <Stat label="Sentence length σ" value={heuristics.sentenceLengthStdDev} />
        <Stat label="Vocab diversity" value={heuristics.typeTokenRatio} />
        <Stat label="Em dashes / 1000w" value={heuristics.emDashPer1000Words} />
      </div>

      {heuristics.flaggedPhrases.length > 0 && (
        <div className="mt-4">
          <div className="text-xs text-muted">Common AI-writing phrases found</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {heuristics.flaggedPhrases.map((f) => (
              <span
                key={f.phrase}
                className="rounded-full border border-border bg-black/30 px-2.5 py-1 text-xs text-text/80"
              >
                {f.phrase} × {f.count}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
