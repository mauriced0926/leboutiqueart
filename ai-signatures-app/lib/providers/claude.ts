import Anthropic from '@anthropic-ai/sdk'
import { JudgeVerdict, ModelLabel } from '../types'
import { buildClassifyPrompt, VALID_LABELS } from '../prompts'
import { extractJsonObject } from '../parseJson'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5'

function coerceLabel(label: unknown): ModelLabel {
  return (VALID_LABELS as readonly string[]).includes(label as string)
    ? (label as ModelLabel)
    : 'Uncertain'
}

export async function classifyWithClaude(text: string): Promise<JudgeVerdict> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    messages: [{ role: 'user', content: buildClassifyPrompt(text) }],
  })

  const raw = response.content[0].type === 'text' ? response.content[0].text : '{}'
  const parsed = extractJsonObject(raw) as {
    label?: string
    confidence?: number
    reasoning?: string
    quotedEvidence?: string[]
  }

  return {
    provider: 'claude',
    label: coerceLabel(parsed.label),
    confidence: Math.max(0, Math.min(100, Math.round(parsed.confidence ?? 0))),
    reasoning: parsed.reasoning ?? 'No reasoning returned.',
    quotedEvidence: Array.isArray(parsed.quotedEvidence) ? parsed.quotedEvidence.slice(0, 3) : [],
  }
}

export async function synthesizeJudgment(prompt: string): Promise<{
  label: ModelLabel
  confidence: number
  summary: string
  caveats: string
}> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })

  const raw = response.content[0].type === 'text' ? response.content[0].text : '{}'
  const parsed = extractJsonObject(raw) as {
    label?: string
    confidence?: number
    summary?: string
    caveats?: string
  }

  return {
    label: coerceLabel(parsed.label),
    confidence: Math.max(0, Math.min(100, Math.round(parsed.confidence ?? 0))),
    summary: parsed.summary ?? 'No summary returned.',
    caveats: parsed.caveats ?? '',
  }
}
