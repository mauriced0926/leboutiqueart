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
export function charactersInShot(shot, cast) {
  const speakers = [...new Set(shot.lines.map((l) => l.speaker))];
  if (speakers.length) return speakers;
  const text = String(shot.visual ?? '').toLowerCase();
  return Object.keys(cast).filter((k) => new RegExp(`\\b${k}\\b`).test(text));
}

export function buildFramePrompt({ shot, bible, cast, episodeCast = null, anchorFrame = null }) {
  const present = charactersInShot(shot, cast);
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
      'ONLY these characters appear in this shot:',
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
export function buildAnimationPrompt({ shot, bible, cast }) {
  const parts = [
    'Animate this exact illustration. Keep the art style, colours, composition and every',
    'character precisely as shown. Do not restyle it, do not add or replace any character.',
    'Gentle, unhurried children\'s animation. Subtle motion. Locked-off camera.',
    '',
    `ACTION: ${shot.visual}`,
  ];
  if (shot.lines.length) parts.push('', dialoguePrompt(shot.lines, cast));
  return parts.join('\n');
}

/** Cast members who must not appear, as negative-prompt terms. */
function absentCastNegatives(shot, cast) {
  const present = new Set(charactersInShot(shot, cast));
  return Object.entries(cast)
    .filter(([k]) => !present.has(k))
    .map(([, c]) => c.species)
    .filter(Boolean);
}

/** Start a generation. Returns the long-running operation name. */
async function startShot({ prompt, seconds, referenceImage, tier, key, negativePrompt = SAFETY_NEGATIVE }) {
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
        negativePrompt,
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

/**
 * Render one shot: compose a first frame with the image model, then animate it with Veo.
 *
 * `framePath` is cached separately from the clip, so re-rendering an animation does not
 * re-bill the frame, and a frame you have approved by eye is reused verbatim.
 */
export async function renderShot({ shot, bible, outputPath, framePath, env = process.env, tier, onProgress, episodeCast = null, anchorFrame = null }) {
  const key = env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY is not set in .env.local.');

  const chosen = tier ?? (shot.lines.length ? (env.VEO_TIER ?? 'fast') : 'lite');
  if (shot.lines.length && !TIERS[chosen].audio) {
    throw new Error(`Shot ${shot.id} has dialogue but tier "${chosen}" cannot generate audio. Use fast or standard.`);
  }

  const frame = framePath ?? outputPath.replace(/\.mp4$/, '.png');
  if (!existsSync(frame)) {
    onProgress?.({ phase: 'frame', shot: shot.id });
    await generateImage({
      prompt: buildFramePrompt({ shot, bible, cast: bible.cast, episodeCast, anchorFrame }),
      stylePrompt: styleBlock(bible),
      // The sheet fixes WHO; the previous frame fixes HOW IT LOOKS. Without the anchor,
      // consecutive frames came back in different palettes and framing and would not cut.
      referenceImages: [bible.__sheetPath, anchorFrame].filter((f) => f && existsSync(f)),
      outputPath: frame,
      env,
    });
  }

  onProgress?.({ phase: 'animate', shot: shot.id, tier: chosen });
  const negatives = [SAFETY_NEGATIVE, ...absentCastNegatives(shot, bible.cast), 'extra characters', 'restyle'].join(', ');
  const operation = await startShot({
    prompt: buildAnimationPrompt({ shot, bible, cast: bible.cast }),
    seconds: shot.seconds, referenceImage: frame, tier: chosen, key, negativePrompt: negatives,
  });
  const done = await awaitShot({ operation, key });
  const path = await saveVideo({ done, outputPath, key });
  onProgress?.({ phase: 'done', shot: shot.id, path });
  return { path, frame, tier: chosen, cost: shot.seconds * TIERS[chosen].usdPerSecond + 0.04 };
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
