#!/usr/bin/env node
/**
 * Build stage: episode.json → images → narration → video.mp4
 *
 * This is the step between run.mjs (writes the script) and publish.mjs (uploads the file).
 *
 *   node pipeline/build.mjs            build every episode that needs it
 *   node pipeline/build.mjs 12         build one
 *   node pipeline/build.mjs --sheet    (re)generate the character sheet only
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { loadEnv, paths, PIPELINE } from './lib/config.mjs';
import { generateImage, generateVoiceover, fitAudio, concatAudio, assemble, ffmpegAvailable } from './lib/media.mjs';

process.on('uncaughtException', (e) => { console.error(`\n✗ ${e.message}\n`); process.exit(1); });
process.on('unhandledRejection', (e) => { console.error(`\n✗ ${e instanceof Error ? e.message : e}\n`); process.exit(1); });

const env = loadEnv();
const args = process.argv.slice(2);
const only = args.find((a) => /^\d+$/.test(a));
const sheetOnly = args.includes('--sheet');
// Images without assembly: the QA pass for character consistency, and it needs no ffmpeg.
const imagesOnly = args.includes('--images-only');

const bible = JSON.parse(readFileSync(paths.bible, 'utf8'));
const ASSETS = join(PIPELINE, 'assets');
const SHEET = join(ASSETS, 'character-sheet.png');

/** The style block, sent verbatim on every single image call. */
function stylePrompt() {
  const v = bible.visual_style;
  return [
    `Medium: ${v.medium}.`,
    `Line: ${v.line}.`,
    `Palette (use only these): ${v.palette.join(', ')}.`,
    `Lighting: ${bible.world.time_of_day}.`,
    `Framing: ${v.camera}. Vertical ${v.aspect}.`,
    'No text, no letters, no watermarks, no signature in the image.',
    // The fold flipped sides between beats in the first build; state it explicitly.
    "Mango's folded ear tip is always her LEFT ear. Keep her muzzle short and rounded, as",
    'in the reference sheet — never long or dog-like, including in close-ups.',
  ].join('\n');
}

function castPrompt() {
  return Object.entries(bible.cast)
    .map(([name, c]) => `${name.toUpperCase()} — ${c.species}, ${c.look}.`)
    .join('\n');
}

/**
 * Safety constraints for the IMAGE model.
 *
 * The bible's hard_rules were only ever reaching the script generator. The image model was
 * free to dress the scene however it liked, and it duly put pruning shears and a loose nail
 * on the workbench of the first episode built — a direct violation of the no-blades rule,
 * in a video aimed at three-year-olds. Rules that matter have to travel with every prompt
 * that can put something on screen.
 */
function safetyPrompt() {
  return [
    'HARD CONSTRAINTS — these override anything above:',
    ...bible.hard_rules.map((r) => `- ${r}`),
    '- Nothing sharp, hot or electrical anywhere in frame, including background dressing:',
    '  no knives, blades, scissors, shears, saws, needles, nails, tacks, drills, flames or wiring.',
    '  Safe tools only: wooden mallet, twine, glue pot, cloth, brush, clamp, sandpaper, pencil.',
    '- No small loose objects a toddler could mistake for food.',
  ].join('\n');
}

async function buildCharacterSheet() {
  mkdirSync(ASSETS, { recursive: true });
  console.log('Generating character sheet (once — every episode is conditioned on it)…');
  await generateImage({
    prompt: [
      'A character reference sheet for an animated children\'s series.',
      'Show the two characters below, full body, neutral standing poses, plain background.',
      'This is a model sheet: clear, consistent, no scenery.',
      '',
      castPrompt(),
      '',
      safetyPrompt(),
    ].join('\n'),
    stylePrompt: stylePrompt(),
    outputPath: SHEET,
    env,
  });
  console.log(`✓ ${SHEET}`);
}

