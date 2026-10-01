// Deterministic renderer: headless Chromium draws each frame (with sub-frame motion
// blur), JPEG frames stream into ffmpeg, the score is muxed on.
//
//   node render.mjs                          16:9 film   -> dist/playpals-launch-film.mp4
//   node render.mjs --reel long              9:16 cut    -> dist/reels/long.mp4 (+ long-silent.mp4)
//   node render.mjs --reel chat,brand,end    any sections, in any order
//   node render.mjs --reel long --cues       just write dist/reels/long.cues.json (for score.py)
//   --stills 3,7.5   PNG stills to dist/stills/      --fast   no motion blur
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdirSync, existsSync, writeFileSync, renameSync } from 'node:fs';
import { FPS, DURATION } from './src/timeline.js';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/node22/lib/node_modules/playwright');

const args = process.argv.slice(2);
const opt = (k) => (args.includes(k) ? args[args.indexOf(k) + 1] : null);
const reel = opt('--reel');
const stillsArg = opt('--stills');
const SUB = args.includes('--fast') ? 1 : 4;

const run = (cmd, a) => new Promise((res, rej) => spawn(cmd, a, { stdio: 'inherit' }).on('close', (c) => (c ? rej(new Error(`${cmd} failed`)) : res())));

const page_ = reel ? `playpals-reels.html?render=1&cut=${encodeURIComponent(reel)}` : 'playpals-launch-film.html?render=1';
const [VW, VH, fps] = reel ? [1080, 1920, 30] : [1920, 1080, FPS];
const name = reel ? reel.replace(/,/g, '+') : null;

const browser = await chromium.launch({ args: ['--force-device-scale-factor=1', '--hide-scrollbars'] });
const page = await browser.newPage({ viewport: { width: VW, height: VH } });
page.on('pageerror', (e) => { console.error('page error:', e); process.exit(1); });
await page.goto(new URL(`./dist/${page_}`, import.meta.url).href);
await page.waitForFunction(() => window.__ready === true);
const canvas = await page.$('#c');
const duration = reel ? await page.evaluate(() => window.__duration) : DURATION;

if (reel) {
  mkdirSync('dist/reels', { recursive: true });
  writeFileSync(`dist/reels/${name}.cues.json`, JSON.stringify(await page.evaluate(() => window.__cues), null, 1));
  if (args.includes('--cues')) { console.log(`wrote dist/reels/${name}.cues.json (${duration}s)`); await browser.close(); process.exit(0); }
}

if (stillsArg) {
  mkdirSync('dist/stills', { recursive: true });
  for (const s of stillsArg.split(',').map(Number)) {
    await page.evaluate(([f, n]) => window.renderFrame(f, n), [Math.round(s * fps), SUB]);
    await canvas.screenshot({ path: `dist/stills/${reel ? 'r' : 't'}${s.toFixed(2).padStart(6, '0')}.png` });
  }
  console.log('stills:', stillsArg);
  await browser.close();
  process.exit(0);
}

const out = reel ? `dist/reels/${name}.mp4` : 'dist/playpals-launch-film.mp4';
const silent = out.replace('.mp4', '.video.mp4');
// reels: 10–12 Mbps per marketing/social-playbook.md, so type survives the platform re-encode
const venc = reel ? ['-b:v', '11M', '-maxrate', '12M', '-bufsize', '24M', '-profile:v', 'high'] : ['-crf', '16'];
const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
  '-c:v', 'libx264', '-preset', 'slow', ...venc, '-pix_fmt', 'yuv420p', '-movflags', '+faststart', silent], { stdio: ['pipe', 'inherit', 'inherit'] });
const frames = Math.round(duration * fps);
const t0 = Date.now();
for (let f = 0; f < frames; f++) {
  await page.evaluate(([f, n]) => window.renderFrame(f, n), [f, SUB]);
  const buf = await canvas.screenshot({ type: 'jpeg', quality: 95 });
  if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
  if (f % 120 === 0) console.log(`${name || 'film'} frame ${f}/${frames}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
ff.stdin.end();
await new Promise((r) => ff.on('close', r));
await browser.close();

const wav = reel ? `dist/reels/${name}.wav` : 'dist/score.wav';
if (existsSync(wav)) {
  await run('ffmpeg', ['-y', '-loglevel', 'error', '-i', silent, '-i', wav, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '320k', '-shortest', '-movflags', '+faststart', out]);
  console.log('wrote', out);
} else {
  renameSync(silent, out);
  console.log('wrote', out, '(no score: run score.py first)');
}
if (reel) {
  // organic-post variant: silent AAC so the platform's own audio is the only audio (playbook rule 2)
  await run('ffmpeg', ['-y', '-loglevel', 'error', '-i', existsSync(silent) ? silent : out, '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo',
    '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-shortest', '-movflags', '+faststart', out.replace('.mp4', '-silent.mp4')]);
}
if (existsSync(silent)) spawn('rm', [silent]);
