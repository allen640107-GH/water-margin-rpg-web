// 主程式：開機、標題、地圖事件、劇本 API、存讀檔
import { $, h, sleep } from './dom.js';
import { G, newGame, flag, setFlag, cond, give, activeParty, avgLevel, healAll } from './state.js';
import * as Save from './save.js';
import { API, run } from './script.js';
import { UI, UIH, advanceDialog, say, choice, toast, caption, fade, setCG, openMenu, loadPanel, shop, inn } from './ui.js';
import { battle, B } from './battle.js';
import { playMusic, currentMusic, sfx, installAudioUnlock, isMuted, setMuted, resume, audioState } from './audio.js';
import { img, preload, onAnyLoad, url } from './assets.js';
import { M, MAPH, initMap, resize, loadMap, update, draw, tryStep, pathTo, facing, screenToTile, mapState, visible, instAt, resetBoulders, sceneAssets, getGfxMode, setGfxMode, isHD2D, shakeMap } from './map.js';
import { MAPS, SCRIPTS, QUESTS, CHAPTERS } from './data/world.js';
import { ITEMS } from './data/items.js';
import { HEROES } from './data/heroes.js';
import { BOSSES } from './data/enemies.js';
import { pollGamepad } from './gamepad.js';

const VERSION = '3.3.0 HD-2D';
let scriptDepth = 0, inGame = false, lastPos = null;

// ───── 劇本 API ─────
Object.assign(API, {
  say: (who, text) => say(who, text),
  choice: opts => choice(opts),
  toast: (m, ms) => toast(m, ms),
  sfx: n => sfx(n),
  bgm: n => playMusic(n),
  battle: (spec, opts) => doBattle(spec, opts),
  gameOver: () => gameOver(),
  goto: (id, entry) => enterMap(id, entry),
  shop: id => shop(id).then(refreshHud),
  inn: p => inn(p).then(refreshHud),
  chapter: (n, t) => { sfx('gong'); return caption(`第 ${n} 回`, t || (CHAPTERS[n] && CHAPTERS[n].title) || '', (CHAPTERS[n] && CHAPTERS[n].sub) || '', 3200); },
  quest: async (id, st) => { const q = QUESTS[id]; if (!q) return; if (st === 'done') { sfx('levelup'); await toast(`完成任務：${q.name}`, 2000); } else if (st === 'active') { sfx('item'); await toast(`${q.side ? '新支線' : '新任務'}：${q.name}`, 2000); } },
  autosave: () => autosave(),
  ending: () => ending(),
  cg: n => setCG(n),
  title: t => { const [a, b, c] = t.split('/'); return caption(a, b, c, 3000); },
  pos: (x, y, d) => { M.px = x; M.py = y; M.fx = x; M.fy = y; G.s.x = x; G.s.y = y; if (d != null) G.s.dir = +d; M.dirty = true; },
  shake: () => { shakeMap(0.32); const c = $('#map'); c.classList.remove('shake'); void c.offsetWidth; c.classList.add('shake'); sfx('hit'); },
  script: n => { if (!SCRIPTS[n]) { console.warn('缺少劇本', n); return ''; } return SCRIPTS[n]; },
  mapState: id => mapState(id),
  refreshMap: () => { M.dirty = true; refreshHud(); },
});

Object.assign(UIH, {
  loadGame: slot => loadGame(slot),
  toTitle: () => showTitle(),
  onMenuClose: () => { refreshHud(); M.dirty = true; },
  mapName: id => (MAPS[id] ? MAPS[id].name : id),
  quests: QUESTS,
  syncMute: () => syncMute(),
  getGfxMode: () => getGfxMode(),
  setGfxMode: m => setGfxMode(m),
});

async function runScript(src, ctx = {}) {
  if (!src) return 'ok';
  scriptDepth++; M.path = []; M.dest = null;
  try { return await run(src, ctx); }
  catch (e) { console.warn('劇本錯誤', e); return 'abort'; }
  finally { scriptDepth--; refreshHud(); M.dirty = true; }
}
const busy = () => UI.busy > 0 || scriptDepth > 0 || !!B.cur || !inGame || fading;

