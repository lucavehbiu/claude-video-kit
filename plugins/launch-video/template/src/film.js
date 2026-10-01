// PlayPals launch film — every frame is a pure function of time: draw(ctx, t).
// No animation state, no timers, so the renderer can scrub to any frame and
// get the same pixels twice. One blue dot is the thread through every act.
import { W, H, T } from './timeline.js';

/* ---------------- tokens (mobile/src/theme, F1 "Clean Daylight") ---------------- */
const C = {
  navy: '#0a1628', navyPaper: '#13314f', inkD: '#f2f6fb', ink3D: '#a2afc0', ink4D: '#6e7d94',
  canvas: '#f7f8fa', paper: '#ffffff', wash: '#eef1f6', line: '#e4e7ef',
  ink: '#0c1222', ink2: '#3b4459', ink3: '#687185', ink4: '#98a0b2',
  brand: '#2563eb', brand2: '#3b82f6', brandDeep: '#1d4ed8', brandTint: '#eef4ff',
  grass: '#16a34a', grassTint: '#e8f7ef', coral: '#ff6b5e', amber: '#f59e0b',
  logoDot: '#1f4a6e',
};
const DISPLAY = (s) => `800 ${s}px Bricolage`;
const BOLD = (s) => `700 ${s}px Satoshi`;
const MED = (s) => `500 ${s}px Satoshi`;

const MEMBERS = [
  { n: 'You', c: C.brand }, { n: 'Maya', c: '#f97316' }, { n: 'Tom', c: '#16a34a' },
  { n: 'Sam', c: '#8b5cf6' }, { n: 'Jonas', c: '#0ea5e9' }, { n: 'Ade', c: '#e11d48' },
  { n: 'Lin', c: '#f59e0b' }, { n: 'Noor', c: '#14b8a6' }, { n: 'Ravi', c: '#6366f1' },
  { n: 'Elif', c: '#db2777' },
];

/* ---------------- math ---------------- */
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const p = (t, a, b) => clamp((t - a) / (b - a));
const eOut = (x) => 1 - (1 - x) ** 3;
const eIn = (x) => x ** 3;
const eInOut = (x) => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2);
const eOut5 = (x) => 1 - (1 - x) ** 5;
// damped spring, ~10% overshoot, settled by u=1
const spring = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : 1 - Math.exp(-6.5 * u) * Math.cos(9.5 * u));
// 0 -> 1 -> 0 pulse with a springy tail
const pulse = (u) => (u <= 0 || u >= 1 ? 0 : Math.sin(Math.PI * Math.min(1, u * 2.2)) * (1 - u) ** 1.5);

function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let r = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
function mix(a, b, k) {
  const A = hex(a), B = hex(b);
  return `rgb(${A.map((v, i) => Math.round(lerp(v, B[i], clamp(k)))).join(',')})`;
}
function ramp(stops, v) {
  v = clamp(v);
  for (let i = 1; i < stops.length; i++) {
    if (v <= stops[i][0]) {
      const [a, ca] = stops[i - 1], [b, cb] = stops[i];
      return mix(ca, cb, (v - a) / (b - a));
    }
  }
  return stops[stops.length - 1][1];
}
const HEAT = [[0, '#eef1f6'], [0.3, '#d6e2fb'], [0.6, '#9dbaf6'], [0.85, '#5b8def'], [1, C.brandDeep]];

/* ---------------- drawing helpers ---------------- */
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.max(0, Math.min(r, w / 2, h / 2)));
}
function circle(ctx, x, y, r, fill) {
  ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill();
}
function text(ctx, s, x, y, font, color, align = 'left', spacing = 0) {
  ctx.font = font; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
  ctx.letterSpacing = `${spacing}px`;
  ctx.fillText(s, x, y);
  ctx.letterSpacing = '0px';
}
function measure(ctx, s, font, spacing = 0) {
  ctx.font = font; ctx.letterSpacing = `${spacing}px`;
  const w = ctx.measureText(s).width;
  ctx.letterSpacing = '0px';
  return w;
}
function check(ctx, x, y, s, color, lw) {
  ctx.beginPath();
  ctx.moveTo(x - s * 0.5, y); ctx.lineTo(x - s * 0.15, y + s * 0.35); ctx.lineTo(x + s * 0.55, y - s * 0.4);
  ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
}
function avatar(ctx, x, y, r, m) {
  circle(ctx, x, y, r, m.c);
  const label = m.n === 'You' ? 'You' : m.n[0];
  ctx.textBaseline = 'middle';
  text(ctx, label, x, y + r * 0.04, BOLD(m.n === 'You' ? r * 0.62 : r * 0.9), '#fff', 'center');
  ctx.textBaseline = 'alphabetic';
}
function withAlpha(ctx, a, fn) {
  if (a <= 0.001) return;
  ctx.save(); ctx.globalAlpha *= clamp(a); fn(); ctx.restore();
}

