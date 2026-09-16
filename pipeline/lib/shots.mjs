/**
 * Shot planner: beats → shots of at most 8 seconds.
 *
 * Veo generates a maximum of 8 seconds per call, while the series formula thinks in beats
 * of 15–60s. Something has to decide where the cuts land and which dialogue belongs to
 * which shot, and it should be deterministic rather than left to a model — cut points that
 * move between runs make a re-render of one shot impossible.
 */

export const MAX_SHOT_SECONDS = 8;
// Veo's hard floor: durationSeconds must be between 4 and 8 inclusive (verified against
// the live API). A shorter shot is rejected outright, which mid-render means paying for
// every clip generated before the failure. Shots below this borrow from the longest shot.
export const MIN_SHOT_SECONDS = 6;

/** Rough speaking time. 2.5 words/sec is the rate the script prompt writes to. */
export function speakSeconds(text) {
  const words = String(text ?? '').trim().split(/\s+/).filter(Boolean).length;
  return words / 2.5;
}

/**
 * Split one beat into shots.
 *
 * Dialogue drives the cuts: a line is never split across a shot boundary, because half a
 * sentence with a cut in the middle reads as a mistake. Lines are packed into shots until
 * adding the next one would exceed the limit. A wordless beat is split evenly instead.
 */
/**
 * Veo accepts only these clip lengths. The API error says "between 4 and 8, inclusive",
 * which is wrong in a costly way: 5 and 7 are rejected, as is any fractional value.
 * Verified by probing each value against the live endpoint.
 */
// Veo accepts 4, 6 and 8 second clips, but rejects 1080p at 4 seconds ("1080p is not
// supported for a duration of 4 seconds"). Rather than mix resolutions within an episode,
// 4s is dropped entirely so every clip can render at 1080p. Every even duration of 12s or
// more composes from 6 and 8 alone, and the shortest beat in the formula is 16s.
export const ALLOWED_SECONDS = [6, 8];

/**
 * Split `total` seconds into exactly `count` clips drawn from ALLOWED_SECONDS.
 * Returns null when impossible — every allowed length is even, so an odd total can never
 * be composed, and a beat must satisfy 4*count <= total <= 8*count.
 */
export function composeDurations(total, count) {
  if (count < 1 || total % 2 !== 0) return null;
  if (total < 6 * count || total > 8 * count) return null;
  const parts = Array(count).fill(6);
  let remaining = total - 6 * count;         // always even
  for (let i = 0; i < count && remaining > 0; i++) {
    const add = Math.min(2, remaining);      // 6 -> 8
    parts[i] += add;
    remaining -= add;
  }
  return remaining === 0 ? parts.sort((a, b) => b - a) : null;
}

/** How many clips a beat needs so no shot's dialogue overruns 8 seconds. */
function shotsNeededFor(lines, max) {
  if (!lines.length) return null;
  let count = 1, used = 0;
  for (const l of lines) {
    const need = Math.min(max, speakSeconds(l.text) + 0.6);
    if (used + need > max && used > 0) { count++; used = 0; }
    used += need;
  }
  return count;
}

/**
 * Split one beat into Veo-renderable shots.
 *
 * Dialogue decides how many cuts are needed; the allowed clip lengths decide how long each
 * one is. A line is never split across a cut. Where the beat cannot hold every line at a
 * comfortable pace the shots are still valid, but flagged overSubscribed so the caller
 * knows the script overran rather than finding out in the finished video.
 */
export function planBeatShots(beat, max = MAX_SHOT_SECONDS) {
  const lines = beat.lines ?? [];
  const total = beat.seconds;

  const minCount = Math.ceil(total / 8);
  const maxCount = Math.floor(total / 6);
  const wanted = shotsNeededFor(lines, max) ?? minCount;
  // Clamp to what the beat's duration can actually be composed into.
  let count = Math.min(Math.max(wanted, minCount), Math.max(minCount, maxCount));

  let durations = composeDurations(total, count);
  for (let c = count; !durations && c <= maxCount; c++) durations = composeDurations(total, c);
  for (let c = count; !durations && c >= minCount; c--) durations = composeDurations(total, c);
  if (!durations) {
    throw new Error(
      `Beat ${beat.n} is ${total}s, which cannot be composed from ${ALLOWED_SECONDS.join('/')}s clips. ` +
      'Beat durations must be even and at least 6s (and not 10s) — see episode_formula.shot_constraint.'
    );
  }
  count = durations.length;

  const shots = durations.map((seconds, index) => ({
    beat: beat.n, index, seconds, lines: [], visual: beat.visual,
  }));

  // Fill shots in order, never splitting a line, never exceeding a shot's own length.
  let si = 0;
  for (const line of lines) {
    const need = Math.min(max, speakSeconds(line.text) + 0.6);
    const used = shots[si].lines.reduce((t, l) => t + speakSeconds(l.text) + 0.6, 0);
    if (used > 0 && used + need > shots[si].seconds && si < shots.length - 1) si++;
    shots[si].lines.push(line);
  }

  const speech = lines.reduce((t, l) => t + speakSeconds(l.text) + 0.6, 0);
  if (speech > total + 0.5) {
    for (const sh of shots) { sh.overSubscribed = true; sh.overflowSeconds = round(speech - total); }
  }
  return shots;
}

export function planEpisodeShots(episode, max = MAX_SHOT_SECONDS) {
  const shots = [];
  for (const beat of episode.beats) {
    for (const s of planBeatShots(beat, max)) {
      shots.push({ ...s, id: `b${String(beat.n).padStart(2, '0')}s${String(s.index).padStart(2, '0')}`, beatName: beat.name });
    }
  }
  return shots;
}

export function shotsSummary(shots) {
  const seconds = shots.reduce((t, s) => t + s.seconds, 0);
  return { count: shots.length, seconds: round(seconds), withDialogue: shots.filter((s) => s.lines.length).length };
}

/**
 * Remove sub-minimum shots by borrowing from the longest shot, which keeps the beat's
 * total duration exactly intact — important, because the beat totals are what make the
 * episode land on its scripted runtime.
 */
function enforceMinimum(shots, max) {
  for (let guard = 0; guard < shots.length * 4; guard++) {
    const tiny = shots.find((s) => s.seconds < MIN_SHOT_SECONDS - 0.01);
    if (!tiny) return;
    const need = MIN_SHOT_SECONDS - tiny.seconds;
    const donor = shots
      .filter((s) => s !== tiny)
      .sort((a, b) => b.seconds - a.seconds)[0];
    // Nothing to borrow from: fold the orphan into the donor, or drop it if alone.
    if (!donor || donor.seconds - need < MIN_SHOT_SECONDS - 0.01) {
      if (!donor) return;
      donor.seconds = round(Math.min(max, donor.seconds + tiny.seconds));
      donor.lines = [...donor.lines, ...tiny.lines];
      shots.splice(shots.indexOf(tiny), 1);
      continue;
    }
    donor.seconds = round(donor.seconds - need);
    tiny.seconds = round(tiny.seconds + need);
  }
}

const round = (n) => Math.round(n * 100) / 100;
const clamp = (n, lo, hi) => round(Math.min(hi, Math.max(lo, n)));