async function doBattle(spec, opts = {}) {
  const first = spec.split('+')[0];
  const isBoss = !!(BOSSES[first] && BOSSES[first].boss);
  const def = MAPS[G.s.map] || {};
  M.path = [];
  const r = await battle(spec, { ...opts, isBoss, bg: opts.bg || def.battleBg || def.bg, prevMusic: currentMusic() });
  refreshHud(); M.dirty = true;
  return r;
}

// ───── 地圖事件 ─────
let gpDir = null, gpSprint = false, keySprint = false, touchSprint = false;
let actBufUntil = 0; // 輸入緩衝（140ms）：剛邁步還沒落腳就按調查，落腳瞬間立即觸發！
const currentHeldDir = () => (padDir != null ? padDir : gpDir != null ? gpDir : held.size ? [...held].pop() : null);

Object.assign(MAPH, {
  busy,
  heldDir: currentHeldDir,
  interact: i => { if (!busy()) interact(i); },
  stepOn: i => stepOn(i),
  onPlates: () => checkPlates(),
});

async function interact(i) {
  const d = i.d;
  switch (d.type) {
    case 'npc': await runScript(d.talk || `${d.name}|……`); break;
    case 'sign': await runScript(d.text.includes('|') || d.text.includes('@') ? d.text : '|' + d.text); break;
    case 'obj': if (d.text) await runScript('|' + d.text); break;
    case 'gate': await runScript(d.text || '|大門緊閉，似乎要從別處想辦法。'); break;
    case 'reset': { if (flag('solved:' + M.id)) { await toast('機關已經解開了。'); break; } const k = await choice(['把石頭放回原位', '算了']); if (k === 1) { resetBoulders(); sfx('push'); if (M.inst.some(b => b.d.type === 'boulder' && b.x === M.px && b.y === M.py)) API.pos(M.px, M.py + 1); } break; }
    case 'switch': if (!flag(d.flag)) { setFlag(d.flag); sfx('push'); await runScript(d.script || '|喀啦一聲，遠處傳來機關轉動的聲音。'); } else await runScript('|機關已經啟動了。'); break;
    case 'chest': {
      if (flag('c:' + i.id)) { await toast('箱子是空的。'); break; }
      if (d.locked && !G.s.party.includes('shiqian')) { await runScript('|箱子上了一把精巧的銅鎖，打不開。若有擅長開鎖的人就好了……'); break; }
      setFlag('c:' + i.id); sfx('chest');
      scriptDepth++;
      try {
        if (d.locked) await toast('時遷三兩下撬開了銅鎖！');
        if (d.gold) { G.s.gold += d.gold; await toast(`獲得銀兩 ${d.gold}`); }
        if (d.item) { give(d.item, d.n || 1); await toast(`獲得「${ITEMS[d.item].name}」${(d.n || 1) > 1 ? ' ×' + d.n : ''}`); }
      } finally { scriptDepth--; }
      refreshHud(); M.dirty = true; autosave(); break;
    }
    case 'foe': {
      if (d.pre) { const r = await runScript(d.pre); if (r === 'abort' || r === 'end') break; }
      scriptDepth++;
      let r;
      try { r = await doBattle(d.foe, { noEscape: !!d.noEscape || !!d.boss }); } finally { scriptDepth--; }
      if (r === 'win') { setFlag('k:' + i.id); M.dirty = true; if (d.post) await runScript(d.post); autosave(); }
      else if (r === 'lose' && d.arena) { healAll(); await toast('勝敗乃兵家常事，練好武藝再來！', 2000); }
      else if (r === 'lose') await gameOver();
      break;
    }
  }
}
async function stepOn(i) {
  const d = i.d;
  if (d.type === 'exit') {
    if (d.cond && !cond(d.cond)) {
      await runScript(d.deny || '|現在還不能離開這裡。');
      if (lastPos) { M.px = lastPos[0]; M.py = lastPos[1]; M.fx = M.px; M.fy = M.py; G.s.x = M.px; G.s.y = M.py; M.dirty = true; }
      return;
    }
    if (d.script) { const r = await runScript(d.script); if (r === 'abort' || r === 'end') return; }
    await enterMap(d.to, d.at || 'start');
  } else if (d.type === 'trig') {
    if (d.cond && !cond(d.cond)) return;
    if (d.once !== false) setFlag('t:' + i.id);
    M.dirty = true;
    await runScript(d.script);
  } else if (d.type === 'plate') checkPlates();
}
async function checkPlates() {
  const def = M.def, plates = M.inst.filter(i => i.d.type === 'plate');
  if (!plates.length || flag('solved:' + M.id)) return;
  if (plates.every(p => M.inst.some(b => b.d.type === 'boulder' && b.x === p.x && b.y === p.y))) {
    setFlag('solved:' + M.id); sfx('gong'); M.dirty = true;
    await runScript(def.onSolve || '|機關發出沉悶的聲響，某處的門打開了！');
  }
}

