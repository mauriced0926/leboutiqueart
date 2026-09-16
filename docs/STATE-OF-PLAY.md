# Fix-It Forest — state of play

_Last updated: 16 Sept 2026_

Read this first if you are picking the project up fresh. The pipeline lives in
`pipeline/`; `pipeline/README.md` explains how it works. This file is only about where
things currently stand.

## Where we got to

The channel exists, the pipeline is complete, and `node pipeline/doctor.mjs` reads
**10/10**. One episode script is written and waiting to render.

## The only two blockers

**1. Veo Fast quota is exhausted.** The 34-shot render stops immediately with a 429. It
resets at midnight Pacific. A daily channel will hit this ceiling constantly — request an
increase at https://ai.dev/rate-limit before scaling past one episode a day.

**2. The OAuth app is still in Testing**, so the refresh token expires 7 days after it was
issued (~23 Sept 2026). Publish it: console.cloud.google.com → project
`third-pad-508718-f3` → APIs & Services → OAuth consent screen (newer UI: Google Auth
Platform) → **Audience** tab → **PUBLISH APP**. Decline "Prepare for verification" — it
takes 2–6 weeks and is only needed to remove the unverified warning for other people.
Then re-run `node pipeline/auth.mjs --url` for a long-lived token.

## Next action

```bash
npm run ep:render      # resumes; the shot-1 frame is already cached and will not re-bill
```

Then review every frame, `npm run ep:review`, and `node pipeline/publish.mjs` — which
uploads **private** unless you pass `--public`.

## What costs what

| | |
|---|---|
| Script (Claude) | ~$0.08/episode |
| Frames (Gemini image) | ~$0.04/shot, ~$1.40/episode |
| Animation (Veo Fast) | ~$0.12/s, ~$22/episode |
| **Total** | **~$24/episode** |

At one a day that is ~$740/month against $1–3 RPM under COPPA. That is a real business
decision to make after seeing one finished episode, not before.

## Things learned the hard way — do not undo these

- **Veo accepts only 4, 6 or 8 second clips.** Its own error says "between 4 and 8,
  inclusive", which is wrong. Fractional values are rejected. Beat durations must be even.
- **`instances[0].image` is first-frame conditioning, not a character reference.** Passing
  the model sheet there made Veo animate the sheet: wrong character, a wing grafted onto
  the fox, the art style dropped. Frames are composed by the image model and Veo only
  animates them.
- **The character sheet is not reproducible.** Regenerating it loses defined traits. It is
  locked at `pipeline/assets/character-sheet.png` and tracked in git. Do not regenerate it
  casually; use `--candidates` and pick.
- **Each frame anchors on the episode's first frame.** Without it consecutive shots come
  back in different palettes and will not cut together.
- **Negative prompts are not a safety control.** Scissors reached frame twice despite being
  named. The human review gate is the control that counts.
- **Validation order hides errors.** Probing the API with two invalid parameters only tests
  the one validated first. This produced two wrong conclusions; use one invalid field at a
  time.

## Not done

- Nothing has been uploaded. No episode has been rendered end to end.
- Tolly, Wren and Pip have never been rendered through the two-stage path.
- The cold-open beat (no dialogue, different location) is untested.
- Analytics feedback loop, scheduling, and the long-form/livestream monetisation leg.
