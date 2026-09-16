#!/usr/bin/env node
/**
 * YouTube Shorts niche research — validation pass for
 * docs/youtube-kids-shorts-niche-research.md §5.
 *
 * Zero dependencies. Requires Node 18+ (uses global fetch). Run:
 *   node scripts/youtube-niche-research.mjs --dry-run     # cost estimate, no API calls
 *   node scripts/youtube-niche-research.mjs               # full run
 *
 * Needs YOUTUBE_API_KEY in the environment or in .env.local.
 * Get one free at https://console.cloud.google.com → enable "YouTube Data API v3".
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// YouTube Data API v3 quota costs, in units. Default daily allowance is 10,000.
// search.list is 100× the cost of everything else — it dominates every budget.
const QUOTA_COST = { search: 100, videos: 1, channels: 1, playlistItems: 1 };
const DAILY_QUOTA = 10000;

// A Short is <= 3 minutes (raised from 60s in Oct 2024). The API has no "is a Short"
// flag, and videoDuration=short only means "under 4 minutes", so we post-filter on
// the real parsed duration.
const SHORTS_MAX_SECONDS = 180;

const API = 'https://www.googleapis.com/youtube/v3';

// ---------------------------------------------------------------- CLI

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { args._.push(a); continue; }
    const [key, inline] = a.slice(2).split('=');
    if (inline !== undefined) { args[key] = inline; continue; }
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) { args[key] = true; }
    else { args[key] = next; i++; }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));

if (args.help) {
  console.log(`
YouTube Shorts niche research

  --config <path>   niche config            (default scripts/niches.config.json)
  --out <dir>       output directory        (default research-output)
  --niche <name>    run a single niche by name
  --days <n>        only videos published in the last n days   (default from config)
  --max <n>         shorts sampled per query, paginated by 50   (default from config)
  --order <o>       viewCount | relevance | date                (default from config)
  --region <cc>     regionCode              (default from config)
  --lang <ll>       relevanceLanguage       (default from config)
  --dry-run         print the quota estimate and exit without calling the API
  --no-cache        ignore the on-disk response cache
  --quota-cap <n>   abort before exceeding this many units      (default 10000)
`);
  process.exit(0);
}

// ---------------------------------------------------------------- env

function loadApiKey() {
  if (process.env.YOUTUBE_API_KEY) return process.env.YOUTUBE_API_KEY;
  const envPath = join(ROOT, '.env.local');
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, 'utf8').split('\n')) {
      const m = line.match(/^\s*(?:export\s+)?YOUTUBE_API_KEY\s*=\s*(.*)\s*$/);
      if (m) return m[1].replace(/^["']|["']$/g, '').trim();
    }
  }
  return null;
}

// ---------------------------------------------------------------- stats helpers

const median = (xs) => {
  const s = xs.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!s.length) return null;
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

const percentile = (xs, p) => {
  const s = xs.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!s.length) return null;
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
};

const fmt = (n) => {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  if (Math.abs(n) >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(Math.round(n * 100) / 100);
};

const pct = (n) => (n === null || !Number.isFinite(n) ? '—' : `${Math.round(n * 100)}%`);

/** ISO 8601 duration (PT1M30S) → seconds. */
function parseDuration(iso) {
  if (typeof iso !== 'string') return null;
  const m = iso.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/);
  if (!m) return null;
  const [, d, h, min, s] = m;
  return (+d || 0) * 86400 + (+h || 0) * 3600 + (+min || 0) * 60 + (+s || 0);
}

const monthsSince = (iso) => {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return (Date.now() - t) / (1000 * 60 * 60 * 24 * 30.44);
};

const chunk = (xs, n) => {
  const out = [];
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n));
  return out;
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- API client

class Client {
  constructor(key, { cacheDir, useCache, quotaCap }) {
    this.key = key;
    this.cacheDir = cacheDir;
    this.useCache = useCache;
    this.quotaCap = quotaCap;
    this.quotaUsed = 0;
    this.cacheHits = 0;
  }

  async get(endpoint, params) {
    const url = new URL(`${API}/${endpoint}`);
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    }

