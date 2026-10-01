#!/usr/bin/env python3
"""Synthesize the film's score from dist/cues.json (written by export-cues.mjs).

Nothing is sampled: oscillators, noise and filters only. 120 BPM, F major.
Sonic signature: a tuned ball "thock" — on the drop, the merge, and twice at the
end (F3 then C3), the way the film's dot ticks twice.

    node export-cues.mjs && python3 score.py   ->  dist/score.wav, dist/score.mp3
"""
import json, os, subprocess
import numpy as np
import soundfile as sf
from synth import *  # SR, rng, hz, m, tt, place, filters, instruments, master

HERE = os.path.dirname(os.path.abspath(__file__))
Q = json.load(open(os.path.join(HERE, 'dist', 'cues.json')))
DUR = Q['DURATION']
N = int(SR * DUR)

dry = np.zeros((2, N))
send = np.zeros((2, N))  # -> reverb
duckable = np.zeros((2, N))  # pads + bass, ducked by the kick
kick_env = np.zeros(N)


# ---------------------------------------------------------------- the cue sheet
PENTA = [m(n) for n in ['F5', 'G5', 'A5', 'C6', 'D6', 'F6', 'G6', 'A6']]

# Act 1 — chat pops, getting denser and more out of tune
for i, t0 in enumerate(Q['chat']):
    if t0 < 0: continue
    chaos = t0 >= 4.1
    note = PENTA[int(rng.integers(0, len(PENTA)))]
    cents = rng.uniform(-45, 45) if chaos else 0
    f = hz(note + cents / 100)
    place(dry, t0, pop(f), 0.34 if not chaos else 0.26, pan=rng.uniform(-0.8, 0.8) if chaos else (-0.25 if i % 2 else 0.25))
    place(send, t0, pop(f), 0.1)
# tension bed on the dominant, rising under the pile-on
d = 5.75
t = tt(d)
drone = sum(np.sin(2 * np.pi * hz(m(n)) * t * (1 + 0.003 * k)) for k, n in enumerate(['C2', 'C3', 'G3']))
drone = lp(drone, 500) * (t / d) ** 2 * 0.22
place(duckable, 0, drone)
place(dry, 2.0, sweep(3.75, 300, 5000, 1.5) * np.linspace(0.2, 1, int(3.75 * SR)), 0.35)
# the two headline hits
place(dry, Q['headline'][0], boom(1.2), 0.45)
place(dry, Q['headline'][0], stab([m('C3'), m('G3'), m('C4')], 0.6), 0.25)
place(dry, Q['headline'][1], boom(1.2), 0.6)
place(dry, Q['headline'][1], stab([m('B2'), m('F3'), m('B3')], 0.7), 0.3)
place(send, Q['headline'][1], stab([m('B2'), m('F3'), m('B3')], 0.7), 0.15)
# suck into silence, then the drop
im0, im1 = Q['implode']
place(dry, im0 - 0.35, riser(im1 - im0 + 0.33, 200, 3000), 0.5)

drop = Q['drop']
place(dry, drop, boom(), 0.95)
place(dry, drop, thock(hz(m('F3'))), 0.7)
for n, g in (('F4', 0.3), ('A4', 0.22), ('C5', 0.22), ('F5', 0.18), ('C6', 0.1)):
    place(dry, drop, bell(hz(m(n)), 4.0), g * 0.6)
    place(send, drop, bell(hz(m(n)), 4.0), g * 0.8)
place(dry, drop, sweep(1.0, 6000, 400, 0.6), 0.3)

# Act 2 — the dot splits, the mark lands, the name
place(dry, Q['split'][0], mallet(hz(m('C6')), 0.8), 0.18, pan=-0.3)
place(dry, Q['split'][0] + 0.25, mallet(hz(m('F6')), 0.8), 0.18, pan=0.3)
place(dry, Q['logoIn'], bell(hz(m('A5')), 2.5, 1.5), 0.22)
place(send, Q['logoIn'], bell(hz(m('A5')), 2.5, 1.5), 0.25)
place(dry, Q['wordIn'] - 0.15, sweep(0.6, 800, 4000, 1.0), 0.18)

