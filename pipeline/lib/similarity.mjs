/**
 * Text similarity for near-duplicate detection.
 *
 * This exists because "mass-produced or near-duplicate content" is the specific
 * thing YouTube's inauthentic-content policy demonetizes and terminates for. An LLM
 * asked for "a new episode" will happily produce the same episode with a different
 * noun, and will not tell you it did. So novelty is enforced here, mechanically,
 * rather than trusted to the generator.
 */

/** Lowercase, strip punctuation, collapse whitespace. */
export function normalize(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Words too common in this series to carry any signal — without this, every episode
// looks similar to every other simply because they all feature Mango fixing something.
const STOPWORDS = new Set([
  'a','an','the','and','or','but','if','then','than','so','of','to','in','on','at','for',
  'with','from','by','it','its','is','are','was','were','be','been','that','this','these',
  'those','as','into','out','up','down','her','his','she','he','they','them','their',
  'mango','fox','fixes','fix','fixed','broken','break','breaks','episode','friend',
  // Function words that otherwise let a paraphrase look novel: "wobbles because one leg
  // is short" vs "wobbles since a leg is too short" differ only in these.
  'because','since','when','while','too','very','not','will','one','has','have','had',
  'do','does','did','can','could','would','should','there','here','all','some','any',
  'no','which','what','who','how','why','about','after','before','again','still','just',
]);

/**
 * Deliberately crude suffix stripper, not a real stemmer.
 *
 * It exists for one job: make "legs"/"leg" and "wobbles"/"wobble" compare equal, because
 * a plural swap is the cheapest way for a regenerated episode to look novel while being
 * the same episode. A full Porter stemmer would buy little here and mangle the invented
 * vocabulary a children's series uses.
 */
export function stem(word) {
  let w = word;
  if (w.length > 5 && w.endsWith('ing')) w = w.slice(0, -3);
  else if (w.length > 4 && w.endsWith('ed')) w = w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) w = w.slice(0, -1);
  return w;
}

export function tokens(text, { stripStopwords = true } = {}) {
  const raw = normalize(text).split(' ').filter(Boolean);
  const kept = stripStopwords ? raw.filter((w) => !STOPWORDS.has(w)) : raw;
  return kept.map(stem);
}

/** Character trigrams of the normalized string, padded so short strings still compare. */
export function trigrams(text) {
  const s = ` ${normalize(text)} `;
  const out = new Set();
  if (s.length < 3) return out;
  for (let i = 0; i <= s.length - 3; i++) out.add(s.slice(i, i + 3));
  return out;
}

export function jaccard(setA, setB) {
  if (!setA.size && !setB.size) return 0;
  let shared = 0;
  for (const x of setA) if (setB.has(x)) shared++;
  return shared / (setA.size + setB.size - shared);
}

/**
 * Combined similarity in [0,1].
 *
 * Trigrams catch reworded-but-identical premises ("the wobbly stool" vs "a stool that
 * wobbles"); token overlap catches same-content-different-phrasing. Neither alone is
 * enough: trigrams over-fire on shared prefixes, tokens under-fire on paraphrase.
 */
export function similarity(a, b) {
  const tri = jaccard(trigrams(a), trigrams(b));
  const tok = jaccard(new Set(tokens(a)), new Set(tokens(b)));
  return 0.5 * tri + 0.5 * tok;
}

/** Highest-scoring prior item, or null. `get` extracts the comparable text. */
export function closestMatch(candidate, priors, get = (x) => x) {
  let best = null;
  for (const p of priors) {
    const score = similarity(candidate, get(p));
    if (!best || score > best.score) best = { item: p, score };
  }
  return best;
}
