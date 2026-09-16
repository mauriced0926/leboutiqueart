#!/usr/bin/env node
/**
 * Upload approved episodes.
 *
 * Only touches episodes a human marked `approved`. Defaults to uploading as PRIVATE —
 * flip to public deliberately with --public once you have watched the first few land.
 */
import { existsSync, readFileSync, writeFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { dirname } from 'node:path';
import { loadEnv, require_, paths } from './lib/config.mjs';
import { getAccessToken, buildVideoResource, uploadVideo, getVideoStatus } from './lib/youtube.mjs';

// Setup problems are the common failure here and a stack trace buries the fix.
process.on('uncaughtException', (e) => { console.error(`\n${e.message}\n`); process.exit(1); });
process.on('unhandledRejection', (e) => { console.error(`\n${e instanceof Error ? e.message : e}\n`); process.exit(1); });

const env = loadEnv();
const args = process.argv.slice(2);
const isPublic = args.includes('--public');
const dry = args.includes('--dry-run');
const only = args.find((a) => /^\d+$/.test(a));

const bible = JSON.parse(readFileSync(paths.bible, 'utf8'));
const madeForKids = bible.series.made_for_kids;

const { readdirSync } = await import('node:fs');
if (!existsSync(paths.queue)) { console.log('Nothing queued.'); process.exit(0); }

const approved = readdirSync(paths.queue)
  .map((d) => join(paths.queue, d))
  .filter((d) => existsSync(join(d, 'status.json')))
  .map((d) => ({ dir: d, status: JSON.parse(readFileSync(join(d, 'status.json'), 'utf8')), episode: JSON.parse(readFileSync(join(d, 'episode.json'), 'utf8')) }))
  .filter((x) => x.status.state === 'approved')
  .filter((x) => !only || String(x.episode.episode) === only)
  .sort((a, b) => a.episode.episode - b.episode.episode);

if (!approved.length) { console.log('\nNo approved episodes. Run: node pipeline/review.mjs\n'); process.exit(0); }

console.log(`\n${approved.length} approved · privacy: ${isPublic ? 'PUBLIC' : 'private'} · madeForKids: ${madeForKids}`);
if (madeForKids) console.log('Made for Kids is declared per series-bible.json — comments and personalised ads will be off.');

if (dry) {
  for (const a of approved) {
    const r = buildVideoResource({ title: a.episode.title, description: a.episode.description, tags: a.episode.tags, madeForKids, privacyStatus: isPublic ? 'public' : 'private' });
    console.log(`\n  ep${a.episode.episode}: ${r.snippet.title}`);
    console.log(`    status: ${JSON.stringify(r.status)}`);
  }
  console.log('\nDry run — nothing uploaded.\n');
  process.exit(0);
}

const accessToken = await getAccessToken({
  clientId: require_(env, 'YOUTUBE_OAUTH_CLIENT_ID', 'Run: node pipeline/auth.mjs'),
  clientSecret: require_(env, 'YOUTUBE_OAUTH_CLIENT_SECRET', 'Run: node pipeline/auth.mjs'),
  refreshToken: require_(env, 'YOUTUBE_OAUTH_REFRESH_TOKEN', 'Run: node pipeline/auth.mjs'),
});

for (const a of approved) {
  const videoPath = join(a.dir, 'video.mp4');
  if (!existsSync(videoPath)) {
    console.error(`  ✗ ep${a.episode.episode}: no video.mp4 — assembly has not run for this episode.`);
    continue;
  }
  const resource = buildVideoResource({
    title: a.episode.title, description: a.episode.description, tags: a.episode.tags,
    madeForKids, privacyStatus: isPublic ? 'public' : 'private',
  });
  process.stdout.write(`  ep${a.episode.episode} uploading… `);
  try {
    const result = await uploadVideo({ accessToken, videoPath, resource });
    const status = await getVideoStatus({ accessToken, videoId: result.id });
    console.log(`✓ https://youtube.com/watch?v=${result.id}`);
    // Report what YouTube actually recorded, not what we asked for — they can differ.
    if (status) console.log(`     youtube says: privacy=${status.status?.privacyStatus} madeForKids=${status.status?.madeForKids}`);
    writeFileSync(join(a.dir, 'status.json'), JSON.stringify({ ...a.status, state: 'published', video_id: result.id, published_at: new Date().toISOString() }, null, 2));
    mkdirSync(dirname(paths.published), { recursive: true });
    appendFileSync(paths.published, `${JSON.stringify({ episode: a.episode.episode, video_id: result.id, title: a.episode.title, published_at: new Date().toISOString() })}\n`);
  } catch (e) {
    console.log(`✗\n     ${e.message}`);
  }
}
console.log('');
