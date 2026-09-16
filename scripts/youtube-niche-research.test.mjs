#!/usr/bin/env node
/**
 * Smoke test for youtube-niche-research.mjs — exercises the pure analysis and
 * rendering path with synthetic data, so the pipeline can be verified without
 * spending API quota. Run: node scripts/youtube-niche-research.test.mjs
 */
import assert from 'node:assert/strict';
import { analyse, median, parseDuration, percentile, fmt, monthsSince, renderMarkdown }
  from './youtube-niche-research.mjs';

let passed = 0;
const test = (name, fn) => {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e) { console.error(`  ✗ ${name}\n    ${e.message}`); process.exitCode = 1; }
};

console.log('\nparseDuration');
test('minutes and seconds', () => assert.equal(parseDuration('PT1M30S'), 90));
test('seconds only', () => assert.equal(parseDuration('PT45S'), 45));
test('whole minutes', () => assert.equal(parseDuration('PT3M'), 180));
test('hours', () => assert.equal(parseDuration('PT1H2M3S'), 3723));
test('fractional seconds', () => assert.equal(parseDuration('PT8.5S'), 8.5));
test('garbage is null', () => assert.equal(parseDuration('nonsense'), null));
test('non-string is null', () => assert.equal(parseDuration(undefined), null));

console.log('\nmedian / percentile');
test('odd length', () => assert.equal(median([3, 1, 2]), 2));
test('even length averages', () => assert.equal(median([1, 2, 3, 4]), 2.5));
test('empty is null', () => assert.equal(median([]), null));
test('ignores NaN', () => assert.equal(median([1, NaN, 3]), 2));
test('p90', () => assert.equal(percentile([1,2,3,4,5,6,7,8,9,10], 90), 10));

console.log('\nfmt');
test('thousands', () => assert.equal(fmt(12345), '12.3K'));
test('millions', () => assert.equal(fmt(2_400_000), '2.4M'));
test('billions', () => assert.equal(fmt(3_500_000_000), '3.5B'));
test('null', () => assert.equal(fmt(null), '—'));

console.log('\nmonthsSince');
test('roughly 12 months', () => {
  const m = monthsSince(new Date(Date.now() - 365 * 86400_000).toISOString());
  assert.ok(m > 11.5 && m < 12.5, `got ${m}`);
});

console.log('\nanalyse');
const now = Date.now();
const iso = (daysAgo) => new Date(now - daysAgo * 86400_000).toISOString();

const channels = new Map([
  // Established veteran with a big base and modest reach multiple.
  ['C_OLD', { id: 'C_OLD', title: 'Veteran Kids', publishedAt: iso(2000), ageMonths: monthsSince(iso(2000)), subs: 1_000_000, totalViews: 5e9, videoCount: 900 }],
  // Young channel getting far more views than it has subscribers.
  ['C_NEW', { id: 'C_NEW', title: 'Newcomer', publishedAt: iso(120), ageMonths: monthsSince(iso(120)), subs: 1_000, totalViews: 5e6, videoCount: 40 }],
  // Hidden subscriber count must not be treated as zero.
  ['C_HID', { id: 'C_HID', title: 'Hidden Subs', publishedAt: iso(60), ageMonths: monthsSince(iso(60)), subs: null, totalViews: 1e6, videoCount: 10 }],
]);

const videos = [
  { id: 'v1', title: 'A', channelId: 'C_OLD', channelTitle: 'Veteran Kids', publishedAt: iso(10), seconds: 45, views: 500_000, madeForKids: true },
  { id: 'v2', title: 'B', channelId: 'C_NEW', channelTitle: 'Newcomer', publishedAt: iso(10), seconds: 30, views: 50_000, madeForKids: false },
  { id: 'v3', title: 'C', channelId: 'C_HID', channelTitle: 'Hidden Subs', publishedAt: iso(5), seconds: 60, views: 10_000, madeForKids: null },
];

const r = analyse('test niche', videos, channels);

test('counts the sample', () => assert.equal(r.sampled, 3));
test('counts unique channels', () => assert.equal(r.uniqueChannels, 3));
test('median views', () => assert.equal(r.medianViews, 50_000));
test('views-per-sub skips hidden-sub channels', () => {
  // Only C_OLD (0.5x) and C_NEW (50x) are computable; median of two is their mean.
  assert.equal(r.medianViewsPerSub, (0.5 + 50) / 2);
});
test('new-entrant share counts channels under 12 months', () => {
  assert.equal(r.newEntrantShare, 2 / 3); // C_NEW and C_HID are young, C_OLD is not
});
test('MFK share ignores unknown flags', () => {
  assert.equal(r.madeForKidsShare, 0.5); // 1 of the 2 known, v3 excluded
});
test('openness is a 0-100 number', () => {
  assert.ok(Number.isFinite(r.openness) && r.openness >= 0 && r.openness <= 100, `got ${r.openness}`);
});
test('top videos sorted by views', () => assert.equal(r.topVideos[0].id, 'v1'));

console.log('\nedge cases');
test('no computable subs leaves views-per-sub and openness null', () => {
  const only = new Map([['C_HID', channels.get('C_HID')]]);
  const e = analyse('hidden only', [videos[2]], only);
  assert.equal(e.medianViewsPerSub, null);
  assert.equal(e.openness, null);
});
test('unknown channel does not throw', () => {
  const e = analyse('orphan', [{ ...videos[0], channelId: 'MISSING' }], new Map());
  assert.equal(e.uniqueChannels, 0);
  assert.equal(e.medianViews, 500_000);
});

console.log('\nrenderMarkdown');
test('renders a table with the niche row', () => {
  const md = renderMarkdown([r], { days: 30, order: 'viewCount', regionCode: 'US', quotaUsed: 204 });
  assert.ok(md.includes('| test niche |'), 'missing niche row');
  assert.ok(md.includes('204 units'), 'missing quota line');
  assert.ok(md.includes('https://youtube.com/watch?v=v1'), 'missing video link');
});
test('escapes pipes in titles so the table survives', () => {
  const piped = [{ ...videos[0], title: 'Hooks | Tricks' }];
  const md = renderMarkdown([analyse('piped', piped, channels)], { days: 30, order: 'viewCount', regionCode: 'US', quotaUsed: 0 });
  assert.ok(md.includes('Hooks \\| Tricks'), 'pipe not escaped');
});

console.log(`\n${passed} assertions passed${process.exitCode ? ' (with failures)' : ''}\n`);
