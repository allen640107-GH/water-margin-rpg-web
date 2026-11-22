import { $, h, sleep } from './dom.js';
import { G, maxStats, heroSkills, expNext, STAT_NAME, invCount, give, activeParty, healAll, STATS } from './state.js';
import { HEROES, SPEAKERS, WTYPE_NAME } from './data/heroes.js';
import { ITEMS, SHOPS } from './data/items.js';
import { SKILLS } from './data/skills.js';
import { url } from './assets.js';
import * as Save from './save.js';
import { sfx, isMuted, setMuted } from './audio.js';

export const UIH = {}; // main.js 提供：loadGame(slot), toTitle(), onMenuClose(), mapName(id), quests
export const UI = { busy: 0, fastText: false };

// ───────── 對話 ─────────
let advance = null;
export function advanceDialog() { if (advance) { advance(); return true; } return false; }
function onAdvanceKey(e) { if (advance && (e.key === 'Enter' || e.key === ' ' || e.key === 'z' || e.key === 'Z')) { e.preventDefault(); advance(); } }
window.addEventListener('keydown', onAdvanceKey);

export function say(who, text) {
  const dlg = $('#dialog'), por = $('#dialog .por'), nm = $('#dialog .name'), tx = $('#dialog .text');
  const img = SPEAKERS[who];
  if (img) { por.src = url(img); por.hidden = false; } else { por.removeAttribute('src'); por.hidden = true; }
  nm.textContent = who || '';
  dlg.hidden = false; UI.busy++;
  return new Promise(res => {
    let i = 0, done = false, t = null;
    const full = text;
    const finish = () => { done = true; clearInterval(t); tx.textContent = full; };
    if (UI.fastText) finish(); else { tx.textContent = ''; t = setInterval(() => { i += 2; tx.textContent = full.slice(0, i); if (i >= full.length) finish(); }, 28); }
    const go = () => {
      if (!done) { finish(); return; }
      advance = null; dlg.removeEventListener('pointerup', go); UI.busy--;
      dlg.hidden = true; sfx('click'); res();
    };
    setTimeout(() => { advance = go; dlg.addEventListener('pointerup', go); }, 120);
  });
}

export function choice(opts) {
  const box = $('#choices'); box.innerHTML = ''; box.hidden = false; UI.busy++;
  return new Promise(res => {
    opts.forEach((o, i) => box.append(h('button', { onclick: () => { box.hidden = true; UI.busy--; sfx('click'); res(i + 1); } }, `${i + 1}. ${o}`)));
    const key = e => { const n = +e.key; if (n >= 1 && n <= opts.length) { window.removeEventListener('keydown', key); box.querySelectorAll('button')[n - 1].click(); } };
    window.addEventListener('keydown', key);
  });
}

export function toast(msg, ms = 1500) {
  const el = h('div', { class: 'toast' }, msg); $('#toasts').append(el);
  setTimeout(() => el.remove(), ms);
  return sleep(Math.min(ms, 420));
}

export function caption(c1, c2, c3, ms = 2600) {
  const el = $('#caption'); el.innerHTML = '';
  el.append(h('div', { class: 'c1' }, c1 || ''), h('div', { class: 'c2' }, c2 || ''), h('div', { class: 'c3' }, c3 || ''));
  el.hidden = false; UI.busy++;
  return new Promise(res => {
    let closed = false;
    const close = () => { if (closed) return; closed = true; el.hidden = true; UI.busy--; advance = null; res(); };
    setTimeout(() => { el.onpointerup = close; advance = close; }, 400);
    setTimeout(close, UI.fastText ? 500 : ms);
  });
}

export async function fade(fn) {
  const f = $('#fade'); f.classList.add('on'); await sleep(260);
  try { await fn(); } finally { f.classList.remove('on'); await sleep(200); }
}

export function setCG(name) { const c = $('#cg'); if (!name) { c.hidden = true; return; } c.style.backgroundImage = `url(${url(name)})`; c.hidden = false; }