/* =================================================================== */
/*  ACT 1 — the group chat                                             */
/* =================================================================== */
const CHAT = [
  [7, "football this week? it's been ages"], [4, 'yes pls'], [0, 'down'],
  [1, '5-a-side this Sunday?'], [2, 'yes!!'], [3, 'in'], [4, 'what time?'], [1, '10ish?'],
  [2, "can't do mornings"], [5, 'afternoon then?'], [0, 'works for me'],
  [6, "I'm out Sunday. Saturday?"], [3, 'sat is bad for me'], [4, "who's booking the pitch?"],
  [1, 'anyone??'], [7, 'how many are we'], [5, '6 maybe'], [2, 'need 10 tho'],
  [0, 'ask your uni friends?'], [8, "they're busy"], [6, 'next week then?'], [9, "wait what's happening"],
  [7, 'is it still on?'],
  // the pile-on
  [2, '?'], [3, 'maybe'], [8, "can't"], [7, 'sorry guys'], [4, 'next week?'], [9, "who's in?"],
  [5, 'lol'], [1, 'which pitch?'], [6, "I'll check"], [3, '6 or 7?'], [8, 'too cold'],
  [9, 'is it indoor?'], [7, 'rain tho'], [5, 'bump'], [4, 'pitch is fully booked'],
];
const COLUMN = 23;
const COL_L = 500, COL_R = 1420, CHAT_BASE = H - 175;
const BH = 104, BH_ME = 72; // bubble heights

function chatBubble(ctx, i, x, y, k) {
  // (x, y) = bottom anchor; left for others, right for me. k = entrance 0..1
  const [who, msg] = CHAT[i];
  const me = who === 0;
  const tw = measure(ctx, msg, MED(34));
  const nw = me ? 0 : measure(ctx, MEMBERS[who].n, BOLD(22));
  const w = Math.max(tw, nw) + 52;
  const h = me ? BH_ME : BH;
  const s = lerp(0.9, 1, spring(k));
  ctx.save();
  ctx.globalAlpha *= clamp(k * 3);
  const ax = me ? x : x;
  ctx.translate(ax, y); ctx.scale(s, s);
  const bx = me ? -w : 64;
  if (!me) avatar(ctx, 25, -27, 25, MEMBERS[who]);
  rr(ctx, bx, -h, w, h, 28);
  ctx.fillStyle = me ? C.brand : C.navyPaper; ctx.fill();
  if (me) text(ctx, msg, bx + 26, -h + 48, MED(34), '#fff');
  else {
    text(ctx, MEMBERS[who].n, bx + 26, -h + 38, BOLD(22), mix(MEMBERS[who].c, '#ffffff', 0.25));
    text(ctx, msg, bx + 26, -h + 82, MED(34), C.inkD);
  }
  ctx.restore();
  return h;
}

function actChat(ctx, t, A) {
  if (t >= T.drop) return;
  const dim = 1 - 0.86 * eOut(p(t, T.headline[0], T.headline[0] + 0.3));
  const im = eIn(p(t, T.implode[0], T.implode[1]));

  ctx.save();
  ctx.translate(W / 2, H / 2); ctx.scale(1 - im, 1 - im); ctx.translate(-W / 2, -H / 2);
  ctx.globalAlpha = 1 - im;

  withAlpha(ctx, dim, () => {
    // column: newest at the bottom, older ones pushed up as each arrives
    const enter = T.chat.map((s) => eOut(p(t, s, s + 0.22)));
    let y = CHAT_BASE;
    for (let i = COLUMN - 1; i >= 0; i--) {
      if (t < T.chat[i]) continue;
      const me = CHAT[i][0] === 0;
      // push = sum of heights of newer spawned bubbles, eased
      let push = 0;
      for (let j = i + 1; j < COLUMN; j++) push += ((CHAT[j][0] === 0 ? BH_ME : BH) + 16) * enter[j];
      y = CHAT_BASE - push;
      if (y < -120) continue;
      chatBubble(ctx, i, me ? COL_R : COL_L, y, p(t, T.chat[i], T.chat[i] + 0.35));
    }
    // pile-on: bubbles land anywhere
    const r = rng(7);
    for (let i = COLUMN; i < CHAT.length; i++) {
      const x = lerp(90, 1500, r()), yy = lerp(190, H - 60, r()), rot = lerp(-0.12, 0.12, r()), sc = lerp(0.95, 1.3, r());
      if (t < T.chat[i]) continue;
      ctx.save();
      ctx.translate(x, yy); ctx.rotate(rot); ctx.scale(sc, sc);
      chatBubble(ctx, i, 0, 0, p(t, T.chat[i], T.chat[i] + 0.3));
      ctx.restore();
    }
    // header
    ctx.fillStyle = C.navy; ctx.fillRect(0, 0, W, 150);
    text(ctx, 'Sunday Football', W / 2, 78, DISPLAY(44), C.inkD, 'center');
    const n = 47 - T.chat.filter((s) => t < s).length; // lands on 47 with the last one
    const a = '12 members  ·  ', b = `${n} messages`;
    const wa = measure(ctx, a, MED(26)), wb = measure(ctx, b, BOLD(26));
    text(ctx, a, W / 2 - (wa + wb) / 2, 118, MED(26), C.ink3D);
    text(ctx, b, W / 2 - (wa + wb) / 2 + wa, 118, BOLD(26), n >= 40 ? C.coral : C.ink3D);
    // YouTube lets viewers skip at 5s: brand + proposition on frame 1, in the empty left margin
    drawTile(ctx, A.icon, 112, 300, 72, 1, false);
    text(ctx, 'Play', 164, 318, DISPLAY(48), C.inkD, 'left', -1);
    text(ctx, 'Pals', 164 + measure(ctx, 'Play', DISPLAY(48), -1), 318, DISPLAY(48), C.brand2, 'left', -1);
    ['Your group', 'chat isn\'t a', 'sports app.'].forEach((l, i) => text(ctx, l, 76, 470 + i * 66, DISPLAY(58), i === 1 ? C.coral : C.inkD, 'left', -1.5));
  });

  // typing indicator: its three dots become THE dot
  const fly = eInOut(p(t, 5.5, 5.95));
  const tx = lerp(COL_L + 64 + 50, W / 2, fly), ty = lerp(CHAT_BASE + 58, H / 2, fly);
  ctx.restore();
  withAlpha(ctx, (1 - fly) * lerp(1, 0.4, 1 - dim), () => {
    rr(ctx, tx - 50, ty - 28, 100, 56, 28); ctx.fillStyle = C.navyPaper; ctx.fill();
  });
  for (let d = 0; d < 3; d++) {
    const bob = Math.sin(t * 9 - d * 0.9) * 5 * (1 - fly);
    const x = tx + (d - 1) * lerp(24, 0, fly);
    circle(ctx, x, ty + bob, lerp(7, 16, fly), mix(C.ink4D, C.brand2, fly));
  }

  // "47 messages. No game."
  ctx.save();
  ctx.translate(W / 2, H / 2); ctx.scale(1 - im, 1 - im); ctx.translate(-W / 2, -H / 2);
  ctx.globalAlpha = 1 - im;
  const l1 = eOut(p(t, T.headline[0], T.headline[0] + 0.3));
  const l2 = eOut(p(t, T.headline[1], T.headline[1] + 0.3));
  withAlpha(ctx, l1, () => text(ctx, '47 messages.', W / 2, 470 + 40 * (1 - l1), DISPLAY(150), C.inkD, 'center', -3));
  withAlpha(ctx, l2, () => text(ctx, 'No game.', W / 2, 640 + 40 * (1 - l2), DISPLAY(150), C.coral, 'center', -3));
  ctx.restore();
}

