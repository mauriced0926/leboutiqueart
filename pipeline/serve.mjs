#!/usr/bin/env node
/**
 * Phone-friendly review server.
 *
 * The pipeline runs on a machine that stays awake; this is the surface you actually touch
 * each day. Open it in Safari, watch the episode, tap Approve or Reject. Zero dependencies.
 *
 *   REVIEW_TOKEN=somethinglong node pipeline/serve.mjs --port 8080
 *
 * Bind it to localhost and reach it over Tailscale/SSH, or put it behind a reverse proxy
 * with TLS. REVIEW_TOKEN is a thin guard, not a substitute for not exposing this publicly.
 */
import { createServer } from 'node:http';
import { createReadStream, existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { timingSafeEqual } from 'node:crypto';
import { loadEnv, paths } from './lib/config.mjs';

const env = loadEnv();
const args = process.argv.slice(2);
const PORT = Number(args[args.indexOf('--port') + 1]) || Number(env.REVIEW_PORT) || 8080;
const HOST = args.includes('--public') ? '0.0.0.0' : '127.0.0.1';
const TOKEN = env.REVIEW_TOKEN ?? '';

if (!TOKEN) {
  console.error('\nSet REVIEW_TOKEN in .env.local — refusing to serve the queue unauthenticated.\n');
  process.exit(1);
}

/** Constant-time compare so the token cannot be guessed a character at a time. */
function tokenOk(given) {
  const a = Buffer.from(String(given ?? ''));
  const b = Buffer.from(TOKEN);
  return a.length === b.length && timingSafeEqual(a, b);
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function queue() {
  if (!existsSync(paths.queue)) return [];
  return readdirSync(paths.queue)
    .map((d) => join(paths.queue, d))
    .filter((d) => existsSync(join(d, 'episode.json')))
    .map((d) => ({
      dir: d,
      episode: JSON.parse(readFileSync(join(d, 'episode.json'), 'utf8')),
      status: JSON.parse(readFileSync(join(d, 'status.json'), 'utf8')),
      hasVideo: existsSync(join(d, 'video.mp4')),
    }))
    .sort((a, b) => a.episode.episode - b.episode.episode);
}

function page(items, token) {
  const rows = items.map((it) => {
    const e = it.episode, s = it.status;
    const beats = e.beats.map((b) => `<details><summary>${b.n}. ${esc(b.name)} <span class="s">${b.seconds}s</span></summary>
      <p class="v">${esc(b.visual)}</p>
      ${b.lines.map((l) => `<p class="l"><b>${esc(l.speaker)}</b> ${esc(l.text)}</p>`).join('')}</details>`).join('');
    return `<article>
      <h2>${esc(e.title)}</h2>
      <p class="meta">ep ${e.episode} · ${esc(s.state)} · ${e.beats.reduce((t, b) => t + b.seconds, 0)}s</p>
      ${it.hasVideo ? `<video controls playsinline preload="metadata" src="/video/${e.episode}?t=${encodeURIComponent(token)}"></video>`
        : '<p class="warn">No video yet — still rendering.</p>'}
      <p class="premise">${esc(e.premise)}</p>
      ${beats}
      <form method="POST" action="/decide?t=${encodeURIComponent(token)}">
        <input type="hidden" name="episode" value="${e.episode}">
        <button name="decision" value="approved" class="ok">Approve</button>
        <button name="decision" value="rejected" class="no">Reject</button>
      </form>
    </article>`;
  }).join('');

  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Fix-It Forest — review</title><style>
:root{--bg:#faf7f0;--fg:#2f2a26;--mut:#7a7068;--line:#e6ded0;--ok:#2f5d50;--no:#a5462f}
@media(prefers-color-scheme:dark){:root{--bg:#1a1714;--fg:#ece5da;--mut:#9b9086;--line:#332d27}}
*{box-sizing:border-box}
body{margin:0;padding:16px;padding-bottom:env(safe-area-inset-bottom);background:var(--bg);color:var(--fg);
font:16px/1.5 -apple-system,system-ui,sans-serif;max-width:640px;margin-inline:auto}
h1{font-size:1.1rem;letter-spacing:.04em;text-transform:uppercase;color:var(--mut)}
article{border:1px solid var(--line);border-radius:14px;padding:16px;margin-bottom:24px}
h2{font-size:1.25rem;margin:0 0 4px}
.meta{color:var(--mut);font-size:.85rem;margin:0 0 12px}
video{width:100%;border-radius:10px;background:#000;display:block;margin-bottom:12px}
.premise{font-style:italic;color:var(--mut)}
details{border-top:1px solid var(--line);padding:8px 0}
summary{cursor:pointer;font-weight:600}
.s{color:var(--mut);font-weight:400}
.v{color:var(--mut);font-size:.9rem;margin:6px 0}
.l{margin:3px 0}
.warn{color:var(--no)}
form{display:flex;gap:10px;margin-top:16px}
button{flex:1;padding:16px;font-size:1rem;font-weight:600;border:0;border-radius:10px;color:#fff;
-webkit-appearance:none;touch-action:manipulation}
.ok{background:var(--ok)}.no{background:var(--no)}
</style></head><body>
<h1>Fix-It Forest — review queue</h1>
${rows || '<p>Queue is empty.</p>'}
</body></html>`;
}

createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const token = url.searchParams.get('t') ?? (req.headers.authorization ?? '').replace(/^Bearer /, '');
  if (!tokenOk(token)) { res.writeHead(401, { 'content-type': 'text/plain' }).end('Unauthorized'); return; }

  if (req.method === 'GET' && url.pathname === '/') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(page(queue(), token));
    return;
  }

  // Range requests matter: without them iOS Safari will not scrub or even reliably start
  // playback of a video element.
  const vid = /^\/video\/(\d+)$/.exec(url.pathname);
  if (req.method === 'GET' && vid) {
    const item = queue().find((q) => String(q.episode.episode) === vid[1]);
    const file = item && join(item.dir, 'video.mp4');
    if (!file || !existsSync(file)) { res.writeHead(404).end('no video'); return; }
    const size = statSync(file).size;
    const range = req.headers.range;
    if (range) {
      const [s, e] = range.replace(/bytes=/, '').split('-');
      const start = Number(s), end = e ? Number(e) : size - 1;
      res.writeHead(206, { 'content-type': 'video/mp4', 'accept-ranges': 'bytes',
        'content-range': `bytes ${start}-${end}/${size}`, 'content-length': end - start + 1 });
      createReadStream(file, { start, end }).pipe(res);
    } else {
      res.writeHead(200, { 'content-type': 'video/mp4', 'accept-ranges': 'bytes', 'content-length': size });
      createReadStream(file).pipe(res);
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/decide') {
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 10_000) req.destroy(); });
    req.on('end', () => {
      const form = new URLSearchParams(body);
      const n = form.get('episode');
      const decision = form.get('decision');
      if (!['approved', 'rejected'].includes(decision)) { res.writeHead(400).end('bad decision'); return; }
      const item = queue().find((q) => String(q.episode.episode) === n);
      if (!item) { res.writeHead(404).end('no episode'); return; }
      writeFileSync(join(item.dir, 'status.json'),
        JSON.stringify({ ...item.status, state: decision, reviewed_at: new Date().toISOString(), reviewed_via: 'web' }, null, 2));
      res.writeHead(303, { location: `/?t=${encodeURIComponent(token)}` }).end();
    });
    return;
  }

  res.writeHead(404).end('not found');
}).listen(PORT, HOST, () => {
  console.log(`\nReview queue on http://${HOST}:${PORT}/?t=${TOKEN}`);
  if (HOST === '127.0.0.1') console.log('Bound to localhost. Use --public only behind a proxy or private network.\n');
});
