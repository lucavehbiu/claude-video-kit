// PlayPals reel — 9:16, modular. Each section is a self-contained beat (whole bars at
// 120 BPM) that starts and ends on the blue dot at the centre of the frame, so any
// subset, in any order, cuts together: the engine implodes the outgoing section into
// the dot and reveals the next one out of it. A cut is just a list of section ids.
//
// Every product claim is something the app does today (see README "What's real").
// Screens are real iOS captures; pop-out cards reuse the app's own copy.
import {
  C, DISPLAY, BOLD, MED, MEMBERS, clamp, lerp, p, eOut, eIn, eInOut, eOut5, spring, pulse, rng, mix,
  rr, circle, text, measure, runs, check, star, avatar, withAlpha, shadow, noShadow,
} from './lib.js';

export const RW = 1080, RH = 1920, RFPS = 30;
const CX = RW / 2, CY = 960; // the dot's home
const L = 72; // left text edge (inside the 65px Meta side margin)
const IN = 0.45, OUT = 0.4, PUSH = 0.4; // transition lengths

/* ---------------- shared pieces ---------------- */
function headline(ctx, lt, t0, cap, lines, o = {}) {
  const y0 = o.y ?? 330, size = o.size ?? 92, gap = o.gap ?? size * 1.04, dark = o.dark;
  const k0 = eOut(p(lt, t0, t0 + 0.35));
  if (cap && o.problem) withAlpha(ctx, k0, () => {
    // the problem we solve, in coral, struck through as the answer lands under it
    const x = o.x ?? L, y = y0 + 16 * (1 - k0);
    text(ctx, cap, x, y, BOLD(44), C.coralDeep);
    const st = eOut(p(lt, t0 + 0.35, t0 + 0.65));
    if (st > 0) { ctx.beginPath(); ctx.moveTo(x, y - 15); ctx.lineTo(x + measure(ctx, cap, BOLD(44)) * st, y - 15); ctx.strokeStyle = C.coralDeep; ctx.lineWidth = 4; ctx.stroke(); }
  });
  else if (cap) withAlpha(ctx, k0, () => text(ctx, cap, o.x ?? L, y0 + 16 * (1 - k0), BOLD(28), dark ? C.brand2 : C.brand, o.align ?? 'left', 4));
  const d0 = o.problem ? 0.4 : 0.1;
  lines.forEach((parts, i) => {
    const k = eOut(p(lt, t0 + d0 + i * 0.12, t0 + d0 + 0.4 + i * 0.12));
    withAlpha(ctx, k, () => runs(ctx, parts.map(([s, c]) => [s, c ?? (dark ? C.inkD : C.ink)]),
      o.x ?? L, y0 + 100 + i * gap + 30 * (1 - k), DISPLAY(size), -2, o.align ?? 'left'));
  });
}
function headlineOut(lt, a, b) { return 1 - eIn(p(lt, a, b)); }

// iPhone mockup around a real capture. Returns geometry + a screenshot->canvas mapper.
function phoneGeom(cx = CX, top = 560, w = 620) {
  const bez = 13, s = (w - 2 * bez) / 1320;
  const g = { x: cx - w / 2, y: top, w, h: 2868 * s + 2 * bez, s, bez };
  g.at = (xs, ys) => [g.x + bez + xs * s, g.y + bez + ys * s];
  return g;
}
function drawPhone(ctx, img, g) {
  ctx.save();
  shadow(ctx, 80, 30, 0.22);
  rr(ctx, g.x, g.y, g.w, g.h, g.w * 0.15); ctx.fillStyle = '#0c1222'; ctx.fill();
  noShadow(ctx);
  rr(ctx, g.x + 3, g.y + 3, g.w - 6, g.h - 6, g.w * 0.15 - 3); ctx.strokeStyle = '#2b3448'; ctx.lineWidth = 2; ctx.stroke();
  rr(ctx, g.x + g.bez, g.y + g.bez, g.w - 2 * g.bez, g.h - 2 * g.bez, g.w * 0.15 - g.bez); ctx.clip();
  ctx.drawImage(img, g.x + g.bez, g.y + g.bez, 1320 * g.s, 2868 * g.s);
  ctx.restore();
}
// phone rises in over the first half-second of a section
const rise = (lt, t0 = 0.05) => 140 * (1 - eOut5(p(lt, t0, t0 + 0.6)));

function camera(ctx, s, fx, fy, tx, ty) {
  ctx.translate(tx, ty); ctx.scale(s, s); ctx.translate(-fx, -fy);
}

function finger(ctx, lt, x, y, tap) {
  const u = eOut(p(lt, tap - 0.4, tap - 0.08));
  if (u <= 0 || lt > tap + 0.55) return;
  const press = pulse(p(lt, tap, tap + 0.25));
  const fx = lerp(x + 150, x, u), fy = lerp(y + 190, y, u);
  withAlpha(ctx, u * (1 - p(lt, tap + 0.2, tap + 0.45)), () => {
    const r = 44 * (1 - 0.2 * press);
    circle(ctx, fx, fy, r, 'rgba(12,18,34,0.18)');
    ctx.beginPath(); ctx.arc(fx, fy, r, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 4; ctx.stroke();
  });
  const rip = p(lt, tap, tap + 0.5);
  if (rip > 0 && rip < 1) withAlpha(ctx, 1 - rip, () => {
    ctx.beginPath(); ctx.arc(x, y, 30 + 90 * eOut(rip), 0, Math.PI * 2); ctx.strokeStyle = C.brand2; ctx.lineWidth = 4; ctx.stroke();
  });
}
const press = (lt, tap) => 1 - 0.05 * pulse(p(lt, tap, tap + 0.25));

// iOS-style push banner. k = entrance 0..1
function banner(ctx, A, y, k, title, body, o = {}) {
  if (k <= 0) return;
  const x = o.x ?? 50, w = o.w ?? RW - 100, h = 164;
  withAlpha(ctx, clamp(k * 3) * (o.alpha ?? 1), () => {
    ctx.save();
    ctx.translate(0, -70 * (1 - eOut5(k)));
    shadow(ctx, 50, 16, 0.18);
    rr(ctx, x, y, w, h, 34); ctx.fillStyle = 'rgba(255,255,255,0.97)'; ctx.fill();
    noShadow(ctx);
    ctx.save(); rr(ctx, x + 26, y + 33, 84, 84, 20); ctx.clip(); ctx.drawImage(A.icon, x + 26, y + 33, 84, 84); ctx.restore();
    text(ctx, 'PLAYPALS', x + 132, y + 50, BOLD(20), C.ink4, 'left', 2);
    text(ctx, 'now', x + w - 30, y + 50, MED(22), C.ink4, 'right');
    text(ctx, title, x + 132, y + 94, BOLD(38), C.ink);
    text(ctx, body, x + 132, y + 136, MED(32), C.ink3);
    ctx.restore();
  });
}

function button(ctx, x, y, w, h, label, fill, color, o = {}) {
  rr(ctx, x, y, w, h, h / 2); ctx.fillStyle = fill; ctx.fill();
  if (o.check) {
    const tw = measure(ctx, label, BOLD(o.size ?? 32));
    check(ctx, x + w / 2 - tw / 2 - 22, y + h / 2 - 2, 22, color, 5);
    text(ctx, label, x + w / 2 + 16, y + h / 2 + 11, BOLD(o.size ?? 32), color, 'center');
  } else text(ctx, label, x + w / 2, y + h / 2 + 11, BOLD(o.size ?? 32), color, 'center');
}

function card(ctx, x, y, w, h, o = {}) {
  ctx.save();
  shadow(ctx, o.blur ?? 70, o.dy ?? 24, o.a ?? 0.16);
  rr(ctx, x, y, w, h, o.r ?? 40); ctx.fillStyle = o.fill ?? C.paper; ctx.fill();
  ctx.restore();
}

// pop-out: grows out of a point on the phone into its resting rect
function popOut(ctx, lt, t0, from, to, draw) {
  const u = p(lt, t0, t0 + 0.5);
  if (u <= 0) return;
  const s = lerp(0.25, 1, spring(u));
  const cx = lerp(from[0], to[0] + to[2] / 2, eOut(u)), cy = lerp(from[1], to[1] + to[3] / 2, eOut(u));
  withAlpha(ctx, clamp(u * 4), () => {
    ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s); ctx.translate(-to[2] / 2, -to[3] / 2);
    draw(to[2], to[3]);
    ctx.restore();
  });
}

function slots(ctx, x, y, w, need, filled, appear, members, r = 30) {
  const sp = w / need;
  for (let i = 0; i < need; i++) {
    const cx = x + sp / 2 + i * sp;
    circle(ctx, cx, y, r, C.wash);
    const u = appear(i);
    if (u > 0 && i < filled + 1) {
      const s = lerp(0.4, 1, spring(u));
      ctx.save(); ctx.translate(cx, y - 110 * (1 - eOut5(u))); ctx.scale(s, s); ctx.globalAlpha *= clamp(u * 4);
      avatar(ctx, 0, 0, r, members[i % members.length]);
      ctx.restore();
    }
  }
}

/* =================================================================== */
/*  SECTIONS                                                            */
/* =================================================================== */
const S = {};

/* ---------- chat: 47 messages, no game (pain: messaging) ---------- */
const CHAT = [
  [3, 'anyone playing this week?'], [5, 'me'], [9, 'same, been ages'], [1, "let's do Sunday"],
  [7, "football this week?"], [4, 'yes pls'], [0, 'down'],
  [1, '5-a-side Sunday?'], [2, 'yes!!'], [3, 'in'], [4, 'what time?'], [1, '10ish?'],
  [2, "can't do mornings"], [5, 'afternoon then?'], [0, 'works for me'],
  [6, "I'm out Sunday. Sat?"], [3, 'sat is bad for me'], [4, "who's booking?"],
  [1, 'anyone??'], [7, 'how many are we'], [5, '6 maybe'], [2, 'need 10 tho'],
  [0, 'ask your uni friends?'], [8, "they're busy"], [6, 'next week then?'], [9, "wait what's happening"],
  [7, 'is it still on?'],
  [2, '?'], [3, 'maybe'], [8, "can't"], [7, 'sorry guys'], [4, 'next week?'], [9, "who's in?"],
  [5, 'lol'], [1, 'which pitch?'], [6, "I'll check"], [3, '6 or 7?'], [8, 'too cold'],
  [9, 'is it indoor?'], [5, 'bump'], [4, 'pitch is fully booked'],
];
const range = (a, b, st) => { const o = []; for (let t = a; t <= b + 1e-9; t += st) o.push(+t.toFixed(4)); return o; };
const CHAT_T = [-5.0, -4.5, -4.0, -3.5, -3.0, -2.5, -2.0, -1.5, -1.0, -0.5, -0.25, ...range(0.5, 2, 0.5), ...range(2.25, 3, 0.25), ...range(3.125, 4, 0.125), ...range(4.125, 5, 0.0625)].map((t) => (t < 0 ? t : +(t * 0.6).toFixed(4))); // pile-on compressed: the punchline lands at 3s
const COLUMN = 27;

// A generic messenger, light mode, inside the phone. Deliberately not PlayPals (the pain
// lives in everyone's group chat app) and not any real messenger's branding.
const MSG = { bg: '#ffffff', them: '#e9e9eb', me: C.brand, ink: '#111111', sub: '#8a8a8e', line: '#e5e5ea' };
const CP = phoneGeom(CX, 478, 640); // chat phone — the whole phone stays on screen
const SX = CP.x + CP.bez, SY = CP.y + CP.bez, SW = CP.w - 2 * CP.bez, SH = CP.h - 2 * CP.bez;
const BH = 98, BH_ME = 68, CHAT_BASE = SY + SH - 250; // bubble heights; newest bubble's bottom

