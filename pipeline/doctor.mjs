#!/usr/bin/env node
/**
 * Preflight. Checks every dependency the pipeline needs and says exactly what is missing.
 * There are enough moving parts here that "it didn't work" is not a useful error.
 *
 *   node pipeline/doctor.mjs        check
 *   node pipeline/doctor.mjs --live spend a few cents proving the media APIs actually work
 */
import { existsSync, mkdtempSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadEnv, paths } from './lib/config.mjs';
import { ffmpegAvailable, generateImage, generateVoiceover } from './lib/media.mjs';
import { getAccessToken } from './lib/youtube.mjs';

const env = loadEnv();
const live = process.argv.includes('--live');
const rows = [];
const check = (name, ok, detail) => { rows.push({ name, ok, detail }); };

const set = (k) => Boolean(env[k]) && !/^your_|^run_pipeline/.test(env[k]);

check('ANTHROPIC_API_KEY', set('ANTHROPIC_API_KEY'), 'script generation — console.anthropic.com');
check('GEMINI_API_KEY', set('GEMINI_API_KEY'), 'image generation — aistudio.google.com/apikey');
check('GOOGLE_TTS_API_KEY', set('GOOGLE_TTS_API_KEY') || set('GEMINI_API_KEY'), 'narration — enable Cloud Text-to-Speech, or reuse GEMINI_API_KEY');
check('YOUTUBE_API_KEY', set('YOUTUBE_API_KEY'), 'read-only stats and niche scanning');
check('YOUTUBE_OAUTH_CLIENT_ID', set('YOUTUBE_OAUTH_CLIENT_ID'), 'uploads');
check('YOUTUBE_OAUTH_CLIENT_SECRET', set('YOUTUBE_OAUTH_CLIENT_SECRET'), 'uploads');
check('YOUTUBE_OAUTH_REFRESH_TOKEN', set('YOUTUBE_OAUTH_REFRESH_TOKEN'), 'uploads — run: node pipeline/auth.mjs');
check('ffmpeg', await ffmpegAvailable(), 'video assembly — brew/apt install ffmpeg');
check('series bible', existsSync(paths.bible), paths.bible);

if (set('YOUTUBE_OAUTH_REFRESH_TOKEN')) {
  try {
    await getAccessToken({ clientId: env.YOUTUBE_OAUTH_CLIENT_ID, clientSecret: env.YOUTUBE_OAUTH_CLIENT_SECRET, refreshToken: env.YOUTUBE_OAUTH_REFRESH_TOKEN });
    check('youtube token refresh', true, 'exchanged successfully');
  } catch (e) {
    check('youtube token refresh', false, e.message.split('\n')[0]);
  }
}

if (live) {
  const tmp = mkdtempSync(join(tmpdir(), 'doctor-'));
  try {
    await generateImage({ prompt: 'A single small red apple on a plain background.', stylePrompt: 'Flat gouache illustration.', outputPath: join(tmp, 'a.png'), env });
    check('image generation (live)', true, `${statSync(join(tmp, 'a.png')).size} bytes returned`);
  } catch (e) { check('image generation (live)', false, e.message.split('\n')[0]); }
  try {
    await generateVoiceover({ text: 'Testing one two three.', outputPath: join(tmp, 'a.mp3'), env });
    check('speech synthesis (live)', true, `${statSync(join(tmp, 'a.mp3')).size} bytes returned`);
  } catch (e) { check('speech synthesis (live)', false, e.message.split('\n')[0]); }
}

const width = Math.max(...rows.map((r) => r.name.length));
console.log('');
for (const r of rows) console.log(`  ${r.ok ? '✓' : '✗'} ${r.name.padEnd(width)}  ${r.ok ? '' : '← '}${r.detail}`);
const missing = rows.filter((r) => !r.ok);
console.log(`\n${rows.length - missing.length}/${rows.length} ready${missing.length ? ` · ${missing.length} to fix` : ' — pipeline is fully configured'}\n`);
if (!live) console.log('Add --live to actually call the image and speech APIs (costs a few cents).\n');
process.exit(missing.length ? 1 : 0);