/* =================================================================== */
/*  Logo lockup (acts 2 & 7): the dot splits into the mark's two dots  */
/* =================================================================== */
const TILE = 320;
// the icon's two terminal dots, as offsets of the tile size (measured on icon.png)
const LDOT = [(195 - 256) / 512, (257 - 256) / 512];
const RDOT = [(322 - 256) / 512, (257 - 256) / 512];
const LDOT_R = 17 / 512;

function lockupGeom(ctx, t, o) {
  const ww = measure(ctx, 'PlayPals', DISPLAY(150), -3);
  const gap = 56;
  const finalCx = W / 2 - (TILE + gap + ww) / 2 + TILE / 2;
  const slide = eInOut(p(t, o.wordIn - 0.15, o.wordIn + 0.4));
  return { cx: lerp(W / 2, finalCx, slide), cy: o.cy, ww, gap };
}

function drawTile(ctx, img, cx, cy, size, a = 1, shadow = true) {
  withAlpha(ctx, a, () => {
    const r = size * 0.225;
    if (shadow) {
      ctx.save();
      ctx.shadowColor = 'rgba(12,18,34,0.14)'; ctx.shadowBlur = size * 0.16; ctx.shadowOffsetY = size * 0.05;
      rr(ctx, cx - size / 2, cy - size / 2, size, size, r); ctx.fillStyle = '#eef2f6'; ctx.fill();
      ctx.restore();
    }
    ctx.save();
    rr(ctx, cx - size / 2, cy - size / 2, size, size, r); ctx.clip();
    ctx.drawImage(img, cx - size / 2, cy - size / 2, size, size);
    ctx.restore();
  });
}

function lockup(ctx, t, A, o) {
  const g = lockupGeom(ctx, t, o);
  const tileIn = eOut(p(t, o.logoIn, o.logoIn + 0.35));
  const tick = o.ticks ? o.ticks.reduce((s, tk) => s + pulse(p(t, tk, tk + 0.4)), 0) : 0;
  const s = TILE * (0.96 + 0.04 * tileIn) * (1 + 0.05 * tick);
  const hasTile = t >= o.logoIn;
  if (hasTile) drawTile(ctx, A.icon, g.cx, g.cy, s, tileIn);

  // the dots: one -> two -> land on the mark's dots -> dissolve into it
  const sp = eInOut(p(t, o.split[0], o.split[1]));
  const merge = o.pulseAt != null ? pulse(p(t, o.pulseAt, o.pulseAt + 0.45)) : 0;
  const dotA = 1 - p(t, o.logoIn + 0.15, o.logoIn + 0.4);
  if (dotA > 0) {
    const r = lerp(16 * (1 + 0.6 * merge), LDOT_R * TILE, sp);
    const col = mix(C.brand2, C.logoDot, p(t, o.logoIn - 0.1, o.logoIn + 0.3));
    withAlpha(ctx, dotA, () => {
      circle(ctx, g.cx + LDOT[0] * TILE * sp, g.cy + LDOT[1] * TILE * sp, r, col);
      circle(ctx, g.cx + RDOT[0] * TILE * sp, g.cy + RDOT[1] * TILE * sp, r, col);
    });
  }
  // wordmark
  const wi = eOut(p(t, o.wordIn, o.wordIn + 0.45));
  withAlpha(ctx, wi * (o.wordAlpha ?? 1), () => {
    const x = g.cx + TILE / 2 + g.gap, y = g.cy + 52 + 50 * (1 - wi) + (o.wordDy ?? 0);
    const wp = measure(ctx, 'Play', DISPLAY(150), -3);
    text(ctx, 'Play', x, y, DISPLAY(150), C.ink, 'left', -3);
    text(ctx, 'Pals', x + wp, y, DISPLAY(150), C.brand, 'left', -3);
  });
  return g;
}

/* =================================================================== */
/*  ACT 3/4 — availability heatmap                                     */
/* =================================================================== */
const DAYS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
const TIMES = ['10:00', '13:00', '16:00', '18:00', '19:00', '21:00'];
const GX = 1000, GY = 300, CW = 110, CH = 82, GAP = 12;
const BEST = [3, 4];
const cellXY = (c, r) => [GX + c * (CW + GAP), GY + r * (CH + GAP)];
const bestCenter = () => { const [x, y] = cellXY(...BEST); return [x + CW / 2, y + CH / 2]; };

