import { HEROES } from './data/heroes.js';
import { ITEMS } from './data/items.js';
import { SKILLS } from './data/skills.js';

export const SAVE_VERSION = 2; // v2.0.0：全身角色／新地圖渲染（存檔欄位相容，見 save.js 遷移）
export const STATS = ['hp', 'mp', 'atk', 'def', 'int', 'spd', 'luk'];
export const STAT_NAME = { hp: '體力', mp: '內力', atk: '攻擊', def: '防禦', int: '智謀', spd: '身法', luk: '運氣', eva: '閃避' };

export const G = { s: null }; // 全域遊戲狀態容器

export function expNext(lv) { return Math.floor(12 * Math.pow(lv, 1.6) + 8); }

export function newHero(id, lv = 1) {
  const H = HEROES[id];
  const h = { id, lv: 1, exp: 0, hp: 1, mp: 1, eq: { ...H.eq } };
  setLevel(h, lv);
  const m = maxStats(h); h.hp = m.hp; h.mp = m.mp;
  return h;
}

export function setLevel(h, lv) { h.lv = Math.max(1, Math.min(60, lv)); h.exp = 0; }

export function baseStats(h) {
  const H = HEROES[h.id], o = {};
  for (const k of STATS) o[k] = Math.floor(H.base[k] + H.grow[k] * (h.lv - 1));
  return o;
}

export function maxStats(h) {
  const o = baseStats(h);
  for (const slot of ['w', 'a', 'c']) {
    const it = h.eq[slot] && ITEMS[h.eq[slot]];
    if (!it) continue;
    for (const k of STATS) if (it[k]) o[k] += it[k];
  }
  return o;
}

export function heroSkills(h) {
  return HEROES[h.id].skills.filter(([, lv]) => h.lv >= lv).map(([id]) => id);
}

export function newGame() {
  const s = {
    v: SAVE_VERSION, created: Date.now(), playMs: 0, steps: 0,
    chapter: 1, map: 'dongjing', x: 0, y: 0, dir: 2, entry: 'start',
    gold: 60, roster: {}, party: ['linchong'], inv: { herb: 3, bun: 3 }, flags: {}, quests: {},
    mapState: {}, settings: { fast: false, auto: false }, battles: 0, kills: 0,
  };
  s.roster.linchong = newHero('linchong', 1);
  return s;
}

export function flag(name) { return !!G.s.flags[name]; }
export function setFlag(name, v = true) { if (v === false || v === 0) delete G.s.flags[name]; else G.s.flags[name] = v; }

export function invCount(id) { return G.s.inv[id] || 0; }
export function give(id, n = 1) { G.s.inv[id] = (G.s.inv[id] || 0) + n; if (G.s.inv[id] <= 0) delete G.s.inv[id]; }

export function activeParty() { return G.s.party.filter(id => G.s.roster[id]).map(id => G.s.roster[id]); }
export function frontParty() { return activeParty().slice(0, 4); }

export function avgLevel() {
  const p = activeParty(); if (!p.length) return 1;
  return Math.round(p.reduce((a, h) => a + h.lv, 0) / p.length);
}

// 加入隊伍：若尚未擁有則建立；等級至少為 (隊伍平均 - 1) 或指定等級
export function joinHero(id, lv) {
  let h = G.s.roster[id];
  const target = Math.max(lv || 1, avgLevel() - 1);
  if (!h) { h = newHero(id, target); G.s.roster[id] = h; }
  else if (h.lv < target) { h.lv = target; h.exp = 0; const m = maxStats(h); h.hp = m.hp; h.mp = m.mp; }
  if (!G.s.party.includes(id)) G.s.party.push(id);
  return h;
}

export function leaveHero(id) { G.s.party = G.s.party.filter(x => x !== id); }

export function healAll() {
  for (const h of Object.values(G.s.roster)) { const m = maxStats(h); h.hp = m.hp; h.mp = m.mp; }
}

// 回傳升級訊息陣列
export function gainExp(h, n) {
  const msgs = []; h.exp += n;
  while (h.exp >= expNext(h.lv) && h.lv < 60) {
    const before = maxStats(h), oldSkills = heroSkills(h);
    h.exp -= expNext(h.lv); h.lv++;
    const after = maxStats(h);
    h.hp += after.hp - before.hp; h.mp += after.mp - before.mp;
    msgs.push(`${HEROES[h.id].name} 升到 ${h.lv} 級！`);
    for (const sk of heroSkills(h)) if (!oldSkills.includes(sk)) msgs.push(`${HEROES[h.id].name} 領悟了「${SKILLS[sk].name}」！`);
  }
  return msgs;
}

// 條件判斷：flag:x, !flag:x, item:x, hero:x, party:x, choice:n, gold:n, lv:n, ch:n ；以 & 串接
export function cond(c, ctx = {}) {
  if (!c) return true;
  return c.split('&').every(part => {
    part = part.trim(); let neg = false;
    if (part[0] === '!') { neg = true; part = part.slice(1); }
    const ci = part.indexOf(':'); const k = ci < 0 ? part : part.slice(0, ci), v = ci < 0 ? '' : part.slice(ci + 1);
    let r;
    switch (k) {
      case 'flag': r = flag(v); break;
      case 'item': r = invCount(v) > 0; break;
      case 'hero': r = !!G.s.roster[v]; break;
      case 'party': r = G.s.party.includes(v); break;
      case 'choice': r = String(ctx.choice) === v; break;
      case 'gold': r = G.s.gold >= +v; break;
      case 'lv': r = avgLevel() >= +v; break;
      case 'ch': r = G.s.chapter >= +v; break;
      case 'quest': r = G.s.quests[v] === 'done'; break;
      case 'result': r = ctx.result === v; break;
      case 'qactive': r = G.s.quests[v] === 'active'; break;
      default: r = flag(part);
    }
    return neg ? !r : r;
  });
}