# chord bed from the drop: Bb | F/A | Dm | C, a bar each (2s)
PROG = [['Bb3', 'D4', 'F4'], ['A3', 'C4', 'F4'], ['A3', 'D4', 'F4'], ['G3', 'C4', 'E4']]
ROOT = ['Bb1', 'A1', 'D2', 'C2']
bar = 2.0
b0 = drop
k = 0
while b0 < Q['collapse'][0] - 0.01:
    d = min(bar, Q['collapse'][0] + 0.25 - b0)
    ch = [m(n) for n in PROG[k % 4]]
    level = 0.55 if b0 < 10 else 0.8
    place(duckable, b0, pad(ch, d + 0.4, 1100 if b0 < 15 else 1800), level)
    place(send, b0, pad(ch, d + 0.4, 1100), 0.25)
    if b0 >= 8.0:  # bass on every beat from the product reveal
        for bt in np.arange(0, d - 0.01, 0.5):
            tb = tt(0.45)
            x = np.tanh(1.5 * np.sin(2 * np.pi * hz(m(ROOT[k % 4])) * tb)) * np.exp(-tb / 0.25) * (1 - np.exp(-tb / 0.004))
            place(duckable, b0 + bt, x, 0.42)
    b0 += bar; k += 1

# drums: kick from the heatmap, hats from the tap, claps from "Game on"
for bt in np.arange(10.0, Q['collapse'][0] - 0.01, 0.5):
    if Q['touch'][0] <= bt < Q['tap']: continue  # breath before the tap
    place(dry, bt, kick(), 0.8)
    i0 = int(bt * SR); e = np.exp(-tt(0.3) / 0.08)
    kick_env[i0:i0 + len(e)] = np.maximum(kick_env[i0:i0 + len(e)], e[:max(0, min(len(e), N - i0))])
for bt in np.arange(Q['tap'] + 0.25, Q['collapse'][0] - 0.01, 0.5):
    place(dry, bt, hat(), 0.16, pan=0.35)
for bt in np.arange(Q['gameOn'] + 0.5, Q['collapse'][0] - 0.01, 1.0):
    place(dry, bt, clap(), 0.35)
    place(send, bt, clap(), 0.12)

# Act 3/4 — the dot drops into Thursday 19:00, members arrive
place(dry, Q['dotFly'][0], sweep(Q['dotFly'][1] - Q['dotFly'][0], 500, 2500, 0.8), 0.18)
place(dry, Q['dotFly'][1], thock(hz(m('C4')), 0.25), 0.35)
place(dry, Q['dotFly'][1], mallet(hz(m('F5'))), 0.25)
place(send, Q['dotFly'][1], mallet(hz(m('F5'))), 0.2)
for j in range(10):  # the grid unfolding: a quick glassy ripple
    place(dry, Q['gridIn'] + j * 0.04, mallet(hz(m('C7') + [0, 2, 4, 7, 9][j % 5]), 0.4), 0.05, pan=np.sin(j))
place(dry, Q['you'], mallet(hz(m('C5'))), 0.25)
ARP = ['A4', 'C5', 'D5', 'F5', 'G5', 'A5', 'C6', 'D6', 'F6']
for j, t0 in enumerate(Q['members']):
    place(dry, t0, mallet(hz(m(ARP[j]))), 0.26, pan=-0.5 + j / 8)
    place(send, t0, mallet(hz(m(ARP[j]))), 0.15)
place(dry, Q['best'], bell(hz(m('F6')), 2.5, 1.2), 0.18)
place(send, Q['best'], bell(hz(m('F6')), 2.5, 1.2), 0.25)
place(dry, Q['pill'], mallet(hz(m('C6'))), 0.2)
place(dry, Q['pill'] + 0.125, mallet(hz(m('F6'))), 0.2)

# Act 5 — tap, morph, RSVPs, Game on
place(dry, Q['tap'], thock(hz(m('F4')), 0.2), 0.45)
place(dry, Q['tap'], hat(0.02), 0.5)
place(dry, Q['morph'][0], sweep(Q['morph'][1] - Q['morph'][0] + 0.2, 400, 6000, 1.4), 0.3)
place(dry, Q['morph'][1] - 0.05, mallet(hz(m('F5'))), 0.25)
UP = ['G5', 'A5', 'Bb5', 'C6', 'D6', 'E6', 'F6', 'G6', 'A6']
for j, t0 in enumerate(Q['rsvps']):
    place(dry, t0 + 0.08, mallet(hz(m(UP[j]))), 0.24, pan=-0.6 + j * 0.15)
    place(send, t0 + 0.08, mallet(hz(m(UP[j]))), 0.12)
