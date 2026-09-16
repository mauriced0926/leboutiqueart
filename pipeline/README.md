# Fix-It Forest — automated episode pipeline

Daily AI-generated character-led kids Shorts, with a human approval gate.

Niche chosen from measured data in [`../docs/measured/niche-scan-2026-09-15.md`](../docs/measured/niche-scan-2026-09-15.md);
character-led episodic scored highest on reach (897.8K median views, 88.7× views/sub)
with a 36s median runtime, which is what the 35s beat structure targets.

---

## The thing this pipeline is actually designed around

In January 2026 YouTube's inauthentic-content enforcement wiped ~4.7B views and terminated
16 channels holding ~35M subscribers. The terminated channels shared a fingerprint:
synthetic narration, templated output, and an upload cadence no human editorial process
could sustain.

**Faceless is fine. AI-assisted is fine. Near-duplicate mass production is not.** Our own
niche scan found this category's median channel age is *8 months* — the incumbents keep
dying. So three things are structural here, not optional extras:

1. **One authored property.** `series-bible.json` fixes the cast, world, visual style and a
   5-beat structure. Every prompt carries it verbatim. Character drift between episodes is
   the most visible sign of machine production.
2. **A mechanical novelty gate.** `lib/registry.mjs` rejects any episode that repeats an
   object, principle, owner or cause inside its recency window, or whose premise is ≥62%
   similar to *any* prior episode. Rejection reasons are fed back into the retry prompt, so
   regeneration converges instead of wandering. A model asked for "something new" will
   cheerfully hand back yesterday's episode with one noun swapped, and will not mention it.
3. **A human gate.** Nothing publishes without `review.mjs approve`.

---

## Setup

```bash
npm install                        # includes a bundled ffmpeg binary as a fallback

# .env.local (gitignored)
ANTHROPIC_API_KEY=...              # console.anthropic.com — script generation
YOUTUBE_API_KEY=...                # read-only: stats, niche scanning
YOUTUBE_OAUTH_CLIENT_ID=...        # uploads need OAuth, an API key cannot publish
YOUTUBE_OAUTH_CLIENT_SECRET=...
YOUTUBE_OAUTH_REFRESH_TOKEN=...    # produced by: node pipeline/auth.mjs

# ffmpeg, for assembly — a system install is preferred
brew install ffmpeg                # or: sudo apt-get install ffmpeg
```

If you would rather not install one system-wide, `npm install @ffmpeg-installer/ffmpeg`
ships platform binaries inside the package and the pipeline finds it automatically.
Resolution order is `FFMPEG_PATH` → `ffmpeg` on PATH → the bundled binary.

### Authorise uploads (once)

```bash
node pipeline/auth.mjs                    # default port 8765
node pipeline/auth.mjs --port 9000        # if 8765 is taken
node pipeline/auth.mjs --client-secrets ~/Downloads/client_secret_....json
```

This starts a throwaway local server, opens a consent URL, and catches Google's redirect.
It writes `YOUTUBE_OAUTH_REFRESH_TOKEN` into `.env.local` on success.

**The configured client is a Desktop app, so no redirect registration is needed.** Google
accepts any loopback address, port and path for `installed` clients. Verified directly
against the authorization endpoint:

| Redirect URI | Result |
|---|---|
| `http://localhost:8765/oauth2callback` | accepted |
| `http://127.0.0.1:8765/oauth2callback` | accepted |
| `http://localhost:9999/anything` | accepted |
| `https://evil.example.com/x` (control) | rejected — `redirect_uri_mismatch` |

If you ever swap in a **Web application** client instead, that one *does* require the exact
URI — port and path included — registered under Credentials → Authorized redirect URIs.
`auth.mjs` prints those instructions only when the client isn't a desktop one.

Your Google account must be listed under APIs & Services → OAuth consent screen → Test
users, unless the app is published — otherwise consent returns `access_denied`.