function chatBubble(ctx, i, x, y, k, loose = false) {
  // (x, y) = bottom anchor: left edge for them, right edge for me. k = entrance 0..1
  const [who, msg] = CHAT[i];
  const me = who === 0;
  const w = Math.max(measure(ctx, msg, MED(32)), me ? 0 : measure(ctx, MEMBERS[who].n, BOLD(21))) + 48;
  const h = me ? BH_ME : BH;
  const s = lerp(0.9, 1, spring(k));
  ctx.save();
  ctx.globalAlpha *= clamp(k * 3);
  ctx.translate(x, y); ctx.scale(s, s);
  const bx = me ? -w : 62;
  if (!me) avatar(ctx, 24, -24, 24, MEMBERS[who]);
  if (loose) shadow(ctx, 30, 10, 0.35);
  rr(ctx, bx, -h, w, h, 30); ctx.fillStyle = me ? MSG.me : MSG.them; ctx.fill();
  noShadow(ctx);
  if (me) text(ctx, msg, bx + 24, -h + 45, MED(32), '#fff');
  else {
    text(ctx, MEMBERS[who].n, bx + 24, -h + 34, BOLD(21), mix(MEMBERS[who].c, '#000000', 0.15));
    text(ctx, msg, bx + 24, -h + 76, MED(32), MSG.ink);
  }
  ctx.restore();
}

function chatScreen(ctx, lt) {
  ctx.save();
  shadow(ctx, 90, 30, 0.45);
  rr(ctx, CP.x, CP.y, CP.w, CP.h, CP.w * 0.15); ctx.fillStyle = '#0c1222'; ctx.fill();
  noShadow(ctx);
  rr(ctx, CP.x + 3, CP.y + 3, CP.w - 6, CP.h - 6, CP.w * 0.15 - 3); ctx.strokeStyle = '#2b3448'; ctx.lineWidth = 2; ctx.stroke();
  rr(ctx, SX, SY, SW, SH, CP.w * 0.15 - CP.bez); ctx.clip();
  ctx.fillStyle = MSG.bg; ctx.fillRect(SX, SY, SW, SH);
  // messages: newest at the bottom, older ones pushed up as each lands
  const enter = CHAT_T.map((t0) => eOut(p(lt, t0, t0 + 0.22)));
  for (let i = COLUMN - 1; i >= 0; i--) {
    if (lt < CHAT_T[i]) continue;
    let push = 0;
    for (let j = i + 1; j < COLUMN; j++) push += ((CHAT[j][0] === 0 ? BH_ME : BH) + 14) * enter[j];
    const y = CHAT_BASE - push;
    if (y < SY + 150) continue;
    chatBubble(ctx, i, CHAT[i][0] === 0 ? SX + SW - 22 : SX + 18, y, p(lt, CHAT_T[i], CHAT_T[i] + 0.35));
  }
  // typing indicator row + input bar
  rr(ctx, SX + 80, CHAT_BASE + 26, 96, 56, 28); ctx.fillStyle = MSG.them; ctx.fill();
  for (let d = 0; d < 3; d++) circle(ctx, SX + 104 + d * 24, CHAT_BASE + 54 + Math.sin(lt * 9 - d * 0.9) * 4, 7, '#9a9aa0');
  ctx.fillStyle = MSG.bg; ctx.fillRect(SX, SY + SH - 140, SW, 140);
  ctx.fillStyle = MSG.line; ctx.fillRect(SX, SY + SH - 140, SW, 2);
  rr(ctx, SX + 30, SY + SH - 116, SW - 60, 64, 32); ctx.strokeStyle = MSG.line; ctx.lineWidth = 3; ctx.stroke();
  text(ctx, 'Message', SX + 62, SY + SH - 73, MED(28), '#b0b0b5');
  // header (drawn last so older bubbles slide under it)
  ctx.fillStyle = '#f9f9fb'; ctx.fillRect(SX, SY, SW, 200);
  ctx.fillStyle = MSG.line; ctx.fillRect(SX, SY + 200, SW, 2);
  text(ctx, '9:41', SX + 70, SY + 54, BOLD(28), MSG.ink);
  rr(ctx, CX - 100, SY + 20, 200, 52, 26); ctx.fillStyle = '#000'; ctx.fill();
  for (let b = 0; b < 4; b++) { rr(ctx, SX + SW - 150 + b * 12, SY + 52 - 6 - b * 5, 8, 10 + b * 5, 2); ctx.fillStyle = MSG.ink; ctx.fill(); }
  rr(ctx, SX + SW - 90, SY + 32, 46, 22, 6); ctx.strokeStyle = MSG.ink; ctx.lineWidth = 2.5; ctx.stroke();
  rr(ctx, SX + SW - 86, SY + 36, 34, 14, 3); ctx.fillStyle = MSG.ink; ctx.fill();
  ctx.beginPath(); ctx.moveTo(SX + 46, SY + 120); ctx.lineTo(SX + 30, SY + 136); ctx.lineTo(SX + 46, SY + 152);
  ctx.strokeStyle = MSG.me; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
  circle(ctx, CX - 170, SY + 136, 32, C.grass);
  text(ctx, 'SF', CX - 170, SY + 146, BOLD(24), '#fff', 'center');
  text(ctx, 'Sunday Football', CX - 122, SY + 130, BOLD(32), MSG.ink);
  const n = 47 - CHAT_T.filter((t0) => lt < t0).length;
  runs(ctx, [['12 members  ·  ', MSG.sub], [`${n} messages`, n >= 40 ? C.coralDeep : MSG.sub]], CX - 122, SY + 168, BOLD(23));
  ctx.restore();
}

S.chat = {
  dur: 4, bg: C.navy, beds: [[0, 4, 'tension']], badge: 3.0,
  cues: [
    ...CHAT_T.filter((t) => t >= 0).map((t) => [t, 'pop', t >= 2.46 ? 1 : 0]),
    [0.6, 'riser', 2.8], [3.0, 'hit', 0], [3.3, 'hit', 1],
  ],
  draw(ctx, lt) {
    // the catchphrase, on frame 1
    runs(ctx, [['Your group chat ', C.inkD], ["isn't", C.coral]], L, 340, DISPLAY(78), -2);
    runs(ctx, [['a sports app.', C.inkD]], L, 426, DISPLAY(78), -2);
    chatScreen(ctx, lt);
    {
      // the pile-on breaks out of the phone
      const r = rng(7);
      for (let i = COLUMN; i < CHAT.length; i++) {
        const x = lerp(20, 560, r()), y = lerp(620, 1760, r()), rot = lerp(-0.14, 0.14, r()), sc = lerp(1.05, 1.45, r());
        if (lt < CHAT_T[i]) continue;
        ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(sc, sc);
        chatBubble(ctx, i, 0, 0, p(lt, CHAT_T[i], CHAT_T[i] + 0.3), true);
        ctx.restore();
      }
    }
    // knock it all back behind the headline (a navy veil, not alpha: a translucent phone reads as grey)
    withAlpha(ctx, 0.86 * eOut(p(lt, 3.0, 3.2)), () => { ctx.fillStyle = C.navy; ctx.fillRect(0, 0, RW, RH); });
    // the typing dots fly out of the phone and become THE dot
    const fly = eInOut(p(lt, 3.25, 3.55));
    if (fly > 0) for (let d = 0; d < 3; d++) {
      const x = lerp(SX + 104 + d * 24, CX, fly), y = lerp(CHAT_BASE + 54, CY, fly);
      circle(ctx, x, y, lerp(7, 18, fly), mix('#9a9aa0', C.brand2, fly));
    }
    const l1 = eOut(p(lt, 3.0, 3.2)), l2 = eOut(p(lt, 3.3, 3.5));
    withAlpha(ctx, l1, () => text(ctx, '47 messages.', CX, 760 + 40 * (1 - l1), DISPLAY(124), C.inkD, 'center', -3));
    withAlpha(ctx, l2, () => text(ctx, 'No game.', CX, 900 + 40 * (1 - l2), DISPLAY(124), C.coral, 'center', -3));
  },
};

/* ---------- dropouts: game day, three people leave (pain: cancellations) ---------- */
const LEAVERS = [[2, 0.3], [6, 1.0], [8, 1.7]]; // member index, time
S.dropouts = {
  dur: 6, bg: C.navy, beds: [[0, 6, 'tension']], lift: 120, badge: 2.8,
  cues: [...LEAVERS.map(([, t]) => [t, 'ding']), [3.0, 'hit', 0], [3.5, 'hit', 1]],
  draw(ctx, lt, A, o) {
    const oy = o.first ? 80 : 0; // room for the brand badge
    const out = headlineOut(lt, 2.8, 3.1);
    withAlpha(ctx, out, () => {
      const k = eOut(p(lt, 0.1, 0.45));
      withAlpha(ctx, k, () => text(ctx, 'GAME DAY', L, 330 + oy, BOLD(28), C.brand2, 'left', 4));
    });
    // banners stack: newest on top
    LEAVERS.forEach(([m, t], i) => {
      const k = p(lt, t, t + 0.45);
      const newer = LEAVERS.filter(([, t2]) => t2 > t).reduce((s, [, t2]) => s + eOut(p(lt, t2, t2 + 0.3)), 0);
      banner(ctx, A, 380 + oy + newer * 120, k, 'Participant Left', `${MEMBERS[m].n} left "Thursday 5-a-side"`,
        { alpha: out * (1 - 0.35 * clamp(newer)) });
    });
    // the game card (dark)
    const gone = (m) => { const l = LEAVERS.find(([q]) => q === m); return l ? eOut(p(lt, l[1] + 0.15, l[1] + 0.45)) : 0; };
    const n = 10 - LEAVERS.filter(([, t]) => lt >= t + 0.15).length;
    const cy = lerp(800, 1080, eInOut(p(lt, 2.8, 3.2)));
    ctx.save();
    rr(ctx, 60, cy, RW - 120, 400, 40); ctx.fillStyle = C.navyPaper; ctx.fill();
    text(ctx, 'Thursday 5-a-side', 110, cy + 100, DISPLAY(60), C.inkD, 'left', -1.5);
    text(ctx, 'Tonight 19:00  ·  Sportpark Transwijk', 110, cy + 152, MED(32), C.ink3D);
    text(ctx, `${n}/10`, RW - 110, cy + 100, DISPLAY(56), n === 10 ? '#4ade80' : C.coral, 'right');
    for (let i = 0; i < 10; i++) {
      const x = 110 + 40 + i * 84, y = cy + 270 + 120 * eIn(gone(i));
      withAlpha(ctx, 1 - gone(i) * 0.9, () => avatar(ctx, x, y, 36, MEMBERS[i]));
      if (gone(i) > 0) withAlpha(ctx, gone(i), () => { ctx.beginPath(); ctx.arc(x, cy + 270, 36, 0, Math.PI * 2); ctx.setLineDash([6, 6]); ctx.strokeStyle = C.ink4D; ctx.lineWidth = 3; ctx.stroke(); ctx.setLineDash([]); });
    }
    ctx.restore();
    const l1 = eOut(p(lt, 3.0, 3.3)), l2 = eOut(p(lt, 3.5, 3.8));
    withAlpha(ctx, l1, () => text(ctx, '3 dropouts.', CX, 640 + 40 * (1 - l1), DISPLAY(124), C.inkD, 'center', -3));
    withAlpha(ctx, l2, () => text(ctx, 'Game off.', CX, 780 + 40 * (1 - l2), DISPLAY(124), C.coral, 'center', -3));
  },
};

