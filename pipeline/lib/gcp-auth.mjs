/**
 * Service-account auth for Vertex AI. Zero dependencies.
 *
 * Vertex uses Google Cloud IAM rather than an API key, which is the whole point of moving:
 * the Gemini Developer API's Veo quota is a fixed tier (10 requests/day, unmodifiable),
 * while Vertex quotas are per-project and can be raised through Quota Management.
 *
 * Service accounts work here, unlike the YouTube Data API which refuses them — so the Veo
 * half of the pipeline needs no human consent and has no 7-day token expiry.
 */

import { createSign } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/cloud-platform';

const base64url = (buf) => Buffer.from(buf).toString('base64')
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export function loadServiceAccount(env = process.env) {
  // Either an inline JSON blob (convenient as a CI secret) or a path to the key file.
  const inline = env.GCP_SERVICE_ACCOUNT_JSON;
  const path = env.GOOGLE_APPLICATION_CREDENTIALS;
  let raw;
  if (inline && inline.trim().startsWith('{')) raw = inline;
  else if (path && existsSync(path)) raw = readFileSync(path, 'utf8');
  else {
    throw new Error(
      'No Google Cloud service account configured.\n' +
      '  Console → IAM & Admin → Service Accounts → create one, grant it "Vertex AI User",\n' +
      '  then add a JSON key and point at it:\n' +
      '    GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json\n' +
      '  or paste the whole JSON into GCP_SERVICE_ACCOUNT_JSON.'
    );
  }
  const sa = JSON.parse(raw);
  for (const field of ['client_email', 'private_key', 'project_id']) {
    if (!sa[field]) throw new Error(`Service account JSON is missing "${field}".`);
  }
  return sa;
}

/**
 * Exchange a signed JWT for an access token (the two-legged OAuth flow service accounts use).
 * Tokens last an hour; we cache until shortly before expiry so a long render does not
 * re-authenticate on every clip.
 */
let cached = null;
export async function getAccessToken(env = process.env) {
  if (cached && cached.expires > Date.now() + 60_000) return cached.token;

  const sa = loadServiceAccount(env);
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(JSON.stringify({
    iss: sa.client_email, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600,
  }));
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${claims}`);
  const assertion = `${header}.${claims}.${base64url(signer.sign(sa.private_key))}`;

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const hint = body.error === 'invalid_grant'
      ? ' — check the service account key is current and its clock-sensitive JWT is not being rejected'
      : '';
    throw new Error(`Service account token exchange failed (${res.status}): ${body.error ?? 'unknown'}${hint}`);
  }
  cached = { token: body.access_token, expires: Date.now() + (body.expires_in ?? 3600) * 1000 };
  return cached.token;
}

export function projectId(env = process.env) {
  return env.GCP_PROJECT_ID ?? loadServiceAccount(env).project_id;
}
