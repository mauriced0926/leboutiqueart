import { AnalyzeResult, HeuristicReport, JudgeVerdict } from './types'
import { buildJudgePrompt } from './prompts'
import { synthesizeJudgment } from './providers/claude'
import { analyzeHeuristics } from './heuristics'

function summarizeHeuristics(h: HeuristicReport): string {
  const phrases = h.flaggedPhrases.slice(0, 6).map((f) => `"${f.phrase}" x${f.count}`).join(', ') || 'none'
  return [
    `words=${h.wordCount}, sentences=${h.sentenceCount}, avgSentenceLen=${h.avgSentenceLength}, sentenceLenStdDev=${h.sentenceLengthStdDev}`,
    `typeTokenRatio=${h.typeTokenRatio}, emDashPer1000Words=${h.emDashPer1000Words}, markdownLists=${h.markdownListUsage}`,
    `flaggedPhrases: ${phrases}`,
    `composite aiTellScore (0-100, heuristic-only): ${h.aiTellScore}`,
  ].join('\n')
}

export async function runEnsemble(text: string, judges: JudgeVerdict[]): Promise<AnalyzeResult> {
  const heuristics = analyzeHeuristics(text)
  const heuristicsSummary = summarizeHeuristics(heuristics)

  const judgePrompt = buildJudgePrompt(
    text,
    judges.map((j) => ({
      provider: j.provider,
      label: j.label,
      confidence: j.confidence,
      reasoning: j.reasoning,
    })),
    heuristicsSummary
  )

  const final = await synthesizeJudgment(judgePrompt)

  return {
    final,
    judges,
    heuristics,
  }
}
