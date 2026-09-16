/**
 * Episode generation via Claude, gated on novelty.
 *
 * The important design decision here: the novelty gate is *inside* the generation
 * loop, and its rejection reasons are fed back to the model as explicit constraints.
 * Asking a model for "something different" produces drift; telling it exactly which
 * axes clashed and with which episode produces convergence.
 */

import Anthropic from 'anthropic-sdk';
import { z } from 'zod';
import { zodOutputFormat } from 'anthropic-sdk/helpers/zod';
import { checkNovelty, nextEpisodeNumber } from './registry.mjs';

const EpisodeSchema = z.object({
  title: z.string().describe('YouTube title, under 60 chars, no clickbait, no emoji spam'),
  premise: z.string().describe('One sentence describing what is broken and why'),
  broken_object: z.string().describe('The object being repaired, 1-3 words'),
  cause: z.string().describe('Why it broke, 1-4 words'),
  broken_object_description: z.string().describe(
    'The object\'s defining visible features in one line, so every shot draws the same thing — ' +
    'e.g. "tin watering can with a long curved spout and a flat lid with a small air hole"'),
  fix_principle: z.string().describe('The physical principle used, in plain words a child could repeat'),
  visitor: z.string().describe('Which friend brings it in — a cast key, never mango'),
  activity: z.string().describe('What they were doing when it broke, a few words'),
  wrong_guess: z.string().describe("The friend's own reasonable-but-incorrect theory, a few words"),
  beats: z.array(z.object({
    n: z.number(),
    name: z.string(),
    seconds: z.number(),
    visual: z.string().describe('What is on screen — concrete and drawable. No camera jargon.'),
    caption: z.string().describe('On-screen caption for this beat, under 8 words, or empty'),
    lines: z.array(z.object({
      speaker: z.string().describe('A cast member key, lowercase, exactly as in the bible'),
      text: z.string().describe('What they say. Short — roughly 2.5 words per second of beat.'),
    })).describe('Dialogue for this beat, in order. Empty array for a wordless beat.'),
  })).describe('Exactly 8 beats matching the series formula, with the formula durations'),
  description: z.string().describe('YouTube description, 2-3 sentences, no hashtag spam'),
  tags: z.array(z.string()).max(12),
});

const MODEL = 'claude-opus-5';

function systemPrompt(bible) {
  return [
    'You write episodes for a single, consistent animated kids series. You are not',
    'generating generic content — you are writing the next episode of one authored show,',
    'and it must feel like it came from the same hand as every previous episode.',
    '',
    'THE SERIES BIBLE (authoritative — never contradict it):',
    JSON.stringify(bible, null, 2),
    '',
    'HARD REQUIREMENTS:',
    '- Exactly 8 beats, matching the formula names and durations in the bible.',
    '- Every `speaker` must be a cast key from the bible: mango, bramble, tolly, wren or pip.',
    '- MANGO IS THE FIXER, every episode. The visitor brings the problem and helps; Mango works',
    '  out why and explains it. Never hand the diagnosis or the explanation to anyone else.',
    '- The visitor opens by saying what they were DOING when it broke, not just that it broke.',
    "- The visitor offers their own wrong guess. It must be reasonable, and Mango rules it out kindly.",
    '- SHOW, do not tell. Each beat\'s `visual` must show the thing its dialogue is about.',
    '  If a line says "a wheel spins on a little stick", the visual shows the wheel, the stick',
    '  and the gap — not Mango gesturing. A child who cannot follow the words must still be',
    '  able to follow the fix from the pictures alone.',
    '- Do not state a count of anything visible (\'six corners\', \'three legs\') unless the count is',
    '  the point of the fix. If a line does state one, put the same count in that beat\'s `visual`,',
    '  or the picture will contradict the words.',
    '- Give each character their own voice on the page — Tolly is slow and low, Wren is fast and',
    '  chirpy, Pip is tiny and delighted, Bramble worries, Mango is calm. A reader should be able to',
    '  tell who is speaking without the name.',
    '- The fix must be physically real. A child must not learn something false.',
    '- Obey every entry in hard_rules.',
    '- The fix_principle must be nameable in plain words a four-year-old can repeat.',
    '- Narration total must be speakable in the beat duration — roughly 2.5 words per second.',
  ].join('\n');
}

function userPrompt(episodeNumber, history, rejections) {
  const recent = history.slice(-12).map((h) =>
    `  ep${h.episode}: ${h.broken_object} — ${h.fix_principle} — ${h.domain ?? '?'} — "${h.premise}"`);

  const parts = [
    `Write episode ${episodeNumber}.`,
    '',
    recent.length
      ? `Recent episodes (do not repeat these objects, principles or premises):\n${recent.join('\n')}`
      : 'This is the first episode. Establish the world lightly — no long introduction.',
  ];

  if (rejections?.length) {
    // Feeding the specific clash back is what makes retry converge instead of wander.
    parts.push(
      '',
      'Your previous attempt was REJECTED by the novelty gate for these exact reasons:',
      ...rejections.map((r) => `  - ${r}`),
      '',
      'Write a genuinely different episode. Changing a noun will be rejected again —',
      'the underlying repair and the physical principle must differ.',
    );
  }
  return parts.join('\n');
}

/**
 * Generate one novel episode.
 *
 * Retries are bounded: if the model cannot clear the gate in `maxAttempts`, that is a
 * signal worth surfacing (the series may be genuinely running out of room on some axis),
 * not something to paper over with a looser threshold.
 */
export async function generateEpisode({ bible, history, maxAttempts = 4, client = new Anthropic() }) {
  const episode = nextEpisodeNumber(history);
  let rejections = [];
  const attempts = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      thinking: { type: 'adaptive' },
      system: systemPrompt(bible),
      messages: [{ role: 'user', content: userPrompt(episode, history, rejections) }],
      output_config: { format: zodOutputFormat(EpisodeSchema) },
    });

    if (response.stop_reason === 'refusal') {
      throw new Error(`Generation refused by safety classifier: ${response.stop_details?.explanation ?? 'no explanation'}`);
    }

    const parsed = response.parsed_output;
    if (!parsed) {
      rejections = ['the previous response did not parse against the episode schema'];
      attempts.push({ attempt, error: 'parse failed' });
      continue;
    }

    const verdict = checkNovelty(parsed, history, bible);
    attempts.push({ attempt, title: parsed.title, ok: verdict.ok, reasons: verdict.reasons });

    if (verdict.ok) {
      return {
        episode: { ...parsed, episode, generated_at: new Date().toISOString(), model: MODEL },
        attempts,
      };
    }
    rejections = verdict.reasons;
  }

  throw new Error(
    `Could not generate a novel episode in ${maxAttempts} attempts. Last rejection:\n` +
    rejections.map((r) => `  - ${r}`).join('\n') +
    `\n\nThis usually means an axis is genuinely exhausted. Widen the cast or the object ` +
    `range in series-bible.json rather than lowering the similarity threshold.`
  );
}

export { EpisodeSchema, systemPrompt, userPrompt };
