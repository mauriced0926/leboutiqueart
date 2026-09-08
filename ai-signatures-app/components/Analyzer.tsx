'use client'

import { useRef, useState } from 'react'
import { Upload, Loader2, TriangleAlert } from 'lucide-react'
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
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <Header />

      <div className="mb-8">
        <div className="font-mono text-xs uppercase tracking-[0.3em] text-accent">
          Text-origin analysis
        </div>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
          AI Signatures
        </h1>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted">
          Paste or upload text. Claude and Gemini independently guess which model wrote it, a judge
          pass reconciles their verdicts, and a local style scan runs alongside.
        </p>
      </div>

      <div className="mb-6 flex gap-3 rounded-lg border border-warn/25 bg-warn/[0.06] px-4 py-3 text-xs text-warn/90">
        <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <p className="leading-relaxed">
          Best-effort style estimate, not proof of authorship. No provider exposes a verifiable
          watermark-check API for arbitrary text, so results can be wrong — especially on short,
          edited, or heavily revised passages.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <div className="flex items-center gap-2 border-b border-border bg-surface2 px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-bad/60" />
          <span className="h-2.5 w-2.5 rounded-full bg-warn/60" />
          <span className="h-2.5 w-2.5 rounded-full bg-good/60" />
          <span className="ml-2 font-mono text-[11px] text-dim">input.txt</span>
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste text here (at least 40 characters)…"
          rows={9}
          className="w-full resize-y bg-transparent p-4 font-mono text-[13px] leading-relaxed text-text outline-none placeholder:text-dim"
        />

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 font-mono text-xs text-muted transition-colors hover:border-border-hi hover:text-text"
            >
              <Upload className="h-3.5 w-3.5" />
              upload .txt / .md
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,text/plain,text/markdown"
              onChange={handleFileUpload}
              className="hidden"
            />
            <span className="font-mono text-xs tabular-nums text-dim">
              {text.trim().length} chars
            </span>
          </div>
          <button
            onClick={handleAnalyze}
            disabled={loading}
            className="flex items-center gap-2 rounded-md bg-accent px-5 py-2 font-mono text-xs font-semibold uppercase tracking-widest text-bg shadow-[0_0_20px_-4px_rgba(94,234,212,0.5)] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {loading ? 'Analyzing…' : 'Analyze'}
          </button>
        </div>
      </div>

      {!result && !loading && <ExampleChips onPick={setText} />}

      {error && (
        <div className="mt-4 rounded-lg border border-bad/30 bg-bad/10 px-4 py-3 text-sm text-bad">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-8 space-y-5">
          <VerdictCard final={result.final} />

          <div className="grid gap-4 sm:grid-cols-2">
            {result.judges.map((j) => (
              <JudgeCard key={j.provider} verdict={j} />
            ))}
          </div>

          <HeuristicsPanel heuristics={result.heuristics} />

          {result.providerErrors.length > 0 && (
            <div className="rounded-lg border border-warn/25 bg-warn/[0.06] px-4 py-3 font-mono text-xs text-warn/90">
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
