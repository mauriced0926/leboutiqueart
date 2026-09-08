import { JudgeVerdict } from '@/lib/types'
import ConfidenceBar from './ConfidenceBar'

const PROVIDER_META = {
  claude: { name: 'Claude', colorClass: 'bg-claude', dot: 'bg-claude' },
  gemini: { name: 'Gemini', colorClass: 'bg-gemini', dot: 'bg-gemini' },
}

export default function JudgeCard({ verdict }: { verdict: JudgeVerdict }) {
  const meta = PROVIDER_META[verdict.provider]
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
        <span className="text-sm font-medium text-muted">{meta.name} judge</span>
      </div>
      <div className="mt-2 text-lg font-semibold">{verdict.label}</div>
      <div className="mt-2">
        <ConfidenceBar value={verdict.confidence} colorClass={meta.colorClass} />
      </div>
      <div className="mt-1 text-xs text-muted">{verdict.confidence}% confidence</div>
      <p className="mt-3 text-sm leading-relaxed text-text/85">{verdict.reasoning}</p>
      {verdict.quotedEvidence.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {verdict.quotedEvidence.map((q, i) => (
            <div key={i} className="rounded-md bg-black/30 px-2.5 py-1.5 text-xs italic text-muted">
              &ldquo;{q}&rdquo;
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
