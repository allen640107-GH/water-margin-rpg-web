// 平衡模擬：node tools/sim.mjs  —— 依章節順序打完所有戰鬥（含支線），估算等級與勝率
import { MAPS, SCRIPTS } from '../js/data/world.js';
import { G, newGame, maxStats, heroSkills, gainExp, joinHero, avgLevel } from '../js/state.js';
import { SKILLS } from '../js/data/skills.js';
import { ARCHETYPES, BOSSES } from '../js/data/enemies.js';
import { parse } from '../js/script.js';

G.s = newGame();
const HP_K = +(process.env.HPK || 0.5), ATK_K = +(process.env.ATKK || 0.07);
const rnd = (a, b) => a + Math.random() * (b - a);
function mkFoe(t) {
  if (t.includes('@')) { const [a, l] = t.split('@'); const A = ARCHETYPES[a], L = +l - 1;
    return { name: t, foe: 1, mhp: Math.round(A.hp * (1 + 0.27 * L)), atk: Math.round(A.atk * (1 + 0.155 * L)), def: Math.round(A.def * (1 + 0.155 * L)), int: Math.round(A.int * (1 + 0.15 * L)), spd: Math.round(A.spd + 0.55 * L), luk: 3 + Math.floor(L / 3), exp: Math.round(A.exp * (1 + 0.5 * L + 0.03 * L * L)), acts: A.acts }; }
  const B = BOSSES[t]; return { name: t, foe: 1, ...B, mhp: B.hp, luk: 6 + Math.floor(B.lv / 3) };
}
function dmg(a, t, Sk) {
  if (Math.random() > (Sk.acc || 0.95) - 0.04) return 0;
  let A, D; if (Sk.kind === 'mag') { A = a.int * 1.25 + a.atk * 0.15; D = t.int * 0.6 + t.def * 0.35; } else { A = a.atk; D = t.def; }
  let d = (Sk.power || 1) * A * A / (A + D) * rnd(0.9, 1.1); if (Sk.vs && t.kind === Sk.vs[0]) d *= Sk.vs[1];
  if (Math.random() < 0.05 + a.luk * 0.004 + (Sk.crit || 0)) d *= 1.6; if (t.defending) d *= 0.5; return Math.max(1, Math.round(d));
}
function fight(spec, items = { herb: 4, pill: 1 }) {
  const n = Math.min(4, G.s.party.length), kh = 1 + HP_K * (n - 1), ka = 1 + ATK_K * (n - 1);
  const foes = spec.split('+').map(mkFoe).map(f => ({ ...f, mhp: Math.round(f.mhp * (f.pattern ? 1 + 0.3 * (n - 1) : kh)), atk: Math.round(f.atk * ka), pi: 0, enr: false })).map(f => ({ ...f, hp: f.mhp }));
  const heroes = G.s.party.slice(0, 4).map(id => { const h = G.s.roster[id]; const m = maxStats(h); return { id, ...m, mhp: m.hp, mmp: m.mp, hp: m.hp, mp: m.mp, sk: heroSkills(h) }; });
  const inv = { ...items };
  for (let round = 1; round < 60; round++) {
    const order = [...heroes, ...foes].filter(x => x.hp > 0).sort((x, y) => y.spd * rnd(.85, 1.15) - x.spd * rnd(.85, 1.15));
    for (const a of order) {
      if (a.hp <= 0) continue;
      const fl = foes.filter(f => f.hp > 0), hl = heroes.filter(h => h.hp > 0);
      if (!fl.length) return { win: true, round, exp: foes.reduce((s, f) => s + f.exp, 0) };
      if (!hl.length) return { win: false, round };
      if (!a.foe) {
        const sks = a.sk.map(k => [k, SKILLS[k]]).filter(([, s]) => s.mp <= a.mp);
        const hurt = hl.filter(x => x.hp < x.mhp * 0.4);
        const heal = sks.find(([, s]) => s.kind === 'heal');
        if (hurt.length && heal) { a.mp -= heal[1].mp; for (const t of heal[1].target === 'allies' ? hl : [hurt[0]]) t.hp = Math.min(t.mhp, t.hp + Math.round(heal[1].power * (a.int * 3 + a.mhp * 0.08 + 20))); continue; }
        if (a.hp < a.mhp * 0.3 && (inv.herb || inv.pill)) { if (inv.pill) { inv.pill--; a.hp = Math.min(a.mhp, a.hp + 400); } else { inv.herb--; a.hp = Math.min(a.mhp, a.hp + 150); } continue; }
        const ds = sks.filter(([, s]) => s.kind === 'phys' || s.kind === 'mag');
        let k = 'attack', Sk = SKILLS.attack;
        if (ds.length && a.mp > a.mmp * 0.2) { const multi = ds.filter(([, s]) => s.target === 'enemies'); [k, Sk] = fl.length >= 3 && multi.length ? multi[multi.length - 1] : ds[ds.length - 1]; a.mp -= Sk.mp; }
        const tg = Sk.target === 'enemies' ? fl : [fl.sort((x, y) => x.hp - y.hp)[0]];
        for (let i = 0; i < (Sk.hits || 1); i++) for (const t of tg) if (t.hp > 0) t.hp -= dmg(a, t, Sk);
        if (Sk.self) a.hp = Math.max(1, a.hp - Math.round(a.mhp * Sk.self));
      } else {
        let k = 'attack'; if (a.pattern) { k = a.pattern[a.pi++ % a.pattern.length]; } else if (a.acts) for (const [kk, p] of a.acts) if (Math.random() < p) { k = kk; break; }
        const Sk = SKILLS[k];
        if (Sk.kind === 'phys' || Sk.kind === 'mag') { const tg = Sk.target === 'enemies' ? hl : [hl[Math.floor(Math.random() * hl.length)]]; const atk = a.enr ? { ...a, atk: a.atk * 1.3 } : a; for (let i = 0; i < (Sk.hits || 1); i++) for (const t of tg) if (t.hp > 0) t.hp -= dmg(atk, t, Sk); }
        else if (Sk.kind === 'heal') a.hp = Math.min(a.mhp, a.hp + a.mhp * 0.08);
        if (a.enrage && !a.enr && a.hp < a.mhp * a.enrage[0]) a.enr = true;
      }
    }
  }
  return { win: false, round: 60 };
}
function rate(spec, n = 150) { let w = 0, r = 0; for (let i = 0; i < n; i++) { const x = fight(spec); if (x.win) { w++; r += x.round; } } return { wr: w / n, rounds: w ? r / w : 0 }; }
function award(spec) { const exp = spec.split('+').map(mkFoe).reduce((s, f) => s + f.exp, 0); const front = G.s.party.slice(0, 4); for (const id of G.s.party) gainExp(G.s.roster[id], front.includes(id) ? exp : Math.floor(exp / 2)); }
const SEEN = new Set();
function battlesIn(src, out = [], seen = SEEN) {
  if (!src || (seen === SEEN && SEEN.has(src))) return out;
  if (seen === SEEN) SEEN.add(src);
  const walk = ns => { for (const n of ns) { if (n.t === 'if') { n.branches.forEach(b => walk(b.body)); if (n.else) walk(n.else); } else if (n.t === 'cmd') { if (n.name === 'battle') out.push(n.args[0]); if (n.name === 'run' && !/^ch\d_(start|end)$/.test(n.args[0]) && n.args[0] !== 'ending' && !seen.has(n.args[0])) { seen.add(n.args[0]); battlesIn(SCRIPTS[n.args[0]], out, seen); } if (n.name === 'party' || n.name === 'join' || n.name === 'leave') out.push(['cmd', n.name, n.args[0]]); } } };
  walk(parse(src)); return out;
}
// 章節開頭的隊伍切換
const START = { 2: 'wusong', 3: 'chaogai', 5: 'songjiang' };
const rows = [];
let ch = 1;
for (const [id, d] of Object.entries(MAPS)) {
  if (d.ch !== ch) { ch = d.ch; if (START[ch]) { joinHero(START[ch]); G.s.party = [START[ch]]; } }
  const evs = [];
  for (const m of Object.values(d.marks || {})) {
    if (m.type === 'foe') evs.push(m.foe);
    for (const k of ['talk', 'script', 'pre', 'post']) battlesIn(m[k], evs);
  }
  battlesIn(d.intro, evs); battlesIn(d.onEnter, evs); battlesIn(d.onSolve, evs);
  // 加入／離隊先處理（近似）
  for (const e of evs) if (Array.isArray(e)) { const [, c, a] = e; if (c === 'join') joinHero(a); else if (c === 'leave') G.s.party = G.s.party.filter(x => x !== a); else { const all = a.endsWith('+'); const ids = a.replace(/\+$/, '').split(','); ids.forEach(x => joinHero(x)); G.s.party = all ? [...ids, ...Object.keys(G.s.roster).filter(x => !ids.includes(x))] : ids; } }
  if (id === 'fachang') G.s.party = G.s.party.filter(x => x !== 'songjiang');
  const bs = evs.filter(e => typeof e === 'string').map(s => ({ s, boss: s.split('+').some(t => BOSSES[t] && BOSSES[t].boss), arena: s.startsWith('ar_') }));
  bs.sort((a, b) => a.boss - b.boss);
  for (const b of bs) {
    if (b.arena) { const r = rate(b.s, 60); rows.push([id, b.s, avgLevel(), r.wr.toFixed(2), r.rounds.toFixed(1), 'arena(now)']); continue; }
    const r = rate(b.s);
    rows.push([id, b.s, avgLevel(), r.wr.toFixed(2), r.rounds.toFixed(1), b.boss ? 'BOSS' : '']);
    award(b.s);
  }
  if (id === 'zhujiazhuang') for (const a of ['ar_hong', 'ar_tiger', 'ar_jiang', 'ar_iron', 'ar_luan']) { const r = rate(a, 80); rows.push(['postgame', a, avgLevel(), r.wr.toFixed(2), r.rounds.toFixed(1), 'arena']); if (r.wr > 0.5) award(a); }
  rows.push([id, '--- end', avgLevel(), G.s.party.slice(0, 4).map(x => x + G.s.roster[x].lv).join(',')]);
}
for (const r of rows) console.log(r.join('\t'));