// who is free when — deterministic, hand-weighted, Thursday 19:00 the only 10/10
const FREE = (() => {
  const A = [
    [0.15, 0.2, 0.25, 0.5, 0.55, 0.4], [0.15, 0.2, 0.3, 0.55, 0.6, 0.45], [0.1, 0.2, 0.3, 0.5, 0.6, 0.4],
    [0.15, 0.2, 0.3, 0.6, 1, 0.5], [0.1, 0.2, 0.25, 0.35, 0.3, 0.25], [0.55, 0.6, 0.55, 0.4, 0.3, 0.2],
    [0.5, 0.6, 0.5, 0.35, 0.25, 0.15],
  ];
  const r = rng(42);
  const f = MEMBERS.map(() => DAYS.map((_, c) => TIMES.map((_, rr_) => r() < A[c][rr_])));
  f.forEach((m) => { m[BEST[0]][BEST[1]] = true; });
  for (let c = 0; c < 7; c++) for (let q = 0; q < 6; q++) {
    if (c === BEST[0] && q === BEST[1]) continue;
    for (let k = 9; k >= 0 && f.filter((m) => m[c][q]).length > 8; k--) f[k][c][q] = false;
  }
  return f;
})();
const arrival = (k) => (k === 0 ? T.you : T.members[k - 1]);

function cellValue(t, c, q) {
  let v = 0;
  const d = (c + q) * 0.018;
  for (let k = 0; k < 10; k++) {
    if (!FREE[k][c][q]) continue;
    const a = k === 0 && c === BEST[0] && q === BEST[1] ? T.dotFly[1] : arrival(k);
    v += eOut(p(t, a + d, a + d + 0.3));
  }
  return v / 10;
}

