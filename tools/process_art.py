#!/usr/bin/env python3
"""Convert Grok Imagine source art (art/src/*.jpg) into game-ready webp in img/.
p_/b_/n_/e_/bf_: white background keyed out by edge flood-fill -> alpha. bld_/strip_/tx_/props_ -> img/map/.
Walk sheets (spr_) are handled by tools/process_sprites.py.
"""
import os, sys, numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'art', 'src'); OUT = os.path.join(ROOT, 'img')

def cutout(im):
    a = np.asarray(im.convert('RGB')).astype(np.float32)
    mn = a.min(axis=2); mx = a.max(axis=2)
    white = (mn > 222) & ((mx - mn) < 28)
    lab, n = ndimage.label(white)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = np.isin(lab, list(border))
    # grow bg slightly into very light anti-aliased fringe
    light = (mn > 200) & ((mx - mn) < 40)
    grown = ndimage.binary_dilation(bg, iterations=2) & light
    bg = bg | grown
    alpha = np.where(bg, 0, 255).astype(np.uint8)
    am = Image.fromarray(alpha).filter(ImageFilter.GaussianBlur(1.2))
    al = np.asarray(am).astype(np.float32)
    # soft: pale pixels near edge get partial alpha by darkness
    dark = np.clip((255 - mn) / 60.0, 0, 1)
    edge = ndimage.binary_dilation(bg, iterations=6) & ~bg
    al = np.where(edge, al * np.maximum(dark, 0.35), al)
    rgba = np.dstack([a.astype(np.uint8), al.clip(0, 255).astype(np.uint8)])
    return Image.fromarray(rgba, 'RGBA')

def bbox_crop(im, pad=8):
    al = np.asarray(im.split()[-1])
    ys, xs = np.where(al > 20)
    if len(xs) == 0: return im
    x0, x1, y0, y1 = max(0, xs.min()-pad), min(im.width, xs.max()+pad), max(0, ys.min()-pad), min(im.height, ys.max()+pad)
    return im.crop((x0, y0, x1, y1))

FACE = {  # (cx, cy, size) in source pixels, hand-picked after review
 'p_linchong':(330,230,300),'p_luzhishen':(365,170,300),'p_wusong':(420,200,300),'p_chaogai':(375,200,300),
 'p_wuyong':(370,220,300),'p_gongsunsheng':(460,270,280),'p_ruanxiaoqi':(380,260,300),'p_liutang':(370,250,320),
 'p_yangzhi':(400,280,320),'p_songjiang':(365,230,300),'p_likui':(380,300,330),'p_huarong':(330,260,300),
 'p_sunerniang':(380,220,300),'p_zhangshun':(370,230,300),'p_shiqian':(350,230,280),'b_luqian':(340,330,330),
 'b_ximenqing':(430,210,300),'b_jiangmenshen':(390,250,300),'b_wanglun':(370,250,300),'b_huangwenbing':(380,320,320),
 'b_zhubiao':(400,190,280),'b_luantingyu':(385,210,300),'b_denglong':(400,170,300),'b_commander':(390,260,330),
 'n_elder':(380,250,320),'n_waiter':(370,230,300),'n_woman':(390,260,300),'b_tiger':(535,380,520)}