/* ---------- newcity: alone in a new city -> the map lights up ---------- */
// map.jpg pins, in capture coordinates (1320x2868)
const MAP_PINS = [[471, 1043], [831, 1089], [471, 1315], [715, 1481], [545, 1717], [369, 1892], [300, 2063]];
const MAP_YOU = [660, 1666];
const mapCover = (xs, ys, z = 1) => {
  const s = (1920 / 1800) * z;
  return [CX + (xs - 660) * s, CY + (ys - 1500) * s];
};
S.newcity = {
  dur: 6, bg: C.navy, beds: [[0, 1.2, 'tension'], [1.2, 6, 'calm']], badge: 1.2,
  cues: [[0.3, 'ping'], [0.6, 'ping'], [0.9, 'ping'], [1.2, 'reveal'], ...MAP_PINS.map((_, i) => [1.6 + i * 0.125, 'pluck', i]), [1.9, 'bell', 0]],
  draw(ctx, lt, A) {
    const rev = eOut(p(lt, 1.2, 1.9));
    const z = lerp(1.35, 1.15, eOut(p(lt, 1.2, 4.6)));
    if (rev > 0) {
      ctx.save();
      ctx.beginPath(); ctx.arc(CX, CY, rev * 1400, 0, Math.PI * 2); ctx.clip();
      const s = (1920 / 1800) * z;
      ctx.drawImage(A.shots.map, CX - 660 * s, CY - 1500 * s, 1320 * s, 2868 * s);
      ctx.fillStyle = 'rgba(247,248,250,0.18)'; ctx.fillRect(0, 0, RW, RH);
      // pins pop
      MAP_PINS.forEach(([xs, ys], i) => {
        const u = p(lt, 1.6 + i * 0.125, 2.1 + i * 0.125);
        if (u <= 0) return;
        const [x, y] = mapCover(xs, ys, z);
        withAlpha(ctx, 1 - u, () => { ctx.beginPath(); ctx.arc(x, y, 30 + 70 * eOut(u), 0, Math.PI * 2); ctx.strokeStyle = C.brand; ctx.lineWidth = 5; ctx.stroke(); });
      });
      ctx.restore();
    }
    // the dot: you, alone, then your spot on the map
    const [yx, yy] = mapCover(...MAP_YOU, z);
    const go = eInOut(p(lt, 1.3, 1.9));
    const dx = lerp(CX, yx, go), dy = lerp(CY, yy, go);
    if (lt < 1.3) for (const s0 of [0.3, 0.6, 0.9]) {
      const u = p(lt, s0, s0 + 1.0);
      if (u > 0 && u < 1) withAlpha(ctx, (1 - u) * 0.8, () => { ctx.beginPath(); ctx.arc(CX, CY, 20 + 420 * eOut(u), 0, Math.PI * 2); ctx.strokeStyle = C.brand2; ctx.lineWidth = 3; ctx.stroke(); });
    }
    circle(ctx, dx, dy, 18 + 4 * Math.sin(lt * 4) * (1 - go), C.brand2);
    if (go > 0) { ctx.beginPath(); ctx.arc(dx, dy, 18, 0, Math.PI * 2); ctx.strokeStyle = '#fff'; ctx.lineWidth = 5 * go; ctx.stroke(); }
    // copy: lonely -> live proof (real copy from the first-run screen)
    const o1 = 1 - eIn(p(lt, 1.0, 1.3));
    withAlpha(ctx, o1, () => {
      const a = eOut(p(lt, 0.0, 0.3)), b = eOut(p(lt, 0.3, 0.6));
      withAlpha(ctx, a, () => text(ctx, 'New in town?', CX, 600 + 30 * (1 - a), DISPLAY(104), C.inkD, 'center', -2.5));
      withAlpha(ctx, b, () => text(ctx, 'No one to play with.', CX, 690 + 20 * (1 - b), MED(48), C.ink3D, 'center'));
    });
    const k = p(lt, 1.8, 2.3);
    withAlpha(ctx, clamp(k * 3), () => {
      const s = lerp(0.94, 1, spring(k));
      ctx.save(); ctx.translate(CX, 430); ctx.scale(s, s);
      card(ctx, -470, -150, 940, 330, { r: 44 });
      text(ctx, 'LIVE RIGHT NOW', -420, -80, BOLD(26), C.brand, 'left', 4);
      runs(ctx, [['There are ', C.ink], ['22 games', C.brand]], -420, 10, DISPLAY(74), -2);
      runs(ctx, [['in ', C.ink], ['Utrecht', C.brand], [' this week.', C.ink]], -420, 92, DISPLAY(74), -2);
      ctx.restore();
    });
  },
};

/* ---------- lockup (brand + end) ---------- */
const TILE = 300;
const LDOT = [(195 - 256) / 512, (257 - 256) / 512], RDOT = [(322 - 256) / 512, (257 - 256) / 512], LDOT_R = 17 / 512;
function drawTile(ctx, img, cx, cy, size, a = 1) {
  withAlpha(ctx, a, () => {
    const r = size * 0.225;
    ctx.save(); shadow(ctx, size * 0.16, size * 0.05, 0.14);
    rr(ctx, cx - size / 2, cy - size / 2, size, size, r); ctx.fillStyle = '#eef2f6'; ctx.fill(); ctx.restore();
    ctx.save(); rr(ctx, cx - size / 2, cy - size / 2, size, size, r); ctx.clip();
    ctx.drawImage(img, cx - size / 2, cy - size / 2, size, size); ctx.restore();
  });
}
function lockupV(ctx, lt, A, o) {
  const ty = o.tileY;
  const move = eInOut(p(lt, 0.0, o.split[0]));
  const sp = eInOut(p(lt, o.split[0], o.split[1]));
  const tileIn = eOut(p(lt, o.logoIn, o.logoIn + 0.35));
  const tick = (o.ticks || []).reduce((s, tk) => s + pulse(p(lt, tk, tk + 0.4)), 0);
  const size = TILE * (0.96 + 0.04 * tileIn) * (1 + 0.06 * tick);
  if (lt >= o.logoIn) drawTile(ctx, A.icon, CX, ty, size, tileIn);
  const dotA = 1 - p(lt, o.logoIn + 0.15, o.logoIn + 0.4);
  if (dotA > 0) {
    const cy = lerp(CY, ty, move);
    const r = lerp(18 * (1 + 0.6 * pulse(p(lt, 0, 0.45))), LDOT_R * TILE, sp);
    const col = mix(C.brand2, C.logoDot, p(lt, o.logoIn - 0.1, o.logoIn + 0.3));
    withAlpha(ctx, dotA, () => {
      circle(ctx, CX + LDOT[0] * TILE * sp, cy + LDOT[1] * TILE * sp, r, col);
      circle(ctx, CX + RDOT[0] * TILE * sp, cy + RDOT[1] * TILE * sp, r, col);
    });
  }
  const wi = eOut(p(lt, o.wordIn, o.wordIn + 0.45));
  withAlpha(ctx, wi, () => runs(ctx, [['Play', C.ink], ['Pals', C.brand]], CX, ty + 300 + 40 * (1 - wi), DISPLAY(150), -3, 'center'));
}
S.brand = {
  dur: 4, bg: C.canvas, beds: [[0, 4, 'calm']],
  cues: [[0, 'drop'], [0.3, 'pluck', 2], [0.55, 'pluck', 5], [0.75, 'bell', 1], [1.3, 'whoosh'], [2.0, 'pluck', 3]],
  draw(ctx, lt, A) {
    lockupV(ctx, lt, A, { tileY: 700, split: [0.3, 0.7], logoIn: 0.75, wordIn: 1.35 });
    const k = eOut(p(lt, 2.0, 2.4));
    withAlpha(ctx, k, () => text(ctx, 'Pickup sports in your city.', CX, 1130 + 20 * (1 - k), MED(44), C.ink3, 'center'));
  },
};
S.end = {
  dur: 4, bg: C.canvas, beds: [[0, 4, 'resolve']], last: true,
  cues: [[0, 'drop'], [0.15, 'pluck', 2], [0.35, 'pluck', 5], [0.45, 'bell', 1], [0.8, 'whoosh'], [1.3, 'pluck', 0], [1.5, 'resolve'], [2.5, 'tick', 0], [3.0, 'tick', 1]],
  draw(ctx, lt, A) {
    lockupV(ctx, lt, A, { tileY: 640, split: [0.15, 0.45], logoIn: 0.45, wordIn: 0.85, ticks: [2.5, 3.0] });
    const a1 = eOut(p(lt, 1.3, 1.6)), a2 = eOut(p(lt, 1.5, 1.8)), a3 = eOut(p(lt, 1.8, 2.1));
    const w1 = measure(ctx, 'One tap. ', DISPLAY(88), -2), w2 = measure(ctx, 'Game on.', DISPLAY(88), -2);
    const x0 = CX - (w1 + w2) / 2;
    withAlpha(ctx, a1, () => text(ctx, 'One tap. ', x0, 1070 + 30 * (1 - a1), DISPLAY(88), C.ink, 'left', -2));
    withAlpha(ctx, a2, () => text(ctx, 'Game on.', x0 + w1, 1070 + 30 * (1 - a2), DISPLAY(88), C.brand, 'left', -2));
    withAlpha(ctx, a3, () => text(ctx, 'Free on iOS & Android', CX, 1166 + 20 * (1 - a3), MED(46), C.ink3, 'center'));
    withAlpha(ctx, a3, () => text(ctx, 'Utrecht & Amsterdam', CX, 1230 + 20 * (1 - a3), MED(46), C.ink3, 'center'));
  },
};

