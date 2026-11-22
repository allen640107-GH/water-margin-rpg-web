# 自動遊玩測試：python3 tests/play.py [BASE_URL] [OUT_DIR] [devices...]
# 六種尺寸：標題 → 新遊戲 → 第一回對話 → 岳廟戰鬥 → 選單（隊伍/裝備）→ 存檔 → 重新載入 → 繼續
# 檢查：0 console error、0 pageerror、無外部網域請求、無水平捲動、主要文字 >= 16px、存檔後重新載入位置一致
import asyncio, sys, os, json
from urllib.parse import urlparse
from playwright.async_api import async_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8765/"
OUT = sys.argv[2] if len(sys.argv) > 2 else "/workspace/shots"
DEVS = {"se": (375, 667, True), "iphone": (390, 844, True), "iphone_land": (844, 390, True),
        "foldcover": (344, 882, True), "foldopen": (884, 1104, True), "pc": (1920, 1080, False)}
ONLY = sys.argv[3:] or list(DEVS)
os.makedirs(OUT, exist_ok=True)
HOST = urlparse(BASE).netloc

DRIVE = """async (n)=>{const q=s=>document.querySelector(s);for(let i=0;i<n;i++){
  if(__rpg.B.cur){const b=q('.b-res button'); if(b){b.click();} else if(!__rpg.B.cur.auto){const a=[...document.querySelectorAll('.b-cmds button')].find(x=>x.textContent.includes('自動')); if(a) a.click();}}
  else if(!q('#choices').hidden){const c=q('#choices button'); if(c) c.click();}
  else if(!q('#panel').hidden){return 'panel'}
  else if(!__rpg.busy() && !__rpg.M.moving && !__rpg.M.path.length) return 'free@'+__rpg.G.s.map+':'+__rpg.M.px+','+__rpg.M.py;
  else __rpg.adv();
  await new Promise(r=>setTimeout(r,150));} return 'max'}"""

# 可見文字的最小字級（排除隱藏元素與純圖示）
MINFONT = """(sel)=>{let min=999,who='';for(const el of document.querySelectorAll(sel+' *')){
  if(!el.childNodes.length||![...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim().length))continue;
  const r=el.getBoundingClientRect(); if(!r.width||!r.height)continue; const cs=getComputedStyle(el);
  if(cs.visibility==='hidden'||cs.display==='none'||+cs.opacity===0)continue;
  const f=parseFloat(cs.fontSize); if(f<min){min=f;who=el.className+':'+el.textContent.trim().slice(0,12);} }
  return [min,who]}"""

