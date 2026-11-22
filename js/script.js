// 劇本小語言（DSL）
//   名字|台詞        對話（名字對應頭像）
//   |旁白            旁白
//   @指令 參數...    例如 @battle wolf@2+wolf@2、@flag 名稱、@give herb 2、@join luzhishen
//   @if 條件 / @elif 條件 / @else / @end
import { G, cond, setFlag, give, joinHero, leaveHero, healAll, activeParty, gainExp } from './state.js';
import { ITEMS } from './data/items.js';
import { HEROES } from './data/heroes.js';

export const API = {}; // 由 main.js 填入：say, choice, battle, gameOver, goto, shop, inn, toast, chapter, sfx, bgm, autosave, ending, cg, title, refreshMap, quest

const parsed = new Map();
export function parse(src) {
  if (Array.isArray(src)) return src;
  if (parsed.has(src)) return parsed.get(src);
  const lines = src.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('//'));
  let i = 0;
  function block(stopAt) {
    const out = [];
    while (i < lines.length) {
      const l = lines[i];
      if (l.startsWith('@')) {
        const sp = l.indexOf(' ');
        const name = (sp < 0 ? l.slice(1) : l.slice(1, sp)).trim();
        const rest = sp < 0 ? '' : l.slice(sp + 1).trim();
        if (stopAt.includes(name)) return out;
        i++;
        if (name === 'if') {
          const node = { t: 'if', branches: [{ cond: rest, body: block(['elif', 'else', 'end']) }], else: null };
          while (i < lines.length) {
            const l2 = lines[i]; const sp2 = l2.indexOf(' ');
            const n2 = (sp2 < 0 ? l2.slice(1) : l2.slice(1, sp2)).trim();
            const r2 = sp2 < 0 ? '' : l2.slice(sp2 + 1).trim();
            i++;
            if (n2 === 'elif') node.branches.push({ cond: r2, body: block(['elif', 'else', 'end']) });
            else if (n2 === 'else') node.else = block(['end']);
            else if (n2 === 'end') break;
          }
          out.push(node);
        } else out.push({ t: 'cmd', name, rest, args: rest ? rest.split(/\s+/) : [] });
      } else {
        i++;
        const p = l.indexOf('|');
        if (p < 0) out.push({ t: 'say', who: '', text: l });
        else out.push({ t: 'say', who: l.slice(0, p).trim(), text: l.slice(p + 1).trim() });
      }
    }
    return out;
  }
  const res = block([]);
  parsed.set(src, res);
  return res;
}

export async function run(src, ctx = {}) {
  const nodes = parse(src);
  for (const n of nodes) {
    const r = await exec(n, ctx);
    if (r === 'abort' || r === 'end') return r;
  }
  return 'ok';
}

async function exec(n, ctx) {
  if (n.t === 'say') { await API.say(n.who, n.text); return; }
  if (n.t === 'if') {
    for (const b of n.branches) if (cond(b.cond, ctx)) { return runNodes(b.body, ctx); }
    if (n.else) return runNodes(n.else, ctx);
    return;
  }
  const a = n.args;
  switch (n.name) {
    case 'battle': {
      const opts = { noLose: a.includes('nolose'), noEscape: a.includes('noescape') || true, bg: (a.find(x => x.startsWith('bg=')) || '').slice(3) || null };
      const r = await API.battle(a[0], opts);
      ctx.result = r;
      if (r === 'lose' && !opts.noLose) { await API.gameOver(); return 'abort'; }
      return;
    }
    case 'flag': setFlag(a[0], a[1] != null ? (isNaN(+a[1]) ? a[1] : +a[1]) : true); return;
    case 'unflag': setFlag(a[0], false); return;
    case 'give': { const id = a[0], k = +(a[1] || 1); give(id, k); API.sfx('item'); await API.toast(`獲得「${ITEMS[id] ? ITEMS[id].name : id}」${k > 1 ? ' ×' + k : ''}`); return; }
    case 'take': give(a[0], -(+(a[1] || 1))); return;
    case 'gold': { const k = +a[0]; G.s.gold = Math.max(0, G.s.gold + k); if (k > 0) { API.sfx('item'); await API.toast(`獲得銀兩 ${k}`); } return; }
    case 'join': { const h = joinHero(a[0], a[1] ? +a[1] : undefined); API.sfx('levelup'); await API.toast(`${HEROES[a[0]].title}・${HEROES[a[0]].name} 加入隊伍！（Lv ${h.lv}）`, 1600); return; }
    case 'leave': leaveHero(a[0]); return;
    case 'party': { const all = a[0].endsWith('+'); const ids = a[0].replace(/\+$/, '').split(','); for (const id of ids) joinHero(id); G.s.party = all ? [...ids, ...G.s.party.filter(x => !ids.includes(x)), ...Object.keys(G.s.roster).filter(x => !ids.includes(x) && !G.s.party.includes(x))] : ids.slice(); API.refreshMap && API.refreshMap(); return; }
    case 'goto': await API.goto(a[0], a[1] || 'start'); return;
    case 'shop': await API.shop(a[0]); return;
    case 'inn': await API.inn(+(a[0] || 0)); return;
    case 'choice': { ctx.choice = await API.choice(n.rest.split('|')); return; }
    case 'heal': healAll(); return;
    case 'chapter': G.s.chapter = Math.max(G.s.chapter, +a[0]); await API.chapter(+a[0], a.slice(1).join(' ')); return;
    case 'quest': G.s.quests[a[0]] = a[1] || 'active'; await API.quest(a[0], a[1] || 'active'); return;
    case 'sfx': API.sfx(a[0]); return;
    case 'toast': await API.toast(n.rest, 1800); return;
    case 'bgm': API.bgm(a[0]); return;
    case 'hide': setFlag(`h:${G.s.map}:${a[0]}`); API.refreshMap && API.refreshMap(); return;
    case 'show': setFlag(`h:${G.s.map}:${a[0]}`, false); API.refreshMap && API.refreshMap(); return;
    case 'tile': { const ms = API.mapState(G.s.map); ms.tiles = ms.tiles || {}; ms.tiles[`${a[0]},${a[1]}`] = a[2]; API.refreshMap && API.refreshMap(); return; }
    case 'exp': { const msgs = []; for (const h of activeParty()) msgs.push(...gainExp(h, +a[0])); await API.toast(`全隊獲得經驗 ${a[0]}`); for (const m of msgs) await API.toast(m); return; }
    case 'wait': await new Promise(r => setTimeout(r, +a[0] || 300)); return;
    case 'save': API.autosave(); return;
    case 'end': return 'end';
    case 'ending': await API.ending(); return 'end';
    case 'cg': API.cg(a[0] === 'off' ? null : a[0]); return;
    case 'title': await API.title(n.rest); return;
    case 'pos': API.pos(+a[0], +a[1], a[2]); return;
    case 'shake': API.shake && API.shake(); return;
    case 'run': return run(API.script(a[0]), ctx);
    default: console.warn('未知指令', n.name);
  }
}
async function runNodes(nodes, ctx) {
  for (const n of nodes) { const r = await exec(n, ctx); if (r === 'abort' || r === 'end') return r; }
}