/* ---------- map: games near you ---------- */
const BIG_PIN = [369, 1892];
S.map = {
  dur: 6, bg: C.canvas, beds: [[0, 6, 'groove']], lift: 120,
  cues: [...MAP_PINS.map((_, i) => [0.7 + i * 0.125, 'pluck', i + 1]), [1.6, 'whoosh'], [2.1, 'tap'], [2.2, 'pluck', 5], [3.7, 'tap'], [3.75, 'stab', 0]],
  draw(ctx, lt, A) {
    headline(ctx, lt, 0.1, "Where's everyone playing?", [[['Games near you,']], [['tonight.', C.brand]]], { problem: true });
    const g = phoneGeom(CX, 600 + rise(lt));
    const pin0 = g.at(...BIG_PIN);
    // camera pushes in on the pin you're about to tap
    const k = eInOut(p(lt, 1.5, 2.0));
    const z = 1 + 0.45 * k, tx = lerp(pin0[0], CX - 120, k), ty = lerp(pin0[1], 1330, k);
    const at = (x, y) => [tx + (x - pin0[0]) * z, ty + (y - pin0[1]) * z];
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 600, RW, RH); ctx.clip();
    ctx.translate(tx, ty); ctx.scale(z, z); ctx.translate(-pin0[0], -pin0[1]);
    drawPhone(ctx, A.shots.map, g);
    MAP_PINS.forEach(([xs, ys], i) => {
      const u = p(lt, 0.7 + i * 0.125, 1.2 + i * 0.125);
      if (u <= 0 || u >= 1) return;
      const [x, y] = g.at(xs, ys);
      withAlpha(ctx, 1 - u, () => { ctx.beginPath(); ctx.arc(x, y, 14 + 40 * eOut(u), 0, Math.PI * 2); ctx.strokeStyle = C.brand; ctx.lineWidth = 4; ctx.stroke(); });
    });
    ctx.restore();
    const [px, py] = at(...pin0);
    // selected pin: a steady ring + pulse once it's been tapped
    const sel = eOut(p(lt, 2.1, 2.3));
    if (sel > 0) {
      ctx.beginPath(); ctx.arc(px, py - 20, 46 * sel, 0, Math.PI * 2); ctx.strokeStyle = C.brand; ctx.lineWidth = 6; ctx.stroke();
      const u = p(lt, 2.1, 3.0);
      if (u < 1) withAlpha(ctx, 1 - u, () => { ctx.beginPath(); ctx.arc(px, py - 20, 46 + 70 * eOut(u), 0, Math.PI * 2); ctx.strokeStyle = C.brand2; ctx.lineWidth = 4; ctx.stroke(); });
    }
    finger(ctx, lt, px, py - 20, 2.1);
    // the tapped event's card, a callout anchored to the pin
    const joined = eOut(p(lt, 3.7, 3.95));
    const box = [70, 780, RW - 140, 330];
    const u = p(lt, 2.2, 2.7);
    if (u > 0) withAlpha(ctx, clamp(u * 4), () => {
      const s2 = lerp(0.3, 1, spring(u));
      const ox = px, oy = py - 70; // grows out of the pin
      ctx.save(); ctx.translate(ox, oy); ctx.scale(s2, s2); ctx.translate(-ox, -oy);
      ctx.beginPath(); ctx.moveTo(px - 26, box[1] + box[3] - 2); ctx.lineTo(px, py - 70); ctx.lineTo(px + 26, box[1] + box[3] - 2); ctx.closePath();
      ctx.fillStyle = C.paper; ctx.fill();
      ctx.translate(box[0], box[1]);
      card(ctx, 0, 0, box[2], box[3], { r: 40, a: 0.22 });
      circle(ctx, 70, 78, 34, '#fde8e6'); circle(ctx, 70, 78, 13, C.coralDeep);
      text(ctx, 'Thursday Padel Doubles', 128, 72, BOLD(38), C.ink);
      text(ctx, 'Thu 19:00  ·  Peakz Padel Zeehaenkade', 128, 116, MED(28), C.ink3);
      const n = joined > 0.5 ? 7 : 6;
      text(ctx, `${n}/8 joined`, 44, 196, BOLD(30), C.ink2);
      rr(ctx, 230, 166, 190, 44, 22); ctx.fillStyle = C.grassTint; ctx.fill();
      text(ctx, `${8 - n} spot${8 - n === 1 ? '' : 's'} left`, 325, 197, BOLD(24), C.grass, 'center');
      ctx.save(); ctx.translate(box[2] / 2, 272); ctx.scale(press(lt, 3.7), press(lt, 3.7));
      button(ctx, -(box[2] - 88) / 2, -40, box[2] - 88, 80, joined > 0.5 ? "You're in" : 'Join', mix(C.brand, C.grass, joined), '#fff', { check: joined > 0.5 });
      ctx.restore();
      ctx.restore();
    });
    finger(ctx, lt, CX, box[1] + 272, 3.7);
  },

};

/* ---------- crew: pick your sports, find your group (similar interests) ---------- */
const SPORTS = ['Football', 'Padel', 'Basketball', 'Volleyball', 'Running', 'Tennis', 'Climbing', 'Yoga'];
const SPORT_ICON = [['⚽', '#dcfce7'], ['🎾', '#e0f2fe'], ['🏀', '#ffedd5'], ['🏐', '#fef9c3'], ['🏃', '#ede9fe'], ['🏸', '#fce7f3'], ['🧗', '#fee2e2'], ['🧘', '#ccfbf1']];
const PICKS = [[0, 0.9], [1, 1.3], [4, 1.7]];
S.crew = {
  dur: 6, bg: C.canvas, beds: [[0, 6, 'groove']], lift: 120,
  cues: [...PICKS.map(([, t], i) => [t, 'pluck', i + 2]), [2.5, 'whoosh'], [3.3, 'bell', 2], [4.4, 'tap'], [4.45, 'stab', 1]],
  draw(ctx, lt, A) {
    headline(ctx, lt, 0.1, 'New here, no one to play with?', [[['Find your crew.']]], { problem: true });
    const sub = eOut(p(lt, 0.7, 1.05));
    withAlpha(ctx, sub, () => text(ctx, 'Groups for every sport and level.', L, 500, MED(44), C.ink3));
    // phase A: "Pick your sports"
    const aOut = eInOut(p(lt, 2.3, 2.7));
    withAlpha(ctx, 1 - aOut, () => {
      ctx.save(); ctx.translate(0, -200 * aOut);
      card(ctx, 60, 600, RW - 120, 560, { r: 44 });
      text(ctx, 'Pick your sports', 110, 690, DISPLAY(52), C.ink, 'left', -1);
      SPORTS.forEach((s, i) => {
        const col = i % 2, row = Math.floor(i / 2);
        const x = 110 + col * 440, y = 740 + row * 98;
        const pick = PICKS.find(([q]) => q === i);
        const on = pick ? eOut(p(lt, pick[1], pick[1] + 0.2)) : 0;
        const sc = pick ? press(lt, pick[1]) : 1;
        ctx.save(); ctx.translate(x + 200, y + 38); ctx.scale(sc, sc);
        rr(ctx, -200, -38, 400, 76, 38); ctx.fillStyle = mix(C.wash, C.brand, on); ctx.fill();
        circle(ctx, -158, 0, 28, on > 0.5 ? '#ffffff' : SPORT_ICON[i][1]);
        ctx.textBaseline = 'middle'; text(ctx, SPORT_ICON[i][0], -158, 2, '30px sans-serif', '#000', 'center'); ctx.textBaseline = 'alphabetic';
        text(ctx, s, -112, 11, BOLD(32), on > 0.5 ? '#fff' : C.ink2);
        if (on > 0.5) check(ctx, 158, 0, 20, '#fff', 4);
        ctx.restore();
      });
      ctx.restore();
    });
    PICKS.forEach(([i, t]) => { const x = 110 + (i % 2) * 440 + 200, y = 740 + Math.floor(i / 2) * 98 + 38; finger(ctx, lt, x, y, t); });
    // phase B: the group (real capture)
    if (lt > 2.3) {
      const g = phoneGeom(CX, 600 + 900 * (1 - eOut5(p(lt, 2.4, 3.1))));
      drawPhone(ctx, A.shots.group, g);
      const hl = p(lt, 3.3, 4.0);
      if (hl > 0) {
        const [x0, y0] = g.at(40, 840), [x1, y1] = g.at(1280, 960);
        withAlpha(ctx, Math.min(1, hl * 3) * (1 - p(lt, 5.2, 5.6)), () => {
          rr(ctx, x0, y0, x1 - x0, y1 - y0, 20); ctx.strokeStyle = C.brand; ctx.lineWidth = 5; ctx.stroke();
        });
      }
      // "Join group" pop-out on the beat
      const [jx, jy] = g.at(660, 1000);
      popOut(ctx, lt, 3.8, [jx, jy], [140, 1180, RW - 280, 120], (w, h) => {
        const on = eOut(p(lt, 4.4, 4.6));
        ctx.save(); ctx.translate(w / 2, h / 2); ctx.scale(press(lt, 4.4), press(lt, 4.4));
        shadow(ctx, 40, 14, 0.2);
        button(ctx, -w / 2, -h / 2, w, h, on > 0.5 ? 'Joined' : 'Join group', mix(C.brand, C.grass, on), '#fff', { check: on > 0.5, size: 36 });
        ctx.restore();
      });
      finger(ctx, lt, CX, 1240, 4.4);
    }
  },
};

/* ---------- heatmap: when can everyone play? (real availability screen) ---------- */
S.heatmap = {
  dur: 6, bg: C.canvas, beds: [[0, 6, 'groove']], lift: 120,
  cues: [[1.4, 'whoosh'], ...range(1.9, 2.65, 0.125).map((t, i) => [t, 'pluck', i]), [3.0, 'tap'], [3.2, 'bell', 3], [4.5, 'tap'], [4.55, 'stab', 2]],
  draw(ctx, lt, A) {
    headline(ctx, lt, 0.1, '"When are you free?" × 20', [[["See when everyone's"]], [['free.', C.brand]]], { problem: true });
    const g = phoneGeom(CX, 640 + rise(lt));
    // camera: push into the heatmap, then back out to the Find a game button
    const zin = eInOut(p(lt, 1.4, 2.0)), zout = eInOut(p(lt, 2.7, 3.0));
    const z = 1 + 0.75 * zin - 0.75 * zout;
    const [fx, fy] = g.at(660, 2300);
    ctx.save();
    if (z > 1.001) { ctx.beginPath(); ctx.rect(0, 600, RW, RH); ctx.clip(); camera(ctx, z, fx, fy, lerp(fx, CX, zin - zout), lerp(fy, 1150, zin - zout)); }
    drawPhone(ctx, A.shots.availability, g);
    // scan across the busiest slots
    const scan = p(lt, 1.9, 2.8);
    if (scan > 0 && scan < 1) {
      const [x0, y0] = g.at(330, 2160 + scan * 300), [x1] = g.at(1290, 0);
      withAlpha(ctx, Math.sin(Math.PI * scan), () => { ctx.fillStyle = 'rgba(37,99,235,0.35)'; ctx.fillRect(x0, y0 - 24, x1 - x0, 48); });
    }
    ctx.restore();
    const btn = g.at(660, 1775);
    finger(ctx, lt, btn[0], btn[1], 3.0);
    const go = eOut(p(lt, 4.5, 4.7));
    popOut(ctx, lt, 3.2, btn, [70, 1060, RW - 140, 340], (w, h) => {
      card(ctx, 0, 0, w, h, { r: 40, a: 0.2 });
      text(ctx, 'PLAYPALS  ·  FIND A GAME', 48, 70, BOLD(24), C.brand, 'left', 4);
      runs(ctx, [['Game on', C.grass], [' — Thu 19:00', C.ink]], 48, 140, DISPLAY(54), -1.5);
      text(ctx, 'works for 10', 48, 192, MED(34), C.ink3);
      ctx.save(); ctx.translate(w / 2, 270); ctx.scale(press(lt, 4.5), press(lt, 4.5));
      button(ctx, -(w - 96) / 2, -42, w - 96, 84, go > 0.5 ? 'Game created' : 'Create this game', mix(C.brand, C.grass, go), '#fff', { check: go > 0.5 });
      ctx.restore();
    });
    finger(ctx, lt, CX, 1060 + 270, 4.5);
  },
};

