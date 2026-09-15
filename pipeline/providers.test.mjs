#!/usr/bin/env node
/** Verifies the Google image/TTS request shapes and error handling with a mocked fetch.
 *  These APIs can't be live-tested without a billable key, so the wire format is pinned here. */
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateImage, generateVoiceover } from './lib/media.mjs';

let passed = 0;
const test = async (n, f) => { try { await f(); passed++; console.log(`  ✓ ${n}`); } catch (e) { console.error(`  ✗ ${n}\n    ${e.message}`); process.exitCode = 1; } };

const tmp = mkdtempSync(join(tmpdir(), 'prov-'));
const realFetch = global.fetch;
let seen = null;
const mock = (status, body) => { global.fetch = async (url, opts) => { seen = { url: String(url), body: JSON.parse(opts.body), opts }; return { ok: status < 400, status, text: async () => JSON.stringify(body) }; }; };
const PNG = Buffer.from('89504e470d0a1a0a', 'hex');
const okImage = { candidates: [{ finishReason: 'STOP', content: { parts: [{ inlineData: { mimeType: 'image/png', data: PNG.toString('base64') } }] } }] };

console.log('\ngenerateImage');
await test('posts to the image model with IMAGE response modality', async () => {
  mock(200, okImage);
  await generateImage({ prompt: 'a fox', stylePrompt: 'gouache', outputPath: join(tmp, 'x.png'), env: { GEMINI_API_KEY: 'k1' } });
  assert.ok(seen.url.includes('/models/gemini-3.1-flash-image:generateContent'), seen.url);
  assert.deepEqual(seen.body.generationConfig.responseModalities, ['TEXT', 'IMAGE']);
});
await test('writes the decoded image bytes to disk', async () => {
  mock(200, okImage);
  const out = join(tmp, 'y.png');
  await generateImage({ prompt: 'p', stylePrompt: 's', outputPath: out, env: { GEMINI_API_KEY: 'k1' } });
  assert.ok(existsSync(out));
  assert.deepEqual(readFileSync(out), PNG);
});
await test('sends reference images as inlineData before the prompt', async () => {
  const ref = join(tmp, 'sheet.png'); writeFileSync(ref, PNG);
  mock(200, okImage);
  await generateImage({ prompt: 'p', stylePrompt: 's', referenceImages: [ref], outputPath: join(tmp, 'z.png'), env: { GEMINI_API_KEY: 'k1' } });
  const parts = seen.body.contents[0].parts;
  assert.equal(parts[0].inlineData.data, PNG.toString('base64'), 'reference should come first');
  assert.ok(parts[1].text.includes('STYLE'), 'style block should follow the references');
});
await test('style block is appended verbatim — the anti-drift mechanism', async () => {
  mock(200, okImage);
  await generateImage({ prompt: 'p', stylePrompt: 'PALETTE #E86A33 only', outputPath: join(tmp, 'a.png'), env: { GEMINI_API_KEY: 'k1' } });
  assert.ok(seen.body.contents[0].parts.at(-1).text.includes('PALETTE #E86A33 only'));
});
await test('missing key gives setup guidance, not a 400', async () => {
  await assert.rejects(() => generateImage({ prompt: 'p', stylePrompt: 's', outputPath: join(tmp, 'b.png'), env: {} }),
    /GEMINI_API_KEY is not set.*YOUTUBE_API_KEY will not work/s);
});
await test('safety stop is reported as such', async () => {
  mock(200, { candidates: [{ finishReason: 'SAFETY', content: { parts: [] } }] });
  await assert.rejects(() => generateImage({ prompt: 'p', stylePrompt: 's', outputPath: join(tmp, 'c.png'), env: { GEMINI_API_KEY: 'k1' } }), /stopped: SAFETY.*rephrase/s);
});
await test('text-only response surfaces what the model said', async () => {
  mock(200, { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'I cannot draw that' }] } }] });
  await assert.rejects(() => generateImage({ prompt: 'p', stylePrompt: 's', outputPath: join(tmp, 'd.png'), env: { GEMINI_API_KEY: 'k1' } }), /No image in response.*I cannot draw that/s);
});
await test('api key is redacted from error text', async () => {
  mock(403, { error: { message: 'denied for key SECRETKEY123' } });
  await assert.rejects(
    () => generateImage({ prompt: 'p', stylePrompt: 's', outputPath: join(tmp, 'e.png'), env: { GEMINI_API_KEY: 'SECRETKEY123' } }),
    (e) => e.message.includes('[KEY]') && !e.message.includes('SECRETKEY123'),
  );
});
await test('unknown provider names the seam to implement', async () => {
  await assert.rejects(() => generateImage({ prompt: 'p', stylePrompt: 's', outputPath: join(tmp, 'f.png'), env: { MEDIA_IMAGE_PROVIDER: 'dalle' } }), /Unknown MEDIA_IMAGE_PROVIDER "dalle"/);
});