async def run(p, b, dev):
    W, H, T = DEVS[dev]
    ctx = await b.new_context(viewport={"width": W, "height": H}, has_touch=T, is_mobile=T, device_scale_factor=2 if T else 1, locale="zh-TW")
    pg = await ctx.new_page(); errs, warns, foreign = [], [], []
    pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else (warns.append(m.text) if m.type == "warning" else None))
    pg.on("pageerror", lambda e: errs.append("pageerror: " + str(e)))
    pg.on("request", lambda r: foreign.append(r.url) if urlparse(r.url).netloc not in (HOST, "") and not r.url.startswith("data:") else None)
    res = {"dev": dev}
    ok = lambda k, v: res.__setitem__(k, v)
    r = await pg.goto(BASE); ok("status", r.status)
    await pg.evaluate("localStorage.clear()"); await pg.reload()
    await pg.wait_for_selector("#t-new", timeout=30000); await pg.wait_for_timeout(1200)
    ok("title_font", await pg.evaluate(MINFONT, "#title"))
    await pg.screenshot(path=f"{OUT}/{dev}_1_title.png")
    # 新遊戲（真實點擊/觸控）
    if T: await pg.tap("#t-new")
    else: await pg.click("#t-new")
    await pg.wait_for_function("!document.querySelector('#dialog').hidden", timeout=20000)
    for _ in range(3):  # 以點擊推進幾句對話
        await pg.wait_for_timeout(700)
        if T: await pg.tap("#dialog .box")
        else: await pg.click("#dialog .box")
    await pg.wait_for_timeout(900)
    ok("dialog_font", await pg.evaluate(MINFONT, "#dialog"))
    await pg.screenshot(path=f"{OUT}/{dev}_2_dialog.png")
    ok("drive1", await pg.evaluate(DRIVE, 400))
    # 實際輸入移動一步（方向鍵 / 觸控方向盤）
    p0 = await pg.evaluate("[__rpg.M.px,__rpg.M.py]")
    if T: await pg.tap("#dpad .dr")
    else: await pg.keyboard.press("ArrowRight")
    await pg.wait_for_timeout(600)
    p1 = await pg.evaluate("[__rpg.M.px,__rpg.M.py]"); ok("moved", p0 != p1)
    ok("drive_m", await pg.evaluate(DRIVE, 100))
    # 前往岳廟觸發戰鬥
    await pg.evaluate("__rpg.pathTo(12,6)")
    await pg.wait_for_function("__rpg.B.cur || (!__rpg.busy() && !__rpg.M.moving && !__rpg.M.path.length && false)", timeout=1000) if False else None
    for _ in range(200):
        if await pg.evaluate("!!__rpg.B.cur"): break
        await pg.evaluate("__rpg.busy() && !document.querySelector('#dialog').hidden && __rpg.adv()")
        await pg.wait_for_timeout(200)
    ok("battle", await pg.evaluate("!!__rpg.B.cur"))
    await pg.wait_for_timeout(1500)
    ok("battle_font", await pg.evaluate(MINFONT, "#battle"))
    await pg.screenshot(path=f"{OUT}/{dev}_3_battle.png")
    ok("drive2", await pg.evaluate(DRIVE, 600))
    ok("yuemiao_done", await pg.evaluate("!!__rpg.G.s.flags.yuemiao_done"))
    # 選單：隊伍 → 詳細（裝備）
    if T: await pg.tap("#btn-menu")
    else: await pg.click("#btn-menu")
    await pg.wait_for_timeout(600)
    btn = pg.locator("#menu button", has_text="詳細").first
    await (btn.tap() if T else btn.click()); await pg.wait_for_timeout(800)
    ok("menu_font", await pg.evaluate(MINFONT, "#menu"))
    await pg.screenshot(path=f"{OUT}/{dev}_4_party.png")
    # 存檔到欄位 1
    tab = pg.locator("#menu .tab", has_text="存檔").first
    await (tab.tap() if T else tab.click()); await pg.wait_for_timeout(400)
    sb = pg.locator("#menu button", has_text="存檔").nth(1)
    await (sb.tap() if T else sb.click()); await pg.wait_for_timeout(400)
    saved = await pg.evaluate("(()=>{const o=JSON.parse(localStorage.getItem('shuihu.save.1')||'null');return o&&[o.v,o.map,o.x,o.y]})()")
    ok("saved", saved)
    ok("hscroll", await pg.evaluate("document.documentElement.scrollWidth>innerWidth+1"))
    await pg.reload(); await pg.wait_for_selector("#t-cont", timeout=20000); await pg.wait_for_timeout(600)
    lb = "#t-load"
    if T: await pg.tap(lb)
    else: await pg.click(lb)
    await pg.wait_for_timeout(500)
    s1 = pg.locator("#panel .row", has_text="存檔 1").locator("button").first
    await (s1.tap() if T else s1.click()); await pg.wait_for_timeout(2500)
    await pg.evaluate(DRIVE, 50)
    ok("reloaded", await pg.evaluate("[__rpg.G.s.v,__rpg.G.s.map,__rpg.G.s.x,__rpg.G.s.y]"))
    ok("errors", errs); ok("warnings", warns); ok("foreign", foreign)
    await ctx.close()
    fails = []
    if res["status"] != 200: fails.append("status")
    if errs: fails.append("console errors")
    if foreign: fails.append("foreign requests")
    if not res["moved"]: fails.append("input move")
    if not res["battle"] or not res["yuemiao_done"]: fails.append("battle")
    if not saved or saved[1:] != res["reloaded"][1:]: fails.append("save/reload")
    if res["hscroll"]: fails.append("horizontal scroll")
    for k in ("title_font", "dialog_font", "battle_font", "menu_font"):
        if res[k][0] < 15.5: fails.append(f"{k} {res[k]}")
    res["fails"] = fails
    return res

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", headless=True, args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
        allok = True
        for d in ONLY:
            r = await run(p, b, d); allok &= not r["fails"]
            print(json.dumps(r, ensure_ascii=False))
        await b.close()
        print("ALL PASS" if allok else "SOME FAIL"); sys.exit(0 if allok else 1)
asyncio.run(main())
