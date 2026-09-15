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
import { existsSync } from 'node:fs';

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

/** Image adapter. Wire your provider here; keep the style block verbatim for consistency. */
export async function generateImage({ prompt, stylePrompt, outputPath, env }) {
  throw new Error(
    'No image provider configured.\n' +
    '  Implement generateImage() in pipeline/lib/media.mjs and add the key to .env.local.\n' +
    `  It must write a ${'1080x1920'} PNG to: ${outputPath}\n` +
    '  Keep `stylePrompt` verbatim in every call — character drift between episodes is the\n' +
    '  most visible sign of machine production, and the fastest way to look like a content farm.'
  );
}

/** TTS adapter. Check the provider's licence permits monetized children's content. */
export async function generateVoiceover({ lines, voice, outputPath, env }) {
  throw new Error(
    'No TTS provider configured.\n' +
    '  Implement generateVoiceover() in pipeline/lib/media.mjs and add the key to .env.local.\n' +
    `  It must write a single audio file to: ${outputPath}\n` +
    '  Confirm the licence allows monetized, child-directed use before committing to a voice.'
  );
}
