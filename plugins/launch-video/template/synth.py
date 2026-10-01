"""Shared synth: oscillators, noise and filters, plus the master chain.
Used by score.py (16:9 film) and reel_score.py (9:16 reels). Nothing is sampled."""
import numpy as np
from scipy import signal
from scipy.ndimage import minimum_filter1d
import pyloudnorm as pyln

SR = 48000
rng = np.random.default_rng(11)


def hz(m): return 440.0 * 2 ** ((m - 69) / 12)
NOTE = {n: i for i, n in enumerate(['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'])}
def m(name):  # 'F4' -> midi
    return 12 * (int(name[-1]) + 1) + NOTE[name[:-1]]


def tt(d): return np.arange(int(SR * d)) / SR


def place(bus, t0, x, gain=1.0, pan=0.0):
    i0 = int(round(t0 * SR))
    N = bus.shape[1]
    if i0 >= N: return
    if x.ndim == 1:
        l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        x = np.stack([x * l * 1.414, x * r * 1.414])
    s = max(0, -i0)
    x = x[:, s:]
    i0 = max(i0, 0)
    n = min(x.shape[1], N - i0)
    bus[:, i0:i0 + n] += gain * x[:, :n]



def lp(x, fc, order=2):
    return signal.sosfilt(signal.butter(order, fc, 'low', fs=SR, output='sos'), x)
def hp(x, fc, order=2):
    return signal.sosfilt(signal.butter(order, fc, 'high', fs=SR, output='sos'), x)
def bp(x, lo, hi, order=2):
    return signal.sosfilt(signal.butter(order, [lo, hi], 'band', fs=SR, output='sos'), x)


# ---------------------------------------------------------------- instruments
def thock(f, d=0.35):
    t = tt(d)
    ph = 2 * np.pi * np.cumsum(f * (1 + 1.4 * np.exp(-t / 0.012))) / SR
    body = np.sin(ph) * np.exp(-t / 0.075)
    knock = np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t / 0.02) * 0.35
    click = lp(rng.standard_normal(len(t)), 3500) * np.exp(-t / 0.004) * 0.6
    return np.tanh(1.6 * (body + knock + click)) * 0.8


def pop(f, d=0.12):
    t = tt(d)
    ph = 2 * np.pi * np.cumsum(f * (0.72 + 0.28 * (1 - np.exp(-t / 0.012)))) / SR
    return np.sin(ph) * np.exp(-t / 0.035) * (1 - np.exp(-t / 0.002))


def mallet(f, d=1.2):
    t = tt(d)
    return (np.sin(2 * np.pi * f * t) * np.exp(-t / 0.35)
            + 0.25 * np.sin(2 * np.pi * f * 2 * t) * np.exp(-t / 0.15)
            + 0.18 * np.sin(2 * np.pi * f * 3.99 * t) * np.exp(-t / 0.05)) * (1 - np.exp(-t / 0.003))


def bell(f, d=3.0, idx=2.2):
    t = tt(d)
    mod = idx * np.exp(-t / 0.5) * np.sin(2 * np.pi * f * 3.5 * t)
    return np.sin(2 * np.pi * f * t + mod) * np.exp(-t / 0.9) * (1 - np.exp(-t / 0.002))


def saw(f, t, harm=14):
    out = np.zeros_like(t)
    for k in range(1, harm + 1):
        if f * k > 9000: break
        out += np.sin(2 * np.pi * f * k * t + k) / k
    return out


def pad(notes, d, cutoff=1400, att=0.25, rel=0.6):
    t = tt(d)
    x = sum(saw(hz(n) * (1 + dt), t) for n in notes for dt in (-0.004, 0, 0.004))
    x = lp(x, cutoff, 2) / (3 * len(notes))
    env = np.minimum(1, t / att) * np.minimum(1, (d - t) / rel).clip(0)
    return x * env


def stab(notes, d=0.9):
    t = tt(d)
    x = sum(saw(hz(n), t, 20) for n in notes) / len(notes)
    cut = 600 + 5000 * np.exp(-t / 0.12)
    y = np.zeros_like(x); a = 0.0  # time-varying one-pole lowpass
    for i in range(len(x)):
        k = 1 - np.exp(-2 * np.pi * cut[i] / SR)
        a += k * (x[i] - a); y[i] = a
    return y * np.exp(-t / 0.35)