    const cacheKey = createHash('sha1').update(url.toString()).digest('hex');
    const cacheFile = join(this.cacheDir, `${cacheKey}.json`);
    if (this.useCache && existsSync(cacheFile)) {
      this.cacheHits++;
      return JSON.parse(readFileSync(cacheFile, 'utf8'));
    }

    const cost = QUOTA_COST[endpoint] ?? 1;
    if (this.quotaUsed + cost > this.quotaCap) {
      throw new Error(
        `Quota cap reached (${this.quotaUsed}/${this.quotaCap} units). ` +
        `Re-run tomorrow, raise --quota-cap, or trim queries in the config.`
      );
    }

    url.searchParams.set('key', this.key);

    let lastErr;
    for (let attempt = 0; attempt < 4; attempt++) {
      let res;
      try {
        res = await fetch(url, { headers: { accept: 'application/json' } });
      } catch (e) {
        lastErr = e;
        await sleep(2000 * 2 ** attempt);
        continue;
      }

      if (res.ok) {
        this.quotaUsed += cost;
        const json = await res.json();
        writeFileSync(cacheFile, JSON.stringify(json));
        return json;
      }

      const body = await res.text();

      // Quota exhaustion is terminal — retrying just wastes wall clock.
      if (res.status === 403 && /quota/i.test(body)) {
        throw new Error(
          `YouTube API quota exhausted for today (HTTP 403).\n` +
          `Used ${this.quotaUsed} units this run. The daily allowance is ${DAILY_QUOTA}; ` +
          `it resets at midnight Pacific.\n${body.slice(0, 400)}`
        );
      }
      if (res.status === 400 || res.status === 404) {
        throw new Error(`${endpoint} failed (HTTP ${res.status}): ${body.slice(0, 400)}`);
      }

      lastErr = new Error(`${endpoint} HTTP ${res.status}: ${body.slice(0, 200)}`);
      await sleep(2000 * 2 ** attempt);
    }
    throw lastErr;
  }
}

// ---------------------------------------------------------------- collection

async function searchShortIds(client, query, opts) {
  // Quantized to the start of the UTC day. If this carried a live millisecond
  // timestamp the cache key would change on every run, so search.list — the 100-unit
  // call that dominates the whole budget — would never hit cache, and two runs an
  // hour apart would silently sample different videos.
  const since = new Date(Date.now() - opts.days * 86400_000);
  const publishedAfter = new Date(Date.UTC(
    since.getUTCFullYear(), since.getUTCMonth(), since.getUTCDate()
  )).toISOString();
  const ids = [];
  let pageToken;

  while (ids.length < opts.maxPerQuery) {
    const res = await client.get('search', {
      part: 'id',
      q: query,
      type: 'video',
      // "short" here means under 4 minutes; we post-filter to <=180s below.
      videoDuration: 'short',
      order: opts.order,
      publishedAfter,
      regionCode: opts.regionCode,
      relevanceLanguage: opts.relevanceLanguage,
      maxResults: Math.min(50, opts.maxPerQuery - ids.length),
      pageToken,
    });
    for (const item of res.items ?? []) {
      if (item.id?.videoId) ids.push(item.id.videoId);
    }
    pageToken = res.nextPageToken;
    if (!pageToken || !(res.items ?? []).length) break;
  }
  return ids;
}

async function hydrateVideos(client, ids) {
  const out = [];
  for (const batch of chunk([...new Set(ids)], 50)) {
    const res = await client.get('videos', {
      part: 'snippet,statistics,contentDetails,status',
      id: batch.join(','),
      maxResults: 50,
    });
    for (const v of res.items ?? []) {
      const seconds = parseDuration(v.contentDetails?.duration);
      out.push({
        id: v.id,
        title: v.snippet?.title ?? '',
        channelId: v.snippet?.channelId,
        channelTitle: v.snippet?.channelTitle ?? '',
        publishedAt: v.snippet?.publishedAt,
        seconds,
        views: Number(v.statistics?.viewCount ?? NaN),
        likes: Number(v.statistics?.likeCount ?? NaN),
        comments: Number(v.statistics?.commentCount ?? NaN),
        // The COPPA flag. This is the single most decision-relevant field in the
        // whole response — it says which monetization regime the video lives under.
        madeForKids: v.status?.madeForKids ?? null,
      });
    }
  }
  return out;
}

