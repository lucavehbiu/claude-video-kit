---
name: launch-video
description: Make launch videos, ad cuts and social reels from code: a canvas animation drawn as a pure function of time, real app screenshots in a phone mockup, and a synthesized score locked to the same cue sheet. Use when asked for a launch video, product film, promo, Reels/TikTok/Shorts ad, YouTube ad, app demo video or motion graphics for any app, or a new section/cut of an existing one. Covers 16:9 hero films and modular 9:16 reels.
---

# Launch videos from code

## Start

- **The repo already has a video folder** (look for `marketing/launch-video/` or `marketing/launch-film/`
  with `src/reel.js`): read its README and work there.
- **New repo:** scaffold the engine, then make it the product's own:
<!-- scaffold -->
  ```bash
  cp -R "${CLAUDE_PLUGIN_ROOT}/template" marketing/launch-video
  # cloud (web) sessions don't load personal plugins. To make the kit work there too, vendor it into the repo:
  bash "${CLAUDE_PLUGIN_ROOT}/scripts/vendor-into-repo.sh" . marketing/launch-video
  ```
<!-- /scaffold -->
  The template ships with PlayPals (a sports app) as the worked example: every section, cut and cue is
  real, working code to adapt.
  - **Brand:** colour tokens `C` in `src/lib.js`; fonts and app icon as base64 in `assets/brand/`.
  - **Captures:** the app's real screenshots go in `assets/captures/`, wired in `build.py` and
    `src/reel.template.html`.
  - **Story:** rewrite the sections in `src/reel.js` and the acts in `src/film.js`/`src/timeline.js` for the
    new product's pains and features; keep the engine (`plan`, `cueSheet`, `drawReel`) and the helpers.
  - Start a README with the section table, the cuts and a "What's real" table, like the PlayPals one in
    spirit.

## Architecture (keep it)

- **Every frame is a pure function of time**: `draw(ctx, t)` on a 2D canvas. There is no animation
  state and no timers, so any frame renders identically twice and the renderer can scrub.
- **One timeline/cue sheet drives picture and sound.** 16:9: `src/timeline.js` → `export-cues.mjs` →
  `score.py`. 9:16: each section declares `cues` + `beds`, `cueSheet()` builds the cut's sheet and
  `reel_score.py` synthesizes it. Move a cue in one place and both follow.
- **Modular 9:16 sections** (`src/reel.js`, `S.<id>`): each is self-contained, `dur` in whole 2s bars
  (120 BPM), and starts and ends on the brand dot at the frame centre, so **any subset in any order cuts
  together**. A cut is just a list of ids (`CUTS`). The engine picks the transition:
  - the **dot collapse/reveal only at hinges**: background change (navy ↔ daylight), or into/out of `brand`/`end`
  - a **short 120px slide + crossfade** between two app sections. A full-width push strobes under motion blur at 30fps.
- **Score**: `synth.py` holds the oscillator/noise instruments and the master chain (sidechain, reverb,
  −14 LUFS, −1 dBTP). No samples, so no licensing issues. The sonic signature (the ball "thock") plays
  only on hinges and the end ticks; overused, it cheapens.
- **Render**: Playwright headless Chromium → `renderFrame(f, 4)` averages 4 sub-frames over a 180°
  shutter (motion blur) → JPEG pipe → ffmpeg. 9:16: 1080×1920, 30fps, H.264 High at 11 Mbps, plus a
  `-silent` copy (silent AAC) for organic posts where platform audio gets added in-app.

## Commands

```bash
cd marketing/launch-video   # or wherever the video folder lives
python3 build.py                                  # bundle pages (fonts, captures, photos, scores inlined)
node render.mjs --reel ad-15 --stills 0,3,7.5     # PNG stills -> dist/stills/ (review these first)
node render.mjs --reel ad-15 --cues && python3 reel_score.py ad-15
python3 build.py && node render.mjs --reel ad-15  # -> dist/reels/ad-15.mp4 + ad-15-silent.mp4
node render.mjs --reel chat,heatmap,end           # any ad-hoc mix of section ids
node export-cues.mjs && python3 score.py && python3 build.py && node render.mjs   # 16:9 film
```

Deps: `pip install numpy scipy soundfile pyloudnorm`, plus ffmpeg and Playwright's Chromium (on the cloud
box: `/opt/node22/lib/node_modules/playwright`; elsewhere set `PLAYWRIGHT_PATH`). A full 84s reel
renders in about 8 min and a 14s ad in about 2.

## Workflow (do it in this order)

1. **Facts before frames.** Check what the product *actually* does: spawn an Explore agent over the app
   code and collect the real UI strings and notification copy (grep `server/` for `title:`/`message:`).
   Every on-screen claim goes in the README's "What's real" table. If the owner wants a feature shown that
   isn't built, write the spec in `tasks/`, mark the section "must ship before paid ads", and say why:
   the Meta misleading-claims policy and the EU UCPD.