// ───── 進入地圖 ─────
let fading = false;
async function enterMap(id, entry) {
  const def = MAPS[id];
  if (!def) { console.warn('缺少地圖', id); return; }
  fading = true;
  await fade(async () => {
    loadMap(def, id, entry);
    if (def.ch) G.s.chapter = Math.max(G.s.chapter, def.ch);
    setCG(null);
    $('#loc').textContent = def.name;
    playMusic(def.bgm || 'field');
    refreshHud(); draw(performance.now());
    await preload(sceneAssets());
    draw(performance.now());
  });
  fading = false;
  if (def.intro && !flag('v:' + id)) { setFlag('v:' + id); await runScript(def.intro); }
  if (def.onEnter && G.s.map === id) await runScript(def.onEnter);
  if (G.s.map === id && def.save !== false) autosave();
}

// ───── 存讀檔 ─────
function autosave() {
  if (!G.s) return;
  G.s.savedAt = Date.now();
  const r = Save.writeSlot('auto', G.s);
  if (!r.ok) console.warn(r.msg);
}
async function loadGame(slot) {
  const r = Save.readSlot(slot);
  if (r.status !== 'ok') { toast('無法讀取此存檔', 2000); return; }
  if ($('#panel')._close && !$('#panel').hidden) $('#panel')._close();
  if ($('#menu')._close && !$('#menu').hidden) $('#menu')._close();
  G.s = r.data;
  if (!MAPS[G.s.map]) { G.s.map = 'dongjing'; G.s.x = 0; G.s.y = 0; }
  enterGame();
  const pos = (G.s.x || G.s.y) ? [G.s.x, G.s.y] : (G.s.entry || 'start');
  await enterMap(G.s.map, pos);
  if ('migrated' in r) toast('舊版存檔已升級（原檔已備份）', 2600);
}
function enterGame() {
  $('#title').hidden = true; $('#hud').hidden = false; $('#pads').hidden = false; inGame = true;
  UI.busy = 0;
}

async function newStart() {
  try { const ls = localStorage, k = Save.PREFIX + 'auto', raw = ls.getItem(k); if (raw) ls.setItem(k + '.bak.prev', raw); } catch (e) {}
  G.s = newGame();
  enterGame();
  await runScript(SCRIPTS.prologue);
  await enterMap('dongjing', 'start');
}

async function gameOver() {
  playMusic('sad');
  await caption('勝敗乃兵家常事', '大俠請重新來過', '將讀取最近的自動存檔', 3000);
  const r = Save.readSlot('auto');
  if (r.status === 'ok') await loadGame('auto'); else showTitle();
}

async function ending() {
  setFlag('ending'); G.s.cleared = (G.s.cleared || 0) + 1; autosave();
  playMusic('hall');
  const t = Math.floor(G.s.playMs / 60000);
  await caption('全劇終', '替天行道', `遊戲時間 ${Math.floor(t / 60)} 小時 ${t % 60} 分・戰鬥 ${G.s.battles} 場。通關後仍可繼續探索、挑戰演武場。`, 6000);
}

// ───── HUD ─────
function refreshHud() {
  if (!G.s) return;
  $('#gold').textContent = `銀 ${G.s.gold}`;
  syncMute();
}
function syncMute() { const b = $('#btn-mute'); b.textContent = isMuted() ? '♪ 關' : '♪ 開'; b.classList.toggle('off', isMuted()); }

