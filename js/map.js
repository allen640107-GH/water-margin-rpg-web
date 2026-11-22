// 地圖：ASCII 方格（碰撞／謎題）＋ v2 手繪渲染（地表預繪、建築、樹木、全身行走角色，y 排序）
import { G, cond, setFlag, flag, give, avgLevel } from './state.js';
import { img, ready } from './assets.js';
import { ITEMS } from './data/items.js';
import { HEROES } from './data/heroes.js';
import { ARCHETYPES, BOSSES } from './data/enemies.js';
import { sfx } from './audio.js';

export const M = { id: null, def: null, W: 0, H: 0, rows: [], inst: [], px: 0, py: 0, moving: false, path: [], dirty: true, ts: 48, cam: [0, 0], dest: null, t0: 0 };
export const MAPH = {}; // main.js 提供：interact(inst), stepOn(inst), onPlates(), busy()

const TILECH = new Set(',.:_*s~=F^#R+rTxo'.split(''));
const SOLID_T = new Set(['#', 'R', '^', 'T', 'F', '~', 'r', ' ']);
const SOLID_M = new Set(['npc', 'foe', 'chest', 'sign', 'boulder', 'switch', 'obj', 'gate', 'reset']);

let canvas, ctx, dpr = 1, cw = 0, chh = 0;

export function initMap(cv) {
  canvas = cv; ctx = canvas.getContext('2d');
  resize();
}
export function resize() {
  if (!canvas) return;
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  cw = canvas.clientWidth || window.innerWidth; chh = canvas.clientHeight || window.innerHeight;
  canvas.width = Math.round(cw * dpr); canvas.height = Math.round(chh * dpr);
  const short = Math.min(cw, chh);
  M.ts = Math.max(40, Math.min(64, Math.round(short / (cw < chh ? 8.2 : 9.5))));
  M.dirty = true;
}

export function resetBoulders() { const ms = mapState(M.id); ms.boulders = {}; for (const b of M.inst) if (b.d.type === 'boulder') { b.x = b.ox; b.y = b.oy; } M.dirty = true; }
export function mapState(id) { return (G.s.mapState[id] = G.s.mapState[id] || {}); }

export function loadMap(def, id, entry) {
  M.id = id; M.def = def;
  const lines = def.grid.replace(/^\n+|\n+\s*$/g, '').split('\n');
  M.H = lines.length; M.W = Math.max(...lines.map(l => l.length));
  M.rows = lines.map(l => l.padEnd(M.W, def.image ? ' ' : '#').split(''));
  M.inst = []; const infer = [];
  const ms = mapState(id);
  for (let y = 0; y < M.H; y++) for (let x = 0; x < M.W; x++) {
    const ch = M.rows[y][x], md = def.marks && def.marks[ch];
    if (md) {
      const inst = { key: ch, x, y, ox: x, oy: y, d: md, id: `${id}:${x},${y}` };
      M.inst.push(inst);
      M.rows[y][x] = md.under || def.ground || ',';
      if (!md.under) infer.push([x, y]);
    } else if (/[A-Z0-9]/.test(ch) && !TILECH.has(ch)) {
      M.rows[y][x] = def.ground || ',';
      infer.push([x, y]);
    }
  }
  // 標記格的地面：取四周最常見的可走地面（避免草地上出現一塊石磚）
  const orig = lines.map(l => l.padEnd(M.W, ' '));
  for (const [x, y] of infer) {
    const cnt = {};
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
      const c = orig[y + dy] && orig[y + dy][x + dx];
      if (c && TILECH.has(c) && !SOLID_T.has(c) && !'+=xo'.includes(c)) cnt[c] = (cnt[c] || 0) + (dx && dy ? 1 : 2);
    }
    const best = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0];
    if (best && !(def.boat && best[0] !== '~')) M.rows[y][x] = best[0];
  }
  if (ms.tiles) for (const [k, v] of Object.entries(ms.tiles)) { const [x, y] = k.split(',').map(Number); if (M.rows[y]) M.rows[y][x] = v; }
  if (ms.boulders) for (const b of M.inst) if (b.d.type === 'boulder' && ms.boulders[b.id]) [b.x, b.y] = ms.boulders[b.id];
  // 出生點
  let pos = null;
  if (Array.isArray(entry)) pos = entry;
  else {
    const e = M.inst.find(i => i.d.type === 'entry' && i.d.id === entry) || M.inst.find(i => i.d.type === 'entry');
    if (e) pos = [e.x, e.y];
  }
  if (!pos) pos = [1, 1];
  M.px = pos[0]; M.py = pos[1]; G.s.x = pos[0]; G.s.y = pos[1]; G.s.map = id;
  M.path = []; M.dest = null; M.moving = false; M.dirty = true; M.anim = null; M.fx = M.px; M.fy = M.py;
  M.trail = []; M.walkT = 0;
  setupScene();
}

export function visible(i) {
  const d = i.d;
  if (d.type === 'entry') return false;
  if (flag(`h:${M.id}:${i.key}`)) return false;
  if (d.show && !cond(d.show)) return false;
  if (d.type === 'foe' && flag('k:' + i.id)) return false;
  if (d.type === 'trig' && d.once !== false && flag('t:' + i.id)) return false;
  return true;
}
function gateOpen(i) { return i.d.type === 'gate' && (cond(i.d.open) || flag('g:' + i.id)); }
export function instAt(x, y) { return M.inst.find(i => i.x === x && i.y === y && visible(i)); }
function tile(x, y) { return (M.rows[y] && M.rows[y][x]) || '#'; }
export function walkable(x, y, forPath = false) {
  if (x < 0 || y < 0 || x >= M.W || y >= M.H) return false;
  const t = tile(x, y);
  if (M.def.boat) { if (!(t === '~' || t === '=' || t === 'o')) return false; }
  else if (SOLID_T.has(t)) return false;
  const i = instAt(x, y);
  if (i) { if (i.d.type === 'gate') return gateOpen(i); if (SOLID_M.has(i.d.type)) return false; }
  return true;
}

