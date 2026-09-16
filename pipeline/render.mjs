#!/usr/bin/env node
/**
 * Veo rendering stage: episode.json → per-shot clips → episode video.
 *
 *   node pipeline/render.mjs --dry-run             cost and shot plan, no spend
 *   node pipeline/render.mjs --only b06s00,b06s01  render specific shots (stress testing)
 *   node pipeline/render.mjs                       render everything missing, then stitch
 *   node pipeline/render.mjs --stitch              stitch already-rendered clips only
 *
 * Clips are cached on disk, so a failed or partial run resumes without re-billing for
 * work already done — the single most important property when each run costs real money.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { loadEnv, paths, PIPELINE } from './lib/config.mjs';
import { planEpisodeShots, shotsSummary } from './lib/shots.mjs';
import { renderShot, estimateCost, TIERS } from './lib/veo.mjs';
import { resolveFfmpeg } from './lib/media.mjs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
process.on('uncaughtException', (e) => { console.error(`\n✗ ${e.message}\n`); process.exit(1); });
process.on('unhandledRejection', (e) => { console.error(`\n✗ ${e instanceof Error ? e.message : e}\n`); process.exit(1); });

const env = loadEnv();
const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const value = (n) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : null; };

const only = value('only')?.split(',').map((s) => s.trim()).filter(Boolean) ?? null;
const dry = flag('dry-run');
const stitchOnly = flag('stitch');

const bible = JSON.parse(readFileSync(paths.bible, 'utf8'));
const SHEET = join(PIPELINE, 'assets', 'character-sheet.png');
if (!existsSync(SHEET)) throw new Error(`No locked character sheet at ${SHEET}. Run: node pipeline/build.mjs --sheet --candidates 4`);

const queueDirs = existsSync(paths.queue)
  ? readdirSync(paths.queue).map((d) => join(paths.queue, d)).filter((d) => existsSync(join(d, 'episode.json')))
  : [];
if (!queueDirs.length) throw new Error('Nothing queued. Run: node pipeline/run.mjs');

const dir = queueDirs[0];
const episode = JSON.parse(readFileSync(join(dir, 'episode.json'), 'utf8'));
const shots = planEpisodeShots(episode);
const clipDir = join(dir, 'clips');
mkdirSync(clipDir, { recursive: true });

const summary = shotsSummary(shots);
const est = estimateCost(shots);
console.log(`\n${episode.title}`);
console.log(`  ${summary.count} shots · ${summary.seconds}s · ${summary.withDialogue} with dialogue`);
console.log(`  estimate: $${est.total}  (${Object.entries(est.byTier).map(([t, c]) => `${t} $${c.toFixed(2)}`).join(' + ')})`);

const oversub = shots.filter((s) => s.overSubscribed);
if (oversub.length) {
  console.log(`  ⚠ ${[...new Set(oversub.map((s) => s.beat))].length} beat(s) have more dialogue than fits — lines will be rushed.`);
}

let targets = only ? shots.filter((s) => only.includes(s.id)) : shots;
if (only && targets.length !== only.length) {
  const missing = only.filter((id) => !shots.some((s) => s.id === id));
  throw new Error(`Unknown shot id(s): ${missing.join(', ')}`);
}

/**
 * A cached clip is only reusable if its actual duration still matches the plan. Shot
 * durations change whenever the beat structure is retuned, and silently reusing a clip of
 * the wrong length would desync the episode without any visible error.
 */
async function cachedClipUsable(shot) {
  const file = join(clipDir, `${shot.id}.mp4`);
  if (!existsSync(file)) return false;
  const ffmpeg = await resolveFfmpeg();
  if (!ffmpeg) return true; // can't verify without ffmpeg; trust it rather than re-bill
  try {
    const { stderr } = await exec(ffmpeg, ['-i', file], { maxBuffer: 8 * 1024 * 1024 }).catch((e) => e);
    const m = /Duration: (\d+):(\d+):([\d.]+)/.exec(stderr ?? '');
    if (!m) return true;
    const actual = Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
    if (Math.abs(actual - shot.seconds) > 0.5) {
      console.log(`  ${shot.id}: cached clip is ${actual.toFixed(1)}s but plan says ${shot.seconds}s — re-rendering`);
      return false;
    }
    return true;
  } catch { return true; }
}

