/**
 * YouTube upload. Zero dependencies — OAuth2 refresh flow + resumable upload over fetch.
 *
 * An API key cannot upload. Uploading writes to a user's channel, so it needs OAuth2
 * with the youtube.upload scope. The key in .env.local is read-only (search/stats);
 * publishing needs the three YOUTUBE_OAUTH_* values. See pipeline/auth.mjs.
 *
 * Quota note: since 1 June 2026 videos.insert bills to its own bucket — 1 unit, default
 * 100 calls/day — so uploads no longer compete with the 10,000-unit read budget. Older
 * guides still say 1,600 units; that is out of date.
 */

import { createReadStream, statSync } from 'node:fs';
import { Readable } from 'node:stream';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const UPLOAD_URL = 'https://www.googleapis.com/upload/youtube/v3/videos';
const API_URL = 'https://www.googleapis.com/youtube/v3';

export const UPLOAD_SCOPE = 'https://www.googleapis.com/auth/youtube.upload';

/** Exchange a long-lived refresh token for a short-lived access token. */
export async function getAccessToken({ clientId, clientSecret, refreshToken }) {
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Missing OAuth credentials. Run: node pipeline/auth.mjs');
  }
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    // invalid_grant is the common one and its default message is unhelpful.
    const hint = body.error === 'invalid_grant'
      ? ' — the refresh token was revoked or expired. Re-run: node pipeline/auth.mjs'
      : '';
    throw new Error(`Token refresh failed (${res.status}): ${body.error ?? 'unknown'}${hint}`);
  }
  return body.access_token;
}

/**
 * Build the videos.insert request body.
 *
 * selfDeclaredMadeForKids is not optional for this series. Under COPPA, child-directed
 * content must be declared; the FTC can fine ~$53k per violation for misdeclaring. It is
 * a required argument here rather than a default so it can never be forgotten silently.
 */
export function buildVideoResource({ title, description, tags, madeForKids, privacyStatus = 'private', categoryId = '1', publishAt }) {
  if (typeof madeForKids !== 'boolean') {
    throw new Error('madeForKids must be explicitly true or false — this is a legal declaration, not a default.');
  }
  if (publishAt && privacyStatus !== 'private') {
    throw new Error('Scheduled publishing requires privacyStatus "private" until publishAt.');
  }
  if (title && title.length > 100) throw new Error(`Title is ${title.length} chars; YouTube's limit is 100.`);
  if (description && description.length > 5000) throw new Error(`Description is ${description.length} chars; limit is 5000.`);

  return {
    snippet: { title, description, tags: tags ?? [], categoryId },
    status: {
      privacyStatus,
      selfDeclaredMadeForKids: madeForKids,
      ...(publishAt ? { publishAt } : {}),
    },
  };
}

/**
 * Resumable upload. Two steps: POST the metadata to get a session URL, then PUT the bytes.
 * Resumable is the right default — a non-resumable upload that dies at 90% is a total loss.
 */
export async function uploadVideo({ accessToken, videoPath, resource, onProgress }) {
  const size = statSync(videoPath).size;

  const init = await fetch(`${UPLOAD_URL}?uploadType=resumable&part=snippet,status`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
      'x-upload-content-length': String(size),
      'x-upload-content-type': 'video/*',
    },
    body: JSON.stringify(resource),
  });

  if (!init.ok) {
    const text = await init.text();
    throw new Error(`Upload init failed (${init.status}): ${text.slice(0, 500)}`);
  }
  const sessionUrl = init.headers.get('location');
  if (!sessionUrl) throw new Error('Upload init returned no session URL.');

  onProgress?.({ phase: 'uploading', bytes: size });

  const put = await fetch(sessionUrl, {
    method: 'PUT',
    headers: { 'content-length': String(size), 'content-type': 'video/*' },
    body: Readable.toWeb(createReadStream(videoPath)),
    duplex: 'half', // required by undici when streaming a request body
  });

  const body = await put.json().catch(() => ({}));
  if (!put.ok) {
    throw new Error(`Upload failed (${put.status}): ${JSON.stringify(body).slice(0, 500)}`);
  }
  onProgress?.({ phase: 'done', id: body.id });
  return body;
}

/** Thumbnails are a separate call; Shorts mostly ignore them, but set one anyway. */
export async function setThumbnail({ accessToken, videoId, imagePath }) {
  const size = statSync(imagePath).size;
  const res = await fetch(`https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${videoId}`, {
    method: 'PUT',
    headers: { authorization: `Bearer ${accessToken}`, 'content-length': String(size), 'content-type': 'image/png' },
    body: Readable.toWeb(createReadStream(imagePath)),
    duplex: 'half',
  });
  if (!res.ok) throw new Error(`Thumbnail set failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

/** Confirm the upload landed and report how YouTube actually classified it. */
export async function getVideoStatus({ accessToken, videoId }) {
  const res = await fetch(`${API_URL}/videos?part=status,processingDetails&id=${videoId}`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Status check failed (${res.status})`);
  const body = await res.json();
  return body.items?.[0] ?? null;
}