console.log('\ngenerateVoiceover');
const okAudio = { audioContent: Buffer.from('ID3').toString('base64') };
await test('posts the documented synthesize body', async () => {
  mock(200, okAudio);
  await generateVoiceover({ text: 'hello there', outputPath: join(tmp, 'v.mp3'), env: { GOOGLE_TTS_API_KEY: 'k2' } });
  assert.ok(seen.url.startsWith('https://texttospeech.googleapis.com/v1/text:synthesize'));
  assert.equal(seen.body.input.text, 'hello there');
  assert.equal(seen.body.audioConfig.audioEncoding, 'MP3');
  assert.equal(seen.body.voice.languageCode, 'en-GB');
});
await test('falls back to GEMINI_API_KEY when no TTS key is set', async () => {
  mock(200, okAudio);
  await generateVoiceover({ text: 't', outputPath: join(tmp, 'v2.mp3'), env: { GEMINI_API_KEY: 'shared' } });
  assert.ok(seen.url.includes('key=shared'));
});
await test('writes decoded audio', async () => {
  mock(200, okAudio);
  const out = join(tmp, 'v3.mp3');
  await generateVoiceover({ text: 't', outputPath: out, env: { GOOGLE_TTS_API_KEY: 'k' } });
  assert.equal(readFileSync(out).toString(), 'ID3');
});
await test('missing key mentions the licence question', async () => {
  await assert.rejects(() => generateVoiceover({ text: 't', outputPath: join(tmp, 'v4.mp3'), env: {} }), /monetized child-directed use/);
});
await test('empty audio response is an error, not a zero-byte file', async () => {
  mock(200, {});
  await assert.rejects(() => generateVoiceover({ text: 't', outputPath: join(tmp, 'v5.mp3'), env: { GOOGLE_TTS_API_KEY: 'k' } }), /returned no audio/);
});

const mockBin = (status, bytes, errBody) => {
  global.fetch = async (url, opts) => {
    seen = { url: String(url), body: JSON.parse(opts.body), headers: opts.headers };
    return {
      ok: status < 400, status,
      arrayBuffer: async () => bytes,
      text: async () => JSON.stringify(errBody ?? {}),
    };
  };
};
const MP3 = new Uint8Array([0x49, 0x44, 0x33]).buffer;

