#!/usr/bin/env python3
"""Bundle src/ into self-contained pages:

  dist/playpals-launch-film.html   16:9 hero film  (score inlined if dist/score.mp3 exists)
  dist/playpals-reels.html         9:16 modular reels (scores inlined for each named cut in dist/reels/)

Fonts and the icon come from assets/brand (base64); app captures and photos from assets/captures.

    python3 build.py
"""
import base64, glob, json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(HERE, 'assets', 'brand')  # fonts + app icon, base64
os.makedirs(os.path.join(HERE, 'dist'), exist_ok=True)

def b64(name):
    return open(os.path.join(ASSETS, name)).read().replace('\n', '')

def b64file(path):
    return base64.b64encode(open(os.path.join(HERE, path), 'rb').read()).decode()

def module(path):
    # the src files are ES modules for readability; each page wants one classic script
    src = open(os.path.join(HERE, 'src', path)).read()
    src = re.sub(r'^import [\s\S]*?;\n', '', src, flags=re.M)
    return re.sub(r'^export ', '', src, flags=re.M)

FONTS = {
    '@@BRICOLAGE@@': b64('bricolage800.b64'),
    '@@SATOSHI_MED@@': b64('satoshi-med.b64'),
    '@@SATOSHI_BOLD@@': b64('satoshi-bold.b64'),
    '@@ICON@@': b64('icon.b64'),
}

def build(template, out, subs):
    html = open(os.path.join(HERE, 'src', template)).read()
    for k, v in {**FONTS, **subs}.items():
        html = html.replace(k, v)
    assert '@@' not in html, f'unresolved placeholder in {template}'
    open(os.path.join(HERE, 'dist', out), 'w').write(html)
    print(f'built dist/{out} ({len(html) / 1e6:.2f} MB)')

score = os.path.join(HERE, 'dist', 'score.mp3')
build('film.template.html', 'playpals-launch-film.html', {
    '@@FILM_JS@@': module('timeline.js') + '\n' + module('film.js'),
    '@@SCORE@@': ('data:audio/mpeg;base64,' + base64.b64encode(open(score, 'rb').read()).decode()) if os.path.exists(score) else '',
})

scores = {}
for mp3 in sorted(glob.glob(os.path.join(HERE, 'dist', 'reels', '*.mp3'))):
    name = os.path.basename(mp3)[:-4]
    scores[name] = 'data:audio/mpeg;base64,' + base64.b64encode(open(mp3, 'rb').read()).decode()
build('reel.template.html', 'playpals-reels.html', {
    '@@REEL_JS@@': module('lib.js') + '\n' + module('reel.js'),
    '@@SCORES@@': json.dumps(scores),
    '@@SHOT_MAP@@': b64file('assets/captures/map.jpg'),
    '@@SHOT_GROUP@@': b64file('assets/captures/group.jpg'),
    '@@SHOT_EVENT@@': b64file('assets/captures/event-detail.jpg'),
    '@@SHOT_AVAIL@@': b64file('assets/captures/availability.jpg'),
    # real photos are optional: drop assets/captures/photo-goal.jpg / photo-bbq.jpg in and rebuild
    '@@PHOTOS@@': json.dumps({k: 'data:image/jpeg;base64,' + b64file(f'assets/captures/photo-{k}.jpg')
                              for k in ('goal', 'bbq') if os.path.exists(os.path.join(HERE, f'assets/captures/photo-{k}.jpg'))}),
})
print('reel scores inlined:', ', '.join(scores) or 'none')