// ───── 標題畫面 ─────
function showTitle() {
  inGame = false; B.cur = null;
  for (const id of ['#hud', '#pads', '#dialog', '#choices', '#battle', '#menu', '#panel', '#caption', '#cg']) $(id).hidden = true;
  UI.busy = 0; scriptDepth = 0;
  const t = $('#title'); t.innerHTML = ''; t.hidden = false;
  t.style.backgroundImage = `url(media/title_poster.webp)`;
  // 動態標題：循環影片（水波、旗、霧）＋ CSS 飄霧、迎風大旗、行走的好漢剪影；影片失敗時留靜圖
  const vid = h('video', { class: 'tvid', muted: '', loop: '', playsinline: '', autoplay: '', preload: 'auto', poster: 'media/title_poster.webp', 'aria-hidden': 'true' });
  vid.muted = true; vid.defaultMuted = true; vid.playsInline = true;
  vid.addEventListener('error', () => vid.remove()); vid.src = 'media/title.mp4';
  const p = vid.play(); if (p && p.catch) p.catch(() => {});
  const walker = (id, k) => h('div', { class: 'tw tw' + k, style: `background-image:url(img/spr/${id}.webp)` });
  t.append(vid, h('div', { class: 'tfx' },
    h('div', { class: 'mist m1' }), h('div', { class: 'mist m2' }),
    h('div', { class: 'tflag f1' }, h('i'), h('b', null, '替天行道')), h('div', { class: 'tflag f2' }, h('i'), h('b', null, '忠義')),
    h('div', { class: 'twalk' }, walker('linchong', 1), walker('luzhishen', 2), walker('wusong', 3)),
    h('div', { class: 'mist m3' })));
  const auto = Save.readSlot('auto');
  const anyOk = Save.SLOTS.some(s => Save.readSlot(s).status === 'ok');
  t.append(
    h('h1', null, '水滸傳', h('small', null, '替天行道')),
    h('div', { class: 'tbtns' },
      auto.status === 'ok' ? h('button', { id: 't-cont', onclick: () => { resume(); loadGame('auto'); } }, '繼續旅程') : null,
      h('button', { id: 't-new', onclick: async () => {
        resume();
        if (auto.status === 'ok') { const k = await choice(['開始新的旅程（自動存檔將被覆蓋，手動存檔保留）', '取消']); if (k !== 1) return; }
        newStart();
      } }, '新的旅程'),
      h('button', { id: 't-load', disabled: !anyOk, onclick: () => { resume(); loadPanel(); } }, '讀取存檔'),
      h('button', { id: 't-intro', onclick: () => { resume(); playIntro(true); } }, '觀看片頭'),
      h('button', { id: 't-mute', onclick: () => { setMuted(!isMuted()); resume(); showTitle(); } }, isMuted() ? '音樂：關' : '音樂：開')),
    h('div', { class: 'foot' }, `v${VERSION}・點擊地圖移動・水墨插畫由 Grok Imagine 生成`));
  playMusic('title');
}

