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

/**
 * Resolve an ffmpeg binary, in order of preference:
 *   1. FFMPEG_PATH, if you want to pin a specific build
 *   2. `ffmpeg` on PATH — a normal system install
 *   3. the binary bundled by @ffmpeg-installer/ffmpeg, if that package is present
 *
 * (3) exists so the pipeline runs on a machine without a system ffmpeg: the package ships
 * platform binaries inside the npm tarball, so `npm install` is the whole install.
 * Resolved once and cached — this is called per beat.
 */
let ffmpegPath;
export async function resolveFfmpeg(env = process.env) {
  if (ffmpegPath !== undefined) return ffmpegPath;

  const candidates = [];
  if (env.FFMPEG_PATH) candidates.push(env.FFMPEG_PATH);
  candidates.push('ffmpeg');
  try {
    const mod = await import('@ffmpeg-installer/ffmpeg');
    if (mod?.default?.path) candidates.push(mod.default.path);
  } catch { /* package not installed — fine, it is optional */ }

  for (const candidate of candidates) {
    try { await exec(candidate, ['-version']); ffmpegPath = candidate; return ffmpegPath; }
    catch { /* try the next one */ }
  }
  ffmpegPath = null;
  return null;
}

export async function ffmpegAvailable() {
  return (await resolveFfmpeg()) !== null;
}

