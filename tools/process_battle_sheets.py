#!/usr/bin/env python3
"""將 3欄×2列（6 動作）戰鬥影格原圖轉換為 1080×720（單格 360×360）高精細去背對齊 WebP（img/bc_<id>.webp）。
影格定義：
  Row 0: [0] 備戰待機, [1] 前衝疾奔, [2] 蓄力起手
  Row 1: [3] 全力揮斬/突刺/拉弓, [4] 受擊格擋, [5] 勝利/施法/倒地
"""
import os, sys, collections
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, 'img')

def remove_white_bg(im: Image.Image) -> Image.Image:
    rgba = im.convert('RGBA')
    W, H = rgba.size
    px = rgba.load()

    def is_bg(r, g, b):
        return r >= 234 and g >= 234 and b >= 234 and (max(r, g, b) - min(r, g, b)) <= 18

    bg = bytearray(W * H)
    q = collections.deque()
    for x in range(W):
        for y in (0, H - 1):
            r, g, b, _ = px[x, y]
            if is_bg(r, g, b) and not bg[y * W + x]:
                bg[y * W + x] = 1
                q.append((x, y))
    for y in range(H):
        for x in (0, W - 1):
            r, g, b, _ = px[x, y]
            if is_bg(r, g, b) and not bg[y * W + x]:
                bg[y * W + x] = 1
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

    # 清除兵器／披風／雙腿之間的純白內洞
    for y in range(H):
        off = y * W
        for x in range(W):
            if not bg[off + x]:
                r, g, b, _ = px[x, y]
                if r >= 244 and g >= 244 and b >= 244 and (max(r, g, b) - min(r, g, b)) <= 8:
                    bg[off + x] = 1

    # 羽化純白邊緣消除白框
    for y in range(H):
        off = y * W
        for x in range(W):
            if bg[off + x]:
                px[x, y] = (0, 0, 0, 0)
            else:
                r, g, b, a = px[x, y]
                lum = (r + g + b) // 3
                if lum > 200 and (max(r, g, b) - min(r, g, b)) < 24:
                    touch = False
                    for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                        if 0 <= nx < W and 0 <= ny < H and bg[ny * W + nx]:
                            touch = True
                            break
                    if touch:
                        na = max(0, min(255, int((242 - lum) * 6.0)))
                        px[x, y] = (int(r * 0.72), int(g * 0.72), int(b * 0.72), na)
    return rgba