2. **Real captures** of the app go in `assets/captures/` (downscale to 900px JPEG). Cards that pop out of the
   phone reuse the app's own copy.
3. **Write or extend sections**, then **render stills and look at them** as contact sheets
   (`ffmpeg ... tile=`), before any full render. Check each new section at 3–4 moments.
4. **Critique pass**: spawn the `video-editor` agent on contact sheets (`review/`). Apply what doesn't
   contradict the owner, and tell them where you sided with them over the critic.
5. **Full render in the background**, verify duration and first frame, then send the files. Previews
   over 30MB get a 2–3 Mbps copy for sending.
6. Commit source, assets and README. Don't commit `dist/reels/` (an 11 Mbps master is 20–85MB); the
   README commands rebuild it.

## Rules learned the hard way

- **Frame 1 = brand + problem, and it must be still.** A message sliding in at t=0 makes frame 1 a
  motion-blur smear, and that frame is the thumbnail. Land anything moving just before 0. Put a
  catchphrase ("Your group chat isn't a sports app.") and a logo badge on frame 1, beside the problem,
  not as a title card in front of it.
- **The punchline lands by ~3s** ("47 messages. No game." at 3.0s). Pain sections reveal their answer
  by 1.2s. The end card is 4s; at 6s it was a quarter of every ad.
- **Ads: 14–20s.** Make one 14s primary (`ad-15`: pain → hero feature → end). The long cut is a section
  library and landing-page demo, not an ad.
- **Problem → solution headlines**: the problem in coral, struck through as the answer lands under it
  (a ✕-in-a-circle badge read as a form validation error). Never use slang that doesn't travel
  ("worldie").
- **Type floor 44px** at 1080 wide for anything that must be read. Text inside the phone is texture;
  what has to be read goes in a pop-out card or a banner.
- **Safe area** (Meta/TikTok/Shorts union): the union envelope is top 269 / bottom 672 / sides
  65–173px. `lift` moves a section's content up when the owner wants it higher; respect owner calls and note
  the trade-off.
- **Phone size**: `phoneGeom(cx, top, w)`. Whole phone on screen means w ≈ 620–640 with its bottom above ~1880.
  A bigger phone bleeding off the bottom reads better; ask which the owner wants.
- **Generic chat for the pain**: a neutral messenger, not the product's UI (that would imply the product
  has the problem) and not WhatsApp's look (trademark).
- **Motion blur hazards**: fast full-frame moves strobe at 30fps × 4 sub-frames. Keep big moves short in
  distance, or crossfade.
- **Photos**: no recognisable faces without a release (Dutch portretrecht). Crop out stray text (e.g. a club name board behind a goal). `cover(ctx, img, x, y, w, h, fx, fy, zoom)` crops onto the subject. The cloud
  sandbox blocks unsplash.com, so ask the owner to upload photos into the chat.
- **Emoji render in canvas** (a Noto Color Emoji font is present). They're fine for sport icons,
  reactions and notification glyphs.
- **Dark veil, not alpha**: to knock a light phone back behind a headline, draw a navy rect at 0.86
  alpha. Fading the phone's own alpha turns it a muddy grey.
- **You can't listen.** Verify audio with a loudness table (max dB per 0.5s) and `showspectrumpic`, and
  catch silent openings that way. Tell the owner the mix needs their ears.

## Adding a section

```js
S.myfeature = {
  dur: 6, bg: C.canvas, beds: [[0, 6, 'groove']], lift: 120,
  cues: [[0.6, 'tap'], [0.7, 'whoosh'], [2.0, 'pluck', 3], [3.4, 'gameon']],
  draw(ctx, lt, A, o) {
    headline(ctx, lt, 0.1, 'The problem?', [[['The answer, '], ['in brand.', C.brand]]], { problem: true });
    const g = phoneGeom(CX, 600 + rise(lt)); drawPhone(ctx, A.shots.mycapture, g);
    finger(ctx, lt, ...g.at(660, 1775), 0.6);              // capture coords -> canvas
    popOut(ctx, lt, 0.7, g.at(660, 1775), [70, 1060, 940, 340], (w, h) => { card(ctx, 0, 0, w, h); /* real copy */ });
  },
};
```

Cue types `reel_score.py` knows: `pop, riser, hit, ding, ping, reveal, drop, pluck, bell, whoosh, tap,
stab, gameon, stars, resolve, tick, suck, thock`. Beds: `tension, calm, groove, resolve`. Register the
section in `CUTS.long` and in any ad cuts, then add a row to the README tables.