// ───── 移動 ─────
const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
export function tryStep(dir) {
  if (M.moving) return false;
  G.s.dir = dir;
  const [dx, dy] = DIRS[dir]; const nx = M.px + dx, ny = M.py + dy;
  const i = instAt(nx, ny);
  if (i && i.d.type === 'boulder') {
    const bx = nx + dx, by = ny + dy;
    if (walkable(bx, by) && !instAt(bx, by)?.d?.type?.match(/boulder/) && tile(bx, by) !== '~') {
      i.x = bx; i.y = by; const ms = mapState(M.id); ms.boulders = ms.boulders || {}; ms.boulders[i.id] = [bx, by];
      sfx('push'); M.dirty = true; MAPH.onPlates && MAPH.onPlates();
    } else { M.dirty = true; return false; }
  }
  if (!walkable(nx, ny)) {
    M.dirty = true;
    if (i && (SOLID_M.has(i.d.type))) { M.path = []; i.face = (dir + 2) % 4; MAPH.interact && MAPH.interact(i); }
    return false;
  }
  M.trail.unshift([M.px, M.py, G.s.dir]); if (M.trail.length > 6) M.trail.length = 6;
  animateTo(nx, ny);
  return true;
}
function animateTo(nx, ny) {
  M.moving = true; const sx = M.px, sy = M.py, t0 = performance.now(), dur = 125;
  M.anim = { sx, sy, nx, ny, t0, dur };
}
export function update(now) {
  if (M.anim) {
    const a = M.anim, k = Math.min(1, (now - a.t0) / a.dur);
    M.fx = a.sx + (a.nx - a.sx) * k; M.fy = a.sy + (a.ny - a.sy) * k; M.dirty = true;
    if (k >= 1) {
      M.anim = null; M.px = a.nx; M.py = a.ny; M.fx = M.px; M.fy = M.py; M.moving = false;
      G.s.x = M.px; G.s.y = M.py; G.s.steps++;
      const i = M.inst.find(j => j.x === M.px && j.y === M.py && visible(j));
      if (i && MAPH.stepOn) { M.path = []; M.dest = null; MAPH.stepOn(i); }
      else if (M.path.length) nextPathStep();
      else M.dest = null;
    }
  } else { M.fx = M.px; M.fy = M.py; }
}
function nextPathStep() {
  if (MAPH.busy && MAPH.busy()) { M.path = []; return; }
  const [x, y] = M.path.shift();
  const dir = DIRS.findIndex(([dx, dy]) => dx === x - M.px && dy === y - M.py);
  if (dir < 0 || !tryStep(dir)) { M.path = []; M.dest = null; }
  if (!M.path.length && M.pendingInteract && !M.moving) { const pi = M.pendingInteract; M.pendingInteract = null; faceAndInteract(pi); }
}
function faceAndInteract(i) {
  const dx = i.x - M.px, dy = i.y - M.py;
  const dir = DIRS.findIndex(([a, b]) => a === Math.sign(dx) && b === Math.sign(dy) && (a === 0 || b === 0));
  if (dir >= 0) { G.s.dir = dir; i.face = (dir + 2) % 4; }
  M.dirty = true; MAPH.interact && MAPH.interact(i);
}

// BFS 尋路；目標為障礙物時走到相鄰格後互動
export function pathTo(tx, ty) {
  if (tx < 0 || ty < 0 || tx >= M.W || ty >= M.H) return false;
  const target = instAt(tx, ty);
  const goals = [];
  if (walkable(tx, ty)) goals.push([tx, ty]);
  else if (target && SOLID_M.has(target.d.type) && target.d.type !== 'boulder') { for (const [dx, dy] of DIRS) goals.push([tx + dx, ty + dy]); }
  else return false;
  const key = (x, y) => y * M.W + x;
  const prev = new Map(); const q = [[M.px, M.py]]; prev.set(key(M.px, M.py), null);
  let found = null;
  const isGoal = (x, y) => goals.some(([gx, gy]) => gx === x && gy === y);
  if (isGoal(M.px, M.py)) found = [M.px, M.py];
  while (q.length && !found) {
    const [x, y] = q.shift();
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy, k = key(nx, ny);
      if (prev.has(k) || !walkable(nx, ny)) continue;
      const mid = instAt(nx, ny);
      if (mid && !isGoal(nx, ny) && (mid.d.type === 'exit' || mid.d.type === 'trig')) continue; // 不經過出口／觸發點
      prev.set(k, [x, y]);
      if (isGoal(nx, ny)) { found = [nx, ny]; break; }
      q.push([nx, ny]);
    }
  }
  if (!found) return false;
  const path = []; let c = found;
  while (c && !(c[0] === M.px && c[1] === M.py)) { path.unshift(c); c = prev.get(key(c[0], c[1])); }
  M.path = path; M.dest = [tx, ty];
  M.pendingInteract = (target && SOLID_M.has(target.d.type)) ? target : null;
  if (!path.length) { if (M.pendingInteract) { const pi = M.pendingInteract; M.pendingInteract = null; faceAndInteract(pi); } return true; }
  if (!M.moving) nextPathStep();
  return true;
}
export function facing() { const [dx, dy] = DIRS[G.s.dir]; return instAt(M.px + dx, M.py + dy); }

export function screenToTile(sx, sy) { return [Math.floor((sx + M.cam[0]) / M.ts), Math.floor((sy + M.cam[1]) / M.ts)]; }
export function tileToScreen(x, y) { return [x * M.ts - M.cam[0] + M.ts / 2, y * M.ts - M.cam[1] + M.ts / 2]; }

