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
  fix_principle: z.string().describe('The physical principle used, in plain words a child could repeat'),
  owner: z.string().describe('Which character brings it (bramble, or a named one-off forest friend)'),
  beats: z.array(z.object({
    n: z.number(),
    name: z.string(),
    seconds: z.number(),
    visual: z.string().describe('What is on screen — concrete, drawable, no camera jargon'),
    caption: z.string().describe('On-screen caption for this beat, under 8 words'),
    narration: z.string().describe("Mango's spoken line for this beat, or empty string for none"),
  })).describe('Exactly 5 beats matching the series formula'),
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
    '- Exactly 5 beats, matching the formula names and durations in the bible.',
    '- The fix must be physically real. A child must not learn something false.',
    '- Obey every entry in hard_rules.',
    '- The fix_principle must be nameable in plain words a four-year-old can repeat.',
    '- Narration total must be speakable in the beat duration — roughly 2.5 words per second.',
  ].join('\n');
}

function userPrompt(episodeNumber, history, rejections) {
  const recent = history.slice(-12).map((h) =>
    `  ep${h.episode}: ${h.broken_object} — ${h.fix_principle} — "${h.premise}"`);

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
