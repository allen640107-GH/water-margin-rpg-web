// 資料驗證：node tools/validate.mjs  （地圖、劇本、引用、可達性、內容統計）
import { MAPS, SCRIPTS, QUESTS, CHAPTERS } from '../js/data/world.js';
import { HEROES, SPEAKERS } from '../js/data/heroes.js';
import { ITEMS, SHOPS } from '../js/data/items.js';
import { ARCHETYPES, BOSSES } from '../js/data/enemies.js';
import { SKILLS } from '../js/data/skills.js';
import { parse } from '../js/script.js';

const errs = [], warns = [];
const TILES = new Set(',.:_*s~=F^#R+rxoT '.split(''));
const CMDS = new Set('battle flag unflag give take gold join leave party goto shop inn choice heal chapter quest sfx toast bgm hide show tile exp wait save end ending cg title pos shake run'.split(' '));
const COND = new Set('flag item hero party choice gold lv ch quest qactive result'.split(' '));
const stats = { maps: 0, symbolBattles: 0, scriptedBattles: 0, bosses: new Set(), lines: 0, chars: 0, puzzles: 0, chests: 0, byCh: {} };
const chOf = id => (MAPS[id] && MAPS[id].ch) || 0;
function chStat(ch) { return stats.byCh[ch] = stats.byCh[ch] || { maps: 0, battles: 0, bosses: 0, lines: 0, chars: 0, puzzles: 0, foeExp: 0, steps: 0 }; }

function entriesOf(id) { const d = MAPS[id]; return d ? Object.values(d.marks || {}).filter(m => m.type === 'entry').map(m => m.id) : []; }
function checkSpec(spec, where, ch) {
  for (const t of spec.split('+')) {
    if (t.includes('@')) { const [a, l] = t.split('@'); if (!ARCHETYPES[a] || !(+l > 0)) errs.push(`${where}: bad foe ${t}`); }
    else if (!BOSSES[t]) errs.push(`${where}: bad boss ${t}`);
    else if (BOSSES[t].boss) { stats.bosses.add(t); }
  }
}
const KREF = [];
function checkCond(c, where) {
  if (!c) return;
  for (const m of c.matchAll(/flag:k:([a-z_0-9]+):(\d+),(\d+)/g)) KREF.push([m[1], +m[2], +m[3], where]);
  for (let part of c.split('&')) { part = part.trim().replace(/^!/, ''); const k = part.split(':')[0]; if (part.includes(':') && !COND.has(k)) errs.push(`${where}: bad cond ${part}`); if (k === 'item' && !ITEMS[part.split(':')[1]]) errs.push(`${where}: cond unknown item ${part}`); if ((k === 'quest' || k === 'qactive') && !QUESTS[part.split(':')[1]]) errs.push(`${where}: cond unknown quest ${part}`); if ((k === 'hero' || k === 'party') && !HEROES[part.split(':')[1]]) errs.push(`${where}: cond unknown hero ${part}`); }
}
const seenScripts = new Set();
function walk(nodes, where, ch) {
  for (const n of nodes) {
    if (n.t === 'say') { stats.lines++; stats.chars += n.text.length; const c = chStat(ch); c.lines++; c.chars += n.text.length; if (n.who && !SPEAKERS[n.who] && !warnSp.has(n.who)) warnSp.add(n.who); continue; }
    if (n.t === 'if') { for (const b of n.branches) { checkCond(b.cond, where); walk(b.body, where, ch); } if (n.else) walk(n.else, where, ch); continue; }
    const a = n.args;
    if (!CMDS.has(n.name)) errs.push(`${where}: unknown cmd @${n.name}`);
    switch (n.name) {
      case 'battle': checkSpec(a[0], where, ch); stats.scriptedBattles++; chStat(ch).battles++; if (a[0].split('+').some(t => BOSSES[t] && BOSSES[t].boss)) chStat(ch).bosses++; break;
      case 'give': case 'take': if (!ITEMS[a[0]]) errs.push(`${where}: unknown item ${a[0]}`); break;
      case 'join': case 'leave': if (!HEROES[a[0]]) errs.push(`${where}: unknown hero ${a[0]}`); break;
      case 'party': for (const h of a[0].replace(/\+$/, '').split(',')) if (!HEROES[h]) errs.push(`${where}: unknown hero ${h}`); break;
      case 'goto': if (!MAPS[a[0]]) errs.push(`${where}: goto unknown map ${a[0]}`); else if (!entriesOf(a[0]).includes(a[1] || 'start')) errs.push(`${where}: goto ${a[0]} missing entry ${a[1] || 'start'}`); break;
      case 'shop': if (!SHOPS[a[0]]) errs.push(`${where}: unknown shop ${a[0]}`); break;
      case 'quest': if (!QUESTS[a[0]]) errs.push(`${where}: unknown quest ${a[0]}`); break;
      case 'chapter': if (!CHAPTERS[a[0]]) errs.push(`${where}: unknown chapter ${a[0]}`); break;
      case 'run': if (!SCRIPTS[a[0]]) errs.push(`${where}: run unknown script ${a[0]}`); break;
      case 'cg': if (a[0] !== 'off' && !a[0].startsWith('bg_')) warns.push(`${where}: cg ${a[0]}`); break;
    }
  }
}
const warnSp = new Set();
function script(src, where, ch) { if (!src) return; try { walk(parse(src), where, ch); } catch (e) { errs.push(`${where}: parse ${e.message}`); } }

