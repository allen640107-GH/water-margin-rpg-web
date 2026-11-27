#!/usr/bin/env python3
"""將高精細 4 頭身主角原圖轉換為 768x1280（單格 256x320）去背對齊 WebP 行走圖。
保留純白去背＋柔和反鋸齒邊緣＋腳底對齊＋重心對齊，並可依指定影格配置自動鏡像左右側面。
"""
import os, sys, collections
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, 'img', 'spr')

# 每個角色的切格來源配置：(row, col, flip_h) 對應目標 4 列 [上(背), 右, 下(正), 左] × 3 欄 [步A, 站, 步B]
HERO_CFG = {
    'linchong': {
        'rows': [
            [(0, 0, False), (0, 1, False), (0, 2, False)],  # 上(背)
            [(1, 0, False), (3, 1, False), (3, 2, False)],  # 右(皆持槍)
            [(2, 0, False), (2, 1, False), (2, 2, False)],  # 下(正)
            [(1, 0, True),  (3, 1, True),  (3, 2, True)],   # 左(鏡像右)
        ]
    },
    'luzhishen': {
        'rows': [
            [(0, 0, False), (0, 1, False), (0, 2, False)],
            [(1, 0, False), (1, 1, False), (1, 2, False)],
            [(2, 0, False), (2, 1, False), (2, 2, False)],
            [(1, 0, True),  (1, 1, True),  (1, 2, True)],
        ]
    },
    'wusong': {
        'rows': [
            [(0, 0, False), (0, 1, False), (0, 2, False)],
            [(1, 0, False), (1, 1, False), (1, 2, True)],
            [(2, 0, False), (2, 1, False), (2, 2, False)],
            [(1, 0, True),  (1, 1, True),  (1, 2, False)],
        ]
    },
    'chaogai': {
        'rows': [
            [(0, 0, False), (0, 1, False), (0, 2, False)],
            [(1, 0, False), (1, 1, False), (1, 2, False)],
            [(2, 0, False), (2, 1, False), (2, 2, False)],
            [(1, 0, True),  (1, 1, True),  (1, 2, True)],
        ]
    },
    'wuyong': {
        'rows': [
            [(0, 0, False), (0, 0, False), (0, 2, False)],
            [(1, 0, True),  (1, 1, False), (1, 2, False)],
            [(2, 0, False), (2, 1, False), (2, 2, False)],
            [(1, 0, False), (1, 1, True),  (1, 2, True)],
        ]
    },
    'gongsunsheng': {
        'rows': [
            [(0, 0, False), (0, 0, False), (0, 0, True)],
            [(1, 0, False), (1, 1, False), (1, 2, False)],
            [(2, 0, False), (2, 1, False), (2, 2, False)],
            [(1, 0, True),  (1, 1, True),  (1, 2, True)],
        ]
    },
    'songjiang': {
        'rows': [
            [(0, 0, False), (0, 1, False), (0, 2, False)],
            [(1, 0, False), (1, 1, False), (1, 2, False)],
            [(2, 0, False), (2, 1, False), (2, 2, False)],
            [(1, 0, True),  (1, 1, True),  (1, 2, True)],
        ]
    },
    'likui': {
        'rows': [
            [(0, 0, False), (0, 1, False), (0, 2, False)],
            [(1, 0, True),  (1, 1, False), (1, 2, False)],
            [(2, 0, False), (2, 1, False), (2, 2, False)],
            [(1, 0, False), (1, 1, True),  (1, 2, True)],
        ]
    },
    'huarong': {
        'rows': [
            [(0, 0, False), (0, 1, False), (0, 2, False)],
            [(1, 0, False), (1, 1, False), (1, 2, False)],
            [(2, 0, False), (2, 1, False), (2, 2, False)],
            [(1, 0, True),  (1, 1, True),  (1, 2, True)],
        ]
    },
}

