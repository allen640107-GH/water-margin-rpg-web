#!/usr/bin/env python3
"""Grok Imagine 4x3 walk sheets (art/src/spr_*.jpg) -> img/spr/<name>.webp
Output sheet: 3 columns (stepA, stand, stepB) x 4 rows in DIRS order [up, right, down, left].
Source rows: 0 front(down), 1 left, 3 back(up); right = mirrored left (source row 2 is unreliable).
Frames are aligned by feet (bottom) and horizontal centroid, uniform scale per sheet.
"""
import os, sys, json, numpy as np
from PIL import Image
from scipy import ndimage
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from process_art import cutout, ROOT, SRC
OUT = os.path.join(ROOT, 'img', 'spr')
ANIMAL = {'e_wolf', 'e_boar', 'e_dog', 'e_leopard', 'e_snake', 'b_tiger'}
# per-sheet frame picks: {row: [A, stand, B]} (source column indices)
OVR = {'yangzhi': {3: [0, 0, 2]}, 'shiqian': {3: [0, 0, 0]}, 'e_archer': {1: [0, 0, 2]}, 'e_armored': {0: [1, 1, 2]}}

def split(proj, n, lo, hi):
    """find n-1 cut positions as projection minima near i*len/n"""
    L = len(proj); cuts = [lo]
    for i in range(1, n):
        c = lo + (hi - lo) * i // n; w = (hi - lo) // (n * 3)
        seg = proj[c - w:c + w]; cuts.append(c - w + int(np.argmin(seg)))
    cuts.append(hi); return cuts

def frame(rgba, box):
    x0, y0, x1, y1 = box
    sub = rgba[y0:y1, x0:x1]
    m = sub[..., 3] > 60
    lab, n = ndimage.label(m)
    if n == 0: return None
    areas = ndimage.sum(m, lab, range(1, n + 1)); big = areas.max()
    keep = np.isin(lab, [i + 1 for i, a in enumerate(areas) if a >= big * 0.06])
    keep = ndimage.binary_dilation(keep, iterations=3)
    out = sub.copy(); out[..., 3] = np.where(keep, out[..., 3], 0)
    ys, xs = np.where(out[..., 3] > 60)
    fy0, fy1, fx0, fx1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    cx = float((xs * (out[ys, xs, 3] / 255.0)).sum() / (out[ys, xs, 3] / 255.0).sum()) - fx0
    return Image.fromarray(out[fy0:fy1, fx0:fx1], 'RGBA'), cx

def process(name):
    key = name[4:]
    im = Image.open(os.path.join(SRC, name + '.jpg')).convert('RGB')
    cut = np.asarray(cutout(im)).copy()
    H, W = cut.shape[:2]
    m = cut[..., 3] > 60
    rows = split(m.sum(axis=1), 4, 0, H)
    picks = {0: [0, 1, 2], 1: [0, 1, 2], 3: [0, 1, 2]}; picks.update(OVR.get(key, {}))
    frames = {}
    for r in (0, 1, 3):
        ry0, ry1 = rows[r], rows[r + 1]
        cols = split(m[ry0:ry1].sum(axis=0), 3, 0, W)
        cells = [frame(cut, (cols[c], ry0, cols[c + 1], ry1)) for c in range(3)]
        frames[r] = [cells[i] for i in picks[r]]
    CW, CH = (192, 160) if key in ANIMAL else (128, 160)
    mw = max(f[0].width for fs in frames.values() for f in fs); mh = max(f[0].height for fs in frames.values() for f in fs)
    s = min((CH - 4) / mh, (CW - 4) / mw)
    sheet = Image.new('RGBA', (CW * 3, CH * 4), (0, 0, 0, 0))
    order = [(3, False), (1, True), (0, False), (1, False)]  # up, right(mirror left), down, left
    for oi, (r, mir) in enumerate(order):
        for c, (fim, cx) in enumerate(frames[r]):
            f = fim.resize((max(1, round(fim.width * s)), max(1, round(fim.height * s))), Image.LANCZOS)
            cxs = cx * s
            if mir: f = f.transpose(Image.FLIP_LEFT_RIGHT); cxs = f.width - cxs
            px = int(round(CW / 2 - cxs)); px = max(0, min(CW - f.width, px))
            sheet.alpha_composite(f, (c * CW + px, oi * CH + CH - 2 - f.height))
    sheet.save(os.path.join(OUT, key + '.webp'), 'WEBP', quality=80, method=6)
    return key, CW, CH, round(mh * s)

def main():
    os.makedirs(OUT, exist_ok=True)
    names = sorted(f[:-4] for f in os.listdir(SRC) if f.startswith('spr_') and f.endswith('.jpg'))
    if len(sys.argv) > 1: names = [n for n in names if n[4:] in sys.argv[1:]]
    for n in names: print(*process(n))

if __name__ == '__main__': main()