// ───── 繪製（v2）─────
// 主題：決定牆、建築、樹木與門的畫法
const THEMES = {
  town: { wall: 'citywall', small: ['tile_s', 'tavern', 'tile_s'], large: 'tile_l', trees: ['willow', 'broad'], door: 'door_wood', bigDoor: 'door_red' },
  manor: { wall: 'citywall', small: ['tile_s'], large: 'tile_l', trees: ['broad', 'willow', 'pine'], door: 'door_red', bigDoor: 'door_red' },
  village: { wall: 'forest', small: ['thatch_s', 'tile_s', 'thatch_s'], large: 'thatch_l', trees: ['broad', 'willow', 'bamboo'], door: 'door_wood', bigDoor: 'door_wood' },
  fort: { wall: 'palisade', small: ['tile_s', 'thatch_s'], large: 'fort', trees: ['pine', 'broad'], door: 'door_stockade', bigDoor: 'door_stockade' },
  wild: { wall: 'forest', small: ['thatch_s'], large: 'thatch_l', trees: ['pine', 'broad'], door: 'door_wood', bigDoor: 'door_wood' },
  hills: { wall: 'cliff', small: ['thatch_s'], large: 'thatch_l', trees: ['pine', 'broad', 'pine'], door: 'door_wood', bigDoor: 'door_wood' },
  snow: { wall: 'cliff', small: ['snow'], large: 'snow', trees: ['snowpine'], door: 'door_wood', bigDoor: 'door_wood' },
  water: { wall: 'forest', small: ['thatch_s'], large: 'thatch_l', trees: ['willow', 'broad'], door: 'door_wood', bigDoor: 'door_wood' },
  interior: { wall: 'interior', small: [], large: null, trees: ['bamboo'], door: 'door_wood', bigDoor: 'door_red' },
  cave: { wall: 'cliff', small: [], large: null, trees: ['pine'], door: 'door_city', bigDoor: 'door_city' },
};
const MAP_THEME = {
  dongjing: 'town', cangzhou: 'town', yanggu: 'town', kuaihuolin: 'town', mengzhou: 'town', jiangzhou: 'town', fachang: 'town',
  chaijin: 'manor', lijia: 'manor', hujia: 'manor', baihutang: 'interior', jyg_tavern: 'interior', zhugui: 'interior', juyiting: 'interior', shanshenmiao: 'interior',
  dongxi: 'village', shizipo: 'village', chaozhuang: 'village', zhudian: 'village',
  liangshan: 'fort', erlongshan: 'fort', yanwu: 'fort', qingfengshan: 'fort', qingfeng: 'fort', zhujiazhuang: 'fort',
  yezhulin: 'wild', pantuolu: 'wild', jingyanggang: 'hills', huangnigang: 'hills', caoliao: 'snow',
  shijie: 'water', marsh: 'water', liaoerwa: 'water', river: 'water', cave: 'cave',
};
// 地表貼圖：字元 → 紋理（W 牆頂、D 深色木、K 林地）
const GTEX = { ',': 'tx_grass', '.': 'tx_dirt', ':': 'tx_paving', '_': 'tx_wood', '*': 'tx_snow', 's': 'tx_sand', '~': 'tx_water', '^': 'tx_rocktop', 'K': 'tx_grass', 'W': 'tx_paving', 'D': 'tx_wood' };
const GTINT = { 'K': 'rgba(20,40,10,.45)', 'W': 'rgba(30,30,35,.45)', 'D': 'rgba(20,10,4,.6)', '^': 'rgba(0,0,0,.08)' };
const SOFT = ['~', 's', '.', ',', 'K', '*', ':', '_'];   // 柔邊，自下而上
const HARD = ['^', 'W', 'D'];
const FALLBACK = { ',': '#7d9a5a', '.': '#a98b5e', ':': '#9a9a96', '_': '#6a4a2a', '*': '#e8eef4', 's': '#d8c070', '~': '#5d8fa8', '^': '#7a7670', 'K': '#3f5a2c', 'W': '#4a4846', 'D': '#2a1a10' };
// 角色比例（相對格高）
const SPR_H = { n_child: 1.12, e_dog: 1.05, e_wolf: 1.2, e_boar: 1.2, e_leopard: 1.2, e_snake: 0.95, b_tiger: 1.75, likui: 1.58, luzhishen: 1.6, b_jiangmenshen: 1.68, b_luantingyu: 1.64, b_zhubiao: 1.6 };
const PROPS = new Set(['tree_pine', 'tree_willow', 'tree_broad', 'tree_snowpine', 'tree_bamboo', 'tree_poplar', 'chest', 'chest_open', 'boulder', 'rock', 'bush', 'reeds', 'signpost', 'lantern', 'well', 'haystack', 'jars', 'cart', 'statue']);
const mimg = n => img('map/' + n);
export const sprName = im => (im || '').replace(/^p_/, '');
const sprImg = n => img('spr/' + sprName(n));
function hash(x, y, s = 0) { let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

const S = { theme: THEMES.town, wallStyle: 'citywall', blds: [], trees: [], reeds: [], ground: null, gsig: '', gP: 0, need: [] };

function foeImg(spec) { const t = spec.split('+')[0]; return t.includes('@') ? ARCHETYPES[t.split('@')[0]].img : BOSSES[t].img; }
function instSprite(i) {
  const d = i.d;
  if (d.type === 'foe') return foeImg(d.foe);
  if (d.type === 'npc' && d.img && !PROPS.has(d.img)) return d.img;
  return null;
}
function setupScene() {
  const def = M.def;
  const tname = MAP_THEME[M.id] || (def.boat ? 'water' : def.ground === '_' ? 'interior' : def.ground === '*' ? 'snow' : 'village');
  S.theme = THEMES[tname]; S.themeName = tname; S.wallStyle = S.theme.wall;
  S.ground = null; S.gsig = '';
  // 建築：R/+ 連通塊
  S.blds = []; const seen = new Set();
  const isB = (x, y) => { const c = tile(x, y); return c === 'R' || c === '+'; };
  for (let y = 0; y < M.H; y++) for (let x = 0; x < M.W; x++) {
    if (!isB(x, y) || seen.has(y * M.W + x)) continue;
    const q = [[x, y]], cells = []; seen.add(y * M.W + x);
    while (q.length) { const [cx, cy] = q.pop(); cells.push([cx, cy]); for (const [dx, dy] of DIRS) { const nx = cx + dx, ny = cy + dy; if (nx >= 0 && ny >= 0 && nx < M.W && ny < M.H && isB(nx, ny) && !seen.has(ny * M.W + nx)) { seen.add(ny * M.W + nx); q.push([nx, ny]); } } }
    const xs = cells.map(c => c[0]), ys = cells.map(c => c[1]);
    const b = { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
    b.doors = cells.filter(([cx, cy]) => tile(cx, cy) === '+');
    const w = b.x1 - b.x0 + 1, h = b.y1 - b.y0 + 1;
    if (tname === 'interior' || tname === 'cave' || !S.theme.large) { S.blds.push({ ...b, kind: 'strip_interior', strip: true }); continue; }
    const n = w > 7 ? Math.ceil(w / 6.2) : 1;
    for (let k = 0; k < n; k++) {
      const sx0 = b.x0 + Math.round(k * w / n), sx1 = b.x0 + Math.round((k + 1) * w / n) - 1, sw = sx1 - sx0 + 1;
      const big = h >= 3 && sw >= 6 || sw >= 7 || (n > 1 && h >= 2);
      const small = S.theme.small; const kind = big ? S.theme.large : small[Math.floor(hash(sx0, b.y0, 3) * small.length)];
      S.blds.push({ x0: sx0, x1: sx1, y0: b.y0, y1: b.y1, kind, big, doors: b.doors.filter(([dx]) => dx >= sx0 && dx <= sx1) });
    }
  }
  // 樹木：T、F（及森林式外牆）
  S.trees = []; S.reeds = [];
  const tr = S.theme.trees;
  for (let y = 0; y < M.H; y++) for (let x = 0; x < M.W; x++) {
    const c = tile(x, y);
    if (c === 'T') S.trees.push({ x, y, kind: tr[Math.floor(hash(x, y, 1) * tr.length)], h: 1.85 + hash(x, y, 2) * 0.35, j: 0 });
    else if (c === 'F' || (c === '#' && S.wallStyle === 'forest')) {
      const fk = S.themeName === 'snow' ? 'snowpine' : hash(x, y, 4) < 0.55 ? 'broad' : 'pine';
      S.trees.push({ x, y, kind: fk, h: 1.3 + hash(x, y, 5) * 0.3, j: (hash(x, y, 6) - 0.5) * 0.25, dense: true });
    } else if (c === 'r') S.reeds.push({ x, y });
  }
  // 預載
  const need = new Set();
  for (const ch of SOFT.concat(HARD)) need.add('map/' + GTEX[ch]);
  for (const b of S.blds) { need.add('map/' + (b.strip ? 'strip_interior' : 'bld_' + b.kind)); for (const _ of b.doors) need.add('map/' + (b.big ? S.theme.bigDoor : S.theme.door)); }
  for (const t of S.trees) need.add('map/tree_' + t.kind);
  if (S.reeds.length) need.add('map/reeds');
  need.add('map/strip_cliff'); need.add('map/strip_citywall'); need.add('map/strip_palisade'); need.add('map/strip_interior');
  for (const i of M.inst) { const s = instSprite(i); if (s) need.add('spr/' + sprName(s)); if (i.d.img && PROPS.has(i.d.img)) need.add('map/' + i.d.img); }
  for (const id of G.s.party || []) if (HEROES[id]) need.add('spr/' + sprName(HEROES[id].img));
  ['chest', 'chest_open', 'boulder', 'signpost', 'door_stockade', 'door_city'].forEach(n => need.add('map/' + n));
  S.need = [...need]; for (const n of S.need) img(n);
}
export function sceneAssets() { return S.need.slice(); }

// 地表預繪（每格 P 像素）
function groundTerrain(x, y) {
  const c = tile(x, y), base = M.def.ground || ',';
  const baseT = base === '~' ? ',' : base;
  switch (c) {
    case ',': case '.': case ':': case '_': case '*': case 's': case '~': return c;
    case '^': return S.wallStyle === 'interior' ? 'D' : '^';
    case 'F': return 'K';
    case '#': return S.wallStyle === 'forest' ? 'K' : S.wallStyle === 'cliff' ? '^' : S.wallStyle === 'interior' ? 'D' : 'W';
    case 'r': return M.def.boat ? '~' : ',';
    case 'o': return M.def.boat ? '~' : ':';
    case 'x': return '.';
    case '=': { for (const [dx, dy] of DIRS) if (tile(x + dx, y + dy) === '~') return '~'; return '.'; }
    default: { // T R + 依鄰格
      const cnt = {};
      for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, 1]]) { const n = tile(x + dx, y + dy); if (',.:_*s'.includes(n)) cnt[n] = (cnt[n] || 0) + 1; }
      let best = baseT, bv = 0; for (const [k, v] of Object.entries(cnt)) if (v > bv) { best = k; bv = v; }
      return best;
    }
  }
}
function solidGroup(c) { return c === '#' || c === '^' || c === 'R' || c === '+' || c === 'F'; }
function buildGround() {
  const W = M.W, H = M.H;
  const P = Math.max(24, Math.floor(Math.min(96, M.ts * dpr, Math.sqrt(4.2e6 / (W * H)))));
  const allReady = S.need.filter(n => n.startsWith('map/tx_') || n.startsWith('map/strip_')).every(n => ready(img(n)));
  const g = document.createElement('canvas'); g.width = W * P; g.height = H * P;
  const gx = g.getContext('2d');
  const T = []; for (let y = 0; y < H; y++) { T.push([]); for (let x = 0; x < W; x++) T[y].push(groundTerrain(x, y)); }
  const pat = (ch) => {
    const im = mimg(GTEX[ch]); if (!ready(im)) return FALLBACK[ch];
    const p = gx.createPattern(im, 'repeat'); const sc = (P * 2.6) / im.width;
    if (p.setTransform) p.setTransform(new DOMMatrix([sc, 0, 0, sc, hash(ch.charCodeAt(0), 1) * 200, 0]));
    return p;
  };
  // 1) 硬邊全鋪
  for (const ch of SOFT.concat(HARD)) {
    let any = false; gx.beginPath();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (T[y][x] === ch) { gx.rect(x * P, y * P, P, P); any = true; }
    if (!any) continue;
    gx.fillStyle = pat(ch); gx.fill();
    if (GTINT[ch]) { gx.fillStyle = GTINT[ch]; gx.fill(); }
  }
  // 2) 柔邊：低解析度遮罩放大＝羽化
  const R = 4, mk = document.createElement('canvas'); mk.width = W * R; mk.height = H * R;
  const mx = mk.getContext('2d');
  const tmp = document.createElement('canvas'); tmp.width = g.width; tmp.height = g.height; const tx = tmp.getContext('2d');
  SOFT.forEach((ch, idx) => {
    if (idx === 0) return;
    mx.clearRect(0, 0, mk.width, mk.height); mx.fillStyle = '#fff'; let any = false;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (T[y][x] === ch) {
      any = true; mx.fillRect(x * R, y * R, R, R);
      // 不規則邊緣
      for (const [dx, dy] of DIRS) { const n = T[y + dy] && T[y + dy][x + dx]; if (n && n !== ch && SOFT.indexOf(n) < idx && SOFT.includes(n)) { const r = hash(x, y, dx * 3 + dy + 7); if (r < 0.5) mx.fillRect(x * R + (dx > 0 ? R : dx < 0 ? -1 : Math.floor(r * 4)), y * R + (dy > 0 ? R : dy < 0 ? -1 : Math.floor(r * 4)), 1, 1); } }
    }
    if (!any) return;
    tx.clearRect(0, 0, tmp.width, tmp.height); tx.globalCompositeOperation = 'source-over';
    tx.imageSmoothingEnabled = true; tx.imageSmoothingQuality = 'high'; tx.drawImage(mk, 0, 0, tmp.width, tmp.height);
    tx.globalCompositeOperation = 'source-in'; tx.fillStyle = pat(ch); tx.fillRect(0, 0, tmp.width, tmp.height);
    if (GTINT[ch]) { tx.fillStyle = GTINT[ch]; tx.fillRect(0, 0, tmp.width, tmp.height); }
    gx.drawImage(tmp, 0, 0);
  });
  tx.globalCompositeOperation = 'source-over';
  // 3) 細節：水岸、橋、坑、踏石、懸崖與牆面
  const stripPat = (name, hgt) => { const im = mimg(name); if (!ready(im)) return null; const p = gx.createPattern(im, 'repeat-x'); const sc = hgt / im.height; if (p.setTransform) p.setTransform(new DOMMatrix([sc, 0, 0, sc, 0, 0])); return [p, sc, im]; };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = tile(x, y), X = x * P, Y = y * P, t = T[y][x];
    if (t === '~') { // 水岸陰影與白沫
      const up = T[y - 1] && T[y - 1][x];
      if (up && up !== '~') { const gr = gx.createLinearGradient(0, Y, 0, Y + P * 0.35); gr.addColorStop(0, 'rgba(20,30,20,.35)'); gr.addColorStop(1, 'rgba(20,30,20,0)'); gx.fillStyle = gr; gx.fillRect(X, Y, P, P * 0.35); }
      gx.strokeStyle = 'rgba(255,255,250,.35)'; gx.lineWidth = Math.max(1, P * 0.03);
      for (const [dx, dy] of DIRS) { const n = T[y + dy] && T[y + dy][x + dx]; if (n && n !== '~') { gx.beginPath(); if (dy) { const yy = Y + (dy > 0 ? P - P * 0.06 : P * 0.06); gx.moveTo(X, yy); gx.quadraticCurveTo(X + P / 2, yy + (hash(x, y) - 0.5) * P * 0.1, X + P, yy); } else { const xx = X + (dx > 0 ? P - P * 0.06 : P * 0.06); gx.moveTo(xx, Y); gx.quadraticCurveTo(xx + (hash(x, y) - 0.5) * P * 0.1, Y + P / 2, xx, Y + P); } gx.stroke(); } }
    }
    if (c === '=') { // 木橋
      const im = mimg('tx_wood'); const vert = tile(x, y - 1) === '=' || tile(x, y + 1) === '=' || (!['~', 'r'].includes(tile(x, y - 1)) && !['~', 'r'].includes(tile(x, y + 1)) ? false : (tile(x - 1, y) === '~' && tile(x + 1, y) === '~'));
      gx.save(); gx.beginPath(); gx.rect(X - 1, Y + (vert ? -1 : P * 0.12), P + 2, vert ? P + 2 : P * 0.76); gx.clip();
      if (ready(im)) { gx.translate(X + P / 2, Y + P / 2); if (vert) gx.rotate(Math.PI / 2); gx.drawImage(im, 0, 0, 128, 128, -P / 2 - 1, -P / 2 - 1, P + 2, P + 2); } else { gx.fillStyle = '#7a5530'; gx.fillRect(X, Y, P, P); }
      gx.restore();
      gx.fillStyle = 'rgba(40,20,5,.55)';
      if (vert) { gx.fillRect(X, Y, P * 0.07, P); gx.fillRect(X + P * 0.93, Y, P * 0.07, P); } else { gx.fillRect(X, Y + P * 0.1, P, P * 0.06); gx.fillRect(X, Y + P * 0.84, P, P * 0.08); }
    }
    if (c === 'x') { const gr = gx.createRadialGradient(X + P / 2, Y + P / 2, P * 0.05, X + P / 2, Y + P / 2, P * 0.42); gr.addColorStop(0, 'rgba(10,5,0,.85)'); gr.addColorStop(1, 'rgba(10,5,0,0)'); gx.fillStyle = gr; gx.fillRect(X, Y, P, P); }
    if (c === 'o') { gx.fillStyle = '#8d8a80'; gx.strokeStyle = 'rgba(40,40,35,.6)'; gx.lineWidth = 2; gx.beginPath(); gx.ellipse(X + P / 2, Y + P * 0.55, P * 0.36, P * 0.26, 0, 0, 7); gx.fill(); gx.stroke(); gx.fillStyle = 'rgba(255,255,255,.18)'; gx.beginPath(); gx.ellipse(X + P * 0.45, Y + P * 0.47, P * 0.2, P * 0.1, 0, 0, 7); gx.fill(); }
    // 牆／崖：下方是空地 → 畫立面
    const below = tile(x, y + 1), openBelow = !solidGroup(below) && y + 1 < H;
    const style = c === '^' ? (S.wallStyle === 'interior' ? 'interior' : 'cliff') : c === '#' ? S.wallStyle : null;
    if (style && style !== 'forest') {
      if (openBelow) {
        const name = style === 'cliff' ? 'strip_cliff' : style === 'interior' ? 'strip_interior' : style === 'palisade' ? 'strip_palisade' : 'strip_citywall';
        const fh = style === 'cliff' ? P * 0.62 : P;
        const sp = stripPat(name, style === 'cliff' ? P * 1.2 : P * 1.05);
        if (sp) { gx.save(); gx.translate(0, Y + P - (style === 'cliff' ? P * 1.2 : P * 1.05)); gx.fillStyle = sp[0]; gx.fillRect(X, (style === 'cliff' ? P * 1.2 : P * 1.05) - fh, P, fh); gx.restore(); }
        else { gx.fillStyle = 'rgba(0,0,0,.4)'; gx.fillRect(X, Y + P - fh, P, fh); }
        const gr = gx.createLinearGradient(0, Y + P - fh, 0, Y + P); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.28)'); gx.fillStyle = gr; gx.fillRect(X, Y + P - fh, P, fh);
        gx.fillStyle = 'rgba(0,0,0,.25)'; gx.fillRect(X, Y + P, P, P * 0.1); // 投影
      } else if (style === 'cliff' || style === 'citywall' || style === 'palisade') {
        // 牆頂邊緣高光
        if (!solidGroup(tile(x, y - 1))) { gx.fillStyle = 'rgba(255,250,230,.16)'; gx.fillRect(X, Y, P, P * 0.08); }
      }
      if (style === 'palisade' && !openBelow) { gx.fillStyle = 'rgba(60,40,20,.35)'; gx.fillRect(X, Y, P, P); }
    }
  }
  S.ground = g; S.gP = P; S.complete = allReady;
}