async function hydrateChannels(client, ids) {
  const map = new Map();
  for (const batch of chunk([...new Set(ids.filter(Boolean))], 50)) {
    const res = await client.get('channels', {
      part: 'snippet,statistics',
      id: batch.join(','),
      maxResults: 50,
    });
    for (const c of res.items ?? []) {
      map.set(c.id, {
        id: c.id,
        title: c.snippet?.title ?? '',
        publishedAt: c.snippet?.publishedAt,
        ageMonths: monthsSince(c.snippet?.publishedAt),
        // Channels can hide their subscriber count; treat that as unknown, not zero.
        subs: c.statistics?.hiddenSubscriberCount
          ? null
          : Number(c.statistics?.subscriberCount ?? NaN),
        totalViews: Number(c.statistics?.viewCount ?? NaN),
        videoCount: Number(c.statistics?.videoCount ?? NaN),
      });
    }
  }
  return map;
}

// ---------------------------------------------------------------- analysis

function analyse(label, videos, channels) {
  const daysLive = (v) => Math.max(1, (Date.now() - Date.parse(v.publishedAt)) / 86400_000);

  const views = videos.map((v) => v.views);
  const perDay = videos.map((v) => v.views / daysLive(v));

  // Views per subscriber: the saturation signal. A high median means the algorithm is
  // still pushing this niche to non-subscribers, i.e. a new entrant can be seen.
  const vps = videos
    .map((v) => {
      const ch = channels.get(v.channelId);
      return ch && Number.isFinite(ch.subs) && ch.subs > 0 ? v.views / ch.subs : null;
    })
    .filter((n) => n !== null);

  const uniqueChannels = [...new Set(videos.map((v) => v.channelId))]
    .map((id) => channels.get(id))
    .filter(Boolean);

  const ages = uniqueChannels.map((c) => c.ageMonths).filter(Number.isFinite);
  // Openness signal: are recent entrants winning, or is every top result a veteran?
  const newEntrantShare = ages.length ? ages.filter((a) => a < 12).length / ages.length : null;

  const mfkKnown = videos.filter((v) => v.madeForKids !== null);
  const mfkShare = mfkKnown.length
    ? mfkKnown.filter((v) => v.madeForKids).length / mfkKnown.length
    : null;

  const medVps = median(vps);

  // Heuristic 0-100 "is there room here" score. Deliberately crude: it blends how much
  // reach beyond the subscriber base is on offer with how well recent entrants are doing.
  // It is a sorting aid, not a verdict.
  let openness = null;
  if (medVps !== null && newEntrantShare !== null) {
    const reach = Math.min(1, Math.log10(1 + medVps) / Math.log10(11)); // 0 at 0×, 1 at ~10×
    openness = Math.round((0.6 * reach + 0.4 * newEntrantShare) * 100);
  }

  const byChannel = new Map();
  for (const v of videos) {
    const e = byChannel.get(v.channelId) ?? { channel: channels.get(v.channelId), hits: 0, views: 0 };
    e.hits++;
    e.views += Number.isFinite(v.views) ? v.views : 0;
    byChannel.set(v.channelId, e);
  }

  return {
    label,
    sampled: videos.length,
    uniqueChannels: uniqueChannels.length,
    medianViews: median(views),
    p90Views: percentile(views, 90),
    medianViewsPerDay: median(perDay),
    medianViewsPerSub: medVps,
    medianChannelAgeMonths: median(ages),
    newEntrantShare,
    madeForKidsShare: mfkShare,
    medianDuration: median(videos.map((v) => v.seconds)),
    openness,
    topVideos: [...videos].sort((a, b) => b.views - a.views).slice(0, 10),
    topChannels: [...byChannel.values()].sort((a, b) => b.views - a.views).slice(0, 10),
    // Every sampled video, so a surprising median can be traced back to its inputs
    // instead of being taken on trust.
    sample: videos.map((v) => {
      const ch = channels.get(v.channelId);
      return {
        id: v.id,
        title: v.title,
        channelId: v.channelId,
        channelTitle: v.channelTitle,
        publishedAt: v.publishedAt,
        seconds: v.seconds,
        views: v.views,
        madeForKids: v.madeForKids,
        subs: ch?.subs ?? null,
        channelAgeMonths: ch?.ageMonths ?? null,
        viewsPerSub: ch && Number.isFinite(ch.subs) && ch.subs > 0 ? v.views / ch.subs : null,
      };
    }),
  };
}

