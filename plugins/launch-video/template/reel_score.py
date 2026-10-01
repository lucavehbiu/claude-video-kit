#!/usr/bin/env python3
"""Score for a 9:16 reel cut, from the cue sheet the reel itself exports.

Every section declares its beds (tension / calm / groove / resolve) and its hits, so a
cut of any sections in any order gets a score that follows it. 120 BPM, F major, one
chord per 2s bar on a global grid, so sections always land on the same harmony.

    node render.mjs --reel long --cues && python3 reel_score.py long
    -> dist/reels/long.wav, long.mp3
"""
import json, os, subprocess, sys
import numpy as np
import soundfile as sf
from synth import *  # SR, rng, hz, m, tt, place, filters, instruments, master

HERE = os.path.dirname(os.path.abspath(__file__))
name = sys.argv[1] if len(sys.argv) > 1 else 'long'
Q = json.load(open(os.path.join(HERE, 'dist', 'reels', f'{name}.cues.json')))
DUR = Q['duration']
N = int(SR * DUR)
dry, send, duckable = (np.zeros((2, N)) for _ in range(3))
kick_env = np.zeros(N)

PROG = [['Bb3', 'D4', 'F4'], ['A3', 'C4', 'F4'], ['A3', 'D4', 'F4'], ['G3', 'C4', 'E4']]
ROOT = ['Bb1', 'A1', 'D2', 'C2']
PENTA = [m(n) for n in ['F5', 'G5', 'A5', 'C6', 'D6', 'F6', 'G6', 'A6']]
ARP = [m(n) for n in ['A4', 'C5', 'D5', 'F5', 'G5', 'A5', 'C6', 'D6', 'F6', 'G6']]
BELLS = [m(n) for n in ['F6', 'A5', 'C6', 'F6', 'A6']]


def fade(x, a=0.02, b=0.05):
    n = x.shape[-1]; ia, ib = min(n, int(a * SR)), min(n, int(b * SR))
    x[..., :ia] *= np.linspace(0, 1, ia); x[..., n - ib:] *= np.linspace(1, 0, ib)
    return x