> The paste-a-code out-of-band flow you'll find in older tutorials
> (`redirect_uri=urn:ietf:wg:oauth:2.0:oob`) was blocked for every client type in January
> 2023 and now fails with `invalid_request`. Loopback is its replacement.

## Daily loop

```bash
node pipeline/doctor.mjs           # what's configured, what's missing
node pipeline/run.mjs              # 1. script      → episode.json
node pipeline/build.mjs            # 2. media       → video.mp4
node pipeline/review.mjs           # 3. list the queue
node pipeline/review.mjs show 12   #    read it in full
node pipeline/review.mjs approve 12
node pipeline/publish.mjs          # 4. upload approved (private by default)
node pipeline/publish.mjs --public #    when you are ready
```

`--dry-run` works on `run.mjs` and `publish.mjs`. `doctor.mjs --live` actually calls the
image and speech APIs to prove they work, for a few cents.

### What build.mjs does

1. **Character sheet, once.** Generates `assets/character-sheet.png` from the bible's cast.
   Every subsequent beat image is conditioned on it as a reference image. This is how Mango
   stays looking like Mango — text prompts alone drift, and drift between episodes is the
   most visible sign of machine production.
2. **One image per beat**, with the style block sent verbatim on every call.
3. **Narration per beat, fitted to the beat's exact duration.** Beat lengths are fixed by
   the formula, so audio is padded or trimmed to fit rather than left to run long —
   otherwise audio and video drift apart across five beats and the episode ends mid-word.
4. **Assembly** via ffmpeg, with a slow push-in on each still.

Beat images are cached, so a re-run after a failure doesn't regenerate what already worked.

### Providers

| Stage | Default | Alternatives | Select with |
|---|---|---|---|
| Script | Claude `claude-opus-5` | — | — |
| Images | Gemini | OpenAI | `MEDIA_IMAGE_PROVIDER=gemini\|openai` |
| Narration | Gemini native TTS | ElevenLabs, OpenAI, Cloud TTS | `MEDIA_TTS_PROVIDER=gemini\|elevenlabs\|openai\|google` |

```bash
# ElevenLabs narration
MEDIA_TTS_PROVIDER=elevenlabs
ELEVENLABS_API_KEY=...
ELEVENLABS_VOICE_ID=...        # the voice ID from your library, not its display name

# OpenAI images
MEDIA_IMAGE_PROVIDER=openai
OPENAI_API_KEY=...
OPENAI_IMAGE_MODEL=...         # model names churn; nothing is guessed for you
```

Gemini is the default for both stages because **one `GEMINI_API_KEY` covers images and
narration** — no second credential, no service account.

> **Cloud Text-to-Speech does not accept API keys.** It returns
> `401 API keys are not supported by this API` and needs an OAuth2 token or service
> account. That is why narration defaults to Gemini's native TTS instead. If you do want
> Cloud TTS, set `GOOGLE_TTS_ACCESS_TOKEN` (`gcloud auth application-default
> print-access-token`).
>
> Gemini TTS returns raw `audio/L16` PCM, not a container format, so the adapter prepends a
> WAV header and writes `.wav` regardless of the extension you pass. Use the returned path,
> not the one you passed in.

**One real caveat if you pick OpenAI for images:** its generations endpoint takes no
reference image, so it cannot be conditioned on the character sheet the way the Gemini
adapter is. Character consistency then rests on the prompt alone, and prompts drift. That
drift is the most visible sign of machine production. Prefer Gemini for beat images.

**ElevenLabs is the better narration choice on quality**; API-generated audio is
commercially licensed, but confirm your plan tier covers monetized use before committing a
voice to the series.

`doctor.mjs` checks only the keys your selected providers actually need.

**Cost: roughly $0.05–0.10 per episode — around $2–3/month at one a day.**

Free tiers cover the media almost entirely at this volume:

