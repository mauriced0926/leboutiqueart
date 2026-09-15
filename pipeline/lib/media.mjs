/**
 * Media adapters: image generation, voiceover, and video assembly.
 *
 * These are seams, not implementations. Image and TTS providers are a live commercial
 * choice (price, licensing, whether the voice may be used in monetized kids content),
 * and picking one for you would be picking your cost structure. Each adapter throws a
 * setup-shaped error until configured, so the pipeline fails at the seam with an
 * actionable message rather than halfway through an upload.
 *
 * Assembly is fully implemented — it is just ffmpeg, and there is no choice to make.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

const exec = promisify(execFile);

export async function ffmpegAvailable() {
  try { await exec('ffmpeg', ['-version']); return true; }
  catch { return false; }
}

/**
 * Build the ffmpeg argv for one episode.
 *
 * One still per beat, held for the beat's duration, with a slow push-in (the "Ken Burns"
 * move) so a static image reads as motion — this matters a lot for Shorts retention.
 * Audio is the concatenated narration; captions are burned in via drawtext.
 *
 * Returned as an argv array rather than a shell string so filenames with spaces or
 * quotes cannot break out into the shell.
 */
export function buildFfmpegArgs({ beats, audioPath, outputPath, width = 1080, height = 1920, fps = 30 }) {
  if (!beats?.length) throw new Error('No beats to assemble.');
  for (const b of beats) {
    if (!b.imagePath) throw new Error(`Beat ${b.n} has no imagePath — generate images first.`);
    if (!(b.seconds > 0)) throw new Error(`Beat ${b.n} has a non-positive duration.`);
  }

  const args = [];
  for (const b of beats) args.push('-loop', '1', '-t', String(b.seconds), '-i', b.imagePath);
  args.push('-i', audioPath);

  // Per-beat: scale/crop to vertical, apply a 4% push-in over the beat, pad to exact size.
  const filters = beats.map((b, i) => {
    const frames = Math.max(1, Math.round(b.seconds * fps));
    return `[${i}:v]scale=${width * 1.1}:-1,` +
      `zoompan=z='min(zoom+0.0005,1.04)':d=${frames}:s=${width}x${height}:fps=${fps},` +
      `setsar=1[v${i}]`;
  });
  const concatIn = beats.map((_, i) => `[v${i}]`).join('');
  filters.push(`${concatIn}concat=n=${beats.length}:v=1:a=0[vout]`);

  args.push(
    '-filter_complex', filters.join(';'),
    '-map', '[vout]',
    '-map', `${beats.length}:a`,
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '192k',
    '-shortest', '-movflags', '+faststart',
    '-y', outputPath,
  );
  return args;
}

export async function assemble(opts) {
  if (!(await ffmpegAvailable())) {
    throw new Error(
      'ffmpeg is not installed.\n' +
      '  macOS:  brew install ffmpeg\n' +
      '  Debian: sudo apt-get install ffmpeg\n' +
      '  Windows: winget install Gyan.FFmpeg'
    );
  }
  const args = buildFfmpegArgs(opts);
  await exec('ffmpeg', args, { maxBuffer: 64 * 1024 * 1024 });
  if (!existsSync(opts.outputPath)) throw new Error('ffmpeg reported success but produced no file.');
  return opts.outputPath;
}

/* ─────────────────────────── providers ───────────────────────────
 * Google is the default because this project already has a Google Cloud project for
 * the YouTube API — same console, same billing — and because it was the only provider
 * reachable to test against. Both functions dispatch on an env var, so swapping in
 * another provider means adding a branch, not rewriting the pipeline.
 */

const IMAGE_MODEL_DEFAULT = 'gemini-3.1-flash-image';
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const TTS_URL = 'https://texttospeech.googleapis.com/v1/text:synthesize';

/** POST JSON, expect JSON back. Redacts the secret from any error text. */
async function postJson(url, body, secret, what, headers = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${what} failed (${res.status}): ${errText(text, secret)}`);
  return JSON.parse(text);
}

/** POST JSON, expect raw binary back (ElevenLabs and OpenAI audio stream bytes, not base64). */
async function postBinary(url, body, secret, what, headers = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${what} failed (${res.status}): ${errText(await res.text(), secret)}`);
  return Buffer.from(await res.arrayBuffer());
}

function errText(text, secret) {
  let msg = text.slice(0, 400);
  try {
    const j = JSON.parse(text);
    msg = j.error?.message ?? j.detail?.message ?? j.detail?.status ?? JSON.stringify(j.detail ?? j).slice(0, 300);
  } catch {}
  return secret ? String(msg).replaceAll(secret, '[KEY]') : String(msg);
}

