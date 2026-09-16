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
import { generateImage } from './media.mjs';

const BASE = 'https://generativelanguage.googleapis.com/v1beta';

// The lite tier has a reduced parameter set: no audio, and it rejects negativePrompt
// outright. Both verified against the live API, neither obvious from the model listing.
export const TIERS = {
  fast:     { model: 'veo-3.1-fast-generate-preview',  usdPerSecond: 0.12, audio: true,  negativePrompt: true },
  lite:     { model: 'veo-3.1-lite-generate-preview',  usdPerSecond: 0.03, audio: false, negativePrompt: false },
  standard: { model: 'veo-3.1-generate-preview',       usdPerSecond: 0.75, audio: true,  negativePrompt: true },
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

const NUMBER_WORDS = ['one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve'];
// "fold each one in", "one is short" are not counts of anything drawable. Only keep a
// number when a noun follows it, not a preposition or verb.
const NOT_A_NOUN = new Set(['in','is','was','of','at','to','for','and','or','on','by','with',
  'that','this','more','less','again','here','there','out','up','down','o','a','the','it','but','so']);

/**
 * Pull any count stated in the dialogue so the shot prompt can echo it.
 *
 * Episode 1 had Wren say "six corners" over a pinwheel the image model drew with five.
 * The renderer never sees the words unless we put them in the visual instruction, so a
 * stated count and the picture drift apart.
 */
export function statedCounts(lines) {
  const found = new Set();
  for (const l of lines) {
    const text = String(l.text ?? '').toLowerCase();
    for (const w of NUMBER_WORDS) {
      const m = new RegExp(`\\b${w}\\b\\s+([a-z]+)`).exec(text);
      if (m && !NOT_A_NOUN.has(m[1])) found.add(`${w} ${m[1]}`);
    }
    for (const m of text.matchAll(/\b(\d+)\s+([a-z]+)/g)) {
      if (!NOT_A_NOUN.has(m[2])) found.add(`${m[1]} ${m[2]}`);
    }
  }
  return [...found];
}

/**
 * Prompt for the shot's FIRST FRAME, rendered by the image model.
 *
 * This exists because Veo's `image` parameter is first-frame conditioning, not a character
 * reference library. Handing it the five-character model sheet made it invent a scene,
 * pick whichever character dominated the sheet, and drop the art style — one clip put
 * Wren's dialogue in Mango's mouth and grew a feathered wing on the fox. The image model
 * does honour the sheet, so the frame is composed there and Veo only animates it.
 */
/**
 * Who is in this shot. Speakers are definitive, but a wordless beat has none — the
 * cold-open shows the visitor and says nothing — so fall back to naming the cast members
 * mentioned in the shot's visual description. Without this, a silent shot would exclude
 * every character and render an empty room.
 */
export function charactersInShot(shot, cast, episodeCast = null) {
  const speakers = new Set(shot.lines.map((l) => l.speaker));
  const text = String(shot.visual ?? '').toLowerCase();
  for (const k of Object.keys(cast)) if (new RegExp(`\\b${k}\\b`).test(text)) speakers.add(k);

  // From the arrival beat onward everyone in the episode is standing in the den, so they
  // must be in every frame. Listing only the speakers let the visitor vanish from a shot
  // and reappear in the next one — he popped in and out across the cut.
  if (episodeCast && shot.beat >= 2) for (const k of episodeCast) speakers.add(k);

  return [...speakers];
}

export function buildFramePrompt({ shot, bible, cast, episodeCast = null, anchorFrame = null, prop = null }) {
  const present = charactersInShot(shot, cast, episodeCast);
  // Exclude only cast who are not in this EPISODE. Excluding everyone who is not speaking
  // in this shot wrongly banished the visitor, who stands in the den for the whole scene.
  const inEpisode = episodeCast ?? Object.keys(cast);
  const absent = Object.keys(cast).filter((k) => !inEpisode.includes(k));
  const parts = [
    `Scene from "${bible.series.title}". Setting: ${bible.world.setting}.`,
    '',
    `SHOT: ${shot.visual}`,
  ];
  if (present.length) {
    parts.push('',
      'EXACTLY these characters appear in this shot — all of them, and no others:',
      ...present.map((k) => `- ${k.toUpperCase()}: ${cast[k]?.look ?? ''}`));
  }
  if (absent.length) {
    // Naming who is absent matters: the renderer otherwise drifts extra cast into frame.
    parts.push('', `NOT in this shot — none of these may appear: ${absent.join(', ')}.`);
  }
  if (anchorFrame) {
    parts.push('',
      'A second reference image is the PREVIOUS SHOT of this same scene. Match its palette,',
      'lighting, line weight, rendering density and the characters exactly — these shots cut',
      'together, so they must look like the same film.');
  }
  if (prop) {
    // The cart vanished between two shots of the same conversation. The broken object is
    // what the episode is about, so it is a required element of the frame, not set dressing.
    parts.push('',
      `THE BROKEN OBJECT — the ${prop} must be clearly visible in this shot, in the same`,
      'place and the same state as the reference frame. It is what the scene is about and',
      'must never be absent, moved off-screen, or swapped for a different object.');
  }
  const counts = statedCounts(shot.lines);
  if (counts.length) {
    parts.push('',
      'COUNTS THAT MUST MATCH EXACTLY — the dialogue states these, so show exactly this many:',
      ...counts.map((c) => `- ${c}`));
  }
  parts.push('', safetyBlock(bible));
  return parts.join('\n');
}

export function styleBlock(bible) {
  const v = bible.visual_style;
  return [
    `Medium: ${v.medium}. Line: ${v.line}.`,
    `Palette (use only these): ${v.palette.join(', ')}.`,
    `Lighting: ${bible.world.time_of_day}. Framing: ${v.camera}. Vertical ${v.aspect}.`,
    'No text, no letters, no watermarks, no signature anywhere in the image.',
    // A frame came back matted inside a white paper margin, which would read as a glitch
    // once cut between full-bleed shots.
    'The artwork fills the entire frame edge to edge: no border, no margin, no mat, no',
    'vignette, no page edge, no drop shadow around the image.',
    "Mango's folded ear tip is always her LEFT ear; her muzzle stays short and rounded.",
    // Bramble came back wearing glasses on his eyes AND a second pair pushed up on his head.
    'Each character wears exactly ONE of each item, in the position described. Never a',
    'duplicate pair of glasses, never an item both worn and pushed up.',
  ].join('\n');
}

function safetyBlock(bible) {
  return [
    'HARD CONSTRAINTS — these override anything above:',
    ...bible.hard_rules.map((r) => `- ${r}`),
    '- Nothing sharp, hot or electrical anywhere in frame, including background dressing.',
    '  Safe tools only: wooden mallet, twine, glue pot, cloth, brush, clamp, sandpaper, pencil.',
  ].join('\n');
}

/** Prompt for ANIMATING an already-composed frame. Veo must not reinvent the picture. */
export function buildAnimationPrompt({ shot, bible, cast, prop = null }) {
  const parts = [
    'Animate this exact illustration. Keep the art style, colours, composition and every',
    'character precisely as shown. Do not restyle it, do not add or replace any character.',
    'Gentle, unhurried children\'s animation. Subtle motion. Locked-off camera.',
    '',
    // Veo animated the cart out of frame partway through an 8s clip.
    'NOTHING IN THE SCENE MAY DISAPPEAR, morph into something else, or leave the frame.',
    'Every object and character visible at the start is still there, in the same place, at',
    'the end. Only the characters move.',
    ...(prop ? [`The ${prop} stays clearly visible and unchanged for the whole clip.`] : []),
    '',
    `ACTION: ${shot.visual}`,
  ];
  if (shot.lines.length) parts.push('', dialoguePrompt(shot.lines, cast));
  return parts.join('\n');
}

/** Cast members who must not appear, as negative-prompt terms. */
function absentCastNegatives(shot, cast, episodeCast = null) {
  const present = new Set(charactersInShot(shot, cast, episodeCast));
  return Object.entries(cast)
    .filter(([k]) => !present.has(k))
    .map(([, c]) => c.species)
    .filter(Boolean);
}

/** Start a generation. Returns the long-running operation name. */
async function startShot({ prompt, seconds, referenceImage, tier, key, negativePrompt = SAFETY_NEGATIVE, onRateLimit }) {
  const t = TIERS[tier];
  if (!t) throw new Error(`Unknown Veo tier "${tier}". Use: ${Object.keys(TIERS).join(', ')}`);
  if (seconds < MIN_SECONDS || seconds > MAX_SECONDS) {
    throw new Error(`Shot is ${seconds}s; Veo accepts ${MIN_SECONDS}-${MAX_SECONDS}s only.`);
  }

  const instance = { prompt };
  if (referenceImage && existsSync(referenceImage)) {
    instance.image = { bytesBase64Encoded: readFileSync(referenceImage).toString('base64'), mimeType: 'image/png' };
  }

  const body = JSON.stringify({
    instances: [instance],
    parameters: {
      aspectRatio: '9:16',
      durationSeconds: seconds,
      resolution: '1080p',
      // Only tiers that accept it. Safety still holds without it here: a lite shot is
      // wordless, and its first frame was composed by the image model under the full
      // hard-rules prompt — Veo is only animating an already-vetted picture.
      ...(t.negativePrompt ? { negativePrompt } : {}),
      sampleCount: 1,
    },
  });

  // 429 here is a per-minute rate limit, not exhausted credit — the same key succeeds a
  // moment later. Without backoff a single transient 429 aborted a 34-shot render on its
  // first clip. Waits are long because the limit is per minute, not per second.
  const backoffMs = [30_000, 60_000, 120_000, 240_000];
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${BASE}/models/${t.model}:predictLongRunning?key=${key}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body,
    });
    const text = await res.text();
    if (res.ok) return JSON.parse(text).name;

    let m = text.slice(0, 300);
    try { m = JSON.parse(text).error.message; } catch {}

    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt >= backoffMs.length) {
      const hint = res.status === 429
        ? ' — rate limited and still failing after backoff; if this persists, credits may actually be out (check ai.dev/rate-limit)'
        : '';
      throw new Error(`Veo start failed (${res.status}): ${String(m).replaceAll(key, '[KEY]')}${hint}`);
    }
    onRateLimit?.({ attempt: attempt + 1, waitMs: backoffMs[attempt] });
    await new Promise((r) => setTimeout(r, backoffMs[attempt]));
  }
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

