'use client'

import { useRef, useState } from 'react'
import { Upload, Loader2, AlertTriangle } from 'lucide-react'
import { AnalyzeResult } from '@/lib/types'
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
    <div className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">AI Signatures</h1>
        <p className="mt-2 text-muted">
          Paste or upload text. Claude and Gemini each independently guess which AI model wrote it,
          then a judge model reconciles their verdicts alongside a local style scan.
        </p>
      </header>

      <div className="mb-6 flex gap-3 rounded-xl border border-warn/30 bg-warn/10 p-4 text-sm text-warn">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          This is a best-effort style estimate, not proof of authorship. No provider currently exposes a
          verifiable watermark/signature API for arbitrary text, so results can be wrong — especially on
          short, edited, or heavily human-revised passages.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-4">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste text here (at least 40 characters)…"
          rows={10}
          className="w-full resize-y rounded-lg bg-transparent p-2 text-sm leading-relaxed outline-none placeholder:text-muted"
        />
        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted hover:text-text"
            >
              <Upload className="h-3.5 w-3.5" />
              Upload .txt / .md
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,text/plain,text/markdown"
              onChange={handleFileUpload}
              className="hidden"
            />
            <span className="text-xs text-muted">{text.trim().length} chars</span>
          </div>
          <button
            onClick={handleAnalyze}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? 'Analyzing…' : 'Analyze'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-bad/30 bg-bad/10 p-3 text-sm text-bad">{error}</div>
      )}

      {result && (
        <div className="mt-8 space-y-6">
          <VerdictCard final={result.final} />

          <div className="grid gap-4 sm:grid-cols-2">
            {result.judges.map((j) => (
              <JudgeCard key={j.provider} verdict={j} />
            ))}
          </div>

          <HeuristicsPanel heuristics={result.heuristics} />

          {result.providerErrors.length > 0 && (
            <div className="rounded-lg border border-warn/30 bg-warn/10 p-3 text-xs text-warn">
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
