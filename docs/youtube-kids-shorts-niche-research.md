# YouTube Kids Shorts — Niche Research & Recommendation

_Research date: 15 September 2026_

---

## 0. Method and its limits (read this first)

**Update (15 Sept 2026): §1–§4 below were written from secondary sources; the niches have
since been measured against the live YouTube Data API.** See **§3.5** for the measured results,
including two places where the data does not support what §3/§4 originally claimed. The raw
report is in [`docs/measured/niche-scan-2026-09-15.md`](measured/niche-scan-2026-09-15.md).

The original limitation, for the record: this session's network egress blocks `youtube.com`
directly (it still does — the API is reached via `googleapis.com`), and no API key was
configured when §1–§4 were written.

What this document is built on instead:

- Published weekly YouTube ranking data (Tubefilter Global Top 50, Sept 2026 weeks)
- Platform-level statistics (Statista, YouTube Shorts usage data)
- Reported channel figures for the established kids players
- Trade/industry coverage of the 2026 policy environment (COPPA enforcement, the AI
  "inauthentic content" crackdown)

Treat the **structural findings** (§1–§2) as solid and the **per-channel revenue claims**
circulating in creator-marketing blogs (§2.3) as unverified sales copy. Before committing
budget, re-run §5 with real data — see §6 for how.

---

## 1. What the market actually looks like right now

**Shorts is the distribution layer, not a side feature.** In the week of 06 Sept 2026,
**37 of the Global Top 50 most-viewed channels were primarily Shorts-driven**. The #1 channel
that week did 930M views in seven days. This is no longer a "post Shorts too" situation —
short-form is how channels are discovered at all.

**Kids content still scales harder than anything else.** The category leaders:

| Channel | Scale | Format |
|---|---|---|
| Cocomelon | ~200M subs, ~220B lifetime views | 3D nursery rhymes |
| Pinkfong | ~83M subs; "Baby Shark" alone >16B views | Songs + educational cartoons |
| Ms. Rachel | >20M subs, >16B views | Live-action early language development |
| D Billions | Top video >3.5B views | 2D/3D songs + dance, preschool |

**The top is closed; the tier below is not.** Nobody is out-Cocomelon-ing Cocomelon. The
observable growth in 2026 is one tier down: edutainment, regional-language niches, narrow
character-led series, and hybrid Shorts→long-form funnels. Kids channels running a deliberate
Shorts strategy alongside long-form show materially higher subscriber growth than long-form-only
channels.

**Structural tailwind unique to kids:** children rewatch the same video 10–50×. The algorithm
reads repeat-watch as exceptional retention and widens distribution. No other niche gets this
for free.

---

## 2. The two constraints that decide everything

### 2.1 "Made for Kids" is a revenue tax, and it is not optional

Labelling a video Made for Kids (MFK) is a legal requirement under COPPA if the content is
child-directed — the FTC can fine up to ~$53,000 per violation for misclassification. Mislabelling
to chase RPM is not a strategy, it's a liability.

What the label costs you:

- Only contextual (non-personalised) ads serve → **~$1–3 RPM vs $5–15** for general audience
- **Off:** comments, channel memberships, Super Thanks/Chat/Stickers, end screens, cards,
  the notification bell
- **Shorts monetisation is brutal regardless of label: roughly $0.05–$0.15 RPM**

**Do the arithmetic before falling in love with a format.** A MFK Short doing 1,000,000 views
grosses roughly **$50–150**. A channel doing 30M Shorts views a month is a genuine hit by any
normal standard and still clears maybe $1.5k–4.5k in ad revenue.

> **Conclusion: Shorts in the kids category are a discovery and subscriber engine. They are not
> the income.** Any plan whose P&L depends on Shorts AdSense is dead on arrival. The money sits
> in what Shorts feed: long-form watch time, 24/7 pre-recorded livestreams of the back catalogue,
> brand deals with toy/edtech companies, licensing (Netflix, Amazon Kids+), and merch/products.

### 2.2 The AI-slop window has closed

January 2026: YouTube's inauthentic-content enforcement wave **wiped ~4.7 billion views and
terminated 16 channels holding ~35M combined subscribers**, reportedly ~$10M/yr in ad revenue.
The terminated channels shared a fingerprint: synthetic narration, templated thumbnails, stock
footage loops, and an upload cadence no human editorial process could sustain.