/* ---------- rsvp: one tap, you're in (real event screen) ---------- */
const RSVP_T = [1.6, 2.1, 2.6];
S.rsvp = {
  dur: 6, bg: C.canvas, beds: [[0, 6, 'groove']], lift: 120,
  cues: [[1.0, 'tap'], [1.1, 'whoosh'], ...RSVP_T.map((t, i) => [t + 0.08, 'pluck', i + 4]), [3.2, 'ding'], [3.4, 'gameon']],
  draw(ctx, lt, A) {
    headline(ctx, lt, 0.1, "Chasing who's in?", [[['One tap. '], ["You're in.", C.brand]]], { problem: true });
    const g = phoneGeom(CX, 520 + rise(lt));
    drawPhone(ctx, A.shots.event, g);
    const jb = g.at(660, 2690);
    finger(ctx, lt, jb[0], jb[1] - 4, 1.0);
    const n = 11 + RSVP_T.filter((t) => lt >= t + 0.1).length;
    const full = eOut(p(lt, 3.4, 3.6));
    popOut(ctx, lt, 1.1, jb, [70, 760, RW - 140, 430], (w, h) => {
      card(ctx, 0, 0, w, h, { r: 40, a: 0.2 });
      text(ctx, 'SOCCER  ·  FREE  ·  PUBLIC', 48, 68, BOLD(24), C.brand, 'left', 3);
      text(ctx, '7-a-side at Cruyff Court', 48, 132, DISPLAY(50), C.ink, 'left', -1.2);
      text(ctx, 'Fri 20:00  ·  Ondiep, Utrecht', 48, 180, MED(30), C.ink3);
      text(ctx, 'Players', 48, 246, BOLD(30), C.ink2);
      text(ctx, `${n}/14`, w - 48, 250, DISPLAY(44), n === 14 ? C.grass : C.ink, 'right');
      const crew = [MEMBERS[0], MEMBERS[3], MEMBERS[9]];
      for (let i = 0; i < 6; i++) {
        const x = 48 + 34 + i * 82;
        if (i < 3) avatar(ctx, x, 316, 32, MEMBERS[[1, 4, 7][i]]);
        else {
          const k = i - 3, u = p(lt, RSVP_T[k], RSVP_T[k] + 0.45);
          circle(ctx, x, 316, 32, C.wash);
          if (u > 0) { ctx.save(); ctx.translate(x, 316 - 90 * (1 - eOut5(u))); const s = lerp(0.4, 1, spring(u)); ctx.scale(s, s); ctx.globalAlpha *= clamp(u * 4); avatar(ctx, 0, 0, 32, crew[k]); ctx.restore(); }
        }
      }
      text(ctx, '+8', 48 + 34 + 6 * 82, 327, BOLD(30), C.ink3, 'center');
      ctx.save(); ctx.translate(w - 160, 316);
      rr(ctx, -110, -34, 220, 68, 34); ctx.fillStyle = mix(C.brandTint, C.grass, full); ctx.fill();
      text(ctx, full > 0.5 ? 'Game on' : 'Joined', full > 0.5 ? 12 : 0, 10, BOLD(28), full > 0.5 ? '#fff' : C.brand, 'center');
      if (full > 0.5) check(ctx, -62, -2, 18, '#fff', 4);
      ctx.restore();
    });
    banner(ctx, A, 1230, p(lt, 3.2, 3.65), 'Event Full 🎉', '"7-a-side at Cruyff Court" is full', { alpha: 1 - p(lt, 5.2, 5.5) });
    confetti(ctx, lt - 3.4, CX, 1100);
  },
};
function confetti(ctx, u, x0, y0) {
  if (u <= 0 || u >= 1.2) return;
  const r = rng(9), cols = [C.brand, C.grass, C.coral, C.amber, '#8b5cf6'];
  for (let i = 0; i < 40; i++) {
    const ang = lerp(-Math.PI * 0.92, -Math.PI * 0.08, r()), sp = lerp(800, 1600, r());
    const x = x0 + lerp(-250, 250, r()) + Math.cos(ang) * sp * u, y = y0 + Math.sin(ang) * sp * u + 2200 * u * u;
    const rot = r() * 6 + u * lerp(-12, 12, r());
    withAlpha(ctx, 1 - p(u, 0.7, 1.2), () => { ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.fillStyle = cols[i % 5]; rr(ctx, -11, -6, 22, 12, 3); ctx.fill(); ctx.restore(); });
  }
}

/* ---------- refill: someone drops -> the spot is auto-posted nearby -> filled ----------
   NOTE: advertises the auto-post spec'd in tasks/dropout-refill-and-leave-notifications.md.
   It must ship before this section runs in paid ads. */
S.refill = {
  dur: 6, bg: C.canvas, beds: [[0, 6, 'groove']], lift: 120,
  cues: [[0.5, 'ding'], [1.3, 'ping'], [2.3, 'ding'], [3.3, 'tap'], [3.4, 'pluck', 6], [3.9, 'gameon']],
  draw(ctx, lt, A) {
    headline(ctx, lt, 0.1, 'Someone dropped out?', [[['We post the spot']], [['to players nearby.', C.brand]]], { problem: true, size: 84 });
    banner(ctx, A, 560, p(lt, 0.5, 0.95), 'Participant Left', 'Tom left "Thursday 5-a-side"', { alpha: 1 - p(lt, 1.9, 2.2) });
    const filled = lt >= 3.45, go = eOut(p(lt, 3.9, 4.1));
    const posted = eOut(p(lt, 1.3, 1.5));
    const k = p(lt, 0.9, 1.35);
    const cy = lerp(800, 760, eInOut(p(lt, 1.9, 2.3)));
    withAlpha(ctx, clamp(k * 3), () => {
      const s2 = lerp(0.94, 1, spring(k));
      ctx.save(); ctx.translate(CX, cy + 170); ctx.scale(s2, s2); ctx.translate(-470, -170);
      card(ctx, 0, 0, 940, 340, { r: 40 });
      text(ctx, 'THURSDAY 5-A-SIDE  ·  19:00', 48, 70, BOLD(24), C.brand, 'left', 3);
      if (go > 0.5) runs(ctx, [['Game on', C.grass], [' — 10/10', C.ink]], 48, 140, DISPLAY(56), -1.5);
      else runs(ctx, [[filled ? '10/10' : '9/10', C.ink], [filled ? '' : ' — 1 spot open', C.amber]], 48, 140, DISPLAY(56), -1.5);
      // status row: radar pulse while it's out there
      const rx = 72, ry = 228;
      if (posted > 0 && go < 0.5) for (const s0 of [1.3, 1.8, 2.3, 2.8]) {
        const u = p(lt, s0, s0 + 0.9);
        if (u > 0 && u < 1) withAlpha(ctx, 1 - u, () => { ctx.beginPath(); ctx.arc(rx, ry, 12 + 30 * u, 0, Math.PI * 2); ctx.strokeStyle = C.brand2; ctx.lineWidth = 3; ctx.stroke(); });
      }
      circle(ctx, rx, ry, 12, go > 0.5 ? C.grass : posted > 0 ? C.brand : C.ink4);
      text(ctx, go > 0.5 ? 'Filled by a player 1.2 km away' : posted > 0 ? 'Auto-posted to players nearby' : 'Spot opened', 100, ry + 11, BOLD(32), go > 0.5 ? C.grass : posted > 0 ? C.brand : C.ink3);
      for (let i = 0; i < 10; i++) {
        const x = 48 + 30 + i * 84, y = 300;
        if (i === 2 && !filled) { ctx.beginPath(); ctx.arc(x, y, 26, 0, Math.PI * 2); ctx.setLineDash([6, 6]); ctx.strokeStyle = C.ink4; ctx.lineWidth = 3; ctx.stroke(); ctx.setLineDash([]); }
        else avatar(ctx, x, y, 26, i === 2 ? { n: 'Kwame', c: '#0f766e' } : MEMBERS[i]);
      }
      ctx.restore();
    });
    // meanwhile, someone nearby gets it
    const d = p(lt, 2.3, 2.75);
    withAlpha(ctx, clamp(d * 3), () => text(ctx, 'Meanwhile, 1.2 km away…', 60, 1188, BOLD(30), C.ink3));
    banner(ctx, A, 1215, d, 'Spot open near you', '"Thursday 5-a-side" • Football, 1.2 km', {});
    if (d > 0) {
      const on = eOut(p(lt, 3.3, 3.5));
      withAlpha(ctx, clamp(d * 3), () => {
        ctx.save(); ctx.translate(RW - 200, 1290 + 120); ctx.scale(press(lt, 3.3), press(lt, 3.3));
        shadow(ctx, 30, 10, 0.18);
        button(ctx, -130, -40, 260, 80, on > 0.5 ? 'Joined' : 'Join', mix(C.brand, C.grass, on), '#fff', { check: on > 0.5 });
        ctx.restore();
      });
    }
    finger(ctx, lt, RW - 200, 1410, 3.3);
    banner(ctx, A, 560, p(lt, 3.9, 4.35), 'Event Full 🎉', '"Thursday 5-a-side" is full', { alpha: 1 - p(lt, 5.3, 5.55) });
  },
};

/* ---------- lock screen phone (alerts + widgets) ---------- */
const LP = phoneGeom(CX, 560, 640);
const LSX = LP.x + LP.bez, LSY = LP.y + LP.bez, LSW = LP.w - 2 * LP.bez, LSH = LP.h - 2 * LP.bez;
function lockPhone(ctx, dy, inner, bg) {
  ctx.save();
  ctx.translate(0, dy);
  shadow(ctx, 80, 30, 0.25);
  rr(ctx, LP.x, LP.y, LP.w, LP.h, LP.w * 0.15); ctx.fillStyle = '#0c1222'; ctx.fill();
  noShadow(ctx);
  rr(ctx, LSX, LSY, LSW, LSH, LP.w * 0.15 - LP.bez); ctx.clip();
  if (bg) ctx.fillStyle = bg;
  else {
    const g = ctx.createLinearGradient(0, LSY, 0, LSY + LSH);
    g.addColorStop(0, '#1d4ed8'); g.addColorStop(0.55, '#0f2744'); g.addColorStop(1, '#0a1628');
    ctx.fillStyle = g;
  }
  ctx.fillRect(LSX, LSY, LSW, LSH);
  inner();
  if (bg) { ctx.fillStyle = bg; ctx.fillRect(LSX, LSY, LSW, 80); text(ctx, '9:41', LSX + 70, LSY + 54, BOLD(26), bg === C.paper ? C.ink : '#fff'); }
  rr(ctx, CX - 92, LSY + 18, 184, 50, 25); ctx.fillStyle = '#000'; ctx.fill();
  ctx.restore();
}

/* ---------- alerts: the pushes that keep a game alive (all real copy) ---------- */
// Every notification type the app sends, in its real copy (server/*.ts), on the lock screen.
const ALERTS = [
  ['⚽', 'Event near you', '"Friday padel" • Intermediate Padel, 800 m away'],
  ['👋', 'Friend request', 'Kwame sent you a friend request'],
  ['📅', 'Set Your Availability', 'Set your availability for Sunday Football next week'],
  ['✅', 'Game on', 'Thu 19:00 worked but no game was made — create it?'],
  ['✉️', 'Event invitation', 'Maya invited you to "Thursday 5-a-side"'],
  ['✅', 'Join request approved', 'You\'re now a member of "Utrecht Internationals FC"'],
  ['⏰', 'Reminder: Thursday 5-a-side', 'Starts in 6 hours'],
  ['🚪', 'Participant Left', 'Tom left "Thursday 5-a-side"'],
  ['📍', 'Spot open near you', '"Thursday 5-a-side" • Football, 1.2 km — 1 spot left'],
  ['🎉', 'Event Full 🎉', '"Thursday 5-a-side" is full — get ready to play!'],
  ['📣', 'New post', 'New post in Sunday Football'],
  ['💬', 'Maya commented on your post', 'what a finish 🔥'],
  ['⭐', 'Player rated', 'Jonas rated your play ★★★★★ (5/5)'],
  ['🏆', 'Add the score for Thursday 5-a-side', 'Log who won so ratings and stats update'],
].map((a, i) => [0.45 + i * 0.3, ...a]);
const NR = 104; // lock-screen notification row height
S.alerts = {
  dur: 6, bg: C.canvas, beds: [[0, 6, 'groove']], lift: 120,
  cues: ALERTS.map(([t]) => [t, 'ding']),
  draw(ctx, lt, A) {
    headline(ctx, lt, 0.05, 'Out of the loop?', [[['Never miss a game.', C.brand]]], { problem: true });
    const n = ALERTS.filter(([t]) => lt >= t).length;
    withAlpha(ctx, eOut(p(lt, 0.6, 1.0)), () => text(ctx, `${n} notification${n === 1 ? '' : 's'} · all real`, L, 545, MED(30), C.ink3));
    lockPhone(ctx, rise(lt), () => {
      text(ctx, 'Thursday 2 October', CX, LSY + 150, BOLD(28), 'rgba(255,255,255,0.85)', 'center');
      text(ctx, '9:41', CX, LSY + 300, DISPLAY(150), '#ffffff', 'center', -4);
      // iOS stack: newest on top, older rows pushed down and dimmed
      ctx.save();
      rr(ctx, LSX, LSY + 340, LSW, LSH - 340, 0); ctx.clip();
      ALERTS.forEach(([t, ic, title, body], i) => {
        const k = eOut(p(lt, t, t + 0.3));
        if (k <= 0) return;
        const newer = ALERTS.slice(i + 1).reduce((s2, [t2]) => s2 + eOut(p(lt, t2, t2 + 0.3)), 0);
        const y = LSY + 360 + newer * (NR + 10) - 30 * (1 - k);
        if (y > LSY + LSH) return;
        withAlpha(ctx, k * (1 - 0.06 * Math.max(0, newer - 4)), () => lockRow(ctx, A, y, ic, title, body, newer < 0.5 ? 'now' : `${Math.round(newer) * 3}m`));
      });
      ctx.restore();
    });
  },
};
function lockRow(ctx, A, y, ic, title, body, when) {
  const x = LSX + 18, w = LSW - 36;
  rr(ctx, x, y, w, NR, 28); ctx.fillStyle = 'rgba(255,255,255,0.86)'; ctx.fill();
  ctx.save(); rr(ctx, x + 16, y + 22, 60, 60, 14); ctx.clip(); ctx.drawImage(A.icon, x + 16, y + 22, 60, 60); ctx.restore();
  ctx.textBaseline = 'middle'; text(ctx, ic, x + 72, y + 74, '24px sans-serif', '#000', 'center'); ctx.textBaseline = 'alphabetic';
  ctx.save(); ctx.beginPath(); ctx.rect(x + 92, y, w - 170, NR); ctx.clip();
  text(ctx, title, x + 94, y + 44, BOLD(25), C.ink);
  text(ctx, body, x + 94, y + 78, MED(22), C.ink2);
  ctx.restore();
  text(ctx, when, x + w - 18, y + 42, MED(20), C.ink3, 'right');
}
function notifRow(ctx, y, ic, tint, title, body, when, unread, k) {
  if (unread) { ctx.fillStyle = mix('#ffffff', C.brandTint, k); ctx.fillRect(LSX, y, LSW, 132); }
  ctx.fillStyle = C.line; ctx.fillRect(LSX + 36, y + 131, LSW - 72, 2);
  circle(ctx, LSX + 76, y + 66, 38, tint);
  ctx.textBaseline = 'middle'; text(ctx, ic, LSX + 76, y + 68, '36px sans-serif', '#000', 'center'); ctx.textBaseline = 'alphabetic';
  text(ctx, title, LSX + 134, y + 58, BOLD(27), C.ink);
  text(ctx, body, LSX + 134, y + 96, MED(23), C.ink3);
  text(ctx, when, LSX + LSW - 36, y + 56, MED(21), C.ink4, 'right');
  if (unread) circle(ctx, LSX + LSW - 46, y + 90, 8, C.brand);
}

