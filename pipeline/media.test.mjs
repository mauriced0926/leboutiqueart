#!/usr/bin/env node
/** Tests ffmpeg argv construction — verifiable without ffmpeg installed. */
import assert from 'node:assert/strict';
import { buildFfmpegArgs } from './lib/media.mjs';

let passed = 0;
const test = (n, f) => { try { f(); passed++; console.log(`  ✓ ${n}`); } catch (e) { console.error(`  ✗ ${n}\n    ${e.message}`); process.exitCode = 1; } };

const beats = [
  { n: 1, seconds: 6, imagePath: '/tmp/a.png' },
  { n: 2, seconds: 7, imagePath: '/tmp/b.png' },
];
const args = buildFfmpegArgs({ beats, audioPath: '/tmp/vo.mp3', outputPath: '/tmp/out.mp4' });

console.log('\nbuildFfmpegArgs');
test('one input per beat plus the audio track', () => {
  assert.equal(args.filter((a) => a === '-i').length, 3);
});
test('holds each still for its beat duration', () => {
  assert.equal(args[args.indexOf('-t') + 1], '6');
});
test('concatenates exactly the beat count', () => {
  const fc = args[args.indexOf('-filter_complex') + 1];
  assert.ok(fc.includes('concat=n=2'), fc);
});
test('maps the audio from the last input index', () => {
  assert.ok(args.includes('2:a'), 'audio should map to input index 2 (after 2 beats)');
});
test('outputs vertical 1080x1920', () => {
  assert.ok(args[args.indexOf('-filter_complex') + 1].includes('s=1080x1920'));
});
test('sets faststart so the file streams', () => assert.ok(args.includes('+faststart')));
test('returns argv, not a shell string — no injection surface', () => {
  assert.ok(Array.isArray(args));
  const evil = buildFfmpegArgs({ beats: [{ n: 1, seconds: 3, imagePath: '/tmp/a b"; rm -rf /.png' }], audioPath: '/tmp/vo.mp3', outputPath: '/tmp/o.mp4' });
  assert.ok(evil.includes('/tmp/a b"; rm -rf /.png'), 'path passed through as a single argv entry');
});

console.log('\nguards');
test('rejects a beat with no image', () => {
  assert.throws(() => buildFfmpegArgs({ beats: [{ n: 1, seconds: 3 }], audioPath: 'a', outputPath: 'o' }), /Beat 1 has no imagePath/);
});
test('rejects a zero-length beat', () => {
  assert.throws(() => buildFfmpegArgs({ beats: [{ n: 1, seconds: 0, imagePath: 'x' }], audioPath: 'a', outputPath: 'o' }), /non-positive duration/);
});
test('rejects an empty beat list', () => {
  assert.throws(() => buildFfmpegArgs({ beats: [], audioPath: 'a', outputPath: 'o' }), /No beats/);
});

console.log(`\n${passed} assertions passed${process.exitCode ? ' (with failures)' : ''}\n`);
