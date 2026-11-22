// 地圖：ASCII 方格、圖塊貼圖、點擊尋路、方向鍵、事件觸發
import { G, cond, setFlag, flag, give, avgLevel } from './state.js';
import { img, ready } from './assets.js';
import { ITEMS } from './data/items.js';
import { HEROES } from './data/heroes.js';
import { ARCHETYPES, BOSSES } from './data/enemies.js';
import { sfx } from './audio.js';

export const M = { id: null, def: null, W: 0, H: 0, rows: [], inst: [], px: 0, py: 0, moving: false, path: [], dirty: true, ts: 48, cam: [0, 0], dest: null, t0: 0 };
export const MAPH = {}; // main.js 提供：interact(inst), stepOn(inst), onPlates(), busy()

const TEX = { ',': 't_grass', '.': 't_dirt', ':': 't_stone', '_': 't_wood', '*': 't_snow', 's': 't_sand', '~': 't_water', '=': 't_wood', 'F': 't_forest', '^': 't_rock', '#': 't_wall', 'R': 't_roof', '+': 't_wood', 'r': 't_grass', 'T': null, 'x': 't_dirt', 'o': 't_stone' };
const SOLID_T = new Set(['#', 'R', '^', 'T', 'F', '~', 'r', ' ']);
const SOLID_M = new Set(['npc', 'foe', 'chest', 'sign', 'boulder', 'switch', 'obj', 'gate', 'reset']);

