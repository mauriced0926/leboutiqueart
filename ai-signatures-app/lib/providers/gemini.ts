import { GoogleGenerativeAI } from '@google/generative-ai'
import { JudgeVerdict, ModelLabel } from '../types'
import { buildClassifyPrompt, VALID_LABELS } from '../prompts'
import { extractJsonObject } from '../parseJson'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash'

function coerceLabel(label: unknown): ModelLabel {
  return (VALID_LABELS as readonly string[]).includes(label as string)
    ? (label as ModelLabel)
    : 'Uncertain'
}

export async function classifyWithGemini(text: string): Promise<JudgeVerdict> {
  const model = genAI.getGenerativeModel({ model: MODEL })
  const result = await model.generateContent(buildClassifyPrompt(text))
  const raw = result.response.text()

  const parsed = extractJsonObject(raw) as {
    label?: string
    confidence?: number
    reasoning?: string
    quotedEvidence?: string[]
  }

  return {
    provider: 'gemini',
    label: coerceLabel(parsed.label),
    confidence: Math.max(0, Math.min(100, Math.round(parsed.confidence ?? 0))),
    reasoning: parsed.reasoning ?? 'No reasoning returned.',
    quotedEvidence: Array.isArray(parsed.quotedEvidence) ? parsed.quotedEvidence.slice(0, 3) : [],
  }
}