// ---------------------------------------------------------------- reporting

function renderMarkdown(results, meta, overlaps = []) {
  const L = [];
  L.push('# YouTube Shorts niche scan — measured data');
  L.push('');
  L.push(`_Generated ${new Date().toISOString().slice(0, 10)} · window: last ${meta.days} days · `
    + `order: ${meta.order} · region: ${meta.regionCode} · quota used: ${meta.quotaUsed} units_`);
  L.push('');
  L.push('## Comparison');
  L.push('');
  L.push('| Niche | n | Median views | p90 | Views/sub | New entrants <12mo | MFK share | Openness |');
  L.push('|---|---:|---:|---:|---:|---:|---:|---:|');
  for (const r of [...results].sort((a, b) => (b.openness ?? -1) - (a.openness ?? -1))) {
    L.push(`| ${r.label} | ${r.sampled} | ${fmt(r.medianViews)} | ${fmt(r.p90Views)} | `
      + `${r.medianViewsPerSub === null ? '—' : `${fmt(r.medianViewsPerSub)}×`} | `
      + `${pct(r.newEntrantShare)} | ${pct(r.madeForKidsShare)} | ${r.openness ?? '—'} |`);
  }
  L.push('');
  L.push('**How to read this**');
  L.push('');
  L.push('- **Views/sub** — median views divided by the publishing channel\'s subscriber count.');
  L.push('  Above ~1× means the algorithm is pushing videos well past their existing audience,');
  L.push('  so a channel with no subscribers can still get seen. Below ~0.3× means reach is');
  L.push('  mostly going to channels that already have an audience.');
  L.push('- **New entrants <12mo** — share of the sampled channels created in the last year.');
  L.push('  A high number is the strongest available evidence that the niche is still open.');
  L.push('- **MFK share** — share flagged `madeForKids`. High means the niche lives under the');
  L.push('  COPPA ad regime (~$1–3 RPM, no comments/memberships). Low means competitors are');
  L.push('  reaching this audience through general-audience content and keeping full monetization.');
  L.push('- **Openness** — heuristic blend of the two signals above. Sorting aid, not a verdict.');
  L.push('');
  L.push('> Sampling caveat: `order=viewCount` returns the head of the distribution, so');
  L.push('> "median views" here is the median *of the winners*, not of the niche. It measures');
  L.push('> the ceiling. Re-run with `--order relevance` to sample the typical case instead.');
  L.push('');
  if (overlaps.length) {
    L.push('> **Sample overlap** — these niches drew some of the same videos, so their rows are');
    L.push('> not independent observations. Tighten the queries in the config to separate them:');
    L.push('>');
    for (const o of overlaps.slice(0, 8)) {
      L.push(`> - ${o.a} ∩ ${o.b}: **${o.shared} shared video${o.shared === 1 ? '' : 's'}** (${pct(o.shareOfSmaller)} of the smaller sample)`);
    }
    L.push('');
  }

  for (const r of results) {
    L.push(`## ${r.label}`);
    L.push('');
    L.push(`- Sampled **${r.sampled}** Shorts (≤${SHORTS_MAX_SECONDS}s) across **${r.uniqueChannels}** channels`);
    L.push(`- Median views **${fmt(r.medianViews)}** · p90 **${fmt(r.p90Views)}** · median views/day **${fmt(r.medianViewsPerDay)}**`);
    L.push(`- Median views per subscriber **${r.medianViewsPerSub === null ? '—' : `${fmt(r.medianViewsPerSub)}×`}**`);
    L.push(`- Median channel age **${r.medianChannelAgeMonths === null ? '—' : `${Math.round(r.medianChannelAgeMonths)} months`}** · new entrants **${pct(r.newEntrantShare)}**`);
    L.push(`- Made for Kids **${pct(r.madeForKidsShare)}** · median duration **${r.medianDuration === null ? '—' : `${Math.round(r.medianDuration)}s`}**`);
    L.push('');
    if (r.topVideos.length) {
      L.push('| Top video | Channel | Views | MFK |');
      L.push('|---|---|---:|:-:|');
      for (const v of r.topVideos) {
        const title = v.title.replace(/\|/g, '\\|').slice(0, 70);
        L.push(`| [${title}](https://youtube.com/watch?v=${v.id}) | ${v.channelTitle.replace(/\|/g, '\\|')} | ${fmt(v.views)} | ${v.madeForKids === null ? '?' : v.madeForKids ? 'Y' : 'N'} |`);
      }
      L.push('');
    }
    if (r.topChannels.length) {
      L.push('| Top channel | Subs | Age | Videos in sample |');
      L.push('|---|---:|---:|---:|');
      for (const c of r.topChannels) {
        if (!c.channel) continue;
        L.push(`| ${c.channel.title.replace(/\|/g, '\\|')} | ${c.channel.subs === null ? 'hidden' : fmt(c.channel.subs)} | ${c.channel.ageMonths === null ? '—' : `${Math.round(c.channel.ageMonths)}mo`} | ${c.hits} |`);
      }
      L.push('');
    }
  }
  return L.join('\n');
}