| Stage | Free allowance | This channel uses |
|---|---|---|
| Images (Gemini Flash image) | **requires billing enabled** — see below | ~5/episode |
| Narration (Cloud TTS, Standard voices) | 4M characters/month | ~200 chars/episode |
| Script (Claude Opus 5) | none — paid per token | ~$0.05–0.08/episode |

**Image generation needs billing on the Gemini project.** Verified against a live key:
every image model — `gemini-2.5-flash-image`, `gemini-3.1-flash-image`,
`gemini-3.1-flash-lite-image`, `gemini-3-pro-image` — returns `429 You exceeded your
current quota` on a billing-free key, while TTS on that same key succeeds. Enable billing
at [ai.dev](https://ai.dev/rate-limit); actual spend at ~5 images/day stays small.

Two things push you further off free:
picking a Pro-tier image model (Gemini 3 Pro Image has **no** free tier at all) or a premium
voice class (Studio voices are $160/1M chars vs $4 for Standard). Both are opt-in via
`MEDIA_IMAGE_MODEL` and `MEDIA_TTS_VOICE` — the defaults stay in the free lane.

Figures are order-of-magnitude, not quotes; verify before scaling.

## Tests

```bash
node pipeline/dedupe.test.mjs      # 20 assertions — the novelty gate
node pipeline/generate.test.mjs    #  9 assertions — generation loop, mocked Claude
node pipeline/media.test.mjs       # 10 assertions — ffmpeg argv construction
```

None of these call a paid API.

---

## What is built vs. what you must wire up

| Component | State |
|---|---|
| Series bible | **Complete** — edit it, don't edit the prompts |
| Novelty gate + registry | **Complete, tested** |
| Episode + script generation (Claude) | **Complete** — `claude-opus-5`, adaptive thinking, structured outputs |
| Review queue CLI | **Complete, tested** |
| ffmpeg assembly | **Complete, tested** (argv construction; needs ffmpeg installed to run) |
| YouTube OAuth + resumable upload | **Complete** — incl. the Made-for-Kids declaration |
| **Image generation** | **Adapter stub** — `lib/media.mjs` → `generateImage()` |
| **Text-to-speech** | **Adapter stub** — `lib/media.mjs` → `generateVoiceover()` |

The two stubs are deliberate. Image and TTS providers are a live commercial decision —
price, licensing, and specifically **whether the voice licence permits monetized
child-directed content**. Picking one for you would pick your cost structure and your legal
exposure. Both throw a setup-shaped error naming exactly what to implement and where.

---

## Things that will bite you

**Made for Kids is a legal declaration, not a setting.** This series is child-directed, so
`series-bible.json` sets `made_for_kids: true` and `buildVideoResource()` refuses to run
without an explicit boolean. It costs you comments, memberships, Super Thanks and
personalised ads, and puts you on ~$1–3 RPM. The FTC fines misclassification at ~$53k per
violation. Do not be tempted.

**Shorts ad revenue is not the business.** $0.05–0.15 RPM means a million-view Short grosses
$50–150. Shorts are the discovery engine. The money is long-form watch time, 24/7 livestreams
of the back catalogue, brand deals, licensing and merch. Budget this pipeline as marketing.

**Upload quota changed on 1 June 2026.** `videos.insert` now bills to its own bucket at
1 unit with a default of 100 calls/day — it no longer eats the 10,000-unit read budget.
Guides still quoting 1,600 units per upload are out of date.

**Unverified Google Cloud projects can only upload private/unlisted.** Verify the project
before expecting `--public` to work.

**Keep the client secret in `.env.local`.** For a desktop client Google does not treat the
secret as truly confidential (it ships inside distributed apps), but it is still half of a
credential pair — don't commit it, and rotate it in the console if it leaks somewhere
shared. For a *web* client the secret genuinely is confidential.

**Daily cadence is a floor, not a target.** If the novelty gate starts rejecting four
attempts in a row, that is the series telling you an axis is exhausted. Widen the cast or the
object range in the bible. Do not lower `similarity_threshold` — that setting is the thing
standing between this channel and the January 2026 outcome.
