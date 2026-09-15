#!/usr/bin/env node
/**
 * One-time OAuth setup — produces the refresh token publish.mjs needs.
 *
 * Uses the loopback flow: a throwaway local HTTP server catches Google's redirect.
 * The older out-of-band flow (redirect_uri=urn:ietf:wg:oauth:2.0:oob, paste-the-code)
 * was blocked for every client type in January 2023 and now fails with invalid_request —
 * loopback is the supported replacement for anything without a public HTTPS callback.
 *
 *   node pipeline/auth.mjs
 *   node pipeline/auth.mjs --port 9000
 *   node pipeline/auth.mjs --client-secrets ~/Downloads/client_secret_....json
 */
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnv, ROOT } from './lib/config.mjs';
import { UPLOAD_SCOPE } from './lib/youtube.mjs';

// Every failure here is a setup problem with a known fix; a stack trace buries it.
process.on('uncaughtException', (e) => { console.error(`\n✗ ${e.message}\n`); process.exit(1); });
process.on('unhandledRejection', (e) => { console.error(`\n✗ ${e instanceof Error ? e.message : e}\n`); process.exit(1); });

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback;
};

const PORT = Number(flag('port', 8765));
const CALLBACK_PATH = '/oauth2callback';
const REDIRECT_URI = `http://localhost:${PORT}${CALLBACK_PATH}`;

// Credentials: either the JSON Google hands you, or the two env vars.
let clientId, clientSecret, clientKind = 'unknown';
const secretsPath = flag('client-secrets');
if (secretsPath) {
  const file = JSON.parse(readFileSync(resolve(secretsPath), 'utf8'));
  clientKind = file.web ? 'web' : file.installed ? 'installed (desktop)' : 'unknown';
  const c = file.web ?? file.installed;
  if (!c) throw new Error('That JSON has neither a "web" nor an "installed" section.');
  ({ client_id: clientId, client_secret: clientSecret } = c);
} else {
  const env = loadEnv();
  clientId = env.YOUTUBE_OAUTH_CLIENT_ID;
  clientSecret = env.YOUTUBE_OAUTH_CLIENT_SECRET;
}

if (!clientId || !clientSecret || /^your_/.test(clientId)) {
  console.error(`
No OAuth client configured.

  Either add to .env.local:
      YOUTUBE_OAUTH_CLIENT_ID=...
      YOUTUBE_OAUTH_CLIENT_SECRET=...
  Or pass the JSON Google gave you:
      node pipeline/auth.mjs --client-secrets ~/Downloads/client_secret_....json
`);
  process.exit(1);
}

console.log(`
YouTube upload authorisation
────────────────────────────
client type : ${clientKind}
redirect    : ${REDIRECT_URI}

This exact redirect URI must be registered on the OAuth client:
  console.cloud.google.com → APIs & Services → Credentials → (your client)
  → Authorized redirect URIs → Add → ${REDIRECT_URI} → Save

  A "Desktop app" client accepts any loopback port without registering it.
  A "Web application" client does not — the URI above must be added exactly.
  (Localhost URIs are exempt from Google's HTTPS-only rule, so plain http is fine.)

Also make sure your Google account is a Test user under
  APIs & Services → OAuth consent screen, unless the app is published.
`);

// CSRF guard: Google echoes `state` back, and we refuse anything that doesn't match.
const state = randomBytes(16).toString('hex');

const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
authUrl.searchParams.set('client_id', clientId);
authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
authUrl.searchParams.set('response_type', 'code');
authUrl.searchParams.set('scope', UPLOAD_SCOPE);
authUrl.searchParams.set('access_type', 'offline');
// Without prompt=consent a repeat authorisation returns no refresh_token, silently.
authUrl.searchParams.set('prompt', 'consent');
authUrl.searchParams.set('state', state);