// ───────── 共用元件 ─────────
const tok = id => h('img', { class: 'tok', src: url(HEROES[id].img, true), alt: '' });
function bar(cur, max, cls = '') { return h('div', { class: 'bar ' + cls }, h('i', { style: `width:${Math.max(0, Math.min(100, cur / max * 100))}%` })); }
function itemStatText(it) {
  const parts = [];
  for (const k of STATS) if (it[k]) parts.push(`${STAT_NAME[k]}${it[k] > 0 ? '+' : ''}${it[k]}`);
  if (it.wt) parts.unshift(`〔${WTYPE_NAME[it.wt]}〕`);
  if (it.immune) parts.push('免疫中毒');
  return parts.join(' ');
}
export function itemDesc(id) {
  const it = ITEMS[id]; if (!it) return '';
  if (it.type === 'eq') return itemStatText(it) + (it.desc ? '　' + it.desc : '');
  return it.desc || '';
}

function openPanel(el, title, body, onClose) {
  el.innerHTML = ''; el.hidden = false; UI.busy++;
  return new Promise(res => {
    const close = () => { el.hidden = true; UI.busy--; sfx('click'); onClose && onClose(); res(); };
    el.append(h('div', { class: 'mhead' }, h('h2', null, title), h('button', { class: 'close', onclick: close }, '關閉')), body);
    el._close = close;
  });
}

// ───────── 選單 ─────────
let menuTab = 'party';
export function openMenu() {
  const el = $('#menu');
  const tabs = h('div', { class: 'tabs' });
  const body = h('div', { class: 'mbody' });
  const wrap = h('div', { style: 'display:flex;flex-direction:column;flex:1;min-height:0' }, tabs, body);
  const TABS = [['party', '隊伍'], ['items', '物品'], ['quests', '任務'], ['save', '存檔'], ['opts', '設定']];
  const render = () => {
    tabs.innerHTML = '';
    for (const [k, n] of TABS) tabs.append(h('button', { class: 'tab' + (menuTab === k ? ' on' : ''), onclick: () => { sfx('click'); menuTab = k; render(); } }, n));
    body.innerHTML = '';
    ({ party: partyTab, items: itemsTab, quests: questTab, save: saveTab, opts: optTab })[menuTab](body, render);
    body.scrollTop = 0;
  };
  render();
  return openPanel(el, '選單', wrap, () => UIH.onMenuClose && UIH.onMenuClose());
}

function partyTab(body, rerender) {
  const p = G.s.party;
  body.append(h('div', { class: 'note' }, `前四名出戰，其餘為後備（獲得一半經驗）。銀兩：${G.s.gold}`));
  p.forEach((id, i) => {
    const hero = G.s.roster[id], H = HEROES[id], m = maxStats(hero);
    body.append(h('div', { class: 'row' }, tok(id),
      h('div', { class: 'grow' }, h('div', null, `${H.name}　Lv ${hero.lv}${i < 4 ? '' : '　（後備）'}`),
        h('div', { class: 'sub' }, `${H.title}・${H.role}`),
        h('div', { class: 'sub' }, `體 ${hero.hp}/${m.hp}　氣 ${hero.mp}/${m.mp}`), bar(hero.hp, m.hp), bar(hero.mp, m.mp, 'mp')),
      h('div', { style: 'display:flex;flex-direction:column;gap:4px' },
        h('button', { onclick: () => { sfx('click'); heroDetail(body, id, rerender); } }, '詳細'),
        i > 0 ? h('button', { onclick: () => { sfx('click'); p.splice(i, 1); p.splice(i - 1, 0, id); rerender(); } }, '上移') : null)));
  });
}