/* ---------- widgets: home screen widget + Live Activity (mobile/widgets/) ---------- */
function widgetMedium(ctx, x, y, w, h, o) {
  // mirrors NextEventWidget systemMedium: chip, name, venue · going, big countdown, status pill
  ctx.save();
  shadow(ctx, 40, 14, 0.25);
  rr(ctx, x, y, w, h, h * 0.2); ctx.fillStyle = '#ffffff'; ctx.fill();
  noShadow(ctx);
  const u = h / 340;
  circle(ctx, x + 70 * u, y + 80 * u, 44 * u, o.soon ? C.amber : C.brand);
  circle(ctx, x + 70 * u, y + 80 * u, 18 * u, '#fff');
  text(ctx, 'Thursday 5-a-side', x + 136 * u, y + 76 * u, BOLD(40 * u), C.ink);
  text(ctx, 'Sportpark Transwijk  ·  9/10', x + 136 * u, y + 120 * u, MED(30 * u), C.ink3);
  text(ctx, o.eta, x + w - 40 * u, y + 250 * u, DISPLAY(96 * u), o.soon ? '#b45309' : C.brand, 'right', -2);
  const lbl = o.soon ? 'Starting soon' : 'Upcoming';
  const pw = measure(ctx, lbl, BOLD(26 * u)) + 36 * u;
  rr(ctx, x + 40 * u, y + 220 * u, pw, 50 * u, 25 * u); ctx.fillStyle = o.soon ? '#fef6e7' : C.brandTint; ctx.fill();
  text(ctx, lbl, x + 40 * u + pw / 2, y + 254 * u, BOLD(26 * u), o.soon ? '#b45309' : C.brand, 'center');
  ctx.restore();
}
S.widgets = {
  dur: 6, bg: C.canvas, beds: [[0, 6, 'groove']], lift: 120,
  cues: [[0.6, 'pluck', 4], [3.0, 'whoosh'], [3.2, 'bell', 3]],
  draw(ctx, lt, A) {
    headline(ctx, lt, 0.05, "Forgot it's game day?", [[['Your next game,']], [['on your home screen.', C.brand]]], { problem: true, size: 84 });
    const soon = lt >= 3.0;
    lockPhone(ctx, rise(lt), () => {
      // home screen: the PlayPals widget + an app grid (generic icons, ours in it)
      text(ctx, '9:41', LSX + 70, LSY + 54, BOLD(26), '#fff');
      widgetMedium(ctx, LSX + 36, LSY + 175, LSW - 72, 260, { eta: soon ? '28m' : '2h 15m', soon });
      const cols = ['#64748b', '#0ea5e9', '#f97316', '#22c55e', '#a855f7', '#e11d48', '#14b8a6', '#eab308'];
      for (let i = 0; i < 12; i++) {
        const cx = LSX + 90 + (i % 4) * 136, cy = LSY + 540 + Math.floor(i / 4) * 160;
        if (i === 5) { drawTile(ctx, A.icon, cx, cy, 104); text(ctx, 'PlayPals', cx, cy + 82, MED(20), '#fff', 'center'); continue; }
        rr(ctx, cx - 52, cy - 52, 104, 104, 24); ctx.fillStyle = cols[i % cols.length]; ctx.globalAlpha = 0.55; ctx.fill(); ctx.globalAlpha = 1;
      }
      // Live Activity in the Dynamic Island when it's close
      const isl = eOut(p(lt, 3.0, 3.4));
      if (isl > 0) {
        const w = lerp(184, LSW - 40, isl), h = lerp(50, 130, isl);
        rr(ctx, CX - w / 2, LSY + 18, w, h, 50); ctx.fillStyle = '#000'; ctx.fill();
        withAlpha(ctx, p(lt, 3.25, 3.5), () => {
          circle(ctx, CX - w / 2 + 64, LSY + 83, 34, C.amber); circle(ctx, CX - w / 2 + 64, LSY + 83, 13, '#000');
          text(ctx, 'Thursday 5-a-side', CX - w / 2 + 116, LSY + 74, BOLD(28), '#fff');
          text(ctx, 'Starting soon', CX - w / 2 + 116, LSY + 110, MED(24), '#fbbf24');
          text(ctx, '28:00', CX + w / 2 - 36, LSY + 98, DISPLAY(48), '#fbbf24', 'right');
        });
      }
    });
  },
};

/* ---------- ratings ---------- */
const RATE = [[1, 5, 1.4], [4, 4, 1.9], [7, 5, 2.4], [9, 5, 2.9]];
S.ratings = {
  dur: 6, bg: C.canvas, beds: [[0, 6, 'groove']], lift: 120,
  cues: [[0.4, 'ding'], ...RATE.map(([, n, t], i) => [t, 'stars', n]), [3.9, 'whoosh'], [4.3, 'bell', 4]],
  draw(ctx, lt, A) {
    headline(ctx, lt, 0.1, "Who's actually any good?", [[["See who you're"]], [['playing with.', C.brand]]], { size: 84, problem: true });
    banner(ctx, A, 600, p(lt, 0.4, 0.85), 'How was Thursday 5-a-side?', 'Rate the players you just played with', { alpha: 1 - p(lt, 1.0, 1.3) });
    const shrink = eInOut(p(lt, 3.8, 4.3));
    const k = p(lt, 1.0, 1.45);
    withAlpha(ctx, clamp(k * 3) * (1 - shrink), () => {
      const s = lerp(0.94, 1, spring(k)) * lerp(1, 0.6, shrink);
      ctx.save(); ctx.translate(CX, 600 + 330); ctx.scale(s, s); ctx.translate(-470, -330);
      card(ctx, 0, 0, 940, 660, { r: 40 });
      text(ctx, 'Rate players', 48, 92, DISPLAY(52), C.ink, 'left', -1);
      text(ctx, 'Tap stars to rate players', 48, 140, MED(30), C.ink3);
      RATE.forEach(([m, n, t], i) => {
        const y = 230 + i * 116;
        avatar(ctx, 86, y, 38, MEMBERS[m]);
        text(ctx, MEMBERS[m].n, 146, y + 12, BOLD(34), C.ink);
        for (let s2 = 0; s2 < 5; s2++) {
          const on = s2 < n ? eOut(p(lt, t + s2 * 0.06, t + s2 * 0.06 + 0.15)) : 0;
          const sc = 1 + 0.35 * pulse(p(lt, t + s2 * 0.06, t + s2 * 0.06 + 0.3)) * (s2 < n ? 1 : 0);
          ctx.save(); ctx.translate(560 + s2 * 70, y); ctx.scale(sc, sc);
          star(ctx, 0, 0, 27, mix(C.line, C.star, on));
          ctx.restore();
        }
      });
      ctx.restore();
    });
    RATE.forEach(([, n, t], i) => finger(ctx, lt, CX - 470 + 560 + (n - 1) * 70, 600 + 230 + i * 116, t));
    // -> the profile stat (real labels: "Rating", "Reviews")
    const pr = p(lt, 4.1, 4.6);
    withAlpha(ctx, clamp(pr * 3), () => {
      const s = lerp(0.9, 1, spring(pr));
      ctx.save(); ctx.translate(CX, 930); ctx.scale(s, s);
      card(ctx, -360, -200, 720, 400, { r: 48 });
      avatar(ctx, 0, -80, 70, MEMBERS[0]);
      star(ctx, -100, 60, 36, C.star);
      text(ctx, '4.7', 10, 80, DISPLAY(80), C.ink, 'center', -2);
      text(ctx, 'Rating', 0, 150, BOLD(30), C.ink3, 'center');
      ctx.restore();
    });
  },
};

/* ---------- everywhere: games in every sport, both cities ---------- */
const SP = [['FOOTBALL', 'football', C.brand], ['BASKETBALL', 'basketball', '#f97316'], ['VOLLEYBALL', 'volleyball', '#8b5cf6'],
  ['PADEL', 'padel', '#0ea5e9'], ['RUNNING', 'run club', C.grass], ['TENNIS', 'tennis', '#e11d48']];
