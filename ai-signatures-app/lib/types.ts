export type Provider = 'claude' | 'gemini'

export type ModelLabel =
  | 'GPT (OpenAI)'
  | 'Claude (Anthropic)'
  | 'Gemini (Google)'
  | 'Llama / open-source'
  | 'Human-written'
  | 'Uncertain'

export interface JudgeVerdict {
  provider: Provider
  label: ModelLabel
  confidence: number // 0-100
  reasoning: string
  quotedEvidence: string[]
}

export interface HeuristicFlag {
  phrase: string
  count: number
}

export interface HeuristicReport {
  wordCount: number
  sentenceCount: number
  avgSentenceLength: number
  sentenceLengthStdDev: number
  typeTokenRatio: number
  emDashPer1000Words: number
  markdownListUsage: boolean
  flaggedPhrases: HeuristicFlag[]
  aiTellScore: number // 0-100, heuristic-only, cheap signal
}

export interface FinalVerdict {
  label: ModelLabel
  confidence: number
  summary: string
  caveats: string
}

export interface AnalyzeResult {
  final: FinalVerdict
  judges: JudgeVerdict[]
  heuristics: HeuristicReport
}
