#!/usr/bin/env node
/** Shot planner tests — cut points must be deterministic and must not lose runtime. */
import assert from 'node:assert/strict';
import { planBeatShots, planEpisodeShots, speakSeconds, MAX_SHOT_SECONDS, MIN_SHOT_SECONDS } from './lib/shots.mjs';

let passed = 0;
const test = (n, f) => { try { f(); passed++; console.log(`  ✓ ${n}`); } catch (e) { console.error(`  ✗ ${n}\n    ${e.message}`); process.exitCode = 1; } };
const total = (shots) => Math.round(shots.reduce((t, s) => t + s.seconds, 0) * 100) / 100;

const line = (speaker, words) => ({ speaker, text: Array(words).fill('word').join(' ') });

console.log('\nspeakSeconds');
test('2.5 words per second', () => assert.equal(speakSeconds('one two three four five'), 2));
test('empty is zero', () => assert.equal(speakSeconds(''), 0));

console.log('\nplanBeatShots');
test('a wordless beat divides evenly, never into slivers', () => {
  const shots = planBeatShots({ n: 1, seconds: 20, lines: [], visual: 'v' });
  assert.equal(total(shots), 20);
  assert.ok(shots.every((s) => s.seconds <= MAX_SHOT_SECONDS));
  // Near-equal, not exactly equal: one shot carries the rounding residue so the beat
  // totals exactly. The real requirement is that no shot is a sliver.
  const lo = Math.min(...shots.map((s) => s.seconds));
  const hi = Math.max(...shots.map((s) => s.seconds));
  assert.ok(hi - lo <= 0.05, `wordless shots should be near-equal, got ${lo}..${hi}`);
});
test('preserves the beat duration exactly', () => {
  const shots = planBeatShots({ n: 2, seconds: 35, visual: 'v', lines: [line('a', 12), line('b', 10), line('c', 14), line('d', 8)] });
  assert.equal(total(shots), 35);
});
test('never exceeds the 8s Veo limit', () => {
  const shots = planBeatShots({ n: 3, seconds: 60, visual: 'v', lines: Array.from({ length: 8 }, (_, i) => line(`s${i}`, 9)) });
  assert.ok(shots.every((s) => s.seconds <= MAX_SHOT_SECONDS + 0.01), JSON.stringify(shots.map((s) => s.seconds)));
  assert.equal(total(shots), 60);
});
test('never emits a sub-minimum shot', () => {
  // This is the case that produced a 1s shot: a long beat whose remainder does not divide.
  for (const seconds of [15, 17, 23, 25, 35, 41, 60]) {
    const shots = planBeatShots({ n: 4, seconds, visual: 'v', lines: [line('a', 30), line('b', 4)] });
    assert.ok(shots.every((s) => s.seconds >= MIN_SHOT_SECONDS - 0.01),
      `beat ${seconds}s produced ${JSON.stringify(shots.map((s) => s.seconds))}`);
    assert.equal(total(shots), seconds, `beat ${seconds}s lost time`);
  }
});
test('never splits a line across a cut', () => {
  const lines = [line('a', 10), line('b', 10), line('c', 10)];
  const shots = planBeatShots({ n: 5, seconds: 30, visual: 'v', lines });
  const flat = shots.flatMap((s) => s.lines);
  assert.equal(flat.length, lines.length, 'every line appears exactly once');
  assert.deepEqual(flat.map((l) => l.speaker), ['a', 'b', 'c'], 'and in order');
});
test('is deterministic across runs', () => {
  const beat = { n: 6, seconds: 35, visual: 'v', lines: [line('a', 12), line('b', 9), line('c', 15)] };
  assert.deepEqual(planBeatShots(beat), planBeatShots(beat));
});

test('every shot sits inside Veo\'s 4-8s window', () => {
  // Veo rejects durationSeconds outside 4..8. A violation only surfaces mid-render, after
  // billing for every clip generated before it.
  for (const seconds of [15, 20, 25, 35, 41, 60]) {
    for (const lineCount of [0, 1, 2, 5, 9]) {
      const lines = Array.from({ length: lineCount }, (_, i) => line(`s${i}`, 8));
      const shots = planBeatShots({ n: 9, seconds, visual: 'v', lines });
      for (const sh of shots) {
        assert.ok(sh.seconds >= MIN_SHOT_SECONDS - 0.01 && sh.seconds <= MAX_SHOT_SECONDS + 0.01,
          `beat ${seconds}s x ${lineCount} lines gave a ${sh.seconds}s shot`);
      }
      assert.equal(Math.round(shots.reduce((t, x) => t + x.seconds, 0) * 100) / 100, seconds);
    }
  }
});

console.log('\nplanEpisodeShots');
test('episode total matches the sum of its beats', () => {
  const episode = { beats: [
    { n: 1, name: 'a', seconds: 20, visual: 'v', lines: [] },
    { n: 2, name: 'b', seconds: 25, visual: 'v', lines: [line('x', 14), line('y', 11)] },
    { n: 3, name: 'c', seconds: 60, visual: 'v', lines: Array.from({ length: 7 }, (_, i) => line(`s${i}`, 10)) },
  ] };
  const shots = planEpisodeShots(episode);
  assert.equal(total(shots), 105);
  assert.ok(shots.every((s) => s.id && /^b\d\ds\d\d$/.test(s.id)), 'every shot needs a stable id for re-rendering');
  assert.equal(new Set(shots.map((s) => s.id)).size, shots.length, 'ids must be unique');
});

console.log(`\n${passed} assertions passed${process.exitCode ? ' (with failures)' : ''}\n`);
