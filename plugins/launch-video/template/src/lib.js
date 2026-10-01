// Shared drawing + motion helpers for the reel (film.js keeps its own copy so the
// 16:9 film stays byte-for-byte reproducible).

export const C = {
  navy: '#0a1628', navyPaper: '#13314f', inkD: '#f2f6fb', ink3D: '#a2afc0', ink4D: '#6e7d94',
  canvas: '#f7f8fa', paper: '#ffffff', wash: '#eef1f6', line: '#e4e7ef',
  ink: '#0c1222', ink2: '#3b4459', ink3: '#687185', ink4: '#98a0b2',
  brand: '#2563eb', brand2: '#3b82f6', brandDeep: '#1d4ed8', brandTint: '#eef4ff',
  grass: '#16a34a', grassTint: '#e8f7ef', coral: '#ff6b5e', coralDeep: '#f04438', amber: '#f59e0b',
  logoDot: '#1f4a6e', star: '#f5b301',
};
export const DISPLAY = (s) => `800 ${s}px Bricolage`;
export const BOLD = (s) => `700 ${s}px Satoshi`;
export const MED = (s) => `500 ${s}px Satoshi`;

export const MEMBERS = [
  { n: 'You', c: C.brand }, { n: 'Maya', c: '#f97316' }, { n: 'Tom', c: '#16a34a' },
  { n: 'Sam', c: '#8b5cf6' }, { n: 'Jonas', c: '#0ea5e9' }, { n: 'Ade', c: '#e11d48' },
  { n: 'Lin', c: '#f59e0b' }, { n: 'Noor', c: '#14b8a6' }, { n: 'Ravi', c: '#6366f1' },
  { n: 'Elif', c: '#db2777' },
];

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, k) => a + (b - a) * k;
export const p = (t, a, b) => clamp((t - a) / (b - a));
export const eOut = (x) => 1 - (1 - x) ** 3;
export const eIn = (x) => x ** 3;
export const eInOut = (x) => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2);
export const eOut5 = (x) => 1 - (1 - x) ** 5;
export const spring = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : 1 - Math.exp(-6.5 * u) * Math.cos(9.5 * u));
export const pulse = (u) => (u <= 0 || u >= 1 ? 0 : Math.sin(Math.PI * Math.min(1, u * 2.2)) * (1 - u) ** 1.5);

export function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let r = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
export function mix(a, b, k) {
  const A = hex(a), B = hex(b);
  return `rgb(${A.map((v, i) => Math.round(lerp(v, B[i], clamp(k)))).join(',')})`;
}

export function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.max(0, Math.min(r, w / 2, h / 2)));
}
export function circle(ctx, x, y, r, fill) {
  ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill();
}
export function text(ctx, s, x, y, font, color, align = 'left', spacing = 0) {
  ctx.font = font; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
  ctx.letterSpacing = `${spacing}px`;
  ctx.fillText(s, x, y);
  ctx.letterSpacing = '0px';
}
export function measure(ctx, s, font, spacing = 0) {
  ctx.font = font; ctx.letterSpacing = `${spacing}px`;
  const w = ctx.measureText(s).width;
  ctx.letterSpacing = '0px';
  return w;
}
// draw [[text, color], ...] as one line
export function runs(ctx, parts, x, y, font, spacing = 0, align = 'left') {
  const ws = parts.map(([s]) => measure(ctx, s, font, spacing));
  let cx = align === 'center' ? x - ws.reduce((a, b) => a + b, 0) / 2 : x;
  parts.forEach(([s, c], i) => { text(ctx, s, cx, y, font, c, 'left', spacing); cx += ws[i]; });
}
export function check(ctx, x, y, s, color, lw) {
  ctx.beginPath();
  ctx.moveTo(x - s * 0.5, y); ctx.lineTo(x - s * 0.15, y + s * 0.35); ctx.lineTo(x + s * 0.55, y - s * 0.4);
  ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
}
export function star(ctx, x, y, r, fill) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, rad = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
  }
  ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
}
export function avatar(ctx, x, y, r, m) {
  circle(ctx, x, y, r, m.c);
  const label = m.n === 'You' ? 'You' : m.n[0];
  ctx.textBaseline = 'middle';
  text(ctx, label, x, y + r * 0.04, BOLD(m.n === 'You' ? r * 0.62 : r * 0.9), '#fff', 'center');
  ctx.textBaseline = 'alphabetic';
}
export function withAlpha(ctx, a, fn) {
  if (a <= 0.001) return;
  ctx.save(); ctx.globalAlpha *= clamp(a); fn(); ctx.restore();
}
export function shadow(ctx, blur, dy, a = 0.12) {
  ctx.shadowColor = `rgba(12,18,34,${a})`; ctx.shadowBlur = blur; ctx.shadowOffsetY = dy;
}
export function noShadow(ctx) { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; }
