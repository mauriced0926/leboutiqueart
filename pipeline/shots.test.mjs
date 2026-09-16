#!/usr/bin/env node
/** Shot planner tests — cut points must be deterministic and must not lose runtime. */
import assert from 'node:assert/strict';
import { planBeatShots, planEpisodeShots, speakSeconds, composeDurations, ALLOWED_SECONDS, MAX_SHOT_SECONDS, MIN_SHOT_SECONDS } from './lib/shots.mjs';

let passed = 0;
const test = (n, f) => { try { f(); passed++; console.log(`  ✓ ${n}`); } catch (e) { console.error(`  ✗ ${n}\n    ${e.message}`); process.exitCode = 1; } };
const total = (shots) => Math.round(shots.reduce((t, s) => t + s.seconds, 0) * 100) / 100;

const line = (speaker, words) => ({ speaker, text: Array(words).fill('word').join(' ') });

console.log('\nspeakSeconds');
test('2.5 words per second', () => assert.equal(speakSeconds('one two three four five'), 2));
test('empty is zero', () => assert.equal(speakSeconds(''), 0));

console.log('\nplanBeatShots');
test('a wordless beat uses the fewest clips that compose it', () => {
  const shots = planBeatShots({ n: 1, seconds: 20, lines: [], visual: 'v' });
  assert.equal(total(shots), 20);
  assert.ok(shots.every((s) => ALLOWED_SECONDS.includes(s.seconds)));
  assert.equal(shots.length, 3, '20s should be 8+8+4, not more cuts than needed');
});
test('preserves the beat duration exactly', () => {
  const shots = planBeatShots({ n: 2, seconds: 36, visual: 'v', lines: [line('a', 12), line('b', 10), line('c', 14), line('d', 8)] });
  assert.equal(total(shots), 36);
});
test('never exceeds the 8s Veo limit', () => {
  const shots = planBeatShots({ n: 3, seconds: 60, visual: 'v', lines: Array.from({ length: 8 }, (_, i) => line(`s${i}`, 9)) });
  assert.ok(shots.every((s) => s.seconds <= MAX_SHOT_SECONDS), JSON.stringify(shots.map((s) => s.seconds)));
  assert.equal(total(shots), 60);
});
test('never emits a sub-minimum shot', () => {
  for (const seconds of [16, 20, 24, 36, 60]) {
    const shots = planBeatShots({ n: 4, seconds, visual: 'v', lines: [line('a', 30), line('b', 4)] });
    assert.ok(shots.every((s) => s.seconds >= MIN_SHOT_SECONDS),
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
  const beat = { n: 6, seconds: 36, visual: 'v', lines: [line('a', 12), line('b', 9), line('c', 15)] };
  assert.deepEqual(planBeatShots(beat), planBeatShots(beat));
});

test('every shot is exactly 4, 6 or 8 seconds', () => {
  // Veo rejects 5, 7 and every fractional value despite an error message claiming
  // "between 4 and 8, inclusive". A violation only surfaces mid-render, after billing.
  for (const seconds of [16, 20, 24, 26, 34, 36, 60]) {
    for (const lineCount of [0, 1, 2, 5, 9, 14]) {
      const lines = Array.from({ length: lineCount }, (_, i) => line(`s${i}`, 8));
      const shots = planBeatShots({ n: 9, seconds, visual: 'v', lines });
      for (const sh of shots) {
        assert.ok(ALLOWED_SECONDS.includes(sh.seconds),
          `beat ${seconds}s x ${lineCount} lines gave a ${sh.seconds}s shot`);
      }
      assert.equal(shots.reduce((t, x) => t + x.seconds, 0), seconds, `beat ${seconds}s lost time`);
      assert.equal(shots.flatMap((x) => x.lines).length, lineCount, 'every line must survive');
    }
  }
});

test('an odd beat duration fails loudly rather than rendering wrong', () => {
  assert.throws(() => planBeatShots({ n: 1, seconds: 25, visual: 'v', lines: [] }),
    /cannot be composed from 4\/6\/8s clips/);
});

console.log('\ncomposeDurations');
test('composes an even total exactly', () => {
  assert.deepEqual(composeDurations(26, 4), [8, 8, 6, 4]);
  assert.equal(composeDurations(60, 8).reduce((a, b) => a + b, 0), 60);
});
test('refuses an odd total', () => assert.equal(composeDurations(25, 4), null));
test('refuses a count that cannot reach the total', () => {
  assert.equal(composeDurations(60, 2), null);  // max 16s from 2 clips
  assert.equal(composeDurations(8, 4), null);   // min 16s from 4 clips
});

console.log('\nplanEpisodeShots');
test('episode total matches the sum of its beats', () => {
  const episode = { beats: [
    { n: 1, name: 'a', seconds: 20, visual: 'v', lines: [] },
    { n: 2, name: 'b', seconds: 26, visual: 'v', lines: [line('x', 14), line('y', 11)] },
    { n: 3, name: 'c', seconds: 60, visual: 'v', lines: Array.from({ length: 7 }, (_, i) => line(`s${i}`, 10)) },
  ] };
  const shots = planEpisodeShots(episode);
  assert.equal(total(shots), 106);
  assert.ok(shots.every((s) => s.id && /^b\d\ds\d\d$/.test(s.id)), 'every shot needs a stable id for re-rendering');
  assert.equal(new Set(shots.map((s) => s.id)).size, shots.length, 'ids must be unique');
});

console.log(`\n${passed} assertions passed${process.exitCode ? ' (with failures)' : ''}\n`);