async function buildEpisode(dir) {
  const episode = JSON.parse(readFileSync(join(dir, 'episode.json'), 'utf8'));
  const work = join(dir, 'work');
  mkdirSync(work, { recursive: true });
  console.log(`\n▸ ep${episode.episode}: ${episode.title}`);

  // 1. One image per beat, conditioned on the character sheet AND — after the first beat
  //    lands — on this episode's own opening frame. The sheet alone holds the characters
  //    but not the lighting, palette or rendering density of this particular episode, and
  //    close-ups drifted hardest without a same-episode anchor.
  const beats = [];
  let anchor = null;
  for (const b of episode.beats) {
    const imagePath = join(work, `beat-${b.n}.png`);
    if (existsSync(imagePath)) {
      console.log(`  beat ${b.n} image — cached`);
    } else {
      process.stdout.write(`  beat ${b.n} image… `);
      await generateImage({
        prompt: [
          `Scene from "${bible.series.title}". Setting: ${bible.world.setting}.`,
          'Reference 1 is the character sheet: match the characters to it exactly.',
          'If a second reference is given, it is the opening frame of THIS episode — match its',
          'palette, lighting, line weight and rendering density so the shots cut together.',
          '',
          castPrompt(),
          '',
          `SHOT: ${b.visual}`,
          '',
          safetyPrompt(),
        ].join('\n'),
        stylePrompt: stylePrompt(),
        referenceImages: [SHEET, anchor].filter((f) => f && existsSync(f)),
        outputPath: imagePath,
        env,
      });
      console.log('✓');
    }
    beats.push({ ...b, imagePath });
    anchor ??= imagePath;
  }

  if (imagesOnly) {
    console.log(`  images only — skipping narration and assembly`);
    return;
  }

  // 2. Narration per beat, each fitted to its exact beat length so audio and video
  //    cannot drift apart across the episode.
  const voice = env.MEDIA_TTS_VOICE;
  const fitted = [];
  for (const b of beats) {
    const fittedPath = join(work, `audio-${b.n}.mp3`);
    if (!existsSync(fittedPath)) {
      let rawPath = null;
      if (b.narration?.trim()) {
        process.stdout.write(`  beat ${b.n} voice… `);
        rawPath = join(work, `raw-${b.n}.mp3`);
        await generateVoiceover({ text: b.narration, voiceName: voice, outputPath: rawPath, env });
        console.log('✓');
      }
      await fitAudio({ inputPath: rawPath, seconds: b.seconds, outputPath: fittedPath });
    }
    fitted.push(fittedPath);
  }

  const audioPath = join(work, 'narration.mp3');
  await concatAudio({ inputPaths: fitted, outputPath: audioPath, workDir: work });

  // 3. Assemble.
  const outputPath = join(dir, 'video.mp4');
  process.stdout.write('  assembling… ');
  await assemble({ beats, audioPath, outputPath });
  console.log(`✓ ${outputPath}`);

  const statusPath = join(dir, 'status.json');
  const status = JSON.parse(readFileSync(statusPath, 'utf8'));
  writeFileSync(statusPath, JSON.stringify({ ...status, built_at: new Date().toISOString() }, null, 2));
}

// ── main ──────────────────────────────────────────────────────────────────

// The character sheet is pure image generation — don't gate it behind ffmpeg, which is
// only needed once we start fitting audio and assembling video.
if (sheetOnly) { await buildCharacterSheet(); process.exit(0); }

if (!imagesOnly && !(await ffmpegAvailable())) {
  throw new Error(
    'ffmpeg is required for the build stage and was not found.\n' +
    '  macOS:  brew install ffmpeg\n' +
    '  Debian: sudo apt-get install ffmpeg\n' +
    '  Windows: winget install Gyan.FFmpeg'
  );
}
if (!existsSync(SHEET)) await buildCharacterSheet();

if (!existsSync(paths.queue)) { console.log('Nothing queued. Run: node pipeline/run.mjs'); process.exit(0); }

const todo = readdirSync(paths.queue)
  .map((d) => join(paths.queue, d))
  .filter((d) => existsSync(join(d, 'episode.json')))
  .filter((d) => imagesOnly || !existsSync(join(d, 'video.mp4')))
  .filter((d) => !only || JSON.parse(readFileSync(join(d, 'episode.json'), 'utf8')).episode === Number(only));

if (!todo.length) { console.log('\nNothing to build — every queued episode already has a video.mp4\n'); process.exit(0); }

for (const dir of todo) await buildEpisode(dir);
console.log(`\n✓ Built ${todo.length} episode(s). Next: node pipeline/review.mjs\n`);