let canvas, ctx, dpr = 1, cw = 0, chh = 0;
const pats = {};

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
  M.inst = [];
  const ms = mapState(id);
  for (let y = 0; y < M.H; y++) for (let x = 0; x < M.W; x++) {
    const ch = M.rows[y][x], md = def.marks && def.marks[ch];
    if (md) {
      const inst = { key: ch, x, y, ox: x, oy: y, d: md, id: `${id}:${x},${y}` };
      M.inst.push(inst);
      M.rows[y][x] = md.under || def.ground || ',';
    } else if (/[A-Z0-9]/.test(ch) && !TEX.hasOwnProperty(ch) && ch !== 'T' && ch !== 'F' && ch !== 'R') {
      M.rows[y][x] = def.ground || ',';
    }
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
  M.path = []; M.dest = null; M.moving = false; M.dirty = true;
  // 預載貼圖
  for (const ch of new Set(M.rows.flat())) if (TEX[ch]) img(TEX[ch]);
  for (const i of M.inst) { const t = tokOf(i); if (t) img(t[0], t[1]); }
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

function tokOf(i) {
  const d = i.d;
  if (d.img) return [d.img, !d.img.startsWith('o_')];
  if (d.type === 'foe') { const t = d.foe.split('+')[0]; if (t.includes('@')) return [ARCHETYPES[t.split('@')[0]].img, true]; return [BOSSES[t].img, true]; }
  if (d.type === 'chest') return ['o_chest', false];
  if (d.type === 'boulder') return ['o_boulder', false];
  return null;
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
    if (i && (SOLID_M.has(i.d.type))) { M.path = []; MAPH.interact && MAPH.interact(i); }
    return false;
  }
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
  if (dir >= 0) G.s.dir = dir;
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

// ───── 繪製 ─────
function pattern(name) {
  const im = img(name); if (!ready(im)) return null;
  const k = name + ':' + M.ts;
  if (!pats[k]) {
    const p = ctx.createPattern(im, 'repeat');
    const sc = (M.ts * 2) / im.width;
    if (p.setTransform) p.setTransform(new DOMMatrix([sc, 0, 0, sc, 0, 0]));
    pats[k] = p;
  }
  return pats[k];
}
const FALLBACK = { ',': '#7d9a5a', '.': '#a98b5e', ':': '#9a9a96', '_': '#8a6238', '*': '#e8eef4', 's': '#d8c070', '~': '#5d8fa8', '=': '#8a6238', 'F': '#2f5a30', '^': '#7a7670', '#': '#4a4846', 'R': '#5a5a5e', '+': '#6a4426', 'r': '#7d9a5a', 'x': '#a98b5e', 'o': '#9a9a96' };

export function draw(now) {
  if (!ctx || !M.def) return;
  const ts = M.ts;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = M.def.void || '#141009'; ctx.fillRect(0, 0, cw, chh);
  const fx = M.fx ?? M.px, fy = M.fy ?? M.py;
  const mw = M.W * ts, mh = M.H * ts;
  let camx = fx * ts + ts / 2 - cw / 2, camy = fy * ts + ts / 2 - chh / 2;
  camx = mw <= cw ? (mw - cw) / 2 : Math.max(0, Math.min(mw - cw, camx));
  camy = mh <= chh ? (mh - chh) / 2 : Math.max(0, Math.min(mh - chh, camy));
  M.cam = [camx, camy];
  ctx.save(); ctx.translate(-Math.round(camx), -Math.round(camy));
  const x0 = Math.max(0, Math.floor(camx / ts)), y0 = Math.max(0, Math.floor(camy / ts));
  const x1 = Math.min(M.W - 1, Math.ceil((camx + cw) / ts)), y1 = Math.min(M.H - 1, Math.ceil((camy + chh) / ts));
  const base = M.def.ground || ',';
  if (M.def.image) {
    const im = img(M.def.image); if (ready(im)) ctx.drawImage(im, 0, 0, mw, mh); else { ctx.fillStyle = '#d8c8a0'; ctx.fillRect(0, 0, mw, mh); }
  }
  const t = now / 1000;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const c = tile(x, y), X = x * ts, Y = y * ts;
    if (M.def.image) {
      if (c === '.') { ctx.fillStyle = 'rgba(120,80,30,.55)'; ctx.beginPath(); ctx.arc(X + ts / 2, Y + ts / 2, ts * 0.12, 0, 7); ctx.fill(); }
      continue;
    }
    let tc = c;
    if (c === 'T') tc = base === '*' ? '*' : base === 's' ? 's' : ',';
    if (c === 'r') tc = M.def.boat ? '~' : ',';
    const p = TEX[tc] && pattern(TEX[tc]);
    ctx.fillStyle = p || FALLBACK[tc] || '#555';
    ctx.fillRect(X, Y, ts + 0.5, ts + 0.5);
    if (c === '~' || (c === 'r' && M.def.boat)) {
      ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 1.5; ctx.beginPath();
      const o = Math.sin(t * 1.5 + x * 0.7 + y) * ts * 0.12;
      ctx.moveTo(X + ts * 0.15 + o, Y + ts * 0.45); ctx.quadraticCurveTo(X + ts * 0.35 + o, Y + ts * 0.32, X + ts * 0.55 + o, Y + ts * 0.45); ctx.stroke();
      if (tile(x, y - 1) !== '~' && tile(x, y - 1) !== 'r' && tile(x, y - 1) !== '=') { ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(X, Y, ts, ts * 0.12); }
    }
    if (c === '=') { ctx.strokeStyle = 'rgba(40,20,5,.55)'; ctx.lineWidth = 2; for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.moveTo(X + ts * k / 4, Y); ctx.lineTo(X + ts * k / 4, Y + ts); ctx.stroke(); } }
    if (c === 'r') {
      ctx.strokeStyle = M.def.boat ? 'rgba(60,80,30,.95)' : 'rgba(70,90,30,.9)'; ctx.lineWidth = 2;
      for (let k = 0; k < 5; k++) { const rx = X + ts * (0.12 + k * 0.19), sway = Math.sin(t * 1.2 + x + k) * 3; ctx.beginPath(); ctx.moveTo(rx, Y + ts); ctx.quadraticCurveTo(rx + sway, Y + ts * 0.5, rx + sway * 1.5, Y + ts * 0.08); ctx.stroke(); }
    }
    if (c === '#' || c === '^' || c === 'R' || c === 'F') {
      const below = tile(x, y + 1);
      if (!(below === c) && !SOLID_T.has(below)) { ctx.fillStyle = 'rgba(0,0,0,.38)'; ctx.fillRect(X, Y + ts * 0.78, ts, ts * 0.22); }
      if (c === 'R') { ctx.strokeStyle = 'rgba(20,15,10,.7)'; ctx.lineWidth = 2;
        if (tile(x, y - 1) !== 'R' && tile(x, y - 1) !== '+') { ctx.beginPath(); ctx.moveTo(X, Y + 1); ctx.lineTo(X + ts, Y + 1); ctx.stroke(); }
        if (tile(x - 1, y) !== 'R' && tile(x - 1, y) !== '+') { ctx.beginPath(); ctx.moveTo(X + 1, Y); ctx.lineTo(X + 1, Y + ts); ctx.stroke(); }
        if (tile(x + 1, y) !== 'R' && tile(x + 1, y) !== '+') { ctx.beginPath(); ctx.moveTo(X + ts - 1, Y); ctx.lineTo(X + ts - 1, Y + ts); ctx.stroke(); } }
      if (c === '#') { ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fillRect(X, Y, ts, ts * 0.12); }
    }
    if (c === '+') { ctx.fillStyle = '#3a2412'; ctx.fillRect(X + ts * 0.18, Y + ts * 0.1, ts * 0.64, ts * 0.9); ctx.fillStyle = '#c9a24a'; ctx.beginPath(); ctx.arc(X + ts * 0.66, Y + ts * 0.55, ts * 0.05, 0, 7); ctx.fill(); }
    if (c === 'x') { ctx.fillStyle = 'rgba(20,10,0,.35)'; ctx.beginPath(); ctx.ellipse(X + ts / 2, Y + ts / 2, ts * 0.3, ts * 0.18, 0, 0, 7); ctx.fill(); }
  }
  // 樹木（較大，向上延伸）
  const tree = img('o_tree');
  for (let y = y0; y <= Math.min(M.H - 1, y1 + 1); y++) for (let x = x0; x <= x1; x++) if (tile(x, y) === 'T') {
    if (ready(tree)) ctx.drawImage(tree, x * ts - ts * 0.18, y * ts - ts * 0.5, ts * 1.36, ts * 1.45);
    else { ctx.fillStyle = '#2f5a30'; ctx.beginPath(); ctx.arc(x * ts + ts / 2, y * ts + ts / 2, ts * 0.42, 0, 7); ctx.fill(); }
  }
  // 目的地標記
  if (M.dest) { const [dx, dy] = M.dest; ctx.strokeStyle = 'rgba(255,220,120,.9)'; ctx.lineWidth = 3; ctx.strokeRect(dx * ts + 4, dy * ts + 4, ts - 8, ts - 8); }
  // 事件物件
  const near = [];
  for (const i of M.inst) {
    if (!visible(i)) continue;
    if (i.x < x0 - 2 || i.x > x1 + 2 || i.y < y0 - 2 || i.y > y1 + 2) continue;
    drawInst(i, ts, t);
    if ((i.d.name || i.d.label) && Math.abs(i.x - fx) + Math.abs(i.y - fy) <= (i.d.type === 'exit' ? 6 : 3)) near.push(i);
  }
  // 玩家
  drawPlayer(fx * ts, fy * ts, ts);
  // 名牌
  ctx.font = `800 ${Math.max(14, Math.round(ts * 0.3))}px ${getComputedStyle(document.body).fontFamily}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const i of near) {
    const label = i.d.type === 'exit' ? (i.d.label ? '往 ' + i.d.label : '') : i.d.name;
    if (!label) continue;
    const w = ctx.measureText(label).width + 14, hgt = Math.max(22, ts * 0.42);
    const lx = i.x * ts + ts / 2, ly = i.y * ts - hgt * 0.55;
    ctx.fillStyle = i.d.type === 'exit' ? 'rgba(120,20,12,.92)' : i.d.type === 'foe' ? 'rgba(90,10,6,.9)' : 'rgba(15,12,8,.88)';
    roundRect(lx - w / 2, ly - hgt / 2, w, hgt, 6); ctx.fill();
    ctx.fillStyle = '#fff7e3'; ctx.fillText(label, lx, ly + 1);
  }
  ctx.restore();
  // 夜色、天氣
  if (M.def.night) { ctx.fillStyle = M.def.night === true ? 'rgba(10,18,50,.38)' : M.def.night; ctx.fillRect(0, 0, cw, chh); }
  if (M.def.weather === 'snow') drawSnow(t);
  if (M.def.weather === 'heat') { ctx.fillStyle = 'rgba(255,190,60,.10)'; ctx.fillRect(0, 0, cw, chh); }
  if (M.def.weather === 'fog') { const g = ctx.createRadialGradient(cw / 2, chh / 2, Math.min(cw, chh) * 0.25, cw / 2, chh / 2, Math.max(cw, chh) * 0.7); g.addColorStop(0, 'rgba(230,230,225,0)'); g.addColorStop(1, 'rgba(230,230,225,.75)'); ctx.fillStyle = g; ctx.fillRect(0, 0, cw, chh); }
  M.dirty = false;
}
function roundRect(x, y, w, h2, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h2, r); ctx.arcTo(x + w, y + h2, x, y + h2, r); ctx.arcTo(x, y + h2, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
const flakes = Array.from({ length: 90 }, () => [Math.random(), Math.random(), 0.5 + Math.random()]);
function drawSnow(t) {
  ctx.fillStyle = 'rgba(255,255,255,.85)';
  for (const [a, b, s] of flakes) {
    const x = ((a * cw + Math.sin(t * s + b * 10) * 30 - M.cam[0] * 0.2) % cw + cw) % cw, y = ((b * chh + t * 40 * s - M.cam[1] * 0.2) % chh + chh) % chh;
    ctx.beginPath(); ctx.arc(x, y, 1.5 + s * 1.5, 0, 7); ctx.fill();
  }
}
function drawToken(name, isTok, cx, cy, r, ring, tint) {
  const im = img(name, isTok);
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.92, r * 0.85, r * 0.28, 0, 0, 7); ctx.fill();
  if (ready(im)) {
    if (tint) ctx.filter = tint;
    if (isTok) { ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fillStyle = '#e8dcbc'; ctx.fill(); ctx.drawImage(im, cx - r, cy - r, r * 2, r * 2); }
    else ctx.drawImage(im, cx - r, cy - r, r * 2, r * 2);
    ctx.filter = 'none';
  } else { ctx.fillStyle = '#c9a24a'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill(); }
  if (ring) { ctx.lineWidth = Math.max(2.5, r * 0.12); ctx.strokeStyle = ring; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.stroke(); }
  ctx.restore();
}
function drawInst(i, ts, t) {
  const d = i.d, cx = i.x * ts + ts / 2, cy = i.y * ts + ts / 2, r = ts * 0.44;
  switch (d.type) {
    case 'npc': { const tk = tokOf(i); drawToken(tk[0], tk[1], cx, cy - ts * 0.05, r, d.ring || '#d8b25a'); if (d.mark) { ctx.fillStyle = '#ffd34a'; ctx.font = `900 ${Math.round(ts * 0.42)}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText('！', cx + r * 0.8, cy - r * 0.9 + Math.sin(t * 4) * 3); } break; }
    case 'foe': {
      const tk = tokOf(i); const f0 = d.foe.split('+')[0]; let lv = 1, tint = '';
      if (f0.includes('@')) { lv = +f0.split('@')[1]; const A = ARCHETYPES[f0.split('@')[0]]; for (const tr of A.tiers) if (lv >= tr[0]) tint = tr[2] || ''; } else { lv = BOSSES[f0].lv; tint = BOSSES[f0].tint || ''; }
      const diff = lv - avgLevel();
      const ring = BOSSES[f0] && BOSSES[f0].boss ? '#ff3020' : diff >= 3 ? '#ff4a2a' : diff <= -4 ? '#9a9a9a' : '#e08a2a';
      const pulse = 1 + Math.sin(t * 3 + i.x) * 0.04;
      drawToken(tk[0], tk[1], cx, cy - ts * 0.05, r * pulse * (BOSSES[f0] && BOSSES[f0].boss ? 1.12 : 1), ring, tint);
      break; }
    case 'chest': { const open = flag('c:' + i.id); ctx.globalAlpha = open ? 0.45 : 1; drawToken('o_chest', false, cx, cy, r * 0.95); ctx.globalAlpha = 1; if (d.locked && !open) { ctx.fillStyle = '#ffd34a'; ctx.font = `900 ${Math.round(ts * 0.32)}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText('鎖', cx + r * 0.7, cy - r * 0.6); } break; }
    case 'boulder': drawToken('o_boulder', false, cx, cy, r * 1.02); break;
    case 'obj': { const im = img(d.img); const s = d.scale || 1; if (ready(im)) ctx.drawImage(im, cx - ts * s / 2, cy - ts * s * 0.62, ts * s, ts * s); break; }
    case 'sign': { ctx.fillStyle = '#6a4426'; ctx.fillRect(cx - 3, cy - r * 0.2, 6, r * 1.2); ctx.fillStyle = '#d9c08a'; ctx.strokeStyle = '#3a2412'; ctx.lineWidth = 2; roundRect(cx - r * 0.8, cy - r * 0.8, r * 1.6, r * 0.9, 4); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#3a2412'; ctx.font = `900 ${Math.round(ts * 0.3)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(d.glyph || '告', cx, cy - r * 0.35); break; }
    case 'plate': { const on = M.inst.some(b => b.d.type === 'boulder' && b.x === i.x && b.y === i.y); ctx.strokeStyle = on ? '#ffd34a' : '#7a5020'; ctx.lineWidth = 3; ctx.fillStyle = on ? 'rgba(255,210,80,.35)' : 'rgba(60,30,10,.35)'; ctx.beginPath(); ctx.arc(cx, cy, r * 0.75, 0, 7); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy, r * 0.35, 0, 7); ctx.stroke(); break; }
    case 'gate': { if (gateOpen(i)) { ctx.fillStyle = 'rgba(60,30,10,.3)'; ctx.fillRect(i.x * ts, i.y * ts + ts * 0.8, ts, ts * 0.2); break; } ctx.fillStyle = '#5a3416'; ctx.fillRect(i.x * ts + 2, i.y * ts + 2, ts - 4, ts - 4); ctx.strokeStyle = '#c9a24a'; ctx.lineWidth = 3; for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.moveTo(i.x * ts + ts * k / 4, i.y * ts + 4); ctx.lineTo(i.x * ts + ts * k / 4, i.y * ts + ts - 4); ctx.stroke(); } ctx.strokeRect(i.x * ts + 3, i.y * ts + 3, ts - 6, ts - 6); break; }
    case 'reset': { ctx.fillStyle = '#6a4426'; ctx.fillRect(cx - 3, cy - r * 0.2, 6, r * 1.2); ctx.fillStyle = '#c9a24a'; ctx.beginPath(); ctx.arc(cx, cy - r * 0.35, r * 0.5, 0, 7); ctx.fill(); ctx.fillStyle = '#3a2412'; ctx.font = `900 ${Math.round(ts * 0.32)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('↺', cx, cy - r * 0.33); break; }
    case 'switch': { const on = flag(d.flag); ctx.fillStyle = '#4a4a48'; ctx.fillRect(cx - r * 0.6, cy + r * 0.2, r * 1.2, r * 0.5); ctx.strokeStyle = on ? '#ffd34a' : '#c33'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(cx, cy + r * 0.3); ctx.lineTo(cx + (on ? r * 0.6 : -r * 0.6), cy - r * 0.6); ctx.stroke(); break; }
    case 'exit': { ctx.fillStyle = `rgba(255,215,120,${0.28 + Math.sin(t * 3) * 0.12})`; ctx.fillRect(i.x * ts + 3, i.y * ts + 3, ts - 6, ts - 6); ctx.strokeStyle = 'rgba(160,40,20,.9)'; ctx.lineWidth = 2.5; ctx.strokeRect(i.x * ts + 3, i.y * ts + 3, ts - 6, ts - 6); break; }
    case 'trig': if (d.visible) { ctx.fillStyle = `rgba(255,240,180,${0.25 + Math.sin(t * 4) * 0.15})`; ctx.beginPath(); ctx.arc(cx, cy, r * 0.5, 0, 7); ctx.fill(); } break;
  }
}
function drawPlayer(px, py, ts) {
  const lead = G.s.party[0] || 'linchong';
  const cx = px + ts / 2, cy = py + ts / 2 - ts * 0.05, r = ts * 0.46;
  if (M.def.boat) { ctx.fillStyle = '#6a4426'; ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.55, r * 1.15, r * 0.45, 0, 0, 7); ctx.fill(); ctx.strokeStyle = '#3a2412'; ctx.lineWidth = 2; ctx.stroke(); }
  drawToken(HEROES[lead].img, true, cx, cy, r, '#fff2c0');
  const [dx, dy] = DIRS[G.s.dir];
  ctx.fillStyle = '#a3241a'; ctx.strokeStyle = '#fff2c0'; ctx.lineWidth = 2;
  ctx.beginPath(); const ax = cx + dx * r * 1.18, ay = cy + dy * r * 1.18;
  ctx.moveTo(ax + dx * 7, ay + dy * 7); ctx.lineTo(ax - dy * 7 - dx * 3, ay + dx * 7 - dy * 3); ctx.lineTo(ax + dy * 7 - dx * 3, ay - dx * 7 - dy * 3); ctx.closePath(); ctx.fill(); ctx.stroke();
}
