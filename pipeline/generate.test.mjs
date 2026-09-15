#!/usr/bin/env node
/** Tests the generation loop's control flow with a mock Claude client — verifies the
 *  novelty gate actually gates, and that rejection reasons reach the retry prompt. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { generateEpisode, systemPrompt, userPrompt } from './lib/generate.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const bible = JSON.parse(readFileSync(join(HERE, 'series-bible.json'), 'utf8'));

let passed = 0;
const test = async (name, fn) => {
  try { await fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e) { console.error(`  ✗ ${name}\n    ${e.message}`); process.exitCode = 1; }
};

const beats = [1, 2, 3, 4, 5].map((n) => ({ n, name: `beat${n}`, seconds: 7, visual: 'v', caption: 'c', narration: 'n' }));
const ep = (over) => ({ title: 't', premise: 'p', broken_object: 'o', cause: 'c', fix_principle: 'f', owner: 'w', beats, description: 'd', tags: [], ...over });

/** Mock client: returns a queued response per call and records the requests it saw. */
function mockClient(queue) {
  const calls = [];
  return {
    calls,
    messages: {
      parse: async (req) => {
        calls.push(req);
        const next = queue.shift();
        if (!next) throw new Error('mock ran out of queued responses');
        return next;
      },
    },
  };
}

const history = [
  { episode: 1, premise: 'a stool wobbles because one leg is short', broken_object: 'stool', fix_principle: 'shimming', owner: 'bramble', cause: 'wear' },
];

console.log('\ngenerateEpisode');

await test('returns a novel episode on first attempt', async () => {
  const client = mockClient([{ stop_reason: 'end_turn', parsed_output: ep({ premise: 'a lantern wick will not catch a flame', broken_object: 'lantern', fix_principle: 'drawing fuel upward', owner: 'mole', cause: 'soot' }) }]);
  const { episode, attempts } = await generateEpisode({ bible, history, client });
  assert.equal(episode.episode, 2, 'episode number should follow history');
  assert.equal(attempts.length, 1);
  assert.equal(episode.model, 'claude-opus-5');
  assert.ok(episode.generated_at, 'should stamp generation time');
});

await test('rejects a duplicate and retries until novel', async () => {
  const client = mockClient([
    // Attempt 1: a reworded copy of episode 1 — must be caught.
    { stop_reason: 'end_turn', parsed_output: ep({ premise: 'a stool that wobbles since one of its legs is too short', broken_object: 'stool', fix_principle: 'shimming', owner: 'bramble', cause: 'wear' }) },
    // Attempt 2: genuinely different.
    { stop_reason: 'end_turn', parsed_output: ep({ premise: 'a music box plays too slowly', broken_object: 'music box', fix_principle: 'tension', owner: 'mole', cause: 'a loose spring' }) },
  ]);
  const { episode, attempts } = await generateEpisode({ bible, history, client });
  assert.equal(attempts.length, 2, 'should have taken two attempts');
  assert.equal(attempts[0].ok, false);
  assert.equal(episode.broken_object, 'music box');
});

await test('feeds the specific rejection reasons into the retry prompt', async () => {
  const client = mockClient([
    { stop_reason: 'end_turn', parsed_output: ep({ premise: 'a stool that wobbles since one of its legs is too short', broken_object: 'stool', fix_principle: 'shimming', owner: 'bramble', cause: 'wear' }) },
    { stop_reason: 'end_turn', parsed_output: ep({ premise: 'a music box plays too slowly', broken_object: 'music box', fix_principle: 'tension', owner: 'mole', cause: 'a loose spring' }) },
  ]);
  await generateEpisode({ bible, history, client });
  const retryPrompt = client.calls[1].messages[0].content;
  assert.ok(/REJECTED/.test(retryPrompt), 'retry prompt should state the rejection');
  assert.ok(/broken_object "stool" was used in episode 1/.test(retryPrompt), 'should name the exact clash');
  assert.ok(!/REJECTED/.test(client.calls[0].messages[0].content), 'first prompt should carry no rejection');
});

await test('gives up with an actionable error rather than lowering the bar', async () => {
  const dup = { stop_reason: 'end_turn', parsed_output: ep({ premise: 'a stool wobbles because one leg is short', broken_object: 'stool', fix_principle: 'shimming', owner: 'bramble', cause: 'wear' }) };
  const client = mockClient([dup, dup]);
  await assert.rejects(
    () => generateEpisode({ bible, history, client, maxAttempts: 2 }),
    (e) => /Could not generate a novel episode in 2 attempts/.test(e.message)
       && /rather than lowering the similarity threshold/.test(e.message),
  );
});

await test('surfaces a safety refusal instead of silently retrying', async () => {
  const client = mockClient([{ stop_reason: 'refusal', stop_details: { explanation: 'test refusal' }, parsed_output: null }]);
  await assert.rejects(() => generateEpisode({ bible, history, client }), /refused by safety classifier: test refusal/);
});

await test('treats an unparseable response as a retryable attempt', async () => {
  const client = mockClient([
    { stop_reason: 'end_turn', parsed_output: null },
    { stop_reason: 'end_turn', parsed_output: ep({ premise: 'a kite tail is missing', broken_object: 'kite', fix_principle: 'drag', owner: 'wren', cause: 'a tear' }) },
  ]);
  const { attempts } = await generateEpisode({ bible, history, client });
  assert.equal(attempts.length, 2);
  assert.equal(attempts[0].error, 'parse failed');
});

console.log('\nprompt construction');
await test('system prompt carries the bible and the hard rules', () => {
  const s = systemPrompt(bible);
  assert.ok(s.includes("Fix-It Forest"));
  assert.ok(s.includes('physically real'));
});
await test('first-episode prompt differs from a later one', () => {
  assert.ok(/first episode/i.test(userPrompt(1, [], [])));
  assert.ok(/Recent episodes/.test(userPrompt(5, history, [])));
});
await test('uses claude-opus-5 with adaptive thinking', async () => {
  const client = mockClient([{ stop_reason: 'end_turn', parsed_output: ep({ premise: 'x y z distinct', broken_object: 'bell', fix_principle: 'ringing', owner: 'mole', cause: 'a crack' }) }]);
  await generateEpisode({ bible, history, client });
  assert.equal(client.calls[0].model, 'claude-opus-5');
  assert.deepEqual(client.calls[0].thinking, { type: 'adaptive' });
  assert.ok(client.calls[0].output_config?.format, 'should use structured outputs');
});

console.log(`\n${passed} assertions passed${process.exitCode ? ' (with failures)' : ''}\n`);