def remove_white_bg(im: Image.Image) -> Image.Image:
    """從四邊洪水填滿去除純白背景，對邊界做自然柔化去白邊，保留角色內部白色布料／高光。"""
    rgba = im.convert('RGBA')
    W, H = rgba.size
    px = rgba.load()

    def is_bg(r, g, b):
        return r >= 236 and g >= 236 and b >= 236 and (max(r, g, b) - min(r, g, b)) <= 16

    bg = bytearray(W * H)
    q = collections.deque()
    for x in range(W):
        for y in (0, H - 1):
            r, g, b, _ = px[x, y]
            if is_bg(r, g, b):
                idx = y * W + x
                if not bg[idx]:
                    bg[idx] = 1
                    q.append((x, y))
    for y in range(H):
        for x in (0, W - 1):
            r, g, b, _ = px[x, y]
            if is_bg(r, g, b):
                idx = y * W + x
                if not bg[idx]:
                    bg[idx] = 1
                    q.append((x, y))

    while q:
        x, y = q.popleft()
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < W and 0 <= ny < H:
                idx = ny * W + nx
                if not bg[idx]:
                    r, g, b, _ = px[nx, ny]
                    if is_bg(r, g, b):
                        bg[idx] = 1
                        q.append((nx, ny))

    # 同步清除披風與槍桿、雙腿間被圍住的純白內洞（不影響米黃／灰白布料與高光）
    for y in range(H):
        row_off = y * W
        for x in range(W):
            if not bg[row_off + x]:
                r, g, b, _ = px[x, y]
                if r >= 244 and g >= 244 and b >= 244 and (max(r, g, b) - min(r, g, b)) <= 8:
                    bg[row_off + x] = 1

    # 清除背景像素，對鄰接背景的淺白抗鋸齒邊緣做柔和羽化
    for y in range(H):
        row_off = y * W
        for x in range(W):
            if bg[row_off + x]:
                px[x, y] = (0, 0, 0, 0)
            else:
                r, g, b, a = px[x, y]
                lum = (r + g + b) // 3
                if lum > 205 and (max(r, g, b) - min(r, g, b)) < 24:
                    # 檢查是否貼著背景
                    touch = False
                    for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                        if 0 <= nx < W and 0 <= ny < H and bg[ny * W + nx]:
                            touch = True
                            break
                    if touch:
                        na = max(0, min(255, int((242 - lum) * 6.5)))
                        px[x, y] = (int(r * 0.7), int(g * 0.7), int(b * 0.7), na)
    return rgba

def find_cuts(proj, n):
    L = len(proj)
    cuts = [0]
    for i in range(1, n):
        c = L * i // n
        w = max(8, L // (n * 4))
        lo, hi = max(1, c - w), min(L - 1, c + w)
        best = min(range(lo, hi), key=lambda k: proj[k])
        cuts.append(best)
    cuts.append(L)
    return cuts

def extract_cell(rgba: Image.Image, box):
    sub = rgba.crop(box)
    bbox = sub.getbbox()
    if not bbox:
        return None, 0.0
    sub = sub.crop(bbox)
    W, H = sub.size
    px = sub.load()
    # 計算加權水平重心，讓行走不左右亂跳
    sx = 0.0
    sw = 0.0
    for y in range(H):
        for x in range(W):
            a = px[x, y][3]
            if a > 40:
                sx += x * a
                sw += a
    cx = (sx / sw) if sw > 0 else W / 2.0
    return sub, cx

def process_hero(key: str, src_path: str, cell_w=256, cell_h=320):
    im = Image.open(src_path).convert('RGB')
    rgba = remove_white_bg(im)
    W, H = rgba.size
    px = rgba.load()

    row_proj = [sum(1 for x in range(W) if px[x, y][3] > 60) for y in range(H)]
    rcuts = find_cuts(row_proj, 4)

    grid = {}
    for r in range(4):
        y0, y1 = rcuts[r], rcuts[r + 1]
        col_proj = [sum(1 for y in range(y0, y1) if px[x, y][3] > 60) for x in range(W)]
        ccuts = find_cuts(col_proj, 3)
        for c in range(3):
            grid[(r, c)] = extract_cell(rgba, (ccuts[c], y0, ccuts[c + 1], y1))

    cfg = HERO_CFG[key]['rows']
    used = [grid[(r, c)] for row in cfg for (r, c, _) in row if grid[(r, c)][0] is not None]
    max_w = max(im0.width for im0, _ in used)
    max_h = max(im0.height for im0, _ in used)
    scale = min((cell_h - 10) / max_h, (cell_w - 8) / max_w)

    sheet = Image.new('RGBA', (cell_w * 3, cell_h * 4), (0, 0, 0, 0))
    for dr, row in enumerate(cfg):
        for dc, (sr, sc, flip) in enumerate(row):
            fim, cx = grid[(sr, sc)]
            if fim is None:
                continue
            nw = max(1, round(fim.width * scale))
            nh = max(1, round(fim.height * scale))
            f = fim.resize((nw, nh), Image.LANCZOS)
            cxs = cx * scale
            if flip:
                f = f.transpose(Image.FLIP_LEFT_RIGHT)
                cxs = nw - cxs
            px_off = int(round(cell_w / 2 - cxs))
            px_off = max(0, min(cell_w - nw, px_off))
            py_off = cell_h - 4 - nh
            sheet.alpha_composite(f, (dc * cell_w + px_off, dr * cell_h + py_off))

    os.makedirs(OUT_DIR, exist_ok=True)
    out_path = os.path.join(OUT_DIR, key + '.webp')
    sheet.save(out_path, 'WEBP', quality=88, method=6)
    print(f'OK {key}: {sheet.size} -> {out_path} ({os.path.getsize(out_path)} bytes)')

if __name__ == '__main__':
    for arg in sys.argv[1:]:
        k, p = arg.split('=', 1)
        process_hero(k, p)
