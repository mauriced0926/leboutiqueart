import { NextRequest, NextResponse } from 'next/server'
import { classifyWithClaude } from '@/lib/providers/claude'
import { classifyWithGemini } from '@/lib/providers/gemini'
import { runEnsemble } from '@/lib/judge'
import { JudgeVerdict } from '@/lib/types'

const MIN_CHARS = 40
const MAX_CHARS = 20000

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json()

    if (typeof text !== 'string' || text.trim().length < MIN_CHARS) {
      return NextResponse.json(
        { error: `Please provide at least ${MIN_CHARS} characters of text to analyze.` },
        { status: 400 }
      )
    }
    if (text.length > MAX_CHARS) {
      return NextResponse.json(
        { error: `Text is too long (max ${MAX_CHARS} characters).` },
        { status: 400 }
      )
    }

    const settled = await Promise.allSettled([classifyWithClaude(text), classifyWithGemini(text)])

    const judges: JudgeVerdict[] = []
    const providerErrors: string[] = []

    settled.forEach((result, i) => {
      const provider = i === 0 ? 'Claude' : 'Gemini'
      if (result.status === 'fulfilled') {
        judges.push(result.value)
      } else {
        providerErrors.push(`${provider}: ${result.reason?.message ?? 'request failed'}`)
      }
    })

    if (judges.length === 0) {
      return NextResponse.json(
        { error: 'All model judges failed.', providerErrors },
        { status: 502 }
      )
    }

    const result = await runEnsemble(text, judges)

    return NextResponse.json({ ...result, providerErrors })
  } catch (err) {
    console.error('Analyze API error:', err)
    return NextResponse.json({ error: 'Failed to analyze text.' }, { status: 500 })
  }
}
