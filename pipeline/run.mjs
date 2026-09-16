#!/usr/bin/env node
/**
 * Generate one episode and stage it in the review queue.
 *
 * Nothing here publishes. Generation and publishing are separate commands on purpose:
 * a human approves between them (pipeline/review.mjs).
 */
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import Anthropic from 'anthropic-sdk';
import { loadEnv, require_, paths } from './lib/config.mjs';
import { loadRegistry, appendRegistry } from './lib/registry.mjs';
import { generateEpisode } from './lib/generate.mjs';
import { ffmpegAvailable } from './lib/media.mjs';

// Setup problems are the common failure here and a stack trace buries the fix.
process.on('uncaughtException', (e) => { console.error(`\n${e.message}\n`); process.exit(1); });
process.on('unhandledRejection', (e) => { console.error(`\n${e instanceof Error ? e.message : e}\n`); process.exit(1); });

const env = loadEnv();
const dry = process.argv.includes('--dry-run');

const bible = JSON.parse(readFileSync(paths.bible, 'utf8'));
const history = loadRegistry(paths.registry);

console.log(`\nSeries: ${bible.series.title}`);
console.log(`History: ${history.length} episodes`);
if (!(await ffmpegAvailable())) {
  console.log('Note: ffmpeg not found — script will generate, assembly will not. See pipeline/README.md.');
}

require_(env, 'ANTHROPIC_API_KEY', 'Get one at console.anthropic.com, then add it to .env.local.');
const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

const { episode, attempts } = await generateEpisode({ bible, history, client });

console.log(`\n✓ Episode ${episode.episode}: ${episode.title}`);
console.log(`  premise:   ${episode.premise}`);
console.log(`  object:    ${episode.broken_object}  ·  principle: ${episode.fix_principle}`);
console.log(`  domain:    ${episode.domain}  ·  lead: ${episode.lead_fixer}  ·  first try: ${episode.failed_attempt}`);
console.log(`  runtime:   ${episode.beats.reduce((t, b) => t + b.seconds, 0)}s across ${episode.beats.length} beats`);
console.log(`  attempts:  ${attempts.length}${attempts.length > 1 ? ` (${attempts.length - 1} rejected by the novelty gate)` : ''}`);
for (const a of attempts.filter((x) => x.ok === false)) {
  for (const r of a.reasons ?? []) console.log(`    rejected: ${r}`);
}

if (dry) { console.log('\nDry run — nothing written.\n'); process.exit(0); }

const dir = join(paths.queue, String(episode.episode).padStart(4, '0'));
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, 'episode.json'), JSON.stringify(episode, null, 2));
writeFileSync(join(dir, 'status.json'), JSON.stringify({ state: 'pending_review', staged_at: new Date().toISOString() }, null, 2));

// Recorded immediately, before review. A rejected episode must still occupy its premise
// so the generator cannot rediscover it tomorrow.
appendRegistry(paths.registry, {
  episode: episode.episode, premise: episode.premise, broken_object: episode.broken_object,
  fix_principle: episode.fix_principle, owner: episode.owner, cause: episode.cause,
  domain: episode.domain, failed_attempt: episode.failed_attempt, lead_fixer: episode.lead_fixer,
  title: episode.title, staged_at: episode.generated_at,
});

console.log(`\nStaged for review: ${dir}`);
console.log('Next: node pipeline/review.mjs\n');
