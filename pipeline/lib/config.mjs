/** Env loading. Reads .env.local so keys never live in the repo. */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const PIPELINE = resolve(ROOT, 'pipeline');

export function loadEnv() {
  const env = { ...process.env };
  const path = resolve(ROOT, '.env.local');
  if (existsSync(path)) {
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const m = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
    }
  }
  return env;
}

/** Throw a setup-shaped error rather than a cryptic undefined later. */
export function require_(env, key, how) {
  const v = env[key];
  if (!v || /^your_/.test(v)) throw new Error(`${key} is not set in .env.local.\n  ${how}`);
  return v;
}

export const paths = {
  bible: resolve(PIPELINE, 'series-bible.json'),
  registry: resolve(PIPELINE, 'state/episodes.jsonl'),
  queue: resolve(PIPELINE, 'state/queue'),
  published: resolve(PIPELINE, 'state/published.jsonl'),
};
