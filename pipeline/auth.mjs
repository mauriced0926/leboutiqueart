#!/usr/bin/env node
/**
 * One-time OAuth setup. Produces the refresh token that pipeline/publish.mjs needs.
 *
 * Uploading writes to your channel, so an API key is not enough — this is the consent
 * step that proves you authorised it. Run once; the refresh token is long-lived.
 */
import { createInterface } from 'node:readline/promises';
import { loadEnv, require_ } from './lib/config.mjs';
import { UPLOAD_SCOPE } from './lib/youtube.mjs';

const REDIRECT = 'urn:ietf:wg:oauth:2.0:oob';
const env = loadEnv();

console.log(`
YouTube upload authorisation
────────────────────────────
If you have not already:
  1. console.cloud.google.com → same project as your API key
  2. APIs & Services → OAuth consent screen → External → add yourself as a test user
  3. Credentials → Create credentials → OAuth client ID → Desktop app
  4. Put the client ID and secret in .env.local as:
       YOUTUBE_OAUTH_CLIENT_ID=...
       YOUTUBE_OAUTH_CLIENT_SECRET=...
`);

const clientId = require_(env, 'YOUTUBE_OAUTH_CLIENT_ID', 'Create a Desktop-app OAuth client in Google Cloud console.');
const clientSecret = require_(env, 'YOUTUBE_OAUTH_CLIENT_SECRET', 'Same place as the client ID.');

const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
url.searchParams.set('client_id', clientId);
url.searchParams.set('redirect_uri', REDIRECT);
url.searchParams.set('response_type', 'code');
url.searchParams.set('scope', UPLOAD_SCOPE);
url.searchParams.set('access_type', 'offline');
// Without this, a second run returns no refresh_token and the failure is silent.
url.searchParams.set('prompt', 'consent');

console.log('Open this URL, approve, and paste the code back here:\n');
console.log(url.toString(), '\n');

const rl = createInterface({ input: process.stdin, output: process.stdout });
const code = (await rl.question('Authorisation code: ')).trim();
rl.close();

const res = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: REDIRECT, grant_type: 'authorization_code' }),
});
const body = await res.json();
if (!res.ok) { console.error(`\nExchange failed (${res.status}):`, body); process.exit(1); }
if (!body.refresh_token) {
  console.error('\nNo refresh_token returned. Revoke the app at myaccount.google.com/permissions and re-run.');
  process.exit(1);
}
console.log(`\n✓ Add this line to .env.local:\n\nYOUTUBE_OAUTH_REFRESH_TOKEN=${body.refresh_token}\n`);
