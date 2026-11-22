# 存檔遷移測試：python3 tests/save_migration.py [BASE_URL]
# 1) v0 舊格式 → 自動遷移為 v1，原始資料備份於 .bak.v0，角色/物品/旗標保留
# 2) 較新版本（v99）存檔：不讀取、不覆寫（不降級）
# 3) 損壞資料：寫入前先備份到 .bak.corrupt，絕不直接丟棄
# 4) 讀取後可繼續遊戲，0 console error
import asyncio, sys, json
from playwright.async_api import async_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8765/"
V0 = {"chapter": 2, "mapId": "yanggu", "pos": [5, 9], "money": 321,
      "members": [{"id": "wusong", "level": 9, "exp": 50}, {"id": "linchong", "level": 8, "exp": 10}],
      "items": [["herb", 4], ["pill", 1]], "flags": ["yuemiao_done", "tiger_done"], "time": 1700000000000, "playSec": 3600}
NEWER = {"v": 99, "map": "future", "note": "from a newer version"}
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", headless=True, args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
        pg = await (await b.new_context(viewport={"width": 390, "height": 844}, has_touch=True, is_mobile=True)).new_page()
        errs = []; pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None); pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(BASE); await pg.evaluate("localStorage.clear()")
        await pg.evaluate("""([v0,nw])=>{localStorage.setItem('shuihu.save.1',JSON.stringify(v0));localStorage.setItem('shuihu.save.2',JSON.stringify(nw));localStorage.setItem('shuihu.save.3','{broken json');}""", [V0, NEWER])
        raw0 = json.dumps(V0, separators=(",", ":"))
        await pg.reload(); await pg.wait_for_selector("#t-load", timeout=20000); await pg.wait_for_timeout(500)
        st = await pg.evaluate("""()=>{const g=k=>localStorage.getItem(k);return {s1:JSON.parse(g('shuihu.save.1')),bak:g('shuihu.save.1.bak.v0'),s2:g('shuihu.save.2'),s3:g('shuihu.save.3'),keys:Object.keys(localStorage).sort()}}""")
        R = []
        def check(name, cond): R.append((name, bool(cond))); print(("PASS " if cond else "FAIL ") + name)
        s1 = st["s1"]
        check("v0 遷移為 v1", s1.get("v") == 1 and s1.get("migratedFrom") == 0)
        check("v0 原始資料完整備份 (.bak.v0)", st["bak"] is not None and json.loads(st["bak"]) == V0)
        check("角色/等級保留", s1["roster"]["wusong"]["lv"] == 9 and s1["party"] == ["wusong", "linchong"])
        check("物品/銀兩/旗標保留", s1["inv"].get("herb") == 4 and s1["gold"] == 321 and s1["flags"].get("tiger_done"))
        check("位置保留", s1["map"] == "yanggu" and [s1["x"], s1["y"]] == [5, 9])
        check("較新版本存檔未被改動", st["s2"] == json.dumps(NEWER, separators=(",", ":")) or json.loads(st["s2"]) == NEWER)
        check("損壞存檔未被刪除", st["s3"] == "{broken json")
        # 嘗試在 v99 欄位寫入：必須被拒絕
        res = await pg.evaluate("""async()=>{const S=await import('./js/save.js');const r2=S.writeSlot('2',{map:'x',roster:{},party:[]});const r3=S.writeSlot('3',{map:'x',roster:{},party:[]});
            return {r2, s2:localStorage.getItem('shuihu.save.2'), r3, bak3:localStorage.getItem('shuihu.save.3.bak.corrupt')}}""")
        check("拒絕覆寫較新版本存檔", not res["r2"]["ok"] and json.loads(res["s2"]) == NEWER)
        check("覆寫損壞存檔前先備份", res["r3"]["ok"] and res["bak3"] == "{broken json")
        # 讀取遷移後的存檔並繼續遊玩
        await pg.tap("#t-load"); await pg.wait_for_timeout(500)
        await pg.locator("#panel .row", has_text="存檔 1").locator("button").first.tap(); await pg.wait_for_timeout(2500)
        for _ in range(40):
            if await pg.evaluate("!__rpg.busy()"): break
            await pg.evaluate("__rpg.adv()"); await pg.wait_for_timeout(200)
        cur = await pg.evaluate("[__rpg.G.s.map,__rpg.G.s.party,__rpg.G.s.v]")
        check("遷移後存檔可讀取遊玩", cur[0] == "yanggu" and cur[2] == 1)
        keys = await pg.evaluate("Object.keys(localStorage).sort()")
        check("所有原始存檔鍵仍在", all(k in keys for k in ["shuihu.save.1", "shuihu.save.1.bak.v0", "shuihu.save.2", "shuihu.save.3"]))
        check("0 console error", not errs)
        if errs: print(errs)
        await b.close()
        ok = all(c for _, c in R); print("ALL PASS" if ok else "SOME FAIL"); sys.exit(0 if ok else 1)
asyncio.run(main())