def face_token(cut, name, size=128):
    cx, cy, s = FACE[name]
    face = Image.new('RGBA', cut.size, (236, 226, 200, 255)); face.alpha_composite(cut)
    x0 = max(0, min(cut.width - s, cx - s//2)); y0 = max(0, min(cut.height - s, cy - s//2))
    c = face.crop((x0, y0, x0+s, y0+s)).resize((size, size), Image.LANCZOS)
    from PIL import ImageDraw
    m = Image.new('L', (size*4, size*4), 0); ImageDraw.Draw(m).ellipse((6, 6, size*4-6, size*4-6), fill=255)
    c.putalpha(m.resize((size, size), Image.LANCZOS)); return c

def token(cut, size=128):
    """circular face token from a portrait cutout"""
    al = np.asarray(cut.split()[-1])
    W, H = cut.size
    ys, xs = np.where(al > 40)
    top = ys.min()
    band = (ys < top + int(H*0.18))
    cx = int(np.median(xs[band])) if band.any() else W//2
    s = int(W*0.46)
    x0 = max(0, min(W-s, cx - s//2)); y0 = max(0, top - int(s*0.04))
    face = Image.new('RGBA', cut.size, (236, 226, 200, 255))
    face.alpha_composite(cut)
    c = face.crop((x0, y0, x0+s, y0+s)).resize((size, size), Image.LANCZOS)
    m = Image.new('L', (size*4, size*4), 0)
    from PIL import ImageDraw
    ImageDraw.Draw(m).ellipse((6, 6, size*4-6, size*4-6), fill=255)
    m = m.resize((size, size), Image.LANCZOS)
    c.putalpha(m)
    return c

def clean(im, frac=0.06):
    """drop small specks (ink splatter, dust) not attached to the main figure"""
    a = np.asarray(im).copy(); m = a[..., 3] > 60
    lab, n = ndimage.label(ndimage.binary_dilation(m, iterations=2))
    if n > 1:
        areas = ndimage.sum(m, lab, range(1, n + 1)); big = areas.max()
        keep = np.isin(lab, [i + 1 for i, v in enumerate(areas) if v >= big * frac])
        a[..., 3] = np.where(keep, a[..., 3], 0)
    return Image.fromarray(a, 'RGBA')

def seamless(im, axes='xy', frac=0.18):
    """cross-fade opposite edges so the texture tiles without a visible seam"""
    a = np.asarray(im.convert('RGB')).astype(np.float32)
    if 'x' in axes:
        b = int(a.shape[1] * frac); w = np.linspace(0, 1, b)[None, :, None]
        a[:, :b] = a[:, :b] * w + a[:, -b:] * (1 - w); a = a[:, :-b]
    if 'y' in axes:
        b = int(a.shape[0] * frac); w = np.linspace(0, 1, b)[:, None, None]
        a[:b] = a[:b] * w + a[-b:] * (1 - w); a = a[:-b]
    return Image.fromarray(a.clip(0, 255).astype(np.uint8))

def fit(im, w=None, h=None):
    if w and h: s = min(w / im.width, h / im.height)
    elif w: s = w / im.width
    else: s = h / im.height
    return im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)

PROPS = {
  'props_trees': ['tree_pine', 'tree_willow', 'tree_broad', 'tree_snowpine', 'tree_bamboo', 'tree_poplar'],
  'props_misc': ['chest', 'chest_open', 'boulder', 'rock', 'bush', 'reeds', 'signpost', 'lantern', 'well', 'haystack', 'jars', 'cart'],
  'props_doors': ['door_wood', 'door_red', 'door_city', 'door_stockade'],
  'props_statue': ['statue'],
}

GRID = {'props_trees': (2, 3), 'props_misc': (3, 4), 'props_doors': (1, 4), 'props_statue': (1, 1)}

def _cuts(proj, n):
    L = len(proj); cuts = [0]
    for i in range(1, n):
        c = L * i // n; w = L // (n * 3); cuts.append(c - w + int(np.argmin(proj[c - w:c + w])))
    return cuts + [L]

def split_props(c, name):
    names = PROPS[name]; R, C = GRID[name]
    m = np.asarray(c)[..., 3] > 60; out = {}
    rows = _cuts(m.sum(axis=1), R)
    for r in range(R):
        cols = _cuts(m[rows[r]:rows[r + 1]].sum(axis=0), C)
        for k in range(C):
            sub = c.crop((cols[k], rows[r], cols[k + 1], rows[r + 1]))
            out[names[r * C + k]] = bbox_crop(clean(sub, 0.04), 2)
    return out

def save(im, name, q=78, sub=''):
    d = os.path.join(OUT, sub); os.makedirs(d, exist_ok=True)
    p = os.path.join(d, name + '.webp'); im.save(p, 'WEBP', quality=q, method=6); return p

def main():
    os.makedirs(OUT, exist_ok=True)
    for f in sorted(os.listdir(SRC)):
        if not f.endswith('.jpg'): continue
        if len(sys.argv) > 1 and not any(f.startswith(a) for a in sys.argv[1:]): continue
        name = f[:-4]; im = Image.open(os.path.join(SRC, f)).convert('RGB')
        kind = name.split('_')[0]
        if kind == 'spr' or kind == 'intro' or name == 'title_bg': continue  # tools/process_sprites.py, media/
        if kind == 'p':
            c = cutout(im); save(c.resize((432, 576), Image.LANCZOS), name, 80)
            (face_token(c, name) if name in FACE else token(c)).save(os.path.join(OUT, 'tok', name + '.webp'), 'WEBP', quality=82, method=6)
        elif kind in ('b', 'n'):
            c = cutout(im)
            save(c.resize((432, 576), Image.LANCZOS) if c.height > c.width else fit(bbox_crop(c), w=512), name, 80)
        elif kind == 'e':
            c = bbox_crop(cutout(im)); c.thumbnail((512, 512), Image.LANCZOS); save(c, name, 80)
        elif kind == 'bf':
            c = bbox_crop(clean(cutout(im))); save(fit(c, h=600), name, 80)
        elif kind == 'bld':
            c = bbox_crop(clean(cutout(im), 0.02), 2); save(fit(c, w=640), name, 80, 'map')
        elif name in ('strip_citywall', 'strip_palisade'):
            c = cutout(im); a = np.asarray(c).copy()
            if name == 'strip_palisade': a[int(a.shape[0] * 0.85):, :, 3] = 0  # drop painted dirt
            c = bbox_crop(Image.fromarray(a, 'RGBA'), 0)
            rgb = seamless(c.convert('RGB'), 'x'); al = seamless(c.split()[-1].convert('RGB'), 'x').convert('L')
            rgb.putalpha(al); save(fit(rgb, h=256), name, 80, 'map')
        elif kind == 'strip':
            save(fit(seamless(im, 'x'), h=256), name, 78, 'map')
        elif kind == 'tx':
            save(seamless(im).resize((256, 256), Image.LANCZOS), name, 80, 'map')
        elif kind == 'props':
            for nm, c in split_props(cutout(im), name).items():
                save(fit(c, h=320) if nm.startswith('tree') else fit(c, w=256, h=256), nm, 82, 'map'); print('  ', nm, c.size)
        elif kind == 'bg':
            save(im.resize((1280, 720), Image.LANCZOS), name, 72)
        elif kind == 'ui':
            save(im.resize((512, 512), Image.LANCZOS), name, 75)
        else:
            print('skip', name); continue
        print('ok', name)

if __name__ == '__main__': main()