const PLACES = ['Vondelpark', 'Westerpark', 'Maximapark', 'Science Park', 'Oosterpark', 'Griftpark', 'Olympiaplein', 'Transwijk'];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MINI = (() => {
  const r = rng(5), out = [];
  for (let j = -6; j <= 6; j++) for (let i = -2; i <= 2; i++) {
    const [cap, name, col] = SP[Math.floor(r() * SP.length)];
    const day = DAYS[Math.floor(r() * 7)];
    const need = [4, 6, 8, 10][Math.floor(r() * 4)], have = Math.min(need, Math.floor(need * lerp(0.4, 1.2, r())));
    out.push({ i, j, ring: Math.round(Math.hypot(i * 1.3, j)), cap, title: `${day} ${name}`, meta: `${['18:30', '19:00', '20:00', '10:00'][Math.floor(r() * 4)]} · ${PLACES[Math.floor(r() * PLACES.length)]}`, col, need, have });
  }
  return out;
})();
S.everywhere = {
  dur: 4, bg: C.canvas, beds: [[0, 4, 'groove']],
  cues: [...range(0.1, 1.35, 0.25).map((t, i) => [t, 'pluck', i + 2]), [1.5, 'bell', 0]],
  draw(ctx, lt) {
    const s = lerp(1.0, 0.86, eInOut(p(lt, 0, 4)));
    ctx.save(); ctx.translate(CX, CY); ctx.scale(s, s);
    MINI.forEach((m) => {
      const u = p(lt, 0.05 + m.ring * 0.18, 0.45 + m.ring * 0.18);
      if (u <= 0) return;
      const x = m.i * 460, y = m.j * 300;
      withAlpha(ctx, clamp(u * 3), () => {
        const k = lerp(0.85, 1, spring(u));
        ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
        rr(ctx, -210, -126, 420, 252, 30); ctx.fillStyle = 'rgba(12,18,34,0.06)'; ctx.fill();
        rr(ctx, -210, -136, 420, 252, 30); ctx.fillStyle = C.paper; ctx.fill();
        text(ctx, m.cap, -180, -86, BOLD(18), m.col, 'left', 3);
        text(ctx, m.title, -180, -40, BOLD(32), C.ink);
        text(ctx, m.meta, -180, -2, MED(22), C.ink3);
        for (let q = 0; q < m.need; q++) circle(ctx, -168 + q * 34, 50, 13, q < m.have ? MEMBERS[(q + m.j + 10) % 10].c : C.wash);
        ctx.restore();
      });
    });
    ctx.restore();
    const k = p(lt, 0.9, 1.35);
    withAlpha(ctx, clamp(k * 3), () => {
      const sc = lerp(0.94, 1, spring(k));
      ctx.save(); ctx.translate(CX, 470); ctx.scale(sc, sc);
      card(ctx, -470, -190, 940, 380, { r: 48, a: 0.22 });
      text(ctx, 'EVERY SPORT, EVERY LEVEL', -410, -110, BOLD(26), C.brand, 'left', 4);
      text(ctx, 'Football. Padel.', -410, -20, DISPLAY(76), C.ink, 'left', -2);
      text(ctx, 'Basketball. More.', -410, 66, DISPLAY(76), C.ink, 'left', -2);
      text(ctx, 'Utrecht & Amsterdam', -410, 132, MED(34), C.ink3);
      ctx.restore();
    });
  },
};

// post-match BBQ: the real photo if supplied, else a drawn grill (no people)
function bbqPhoto(ctx, x, y, w, h, lt, A) {
  if (A && A.photos && A.photos.bbq) { cover(ctx, A.photos.bbq, x, y, w, h); return; }
  const g = ctx.createRadialGradient(x + w / 2, y + h * 0.6, 0, x + w / 2, y + h * 0.6, w * 0.7);
  g.addColorStop(0, '#7c2d12'); g.addColorStop(0.5, '#1c1917'); g.addColorStop(1, '#0c0a09');
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  for (let i = 0; i < 24; i++) { // embers
    const ex = x + w * ((i * 53) % 100) / 100, ey = y + h * (0.55 + ((i * 29) % 40) / 100);
    circle(ctx, ex, ey, 3 + (i % 3) * 2, `rgba(251,146,60,${0.35 + 0.3 * Math.sin(lt * 5 + i)})`);
  }
  ctx.strokeStyle = '#a8a29e'; ctx.lineWidth = 4;
  for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.moveTo(x + w * 0.06, y + h * (0.2 + i * 0.075)); ctx.lineTo(x + w * 0.94, y + h * (0.2 + i * 0.075)); ctx.stroke(); }
  for (let i = 0; i < 6; i++) { // sausages + burgers
    const sx = x + w * (0.12 + (i % 3) * 0.28), sy = y + h * (0.28 + Math.floor(i / 3) * 0.3);
    if (i % 2) { circle(ctx, sx + w * 0.1, sy + h * 0.06, w * 0.08, '#78350f'); circle(ctx, sx + w * 0.1 - 6, sy + h * 0.06 - 6, w * 0.06, '#92400e'); }
    else { rr(ctx, sx, sy, w * 0.22, h * 0.1, h * 0.05); ctx.fillStyle = '#9a3412'; ctx.fill(); rr(ctx, sx + 8, sy + 4, w * 0.2, h * 0.03, h * 0.015); ctx.fillStyle = 'rgba(255,237,213,0.35)'; ctx.fill();
      ctx.strokeStyle = '#431407'; ctx.lineWidth = 3; for (let q = 1; q < 4; q++) { ctx.beginPath(); ctx.moveTo(sx + q * w * 0.055, sy); ctx.lineTo(sx + q * w * 0.055 - 8, sy + h * 0.1); ctx.stroke(); } }
  }
  for (let i = 0; i < 3; i++) { // smoke
    const u = (lt * 0.4 + i / 3) % 1;
    withAlpha(ctx, 0.25 * Math.sin(Math.PI * u), () => circle(ctx, x + w * (0.3 + i * 0.2) + Math.sin(u * 5) * 20, y + h * (0.5 - u * 0.5), w * 0.12, '#e7e5e4'));
  }
}

/* ---------- social: post the goal, the crew likes and comments (real: posts, likes, comments) ---------- */
// a stylised "photo": top bins under the floodlights (no real people, no stock)
function cover(ctx, img, x, y, w, h, fx = 0.5, fy = 0.5, zoom = 1) {
  const s2 = Math.max(w / img.width, h / img.height) * zoom, iw = img.width * s2, ih = img.height * s2;
  const ox = clamp(w / 2 - fx * iw, w - iw, 0), oy = clamp(h / 2 - fy * ih, h - ih, 0);
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.drawImage(img, x + ox, y + oy, iw, ih); ctx.restore();
}
function goalPhoto(ctx, x, y, w, h, k, A) {
  if (A && A.photos && A.photos.goal) { withAlpha(ctx, clamp(k * 2), () => cover(ctx, A.photos.goal, x, y, w, h, 0.63, 0.36, 1.7)); return; }
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#06140d'); g.addColorStop(0.45, '#0f3d24'); g.addColorStop(1, '#14532d');
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  const fl = ctx.createRadialGradient(x + w * 0.15, y + h * 0.05, 0, x + w * 0.15, y + h * 0.05, w * 0.9);
  fl.addColorStop(0, 'rgba(255,255,230,0.55)'); fl.addColorStop(1, 'rgba(255,255,230,0)');
  ctx.fillStyle = fl; ctx.fillRect(x, y, w, h);
  for (let i = 0; i < 6; i++) { ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.05)'; ctx.fillRect(x, y + h * (0.6 + i * 0.07), w, h * 0.07); }
  const gx0 = x + w * 0.12, gx1 = x + w * 0.88, gy0 = y + h * 0.26, gy1 = y + h * 0.62;
  ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 1.5;
  for (let i = 1; i < 16; i++) { ctx.beginPath(); ctx.moveTo(lerp(gx0, gx1, i / 16), gy0); ctx.lineTo(lerp(gx0, gx1, i / 16), gy1); ctx.stroke(); }
  for (let i = 1; i < 8; i++) { ctx.beginPath(); ctx.moveTo(gx0, lerp(gy0, gy1, i / 8)); ctx.lineTo(gx1, lerp(gy0, gy1, i / 8)); ctx.stroke(); }
  ctx.strokeStyle = '#f8fafc'; ctx.lineWidth = w * 0.022; ctx.lineCap = 'square';
  ctx.beginPath(); ctx.moveTo(gx0, gy1); ctx.lineTo(gx0, gy0); ctx.lineTo(gx1, gy0); ctx.lineTo(gx1, gy1); ctx.stroke();
  // the strike: from the bottom left into the top corner
  const bx0 = x + w * 0.3, by0 = y + h * 0.95, bx1 = x + w * 0.8, by1 = y + h * 0.31;
  const u = eOut(clamp(k)), bx = lerp(bx0, bx1, u), by = lerp(by0, by1, u) - Math.sin(Math.PI * u) * h * 0.08;
  const tr = ctx.createLinearGradient(bx0, by0, bx, by);
  tr.addColorStop(0, 'rgba(255,255,255,0)'); tr.addColorStop(1, 'rgba(255,255,255,0.55)');
  ctx.strokeStyle = tr; ctx.lineWidth = w * 0.05; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(lerp(bx0, bx, 0.3), lerp(by0, by, 0.3)); ctx.lineTo(bx, by); ctx.stroke();
  circle(ctx, bx, by, w * 0.035, '#ffffff');
  circle(ctx, bx + w * 0.008, by - w * 0.006, w * 0.011, '#1f2937');
  ctx.restore();
}
const REACT = ['❤️', '❤️', '🔥', '❤️', '❤️', '🔥', '❤️', '❤️']; // likes
S.social = {
  dur: 8, bg: C.canvas, beds: [[0, 8, 'groove']], lift: 120,
  cues: [[0.5, 'whoosh'], [1.95, 'tap'], [2.0, 'pluck', 7], [2.4, 'whoosh'], ...range(2.9, 4.4, 0.25).map((t, i) => [t, 'pluck', (i % 5) + 3]), [4.0, 'ding'],
    [4.9, 'whoosh'], [5.6, 'ding'], [6.2, 'tap'], [6.25, 'pluck', 8], [6.6, 'ding']],
  draw(ctx, lt, A) {
    headline(ctx, lt, 0.05, 'Scored? Nobody saw it.', [[['Share it with'], [' your crew.', C.brand]]], { problem: true, size: 80 });
    const b2 = eOut(p(lt, 4.9, 5.3));
    withAlpha(ctx, b2, () => runs(ctx, [['Then stay for the ', C.ink], ['BBQ.', C.coralDeep]], L, 520 + 20 * (1 - b2), DISPLAY(64), -1.5));
    const posted = lt >= 2.4;
    lockPhone(ctx, rise(lt), () => {
      if (!posted) {
        // composer (real: "New post" -> "Add photo" -> "Post")
        text(ctx, 'Cancel', LSX + 36, LSY + 150, MED(26), C.ink3);
        text(ctx, 'New post', CX, LSY + 150, BOLD(32), C.ink, 'center');
        const cap = 'Top bins 🎯 Thursday 5-a-side';
        const n = Math.floor(cap.length * p(lt, 0.3, 1.1));
        text(ctx, n ? [...cap].slice(0, n).join('') : "What's on your mind?", LSX + 36, LSY + 240, MED(32), n ? C.ink : C.ink4);
        const ph = eOut(p(lt, 1.1, 1.5));
        withAlpha(ctx, ph, () => {
          ctx.save(); rr(ctx, LSX + 36, LSY + 290, LSW - 72, (LSW - 72) * 1.1, 28); ctx.clip();
          goalPhoto(ctx, LSX + 36, LSY + 290, LSW - 72, (LSW - 72) * 1.1, p(lt, 1.2, 1.9), A);
          ctx.restore();
        });
        ctx.save(); ctx.translate(CX, LSY + 290 + (LSW - 72) * 1.1 + 110); ctx.scale(press(lt, 1.95), press(lt, 1.95));
        button(ctx, -(LSW - 72) / 2, -44, LSW - 72, 88, 'Post', C.brand, '#fff');
        ctx.restore();
      } else {
        // in the group's Feed: likes climb, a comment lands, then the BBQ shows up
        const scroll = 760 * eInOut(p(lt, 4.9, 5.5));
        ctx.save(); ctx.translate(0, -scroll);
        text(ctx, 'Utrecht Internationals FC', LSX + 36, LSY + 150, BOLD(30), C.ink);
        ctx.fillStyle = C.line; ctx.fillRect(LSX, LSY + 182, LSW, 2);
        avatar(ctx, LSX + 66, LSY + 240, 30, { n: 'Sofia', c: C.brand });
        text(ctx, 'Sofia', LSX + 110, LSY + 234, BOLD(28), C.ink);
        text(ctx, 'just now', LSX + 110, LSY + 266, MED(22), C.ink4);
        text(ctx, 'Top bins 🎯 Thursday 5-a-side', LSX + 36, LSY + 330, MED(30), C.ink);
        const pw = LSW - 72, phh = pw * 1.0;
        ctx.save(); rr(ctx, LSX + 36, LSY + 360, pw, phh, 28); ctx.clip(); goalPhoto(ctx, LSX + 36, LSY + 360, pw, phh, 1, A); ctx.restore();
        const likes = Math.round(lerp(0, 24, eOut(p(lt, 2.8, 4.6))));
        const by = LSY + 360 + phh + 60;
        const pop = REACT.reduce((s2, _, i) => s2 + pulse(p(lt, 2.9 + i * 0.22, 3.2 + i * 0.22)), 0);
        ctx.save(); ctx.translate(LSX + 56, by - 10); ctx.scale(1 + 0.25 * pop, 1 + 0.25 * pop);
        ctx.textBaseline = 'middle'; text(ctx, '❤️', 0, 0, '34px sans-serif', '#000', 'center'); ctx.textBaseline = 'alphabetic';
        ctx.restore();
        text(ctx, `${likes}`, LSX + 90, by, BOLD(30), C.ink);
        ctx.textBaseline = 'middle'; text(ctx, '💬', LSX + 180, by - 10, '32px sans-serif', '#000', 'center'); ctx.textBaseline = 'alphabetic';
        text(ctx, lt >= 4.8 ? '7' : '6', LSX + 212, by, BOLD(30), C.ink);
        // hearts float up off the photo
        REACT.forEach((e, i) => {
          const t0 = 2.9 + i * 0.22, u = p(lt, t0, t0 + 1.3);
          if (u <= 0 || u >= 1) return;
          const x = LSX + LSW * (0.25 + 0.5 * ((i * 37) % 10) / 10) + Math.sin(u * 6 + i) * 20;
          withAlpha(ctx, 1 - p(u, 0.7, 1), () => {
            ctx.textBaseline = 'middle';
            text(ctx, e, x, LSY + 360 + phh - 40 - u * 420, `${54 + (i % 3) * 10}px sans-serif`, '#000', 'center');
            ctx.textBaseline = 'alphabetic';
          });
        });
        // the post-match BBQ: a feed post, liked and commented on
        const ey = LSY + 360 + phh + 120;
        ctx.fillStyle = C.line; ctx.fillRect(LSX, ey - 30, LSW, 2);
        avatar(ctx, LSX + 66, ey + 30, 30, MEMBERS[1]);
        text(ctx, 'Maya', LSX + 110, ey + 24, BOLD(28), C.ink);
        text(ctx, 'just now', LSX + 110, ey + 56, MED(22), C.ink4);
        text(ctx, 'Post-match BBQ at Julianapark 🍖', LSX + 36, ey + 120, MED(30), C.ink);
        const bw = LSW - 72, bh = bw * 0.68;
        ctx.save(); rr(ctx, LSX + 36, ey + 150, bw, bh, 28); ctx.clip(); bbqPhoto(ctx, LSX + 36, ey + 150, bw, bh, lt, A); ctx.restore();
        // you double-tap it: a heart pops on the photo, likes tick up
        const dt = p(lt, 6.2, 6.9);
        if (dt > 0 && dt < 1) withAlpha(ctx, 1 - p(dt, 0.6, 1), () => {
          const sc = lerp(0.3, 1, spring(dt));
          ctx.save(); ctx.translate(CX, ey + 150 + bh / 2); ctx.scale(sc, sc);
          ctx.textBaseline = 'middle'; text(ctx, '❤️', 0, 0, '150px sans-serif', '#000', 'center'); ctx.textBaseline = 'alphabetic';
          ctx.restore();
        });
        const ly = ey + 150 + bh + 56;
        const bl = Math.round(lerp(9, 31, eOut(p(lt, 5.4, 6.9))));
        ctx.textBaseline = 'middle'; text(ctx, '❤️', LSX + 56, ly - 10, '34px sans-serif', '#000', 'center'); ctx.textBaseline = 'alphabetic';
        text(ctx, `${bl}`, LSX + 90, ly, BOLD(30), C.ink);
        ctx.textBaseline = 'middle'; text(ctx, '💬', LSX + 180, ly - 10, '32px sans-serif', '#000', 'center'); ctx.textBaseline = 'alphabetic';
        const cm = [[5.6, 2, 'save me a sausage 😂'], [6.6, 6, 'best part of the week']];
        text(ctx, `${4 + cm.filter(([t]) => lt >= t).length}`, LSX + 212, ly, BOLD(30), C.ink);
        cm.forEach(([t, m, msg], i) => {
          const k = eOut(p(lt, t, t + 0.35));
          withAlpha(ctx, k, () => runs(ctx, [[`${MEMBERS[m].n}  `, C.ink], [msg, C.ink2]], LSX + 36, ly + 60 + i * 46 + 16 * (1 - k), MED(27)));
        });
        ctx.restore();
      }
    }, C.paper);
    finger(ctx, lt, CX, 560 + 13 + 290 + (LSW - 72) * 1.1 + 110, 1.95);
    { const bw = LSW - 72; finger(ctx, lt, CX, 573 + 360 + bw + 120 + 150 + bw * 0.34 - 760, 6.2); }
    // real push copy: "{name} commented on your post" / preview
    banner(ctx, A, 1560, p(lt, 4.0, 4.45), 'Maya commented on your post', 'what a finish 🔥 same again thursday?', { alpha: 1 - p(lt, 4.8, 5.1) });
  },
};

