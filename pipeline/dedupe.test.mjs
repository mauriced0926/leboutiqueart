#!/usr/bin/env node
/** Tests for the novelty gate — the component that keeps the channel off the
 *  near-duplicate enforcement radar. Run: node pipeline/dedupe.test.mjs */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { similarity, tokens, trigrams, jaccard, normalize } from './lib/similarity.mjs';
import { checkNovelty, nextEpisodeNumber } from './lib/registry.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const bible = JSON.parse(readFileSync(join(HERE, 'series-bible.json'), 'utf8'));

let passed = 0;
const test = (name, fn) => {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e) { console.error(`  ✗ ${name}\n    ${e.message}`); process.exitCode = 1; }
};

console.log('\nnormalize / tokens');
test('strips punctuation and case', () => assert.equal(normalize('The Wobbly STOOL!'), 'the wobbly stool'));
test('drops series stopwords that carry no signal', () => {
  assert.deepEqual(tokens('Mango fixes a broken stool'), ['stool']);
});
test('jaccard of identical sets is 1', () => assert.equal(jaccard(new Set(['a']), new Set(['a'])), 1));
test('jaccard of disjoint sets is 0', () => assert.equal(jaccard(new Set(['a']), new Set(['b'])), 0));
test('trigrams of short string still produced', () => assert.ok(trigrams('ab').size > 0));

console.log('\nsimilarity — the adversarial cases');
test('identical premises score 1', () => {
  assert.equal(similarity('a wobbly stool leg', 'a wobbly stool leg'), 1);
});
test('paraphrase of the same premise scores high', () => {
  // This is the failure mode that matters: an LLM "new" episode that is the old one reworded.
  const s = similarity('the stool wobbles because one leg is short',
                       'a stool that wobbles since a leg became too short');
  assert.ok(s > 0.45, `expected >0.45, got ${s.toFixed(3)}`);
});
test('genuinely different premises score low', () => {
  const s = similarity('the stool wobbles because one leg is short',
                       'a kite will not fly because its tail is missing');
  assert.ok(s < 0.25, `expected <0.25, got ${s.toFixed(3)}`);
});
test('same object, different fault is not flagged as duplicate', () => {
  const s = similarity('a stool leg has split along the grain',
                       'a stool seat is sticky with spilled honey');
  assert.ok(s < bible.dedupe_axes.similarity_threshold, `got ${s.toFixed(3)}`);
});

console.log('\ncheckNovelty');
const hist = [
  { episode: 1, premise: 'a stool wobbles because one leg is short', broken_object: 'stool', fix_principle: 'shimming', owner: 'bramble', cause: 'wear' },
  { episode: 2, premise: 'a kite will not fly because its tail is missing', broken_object: 'kite', fix_principle: 'drag and balance', owner: 'wren', cause: 'lost part' },
];

test('a genuinely new episode passes', () => {
  const r = checkNovelty({ premise: 'a music box plays too slowly because its spring is loose', broken_object: 'music box', fix_principle: 'tension', owner: 'mole', cause: 'loosening' }, hist, bible);
  assert.ok(r.ok, r.reasons.join('; '));
});

test('a reworded duplicate premise is rejected', () => {
  const r = checkNovelty({ premise: 'a stool that wobbles since one of its legs is too short', broken_object: 'bench', fix_principle: 'packing', owner: 'mole', cause: 'shrinkage' }, hist, bible);
  assert.ok(!r.ok);
  assert.ok(r.reasons.some((x) => /similar to episode 1/.test(x)), r.reasons.join('; '));
});

test('reused object inside its window is rejected with a usable reason', () => {
  const r = checkNovelty({ premise: 'something entirely unrelated about a lantern wick', broken_object: 'Stool', fix_principle: 'trimming', owner: 'mole', cause: 'soot' }, hist, bible);
  assert.ok(!r.ok);
  assert.ok(r.reasons.some((x) => /broken_object "Stool" was used in episode 1/.test(x)), r.reasons.join('; '));
});

test('axis matching is case- and punctuation-insensitive', () => {
  const r = checkNovelty({ premise: 'unrelated premise about a very different thing', broken_object: '  STOOL! ', fix_principle: 'gluing', owner: 'mole', cause: 'damp' }, hist, bible);
  assert.ok(!r.ok && r.reasons.some((x) => /broken_object/.test(x)));
});

test('a missing axis is reported rather than silently passing', () => {
  const r = checkNovelty({ premise: 'a lantern wick will not catch', broken_object: 'lantern' }, hist, bible);
  assert.ok(!r.ok);
  assert.ok(r.reasons.some((x) => /missing required axis "fix_principle"/.test(x)), r.reasons.join('; '));
});

test('empty history accepts anything well-formed', () => {
  const r = checkNovelty({ premise: 'first ever episode', broken_object: 'cup', fix_principle: 'sealing', owner: 'bramble', cause: 'a chip' }, [], bible);
  assert.ok(r.ok, r.reasons.join('; '));
});

test('axis outside its recency window is allowed again', () => {
  // owner window is 6 — build 7 episodes so the oldest owner falls out of it.
  const long = Array.from({ length: 7 }, (_, i) => ({
    episode: i + 1, premise: `distinct premise number ${i} about an unrelated object`,
    broken_object: `object${i}`, fix_principle: `principle${i}`,
    owner: i === 0 ? 'bramble' : `owner${i}`, cause: `cause${i}`,
  }));
  const r = checkNovelty({ premise: 'a brand new premise concerning a windmill sail', broken_object: 'windmill', fix_principle: 'catching wind', owner: 'bramble', cause: 'a tear' }, long, bible);
  assert.ok(r.ok, `expected bramble to be reusable after 6 episodes; got: ${r.reasons.join('; ')}`);
});

test('reasons are specific enough to feed back as generator constraints', () => {
  const r = checkNovelty({ premise: 'a stool that wobbles since one leg is short', broken_object: 'stool', fix_principle: 'shimming', owner: 'bramble', cause: 'wear' }, hist, bible);
  assert.ok(r.reasons.length >= 4, `expected every clashing axis reported, got ${r.reasons.length}`);
});

console.log('\nnextEpisodeNumber');
test('increments from max', () => assert.equal(nextEpisodeNumber(hist), 3));
test('starts at 1 on empty history', () => assert.equal(nextEpisodeNumber([]), 1));
test('survives gaps and bad values', () => {
  assert.equal(nextEpisodeNumber([{ episode: 9 }, { episode: 'x' }, { episode: 3 }]), 10);
});

console.log(`\n${passed} assertions passed${process.exitCode ? ' (with failures)' : ''}\n`);