// ───── 每幀繪製 ─────
let lastTileSig = '';
export function draw(now) {
  if (!ctx || !M.def) return;
  const ts = M.ts;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = M.def.void || '#141009'; ctx.fillRect(0, 0, cw, chh);
  const fx = M.fx ?? M.px, fy = M.fy ?? M.py;
  const mw = M.W * ts, mh = M.H * ts;
  let camx = fx * ts + ts / 2 - cw / 2, camy = fy * ts + ts / 2 - chh / 2;
  camx = mw <= cw ? (mw - cw) / 2 : Math.max(0, Math.min(mw - cw, camx));
  camy = mh <= chh ? (mh - chh) / 2 : Math.max(0, Math.min(mh - chh, camy));
  M.cam = [camx, camy];
  ctx.save(); ctx.translate(-Math.round(camx), -Math.round(camy));
  const x0 = Math.max(0, Math.floor(camx / ts) - 1), y0 = Math.max(0, Math.floor(camy / ts) - 1);
  const x1 = Math.min(M.W - 1, Math.ceil((camx + cw) / ts)), y1 = Math.min(M.H - 1, Math.ceil((camy + chh) / ts) + 2);
  const t = now / 1000;
  if (M.def.image) {
    const im = img(M.def.image); if (ready(im)) ctx.drawImage(im, 0, 0, mw, mh); else { ctx.fillStyle = '#d8c8a0'; ctx.fillRect(0, 0, mw, mh); }
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (tile(x, y) === '.') { ctx.fillStyle = 'rgba(120,80,30,.55)'; ctx.beginPath(); ctx.arc(x * ts + ts / 2, y * ts + ts / 2, ts * 0.12, 0, 7); ctx.fill(); }
  } else {
    const sig = M.rows.map(r => r.join('')).join('');
    const wantP = Math.max(24, Math.floor(Math.min(96, M.ts * dpr, Math.sqrt(4.2e6 / (M.W * M.H)))));
    if (!S.ground || sig !== lastTileSig || S.gP !== wantP || (!S.complete && S.need.filter(n => n.startsWith('map/tx_') || n.startsWith('map/strip_')).every(n => ready(img(n))))) { lastTileSig = sig; buildGround(); }
    const P = S.gP, sx = Math.max(0, camx / ts * P), sy = Math.max(0, camy / ts * P);
    const sw = Math.min(S.ground.width - sx, cw / ts * P), sh = Math.min(S.ground.height - sy, chh / ts * P);
    if (sw > 0 && sh > 0) ctx.drawImage(S.ground, sx, sy, sw, sh, sx / P * ts, sy / P * ts, sw / P * ts, sh / P * ts);
    drawWater(t, x0, y0, x1, y1, ts);
  }
  // 目的地標記
  if (M.dest) { const [dx, dy] = M.dest; ctx.strokeStyle = 'rgba(255,220,120,.9)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(dx * ts + ts / 2, dy * ts + ts * 0.62, ts * 0.36, ts * 0.2, 0, 0, 7); ctx.stroke(); }
  // 地面層事件（出口、踏板、觸發點）
  const items = [];
  const near = [];
  for (const i of M.inst) {
    if (!visible(i)) continue;
    if (i.x < x0 - 2 || i.x > x1 + 2 || i.y < y0 - 2 || i.y > y1 + 3) continue;
    const ty = i.d.type;
    if (ty === 'exit' || ty === 'plate' || ty === 'trig' || (ty === 'gate' && gateOpen(i))) drawFlat(i, ts, t);
    else items.push({ y: i.y + 1, k: 2, f: () => drawInst(i, ts, t) });
    if ((i.d.name || i.d.label) && Math.abs(i.x - fx) + Math.abs(i.y - fy) <= (ty === 'exit' ? 6 : 3)) near.push(i);
  }
  // y 排序：建築、樹、蘆葦、角色
  for (const b of S.blds) if (b.x1 >= x0 - 3 && b.x0 <= x1 + 3 && b.y0 <= y1 + 1 && b.y1 >= y0 - 1) items.push({ y: b.y1 + 1, k: 0, f: () => drawBuilding(b, ts) });
  for (const tr of S.trees) if (tr.x >= x0 - 1 && tr.x <= x1 + 1 && tr.y >= y0 && tr.y <= y1 + 1) items.push({ y: tr.y + 1, k: 0, f: () => drawTree(tr, ts, t) });
  for (const r of S.reeds) if (r.x >= x0 && r.x <= x1 && r.y >= y0 && r.y <= y1 + 1) items.push({ y: r.y + 1, k: 1, f: () => drawReeds(r, ts, t) });
  // 同伴跟隨（最多兩位）
  if (!M.def.boat && !M.def.image) {
    const fol = (G.s.party || []).slice(1, 3);
    fol.forEach((id, n) => {
      const a = M.trail[n], b = n === 0 ? [M.px, M.py] : M.trail[n - 1];
      if (!a || !HEROES[id]) return;
      const k = M.anim ? Math.min(1, (now - M.anim.t0) / M.anim.dur) : 1;
      const px = M.anim ? a[0] + (b[0] - a[0]) * k : (M.trail[n][0]), py = M.anim ? a[1] + (b[1] - a[1]) * k : M.trail[n][1];
      if (Math.abs(px - fx) + Math.abs(py - fy) < 0.5) return;
      const dir = M.anim ? (b[0] > a[0] ? 1 : b[0] < a[0] ? 3 : b[1] > a[1] ? 2 : 0) : (a[2] ?? 2);
      items.push({ y: py + 1, k: 3, f: () => drawChar(HEROES[id].img, dir, walkFrame(now), px, py, ts, {}) });
    });
  }
  items.push({ y: fy + 1, k: 4, f: () => drawPlayer(fx, fy, ts, now) });
  items.sort((a, b) => a.y - b.y || a.k - b.k);
  for (const it of items) it.f();
  // 名牌
  ctx.font = `800 ${Math.max(14, Math.round(ts * 0.3))}px ${getComputedStyle(document.body).fontFamily}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const i of near) {
    const label = i.d.type === 'exit' ? (i.d.label ? '往 ' + i.d.label : '') : i.d.name;
    if (!label) continue;
    const w = ctx.measureText(label).width + 14, hgt = Math.max(22, ts * 0.42);
    const tall = instSprite(i) ? sprH(instSprite(i)) : (i.d.type === 'exit' ? 0.4 : 1.0);
    const lx = i.x * ts + ts / 2, ly = (i.y + 0.92) * ts - tall * ts - hgt * 0.6;
    ctx.fillStyle = i.d.type === 'exit' ? 'rgba(120,20,12,.92)' : i.d.type === 'foe' ? 'rgba(90,10,6,.9)' : 'rgba(15,12,8,.88)';
    roundRect(lx - w / 2, ly - hgt / 2, w, hgt, 6); ctx.fill();
    ctx.fillStyle = '#fff7e3'; ctx.fillText(label, lx, ly + 1);
  }
  ctx.restore();
  // 夜色、天氣
  if (M.def.night) { ctx.fillStyle = M.def.night === true ? 'rgba(10,18,50,.38)' : M.def.night; ctx.fillRect(0, 0, cw, chh); }
  if (M.def.weather === 'snow') drawSnow(t);
  if (M.def.weather === 'heat') { ctx.fillStyle = 'rgba(255,190,60,.10)'; ctx.fillRect(0, 0, cw, chh); }
  if (M.def.weather === 'fog') drawFog(t);
  M.dirty = false;
}
function drawWater(t, x0, y0, x1, y1, ts) {
  ctx.save(); ctx.lineCap = 'round';
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const c = tile(x, y); if (!(c === '~' || (c === 'r' && M.def.boat) || (c === 'o' && M.def.boat))) continue;
    const X = x * ts, Y = y * ts, h = hash(x, y);
    const ph = t * 1.3 + h * 6.28;
    ctx.strokeStyle = `rgba(255,255,245,${0.16 + 0.12 * Math.sin(ph)})`; ctx.lineWidth = Math.max(1.2, ts * 0.03);
    const o = Math.sin(ph) * ts * 0.1;
    ctx.beginPath(); ctx.moveTo(X + ts * 0.12 + o, Y + ts * (0.3 + h * 0.4)); ctx.quadraticCurveTo(X + ts * 0.32 + o, Y + ts * (0.22 + h * 0.4), X + ts * 0.52 + o, Y + ts * (0.3 + h * 0.4)); ctx.stroke();
    if (h > 0.55) { const o2 = Math.cos(ph * 0.8) * ts * 0.08; ctx.beginPath(); ctx.moveTo(X + ts * 0.5 + o2, Y + ts * 0.78); ctx.quadraticCurveTo(X + ts * 0.66 + o2, Y + ts * 0.7, X + ts * 0.84 + o2, Y + ts * 0.78); ctx.stroke(); }
  }
  ctx.restore();
}
function drawBuilding(b, ts) {
  const w = b.x1 - b.x0 + 1, h = b.y1 - b.y0 + 1;
  if (b.strip) {
    const im = mimg('strip_interior'); const top = (b.y0 - 0.5) * ts, hh = (h + 0.5) * ts;
    if (ready(im)) { const sw = im.width * hh / im.height; for (let x = b.x0 * ts; x < (b.x1 + 1) * ts; x += sw) { const cwid = Math.min(sw, (b.x1 + 1) * ts - x); ctx.drawImage(im, 0, 0, cwid / sw * im.width, im.height, x, top, cwid, hh); } }
    else { ctx.fillStyle = '#3a2614'; ctx.fillRect(b.x0 * ts, top, w * ts, hh); }
    const gr = ctx.createLinearGradient(0, (b.y1 + 1) * ts - ts * 0.3, 0, (b.y1 + 1) * ts); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.35)'); ctx.fillStyle = gr; ctx.fillRect(b.x0 * ts, (b.y1 + 1) * ts - ts * 0.3, w * ts, ts * 0.3);
  } else {
    const im = mimg('bld_' + b.kind);
    const tw = (w + 0.3) * ts; let th = ready(im) ? tw * im.height / im.width : h * ts;
    th = Math.max((h + 0.15) * ts, Math.min((h + 1.3) * ts, th));
    const left = b.x0 * ts - 0.15 * ts, bottom = (b.y1 + 1) * ts + ts * 0.06;
    ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(left + tw / 2, bottom - ts * 0.02, tw * 0.52, ts * 0.22, 0, 0, 7); ctx.fill();
    if (ready(im)) ctx.drawImage(im, left, bottom - th, tw, th);
    else { ctx.fillStyle = '#5a5a5e'; ctx.fillRect(b.x0 * ts, b.y0 * ts, w * ts, h * ts); }
  }
  for (const [dx, dy] of b.doors) {
    const im = mimg(b.strip ? 'door_wood' : b.big ? S.theme.bigDoor : S.theme.door); if (!ready(im)) continue;
    const dw = ts * 0.92, dh = Math.min(ts * 1.35, dw * im.height / im.width);
    ctx.drawImage(im, dx * ts + (ts - dw) / 2, (dy + 1) * ts + ts * 0.04 - dh, dw, dh);
  }
}
function drawTree(tr, ts, t) {
  const im = mimg('tree_' + tr.kind); if (!ready(im)) { ctx.fillStyle = '#2f5a30'; ctx.beginPath(); ctx.arc(tr.x * ts + ts / 2, tr.y * ts + ts / 2, ts * 0.45, 0, 7); ctx.fill(); return; }
  const h = tr.h * ts, w = Math.min(ts * (tr.dense ? 1.55 : 1.9), h * im.width / im.height * (tr.dense ? 1.15 : 1));
  const cx = (tr.x + 0.5 + tr.j) * ts, by = (tr.y + 1) * ts - ts * 0.04;
  if (!tr.dense) { ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(cx, by - ts * 0.04, w * 0.36, ts * 0.16, 0, 0, 7); ctx.fill(); }
  const sway = Math.sin(t * 0.9 + tr.x * 0.7 + tr.y) * 0.012;
  ctx.save(); ctx.translate(cx, by); ctx.transform(1, 0, sway, 1, 0, 0); ctx.drawImage(im, -w / 2, -h, w, h); ctx.restore();
}
function drawReeds(r, ts, t) {
  const im = mimg('reeds'); if (!ready(im)) return;
  for (let k = 0; k < 2; k++) {
    const h = ts * (0.95 + hash(r.x, r.y, k) * 0.35), w = h * im.width / im.height;
    const cx = (r.x + 0.3 + k * 0.45) * ts, by = (r.y + 0.75 + k * 0.25) * ts;
    const sway = Math.sin(t * 1.4 + r.x + k * 2 + r.y * 0.5) * 0.08;
    ctx.save(); ctx.translate(cx, by); ctx.transform(1, 0, sway, 1, 0, 0); ctx.drawImage(im, -w / 2, -h, w, h); ctx.restore();
  }
}
function sprH(name) { return SPR_H[sprName(name)] || (name.startsWith('b_') ? 1.6 : 1.5); }
// 走路影格：A 站 B 站
function walkFrame(now) { if (!M.anim) return 1; const k = Math.min(1, (now - M.anim.t0) / M.anim.dur); return [0, 1, 2, 1][Math.floor(((G.s.steps || 0) + k) * 2) % 4]; }
function drawChar(name, dir, frame, tx, ty, ts, o) {
  const im = sprImg(name);
  const h = sprH(name) * ts * (o.scale || 1);
  const cx = (tx + 0.5) * ts, foot = (ty + 0.93) * ts;
  ctx.fillStyle = 'rgba(0,0,0,.32)'; ctx.beginPath(); ctx.ellipse(cx, foot - ts * 0.02, ts * 0.3 * (o.scale || 1) * (h > ts * 1.6 ? 1.3 : 1), ts * 0.11, 0, 0, 7); ctx.fill();
  if (o.ring) { ctx.strokeStyle = o.ring; ctx.lineWidth = Math.max(2, ts * 0.05); ctx.beginPath(); ctx.ellipse(cx, foot - ts * 0.02, ts * 0.38 * (o.scale || 1), ts * 0.15, 0, 0, 7); ctx.stroke(); }
  if (!ready(im)) { ctx.fillStyle = '#c9a24a'; ctx.beginPath(); ctx.ellipse(cx, foot - h / 2, ts * 0.28, h / 2, 0, 0, 7); ctx.fill(); return; }
  const CW = im.width / 3, CH = im.height / 4, w = h * CW / CH;
  const bob = o.bob || 0;
  ctx.save();
  if (o.tint) ctx.filter = o.tint;
  if (o.alpha != null) ctx.globalAlpha = o.alpha;
  ctx.drawImage(im, frame * CW, dir * CH, CW, CH, cx - w / 2, foot - h * (1 + bob), w, h * (1 + bob));
  ctx.restore();
}
function drawPlayer(fx, fy, ts, now) {
  const lead = G.s.party[0] || 'linchong';
  const name = HEROES[lead].img, dir = G.s.dir ?? 2, frame = walkFrame(now);
  const bob = M.anim ? 0 : Math.sin(now / 420) * 0.012;
  if (M.def.boat) {
    const cx = (fx + 0.5) * ts, by = (fy + 0.9) * ts, rock = Math.sin(now / 500) * ts * 0.03, side = dir === 1 || dir === 3;
    const bw = side ? ts * 1.35 : ts * 0.8, bh = ts * 0.42;
    drawChar(name, dir, 1, fx, fy - 0.18 + rock / ts, ts, { bob });
    ctx.save(); ctx.translate(cx, by + rock);
    ctx.fillStyle = '#5b3a1e'; ctx.strokeStyle = '#2e1c0c'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-bw / 2, -bh * 0.55); ctx.quadraticCurveTo(0, -bh * 0.35, bw / 2, -bh * 0.55); ctx.quadraticCurveTo(bw * 0.42, bh * 0.45, 0, bh * 0.5); ctx.quadraticCurveTo(-bw * 0.42, bh * 0.45, -bw / 2, -bh * 0.55); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,220,160,.25)'; ctx.fillRect(-bw * 0.42, -bh * 0.5, bw * 0.84, bh * 0.1);
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(0, bh * 0.45, bw * 0.6, bh * 0.25, 0, 0.2, Math.PI - 0.2); ctx.stroke();
    ctx.restore();
    return;
  }
  drawChar(name, dir, frame, fx, fy, ts, { bob });
}
function roundRect(x, y, w, h2, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h2, r); ctx.arcTo(x + w, y + h2, x, y + h2, r); ctx.arcTo(x, y + h2, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
const flakes = Array.from({ length: 110 }, () => [Math.random(), Math.random(), 0.5 + Math.random()]);
function drawSnow(t) {
  ctx.fillStyle = 'rgba(255,255,255,.85)';
  for (const [a, b, s] of flakes) {
    const x = ((a * cw + Math.sin(t * s + b * 10) * 30 - M.cam[0] * 0.2) % cw + cw) % cw, y = ((b * chh + t * 40 * s - M.cam[1] * 0.2) % chh + chh) % chh;
    ctx.beginPath(); ctx.arc(x, y, 1.5 + s * 1.5, 0, 7); ctx.fill();
  }
}
function drawFog(t) {
  const g = ctx.createRadialGradient(cw / 2, chh / 2, Math.min(cw, chh) * 0.25, cw / 2, chh / 2, Math.max(cw, chh) * 0.7); g.addColorStop(0, 'rgba(230,230,225,0)'); g.addColorStop(1, 'rgba(230,230,225,.75)'); ctx.fillStyle = g; ctx.fillRect(0, 0, cw, chh);
  ctx.fillStyle = 'rgba(240,240,235,.10)';
  for (let k = 0; k < 4; k++) { const y = ((k * 0.27 + t * 0.012 * (k + 1)) % 1.2 - 0.1) * chh, x = Math.sin(t * 0.1 + k) * cw * 0.2; ctx.beginPath(); ctx.ellipse(cw / 2 + x, y, cw * 0.7, chh * 0.07, 0, 0, 7); ctx.fill(); }
}
function prop(name, cx, foot, hgt, alpha) {
  const im = mimg(name); if (!ready(im)) return false;
  const w = Math.min(hgt * im.width / im.height, M.ts * 1.3), h = w * im.height / im.width;
  ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(cx, foot - M.ts * 0.03, w * 0.42, M.ts * 0.12, 0, 0, 7); ctx.fill();
  if (alpha != null) ctx.globalAlpha = alpha;
  ctx.drawImage(im, cx - w / 2, foot - h, w, h); ctx.globalAlpha = 1; return true;
}
function drawFlat(i, ts, t) {
  const d = i.d, cx = i.x * ts + ts / 2, cy = i.y * ts + ts / 2, r = ts * 0.44;
  switch (d.type) {
    case 'plate': { const on = M.inst.some(b => b.d.type === 'boulder' && b.x === i.x && b.y === i.y); ctx.strokeStyle = on ? '#ffd34a' : '#7a5020'; ctx.lineWidth = 3; ctx.fillStyle = on ? 'rgba(255,210,80,.35)' : 'rgba(60,30,10,.35)'; ctx.beginPath(); ctx.arc(cx, cy, r * 0.75, 0, 7); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy, r * 0.35, 0, 7); ctx.stroke(); break; }
    case 'gate': { ctx.fillStyle = 'rgba(60,30,10,.3)'; ctx.fillRect(i.x * ts, i.y * ts + ts * 0.8, ts, ts * 0.2); break; }
    case 'exit': { const a = 0.22 + Math.sin(t * 3) * 0.1; const g = ctx.createRadialGradient(cx, cy, ts * 0.05, cx, cy, ts * 0.55); g.addColorStop(0, `rgba(255,225,130,${a + 0.25})`); g.addColorStop(1, 'rgba(255,225,130,0)'); ctx.fillStyle = g; ctx.fillRect(i.x * ts - ts * 0.1, i.y * ts - ts * 0.1, ts * 1.2, ts * 1.2); ctx.strokeStyle = 'rgba(160,40,20,.85)'; ctx.lineWidth = 2.5; ctx.setLineDash([6, 5]); ctx.strokeRect(i.x * ts + 4, i.y * ts + 4, ts - 8, ts - 8); ctx.setLineDash([]); break; }
    case 'trig': if (d.visible) { ctx.fillStyle = `rgba(255,240,180,${0.25 + Math.sin(t * 4) * 0.15})`; ctx.beginPath(); ctx.arc(cx, cy, r * 0.5, 0, 7); ctx.fill(); } break;
  }
}
function drawInst(i, ts, t) {
  const d = i.d, cx = i.x * ts + ts / 2, cy = i.y * ts + ts / 2, r = ts * 0.44, foot = (i.y + 0.95) * ts;
  switch (d.type) {
    case 'npc': {
      if (d.img && PROPS.has(d.img)) { prop(d.img, cx, foot, ts * 1.25); break; }
      const name = d.img || 'n_villager', dir = i.face ?? 2;
      const bob = Math.sin(t * 2.2 + i.x * 1.7) * 0.01;
      drawChar(name, dir, 1, i.x, i.y, ts, { bob });
      if (d.mark) { const h = sprH(name) * ts; ctx.fillStyle = '#ffd34a'; ctx.strokeStyle = '#3a1a08'; ctx.lineWidth = 3; ctx.font = `900 ${Math.round(ts * 0.46)}px sans-serif`; ctx.textAlign = 'center'; const my = foot - h - ts * 0.08 + Math.sin(t * 4) * 3; ctx.strokeText('！', cx + ts * 0.3, my); ctx.fillText('！', cx + ts * 0.3, my); }
      break;
    }
    case 'foe': {
      const f0 = d.foe.split('+')[0]; let lv = 1, tint = '';
      if (f0.includes('@')) { lv = +f0.split('@')[1]; const A = ARCHETYPES[f0.split('@')[0]]; for (const tr of A.tiers) if (lv >= tr[0]) tint = tr[2] || ''; } else { lv = BOSSES[f0].lv; tint = BOSSES[f0].tint || ''; }
      const diff = lv - avgLevel(); const isBoss = BOSSES[f0] && BOSSES[f0].boss;
      const ring = isBoss ? `rgba(255,40,20,${0.6 + Math.sin(t * 3) * 0.3})` : diff >= 3 ? 'rgba(255,74,42,.85)' : diff <= -4 ? 'rgba(160,160,160,.7)' : 'rgba(230,140,40,.8)';
      // 面向玩家、原地踏步
      const dx = M.px - i.x, dy = M.py - i.y, close = Math.abs(dx) + Math.abs(dy) <= 4;
      const dir = close ? (Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0)) : (i.face ?? 2);
      const frame = close ? [0, 1, 2, 1][Math.floor(t * 3 + i.x) % 4] : 1;
      drawChar(foeImg(d.foe), dir, frame, i.x, i.y, ts, { ring, tint, scale: isBoss ? 1.06 : 1, bob: Math.sin(t * 2 + i.y) * 0.012 });
      break;
    }
    case 'chest': { const open = flag('c:' + i.id); prop(open ? 'chest_open' : 'chest', cx, foot, ts * 0.85, open ? 0.75 : 1); if (d.locked && !open) { ctx.fillStyle = '#ffd34a'; ctx.strokeStyle = '#3a1a08'; ctx.lineWidth = 3; ctx.font = `900 ${Math.round(ts * 0.32)}px sans-serif`; ctx.textAlign = 'center'; ctx.strokeText('鎖', cx + r * 0.75, cy - r * 0.5); ctx.fillText('鎖', cx + r * 0.75, cy - r * 0.5); } break; }
    case 'boulder': prop('boulder', cx, foot, ts * 1.0); break;
    case 'obj': { const s = d.scale || 1; if (PROPS.has(d.img)) prop(d.img, cx, foot, ts * 1.6 * s); break; }
    case 'sign': { if (prop('signpost', cx, foot, ts * 1.05)) { ctx.fillStyle = '#2a1808'; ctx.font = `900 ${Math.round(ts * 0.3)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(d.glyph || '告', cx, foot - ts * 0.72); } break; }
    case 'gate': { const im = mimg(S.wallStyle === 'citywall' ? 'door_city' : 'door_stockade'); if (ready(im)) { const w = ts * 1.04, h = Math.min(ts * 1.5, w * im.height / im.width); ctx.drawImage(im, i.x * ts - ts * 0.02, (i.y + 1) * ts + ts * 0.04 - h, w, h); } else { ctx.fillStyle = '#5a3416'; ctx.fillRect(i.x * ts + 2, i.y * ts + 2, ts - 4, ts - 4); } break; }
    case 'switch': { const on = flag(d.flag); ctx.fillStyle = '#4a4a48'; ctx.fillRect(cx - r * 0.6, cy + r * 0.2, r * 1.2, r * 0.5); ctx.strokeStyle = on ? '#ffd34a' : '#c33'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(cx, cy + r * 0.3); ctx.lineTo(cx + (on ? r * 0.6 : -r * 0.6), cy - r * 0.6); ctx.stroke(); break; }
    case 'reset': { ctx.fillStyle = '#6a4426'; ctx.fillRect(cx - 3, cy - r * 0.2, 6, r * 1.2); ctx.fillStyle = '#c9a24a'; ctx.beginPath(); ctx.arc(cx, cy - r * 0.35, r * 0.5, 0, 7); ctx.fill(); ctx.fillStyle = '#3a2412'; ctx.font = `900 ${Math.round(ts * 0.32)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('↺', cx, cy - r * 0.33); break; }
  }
}