/**
 * Render one shot: compose a first frame with the image model, then animate it with Veo.
 *
 * `framePath` is cached separately from the clip, so re-rendering an animation does not
 * re-bill the frame, and a frame you have approved by eye is reused verbatim.
 */
export async function renderShot({ shot, bible, outputPath, framePath, env = process.env, tier, onProgress, episodeCast = null, anchorFrame = null, prop = null }) {
  const key = env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY is not set in .env.local.');

  // Always fast: lite cannot do audio, rejects negativePrompt, and will not render 1080p
  // below 8s. The saving was not worth three aborted renders.
  const chosen = tier ?? env.VEO_TIER ?? 'fast';
  if (shot.lines.length && !TIERS[chosen].audio) {
    throw new Error(`Shot ${shot.id} has dialogue but tier "${chosen}" cannot generate audio. Use fast or standard.`);
  }

  const frame = framePath ?? outputPath.replace(/\.mp4$/, '.png');
  if (!existsSync(frame)) {
    onProgress?.({ phase: 'frame', shot: shot.id });
    await generateImage({
      prompt: buildFramePrompt({ shot, bible, cast: bible.cast, episodeCast, anchorFrame, prop }),
      stylePrompt: styleBlock(bible),
      // Per-character crops, never the full model sheet. Passing the five-character sheet
      // put all five into the cold open and invented the wrong location: the picture beat
      // the "NOT in this shot" text. Only the characters actually in the shot are shown,
      // plus the episode's first frame to carry palette and framing across cuts.
      referenceImages: [
        ...charactersInShot(shot, bible.cast, episodeCast).map((k) => bible.__castRefs?.[k]),
        anchorFrame,
      ].filter((f) => f && existsSync(f)).slice(0, 3),
      outputPath: frame,
      env,
    });
  }

  onProgress?.({ phase: 'animate', shot: shot.id, tier: chosen });
  const negatives = [SAFETY_NEGATIVE, ...absentCastNegatives(shot, bible.cast, episodeCast), 'extra characters', 'restyle'].join(', ');
  const operation = await startShot({
    prompt: buildAnimationPrompt({ shot, bible, cast: bible.cast, prop }),
    seconds: shot.seconds, referenceImage: frame, tier: chosen, key, negativePrompt: negatives,
    onRateLimit: (i) => onProgress?.({ phase: 'ratelimit', shot: shot.id, ...i }),
  });
  const done = await awaitShot({ operation, key });
  const path = await saveVideo({ done, outputPath, key });
  onProgress?.({ phase: 'done', shot: shot.id, path });
  return { path, frame, tier: chosen, cost: shot.seconds * TIERS[chosen].usdPerSecond + 0.04 };
}

/** What an episode's shot list will cost, by tier. */
export function estimateCost(shots, { dialogueTier = 'fast', silentTier = 'fast' } = {}) {
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
