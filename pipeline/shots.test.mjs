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
  const shots = planBeatShots({ n: 1, seconds: 24, lines: [], visual: 'v' });
  assert.equal(total(shots), 24);
  assert.ok(shots.every((s) => ALLOWED_SECONDS.includes(s.seconds)));
  assert.equal(shots.length, 3, '24s should be three 8s clips');
});
test('preserves the beat duration exactly', () => {
  const shots = planBeatShots({ n: 2, seconds: 32, visual: 'v', lines: [line('a', 12), line('b', 10), line('c', 14), line('d', 8)] });
  assert.equal(total(shots), 32);
});
test('never exceeds the 8s Veo limit', () => {
  const shots = planBeatShots({ n: 3, seconds: 64, visual: 'v', lines: Array.from({ length: 8 }, (_, i) => line(`s${i}`, 9)) });
  assert.ok(shots.every((s) => s.seconds <= MAX_SHOT_SECONDS), JSON.stringify(shots.map((s) => s.seconds)));
  assert.equal(total(shots), 64);
});
test('never emits a sub-minimum shot', () => {
  for (const seconds of [16, 24, 32, 64]) {
    const shots = planBeatShots({ n: 4, seconds, visual: 'v', lines: [line('a', 30), line('b', 4)] });
    assert.ok(shots.every((s) => s.seconds >= MIN_SHOT_SECONDS),
      `beat ${seconds}s produced ${JSON.stringify(shots.map((s) => s.seconds))}`);
    assert.equal(total(shots), seconds, `beat ${seconds}s lost time`);
  }
});
test('never splits a line across a cut', () => {
  const lines = [line('a', 10), line('b', 10), line('c', 10)];
  const shots = planBeatShots({ n: 5, seconds: 32, visual: 'v', lines });
  const flat = shots.flatMap((s) => s.lines);
  assert.equal(flat.length, lines.length, 'every line appears exactly once');
  assert.deepEqual(flat.map((l) => l.speaker), ['a', 'b', 'c'], 'and in order');
});
test('is deterministic across runs', () => {
  const beat = { n: 6, seconds: 32, visual: 'v', lines: [line('a', 12), line('b', 9), line('c', 15)] };
  assert.deepEqual(planBeatShots(beat), planBeatShots(beat));
});

test('every shot is exactly 4, 6 or 8 seconds', () => {
  // Veo rejects 5, 7 and every fractional value despite an error message claiming
  // "between 4 and 8, inclusive". A violation only surfaces mid-render, after billing.
  for (const seconds of [16, 24, 32, 40, 64]) {
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

test('a non-multiple of 8 fails loudly rather than crashing', () => {
  // Previously this produced a fractional clip count and an opaque "Invalid array length".
  for (const bad of [25, 20, 26, 34]) {
    assert.throws(() => planBeatShots({ n: 1, seconds: bad, visual: 'v', lines: [] }),
      /not a multiple of 8s/, `${bad}s should be rejected clearly`);
  }
});

console.log('\ncomposeDurations');
test('composes an even total exactly', () => {
  assert.deepEqual(composeDurations(32, 4), [8, 8, 8, 8]);
  assert.equal(composeDurations(64, 8).reduce((a, b) => a + b, 0), 64);
});
test('refuses anything that is not count x 8', () => {
  assert.equal(composeDurations(25, 4), null);
  assert.equal(composeDurations(26, 4), null);
});
test('refuses a count that cannot reach the total', () => {
  assert.equal(composeDurations(64, 2), null);  // 2 clips can only make 16s
  assert.equal(composeDurations(8, 4), null);   // 4 clips can only make 32s
});

console.log('\nplanEpisodeShots');
test('episode total matches the sum of its beats', () => {
  const episode = { beats: [
    { n: 1, name: 'a', seconds: 24, visual: 'v', lines: [] },
    { n: 2, name: 'b', seconds: 24, visual: 'v', lines: [line('x', 14), line('y', 11)] },
    { n: 3, name: 'c', seconds: 64, visual: 'v', lines: Array.from({ length: 7 }, (_, i) => line(`s${i}`, 10)) },
  ] };
  const shots = planEpisodeShots(episode);
  assert.equal(total(shots), 112);
  assert.ok(shots.every((s) => s.id && /^b\d\ds\d\d$/.test(s.id)), 'every shot needs a stable id for re-rendering');
  assert.equal(new Set(shots.map((s) => s.id)).size, shots.length, 'ids must be unique');
});

console.log(`\n${passed} assertions passed${process.exitCode ? ' (with failures)' : ''}\n`);