def kick(d=0.4):
    t = tt(d)
    f = 45 + 95 * np.exp(-t / 0.03)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.16)
    return np.tanh(2 * x) * 0.9


def hat(d=0.05):
    t = tt(d)
    return hp(rng.standard_normal(len(t)), 7000) * np.exp(-t / 0.012)


def clap(d=0.25):
    t = tt(d)
    n = bp(rng.standard_normal(len(t)), 900, 2600)
    env = sum(np.exp(-np.clip(t - o, 0, None) / 0.008) * (t >= o) for o in (0, 0.011, 0.023)) + 0.6 * np.exp(-t / 0.08)
    return n * env * 0.5


def boom(d=2.2):
    t = tt(d)
    f = 30 + 45 * np.exp(-t / 0.15)
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.7)
    rumble = lp(rng.standard_normal(len(t)), 180) * np.exp(-t / 0.4) * 1.5
    return np.tanh(1.5 * (sub + rumble))


def sweep(d, f0, f1, curve=2.0, q=0.35):
    """filtered-noise whoosh whose centre glides f0 -> f1"""
    t = tt(d); u = t / d
    fc = f0 * (f1 / f0) ** (u ** curve)
    x = rng.standard_normal(len(t))
    y = np.zeros_like(x); a = b = 0.0
    for i in range(len(x)):  # two cascaded one-poles, cheap and smooth
        k = 1 - np.exp(-2 * np.pi * fc[i] / SR)
        a += k * (x[i] - a); b += k * (a - b); y[i] = b
    y = y - lp(y, np.clip(f0 * q, 30, 2000))
    return y * np.sin(np.pi * u) ** 1.5


def riser(d, f0, f1):
    """noise + tone swell that ends hard — sucked into the cut"""
    t = tt(d); u = t / d
    noise = hp(rng.standard_normal(len(t)), 400) * u ** 3
    tone = np.sin(2 * np.pi * np.cumsum(f0 * (f1 / f0) ** u) / SR) * u ** 2
    return noise / (np.abs(noise).max() + 1e-9) * 0.6 + tone * 0.3



def master(dry, send, duckable, kick_env, tail=0.8, lufs_target=-14.0):
    """sidechain, reverb, -14 LUFS, -1 dBTP limiter. Returns the stereo mix."""
    N = dry.shape[1]
    kf = signal.lfilter([0.02], [1, -0.98], kick_env)  # smooth the sidechain
    dry = dry + duckable * (1 - 0.55 * np.clip(kf / (kf.max() + 1e-9), 0, 1))

    ir_t = tt(2.6)
    ir = np.stack([lp(rng.standard_normal(len(ir_t)), 6000) * np.exp(-ir_t / 0.55) for _ in range(2)])
    ir[:, :int(0.012 * SR)] = 0  # pre-delay
    wet = np.stack([signal.fftconvolve(send[c], ir[c])[:N] for c in range(2)])
    wet /= np.abs(wet).max() + 1e-9
    mix = dry + 0.35 * wet * np.abs(dry).max()

    mix = hp(mix, 25)
    # fade the tail
    f = int(tail * SR)
    mix[:, -f:] *= np.linspace(1, 0, f) ** 2

    meter = pyln.Meter(SR)
    lufs = meter.integrated_loudness(mix.T)
    mix *= 10 ** ((lufs_target - lufs) / 20)
    # peak limiter: -1 dBTP, measured on the 4x oversampled signal, 4ms blocks, lookahead
    ceiling = 10 ** (-1.2 / 20)
    blk = int(0.004 * SR)
    over = np.abs(signal.resample_poly(mix, 4, 1, axis=1)).max(axis=0)
    nb = N // blk + 1
    peak = np.array([over[i * blk * 4:(i + 1) * blk * 4].max(initial=0) for i in range(nb)])
    g = minimum_filter1d(np.minimum(1, ceiling / (peak + 1e-9)), 3)
    mix *= np.interp(np.arange(N), np.arange(nb) * blk + blk / 2, g)
    tp = 20 * np.log10(np.abs(signal.resample_poly(mix, 4, 1, axis=1)).max())
    print(f'integrated {meter.integrated_loudness(mix.T):.1f} LUFS, true peak {tp:.2f} dBTP')
    return mix