/** Serve the callback once, then resolve with the code. */
function waitForCode({ timeoutMs = 5 * 60_000 } = {}) {
  return new Promise((resolvePromise, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url, `http://localhost:${PORT}`);
      if (url.pathname !== CALLBACK_PATH) { res.writeHead(404).end('Not found'); return; }

      const reply = (status, title, detail) => {
        res.writeHead(status, { 'content-type': 'text/html; charset=utf-8' });
        res.end(`<!doctype html><meta charset="utf-8"><title>${title}</title>`
          + `<body style="font-family:system-ui;padding:3rem;max-width:34rem;margin:auto">`
          + `<h1 style="font-size:1.25rem">${title}</h1><p>${detail}</p></body>`);
      };

      const err = url.searchParams.get('error');
      if (err) {
        reply(400, 'Authorisation failed', `Google returned <code>${err}</code>. You can close this tab.`);
        server.close(); clearTimeout(timer);
        reject(new Error(`Google returned "${err}"${err === 'access_denied' ? ' — consent was declined, or your account is not a Test user on the consent screen.' : ''}`));
        return;
      }
      if (url.searchParams.get('state') !== state) {
        reply(400, 'State mismatch', 'The response did not match this request. Nothing was saved.');
        server.close(); clearTimeout(timer);
        reject(new Error('State mismatch — possible CSRF. Re-run and use only the URL this command printed.'));
        return;
      }
      const code = url.searchParams.get('code');
      if (!code) {
        reply(400, 'No code returned', 'Google redirected without an authorisation code.');
        server.close(); clearTimeout(timer);
        reject(new Error('No authorisation code in the callback.'));
        return;
      }
      reply(200, 'Authorised ✓', 'You can close this tab and return to the terminal.');
      server.close(); clearTimeout(timer);
      resolvePromise(code);
    });

    const timer = setTimeout(() => {
      server.close();
      reject(new Error('Timed out after 5 minutes waiting for the callback.'));
    }, timeoutMs);

    server.on('error', (e) => {
      clearTimeout(timer);
      reject(e.code === 'EADDRINUSE'
        ? new Error(`Port ${PORT} is already in use. Re-run with --port 9000 (and register that URI too).`)
        : e);
    });
    server.listen(PORT, () => {
      console.log('Open this URL, approve, and come back:\n');
      console.log(`  ${authUrl}\n`);
      console.log(`Listening on ${REDIRECT_URI} …`);
    });
  });
}

const code = await waitForCode();
console.log('✓ Code received, exchanging for tokens…');

const res = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    code, client_id: clientId, client_secret: clientSecret,
    redirect_uri: REDIRECT_URI, grant_type: 'authorization_code',
  }),
});
const body = await res.json().catch(() => ({}));

if (!res.ok) {
  const hints = {
    redirect_uri_mismatch: `The redirect URI is not registered on this client. Add exactly: ${REDIRECT_URI}`,
    invalid_client: 'Client ID or secret is wrong — check .env.local against the JSON from the console.',
    invalid_grant: 'The code expired or was already used. Re-run to get a fresh one.',
  };
  console.error(`\nToken exchange failed (${res.status}): ${body.error ?? 'unknown'}`);
  if (hints[body.error]) console.error(`  ${hints[body.error]}`);
  if (body.error_description) console.error(`  ${body.error_description}`);
  process.exit(1);
}

if (!body.refresh_token) {
  console.error(`
No refresh_token returned — this happens when the app was already authorised.
Revoke it at myaccount.google.com/permissions, then re-run.
`);
  process.exit(1);
}

const envPath = resolve(ROOT, '.env.local');
const already = existsSync(envPath) && /^YOUTUBE_OAUTH_REFRESH_TOKEN=/m.test(readFileSync(envPath, 'utf8'));
if (already) {
  console.log(`\n✓ Got a refresh token. .env.local already has one — replace that line with:\n`);
  console.log(`YOUTUBE_OAUTH_REFRESH_TOKEN=${body.refresh_token}\n`);
} else {
  appendFileSync(envPath, `YOUTUBE_OAUTH_REFRESH_TOKEN=${body.refresh_token}\n`);
  console.log(`\n✓ Refresh token written to .env.local (gitignored).`);
  console.log(`  Scope: ${body.scope}`);
  console.log(`\nNext: node pipeline/publish.mjs --dry-run\n`);
}