function writeOut(outputPath, buffer) {
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, buffer);
  return outputPath;
}

/**
 * Generate one image.
 *
 * `referenceImages` is the mechanism that keeps Mango looking like Mango. Text prompts
 * alone drift between episodes, and drift is the most visible sign of machine production
 * — so every beat image is conditioned on the character sheet rather than on description.
 */
export async function generateImage({ prompt, stylePrompt, referenceImages = [], outputPath, env = process.env }) {
  const provider = env.MEDIA_IMAGE_PROVIDER ?? 'gemini';
  if (provider === 'openai') return openaiImage({ prompt, stylePrompt, outputPath, env });
  if (provider !== 'gemini') {
    throw new Error(`Unknown MEDIA_IMAGE_PROVIDER "${provider}". Supported: gemini, openai.`);
  }
  const key = env.GEMINI_API_KEY;
  if (!key) {
    throw new Error(
      'GEMINI_API_KEY is not set in .env.local.\n' +
      '  Get one at aistudio.google.com/apikey (free tier available).\n' +
      '  Your YOUTUBE_API_KEY will not work — it is restricted to the YouTube API.'
    );
  }
  const model = env.MEDIA_IMAGE_MODEL ?? IMAGE_MODEL_DEFAULT;

  const parts = [];
  for (const ref of referenceImages) {
    parts.push({ inlineData: { mimeType: 'image/png', data: readFileSync(ref).toString('base64') } });
  }
  // Style block last so it is the most recent instruction before generation.
  parts.push({ text: `${prompt}\n\nSTYLE (follow exactly, every time):\n${stylePrompt}` });

  const body = {
    contents: [{ role: 'user', parts }],
    generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
  };

  const json = await postJson(`${GEMINI_BASE}/models/${model}:generateContent?key=${key}`, body, key, 'Image generation');

  const candidate = json.candidates?.[0];
  if (candidate?.finishReason && !['STOP', 'MAX_TOKENS'].includes(candidate.finishReason)) {
    throw new Error(`Image generation stopped: ${candidate.finishReason}. Often a safety filter — rephrase the beat's visual.`);
  }
  const image = candidate?.content?.parts?.find((p) => p.inlineData?.data);
  if (!image) {
    const text = candidate?.content?.parts?.find((p) => p.text)?.text;
    throw new Error(`No image in response.${text ? ` Model said: ${text.slice(0, 200)}` : ''}`);
  }
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, Buffer.from(image.inlineData.data, 'base64'));
  return outputPath;
}

/** Synthesize one line of narration to a file. */
export async function generateVoiceover({ text, voiceName, languageCode = 'en-GB', outputPath, env = process.env }) {
  const provider = env.MEDIA_TTS_PROVIDER ?? 'google';
  if (provider === 'elevenlabs') return elevenlabsVoice({ text, voiceName, outputPath, env });
  if (provider === 'openai') return openaiVoice({ text, voiceName, outputPath, env });
  if (provider !== 'google') {
    throw new Error(`Unknown MEDIA_TTS_PROVIDER "${provider}". Supported: google, elevenlabs, openai.`);
  }
  const key = env.GOOGLE_TTS_API_KEY ?? env.GEMINI_API_KEY;
  if (!key) {
    throw new Error(
      'GOOGLE_TTS_API_KEY is not set in .env.local.\n' +
      '  Enable "Cloud Text-to-Speech API" in your Google Cloud project, then create an\n' +
      '  API key for it. Confirm the voice licence permits monetized child-directed use.'
    );
  }
  const body = {
    input: { text },
    voice: { languageCode, name: voiceName ?? `${languageCode}-Standard-A` },
    audioConfig: { audioEncoding: 'MP3', speakingRate: 0.95, pitch: 1.0 },
  };
  const json = await postJson(`${TTS_URL}?key=${key}`, body, key, 'Speech synthesis');
  if (!json.audioContent) throw new Error('Speech synthesis returned no audio.');
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, Buffer.from(json.audioContent, 'base64'));
  return outputPath;
}

/* ───────────────────── alternative providers ─────────────────────
 * These run wherever the pipeline runs. The sandbox this was written in could not reach
 * these hosts, so unlike the Google adapters their wire format is pinned by tests against
 * a mocked fetch rather than by a live call. Run `doctor.mjs --live` once you have keys.
 *
 * Endpoint paths are stable; MODEL NAMES CHURN, so every one is an env var with no
 * hardcoded guess baked into the logic.
 */