To be precise about what is and isn't banned: **faceless is fine, AI-assisted is fine.** Mass-
produced and near-duplicate content is not. AI output must carry original value — real script,
real curation, consistent authored style.

This kills the cheap play ("spin up an AI cartoon farm, upload 10/day"). It *helps* anyone
willing to build one consistent, authored property: the low-effort competition is being removed
from the field.

### 2.3 Claims to distrust

Creator-tool marketing blogs assert things like "AI-assisted kids content earns £2,000–£10,000/month"
and quote $1/Short production costs. These are vendor sales copy, are not reconcilable with the
RPM math in §2.1, and should carry zero weight in the decision.

---

## 3. Niche candidates, scored

Scoring 1–5 (5 = best). "Ceiling" = realistic revenue upside at scale; "Moat" = how hard it is
for a copycat to take your audience.

| # | Niche | Demand | Saturation (5=low) | Cost | Moat | Ceiling | **Total** |
|---|---|---|---|---|---|---|---|
| 1 | Nursery rhymes / songs (3D) | 5 | 1 | 1 | 1 | 4 | **12** |
| 2 | Generic AI story cartoons | 4 | 2 | 4 | 1 | 2 | **13** |
| 3 | Toy/unboxing play | 4 | 1 | 3 | 1 | 3 | **12** |
| 4 | Character-led episodic mini-stories | 4 | 3 | 2 | **5** | **5** | **19** |
| 5 | Sensory / non-verbal / "satisfying" for toddlers | 4 | **4** | **4** | 2 | 3 | **17** |
| 6 | **Parent-facing kids art & activity Shorts** | 4 | **4** | **4** | 4 | **5** | **21** |
| 7 | Regional-language preschool edutainment | 4 | **4** | 3 | 3 | 4 | **18** |

**Why 1–3 lose:** these are the incumbents' home turf. Nursery rhymes means competing on
production value against studios with 200M subscribers, at $1–3 RPM. Generic AI story cartoons
are exactly the profile §2.2 is now terminating.

