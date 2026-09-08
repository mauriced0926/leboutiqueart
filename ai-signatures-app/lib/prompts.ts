export const VALID_LABELS = [
  'GPT (OpenAI)',
  'Claude (Anthropic)',
  'Gemini (Google)',
  'Llama / open-source',
  'Human-written',
  'Uncertain',
] as const

export function buildClassifyPrompt(text: string): string {
  return `You are a forensic text-style analyst. You will be shown a piece of text and must guess its most likely origin.

Candidate labels (pick exactly one):
${VALID_LABELS.map((l) => `- ${l}`).join('\n')}

Base your guess only on observable style: vocabulary tics, sentence rhythm, formatting habits (markdown, em dashes, bullet structure), hedging patterns, and known stylistic fingerprints of major model families as of their recent generations. This is an inherently uncertain, best-effort judgment — you are NOT verifying authorship, only estimating it. If nothing distinctive stands out, prefer "Uncertain" or "Human-written" over a confident guess.

Respond with ONLY a JSON object, no markdown fences, no commentary, in this exact shape:
{"label": "<one of the candidate labels, verbatim>", "confidence": <integer 0-100>, "reasoning": "<2-4 sentences citing specific style evidence>", "quotedEvidence": ["<short verbatim quote from the text, <=10 words>", "..."]}

quotedEvidence should contain 0-3 short exact substrings copied from the text that most influenced your guess. Omit it (empty array) if nothing specific stands out.

TEXT TO ANALYZE:
"""
${text}
"""`
}

export function buildJudgePrompt(
  text: string,
  verdicts: { provider: string; label: string; confidence: number; reasoning: string }[],
  heuristicsSummary: string
): string {
  return `You are the final arbiter in an ensemble that estimates which AI model (if any) generated a piece of text. Two independent model judges analyzed the text blind (without seeing each other's answers), and a cheap local heuristic scan also ran. Reconcile all three into one final verdict.

Candidate labels (pick exactly one):
${VALID_LABELS.map((l) => `- ${l}`).join('\n')}

Independent judge verdicts:
${verdicts.map((v) => `- ${v.provider}: "${v.label}" (confidence ${v.confidence}) — ${v.reasoning}`).join('\n')}

Local heuristic scan (cheap, stylometric only, not authoritative):
${heuristicsSummary}

Guidance: when judges agree, that raises confidence; when they disagree, be more conservative and lean toward "Uncertain" unless one judge's reasoning is clearly stronger. A model is generally a weaker judge of its own output's origin than of other models', so don't over-trust a judge's self-identification. Remember: this whole exercise is a probabilistic style estimate, not proof — always convey that limitation.

Respond with ONLY a JSON object, no markdown fences, no commentary, in this exact shape:
{"label": "<one of the candidate labels, verbatim>", "confidence": <integer 0-100>, "summary": "<2-4 sentence synthesis explaining the final call and where the judges agreed or diverged>", "caveats": "<1-2 sentences on why this could be wrong>"}

ORIGINAL TEXT (for your reference):
"""
${text}
"""`
}
