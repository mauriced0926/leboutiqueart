#!/usr/bin/env node
/**
 * Review queue. The human gate between generation and publication.
 *
 * This is the main defence against the mass-production fingerprint, and the reason a bad
 * generation never reaches the channel. It costs a few minutes a day.
 *
 *   node pipeline/review.mjs              list the queue
 *   node pipeline/review.mjs show 12      print an episode in full
 *   node pipeline/review.mjs approve 12
 *   node pipeline/review.mjs reject 12 "fix isn't physically real"
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { paths } from './lib/config.mjs';

const [cmd, arg, ...rest] = process.argv.slice(2);
const pad = (n) => String(n).padStart(4, '0');
const dirFor = (n) => join(paths.queue, pad(n));
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

function listQueue() {
  if (!existsSync(paths.queue)) return [];
  return readdirSync(paths.queue)
    .filter((d) => existsSync(join(paths.queue, d, 'episode.json')))
    .map((d) => ({
      dir: d,
      episode: readJson(join(paths.queue, d, 'episode.json')),
      status: readJson(join(paths.queue, d, 'status.json')),
    }))
    .sort((a, b) => a.episode.episode - b.episode.episode);
}

function setState(n, state, note) {
  const p = join(dirFor(n), 'status.json');
  if (!existsSync(p)) { console.error(`Episode ${n} is not in the queue.`); process.exit(1); }
  const status = readJson(p);
  writeFileSync(p, JSON.stringify({ ...status, state, note, reviewed_at: new Date().toISOString() }, null, 2));
  console.log(`Episode ${n} → ${state}${note ? ` (${note})` : ''}`);
}

if (cmd === 'approve') setState(Number(arg), 'approved', rest.join(' ') || undefined);
else if (cmd === 'reject') setState(Number(arg), 'rejected', rest.join(' ') || undefined);
else if (cmd === 'show') {
  const e = readJson(join(dirFor(Number(arg)), 'episode.json'));
  console.log(`\n${e.title}\n${'─'.repeat(e.title.length)}`);
  console.log(`premise:   ${e.premise}`);
  console.log(`principle: ${e.fix_principle}   (${e.broken_object}, ${e.cause}, brought by ${e.owner})\n`);
  for (const b of e.beats) {
    console.log(`  ${b.n}. ${b.name} (${b.seconds}s)`);
    console.log(`     visual:    ${b.visual}`);
    console.log(`     caption:   ${b.caption}`);
    if (b.narration) console.log(`     narration: "${b.narration}"`);
  }
  console.log(`\ndescription: ${e.description}`);
  console.log(`tags: ${e.tags.join(', ')}\n`);
  console.log('Check before approving: is the fix physically real? could a child copy it dangerously?');
  console.log('does it feel like the same show as yesterday? is it genuinely a different episode?\n');
} else {
  const q = listQueue();
  if (!q.length) { console.log('\nQueue is empty. Generate one: node pipeline/run.mjs\n'); process.exit(0); }
  console.log('');
  for (const { episode, status } of q) {
    const mark = { pending_review: '·', approved: '✓', rejected: '✗', published: '↑' }[status.state] ?? '?';
    console.log(`  ${mark} ${String(episode.episode).padStart(4)} ${status.state.padEnd(15)} ${episode.title}`);
  }
  console.log(`\n${q.filter((x) => x.status.state === 'pending_review').length} awaiting review`);
  console.log('node pipeline/review.mjs show <n> | approve <n> | reject <n> "reason"\n');
}
