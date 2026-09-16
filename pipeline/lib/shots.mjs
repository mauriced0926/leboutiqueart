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
export const MIN_SHOT_SECONDS = 4;

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
export function planBeatShots(beat, max = MAX_SHOT_SECONDS) {
  const lines = beat.lines ?? [];

  if (!lines.length) {
    // Even division, so no shot is a sliver — 20s becomes 3 shots of ~6.7s, not 8+8+4.
    const count = Math.max(1, Math.ceil(beat.seconds / max));
    const each = beat.seconds / count;
    const even = Array.from({ length: count }, (_, i) => ({
      beat: beat.n, index: i, seconds: round(each), lines: [], visual: beat.visual,
    }));
    // Same rounding residue as the dialogue path: 20s / 3 rounds to 6.67 x 3 = 20.01.
    const drift = round(beat.seconds - even.reduce((t, x) => t + x.seconds, 0));
    if (Math.abs(drift) > 0.001) even[0].seconds = round(even[0].seconds + drift);
    return even;
  }

  // A beat can hold at most this many shots without any falling under Veo's 4s floor.
  // Exceeding it is not a rounding problem, it means the script wrote more dialogue than
  // the beat's duration can carry — which the planner must report, not paper over.
  const maxShots = Math.max(1, Math.floor(beat.seconds / MIN_SHOT_SECONDS));

  const shots = [];
  let current = { beat: beat.n, index: 0, seconds: 0, lines: [], visual: beat.visual };
  for (const line of lines) {
    const need = Math.min(max, speakSeconds(line.text) + 0.6); // +0.6s breathing room
    const wouldOverflow = current.lines.length && current.seconds + need > max;
    // Only open a new shot if there is room for one; otherwise keep packing the last.
    if (wouldOverflow && shots.length + 1 < maxShots) {
      shots.push(current);
      current = { beat: beat.n, index: shots.length, seconds: 0, lines: [], visual: beat.visual };
    }
    current.lines.push(line);
    current.seconds += need;
  }
  if (current.lines.length) shots.push(current);

  // Fit the shots to the beat's scripted duration.
  //
  // Proportional scaling alone silently loses time: any shot pushed past the 8s cap is
  // clamped and its excess vanishes, which turned a 240s script into 188s of shots. So
  // distribute the remaining time across shots that still have headroom, and if every
  // shot is already at the cap, append wordless shots to carry what is left rather than
  // quietly shortening the episode.
  for (const sh of shots) sh.seconds = clamp(sh.seconds, MIN_SHOT_SECONDS, max);
  let deficit = round(beat.seconds - shots.reduce((t, x) => t + x.seconds, 0));

  while (deficit > 0.01) {
    const headroom = shots.filter((x) => x.seconds < max - 0.01);
    if (!headroom.length) {
      // Every shot is full — a held reaction shot absorbs the remainder.
      const extra = Math.min(max, deficit);
      shots.push({ beat: beat.n, index: shots.length, seconds: round(extra), lines: [], visual: beat.visual });
      deficit = round(deficit - extra);
      continue;
    }
    const share = deficit / headroom.length;
    let added = 0;
    for (const x of headroom) {
      const give = Math.min(share, max - x.seconds);
      x.seconds = round(x.seconds + give);
      added += give;
    }
    if (added < 0.01) break; // no progress possible; stop rather than spin
    deficit = round(deficit - added);
  }

  // Trim the other way if packing overshot.
  let excess = round(shots.reduce((t, x) => t + x.seconds, 0) - beat.seconds);
  while (excess > 0.01) {
    const trimmable = shots.filter((x) => x.seconds > MIN_SHOT_SECONDS + 0.01);
    if (!trimmable.length) break;
    const share = excess / trimmable.length;
    let removed = 0;
    for (const x of trimmable) {
      const take = Math.min(share, x.seconds - MIN_SHOT_SECONDS);
      x.seconds = round(x.seconds - take);
      removed += take;
    }
    if (removed < 0.01) break;
    excess = round(excess - removed);
  }

  enforceMinimum(shots, max);

  // Flag a beat whose dialogue cannot physically fit. The shots are still valid and
  // renderable — the words will simply be rushed — but the caller should know the script
  // overran rather than discover it in the finished video.
  const speech = lines.reduce((t, l) => t + speakSeconds(l.text) + 0.6, 0);
  if (speech > beat.seconds + 0.5) {
    for (const sh of shots) {
      sh.overSubscribed = true;
      sh.overflowSeconds = round(speech - beat.seconds);
    }
  }

  // Absorb the residue from repeated 2dp rounding into the longest shot, so a beat's
  // shots sum to its duration exactly. Without this the error compounds across beats and
  // the episode drifts off its scripted runtime.
  const residue = round(beat.seconds - shots.reduce((t, x) => t + x.seconds, 0));
  if (Math.abs(residue) > 0.001) {
    const target = shots.slice().sort((a, b) => b.seconds - a.seconds)[0];
    if (target) target.seconds = round(target.seconds + residue);
  }

  shots.forEach((sh, i) => { sh.index = i; });
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
