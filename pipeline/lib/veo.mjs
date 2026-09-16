/**
 * Veo 3.1 shot rendering.
 *
 * Constraints verified against the live API rather than taken from docs:
 *   - durationSeconds must be 4..8 inclusive; fractional values are accepted
 *   - sampleCount is capped at 1
 *   - resolution accepts 720p / 1080p / 4k / 2160p
 *   - `generateAudio` is NOT a parameter here — audio is always produced
 *   - negativePrompt IS supported, and is a far better safety lever than prose negation
 */

import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

const BASE = 'https://generativelanguage.googleapis.com/v1beta';

export const TIERS = {
  fast:     { model: 'veo-3.1-fast-generate-preview',  usdPerSecond: 0.12, audio: true },
  lite:     { model: 'veo-3.1-lite-generate-preview',  usdPerSecond: 0.03, audio: false },
  standard: { model: 'veo-3.1-generate-preview',       usdPerSecond: 0.75, audio: true },
};

export const MIN_SECONDS = 4;
export const MAX_SECONDS = 8;

/**
 * Things that must never appear on screen, expressed as a negative prompt.
 *
 * In-prompt prose negation leaked scissors into a frame twice during the stills build.
 * negativePrompt is a dedicated channel and more reliable — though still not a guarantee,
 * which is why the human review gate stays the real control.
 */
export const SAFETY_NEGATIVE = [
  'knife', 'blade', 'scissors', 'shears', 'saw', 'needle', 'nail', 'tack', 'drill',
  'flame', 'fire', 'candle', 'stove', 'electrical wiring', 'power tool',
  'broken glass', 'sharp metal', 'small magnets',
  'text', 'letters', 'words', 'captions', 'subtitles', 'watermark', 'logo',
  'scary', 'menacing', 'violence', 'crying', 'photorealistic', 'live action',
].join(', ');

/** Dialogue in the form Veo needs for lip sync: a lead-in verb plus double quotes. */
export function dialoguePrompt(lines, cast) {
  return lines.map((l) => {
    const c = cast[l.speaker] ?? {};
    const who = l.speaker.charAt(0).toUpperCase() + l.speaker.slice(1);
    const voice = c.voice_direction ? ` in a ${c.voice_direction} voice` : '';
    // The double quotes and the "says" verb are what trigger lip-synced speech.
    return `${who}, the ${c.species ?? 'animal'}, says${voice}: "${l.text}"`;
  }).join('\n');
}

export function buildShotPrompt({ shot, bible, cast }) {
  const v = bible.visual_style;
  const present = [...new Set(shot.lines.map((l) => l.speaker))];
  const parts = [
    `${v.medium}. ${v.line}. Soft, warm, gentle children's animation.`,
    `Setting: ${bible.world.setting}. ${bible.world.time_of_day}.`,
    '',
    `SHOT: ${shot.visual}`,
  ];
  if (present.length) {
    parts.push('',
      'Characters in this shot (match the reference image exactly):',
      ...present.map((k) => `- ${k}: ${cast[k]?.look ?? ''}`),
      '',
      dialoguePrompt(shot.lines, cast));
  }
  parts.push('', `Palette: ${v.palette.join(', ')}. No text anywhere in frame.`);
  return parts.join('\n');
}