function actHeatmap(ctx, t, A) {
  if (t < T.toProduct[0] || t >= T.morph[1]) return;
  const out = 1 - p(t, T.tap + 0.1, T.tap + 0.4); // everything but the tapped cell leaves
  const [bx, by] = bestCenter();

  // grid card + cells unfold from the tapped-to-be cell
  withAlpha(ctx, eOut(p(t, T.gridIn, T.gridIn + 0.4)) * out, () => {
    ctx.save();
    ctx.shadowColor = 'rgba(12,18,34,0.08)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 12;
    rr(ctx, GX - 118, GY - 78, 7 * CW + 6 * GAP + 118 + 36, 6 * CH + 5 * GAP + 78 + 36, 36);
    ctx.fillStyle = C.paper; ctx.fill();
    ctx.restore();
    DAYS.forEach((d, c) => text(ctx, d, cellXY(c, 0)[0] + CW / 2, GY - 28, BOLD(22), C.ink4, 'center', 2));
    TIMES.forEach((s, q) => text(ctx, s, GX - 22, cellXY(0, q)[1] + CH / 2 + 8, BOLD(22), C.ink4, 'right'));
  });
  for (let c = 0; c < 7; c++) for (let q = 0; q < 6; q++) {
    const isBest = c === BEST[0] && q === BEST[1];
    const dist = Math.hypot(c - BEST[0], q - BEST[1]);
    const k = eOut(p(t, T.gridIn + dist * 0.045, T.gridIn + dist * 0.045 + 0.3));
    if (k <= 0) continue;
    const [x, y] = cellXY(c, q);
    const v = cellValue(t, c, q);
    const press = isBest ? 1 - 0.06 * pulse(p(t, T.tap, T.tap + 0.25)) : 1;
    const s = lerp(0.9, 1, k) * press;
    if (isBest && t >= T.morph[0]) continue; // the morph takes over this cell
    withAlpha(ctx, k * (isBest ? 1 : out), () => {
      ctx.save();
      ctx.translate(x + CW / 2, y + CH / 2); ctx.scale(s, s);
      rr(ctx, -CW / 2, -CH / 2, CW, CH, 14); ctx.fillStyle = ramp(HEAT, v); ctx.fill();
      ctx.restore();
    });
  }
  // best slot: ring + ripple
  if (t >= T.best && t < T.morph[0]) {
    const [x, y] = cellXY(...BEST);
    const ring = eOut(p(t, T.best, T.best + 0.3));
    ctx.save();
    ctx.globalAlpha = ring;
    rr(ctx, x - 7, y - 7, CW + 14, CH + 14, 20); ctx.strokeStyle = C.brandDeep; ctx.lineWidth = 5; ctx.stroke();
    for (const s0 of [T.best, T.best + 0.5, T.best + 1.0]) {
      const u = p(t, s0, s0 + 0.9);
      if (u <= 0 || u >= 1) continue;
      ctx.globalAlpha = (1 - u) * 0.45;
      const g = 7 + 34 * eOut(u);
      rr(ctx, x - g, y - g, CW + 2 * g, CH + 2 * g, 20 + g * 0.6); ctx.strokeStyle = C.brand2; ctx.lineWidth = 3; ctx.stroke();
    }
    ctx.restore();
  }
  // pill
  const pl = p(t, T.pill, T.pill + 0.4);
  withAlpha(ctx, clamp(pl * 3) * out, () => {
    const s = lerp(0.94, 1, spring(pl));
    const label = 'Thursday 19:00  —  10 of 10 free';
    const w = measure(ctx, label, BOLD(30)) + 110;
    const cx = GX + (7 * CW + 6 * GAP) / 2 - 41, cy = 965;
    ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s);
    rr(ctx, -w / 2, -34, w, 68, 34); ctx.fillStyle = C.grassTint; ctx.fill();
    ctx.strokeStyle = 'rgba(22,163,74,0.25)'; ctx.lineWidth = 2; ctx.stroke();
    check(ctx, -w / 2 + 46, 0, 22, C.grass, 5);
    text(ctx, label, -w / 2 + 76, 11, BOLD(30), C.grass);
    ctx.restore();
  });

  // left column
  const L = 140;
  withAlpha(ctx, out, () => {
    const hi = eOut(p(t, 9.45, 9.85));
    withAlpha(ctx, hi, () => {
      text(ctx, 'Sunday Football', L + 100, 146 + 20 * (1 - hi), DISPLAY(40), C.ink, 'left', -0.5);
      text(ctx, '10 members  ·  Utrecht', L + 100, 186 + 20 * (1 - hi), MED(24), C.ink3);
    });
    const c1 = eOut(p(t, 9.9, 10.3)), c2 = eOut(p(t, 10.0, 10.4)), c3 = eOut(p(t, 10.1, 10.5));
    withAlpha(ctx, c1, () => text(ctx, 'GROUP AVAILABILITY', L, 360 + 20 * (1 - c1), BOLD(22), C.brand, 'left', 3.5));
    withAlpha(ctx, c2, () => text(ctx, 'When can', L, 470 + 30 * (1 - c2), DISPLAY(92), C.ink, 'left', -2.5));
    withAlpha(ctx, c3, () => {
      const w = measure(ctx, 'everyone ', DISPLAY(92), -2.5);
      text(ctx, 'everyone ', L, 575 + 30 * (1 - c3), DISPLAY(92), C.ink, 'left', -2.5);
      text(ctx, 'play?', L + w, 575 + 30 * (1 - c3), DISPLAY(92), C.brand, 'left', -2.5);
    });
    let n = 0;
    for (let k = 0; k < 10; k++) {
      const a = arrival(k);
      const u = p(t, a, a + 0.4);
      if (u <= 0) continue;
      n++;
      const s = lerp(0.5, 1, spring(u));
      withAlpha(ctx, clamp(u * 4), () => {
        ctx.save(); ctx.translate(L + 30 + k * 62, 700); ctx.scale(s, s);
        circle(ctx, 0, 0, 33, C.canvas);
        avatar(ctx, 0, 0, 29, MEMBERS[k]);
        ctx.restore();
      });
    }
    withAlpha(ctx, p(t, T.you, T.you + 0.3), () => {
      const done = n === 10;
      text(ctx, `${n} of 10 shared when they're free`, L, 790, BOLD(26), done ? C.grass : C.ink3);
    });
  });

  // the dot rides in the best cell and turns white as the cell fills
  if (t >= T.dotFly[1] && t < T.morph[0]) {
    const v = cellValue(t, ...BEST);
    const land = pulse(p(t, T.dotFly[1], T.dotFly[1] + 0.4));
    circle(ctx, bx, by, 14 * (1 + 0.5 * land), mix(C.brand, '#ffffff', clamp((v - 0.45) * 2.5)));
  }

  // finger
  if (t >= T.touch[0] && t < T.tap + 0.5) {
    const u = eOut(p(t, T.touch[0], T.touch[1]));
    const fx = lerp(bx + 260, bx, u), fy = lerp(by + 300, by, u);
    const press = pulse(p(t, T.tap, T.tap + 0.25));
    const fade = (1 - p(t, T.tap + 0.15, T.tap + 0.4)) * u;
    withAlpha(ctx, fade, () => {
      circle(ctx, fx, fy, 46 * (1 - 0.2 * press), 'rgba(12,18,34,0.16)');
      ctx.beginPath(); ctx.arc(fx, fy, 46 * (1 - 0.2 * press), 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 4; ctx.stroke();
    });
    const rip = p(t, T.tap, T.tap + 0.5);
    if (rip > 0 && rip < 1) withAlpha(ctx, 1 - rip, () => {
      ctx.beginPath(); ctx.arc(bx, by, 40 + 120 * eOut(rip), 0, Math.PI * 2);
      ctx.strokeStyle = C.brand2; ctx.lineWidth = 4; ctx.stroke();
    });
  }
}

/* =================================================================== */
/*  Game card (act 5, and every tile in act 6)                         */
/* =================================================================== */
const CARD_W = 900, CARD_H = 600;
const HERO = {
  sport: 'PICKUP FOOTBALL', title: 'Thursday 5-a-side', meta: 'Thu 19:00  ·  Sportpark Transwijk, Utrecht',
  need: 10, members: MEMBERS,
};