console.log('\nElevenLabs');
await test('posts to the voice-id endpoint with xi-api-key', async () => {
  mockBin(200, MP3);
  await generateVoiceover({ text: 'hi', outputPath: join(tmp, 'e1.mp3'),
    env: { MEDIA_TTS_PROVIDER: 'elevenlabs', ELEVENLABS_API_KEY: 'k', ELEVENLABS_VOICE_ID: 'v123' } });
  assert.equal(seen.url, 'https://api.elevenlabs.io/v1/text-to-speech/v123');
  assert.equal(seen.headers['xi-api-key'], 'k');
  assert.equal(seen.body.model_id, 'eleven_multilingual_v2');
  assert.equal(seen.body.text, 'hi');
});
await test('writes raw mp3 bytes, not base64', async () => {
  mockBin(200, MP3);
  const out = join(tmp, 'e2.mp3');
  await generateVoiceover({ text: 'hi', outputPath: out, env: { MEDIA_TTS_PROVIDER: 'elevenlabs', ELEVENLABS_API_KEY: 'k', ELEVENLABS_VOICE_ID: 'v' } });
  assert.equal(readFileSync(out).toString(), 'ID3');
});
await test('missing voice id explains it is an ID not a name', async () => {
  await assert.rejects(() => generateVoiceover({ text: 't', outputPath: join(tmp, 'e3.mp3'), env: { MEDIA_TTS_PROVIDER: 'elevenlabs', ELEVENLABS_API_KEY: 'k' } }),
    /ELEVENLABS_VOICE_ID.*not its display name/s);
});
await test('missing key mentions the monetization tier', async () => {
  await assert.rejects(() => generateVoiceover({ text: 't', outputPath: join(tmp, 'e4.mp3'), env: { MEDIA_TTS_PROVIDER: 'elevenlabs' } }), /monetized use/);
});
await test('redacts the key from an error body', async () => {
  mockBin(401, null, { detail: { message: 'bad key SEC123' } });
  await assert.rejects(
    () => generateVoiceover({ text: 't', outputPath: join(tmp, 'e5.mp3'), env: { MEDIA_TTS_PROVIDER: 'elevenlabs', ELEVENLABS_API_KEY: 'SEC123', ELEVENLABS_VOICE_ID: 'v' } }),
    (e) => e.message.includes('[KEY]') && !e.message.includes('SEC123'));
});

console.log('\nOpenAI');
await test('speech posts to /v1/audio/speech with bearer auth', async () => {
  mockBin(200, MP3);
  await generateVoiceover({ text: 'hi', outputPath: join(tmp, 'o1.mp3'),
    env: { MEDIA_TTS_PROVIDER: 'openai', OPENAI_API_KEY: 'sk-x', OPENAI_TTS_MODEL: 'some-tts' } });
  assert.equal(seen.url, 'https://api.openai.com/v1/audio/speech');
  assert.equal(seen.headers.authorization, 'Bearer sk-x');
  assert.equal(seen.body.response_format, 'mp3');
});
await test('refuses to guess a churning model name', async () => {
  await assert.rejects(() => generateVoiceover({ text: 't', outputPath: join(tmp, 'o2.mp3'), env: { MEDIA_TTS_PROVIDER: 'openai', OPENAI_API_KEY: 'k' } }),
    /Set OPENAI_TTS_MODEL.*not guessed for you/s);
});
await test('image posts to /v1/images/generations with the style block', async () => {
  mock(200, { data: [{ b64_json: PNG.toString('base64') }] });
  await generateImage({ prompt: 'a fox', stylePrompt: 'GOUACHE ONLY', outputPath: join(tmp, 'o3.png'),
    env: { MEDIA_IMAGE_PROVIDER: 'openai', OPENAI_API_KEY: 'sk-x', OPENAI_IMAGE_MODEL: 'some-image' } });
  assert.equal(seen.url, 'https://api.openai.com/v1/images/generations');
  assert.ok(seen.body.prompt.includes('GOUACHE ONLY'));
  assert.equal(readFileSync(join(tmp, 'o3.png')).toString('hex'), PNG.toString('hex'));
});
await test('a URL-only image response explains the fix', async () => {
  mock(200, { data: [{ url: 'https://example.com/x.png' }] });
  await assert.rejects(() => generateImage({ prompt: 'p', stylePrompt: 's', outputPath: join(tmp, 'o4.png'), env: { MEDIA_IMAGE_PROVIDER: 'openai', OPENAI_API_KEY: 'k', OPENAI_IMAGE_MODEL: 'm' } }),
    /set response_format to b64_json/);
});

console.log('\ndispatch');
await test('unknown tts provider lists the supported ones', async () => {
  await assert.rejects(() => generateVoiceover({ text: 't', outputPath: join(tmp, 'u.mp3'), env: { MEDIA_TTS_PROVIDER: 'nope' } }),
    /Supported: google, elevenlabs, openai/);
});
await test('unknown image provider lists the supported ones', async () => {
  await assert.rejects(() => generateImage({ prompt: 'p', stylePrompt: 's', outputPath: join(tmp, 'u.png'), env: { MEDIA_IMAGE_PROVIDER: 'nope' } }),
    /Supported: gemini, openai/);
});

global.fetch = realFetch;
console.log(`\n${passed} assertions passed${process.exitCode ? ' (with failures)' : ''}\n`);
