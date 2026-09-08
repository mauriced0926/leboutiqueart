# AI Signatures

Paste or upload text and get a best-effort estimate of which AI model generated it.

Standalone Next.js app — separate from the rest of this repository, no shared code or styling.

## How it works

1. Claude and Gemini are each asked, independently and blind to each other's answer, to guess
   the text's origin (GPT / Claude / Gemini / Llama-or-open-source / human-written / uncertain)
   with a confidence score and reasoning.
2. A local heuristic scan runs alongside (sentence-length burstiness, vocabulary diversity,
   em-dash frequency, common AI-writing phrases like "delve into" or "tapestry").
3. A judge pass (Claude) reconciles both independent verdicts plus the heuristic summary into one
   final label, confidence, and explanation.

**This is not a verified detector.** No provider currently exposes a public API to check text
against a real watermark/signature (Anthropic's API `signature` field is a thinking-block
integrity check, not a text watermark; Google's SynthID watermark for Gemini has no public
third-party detection API). Treat every result as a probabilistic style guess, not proof.

## Setup

```bash
npm install
cp .env.local.example .env.local
# fill in ANTHROPIC_API_KEY and GEMINI_API_KEY
npm run dev
```

## Env vars

- `ANTHROPIC_API_KEY` (required)
- `GEMINI_API_KEY` (required)
- `ANTHROPIC_MODEL` (optional, defaults to `claude-sonnet-5`)
- `GEMINI_MODEL` (optional, defaults to `gemini-2.5-flash`)
