# Launch Video Kit (Claude Code plugin)

Launch films, Reels/TikTok/YouTube ad cuts and app demo videos made from code, the way the PlayPals
videos were made:

- a canvas animation drawn as a pure function of time
- real app captures in a phone mockup
- a synthesized score locked to the same cue sheet
- a motion-blur renderer

| Piece | What it does |
| --- | --- |
| `launch-video` skill | The method, the commands, the workflow and every hard-won rule |
| `launch-video-maker` agent | Builds videos, sections and cuts by following the skill |
| `video-editor` agent | A senior product-marketing editor (Fable) that critiques renders; read-only |
| `template/` | The working engine, with PlayPals as the worked example; copied into a repo to start |
| `scripts/vendor-into-repo.sh` | Copies the skill, agents and engine into a repo (needed for web sessions) |

## Install: every repo on your machine

The marketplace is this repo, `lucavehbiu/claude-video-kit` (private; uses your local git/`gh` auth):

```bash
claude plugin marketplace add lucavehbiu/claude-video-kit
claude plugin install launch-video@claude-video-kit          # user scope = all your projects
```

Or inside a session: `/plugin marketplace add lucavehbiu/claude-video-kit`, then `/plugin install launch-video@claude-video-kit`
and choose "Install for you (user scope)". Update later with `/plugin marketplace update claude-video-kit`.

The marketplace reads the repo's default branch, so the plugin has to be on `main`.

## Web sessions (claude.ai/code)

Cloud sessions don't load personal plugins. They load the repo's own `.claude/` folder and plugins your
org admin enables in managed settings. To use the kit in a repo there, vendor it in once and commit:

```bash
# from a clone of this repo:
bash plugins/launch-video/scripts/vendor-into-repo.sh /path/to/repo [marketing/launch-video]
```

Or just ask Claude in that repo: *"vendor the launch-video kit into this repo"*.

## Requirements

`ffmpeg`, Node 18+ with Playwright (Chromium), and Python 3 with `pip install numpy scipy soundfile pyloudnorm`.