def find_cuts(proj, n):
    L = len(proj)
    cuts = [0]
    for i in range(1, n):
        c = L * i // n
        w = max(12, L // (n * 4))
        lo, hi = max(1, c - w), min(L - 1, c + w)
        cuts.append(min(range(lo, hi), key=lambda k: proj[k]))
    cuts.append(L)
    return cuts

FLIPS = {
    # 我方統一面向左（朝左側敵陣）
    'linchong':  [True, True, False, True, False, True],
    'luzhishen': [True, True, True, True, True, True],
    'wusong':    [True, False, False, True, False, False],
    'huarong':   [True, True, True, True, True, True],
    # 敵方統一面向右（朝右側我方）
    'e_thug':    [False, False, False, False, False, False],
    'e_wolf':    [False, False, False, False, False, False],
}

def extract_six_characters(rgba: Image.Image):
    """以全圖連通區塊分離 6 格人物：即使長槍／木棒稍微跨越格線，也能完整保留兵器且徹底清除相鄰殘片。"""
    W, H = rgba.size
    # 降採樣 2x 做連通區塊標記，速度快 4 倍且自動橋接 1-2px 細線（如弓弦）
    sw, sh = (W + 1) // 2, (H + 1) // 2
    alpha = rgba.getchannel('A').resize((sw, sh), Image.BILINEAR)
    apx = alpha.load()
    # 1px 膨脹讓刀光細線與主體連通（但不連到相鄰角色）
    mask = bytearray(sw * sh)
    for y in range(sh):
        off = y * sw
        for x in range(sw):
            if apx[x, y] > 28:
                mask[off + x] = 1
    dil = bytearray(mask)
    for y in range(1, sh - 1):
        off = y * sw
        for x in range(1, sw - 1):
            if mask[off + x]:
                dil[off + x - 1] = dil[off + x + 1] = 1
                dil[off - sw + x] = dil[off + sw + x] = 1

    labels = [0] * (sw * sh)
    comps = []  # (label, area, cx, cy, x0, y0, x1, y1)
    cur = 0
    for y in range(sh):
        off = y * sw
        for x in range(sw):
            idx = off + x
            if dil[idx] and not labels[idx]:
                cur += 1
                q = collections.deque([(x, y)])
                labels[idx] = cur
                area = sx = sy = 0
                x0 = x1 = x
                y0 = y1 = y
                while q:
                    cx, cy = q.popleft()
                    area += 1
                    sx += cx; sy += cy
                    if cx < x0: x0 = cx
                    if cx > x1: x1 = cx
                    if cy < y0: y0 = cy
                    if cy > y1: y1 = cy
                    for nx, ny in ((cx+1,cy),(cx-1,cy),(cx,cy+1),(cx,cy-1),(cx+1,cy+1),(cx-1,cy-1),(cx+1,cy-1),(cx-1,cy+1)):
                        if 0 <= nx < sw and 0 <= ny < sh:
                            nidx = ny * sw + nx
                            if dil[nidx] and not labels[nidx]:
                                labels[nidx] = cur
                                q.append((nx, ny))
                comps.append((cur, area, sx / area, sy / area, x0, y0, x1, y1))

    # 選出 6 個最大主體（每個對應 3×2 格子之一）
    mains = sorted(comps, key=lambda c: c[1], reverse=True)[:6]
    if len(mains) < 6:
        return None
    # 依上下兩列（y 座標排序切前 3、後 3）再各依 x 座標由左至右排序
    mains_by_y = sorted(mains, key=lambda c: c[3])
    row0 = sorted(mains_by_y[:3], key=lambda c: c[2])
    row1 = sorted(mains_by_y[3:], key=lambda c: c[2])
    ordered = row0 + row1
    main_by_lbl = {c[0]: i for i, c in enumerate(ordered)}

    # 附屬小區塊（如武松刀光筆觸）若夠大且非常貼近某個主體 bbox，則併入該主體；雜訊則丟棄
    lbl_to_slot = dict(main_by_lbl)
    for c in comps:
        lbl, area, cx, cy, x0, y0, x1, y1 = c
        if lbl in lbl_to_slot or area < 25:
            continue
        best_slot, best_d = -1, 1e9
        for slot, mc in enumerate(ordered):
            _, _, _, _, mx0, my0, mx1, my1 = mc
            dx = max(0, mx0 - x1, x0 - mx1)
            dy = max(0, my0 - y1, y0 - my1)
            d = (dx * dx + dy * dy) ** 0.5
            if d < best_d:
                best_d, best_slot = d, slot
        if best_d <= 14:
            lbl_to_slot[lbl] = best_slot

    # 依據 slot 遮罩裁切 6 張乾淨角色圖
    px = rgba.load()
    cells = []
    for slot, mc in enumerate(ordered):
        # 計算該 slot 所有納入區塊的聯集 bbox（放大回原圖座標）
        bx0, by0, bx1, by1 = sw, sh, 0, 0
        for c in comps:
            if lbl_to_slot.get(c[0]) == slot:
                bx0 = min(bx0, c[4]); by0 = min(by0, c[5])
                bx1 = max(bx1, c[6]); by1 = max(by1, c[7])
        ox0 = max(0, bx0 * 2 - 2); oy0 = max(0, by0 * 2 - 2)
        ox1 = min(W, bx1 * 2 + 4); oy1 = min(H, by1 * 2 + 4)
        sub = Image.new('RGBA', (ox1 - ox0, oy1 - oy0), (0, 0, 0, 0))
        spx = sub.load()
        for y in range(oy0, oy1):
            sy = min(sh - 1, y // 2)
            row_off = sy * sw
            for x in range(ox0, ox1):
                sx = min(sw - 1, x // 2)
                if lbl_to_slot.get(labels[row_off + sx]) == slot:
                    spx[x - ox0, y - oy0] = px[x, y]
        bb = sub.getbbox()
        cells.append(sub.crop(bb) if bb else None)
    return cells

def process_sheet(key: str, src_path: str, cell_w=360, cell_h=360):
    im = Image.open(src_path).convert('RGB')
    rgba = remove_white_bg(im)
    flips = FLIPS.get(key, [False] * 6)

    cells = extract_six_characters(rgba)
    if not cells:
        W, H = rgba.size
        px = rgba.load()
        rproj = [sum(1 for x in range(W) if px[x, y][3] > 50) for y in range(H)]
        rcuts = find_cuts(rproj, 2)
        cells = []
        for r in range(2):
            y0, y1 = rcuts[r], rcuts[r + 1]
            cproj = [sum(1 for y in range(y0, y1) if px[x, y][3] > 50) for x in range(W)]
            ccuts = find_cuts(cproj, 3)
            for c in range(3):
                sub = rgba.crop((ccuts[c], y0, ccuts[c + 1], y1))
                bb = sub.getbbox()
                cells.append(sub.crop(bb) if bb else None)

    for idx in range(len(cells)):
        if cells[idx] and flips[idx]:
            cells[idx] = cells[idx].transpose(Image.FLIP_LEFT_RIGHT)

    max_h = max((c.height for c in cells if c), default=1)
    max_w = max((c.width for c in cells if c), default=1)
    # 依待機格（cell 0）為主高度基準，避免揮槍展開太寬把全部動作縮太小
    ref_h = cells[0].height if cells[0] else max_h
    base_scale = (cell_h - 18) / max(ref_h, max_h * 0.88)

    sheet = Image.new('RGBA', (cell_w * 3, cell_h * 2), (0, 0, 0, 0))
    for idx, fim in enumerate(cells):
        if not fim:
            continue
        sc = min(base_scale, (cell_w - 10) / fim.width, (cell_h - 10) / fim.height)
        nw = max(1, round(fim.width * sc))
        nh = max(1, round(fim.height * sc))
        f = fim.resize((nw, nh), Image.LANCZOS)
        r, c = idx // 3, idx % 3
        px_off = (cell_w - nw) // 2
        py_off = cell_h - 6 - nh
        sheet.alpha_composite(f, (c * cell_w + px_off, r * cell_h + py_off))

    out_path = os.path.join(OUT_DIR, f'bc_{key}.webp')
    sheet.save(out_path, 'WEBP', quality=88, method=6)
    print(f'OK bc_{key}: {sheet.size} -> {out_path} ({os.path.getsize(out_path)} bytes)')

if __name__ == '__main__':
    for arg in sys.argv[1:]:
        k, p = arg.split('=', 1)
        process_sheet(k, p)