export function heroDetail(body, id, back) {
  const hero = G.s.roster[id], H = HEROES[id];
  const render = () => {
    const m = maxStats(hero);
    body.innerHTML = '';
    body.append(h('div', { class: 'mhead' }, h('button', { class: 'sbtn', onclick: () => { sfx('click'); back(); } }, '← 返回')));
    const statBox = h('div', { class: 'stats' });
    for (const k of STATS) statBox.append(h('div', null, `${STAT_NAME[k]}：${k === 'hp' ? hero.hp + '/' + m.hp : k === 'mp' ? hero.mp + '/' + m.mp : m[k]}`));
    body.append(h('div', { class: 'hero-card' }, h('img', { class: 'hero-big', src: url(H.img), alt: H.name }),
      h('div', null, h('h3', null, `${H.title}　${H.name}`), h('div', { class: 'sub' }, `${H.star}・${H.role}・兵器：${WTYPE_NAME[H.wtype]}`),
        h('div', null, `Lv ${hero.lv}　經驗 ${hero.exp}/${expNext(hero.lv)}`), bar(hero.exp, expNext(hero.lv), 'ex'), statBox,
        h('div', { class: 'note' }, H.desc))));
    body.append(h('h3', null, '裝備'));
    for (const [slot, nm] of [['w', '兵器'], ['a', '護具'], ['c', '飾品']]) {
      const cur = hero.eq[slot];
      body.append(h('div', { class: 'slot-row' }, h('span', { class: 'lbl' }, nm),
        h('span', { class: 'grow', style: 'flex:1' }, cur ? `${ITEMS[cur].name}（${itemStatText(ITEMS[cur])}）` : '（無）'),
        h('button', { class: 'sbtn', onclick: () => { sfx('click'); equipPick(body, hero, slot, render); } }, '更換')));
    }
    body.append(h('h3', null, '招式'));
    for (const [sk, lv] of H.skills) {
      const S = SKILLS[sk], got = hero.lv >= lv;
      body.append(h('div', { class: 'row', style: got ? '' : 'opacity:.5' }, h('div', { class: 'grow' }, h('div', null, `${S.name}　（內力 ${S.mp}）${got ? '' : '　Lv' + lv + ' 習得'}`), h('div', { class: 'sub' }, S.desc || ''))));
    }
  };
  render();
}

function equipPick(body, hero, slot, back) {
  const H = HEROES[hero.id];
  body.innerHTML = '';
  body.append(h('div', { class: 'mhead' }, h('button', { class: 'sbtn', onclick: () => { sfx('click'); back(); } }, '← 返回'), h('h2', null, '選擇裝備')));
  const cur = hero.eq[slot] ? ITEMS[hero.eq[slot]] : {};
  const opts = Object.keys(G.s.inv).filter(id => { const it = ITEMS[id]; return it && it.type === 'eq' && it.slot === slot && (slot !== 'w' || it.wt === H.wtype); });
  if (hero.eq[slot] && slot !== 'w') body.append(h('div', { class: 'row' }, h('div', { class: 'grow' }, '卸下'), h('button', { onclick: () => { give(hero.eq[slot], 1); hero.eq[slot] = null; clampHP(hero); sfx('click'); back(); } }, '卸下')));
  if (!opts.length) body.append(h('div', { class: 'note' }, slot === 'w' ? `沒有可用的${WTYPE_NAME[H.wtype]}類兵器。` : '背包中沒有可替換的裝備。'));
  for (const id of opts) {
    const it = ITEMS[id];
    const diff = [];
    for (const k of STATS) { const d = (it[k] || 0) - (cur[k] || 0); if (d) diff.push(h('span', { class: d > 0 ? 'up' : 'down' }, ` ${STAT_NAME[k]}${d > 0 ? '+' : ''}${d}`)); }
    body.append(h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', null, `${it.name} ×${G.s.inv[id]}`), h('div', { class: 'sub' }, itemStatText(it), ...diff)),
      h('button', { onclick: () => { give(id, -1); if (hero.eq[slot]) give(hero.eq[slot], 1); hero.eq[slot] = id; clampHP(hero); sfx('item'); back(); } }, '裝備')));
  }
}
function clampHP(hero) { const m = maxStats(hero); hero.hp = Math.min(hero.hp, m.hp); hero.mp = Math.min(hero.mp, m.mp); }

function itemsTab(body, rerender) {
  const ids = Object.keys(G.s.inv).filter(id => ITEMS[id] && G.s.inv[id] > 0);
  const groups = [['use', '藥品'], ['eq', '裝備'], ['key', '要物']];
  for (const [t, nm] of groups) {
    const list = ids.filter(id => ITEMS[id].type === t);
    body.append(h('h3', null, nm));
    if (!list.length) { body.append(h('div', { class: 'note' }, '（無）')); continue; }
    for (const id of list) {
      const it = ITEMS[id];
      const usable = t === 'use' && !it.dmg;
      body.append(h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', null, `${it.name} ×${G.s.inv[id]}`), h('div', { class: 'sub' }, itemDesc(id))),
        usable ? h('button', { onclick: () => { sfx('click'); useItemField(body, id, rerender); } }, '使用') : null));
    }
  }
}

