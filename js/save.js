// 存檔系統：localStorage，含版本欄位與遷移路徑。
// 原則：遷移前備份原始資料（.bak.v<舊版>）、絕不降級（較新版本存檔不覆寫）、絕不刪除存檔。
import { SAVE_VERSION, newHero, maxStats } from './state.js';
import { HEROES } from './data/heroes.js';

export const PREFIX = 'shuihu.save.';
export const SLOTS = ['auto', '1', '2', '3'];
const key = slot => PREFIX + slot;

function store() { try { return window.localStorage; } catch (e) { return null; } }

// v0（開發早期原型格式）→ v1
// v0: { chapter, mapId, pos:[x,y], money, members:[{id,level,exp}], items:[[id,n]], flags:[name...], time }
const MIGRATIONS = {
  0: (o) => {
    const s = {
      v: 1, created: o.time || Date.now(), playMs: (o.playSec || 0) * 1000, steps: 0,
      chapter: o.chapter || 1, map: o.mapId || 'dongjing', x: (o.pos || [0, 0])[0], y: (o.pos || [0, 0])[1], dir: 2, entry: null,
      gold: o.money || 0, roster: {}, party: [], inv: {}, flags: {}, quests: {}, mapState: {},
      settings: { fast: false, auto: false }, battles: 0, kills: 0, migratedFrom: 0,
    };
    for (const m of o.members || []) {
      if (!HEROES[m.id]) continue;
      const h = newHero(m.id, m.level || 1); h.exp = m.exp || 0;
      const mx = maxStats(h); h.hp = mx.hp; h.mp = mx.mp;
      s.roster[m.id] = h; s.party.push(m.id);
    }
    if (!s.party.length) { s.roster.linchong = newHero('linchong', 1); s.party = ['linchong']; }
    for (const [id, n] of o.items || []) s.inv[id] = (s.inv[id] || 0) + n;
    for (const f of o.flags || []) s.flags[f] = true;
    return s;
  },
};

export function versionOf(o) { return (o && typeof o.v === 'number') ? o.v : 0; }

export function migrate(o) {
  let v = versionOf(o), cur = o;
  while (v < SAVE_VERSION) {
    const fn = MIGRATIONS[v];
    if (!fn) throw new Error('無法遷移版本 ' + v);
    cur = fn(cur); v = versionOf(cur);
  }
  return cur;
}

// 讀取一個欄位：回傳 {status:'empty'|'ok'|'newer'|'corrupt', data, raw}
export function readSlot(slot) {
  const ls = store(); if (!ls) return { status: 'empty' };
  const raw = ls.getItem(key(slot));
  if (raw == null) return { status: 'empty' };
  let o;
  try { o = JSON.parse(raw); } catch (e) { return { status: 'corrupt', raw }; }
  const v = versionOf(o);
  if (v > SAVE_VERSION) return { status: 'newer', v, raw };
  if (v < SAVE_VERSION) {
    // 遷移：先備份原始字串（若尚未備份），再寫回新版
    const bk = key(slot) + '.bak.v' + v;
    try {
      if (ls.getItem(bk) == null) ls.setItem(bk, raw);
      const m = migrate(o);
      ls.setItem(key(slot), JSON.stringify(m));
      return { status: 'ok', data: m, migrated: v };
    } catch (e) { return { status: 'corrupt', raw }; }
  }
  return { status: 'ok', data: o };
}

export function migrateAll() {
  const out = {};
  for (const s of SLOTS) out[s] = readSlot(s).status;
  return out;
}

export function writeSlot(slot, s) {
  const ls = store(); if (!ls) return { ok: false, msg: '此瀏覽器無法存檔' };
  const raw = ls.getItem(key(slot));
  if (raw != null) {
    try { const o = JSON.parse(raw); if (versionOf(o) > SAVE_VERSION) return { ok: false, msg: '此欄位是較新版本的存檔，為保護資料不予覆寫。' }; }
    catch (e) {
      // 損壞資料：備份後才覆寫，絕不直接丟棄
      const bk = key(slot) + '.bak.corrupt'; if (ls.getItem(bk) == null) ls.setItem(bk, raw);
    }
  }
  const data = { ...s, v: SAVE_VERSION, savedAt: Date.now() };
  try { ls.setItem(key(slot), JSON.stringify(data)); return { ok: true }; }
  catch (e) { return { ok: false, msg: '存檔空間不足' }; }
}

export function slotSummary(slot) {
  const r = readSlot(slot);
  if (r.status !== 'ok') return r;
  const d = r.data;
  return { status: 'ok', data: d, chapter: d.chapter, map: d.map, lv: Math.max(...Object.values(d.roster).map(h => h.lv)), playMs: d.playMs, savedAt: d.savedAt };
}