/** Start a generation. Returns the long-running operation name. */
async function startShot({ prompt, seconds, referenceImage, tier, key }) {
  const t = TIERS[tier];
  if (!t) throw new Error(`Unknown Veo tier "${tier}". Use: ${Object.keys(TIERS).join(', ')}`);
  if (seconds < MIN_SECONDS || seconds > MAX_SECONDS) {
    throw new Error(`Shot is ${seconds}s; Veo accepts ${MIN_SECONDS}-${MAX_SECONDS}s only.`);
  }

  const instance = { prompt };
  if (referenceImage && existsSync(referenceImage)) {
    instance.image = { bytesBase64Encoded: readFileSync(referenceImage).toString('base64'), mimeType: 'image/png' };
  }

  const res = await fetch(`${BASE}/models/${t.model}:predictLongRunning?key=${key}`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      instances: [instance],
      parameters: {
        aspectRatio: '9:16',
        durationSeconds: seconds,
        resolution: '1080p',
        negativePrompt: SAFETY_NEGATIVE,
        sampleCount: 1,
      },
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    let m = text.slice(0, 300);
    try { m = JSON.parse(text).error.message; } catch {}
    throw new Error(`Veo start failed (${res.status}): ${String(m).replaceAll(key, '[KEY]')}`);
  }
  return JSON.parse(text).name;
}

async function awaitShot({ operation, key, timeoutMs = 10 * 60_000, pollMs = 10_000 }) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, pollMs));
    const res = await fetch(`${BASE}/${operation}?key=${key}`);
    const json = await res.json();
    if (json.error) throw new Error(`Veo failed: ${JSON.stringify(json.error).replaceAll(key, '[KEY]').slice(0, 300)}`);
    if (json.done) return json;
  }
  throw new Error(`Veo timed out after ${Math.round(timeoutMs / 60000)} minutes.`);
}

async function saveVideo({ done, outputPath, key }) {
  const r = done.response ?? {};
  const vid = r.generateVideoResponse?.generatedSamples?.[0]?.video ?? r.videos?.[0] ?? r.predictions?.[0];
  if (!vid) throw new Error(`No video in response. Shape: ${JSON.stringify(r).slice(0, 200)}`);
  mkdirSync(dirname(outputPath), { recursive: true });

  if (vid.bytesBase64Encoded) {
    writeFileSync(outputPath, Buffer.from(vid.bytesBase64Encoded, 'base64'));
  } else {
    const uri = vid.uri ?? vid.gcsUri;
    if (!uri) throw new Error('Video had neither inline bytes nor a uri.');
    const res = await fetch(uri.includes('key=') ? uri : `${uri}${uri.includes('?') ? '&' : '?'}key=${key}`);
    if (!res.ok) throw new Error(`Video download failed (${res.status}).`);
    writeFileSync(outputPath, Buffer.from(await res.arrayBuffer()));
  }
  return outputPath;
}

/** Render one shot. Tier defaults to lite for wordless shots — it cannot produce audio. */
export async function renderShot({ shot, bible, outputPath, referenceImage, env = process.env, tier, onProgress }) {
  const key = env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY is not set in .env.local.');

  const chosen = tier ?? (shot.lines.length ? (env.VEO_TIER ?? 'fast') : 'lite');
  if (shot.lines.length && !TIERS[chosen].audio) {
    throw new Error(`Shot ${shot.id} has dialogue but tier "${chosen}" cannot generate audio. Use fast or standard.`);
  }

  const prompt = buildShotPrompt({ shot, bible, cast: bible.cast });
  onProgress?.({ phase: 'start', shot: shot.id, tier: chosen });
  const operation = await startShot({ prompt, seconds: shot.seconds, referenceImage, tier: chosen, key });
  const done = await awaitShot({ operation, key });
  const path = await saveVideo({ done, outputPath, key });
  onProgress?.({ phase: 'done', shot: shot.id, path });
  return { path, tier: chosen, cost: shot.seconds * TIERS[chosen].usdPerSecond };
}

/** What an episode's shot list will cost, by tier. */
export function estimateCost(shots, { dialogueTier = 'fast', silentTier = 'lite' } = {}) {
  let total = 0;
  const byTier = {};
  for (const s of shots) {
    const tier = s.lines.length ? dialogueTier : silentTier;
    const cost = s.seconds * TIERS[tier].usdPerSecond;
    byTier[tier] = (byTier[tier] ?? 0) + cost;
    total += cost;
  }
  return { total: Math.round(total * 100) / 100, byTier, clips: shots.length };
}
