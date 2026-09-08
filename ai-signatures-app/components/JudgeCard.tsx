import { JudgeVerdict } from '@/lib/types'
import ProviderBadge, { providerName } from './ProviderBadge'
import ConfidenceBar from './ConfidenceBar'

const BAR_COLOR: Record<JudgeVerdict['provider'], string> = {
  claude: 'bg-claude',
  gemini: 'bg-gemini',
}

export default function JudgeCard({ verdict }: { verdict: JudgeVerdict }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="flex items-center gap-2.5">
        <ProviderBadge provider={verdict.provider} />
        <span className="font-mono text-[11px] uppercase tracking-widest text-muted">
          {providerName(verdict.provider)} judge
        </span>
      </div>

      <div className="mt-3 text-lg font-semibold">{verdict.label}</div>

      <div className="mt-3 flex items-center gap-2">
        <ConfidenceBar value={verdict.confidence} colorClass={BAR_COLOR[verdict.provider]} />
        <span className="font-mono text-xs tabular-nums text-muted">{verdict.confidence}%</span>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-text/80">{verdict.reasoning}</p>

      {verdict.quotedEvidence.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {verdict.quotedEvidence.map((q, i) => (
            <div
              key={i}
              className="rounded-md border border-border bg-bg/60 px-2.5 py-1.5 font-mono text-[11px] text-muted"
            >
              &ldquo;{q}&rdquo;
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