/* =================================================================== */
/*  ENGINE                                                              */
/* =================================================================== */
export const SECTIONS = S;
export const CUTS = {
  long: ['chat', 'dropouts', 'newcity', 'brand', 'map', 'crew', 'heatmap', 'rsvp', 'refill', 'alerts', 'widgets', 'ratings', 'social', 'everywhere', 'end'],
  'ad-15': ['chat', 'heatmap', 'end'],
  'ad-messages': ['chat', 'heatmap', 'rsvp', 'end'],
  'ad-newcity': ['newcity', 'crew', 'rsvp', 'end'],
  'ad-dropouts': ['dropouts', 'refill', 'alerts', 'end'],
  'ad-social': ['newcity', 'crew', 'social', 'end'],
};

export function plan(ids) {
  let t = 0;
  const out = ids.map((id, i) => {
    const s = S[id];
    if (!s) throw new Error(`unknown section "${id}" (have: ${Object.keys(S).join(', ')})`);
    const o = { id, ...s, start: t, first: i === 0, final: i === ids.length - 1 };
    t += s.dur;
    return o;
  });
  // The dot-collapse is the brand move; used 14 times it fatigues. Keep it for the hinges
  // (navy <-> daylight, into/out of the logo); between two app sections, a short slide + crossfade.
  out.forEach((o, i) => {
    if (!i) return;
    const prev = out[i - 1];
    const hinge = prev.bg !== o.bg || ['brand', 'end'].includes(prev.id) || ['brand', 'end'].includes(o.id);
    o.inT = prev.outT = hinge ? 'dot' : 'push';
  });
  out.duration = t;
  return out;
}

// absolute cue list for a cut: section cues + engine transition cues + music beds
export function cueSheet(pl) {
  const cues = [], beds = [];
  pl.forEach((s, i) => {
    s.cues.forEach(([t, type, arg]) => cues.push({ t: +(s.start + t).toFixed(4), type, arg: arg ?? 0, section: s.id }));
    s.beds.forEach(([a, b, mood]) => beds.push({ a: s.start + a, b: s.start + b, mood }));
    if (i > 0 && s.inT === 'dot') {
      cues.push({ t: s.start - OUT, type: 'suck', arg: OUT, section: s.id });
      cues.push({ t: s.start, type: 'thock', arg: pl[i - 1].bg !== s.bg ? 1 : 0, section: s.id });
    } else if (i > 0) cues.push({ t: s.start - 0.15, type: 'whoosh', arg: 0, section: s.id });
  });
  cues.sort((a, b) => a.t - b.t);
  return { duration: pl.duration, sections: pl.map(({ id, start, dur, bg }) => ({ id, start, dur, bg })), beds, cues };
}

// Brand on frame 1 of whatever opens the cut: Meta's ad guidance is to brand early, and a
// badge beside the problem keeps the hook (no title card in front of it).
function badge(ctx, lt, A, s) {
  if (s.badge == null) return; // only the pain sections open cuts, and they leave room for it
  const a = 1 - p(lt, s.badge - 0.3, s.badge);
  const dark = s.bg === C.navy;
  withAlpha(ctx, a, () => {
    drawTile(ctx, A.icon, L + 34, 210, 68);
    runs(ctx, [['Play', dark ? C.inkD : C.ink], ['Pals', dark ? C.brand2 : C.brand]], L + 86, 228, DISPLAY(46), -1);
  });
}

export function drawReel(ctx, t, A, pl) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  let i = pl.findIndex((s) => t < s.start + s.dur);
  if (i < 0) i = pl.length - 1;
  const s = pl[i], lt = t - s.start;
  const prev = pl[i - 1];

  const o = { first: s.first };
  const drawLifted = () => { ctx.save(); if (s.lift) ctx.translate(0, -s.lift); s.draw(ctx, lt, A, o); ctx.restore(); };
  const body = () => { ctx.fillStyle = s.bg; ctx.fillRect(0, 0, RW, RH); drawLifted(); if (s.first) badge(ctx, lt, A, s); };

  if (s.inT === 'push' && lt < PUSH) {
    // previous section (frozen on its last frame) slides a little left and fades; this one slides in.
    // A short slide, not a full-width push: at 30fps a full push strobes under the motion blur.
    const u = eInOut(p(lt, 0, PUSH));
    ctx.fillStyle = s.bg; ctx.fillRect(0, 0, RW, RH);
    withAlpha(ctx, 1 - u, () => { ctx.save(); ctx.translate(-120 * u, 0); if (prev.lift) ctx.translate(0, -prev.lift); prev.draw(ctx, prev.dur - 1e-3, A, { first: false }); ctx.restore(); });
    withAlpha(ctx, u, () => { ctx.save(); ctx.translate(120 * (1 - u), 0); drawLifted(); ctx.restore(); });
  } else if (!s.first && lt < IN) {
    // reveal out of the dot
    const u = eOut(p(lt, 0, IN));
    ctx.fillStyle = prev.bg; ctx.fillRect(0, 0, RW, RH);
    ctx.save(); ctx.beginPath(); ctx.arc(CX, CY, 18 + u * 1250, 0, Math.PI * 2); ctx.clip(); body(); ctx.restore();
    withAlpha(ctx, 1 - u, () => { ctx.beginPath(); ctx.arc(CX, CY, 18 + u * 1250, 0, Math.PI * 2); ctx.strokeStyle = C.brand2; ctx.lineWidth = lerp(16, 2, u); ctx.stroke(); });
    if (!['brand', 'end', 'newcity'].includes(s.id)) withAlpha(ctx, 1 - p(lt, 0.05, 0.3), () => circle(ctx, CX, CY, 18, C.brand2));
  } else if (!s.final && s.outT === 'dot' && lt > s.dur - OUT) {
    // implode into the dot
    const u = eIn(p(lt, s.dur - OUT, s.dur));
    ctx.fillStyle = s.bg; ctx.fillRect(0, 0, RW, RH);
    ctx.save(); ctx.translate(CX, CY); ctx.scale(1 - u, 1 - u); ctx.translate(-CX, -CY); ctx.globalAlpha = 1 - u;
    drawLifted();
    if (s.first) badge(ctx, lt, A, s);
    ctx.restore();
    circle(ctx, CX, CY, 18 * eOut(p(lt, s.dur - OUT, s.dur - OUT * 0.4)), C.brand2);
  } else body();
}