**Why 5 is interesting:** sensory / non-verbal content is genuinely rising (broadcasters and
toycos are actively chasing sensory play and slower-paced formats, partly driven by demand from
neurodivergent kids' families). It is cheap, needs no voice track, and travels across every
language market. Weak moat — it is easy to copy — but it is the best *pure* MFK Shorts play.

**Why 4 has the highest ceiling:** a strong original character is the only asset in kids media
that appreciates. It is what licensing buyers purchase, and short episodic adventure/storytime
built around one character is reported as the best-performing format for building long-term loyal
kids audiences in 2026. Cost and timeline are the problem — this is a 12-month build, not a
90-day one.

---

## 3.5 Measured data (15 Sept 2026)

Scan parameters: Shorts (≤180s) published in the last 30 days, sampled by `order=viewCount`,
region US, 2 queries per niche, n≈58–100 per niche, 1,423 quota units.

| Niche | n | Median views | Views/sub | New <12mo | Micro (<10k subs) | Median ch. age | MFK | Openness |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Character-led episodic | 84 | 897.8K | 88.7× | 65% | 52% | 8mo | 45% | 86 |
| Generic AI story cartoons | 89 | 642.6K | 102.0× | 56% | 69% | 8mo | 28% | 83 |
| Preschool edutainment | 80 | 198.4K | 20.9× | 40% | 46% | 17mo | 84% | 76 |
| Nursery rhymes / songs | 58 | **4.0M** | 10.7× | 18% | 16% | 41mo | 98% | 67 |
| **Parent-facing kids art** | 93 | 368.3K | 6.6× | 28% | 30% | 26mo | 24% | 62 |
| Sensory / non-verbal | 100 | **10.3K** | 4.7× | 29% | 68% | 35mo | 6% | 55 |
| Toy / unboxing play | 93 | 793.5K | **0.47×** | 23% | 9% | 39mo | 26% | 19 |

### What the data confirms

**Toy/unboxing is closed — decisively.** The only niche with views-per-subscriber **below 1×**
(0.47×), just 9% micro-channels and a median channel age of 39 months. Reach in this niche goes
to channels that already have an audience. A new entrant is invisible here. §3 scored it 12/35;
that was, if anything, generous.

**Nursery rhymes is the incumbent wall, exactly as described.** Highest median views in the scan
by a wide margin (4.0M) — and 98% Made for Kids, 18% new entrants, 16% micro-channels, median
channel age 41 months. Enormous payouts flowing almost entirely to established studios, under the
worst monetization regime. Do not enter.

**The recommended niche's core premise holds.** 76% of sampled parent-facing art/activity Shorts
are **general-audience, not MFK** — this audience demonstrably *is* reachable without the COPPA
label, which was the load-bearing claim in §4. Median duration 24s, matching the 20–40s spec.

### What the data corrects

**⚠️ The two highest "openness" scores are measuring churn, not opportunity.** Character-led
episodic (86) and generic AI story cartoons (83) share a profile: median channel age **8 months**,
52–69% of videos from channels under 10k subs, and views-per-subscriber of **89–102×**. Very new
channels, tiny subscriber bases, enormous view multiples, 34–36s runtime. That is precisely the
content-farm fingerprint §2.2 describes. The most likely reading is not "this niche is wide open"
but **"the incumbents here keep getting terminated."** The openness heuristic cannot tell those two
apart, and on this evidence it is actively misleading for these two rows. Treat 86 and 83 as a
warning, not an invitation — and note the two niches share 8 sampled videos (10%), so they are
not independent observations anyway.

**⚠️ The sensory/non-verbal backup is much weaker than §3 assumed.** Median views **10.3K**, p90
just 101.9K — an order of magnitude below every other niche measured, with 68% micro-channels.
§3 scored it 17/35 and called it "the best *pure* MFK Shorts play." The data does not support
that. It is cheap and uncrowded because reach is poor, which is a different thing from an
opening. **Demote it from backup to experiment**, or drop it.

**The parent-facing pick involves a real tradeoff, not a free lunch.** Within that sample, the
Made-for-Kids videos earn *higher* median views than the general-audience ones (653K vs 328K).
So the choice is genuinely reach-vs-monetization: labelling MFK buys roughly 2× the views at
~1/5 the RPM and no comments or memberships. §4 presented the general-audience route as
strictly better; it is not. It is better *per view*, and it trades away some reach to get there.
The recommendation stands — 2× reach does not recover a 5× RPM gap, and the community and funnel
features matter — but it should be made with that tradeoff visible.

### Caveats on these numbers

- `order=viewCount` samples the **head** of each niche, so "median views" is the median of the
  winners, not of the niche. It measures the ceiling. Re-run with `--order relevance` for the
  typical case.
- n≈58–100 per niche off 2 queries each. Directionally sound, not precise.
- US region, English relevance. Several niches (nursery rhymes, AI cartoons) surfaced heavily
  Hindi-language results regardless, which suggests the regional picture differs materially.

---

## 4. Recommendation

### Primary: Parent-facing kids art & activity Shorts (general audience)

**The insight most people in this category miss:** you can make content *about* children's
activities whose **viewer is the parent**. A Short that says "3 things to do with a toddler and
one sheet of paper" is directed at the adult who will do it, not at the child. That content is
legitimately general-audience, so it is **not** Made for Kids, and therefore keeps:

- **$5–15 RPM instead of $1–3** — and crucially, this niche attracts *premium* advertisers:
  educational toys, learning apps, STEM kits, children's books, all bidding for parents with
  purchasing intent
- Comments, memberships, Super Thanks — i.e. an actual community and a direct line to the audience
- End screens and cards — i.e. a working funnel

**This is not a labelling trick.** It only works if the content genuinely is parent-directed:
adult-framed hooks, adult narration or on-screen text, ideas/instruction/outcomes rather than
child-entertainment. If you find yourself making something a 3-year-old would watch alone, label
it MFK and accept §2.1. The compliance line is the content, not the checkbox.

**Format spec:**

- 20–40s vertical, single idea per Short, no rambling (retention beats duration; 50–60s Shorts
  show strong watch-through but only when the idea fills the time)
- Structure: hook stating the outcome → materials in 3s → process at speed → finished result held
  up → one-line "save this"
- Top-down hands-only shooting. Faceless, so it is delegable and not dependent on one person
  being available and camera-ready.
- DIY/craft is one of the strongest-performing Shorts structures precisely because the
  compressed process→result arc matches how the format is consumed. Same retention mechanic as
  "oddly satisfying", with actual utility attached.

**Funnel:** Shorts (discovery) → long-form "Saturday activity" compilations, 6–10 min
(watch time + real RPM) → email list / printable activity packs → product.

**⚠️ Strategic note specific to this repo:** this project is an art e-commerce storefront.
A parent-facing kids **art & craft** channel is an unusually clean fit — same audience
(design-minded parents), and the funnel terminates in a store that already exists rather than in
an AdSense cheque. Downloadable kids art printables are a near-zero-marginal-cost product line
for a store already set up to sell art. If that connection is *not* the intent here, the niche
still stands on its own on the numbers above — but it would be worth deciding deliberately.

### Backup / parallel: Sensory non-verbal toddler Shorts (Made for Kids) — *downgraded, see §3.5*

Run only if you want a second, cheap, language-independent channel. No voice track means no
translation cost and global reach. Accept it as a subscriber/reach asset at $0.05–0.15 RPM, keep
it strictly separate from the parent-facing channel (mixing MFK and general-audience content on
one channel wrecks the monetisation of both), and monetise it later via licensing or 24/7
livestream of the catalogue rather than Shorts ads.

### Explicitly not recommended

Nursery rhymes (incumbent wall), generic AI-generated story cartoons (§2.2 termination risk),
toy unboxing (saturated, and increasingly scrutinised as child-directed commercial content).

---

## 5. Validation before spending real money

The scoring in §3 is built on published reports, not on first-hand YouTube data. Close that gap
first — a week of work, not a month:

### Step 1 — measure the niches for real

`scripts/youtube-niche-research.mjs` does the measuring. Zero dependencies, runs on plain Node.

```bash
# 1. Get a free key: console.cloud.google.com → enable "YouTube Data API v3" → API key
echo 'YOUTUBE_API_KEY=your_key_here' >> .env.local

# 2. Check what the scan will cost before spending any quota
npm run research:youtube -- --dry-run

# 3. Run it
npm run research:youtube
```

Niches and search queries live in `scripts/niches.config.json` — edit that, not the script.
The full seven-niche scan costs ~1,430 of the 10,000 free daily quota units. Responses are
cached to disk, so re-runs and resumed runs are nearly free.

What it reports, per niche:

| Metric | Why it decides something |
|---|---|
| Median / p90 views | The ceiling the niche is currently paying out |
| **Views per subscriber** | The saturation signal. Above ~1× the algorithm is pushing past existing audiences, so a channel with no subscribers can still get seen |
| **New-entrant share** | Share of sampled channels under 12 months old. The strongest available evidence the niche is still open to newcomers |
| **Made-for-Kids share** | Which monetization regime the niche's winners actually live under — directly tests the §4 recommendation |
| Median duration, views/day | Format and velocity norms to match |

Two honest caveats the script prints alongside the numbers: `order=viewCount` samples the
*head* of the distribution, so "median views" is the median of the winners, not of the niche
(re-run with `--order relevance` for the typical case); and the API has no "is a Short" flag,
so it post-filters on real parsed duration ≤180s rather than trusting `videoDuration=short`,
which admits anything under 4 minutes.

`npm run research:youtube:test` runs the analysis pipeline against synthetic data — useful
for checking a change to the scoring without spending quota.

### Step 2 — test in production

1. **Ship 20 test Shorts over 3 weeks**, two formats, ~10 each. Judge on retention percentage
   and swipe-away rate, *not* on views. Views at 20 uploads are noise.
2. **Decision gate:** if median retention is under ~60%, the format is wrong — change the format,
   not the posting frequency.

---

## 6. Honest risk register

| Risk | Severity | Mitigation |
|---|---|---|
| COPPA misclassification | **Severe** (~$53k/violation) | Keep the two channels strictly separate; if content is child-directed, label it MFK and take the RPM hit |
| Shorts RPM makes the channel look like a failure on paper | High | Budget from day one as marketing spend with a product/long-form funnel, never as an AdSense business |
| Inauthentic-content enforcement | High | One authored style, human script and curation, sustainable cadence. Never near-duplicate uploads |
| Category saturation | Medium | Sub-niche hard; validate with the views-per-subscriber test in §5 before scaling |
| Key-person dependency | Medium | Faceless hands-only format is delegable by design |

---

## 7. If you want a one-line answer

**Make parent-facing kids art & activity Shorts on a general-audience channel — you get 5×
the RPM, premium advertisers, comments and a real funnel — and treat every Short as marketing
for long-form and product, never as the revenue itself.**
