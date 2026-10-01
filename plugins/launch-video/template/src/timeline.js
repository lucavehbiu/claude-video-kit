// The one timeline. The film draws from it and scripts/export-cues.mjs hands it to
// score.py, so picture and sound can't drift: move a cue here and both follow.
//
// 120 BPM -> one beat = 0.5s, one bar = 2s. Every hit lands on a beat subdivision.

export const W = 1920;
export const H = 1080;
export const FPS = 60;
export const BPM = 120;
export const BEAT = 60 / BPM;
export const DURATION = 32;

const range = (a, b, step) => {
  const out = [];
  for (let t = a; t <= b + 1e-9; t += step) out.push(+t.toFixed(4));
  return out;
};

export const T = {
  // Act 1 — the group chat. a full thread on screen and a new message landing on frame 1 (hook rule:
  // the first frame shows the problem), then the rate doubles every bar.
  chat: [
    -3.0, -2.5, -2.0, -1.5, -1.0, -0.5,
    ...range(0.0, 2.0, 0.5),
    ...range(2.25, 3.0, 0.25),
    ...range(3.125, 4.0, 0.125),
    ...range(4.125, 5.0, 0.0625),
  ],
  headline: [5.0, 5.5], // "47 messages." / "No game."
  implode: [5.75, 6.0],
  drop: 6.0, // everything collapses into the dot; daylight floods out of it

  // Act 2 — the dot is the logo
  split: [6.5, 6.95],
  logoIn: 6.95,
  wordIn: 8.0,

  // Act 3 — the logo becomes the product
  toProduct: [9.0, 9.6],
  dotFly: [9.1, 9.75],
  gridIn: 9.75,
  you: 10.25,

  // Act 4 — the heatmap fills
  members: range(11.0, 13.0, 0.25),
  best: 13.5,
  pill: 14.0,

  // Act 5 — one tap
  touch: [14.55, 14.95],
  tap: 15.0,
  morph: [15.15, 15.75],
  rsvps: range(16.5, 18.5, 0.25),
  gameOn: 19.0,

  // Act 6 — games everywhere
  zoom: [20.0, 22.0],
  ringsStart: 20.5,
  ringStep: 0.25,
  rings: 8,
  caption: [21.75, 24.85],

  // Act 7 — back to the dot, lockup
  collapse: [25.0, 25.6],
  converge: [25.6, 26.5],
  merge: 26.5,
  split2: [26.55, 26.95],
  logo2In: 26.95,
  word2In: 27.5,
  tagline: [28.5, 28.75],
  sub: 29.25,
  ticks: [30.0, 30.5],
};