// st: { slot(i) -> 0..1 appear, count, gameOn 0..1, contentA }
function gameCard(ctx, x0, y0, d, st, cheapShadow = false) {
  ctx.save();
  ctx.translate(x0, y0);
  if (cheapShadow) {
    rr(ctx, 0, 14, CARD_W, CARD_H, 40); ctx.fillStyle = 'rgba(12,18,34,0.06)'; ctx.fill();
  } else {
    ctx.shadowColor = 'rgba(12,18,34,0.12)'; ctx.shadowBlur = 60; ctx.shadowOffsetY = 20;
  }
  rr(ctx, 0, 0, CARD_W, CARD_H, 40); ctx.fillStyle = C.paper; ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.globalAlpha *= st.contentA ?? 1;
  const L = (i) => clamp(((st.contentT ?? 9) - i * 0.06) / 0.25);
  withAlpha(ctx, L(0), () => text(ctx, d.sport, 60, 88, BOLD(24), d.color || C.brand, 'left', 3.5));
  withAlpha(ctx, L(1), () => text(ctx, d.title, 60, 176, DISPLAY(76), C.ink, 'left', -2));
  withAlpha(ctx, L(2), () => text(ctx, d.meta, 60, 232, MED(30), C.ink3));
  withAlpha(ctx, L(3), () => {
    ctx.fillStyle = C.line; ctx.fillRect(60, 272, CARD_W - 120, 2);
    text(ctx, 'Players', 60, 330, BOLD(28), C.ink2);
    const full = st.count >= d.need;
    text(ctx, `${Math.floor(st.count)} / ${d.need}`, CARD_W - 60, 334, DISPLAY(40), full ? C.grass : C.ink, 'right');
    const sp = 780 / d.need;
    for (let i = 0; i < d.need; i++) {
      const cx = 60 + sp / 2 + i * sp, cy = 408;
      circle(ctx, cx, cy, 32, C.wash);
      const u = st.slot(i);
      if (u > 0) {
        const s = lerp(0.4, 1, spring(u));
        ctx.save(); ctx.translate(cx, cy - 140 * (1 - eOut5(u))); ctx.scale(s, s);
        ctx.globalAlpha *= clamp(u * 4);
        avatar(ctx, 0, 0, 32, d.members[i % d.members.length]);
        ctx.restore();
      }
    }
    // button
    const g = st.gameOn;
    rr(ctx, 60, 480, CARD_W - 120, 76, 38);
    ctx.fillStyle = mix(C.brandTint, C.grass, g); ctx.fill();
    const lbl1 = st.waitLabel || 'Waiting for players…';
    withAlpha(ctx, 1 - g, () => text(ctx, lbl1, CARD_W / 2, 530 - 14 * g, BOLD(30), C.brand, 'center'));
    withAlpha(ctx, g, () => {
      const lbl = 'Game on';
      const w = measure(ctx, lbl, BOLD(32));
      check(ctx, CARD_W / 2 - w / 2 - 26, 518 + 14 * (1 - g), 22, '#fff', 5);
      text(ctx, lbl, CARD_W / 2 + 18, 530 + 14 * (1 - g), BOLD(32), '#fff', 'center');
    });
  });
  ctx.restore();
}

function heroState(t) {
  const slotT = (i) => (i === 0 ? T.morph[1] - 0.05 : T.rsvps[i - 1]);
  return {
    contentT: t - (T.morph[1] - 0.1),
    slot: (i) => (i === 0 ? (t >= T.morph[1] ? 1 : 0) : p(t, slotT(i), slotT(i) + 0.45)),
    count: T.rsvps.filter((s) => t >= s + 0.1).length + (t >= T.morph[1] ? 1 : 0),
    gameOn: eOut(p(t, T.gameOn, T.gameOn + 0.25)),
  };
}
const CARD_X = (W - CARD_W) / 2, CARD_Y = (H - CARD_H) / 2;

function actCard(ctx, t) {
  if (t < T.morph[0] || t >= T.zoom[0]) return;
  const m = eInOut(p(t, T.morph[0], T.morph[1]));
  const [cx0, cy0] = cellXY(...BEST);
  if (m < 1) {
    const x = lerp(cx0, CARD_X, m), y = lerp(cy0, CARD_Y, m);
    const w = lerp(CW, CARD_W, m), h = lerp(CH, CARD_H, m);
    ctx.save();
    ctx.shadowColor = `rgba(12,18,34,${0.12 * m})`; ctx.shadowBlur = 60 * m; ctx.shadowOffsetY = 20 * m;
    rr(ctx, x, y, w, h, lerp(14, 40, m)); ctx.fillStyle = mix(C.brandDeep, C.paper, eOut(p(m, 0.1, 0.7))); ctx.fill();
    ctx.restore();
  } else {
    gameCard(ctx, CARD_X, CARD_Y, HERO, heroState(t));
  }
  // the dot travels from the cell into the first player slot and becomes "You"
  if (t < T.morph[1] + 0.05) {
    const [bx, by] = bestCenter();
    const u = eInOut(p(t, T.morph[0] + 0.1, T.morph[1]));
    const sx = CARD_X + 60 + 39, sy = CARD_Y + 408;
    circle(ctx, lerp(bx, sx, u), lerp(by, sy, u) - Math.sin(Math.PI * u) * 120, lerp(14, 32, u), mix('#ffffff', C.brand, u));
  }
  // confetti on "Game on"
  const u = t - T.gameOn;
  if (u > 0 && u < 1.2) {
    const r = rng(9);
    const cols = [C.brand, C.grass, C.coral, C.amber, '#8b5cf6'];
    for (let i = 0; i < 36; i++) {
      const ang = lerp(-Math.PI * 0.92, -Math.PI * 0.08, r()), sp = lerp(700, 1400, r());
      const x = W / 2 + lerp(-300, 300, r()) + Math.cos(ang) * sp * u;
      const y = CARD_Y + 518 + Math.sin(ang) * sp * u + 1900 * u * u;
      const rot = r() * 6 + u * lerp(-12, 12, r());
      const col = cols[i % cols.length];
      withAlpha(ctx, 1 - p(u, 0.7, 1.2), () => {
        ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
        ctx.fillStyle = col; rr(ctx, -9, -5, 18, 10, 3); ctx.fill();
        ctx.restore();
      });
    }
  }
}

