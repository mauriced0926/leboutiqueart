import { HeuristicFlag, HeuristicReport } from './types'

// Phrases/tics disproportionately common in LLM output as of recent model
// generations. This list drifts as models change — it's a cheap supporting
// signal, not a ground-truth fingerprint.
const AI_TELL_PHRASES = [
  'delve into',
  'tapestry',
  'boundaries',
  "it's important to note",
  'it is important to note',
  'in conclusion',
  'in summary',
  'moreover',
  'furthermore',
  'additionally,',
  'navigate',
  'landscape',
  'robust',
  'seamless',
  'seamlessly',
  'elevate',
  'leverage',
  'holistic',
  'paradigm shift',
  'underscore',
  'foster',
  'intricate',
  'multifaceted',
  'cannot be overstated',
  'as an ai language model',
  'i hope this helps',
  "let's dive in",
  'unlock the power',
  "in today's fast-paced world",
  'unlock the potential',
  'plays a crucial role',
  'plays a vital role',
  'testament to',
  'stands as a',
  'game-changer',
  'game changer',
]

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"'])/)
    .filter((s) => s.trim().length > 0)
}

function mean(nums: number[]): number {
  if (nums.length === 0) return 0
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

function stdDev(nums: number[]): number {
  if (nums.length < 2) return 0
  const m = mean(nums)
  const variance = mean(nums.map((n) => (n - m) ** 2))
  return Math.sqrt(variance)
}

export function analyzeHeuristics(text: string): HeuristicReport {
  const words = text.trim().split(/\s+/).filter(Boolean)
  const wordCount = words.length
  const sentences = splitSentences(text)
  const sentenceCount = sentences.length
  const sentenceLengths = sentences.map((s) => s.split(/\s+/).filter(Boolean).length)
  const avgSentenceLength = mean(sentenceLengths)
  const sentenceLengthStdDev = stdDev(sentenceLengths)

  const lowerWords = words.map((w) => w.toLowerCase().replace(/[^a-z0-9']/g, ''))
  const uniqueWords = new Set(lowerWords.filter(Boolean))
  const typeTokenRatio = wordCount > 0 ? uniqueWords.size / wordCount : 0

  const emDashCount = (text.match(/—/g) || []).length
  const emDashPer1000Words = wordCount > 0 ? (emDashCount / wordCount) * 1000 : 0

  const markdownListUsage = /(^|\n)\s*([-*•]|\d+\.)\s+/.test(text)

  const lowerText = text.toLowerCase()
  const flaggedPhrases: HeuristicFlag[] = AI_TELL_PHRASES.map((phrase) => {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const matches = lowerText.match(new RegExp(escaped, 'g'))
    return { phrase, count: matches ? matches.length : 0 }
  }).filter((f) => f.count > 0)

  // Cheap composite score: burstiness (low sentence-length variance reads
  // more "AI-uniform"), phrase density, and em-dash overuse.
  const burstinessScore =
    avgSentenceLength > 0
      ? Math.max(0, 1 - sentenceLengthStdDev / avgSentenceLength) * 100
      : 0
  const phraseDensity = wordCount > 0 ? (flaggedPhrases.reduce((a, f) => a + f.count, 0) / wordCount) * 1000 : 0
  const phraseScore = Math.min(100, phraseDensity * 12)
  const emDashScore = Math.min(100, emDashPer1000Words * 8)

  const aiTellScore = Math.round(
    Math.min(100, burstinessScore * 0.4 + phraseScore * 0.4 + emDashScore * 0.2)
  )

  return {
    wordCount,
    sentenceCount,
    avgSentenceLength: Math.round(avgSentenceLength * 10) / 10,
    sentenceLengthStdDev: Math.round(sentenceLengthStdDev * 10) / 10,
    typeTokenRatio: Math.round(typeTokenRatio * 1000) / 1000,
    emDashPer1000Words: Math.round(emDashPer1000Words * 10) / 10,
    markdownListUsage,
    flaggedPhrases: flaggedPhrases.sort((a, b) => b.count - a.count),
    aiTellScore,
  }
}
