// 遊玩時間估算：node tools/playtime.mjs
// 方法（保守、以首次遊玩、不刷怪為準）：
//  對話：每句 1.2 秒（點擊/換行）＋ 字數 ÷ 7 字/秒（閱讀）
//  戰鬥：每場 = 15 秒（進場/結算）＋ 回合數 × 每回合時間；回合數取自 tools/sim.mjs 的模擬平均值，
//        每回合 = 我方人數 × 3 秒（選指令）＋ (我方＋敵方行動數) × 0.9 秒（動畫）
//  移動：從入口以 BFS 最短路徑、貪婪順序走訪地圖上所有互動點（NPC/敵人/寶箱/出口/機關），步數 × 0.2 秒 × 1.4（探索、走錯路、回頭交任務）
//  解謎：推石/機關門/水路迷宮/盤陀路各 4 分鐘
//  整備：每張有商店或客店的地圖 2 分鐘（買賣、換裝備、看技能）
import { MAPS, SCRIPTS } from '../js/data/world.js';
import { BOSSES } from '../js/data/enemies.js';
import { parse } from '../js/script.js';
import { execFileSync } from 'child_process';

const SIDE = new Set(['liaoerwa', 'cave', 'yanwu']); // 純支線地圖
const sim = execFileSync('node', ['tools/sim.mjs'], { encoding: 'utf8' }).split('\n').map(l => l.split('\t'));
const R = {}; // map -> [{spec, rounds, party}]
let lastParty = {};
for (let [map, spec, lv, wr, rounds] of sim) { if (map === 'yanwu') continue; if (map === 'postgame') map = 'yanwu'; if (spec && spec !== '--- end' && +rounds > 0) (R[map] = R[map] || []).push({ spec, rounds: +rounds }); }
for (const r of sim) if (r[1] === '--- end') lastParty[r[0]] = r[3].split(',').length;

const T = {};
const add = (k, f, v) => { T[k] = T[k] || { dlg: 0, battle: 0, walk: 0, puzzle: 0, prep: 0, lines: 0, battles: 0 }; T[k][f] += v; };
function dlg(src, key, seen = new Set()) {
  if (!src) return;
  const walk = ns => { for (const n of ns) { if (n.t === 'say') { add(key, 'dlg', 1.2 + n.text.length / 7); add(key, 'lines', 1); } else if (n.t === 'if') { n.branches.forEach(b => walk(b.body)); if (n.else) walk(n.else); } else if (n.name === 'run' && SCRIPTS[n.args[0]] && !/^ch\d_start$/.test(n.args[0]) && !seen.has(n.args[0])) { seen.add(n.args[0]); walk(parse(SCRIPTS[n.args[0]])); } } };
  walk(parse(src));
}
const chOfScript = k => { const m = k.match(/^ch(\d)_(start|end)$/); return m ? m[1] : null; };
for (const [k, s] of Object.entries(SCRIPTS)) { const c = chOfScript(k); if (c) dlg(s, 'ch' + c, new Set(Object.keys(SCRIPTS).filter(x => !chOfScript(x)))); }
dlg(SCRIPTS.prologue, 'ch1'); dlg(SCRIPTS.ending, 'ch6');

for (const [id, d] of Object.entries(MAPS)) {
  const key = SIDE.has(id) ? 'side:' + id : 'ch' + d.ch;
  const rows = d.grid.replace(/^\n+|\n+\s*$/g, '').split('\n'); const W = Math.max(...rows.map(r => r.length)), H = rows.length;
  const pts = []; let start = null;
  rows.forEach((r, y) => [...r].forEach((c, x) => { const m = d.marks && d.marks[c]; if (!m) return; if (m.type === 'entry' && m.id === 'start') start = [x, y]; else if (m.type !== 'entry') pts.push([x, y, m]); }));
  // 對話
  dlg(d.intro, key); dlg(d.onEnter, key); dlg(d.onSolve, key);
  for (const [, , m] of pts) { dlg(m.talk || m.script || m.pre, key); dlg(m.post, key); dlg(m.deny, key); if (m.type === 'sign') dlg(m.text.includes('|') || m.text.includes('@') ? m.text : '|' + m.text, key); if (m.type === 'gate') dlg(m.text, key); }
  // 戰鬥（使用 sim 的回合數）
  const n = lastParty[id] || 4;
  for (const b of R[id] || []) { const foes = b.spec.split('+').length; add(key, 'battle', 15 + b.rounds * (n * 3 + (n + foes) * 0.9)); add(key, 'battles', 1); }
  // 移動：以 BFS 實際路徑距離做貪婪走訪（互動點本身可進入）
  const solid = (x, y) => { if (x < 0 || y < 0 || x >= W || y >= H) return true; const c = rows[y][x] || '#'; if (d.marks && d.marks[c]) return false; return d.boat ? !'~=o'.includes(c) : (c === ' ' || '#R^TF~r'.includes(c)); };
  const bfs = (sx, sy) => { const D = new Map([[sy * W + sx, 0]]); const q = [[sx, sy]]; while (q.length) { const [x, y] = q.shift(); const dd = D.get(y * W + x); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (solid(nx, ny) || D.has(ny * W + nx)) continue; D.set(ny * W + nx, dd + 1); q.push([nx, ny]); } } return D; };
  let cur = start || [0, 0], left = pts.slice(), steps = 0;
  while (left.length) { const D = bfs(cur[0], cur[1]); const dist = p => D.has(p[1] * W + p[0]) ? D.get(p[1] * W + p[0]) : Math.abs(p[0] - cur[0]) + Math.abs(p[1] - cur[1]); left.sort((a, b) => dist(a) - dist(b)); const p = left.shift(); steps += dist(p); cur = p; }
  add(key, 'walk', steps * 0.2 * 1.4);
  const types = new Set(pts.map(p => p[2].type));
  if (types.has('boulder') || types.has('switch') || (types.has('gate') && !types.has('boulder')) || (d.boat && pts.length) || id === 'pantuolu') add(key, 'puzzle', 240);
  const src = JSON.stringify(d.marks || {}); if (src.includes('@shop') || src.includes('@inn')) add(key, 'prep', 120);
}
const fmt = s => { const m = Math.round(s / 60); return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}m`; };
let main = 0, side = 0; const out = [];
for (const k of Object.keys(T).sort()) { const t = T[k]; const tot = t.dlg + t.battle + t.walk + t.puzzle + t.prep; if (k.startsWith('side')) side += tot; else main += tot;
  out.push(`${k.padEnd(16)} ${fmt(tot).padStart(6)}  對話${t.lines}句 ${fmt(t.dlg)} | 戰鬥${t.battles}場 ${fmt(t.battle)} | 移動 ${fmt(t.walk)} | 解謎 ${fmt(t.puzzle)} | 整備 ${fmt(t.prep)}`); }
console.log(out.join('\n'));
console.log(`主線(含主線地圖內的支線) ${fmt(main)}，純支線地圖 ${fmt(side)}，合計 ${fmt(main + side)}`);