/* =================================================================== */
/*  ACT 6/7 — the tessellation of games, then back to one dot          */
/* =================================================================== */
const PITCH_X = 980, PITCH_Y = 690;
const LOCK_Y = 450; // act 7 lockup centre: the tiles converge here
const TILES = (() => {
  const sports = [
    ['FOOTBALL', 'football', C.brand], ['BASKETBALL', 'basketball', '#f97316'], ['VOLLEYBALL', 'volleyball', '#8b5cf6'],
    ['PADEL', 'padel', '#0ea5e9'], ['RUNNING', 'run club', C.grass], ['TENNIS', 'tennis', '#e11d48'],
    ['ULTIMATE', 'frisbee', '#14b8a6'],
  ];
  const places = ['Vondelpark, Amsterdam', 'Westerpark, Amsterdam', 'Olympiaplein, Amsterdam', 'Maximapark, Utrecht',
    'Science Park, Utrecht', 'Oosterpark, Amsterdam', 'Wilhelminapark, Utrecht', 'Sloterpark, Amsterdam',
    'Griftpark, Utrecht', 'Museumplein, Amsterdam'];
  const days = [['Monday', 'Mon'], ['Tuesday', 'Tue'], ['Wednesday', 'Wed'], ['Thursday', 'Thu'], ['Friday', 'Fri'], ['Saturday', 'Sat'], ['Sunday', 'Sun']];
  const times = ['18:30', '19:00', '19:30', '20:00', '10:00', '12:00', '17:00'];
  const r = rng(3);
  const out = [];
  for (let j = -5; j <= 5; j++) for (let i = -6; i <= 6; i++) {
    if (!i && !j) continue;
    const [SP, sp, col] = sports[Math.floor(r() * sports.length)];
    const [D, d] = days[Math.floor(r() * 7)];
    const need = [4, 6, 8, 10][Math.floor(r() * 4)];
    const have = Math.min(need, Math.floor(need * lerp(0.4, 1.25, r())));
    const members = MEMBERS.slice(1).sort(() => r() - 0.5);
    out.push({
      i, j, ring: Math.round(Math.hypot(i, j * 1.25)),
      d: { sport: SP, title: `${D} ${sp}`, meta: `${d} ${times[Math.floor(r() * times.length)]}  ·  ${places[Math.floor(r() * places.length)]}`, need, members, color: col },
      have,
    });
  }
  return out;
})();

function camScale(t) {
  const z = eInOut(p(t, T.zoom[0], T.zoom[1]));
  return lerp(1, 0.21, z) * lerp(1, 0.9, p(t, T.zoom[1], T.collapse[0]));
}

function actGrid(ctx, t) {
  if (t < T.zoom[0] || t >= T.merge) return;
  const s = camScale(t);
  const col = eInOut(p(t, T.collapse[0], T.collapse[1]));
  const conv = eIn(p(t, T.converge[0], T.converge[1]));
  const all = [{ i: 0, j: 0, ring: 0, hero: true }, ...TILES];
  for (const tile of all) {
    const appear = tile.hero ? 1 : eOut(p(t, T.ringsStart + tile.ring * T.ringStep, T.ringsStart + tile.ring * T.ringStep + 0.4));
    if (appear <= 0) continue;
    let sx = W / 2 + tile.i * PITCH_X * s, sy = H / 2 + tile.j * PITCH_Y * s;
    if (sx < -300 || sx > W + 300 || sy < -250 || sy > H + 250) { if (col <= 0) continue; }
    sx = lerp(sx, W / 2, conv); sy = lerp(sy, LOCK_Y, conv);
    withAlpha(ctx, clamp(appear * 2), () => {
      if (col <= 0) {
        const sc = s * lerp(0.9, 1, appear);
        ctx.save(); ctx.translate(sx, sy); ctx.scale(sc, sc);
        if (tile.hero) gameCard(ctx, -CARD_W / 2, -CARD_H / 2, HERO, heroState(t), true);
        else gameCard(ctx, -CARD_W / 2, -CARD_H / 2, tile.d, {
          slot: (k) => (k < tile.have ? 1 : 0), count: tile.have,
          gameOn: tile.have >= tile.d.need ? 1 : 0,
          waitLabel: `Join  ·  ${tile.d.need - tile.have} spots left`,
        }, true);
        ctx.restore();
      } else {
        // card -> dot
        const w = lerp(CARD_W * s, 22, col), h = lerp(CARD_H * s, 22, col);
        const fill = tile.hero ? mix(C.paper, C.brand, col) : mix(C.paper, tile.d.color, col);
        rr(ctx, sx - w / 2, sy - h / 2, w, h, lerp(40 * s, 11, col));
        ctx.fillStyle = fill; ctx.fill();
      }
    });
  }
  // caption
  const cin = p(t, T.caption[0], T.caption[0] + 0.45);
  const cout = eIn(p(t, T.caption[1], T.caption[1] + 0.25));
  withAlpha(ctx, clamp(cin * 3) * (1 - cout), () => {
    const sc = lerp(0.94, 1, spring(cin)) * lerp(1, 0.96, cout);
    ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(sc, sc);
    ctx.shadowColor = 'rgba(12,18,34,0.18)'; ctx.shadowBlur = 80; ctx.shadowOffsetY = 24;
    rr(ctx, -560, -150, 1120, 300, 48); ctx.fillStyle = C.paper; ctx.fill();
    ctx.shadowColor = 'transparent';
    const a = 'Games near you. ', b = 'Every night.';
    const wa = measure(ctx, a, DISPLAY(80), -2), wb = measure(ctx, b, DISPLAY(80), -2);
    text(ctx, a, -(wa + wb) / 2, 10, DISPLAY(80), C.ink, 'left', -2);
    text(ctx, b, -(wa + wb) / 2 + wa, 10, DISPLAY(80), C.brand, 'left', -2);
    text(ctx, 'Football  ·  Basketball  ·  Volleyball  ·  Padel  ·  Running', 0, 80, MED(30), C.ink3, 'center');
    ctx.restore();
  });
}