function printTable(results) {
  const rows = [...results].sort((a, b) => (b.openness ?? -1) - (a.openness ?? -1));
  const pad = (s, n) => String(s).padEnd(n);
  const padL = (s, n) => String(s).padStart(n);
  console.log('');
  console.log(pad('NICHE', 34) + padL('N', 5) + padL('MED', 9) + padL('V/SUB', 8) + padL('NEW', 7) + padL('MFK', 7) + padL('OPEN', 6));
  console.log('-'.repeat(76));
  for (const r of rows) {
    console.log(
      pad(r.label.slice(0, 33), 34) +
      padL(r.sampled, 5) +
      padL(fmt(r.medianViews), 9) +
      padL(r.medianViewsPerSub === null ? '—' : `${fmt(r.medianViewsPerSub)}x`, 8) +
      padL(pct(r.newEntrantShare), 7) +
      padL(pct(r.madeForKidsShare), 7) +
      padL(r.openness ?? '—', 6)
    );
  }
  console.log('');
}

// ---------------------------------------------------------------- main

async function main() {
  const configPath = resolve(ROOT, args.config ?? 'scripts/niches.config.json');
  if (!existsSync(configPath)) {
    console.error(`Config not found: ${configPath}`);
    process.exit(1);
  }
  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  const d = config.defaults ?? {};

  const opts = {
    days: Number(args.days ?? d.days ?? 30),
    maxPerQuery: Number(args.max ?? d.maxPerQuery ?? 50),
    order: args.order ?? d.order ?? 'viewCount',
    regionCode: args.region ?? d.regionCode ?? 'US',
    relevanceLanguage: args.lang ?? d.relevanceLanguage ?? 'en',
  };

  let niches = config.niches ?? [];
  if (args.niche) niches = niches.filter((n) => n.name === args.niche);
  if (!niches.length) {
    console.error(args.niche ? `No niche named "${args.niche}" in the config.` : 'No niches configured.');
    process.exit(1);
  }

  // Cost estimate. search.list is 100 units a page and dominates everything else.
  const pagesPerQuery = Math.ceil(opts.maxPerQuery / 50);
  const totalQueries = niches.reduce((n, x) => n + x.queries.length, 0);
  const searchUnits = totalQueries * pagesPerQuery * QUOTA_COST.search;
  const hydrateUnits = totalQueries * pagesPerQuery * 2; // ~1 videos.list + ~1 channels.list
  const estimate = searchUnits + hydrateUnits;

  console.log(`\nNiches: ${niches.length} · queries: ${totalQueries} · window: ${opts.days}d · order: ${opts.order}`);
  console.log(`Estimated quota: ~${estimate} units of the ${DAILY_QUOTA}/day allowance (${Math.round((estimate / DAILY_QUOTA) * 100)}%).`);
  if (estimate > DAILY_QUOTA) {
    console.log(`\n  ⚠  That exceeds one day's allowance. Cut queries, or split the run across days`);
    console.log(`     with --niche. Cached responses are reused, so a resumed run is cheap.`);
  }

  if (args['dry-run']) {
    console.log('\nDry run — no API calls made.\n');
    return;
  }

  const key = loadApiKey();
  if (!key) {
    console.error(`
No API key found.

  1. https://console.cloud.google.com → create a project
  2. Enable "YouTube Data API v3"
  3. Credentials → Create credentials → API key
  4. Add to .env.local:   YOUTUBE_API_KEY=your_key_here

(.env.local is gitignored, so the key will not be committed.)
`);
    process.exit(1);
  }

  const outDir = resolve(ROOT, args.out ?? 'research-output');
  const cacheDir = join(outDir, '.cache');
  mkdirSync(cacheDir, { recursive: true });

  const client = new Client(key, {
    cacheDir,
    useCache: !args['no-cache'],
    quotaCap: Number(args['quota-cap'] ?? DAILY_QUOTA),
  });

  const results = [];
  let halted = false;
  for (const niche of niches) {
    if (halted) break;
    process.stdout.write(`\n▸ ${niche.label ?? niche.name}\n`);
    const ids = [];
    for (const q of niche.queries) {
      process.stdout.write(`  searching "${q}" … `);
      try {
        const found = await searchShortIds(client, q, opts);
        ids.push(...found);
        process.stdout.write(`${found.length} candidates\n`);
      } catch (e) {
        process.stdout.write(`failed\n`);
        console.error(`  ${e.message}`);
        // Out of quota means every later call fails too — stop rather than grind
        // through the remaining niches collecting nothing.
        if (/quota/i.test(e.message)) {
          console.error(
            results.length
              ? '\nStopping early. Niches completed before this point are still written out.\n'
              : '\nStopping — no quota was available for any query.\n'
          );
          halted = true;
          break;
        }
      }
    }
    if (!ids.length) continue;

    const hydrated = await hydrateVideos(client, ids);
    // Drop anything over 3 minutes: videoDuration=short admits up to 4.
    const shorts = hydrated.filter((v) => v.seconds !== null && v.seconds <= SHORTS_MAX_SECONDS && Number.isFinite(v.views));
    process.stdout.write(`  ${shorts.length} confirmed Shorts (dropped ${hydrated.length - shorts.length} over ${SHORTS_MAX_SECONDS}s or missing stats)\n`);
    if (!shorts.length) continue;

    const channels = await hydrateChannels(client, shorts.map((v) => v.channelId));
    results.push(analyse(niche.label ?? niche.name, shorts, channels));
  }

  if (!results.length) {
    console.error('\nNo results collected — nothing written.\n');
    process.exit(1);
  }

  // Overlapping queries can put the same video in two niches, which makes their
  // metrics non-independent. Surface it rather than letting it read as two data points.
  const overlaps = [];
  for (let i = 0; i < results.length; i++) {
    for (let j = i + 1; j < results.length; j++) {
      const a = new Set(results[i].sample.map((v) => v.id));
      const shared = results[j].sample.filter((v) => a.has(v.id)).length;
      if (shared) {
        overlaps.push({
          a: results[i].label,
          b: results[j].label,
          shared,
          shareOfSmaller: shared / Math.min(results[i].sampled, results[j].sampled),
        });
      }
    }
  }
  overlaps.sort((x, y) => y.shared - x.shared);

  const meta = { ...opts, quotaUsed: client.quotaUsed, generatedAt: new Date().toISOString() };
  const stamp = new Date().toISOString().slice(0, 10);
  const mdPath = join(outDir, `niche-scan-${stamp}.md`);
  const jsonPath = join(outDir, `niche-scan-${stamp}.json`);

  writeFileSync(mdPath, renderMarkdown(results, meta, overlaps));
  writeFileSync(jsonPath, JSON.stringify({ meta, overlaps, results }, null, 2));

  printTable(results);
  console.log(`Quota used: ${client.quotaUsed} units (${client.cacheHits} cached responses reused)`);
  console.log(`Report:     ${mdPath}`);
  console.log(`Raw data:   ${jsonPath}\n`);
}

// Exported for the smoke test; main() runs only when this file is the entry point.
export { analyse, median, parseDuration, percentile, renderMarkdown, fmt, monthsSince };

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(`\n${e.message}\n`);
    process.exit(1);
  });
}