// ───── 片頭動畫：可跳過（右上「跳過」），靜音自動播放，點畫面開聲音 ─────
const INTRO_CAPS = [
  { at: 0, cap: '風雪山神廟', sub: '八十萬禁軍教頭林沖，被逼上梁山' },
  { at: 4.5, cap: '景陽岡', sub: '武松赤手空拳，打死弔睛白額大蟲' },
  { at: 9.1, cap: '替天行道', sub: '天罡地煞，聚義梁山泊' },
];
function playIntro(fromTitle = false) {
  return new Promise(resolve => {
    const ov = $('#intro'); ov.innerHTML = ''; ov.hidden = false;
    let done = false;
    const v = h('video', { class: 'ivid', playsinline: '', autoplay: '', preload: 'auto', poster: 'media/intro_poster.webp' });
    v.muted = true; v.playsInline = true;
    const cap = h('div', { class: 'icap' }), hint = h('div', { class: 'ihint' }, '點擊畫面開啟聲音');
    const finish = () => {
      if (done) return; done = true;
      try { localStorage.setItem('shuihu.introSeen', '1'); } catch (e) {}
      ov.classList.add('out'); v.pause();
      setTimeout(() => { ov.hidden = true; ov.classList.remove('out'); ov.innerHTML = ''; resolve(); if (!$('#title').hidden) playMusic('title'); }, 450);
    };
    const skip = h('button', { class: 'iskip', onclick: e => { e.stopPropagation(); finish(); } }, '跳過');
    let last = -1;
    v.addEventListener('timeupdate', () => {
      let k = 0; INTRO_CAPS.forEach((c, i) => { if (v.currentTime >= c.at) k = i; });
      if (k !== last) { last = k; cap.innerHTML = ''; cap.append(h('b', null, INTRO_CAPS[k].cap), h('span', null, INTRO_CAPS[k].sub)); cap.classList.remove('in'); void cap.offsetWidth; cap.classList.add('in'); }
    });
    v.addEventListener('ended', finish);
    v.addEventListener('error', finish);
    ov.onclick = () => { if (v.muted) { v.muted = false; hint.remove(); playMusic(null); const q = v.play(); if (q && q.catch) q.catch(() => {}); } };
    ov.append(v, cap, hint, skip);
    if (fromTitle) playMusic(null);
    v.src = 'media/intro.mp4';
    const q = v.play(); if (q && q.catch) q.catch(() => {});
    setTimeout(() => { if (!done && v.currentTime === 0 && v.paused) finish(); }, 9000); // 無法播放時直接進標題
  });
}

// ───── 輸入 ─────
const held = new Set();
let padDir = null;
const KEYS = { ArrowUp: 0, KeyW: 0, ArrowRight: 1, KeyD: 1, ArrowDown: 2, KeyS: 2, ArrowLeft: 3, KeyA: 3 };
function act() {
  if (busy()) return;
  const i = facing();
  if (i) interact(i);
  else toast('這裡沒有什麼特別的。', 900);
}
function stepNow(d) { if (inGame && M.def && !M.moving && !busy()) { lastPos = [M.px, M.py]; tryStep(d); } }
function bindInput() {
  window.addEventListener('keydown', e => {
    if (e.key === 'Shift') { keySprint = true; return; }
    if (!inGame) return;
    if (e.code in KEYS) { held.add(KEYS[e.code]); M.path = []; M.dest = null; e.preventDefault(); if (!e.repeat) stepNow(KEYS[e.code]); return; }
    if (busy()) return;
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'z' || e.key === 'Z') {
      e.preventDefault();
      if (M.moving) actBufUntil = performance.now() + 160;
      else act();
    } else if (e.key === 'Escape' || e.key === 'm' || e.key === 'M') { e.preventDefault(); openMenu(); }
  });
  window.addEventListener('keyup', e => {
    if (e.key === 'Shift') keySprint = false;
    if (e.code in KEYS) held.delete(KEYS[e.code]);
  });
  window.addEventListener('blur', () => { held.clear(); padDir = null; keySprint = false; });
  const cv = $('#map');
  cv.addEventListener('pointerup', e => {
    if (busy()) return;
    const r = cv.getBoundingClientRect();
    const [tx, ty] = screenToTile(e.clientX - r.left, e.clientY - r.top);
    if (tx === M.px && ty === M.py) return;
    if (pathTo(tx, ty)) sfx('step'); else toast('那裡過不去。', 700);
  });
  for (const b of document.querySelectorAll('#dpad .dp')) {
    const d = +b.dataset.d;
    b.addEventListener('pointerdown', e => { e.preventDefault(); resume(); padDir = d; M.path = []; M.dest = null; stepNow(d); try { b.setPointerCapture(e.pointerId); } catch (_) {} });
    const up = () => { if (padDir === d) padDir = null; };
    b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
    b.addEventListener('contextmenu', e => e.preventDefault());
  }
  $('#btn-act').addEventListener('click', () => { if (M.moving) actBufUntil = performance.now() + 160; else act(); });
  const runBtn = $('#btn-run');
  if (runBtn) {
    runBtn.addEventListener('click', () => {
      sfx('click'); touchSprint = !touchSprint; runBtn.classList.toggle('on', touchSprint);
    });
  }
  $('#btn-menu').addEventListener('click', () => { if (!busy()) { sfx('click'); openMenu(); } });
  $('#btn-mute').addEventListener('click', () => { setMuted(!isMuted()); resume(); syncMute(); });
  window.addEventListener('resize', () => { resize(); });
  document.addEventListener('gesturestart', e => e.preventDefault());
}