/* =================================================================== */
/*  compose                                                            */
/* =================================================================== */
export function draw(ctx, t, A) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;

  // background: navy until the drop, then daylight floods out of the dot
  ctx.fillStyle = C.navy; ctx.fillRect(0, 0, W, H);
  if (t < T.drop) {
    const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, 900);
    g.addColorStop(0, 'rgba(59,130,246,0.10)'); g.addColorStop(1, 'rgba(59,130,246,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  const flood = eOut(p(t, T.drop, T.drop + 0.85));
  if (t >= T.drop) {
    const R = 40 + flood * 1200;
    ctx.beginPath(); ctx.arc(W / 2, H / 2, R, 0, Math.PI * 2); ctx.fillStyle = C.canvas; ctx.fill();
    if (flood < 1) {
      ctx.beginPath(); ctx.arc(W / 2, H / 2, R, 0, Math.PI * 2);
      ctx.strokeStyle = C.brand2; ctx.lineWidth = lerp(18, 2, flood); ctx.stroke();
      withAlpha(ctx, 1 - flood, () => {
        ctx.beginPath(); ctx.arc(W / 2, H / 2, R * 0.7, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(59,130,246,0.35)'; ctx.lineWidth = 3; ctx.stroke();
      });
    }
  }

  actChat(ctx, t, A);

  // Act 2 — mark
  if (t >= T.drop && t < T.toProduct[1] + 0.05) {
    const o = { cy: H / 2, split: T.split, logoIn: T.logoIn, wordIn: T.wordIn, pulseAt: T.drop };
    const x = eInOut(p(t, T.toProduct[0], T.toProduct[1]));
    if (x <= 0) lockup(ctx, t, A, o);
    else {
      // lockup -> the group's avatar in the heatmap header
      const g = lockupGeom(ctx, t, o);
      const size = lerp(TILE, 76, x);
      const cx = lerp(g.cx, 140 + 38, x), cy = lerp(g.cy, 150, x);
      drawTile(ctx, A.icon, cx, cy, size);
      withAlpha(ctx, 1 - p(t, T.toProduct[0], T.toProduct[0] + 0.25), () => {
        const wx = g.cx + TILE / 2 + g.gap;
        const wp = measure(ctx, 'Play', DISPLAY(150), -3);
        text(ctx, 'Play', wx, g.cy + 52 - 40 * x, DISPLAY(150), C.ink, 'left', -3);
        text(ctx, 'Pals', wx + wp, g.cy + 52 - 40 * x, DISPLAY(150), C.brand, 'left', -3);
      });
    }
  }
  if (t >= T.toProduct[1] + 0.05 && t < T.morph[0] + 0.3) {
    withAlpha(ctx, 1 - p(t, T.tap + 0.1, T.tap + 0.4), () => drawTile(ctx, A.icon, 178, 150, 76));
  }
  // the dot leaves the mark and drops into Thursday 19:00
  if (t >= T.dotFly[0] && t < T.dotFly[1]) {
    const u = eInOut(p(t, T.dotFly[0], T.dotFly[1]));
    const g = lockupGeom(ctx, T.dotFly[0], { cy: H / 2, wordIn: T.wordIn });
    const x = eInOut(p(T.dotFly[0], T.toProduct[0], T.toProduct[1]));
    const size = lerp(TILE, 76, x);
    const sx = lerp(g.cx, 178, x) + RDOT[0] * size, sy = lerp(g.cy, 150, x) + RDOT[1] * size;
    const [bx, by] = bestCenter();
    const cx = lerp(sx, bx, u), cy = lerp(sy, by, u) - Math.sin(Math.PI * u) * 260;
    circle(ctx, cx, cy, lerp(LDOT_R * size, 14, u) + 6 * Math.sin(Math.PI * u), C.brand);
  }

  actHeatmap(ctx, t, A);
  actCard(ctx, t);
  actGrid(ctx, t);

  // Act 7 — one dot again, then the lockup
  if (t >= T.merge) {
    const o = {
      cy: LOCK_Y, split: T.split2, logoIn: T.logo2In, wordIn: T.word2In, pulseAt: T.merge, ticks: T.ticks,
    };
    const g = lockup(ctx, t, A, o);
    const a1 = eOut(p(t, T.tagline[0], T.tagline[0] + 0.35));
    const a2 = eOut(p(t, T.tagline[1], T.tagline[1] + 0.35));
    const s1 = 'One tap. ', s2 = 'Game on.';
    const w1 = measure(ctx, s1, DISPLAY(84), -2), w2 = measure(ctx, s2, DISPLAY(84), -2);
    const x0 = W / 2 - (w1 + w2) / 2;
    withAlpha(ctx, a1, () => text(ctx, s1, x0, 740 + 30 * (1 - a1), DISPLAY(84), C.ink, 'left', -2));
    withAlpha(ctx, a2, () => text(ctx, s2, x0 + w1, 740 + 30 * (1 - a2), DISPLAY(84), C.brand, 'left', -2));
    const a3 = eOut(p(t, T.sub, T.sub + 0.4));
    withAlpha(ctx, a3, () => text(ctx, 'Free on iOS & Android  ·  Utrecht & Amsterdam', W / 2, 830 + 20 * (1 - a3), MED(44), C.ink3, 'center'));
    void g;
  }
}