const scriptCh = {};
for (const [id, d] of Object.entries(MAPS)) {
  stats.maps++; const ch = d.ch || 0; const C = chStat(ch); C.maps++;
  const rows = d.grid.replace(/^\n+|\n+\s*$/g, '').split('\n');
  const W = Math.max(...rows.map(r => r.length)), H = rows.length;
  const grid = rows.map(r => r.padEnd(W, d.image ? ' ' : '#').split(''));
  const marks = d.marks || {};
  const used = new Set();
  const inst = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = grid[y][x];
    if (marks[c]) { used.add(c); inst.push({ c, x, y, m: marks[c] }); grid[y][x] = marks[c].under || d.ground || ','; }
    else if (!TILES.has(c)) errs.push(`${id}: unknown char '${c}' at ${x},${y}`);
  }
  for (const k of Object.keys(marks)) if (!used.has(k)) warns.push(`${id}: mark ${k} unused`);
  for (const k of ['bg', 'battleBg']) if (d[k] && !d[k].startsWith('bg_')) errs.push(`${id}: ${k}`);
  if (!inst.some(i => i.m.type === 'entry' && i.m.id === 'start')) errs.push(`${id}: no start entry`);
  for (const i of inst) {
    const m = i.m, w = `${id}:${i.c}`;
    checkCond(m.show, w); checkCond(m.cond, w); checkCond(m.open, w);
    if (m.type === 'foe') { checkSpec(m.foe, w, ch); stats.symbolBattles++; C.battles++; if (m.foe.split('+').some(t => BOSSES[t] && BOSSES[t].boss)) C.bosses++; script(m.pre, w, ch); script(m.post, w, ch);
      for (const t of m.foe.split('+')) { if (t.includes('@')) { const [a, l] = t.split('@'); const L = +l - 1; C.foeExp += Math.round(ARCHETYPES[a].exp * (1 + 0.5 * L + 0.03 * L * L)); } else C.foeExp += BOSSES[t].exp; } }
    if (m.type === 'npc') script(m.talk, w, ch);
    if (m.type === 'trig') script(m.script, w, ch);
    if (m.type === 'sign') script(m.text.includes('|') || m.text.includes('@') ? m.text : '|' + m.text, w, ch);
    if (m.type === 'gate') script(m.text, w, ch);
    if (m.type === 'switch') script(m.script, w, ch);
    if (m.type === 'exit') { script(m.deny, w, ch); script(m.script, w, ch); if (!MAPS[m.to]) errs.push(`${w}: exit to unknown map ${m.to}`); else if (!entriesOf(m.to).includes(m.at || 'start')) errs.push(`${w}: exit ${m.to} missing entry ${m.at}`); }
    if (m.type === 'chest') { stats.chests++; if (m.item && !ITEMS[m.item]) errs.push(`${w}: chest item ${m.item}`); }
    if (m.type === 'npc' || m.img) { /* tokens checked by test */ }
  }
  if (inst.some(i => i.m.type === 'boulder')) { stats.puzzles++; C.puzzles++; }
  if (inst.some(i => i.m.type === 'switch' || i.m.type === 'gate') && !inst.some(i => i.m.type === 'boulder')) { stats.puzzles++; C.puzzles++; }
  if (d.boat && inst.length) { /* boat maze counted as puzzle */ stats.puzzles++; C.puzzles++; }
  script(d.intro, id + ':intro', ch); script(d.onEnter, id + ':onEnter', ch); script(d.onSolve, id + ':onSolve', ch);
  // 可達性
  const solidT = c => d.boat ? !(c === '~' || c === '=' || c === 'o') : (c === ' ' || '#R^TF~r'.includes(c));
  const solidM = new Set(['npc', 'chest', 'sign', 'switch', 'obj', 'reset']);
  const at = new Map(inst.map(i => [i.y * W + i.x, i]));
  const reach = new Set(); const q = [];
  for (const i of inst) if (i.m.type === 'entry') { reach.add(i.y * W + i.x); q.push([i.x, i.y]); }
  let steps = 0;
  while (q.length) { const [x, y] = q.shift(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const k = ny * W + nx; if (reach.has(k)) continue; const i = at.get(k); if (solidT(grid[ny][nx])) continue; reach.add(k); if (i && solidM.has(i.m.type) && !i.m.show) continue; q.push([nx, ny]); steps++; } }
  C.steps += steps;
  for (const i of inst) if (i.m.type !== 'entry' && !reach.has(i.y * W + i.x)) errs.push(`${id}: ${i.m.type} ${i.c} at ${i.x},${i.y} unreachable`);
}
for (const [k, s] of Object.entries(SCRIPTS)) { const m = k.match(/^ch(\d)/); script(s, 'SCRIPTS.' + k, m ? +m[1] : (k === 'prologue' ? 1 : 0)); }
for (const k of Object.keys(QUESTS)) { /* ok */ }
for (const [mid, x, y, w] of KREF) { const d = MAPS[mid]; const rows = d ? d.grid.replace(/^\n+|\n+\s*$/g, '').split('\n') : []; const c = rows[y] && rows[y][x]; if (!d || !c || !d.marks[c] || d.marks[c].type !== 'foe') errs.push(`${w}: flag:k ref ${mid}:${x},${y} is not a foe`); }
// 英雄技能
for (const [id, h] of Object.entries(HEROES)) for (const [sk] of h.skills) if (!SKILLS[sk]) errs.push(`hero ${id}: skill ${sk}`);
for (const [id, h] of Object.entries(HEROES)) for (const v of Object.values(h.eq)) if (v && !ITEMS[v]) errs.push(`hero ${id}: eq ${v}`);
for (const [id, s] of Object.entries(SHOPS)) for (const it of s.items) if (!ITEMS[it]) errs.push(`shop ${id}: ${it}`);
console.log(JSON.stringify({ maps: stats.maps, symbolBattles: stats.symbolBattles, scriptedBattles: stats.scriptedBattles, bosses: stats.bosses.size, lines: stats.lines, chars: stats.chars, puzzles: stats.puzzles, chests: stats.chests }, null, 0));
console.log('byCh', JSON.stringify(stats.byCh));
if (warnSp.size) console.log('speakers without portrait:', [...warnSp].join(' '));
for (const w of warns) console.log('WARN', w);
for (const e of errs) console.log('ERR', e);
console.log(errs.length ? `FAIL ${errs.length} errors` : 'OK');
process.exit(errs.length ? 1 : 0);