function useItemField(body, id, back) {
  const it = ITEMS[id];
  if (it.target === 'allies') { applyItem(it, activeParty()); give(id, -1); sfx('heal'); toast(`使用了${it.name}`); back(); return; }
  body.innerHTML = '';
  body.append(h('div', { class: 'mhead' }, h('button', { class: 'sbtn', onclick: () => back() }, '← 返回'), h('h2', null, `${it.name}：選擇對象`)));
  for (const hero of activeParty()) {
    const m = maxStats(hero), dead = hero.hp <= 0;
    const ok = it.target === 'dead' ? dead : !dead;
    body.append(h('div', { class: 'row' }, tok(hero.id), h('div', { class: 'grow' }, h('div', null, HEROES[hero.id].name), h('div', { class: 'sub' }, `體 ${hero.hp}/${m.hp}　氣 ${hero.mp}/${m.mp}`)),
      h('button', { disabled: !ok, onclick: () => { applyItem(it, [hero]); give(id, -1); sfx('heal'); if (!G.s.inv[id]) back(); else useItemField(body, id, back); } }, '使用')));
  }
}
export function applyItem(it, heroes) {
  for (const hero of heroes) {
    const m = maxStats(hero);
    if (it.revive && hero.hp <= 0) hero.hp = Math.max(1, Math.floor(m.hp * it.revive));
    if (hero.hp <= 0) continue;
    if (it.hp) hero.hp = Math.min(m.hp, hero.hp + it.hp);
    if (it.mp) hero.mp = Math.min(m.mp, hero.mp + it.mp);
  }
}