// ───── 主迴圈（含 Web Gamepad API 手把輪詢、疾走與輸入緩衝） ─────
const gpHandlers = {
  onConnect: () => toast('已偵測到遊戲手把（左搖桿移動、A 調查、按住 B 疾走、Start 選單）', 2600),
  onConfirm: () => {
    if (!document.querySelector('#intro').hidden) { const sk = $('#intro .iskip'); sk && sk.click(); return; }
    if (!document.querySelector('#title').hidden) { const b = $('#t-cont') || $('#t-new'); b && b.click(); return; }
    if (advanceDialog()) return;
    if (B.cur) { const b = $('.b-res button') || $('.b-cmds button:not(:disabled)'); b && b.click(); return; }
    if (!busy()) { if (M.moving) actBufUntil = performance.now() + 160; else act(); }
  },
  onCancel: () => {
    if (B.cur && B.cur.auto && B.cur.toggleAuto) { B.cur.toggleAuto(false); return; }
    if (!$('#menu').hidden && $('#menu')._close) { $('#menu')._close(); return; }
    if (!$('#panel').hidden && $('#panel')._close) { $('#panel')._close(); return; }
  },
  onAutoOrAlt: () => {
    if (B.cur && B.cur.toggleAuto) B.cur.toggleAuto();
  },
  onMenu: () => {
    if (!$('#menu').hidden && $('#menu')._close) { $('#menu')._close(); return; }
    if (inGame && !busy()) { sfx('click'); openMenu(); }
  },
};
let lastT = performance.now(), lastDraw = 0, lastBusy = false;
function loop(now) {
  const dt = Math.min(1000, now - lastT); lastT = now;
  const gp = pollGamepad(gpHandlers);
  gpDir = gp.dir; gpSprint = gp.sprint;
  M.sprint = !!(keySprint || gpSprint || touchSprint);
  if (inGame && G.s && !document.hidden) G.s.playMs += dt;
  const bz = inGame && busy(); if (bz !== lastBusy) { document.body.classList.toggle('busy', bz); lastBusy = bz; }
  if (inGame && M.def) {
    if (!M.moving && !busy()) {
      if (actBufUntil > now) { actBufUntil = 0; act(); }
      else {
        const dir = currentHeldDir();
        if (dir != null) { lastPos = [M.px, M.py]; tryStep(dir); }
      }
    } else if (!M.moving) lastPos = [M.px, M.py];
    if (M.moving && !lastPos) lastPos = [M.px, M.py];
    update(now);
    if (!M.moving) lastPos = [M.px, M.py];
    const anim = M.def.weather || M.def.boat || M.def.anim;
    const hdActive = isHD2D();
    if (!B.cur && (hdActive || M.dirty || M.moving || now - lastDraw > (anim ? 50 : 66))) { draw(now); lastDraw = now; }
  }
  requestAnimationFrame(loop);
}

// 測試掛鉤
window.__rpg = {
  G, M, B, UI, MAPS, SCRIPTS, Save, VERSION, audioState,
  enterMap, tryStep, pathTo, interact: i => interact(i), instAt, facing, act, autosave, loadGame, newStart, showTitle,
  busy, runScript, adv: () => advanceDialog(), find: key => M.inst.find(i => i.key === key), visible,
};

async function boot() {
  try { UI.fastText = localStorage.getItem('shuihu.fasttext') === '1'; } catch (e) {}
  installAudioUnlock();
  initMap($('#map'));
  onAnyLoad(() => { M.dirty = true; });
  bindInput();
  Save.migrateAll();
  await preload(['ui_paper']);
  $('#boot').remove();
  let seen = false; try { seen = localStorage.getItem('shuihu.introSeen') === '1'; } catch (e) {}
  showTitle();
  if (!seen) playIntro();
  requestAnimationFrame(loop);
}
boot();
