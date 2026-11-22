# 開發用快速檢查：python3 tests/dev.py DEVICE OUT [js...]
import asyncio, sys, os, json
from playwright.async_api import async_playwright
DEV = {"se": (375, 667, True), "iphone": (390, 844, True), "iphone_land": (844, 390, True),
       "foldcover": (344, 882, True), "foldopen": (884, 1104, True), "pc": (1920, 1080, False)}
D, OUT = sys.argv[1], sys.argv[2]; W, H, T = DEV[D]; os.makedirs(OUT, exist_ok=True)
DRIVE = """async (n)=>{const q=s=>document.querySelector(s);for(let i=0;i<n;i++){
  if(__rpg.B.cur){const b=q('.b-res button'); if(b){b.click();} else if(!__rpg.B.cur.auto){const a=[...document.querySelectorAll('.b-cmds button')].find(x=>x.textContent.includes('自動')); if(a) a.click();}}
  else if(!q('#choices').hidden){return 'choice:'+q('#choices').textContent}
  else if(!q('#panel').hidden){return 'panel'}
  else if(!__rpg.busy() && !__rpg.M.moving && !__rpg.M.path.length) return 'free@'+__rpg.G.s.map+':'+__rpg.M.px+','+__rpg.M.py;
  else __rpg.adv();
  await new Promise(r=>setTimeout(r,180));} return 'max'}"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", headless=True, args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
        ctx = await b.new_context(viewport={"width": W, "height": H}, has_touch=T, is_mobile=T, device_scale_factor=2 if T else 1)
        pg = await ctx.new_page(); errs = []
        pg.on("console", lambda m: errs.append(m.type + ": " + m.text) if m.type in ("error", "warning") else None)
        pg.on("pageerror", lambda e: errs.append("pageerror: " + str(e)))
        await pg.goto("http://localhost:8765/"); await pg.evaluate("localStorage.clear();localStorage.setItem('shuihu.introSeen','1')"); await pg.reload()
        await pg.wait_for_selector("#title button", timeout=20000); await pg.wait_for_timeout(800)
        await pg.screenshot(path=f"{OUT}/{D}_title.png")
        for i, js in enumerate(sys.argv[3:]):
            if js.startswith("shot:"):
                await pg.screenshot(path=f"{OUT}/{D}_{js[5:]}.png"); continue
            if js.startswith("drive:"):
                r = await pg.evaluate(DRIVE, int(js[6:])); print(i, "drive", r); continue
            if js.startswith("wait:"):
                await pg.wait_for_timeout(int(js[5:])); continue
            r = await pg.evaluate(js); print(i, json.dumps(r, ensure_ascii=False)[:600])
        print("ERRS", errs)
        await b.close()
asyncio.run(main())