go = Q['gameOn']
place(dry, go, stab([m('F3'), m('A3'), m('C4'), m('F4'), m('A4')], 1.2), 0.5)
place(send, go, stab([m('F3'), m('A3'), m('C4'), m('F4'), m('A4')], 1.2), 0.2)
place(dry, go, boom(1.0), 0.35)
place(dry, go, hp(rng.standard_normal(int(1.5 * SR)), 5000) * np.exp(-tt(1.5) / 0.4), 0.12)
for j in range(14):  # confetti sparkle
    n = PENTA[int(rng.integers(3, len(PENTA)))] + 12
    place(dry, go + 0.04 + j * 0.055, mallet(hz(n), 0.5), 0.06, pan=rng.uniform(-0.9, 0.9))
    place(send, go + 0.04 + j * 0.055, mallet(hz(n), 0.5), 0.05)

# Act 6 — pull back, rings of games appear
z0, z1 = Q['zoom']
place(dry, z0, sweep(z1 - z0, 5000, 300, 0.7), 0.35)
RING = ['F5', 'A5', 'C6', 'D6', 'F6', 'A6', 'C7', 'D7']
for j in range(1, Q['rings'] + 1):
    t0 = Q['ringsStart'] + j * Q['ringStep']
    place(dry, t0, mallet(hz(m(RING[j - 1])), 0.7), 0.16, pan=(-1) ** j * 0.5)
    place(send, t0, mallet(hz(m(RING[j - 1])), 0.7), 0.14)
place(dry, Q['caption'][0], bell(hz(m('C6')), 2.5, 1.0), 0.14)
place(send, Q['caption'][0], bell(hz(m('C6')), 2.5, 1.0), 0.2)

# Act 7 — everything collapses to the dot, then home
c0 = Q['collapse'][0]
place(dry, c0, riser(Q['merge'] - c0 - 0.02, 150, 2400), 0.55)
place(dry, Q['merge'], boom(1.8), 0.6)
place(dry, Q['merge'], thock(hz(m('F3'))), 0.6)
place(duckable, Q['merge'], pad([m('Bb3'), m('D4'), m('F4'), m('C5')], Q['tagline'][1] - Q['merge'] + 0.5, 1200, 0.1), 0.6)
place(dry, Q['split2'][0], mallet(hz(m('C6')), 0.8), 0.16, pan=-0.3)
place(dry, Q['split2'][0] + 0.25, mallet(hz(m('F6')), 0.8), 0.16, pan=0.3)
place(dry, Q['logo2In'], bell(hz(m('A5')), 2.5, 1.5), 0.2)
place(send, Q['logo2In'], bell(hz(m('A5')), 2.5, 1.5), 0.2)
place(dry, Q['word2In'] - 0.15, sweep(0.6, 800, 4000, 1.0), 0.15)
place(dry, Q['tagline'][0], mallet(hz(m('C5'))), 0.22)
res = Q['tagline'][1]  # "Game on." — the resolution to F
end_d = DUR - res + 0.5
place(duckable, res, pad([m('F3'), m('A3'), m('C4'), m('G4'), m('A4')], end_d, 1500, 0.05, 2.5), 0.75)
place(send, res, pad([m('F3'), m('A3'), m('C4'), m('G4'), m('A4')], end_d, 1500, 0.05, 2.5), 0.3)
for n, g in (('F2', 0.5), ('F4', 0.25), ('A4', 0.2), ('C5', 0.2), ('F5', 0.15)):
    place(dry, res, bell(hz(m(n)), 3.5), g * 0.5)
    place(send, res, bell(hz(m(n)), 3.5), g * 0.5)
# the signature: two ball thocks, tuned F3 then C3
for tk, n in zip(Q['ticks'], ('F3', 'C3')):
    place(dry, tk, thock(hz(m(n)), 0.4), 0.9)
    place(send, tk, thock(hz(m(n)), 0.4), 0.25)

mix = master(dry, send, duckable, kick_env)

wav = os.path.join(HERE, 'dist', 'score.wav')
sf.write(wav, mix.T, SR, subtype='PCM_24')
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav, '-b:a', '192k', os.path.join(HERE, 'dist', 'score.mp3')], check=True)
print('wrote dist/score.wav, dist/score.mp3')