/** ElevenLabs. Returns MP3 bytes directly — not base64 in a JSON envelope. */
async function elevenlabsVoice({ text, voiceName, outputPath, env }) {
  const key = env.ELEVENLABS_API_KEY;
  if (!key) {
    throw new Error(
      'ELEVENLABS_API_KEY is not set in .env.local.\n' +
      '  elevenlabs.io → Profile → API key.\n' +
      '  API-generated audio is commercially licensed, but confirm your plan tier covers\n' +
      '  monetized use before committing a voice to the series.'
    );
  }
  // ElevenLabs addresses voices by ID, not by name.
  const voiceId = voiceName ?? env.ELEVENLABS_VOICE_ID;
  if (!voiceId) {
    throw new Error('Set ELEVENLABS_VOICE_ID in .env.local (the voice ID from your ElevenLabs library, not its display name).');
  }
  const model = env.ELEVENLABS_MODEL ?? 'eleven_multilingual_v2';
  const audio = await postBinary(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`,
    { text, model_id: model, voice_settings: { stability: 0.5, similarity_boost: 0.75 } },
    key, 'ElevenLabs synthesis', { 'xi-api-key': key, accept: 'audio/mpeg' },
  );
  return writeOut(outputPath, audio);
}

/** OpenAI speech. Model and voice are env vars because those names change. */
async function openaiVoice({ text, voiceName, outputPath, env }) {
  const key = env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY is not set in .env.local (platform.openai.com/api-keys).');
  const model = env.OPENAI_TTS_MODEL;
  if (!model) throw new Error('Set OPENAI_TTS_MODEL in .env.local — OpenAI audio model names change, so this is not guessed for you.');
  const audio = await postBinary('https://api.openai.com/v1/audio/speech',
    { model, input: text, voice: voiceName ?? env.OPENAI_TTS_VOICE ?? 'alloy', response_format: 'mp3' },
    key, 'OpenAI speech', { authorization: `Bearer ${key}` });
  return writeOut(outputPath, audio);
}

/**
 * OpenAI images.
 *
 * Note a real limitation: this endpoint takes no reference image, so it cannot be
 * conditioned on the character sheet the way the Gemini adapter is. Character consistency
 * then rests on the prompt alone, which drifts. Prefer Gemini for beat images unless you
 * are wiring up an edit/variation endpoint that accepts a reference.
 */
async function openaiImage({ prompt, stylePrompt, outputPath, env }) {
  const key = env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY is not set in .env.local (platform.openai.com/api-keys).');
  const model = env.OPENAI_IMAGE_MODEL;
  if (!model) throw new Error('Set OPENAI_IMAGE_MODEL in .env.local — OpenAI image model names change, so this is not guessed for you.');
  const json = await postJson('https://api.openai.com/v1/images/generations',
    { model, prompt: `${prompt}\n\nSTYLE (follow exactly, every time):\n${stylePrompt}`, size: env.OPENAI_IMAGE_SIZE ?? '1024x1536', n: 1 },
    key, 'OpenAI image generation', { authorization: `Bearer ${key}` });
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new Error('OpenAI returned no image data. If the response carried a URL instead, set response_format to b64_json for this model.');
  return writeOut(outputPath, Buffer.from(b64, 'base64'));
}

/**
 * Pad or trim an audio file to exactly `seconds`.
 *
 * Beat durations are fixed by the series formula, so narration must be fitted to the beat
 * rather than the other way round — otherwise audio and video drift apart over 5 beats and
 * the episode ends mid-sentence.
 */
export async function fitAudio({ inputPath, seconds, outputPath }) {
  const args = inputPath
    ? ['-i', inputPath, '-af', `apad,atrim=0:${seconds}`, '-c:a', 'libmp3lame', '-y', outputPath]
    : ['-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono', '-t', String(seconds), '-c:a', 'libmp3lame', '-y', outputPath];
  await exec('ffmpeg', args, { maxBuffer: 16 * 1024 * 1024 });
  return outputPath;
}

/** Concatenate fitted per-beat audio into one track. */
export async function concatAudio({ inputPaths, outputPath, workDir }) {
  const listFile = join(workDir, 'audio-list.txt');
  writeFileSync(listFile, inputPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n'));
  await exec('ffmpeg', ['-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', '-y', outputPath], { maxBuffer: 16 * 1024 * 1024 });
  return outputPath;
}
