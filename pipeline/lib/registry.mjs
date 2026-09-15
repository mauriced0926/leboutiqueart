/**
 * Episode registry and the novelty gate.
 *
 * Every episode ever generated is recorded here — including rejected ones, so the
 * generator cannot rediscover a premise we already threw away. The gate enforces the
 * dedupe_axes from series-bible.json.
 */

import { existsSync, mkdirSync, readFileSync, appendFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { closestMatch, normalize } from './similarity.mjs';

export function loadRegistry(path) {
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter((l) => l.trim())
    .map((l, i) => {
      try { return JSON.parse(l); }
      catch { throw new Error(`Registry line ${i + 1} is not valid JSON — refusing to run with a corrupt registry.`); }
    });
}

export function appendRegistry(path, entry) {
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, `${JSON.stringify(entry)}\n`);
}

export function rewriteRegistry(path, entries) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, entries.map((e) => `${JSON.stringify(e)}\n`).join(''));
}

/**
 * Check a candidate episode against history.
 *
 * Returns { ok, reasons[] }. Every reason is specific enough to feed back into the
 * generator as a constraint, which is what makes regeneration converge instead of
 * bouncing between two near-identical ideas.
 *
 * `history` is oldest-first. Recency windows count backwards from the newest entry.
 */
export function checkNovelty(candidate, history, bible) {
  const reasons = [];
  const axes = bible.dedupe_axes.axes;
  const threshold = bible.dedupe_axes.similarity_threshold;

  // Per-axis recency. Reusing an axis value is fine eventually — a series that never
  // revisits an object type would run out of ideas — but not within its window.
  for (const [axis, cfg] of Object.entries(axes)) {
    const window = history.slice(-cfg.recency_window);
    const value = normalize(candidate[axis]);
    if (!value) {
      reasons.push(`missing required axis "${axis}"`);
      continue;
    }
    const clash = window.find((h) => normalize(h[axis]) === value);
    if (clash) {
      reasons.push(
        `${axis} "${candidate[axis]}" was used in episode ${clash.episode ?? '?'}, ` +
        `inside its ${cfg.recency_window}-episode window`
      );
    }
  }

  // Free-text premise similarity against all history, not just the window — a premise
  // repeated from 200 episodes ago is still a near-duplicate to a viewer and to a
  // classifier.
  if (history.length) {
    const match = closestMatch(candidate.premise, history, (h) => h.premise ?? '');
    if (match && match.score >= threshold) {
      reasons.push(
        `premise is ${(match.score * 100).toFixed(0)}% similar to episode ` +
        `${match.item.episode ?? '?'} ("${match.item.premise}") — threshold is ${(threshold * 100).toFixed(0)}%`
      );
    }
  }

  return { ok: reasons.length === 0, reasons };
}

/** Next episode number. Derived from history so it survives a crash mid-run. */
export function nextEpisodeNumber(history) {
  return history.reduce((max, h) => Math.max(max, Number(h.episode) || 0), 0) + 1;
}