const usable = await Promise.all(targets.map(cachedClipUsable));
const pending = targets.filter((_, i) => !usable[i]);
const cached = targets.length - pending.length;
const pendingCost = estimateCost(pending);

if (!stitchOnly) {
  console.log(`\n  rendering ${pending.length} shot(s)${cached ? `, ${cached} already cached` : ''} · this run costs ~$${pendingCost.total}`);
}

if (dry) {
  console.log('\n  shot plan:');
  for (const s of targets) {
    const tier = s.lines.length ? (env.VEO_TIER ?? 'fast') : 'lite';
    const mark = existsSync(join(clipDir, `${s.id}.mp4`)) ? 'cached' : `$${(s.seconds * TIERS[tier].usdPerSecond).toFixed(2)}`;
    console.log(`    ${s.id}  ${String(s.seconds).padStart(5)}s  ${tier.padEnd(5)} ${mark.padStart(7)}  ${s.lines.map((l) => l.speaker).join(',') || '(wordless)'}`);
  }
  console.log('\nDry run — nothing rendered.\n');
  process.exit(0);
}

// Cast actually in this episode: Mango plus the visitor. Everyone else is excluded by name.
const episodeCast = [...new Set(['mango', episode.visitor].filter(Boolean))];
let anchorFrame = null;

let spent = 0;
if (!stitchOnly) {
  for (const shot of pending) {
    const out = join(clipDir, `${shot.id}.mp4`);
    process.stdout.write(`  ${shot.id} (${shot.seconds}s)… `);
    const started = Date.now();
    try {
      const r = await renderShot({ shot, bible: { ...bible, __sheetPath: SHEET }, outputPath: out,
        framePath: join(clipDir, `${shot.id}.png`), env, episodeCast, anchorFrame,
        onProgress: (p) => { if (p.phase === 'frame') process.stdout.write('frame… '); if (p.phase === 'animate') process.stdout.write('animate… '); } });
      spent += r.cost;
      anchorFrame ??= r.frame;   // first good frame anchors the rest of the episode
      console.log(`✓ ${r.tier} · ${Math.round((Date.now() - started) / 1000)}s · $${r.cost.toFixed(2)}`);
    } catch (e) {
      console.log('✗');
      console.error(`     ${e.message}`);
      console.error(`\n  Stopped. $${spent.toFixed(2)} spent this run; rendered clips are cached and will not be re-billed.\n`);
      process.exit(1);
    }
  }
  if (pending.length) console.log(`\n  spent this run: $${spent.toFixed(2)}`);
}

// Stitch only when the full episode is present — a partial stitch is misleading.
const haveAll = shots.every((s) => existsSync(join(clipDir, `${s.id}.mp4`)));
if (!haveAll) {
  console.log(`\n  ${shots.filter((s) => existsSync(join(clipDir, `${s.id}.mp4`))).length}/${shots.length} clips present — not stitching a partial episode.\n`);
  process.exit(0);
}

const ffmpeg = await resolveFfmpeg();
if (!ffmpeg) throw new Error('ffmpeg not found — needed to stitch clips.');
const listFile = join(clipDir, 'concat.txt');
writeFileSync(listFile, shots.map((s) => `file '${join(clipDir, `${s.id}.mp4`).replace(/'/g, "'\\''")}'`).join('\n'));
const outPath = join(dir, 'video.mp4');
process.stdout.write('\n  stitching… ');
// Re-encode rather than stream-copy: Veo clips can differ in SPS/PPS and a copy concat
// then produces a file that plays only the first clip on some players.
await exec(ffmpeg, ['-f', 'concat', '-safe', '0', '-i', listFile,
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p',
  '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-y', outPath], { maxBuffer: 64 * 1024 * 1024 });
console.log(`✓ ${outPath}\n`);