function questTab(body) {
  const Q = UIH.quests || {};
  const act = Object.keys(G.s.quests).filter(k => G.s.quests[k] === 'active' && Q[k]);
  const done = Object.keys(G.s.quests).filter(k => G.s.quests[k] === 'done' && Q[k]);
  body.append(h('h3', null, '進行中'));
  if (!act.length) body.append(h('div', { class: 'note' }, '（無）'));
  for (const k of act) body.append(h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', null, (Q[k].side ? '【支線】' : '【主線】') + Q[k].name), h('div', { class: 'sub' }, Q[k].desc))));
  body.append(h('h3', null, '已完成'));
  if (!done.length) body.append(h('div', { class: 'note' }, '（無）'));
  for (const k of done) body.append(h('div', { class: 'row', style: 'opacity:.7' }, h('div', { class: 'grow' }, '✓ ' + Q[k].name)));
  const t = Math.floor((G.s.playMs || 0) / 60000);
  body.append(h('div', { class: 'note' }, `遊戲時間：${Math.floor(t / 60)} 小時 ${t % 60} 分　戰鬥 ${G.s.battles} 場　擊敗 ${G.s.kills} 名敵人`));
}

function fmtTime(ms) { const t = Math.floor((ms || 0) / 60000); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; }
export function slotLabel(slot) {
  const r = Save.slotSummary(slot);
  if (r.status === 'empty') return '（空）';
  if (r.status === 'newer') return '（較新版本的存檔，無法在此版本讀取）';
  if (r.status === 'corrupt') return '（資料損壞）';
  return `第${r.chapter}回・${UIH.mapName ? UIH.mapName(r.map) : r.map}・Lv${r.lv}・${fmtTime(r.playMs)}`;
}
function saveTab(body, rerender, canSave = true) {
  body.append(h('div', { class: 'note' }, '存檔會保存在本機瀏覽器。舊版存檔會自動備份後升級，不會被刪除。'));
  for (const slot of Save.SLOTS) {
    const st = Save.readSlot(slot).status;
    body.append(h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', null, slot === 'auto' ? '自動存檔' : `存檔 ${slot}`), h('div', { class: 'sub' }, slotLabel(slot))),
      slot !== 'auto' && canSave ? h('button', { onclick: () => { const r = Save.writeSlot(slot, G.s); sfx(r.ok ? 'item' : 'click'); toast(r.ok ? `已存入存檔 ${slot}` : r.msg, 2200); rerender(); } }, '存檔') : null,
      h('button', { disabled: st !== 'ok', onclick: () => { sfx('click'); UIH.loadGame(slot); } }, '讀取')));
  }
}
function optTab(body, rerender) {
  body.append(h('div', { class: 'row' }, h('div', { class: 'grow' }, '音樂與音效'), h('button', { onclick: () => { setMuted(!isMuted()); UIH.syncMute && UIH.syncMute(); rerender(); } }, isMuted() ? '已關閉' : '已開啟')));
  body.append(h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', null, '戰鬥速度'), h('div', { class: 'sub' }, '快速模式縮短戰鬥動畫時間')), h('button', { onclick: () => { G.s.settings.fast = !G.s.settings.fast; rerender(); } }, G.s.settings.fast ? '快速' : '一般')));
  body.append(h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', null, '文字速度'), h('div', { class: 'sub' }, '開啟後對話直接全部顯示')), h('button', { onclick: () => { UI.fastText = !UI.fastText; try { localStorage.setItem('shuihu.fasttext', UI.fastText ? '1' : '0'); } catch (e) {} rerender(); } }, UI.fastText ? '立即' : '逐字')));
  body.append(h('div', { class: 'row' }, h('div', { class: 'grow' }, '回到標題畫面（未存檔的進度會遺失）'), h('button', { class: 'red', onclick: () => { $('#menu')._close(); UIH.toTitle(); } }, '回標題')));
  body.append(h('div', { class: 'note' }, '操作：點擊地圖移動、點人物對話；或用方向鍵／WASD 移動，Enter／空白鍵調查，Esc 開選單。'));
}

// 讀檔面板（標題畫面用）
export function loadPanel() {
  const body = h('div', { class: 'mbody' });
  const p = openPanel($('#panel'), '讀取存檔', body);
  const re = () => { body.innerHTML = ''; saveTab(body, re, false); };
  re();
  return p;
}

// ───────── 商店／客棧 ─────────
export function shop(id) {
  const S = SHOPS[id];
  const body = h('div', { class: 'mbody' });
  let mode = 'buy';
  const render = () => {
    body.innerHTML = '';
    body.append(h('div', { class: 'tabs' }, h('button', { class: 'tab' + (mode === 'buy' ? ' on' : ''), onclick: () => { mode = 'buy'; render(); } }, '購買'), h('button', { class: 'tab' + (mode === 'sell' ? ' on' : ''), onclick: () => { mode = 'sell'; render(); } }, '賣出')));
    body.append(h('div', { class: 'note' }, `持有銀兩：${G.s.gold}`));
    const list = mode === 'buy' ? S.items : Object.keys(G.s.inv).filter(k => ITEMS[k] && ITEMS[k].type !== 'key' && ITEMS[k].price > 0);
    for (const iid of list) {
      const it = ITEMS[iid]; const price = mode === 'buy' ? it.price : Math.floor(it.price / 2);
      const fits = it.type === 'eq' && it.slot === 'w' ? activeParty().filter(x => HEROES[x.id].wtype === it.wt).map(x => HEROES[x.id].name).join('、') : '';
      body.append(h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', null, `${it.name}　${price} 兩`), h('div', { class: 'sub' }, itemDesc(iid) + (fits ? `　可裝備：${fits}` : '') + `　（持有 ${invCount(iid)}）`)),
        mode === 'buy' ? h('button', { disabled: G.s.gold < price, onclick: () => { G.s.gold -= price; give(iid, 1); sfx('item'); render(); } }, '買')
          : h('button', { onclick: () => { G.s.gold += price; give(iid, -1); sfx('item'); render(); } }, '賣')));
    }
  };
  render();
  return openPanel($('#panel'), S.name, body);
}

export async function inn(price) {
  const k = await choice([price ? `住一晚（${price} 兩，全隊回復）` : '歇息（免費，全隊回復）', '不必了']);
  if (k !== 1) return;
  if (G.s.gold < price) { await say('店小二', '客官，銀兩不夠哩。'); return; }
  G.s.gold -= price;
  await fade(async () => { healAll(); await sleep(500); });
  sfx('heal'); await toast('全隊體力、內力完全回復。');
}