/** Run ffmpeg with whichever binary resolved. */
async function runFfmpeg(args, opts = {}) {
  const bin = await resolveFfmpeg();
  if (!bin) throw new Error('ffmpeg not found — see the install note in pipeline/README.md.');
  return exec(bin, args, { maxBuffer: 64 * 1024 * 1024, ...opts });
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
  for (const b of beats) {
    // -framerate MUST come before -loop/-i: a looped image input defaults to 25fps, so
    // asking zoompan for 30fps output stretched every beat and the episode ran ~5% long.
    args.push('-framerate', String(fps), '-loop', '1', '-t', String(b.seconds), '-i', b.imagePath);
  }
  args.push('-i', audioPath);

  // Per-beat: scale/crop to vertical, apply a 4% push-in over the beat, pad to exact size.
  const filters = beats.map((b, i) => {
    // d=1 emits one output frame per input frame, so duration is carried by -t alone and
    // the zoom accumulates across frames. Any other d multiplies the beat's length.
    const frames = Math.max(1, Math.round(b.seconds * fps));
    const step = 0.04 / frames; // reach a 4% push-in exactly at the end of the beat
    return `[${i}:v]scale=${width * 1.1}:-1,` +
      `zoompan=z='min(zoom+${step.toFixed(6)},1.04)':d=1:s=${width}x${height}:fps=${fps},` +
      `trim=duration=${b.seconds},setpts=PTS-STARTPTS,setsar=1[v${i}]`;
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
      '  macOS:   brew install ffmpeg\n' +
      '  Debian:  sudo apt-get install ffmpeg\n' +
      '  Windows: winget install Gyan.FFmpeg\n' +
      '  Or, with no system install at all:  npm install @ffmpeg-installer/ffmpeg'
    );
  }
  const args = buildFfmpegArgs(opts);
  await runFfmpeg(args);
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
  const provider = env.MEDIA_TTS_PROVIDER ?? 'gemini';
  if (provider === 'gemini') return geminiVoice({ text, voiceName, outputPath, env });
  if (provider === 'elevenlabs') return elevenlabsVoice({ text, voiceName, outputPath, env });
  if (provider === 'openai') return openaiVoice({ text, voiceName, outputPath, env });
  if (provider !== 'google') {
    throw new Error(`Unknown MEDIA_TTS_PROVIDER "${provider}". Supported: gemini, google, elevenlabs, openai.`);
  }
  // Cloud TTS rejects API keys outright — it needs an OAuth2 access token or a service
  // account. Verified: it answers `API keys are not supported by this API` (401). So this
  // branch requires GOOGLE_TTS_ACCESS_TOKEN, and `gemini` is the default instead.
  const token = env.GOOGLE_TTS_ACCESS_TOKEN;
  if (!token) {
    throw new Error(
      'Cloud Text-to-Speech does not accept API keys — it needs OAuth2.\n' +
      '  Easiest fix: use MEDIA_TTS_PROVIDER=gemini (the default), which works with\n' +
      '  GEMINI_API_KEY and needs no extra setup.\n' +
      '  To use Cloud TTS anyway, set GOOGLE_TTS_ACCESS_TOKEN from a service account\n' +
      '  (gcloud auth application-default print-access-token).'
    );
  }
  const key = null;
  const body = {
    input: { text },
    voice: { languageCode, name: voiceName ?? `${languageCode}-Standard-A` },
    audioConfig: { audioEncoding: 'MP3', speakingRate: 0.95, pitch: 1.0 },
  };
  const json = await postJson(TTS_URL, body, token, 'Speech synthesis', { authorization: `Bearer ${token}` });
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

/**
 * Gemini native TTS. The default, because it works with the same GEMINI_API_KEY the image
 * stage uses — no service account, no second credential.
 *
 * It returns raw signed 16-bit PCM (audio/L16), not a container format, so nothing can play
 * or probe it as-is. We prepend a WAV header rather than shelling out to ffmpeg for the
 * conversion: it is 44 deterministic bytes and keeps this function usable on its own.
 */
async function geminiVoice({ text, voiceName, outputPath, env }) {
  const key = env.GEMINI_API_KEY;
  if (!key) {
    throw new Error(
      'GEMINI_API_KEY is not set in .env.local.\n' +
      '  Get one at aistudio.google.com/apikey — the same key covers images and narration.'
    );
  }
  const model = env.MEDIA_TTS_MODEL ?? 'gemini-2.5-flash-preview-tts';
  const voice = voiceName ?? env.MEDIA_TTS_VOICE ?? 'Kore';

  const json = await postJson(
    `${GEMINI_BASE}/models/${model}:generateContent?key=${key}`,
    {
      contents: [{ role: 'user', parts: [{ text }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
      },
    },
    key, 'Gemini speech synthesis',
  );

  const part = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  if (!part) throw new Error('Gemini speech synthesis returned no audio.');

  const rate = Number(/rate=(\d+)/.exec(part.inlineData.mimeType ?? '')?.[1] ?? 24000);
  const pcm = Buffer.from(part.inlineData.data, 'base64');
  // Written as .wav regardless of the caller's extension — the bytes are PCM, and
  // mislabelling them .mp3 would make ffmpeg fail confusingly downstream.
  const wavPath = outputPath.replace(/\.[^.]+$/, '') + '.wav';
  return writeOut(wavPath, pcmToWav(pcm, rate));
}

/** Minimal 44-byte RIFF/WAVE header for mono signed 16-bit PCM. */
export function pcmToWav(pcm, sampleRate = 24000, channels = 1, bitsPerSample = 16) {
  const blockAlign = (channels * bitsPerSample) / 8;
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);            // PCM chunk size
  header.writeUInt16LE(1, 20);             // format = PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * blockAlign, 28); // byte rate
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

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
  // Written as PCM WAV, not MP3. LAME adds encoder delay and padding to every file, which
  // accumulated to ~0.3s across five concatenated beats and pushed narration out of sync
  // with the images. PCM concatenates sample-exactly; the single final encode happens in
  // assemble().
  const out = outputPath.replace(/\.[^.]+$/, '') + '.wav';
  const common = ['-ar', '24000', '-ac', '1', '-c:a', 'pcm_s16le', '-y', out];
  const args = inputPath
    ? ['-i', inputPath, '-af', `apad,atrim=0:${seconds}`, ...common]
    : ['-f', 'lavfi', '-i', 'anullsrc=r=24000:cl=mono', '-t', String(seconds), ...common];
  await runFfmpeg(args);
  return out;
}

/** Concatenate fitted per-beat audio into one track. */
export async function concatAudio({ inputPaths, outputPath, workDir }) {
  const listFile = join(workDir, 'audio-list.txt');
  writeFileSync(listFile, inputPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n'));
  await runFfmpeg(['-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', '-y', outputPath]);
  return outputPath;
}