# ---------------------------------------------------------------- beds
for bed in Q['beds']:
    a, b, mood = bed['a'], bed['b'], bed['mood']
    if mood == 'tension':
        d = b - a; t = tt(d)
        drone = sum(np.sin(2 * np.pi * hz(m(n)) * t * (1 + 0.003 * k)) for k, n in enumerate(['C2', 'C3', 'G3']))
        place(duckable, a, fade(lp(drone, 500) * (0.35 + 0.65 * (t / d) ** 2) * 0.2))
        continue
    if mood == 'resolve':
        notes = [m(n) for n in ['F3', 'A3', 'C4', 'G4', 'A4']]
        place(duckable, a, pad(notes, b - a + 0.3, 1500, 0.4, 2.5), 0.7)
        place(send, a, pad(notes, b - a + 0.3, 1500, 0.4, 2.5), 0.3)
        continue
    # calm / groove: chords on the global 2s grid
    bar = np.floor(a / 2) * 2
    while bar < b - 0.01:
        s0, s1 = max(bar, a), min(bar + 2, b)
        k = int(bar // 2) % 4
        ch = [m(n) for n in PROG[k]]
        place(duckable, s0, pad(ch, s1 - s0 + 0.35, 1100 if mood == 'calm' else 1700, 0.15, 0.4), 0.5 if mood == 'calm' else 0.75)
        place(send, s0, pad(ch, s1 - s0 + 0.35, 1100, 0.15, 0.4), 0.22)
        if mood == 'groove':
            for bt in np.arange(s0, s1 - 0.01, 0.5):
                tb = tt(0.45)
                x = np.tanh(1.5 * np.sin(2 * np.pi * hz(m(ROOT[k])) * tb)) * np.exp(-tb / 0.25) * (1 - np.exp(-tb / 0.004))
                place(duckable, bt, x, 0.4)
                place(dry, bt, kick(), 0.75)
                i0 = int(bt * SR); e = np.exp(-tt(0.3) / 0.08)
                n_ = max(0, min(len(e), N - i0)); kick_env[i0:i0 + n_] = np.maximum(kick_env[i0:i0 + n_], e[:n_])
                place(dry, bt + 0.25, hat(), 0.14, pan=0.35)
                if abs((bt % 1.0) - 0.5) < 1e-6:
                    place(dry, bt, clap(), 0.28); place(send, bt, clap(), 0.1)
        bar += 2

# ---------------------------------------------------------------- hits
def both(t, x, g, gs, pan=0.0):
    place(dry, t, x, g, pan=pan); place(send, t, x, gs, pan=pan)

for c in Q['cues']:
    t, kind, arg = c['t'], c['type'], c['arg']
    if kind == 'pop':
        note = PENTA[int(rng.integers(0, len(PENTA)))]
        f = hz(note + (rng.uniform(-45, 45) / 100 if arg else 0))
        both(t, pop(f), 0.26 if arg else 0.34, 0.1, pan=rng.uniform(-0.8, 0.8) if arg else rng.choice([-0.25, 0.25]))
    elif kind == 'riser':
        place(dry, t, sweep(arg, 300, 5000, 1.5) * np.linspace(0.2, 1, int(arg * SR)), 0.35)
    elif kind == 'hit':
        place(dry, t, boom(1.2), 0.45 if arg == 0 else 0.6)
        ch = [m('C3'), m('G3'), m('C4')] if arg == 0 else [m('B2'), m('F3'), m('B3')]
        both(t, stab(ch, 0.6 + 0.1 * arg), 0.25 + 0.05 * arg, 0.15 * arg)
    elif kind == 'ding':  # push notification
        both(t, mallet(hz(m('E6')), 0.6), 0.22, 0.12)
        both(t + 0.09, mallet(hz(m('B6')), 0.8), 0.2, 0.12)
    elif kind == 'ping':  # sonar: out there, nobody answers
        x = bell(hz(m('C6')), 2.0, 0.6)
        place(dry, t, lp(x, 2500), 0.16); place(send, t, x, 0.35)
    elif kind == 'reveal':
        place(dry, t, boom(1.6), 0.55)
        place(dry, t, thock(hz(m('F3'))), 0.5)
        for n, g in (('F4', 0.3), ('A4', 0.22), ('C5', 0.22), ('F5', 0.18)):
            both(t, bell(hz(m(n)), 3.5), g * 0.5, g * 0.7)
        place(dry, t, sweep(0.9, 6000, 400, 0.6), 0.25)
    elif kind == 'drop':
        place(dry, t, boom(), 0.8)
        place(dry, t, thock(hz(m('F3'))), 0.6)
        for n, g in (('F4', 0.3), ('A4', 0.22), ('C5', 0.22), ('F5', 0.18), ('C6', 0.1)):
            both(t, bell(hz(m(n)), 4.0), g * 0.5, g * 0.7)
    elif kind == 'pluck':
        both(t, mallet(hz(ARP[int(arg) % len(ARP)])), 0.24, 0.13, pan=((int(arg) % 5) - 2) * 0.2)
    elif kind == 'bell':
        both(t, bell(hz(BELLS[int(arg) % len(BELLS)]), 2.5, 1.2), 0.17, 0.24)
    elif kind == 'whoosh':
        place(dry, t, sweep(0.6, 800, 4000, 1.0), 0.18)
    elif kind == 'tap':
        place(dry, t, thock(hz(m('F4')), 0.2), 0.42); place(dry, t, hat(0.02), 0.45)
    elif kind == 'stab':
        ch = [[m('F3'), m('A3'), m('C4'), m('F4')], [m('A3'), m('C4'), m('F4'), m('A4')], [m('C4'), m('F4'), m('A4'), m('C5')]][int(arg) % 3]
        both(t, stab(ch, 0.8), 0.32, 0.14)
    elif kind == 'gameon':
        ch = [m('F3'), m('A3'), m('C4'), m('F4'), m('A4')]
        both(t, stab(ch, 1.2), 0.5, 0.2)
        place(dry, t, boom(1.0), 0.35)
        place(dry, t, hp(rng.standard_normal(int(1.5 * SR)), 5000) * np.exp(-tt(1.5) / 0.4), 0.12)
        for j in range(14):
            n = PENTA[int(rng.integers(3, len(PENTA)))] + 12
            both(t + 0.04 + j * 0.055, mallet(hz(n), 0.5), 0.06, 0.05, pan=rng.uniform(-0.9, 0.9))
    elif kind == 'stars':  # a star lands per tap, climbing
        for j in range(int(arg)):
            both(t + j * 0.06, mallet(hz(m(['C6', 'D6', 'F6', 'G6', 'A6'][j])), 0.5), 0.12, 0.06, pan=-0.4 + j * 0.2)
    elif kind == 'resolve':
        for n, g in (('F2', 0.5), ('F4', 0.25), ('A4', 0.2), ('C5', 0.2), ('F5', 0.15)):
            both(t, bell(hz(m(n)), 3.5), g * 0.5, g * 0.5)
    elif kind == 'tick':  # the signature: ball thocks, F3 then C3
        both(t, thock(hz(m('F3' if arg == 0 else 'C3')), 0.4), 0.9, 0.25)
    elif kind == 'suck':  # outgoing section implodes into the dot
        place(dry, t, riser(arg, 200, 2400), 0.3)
    elif kind == 'thock':  # ...and the next one opens out of it
        place(dry, t, thock(hz(m('F3'))), 0.45)
        if arg: place(dry, t, boom(1.4), 0.5)
    else:
        raise SystemExit(f'unknown cue type {kind!r} at {t}s')

mix = master(dry, send, duckable, kick_env, tail=0.6)
out = os.path.join(HERE, 'dist', 'reels', name)
sf.write(out + '.wav', mix.T, SR, subtype='PCM_24')
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', out + '.wav', '-b:a', '160k', out + '.mp3'], check=True)
print(f'wrote dist/reels/{name}.wav/.mp3 ({DUR}s)')
