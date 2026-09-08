'use client'

import { useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { AnalyzeResult } from '@/lib/types'
import Header from './Header'
import ExampleChips from './ExampleChips'
import VerdictCard from './VerdictCard'
import JudgeCard from './JudgeCard'
import HeuristicsPanel from './HeuristicsPanel'

const MIN_CHARS = 40

export default function Analyzer() {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<(AnalyzeResult & { providerErrors: string[] }) | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleAnalyze() {
    setError(null)
    setResult(null)
    if (text.trim().length < MIN_CHARS) {
      setError(`Please provide at least ${MIN_CHARS} characters of text to analyze.`)
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Analysis failed.')
      }
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const content = await file.text()
    setText(content)
    setResult(null)
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:py-16">
      <Header />

      <div className="mb-9 max-w-xl">
        <h1 className="font-display text-[42px] font-semibold leading-[1.08] tracking-tight text-text sm:text-[52px]">
          Which model wrote this?
        </h1>
        <p className="mt-4 text-[16px] leading-relaxed text-muted">
          Paste or upload text. Claude and Gemini independently guess which model wrote it, a judge
          pass reconciles their verdicts, and a local style scan runs alongside.
        </p>
      </div>

      <div className="mb-8 flex gap-3 rounded-xl bg-surface px-5 py-4 shadow-card">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" className="mt-0.5 shrink-0 text-warn" strokeWidth="2">
          <circle cx="12" cy="12" r="9" stroke="currentColor" />
          <path d="M12 8 V13" stroke="currentColor" strokeLinecap="round" />
          <circle cx="12" cy="16.3" r="0.6" fill="currentColor" stroke="none" />
        </svg>
        <p className="text-[13.5px] leading-relaxed text-muted">
          Best-effort style estimate, not proof of authorship. No provider exposes a verifiable
          watermark-check API for arbitrary text, so results can be wrong — especially on short,
          edited, or heavily revised passages.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl bg-surface shadow-card">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste text here (at least 40 characters)…"
          rows={9}
          className="w-full resize-y bg-transparent p-6 pb-16 font-mono text-[13.5px] leading-relaxed text-text outline-none placeholder:text-dim"
        />

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-soft px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3.5 py-2 font-display text-xs font-medium text-muted transition-colors hover:text-text"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 16 V4 M12 4 L7 9 M12 4 L17 9" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M4 17 V19 A2 2 0 0 0 6 21 H18 A2 2 0 0 0 20 19 V17" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Upload .txt / .md
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,text/plain,text/markdown"
              onChange={handleFileUpload}
              className="hidden"
            />
            <span className="font-mono text-xs text-dim">{text.trim().length} chars</span>
          </div>
          <button
            onClick={handleAnalyze}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-accent px-6 py-2.5 font-display text-[13.5px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {loading ? 'Analyzing…' : 'Analyze'}
          </button>
        </div>
      </div>

      {!result && !loading && <ExampleChips onPick={setText} />}

      {error && (
        <div className="mt-4 rounded-xl bg-surface px-5 py-3 text-sm text-bad shadow-card">{error}</div>
      )}

      {result && (
        <div className="mt-9 space-y-5">
          <VerdictCard final={result.final} />

          <div className="grid gap-4 sm:grid-cols-2">
            {result.judges.map((j) => (
              <JudgeCard key={j.provider} verdict={j} />
            ))}
          </div>

          <HeuristicsPanel heuristics={result.heuristics} />

          {result.providerErrors.length > 0 && (
            <div className="rounded-xl bg-surface px-5 py-3 font-mono text-xs text-warn shadow-card">
              {result.providerErrors.map((e, i) => (
                <div key={i}>{e}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
