// 回合制戰鬥：依身法排序行動；指令 攻擊／招式／道具／防禦／撤退／自動
import { $, h, sleep } from './dom.js';
import { G, maxStats, heroSkills, frontParty, activeParty, gainExp, give } from './state.js';
import { HEROES } from './data/heroes.js';
import { SKILLS, STATUS } from './data/skills.js';
import { ITEMS } from './data/items.js';
import { ARCHETYPES, BOSSES } from './data/enemies.js';
import { url } from './assets.js';
import { sfx, playMusic } from './audio.js';
import { UI, applyItem, itemDesc } from './ui.js';
import { BattleVFX } from './battle_fx.js';
import { Battle3DStage } from './battle3d.js';

export const B = { cur: null }; // 測試用：目前戰鬥狀態

function rnd(a, b) { return a + Math.random() * (b - a); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

export function makeEnemy(tok) {
  let e;
  if (tok.includes('@')) {
    const [arch, lvS] = tok.split('@'); const A = ARCHETYPES[arch]; const lv = +lvS || 1;
    if (!A) throw new Error('未知敵人 ' + tok);
    let tier = A.tiers[0]; for (const t of A.tiers) if (lv >= t[0]) tier = t;
    const L = lv - 1;
    e = { key: arch, name: tier[1], img: A.img, tint: tier[2] || '', kind: A.kind, lv,
      mhp: Math.round(A.hp * (1 + 0.27 * L)), atk: Math.round(A.atk * (1 + 0.155 * L)), def: Math.round(A.def * (1 + 0.155 * L)),
      int: Math.round(A.int * (1 + 0.15 * L)), spd: Math.round(A.spd + 0.55 * L), luk: 3 + Math.floor(L / 3),
      exp: Math.round(A.exp * (1 + 0.5 * L + 0.03 * L * L)), gold: Math.round(A.gold * (1 + 0.35 * L)), acts: A.acts, drop: A.drop };
  } else {
    const Bo = BOSSES[tok]; if (!Bo) throw new Error('未知頭目 ' + tok);
    e = { key: tok, ...Bo, mhp: Bo.hp, luk: 6 + Math.floor(Bo.lv / 3), tint: Bo.tint || '' };
  }
  e.hp = e.mhp; e.isFoe = true; e.st = {}; e.buffs = []; e.pi = 0;
  return e;
}

// 隊伍人數越多，敵人越耐打（避免四人隊秒殺一切）
export const SCALE = { hp: 0.5, bossHp: 0.3, atk: 0.07 };
export function partyScale(foes, n) {
  const ka = 1 + SCALE.atk * (n - 1);
  for (const f of foes) { const kh = 1 + (f.pattern ? SCALE.bossHp : SCALE.hp) * (n - 1); f.mhp = Math.round(f.mhp * kh); f.hp = f.mhp; f.atk = Math.round(f.atk * ka); }
}

function heroActor(hero) {
  return { hero, isFoe: false, name: HEROES[hero.id].name, st: {}, buffs: [], get hp() { return hero.hp; }, set hp(v) { hero.hp = v; },
    get mp() { return hero.mp; }, set mp(v) { hero.mp = v; } };
}
function baseStat(a, k) {
  if (a.isFoe) return k === 'mhp' ? a.mhp : (a[k] || 0);
  const m = maxStats(a.hero); return k === 'mhp' ? m.hp : k === 'mmp' ? m.mp : (m[k] || 0);
}
function stat(a, k) {
  let v = baseStat(a, k);
  for (const b of a.buffs) if (b.stat === k) v *= b.mult;
  if (a.enraged && (k === 'atk' || k === 'spd')) v *= k === 'atk' ? 1.3 : 1.15;
  return v;
}
function evaMult(a) { let m = 1; for (const b of a.buffs) if (b.stat === 'eva') m *= b.mult; return m; }
const alive = arr => arr.filter(a => a.hp > 0);

let S = null; // 目前戰鬥

export async function battle(spec, opts = {}) {
  const toks = spec.split('+').map(s => s.trim()).filter(Boolean);
  const foes = toks.map(makeEnemy);
  partyScale(foes, frontParty().length);
  const snapshot = JSON.stringify({ roster: G.s.roster, inv: G.s.inv, gold: G.s.gold });
  const isBoss = foes.some(f => f.boss);
  const prevMusic = opts.prevMusic;
  playMusic(isBoss ? 'boss' : 'battle');
  sfx('encounter');
  const res = await runBattle(foes, { ...opts, isBoss });
  if (res === 'retry') {
    const sn = JSON.parse(snapshot); G.s.roster = sn.roster; G.s.inv = sn.inv; G.s.gold = sn.gold;
    return battle(spec, opts);
  }
  if (prevMusic) playMusic(prevMusic);
  return res;
}

function delay(ms) { return sleep(G.s.settings.fast ? ms * 0.4 : ms); }

function runBattle(foes, opts) {
  return new Promise(async (resolve) => {
    const root = $('#battle'); root.innerHTML = ''; root.hidden = false; root.classList.remove('is-3d'); UI.busy++;
    const bgName = opts.bg || 'bg_yezhulin';
    root.style.backgroundImage = `url(${url(bgName)})`;
    const allies = frontParty().map(heroActor);
    S = B.cur = { foes, allies, opts, round: 0, log: [], picking: null, pickPool: null, over: false, auto: !!G.s.settings.auto };
    const topEl = h('div', { class: 'b-top' });
    const logEl = h('div', { class: 'b-log' }, '');
    const orderEl = h('div', { class: 'b-order', 'aria-hidden': 'true' });
    const autoTopBtn = h('button', { class: 'b-auto-top', onclick: () => toggleAuto() }, '');
    topEl.append(logEl, orderEl, autoTopBtn);
    const foeEl = h('div', { class: 'b-foes' });
    const heroEl = h('div', { class: 'b-heroes' + (allies.length > 2 ? ' n' + allies.length : '') });
    const stage = h('div', { class: 'b-stage' }, foeEl, heroEl);
    const partyEl = h('div', { class: 'b-party' });
    const cmdEl = h('div', { class: 'b-cmds' });
    const dockEl = h('div', { class: 'b-dock' }, partyEl, cmdEl);
    const fxEl = h('div', { class: 'fx' });
    const banner = h('div', { class: 'banner' });
    const cutinEl = h('div', { class: 'b-cutin', hidden: true });
    root.append(topEl, stage, dockEl, fxEl, banner, cutinEl);
    const vfx = new BattleVFX(root, bgName);
    S.vfx = vfx;
    S.el = { logEl, orderEl, autoTopBtn, foeEl, stage, partyEl, cmdEl, fxEl, banner, cutinEl, root };

    // 建立 FF7 / FF8 風格 3D 電影運鏡戰鬥舞台
    const syncProjections = (st3d) => {
      if (!S || !st3d || !st3d.ok) return;
      for (const f of S.foes) {
        const pt = st3d.projectActor(f, 1.08);
        if (pt && f.el) {
          f.el.style.left = Math.round(pt.x) + 'px';
          f.el.style.top = Math.round(pt.y) + 'px';
        }
      }
      for (const a of S.allies) {
        const pt = st3d.projectActor(a, 0.72);
        if (pt && a.hf) {
          a.hf.style.left = Math.round(pt.x) + 'px';
          a.hf.style.top = Math.round(pt.y) + 'px';
        }
      }
    };
    const stage3d = new Battle3DStage(root, allies, foes, bgName, syncProjections);
    S.stage3d = stage3d;
    if (stage3d.ok) {
      root.classList.add('is-3d');
      stage3d.canvas.addEventListener('pointerup', e => {
        if (!S || !S.picking || !S.pickPool) return;
        const hit = stage3d.pickAtScreen(e.clientX, e.clientY, S.pickPool);
        if (hit) S.picking(hit.isFoe ? 'foe' : 'ally', hit);
      });
    }

    // 隨時可取消自動戰鬥（按鈕＋Esc 快捷鍵）
    const syncAutoUI = () => {
      if (!S) return;
      autoTopBtn.textContent = S.auto ? '■ 取消自動' : '自動：關';
      autoTopBtn.classList.toggle('on', S.auto);
      if (S.auto && !S.over && !S.waitingCmd) {
        cmdEl.innerHTML = '';
        cmdEl.append(cmdBtn('■ 取消自動戰鬥', '隨時切回手動下指令（Esc）', () => toggleAuto(), false, 'wide on'));
      }
    };
    const toggleAuto = (force) => {
      if (!S || S.over) return;
      sfx('click');
      S.auto = typeof force === 'boolean' ? force : !S.auto;
      G.s.settings.auto = S.auto;
      if (S.auto) {
        log('已開啟自動戰鬥（隨時可點「取消自動」切回手動）。');
        if (S.cancelWait) S.cancelWait();
      } else {
        log('已取消自動戰鬥，下回合恢復手動操作！');
        if (!S.waitingCmd) cmdEl.innerHTML = '';
      }
      syncAutoUI();
    };
    S.toggleAuto = toggleAuto;
    S.syncAutoUI = syncAutoUI;
    const onBattleKey = (e) => {
      if (S && S.auto && e.key === 'Escape') { e.preventDefault(); toggleAuto(false); }
    };
    window.addEventListener('keydown', onBattleKey);

    foes.forEach((f, idx) => {
      // 好漢當頭目時用全身戰鬥立繪（鏡像，面向我方；3D 模式時僅保留 3D 投影血條與名牌）
      const hb = f.img.startsWith('p_'), fimg = hb ? 'bf_' + f.img.slice(2) : f.img;
      const im = h('img', { src: url(fimg), alt: f.name, style: (f.tint ? `filter:${f.tint} drop-shadow(0 8px 14px rgba(0,0,0,.78));` : '') + `--idle-d:${-(idx * 0.7)}s` });
      f.el = h('div', { class: 'foe' + (hb ? ' mirror' : '') + (f.big || (f.boss && foes.length === 1) ? ' big' : '') }, h('div', { class: 'st' }), im, h('div', { class: 'fn' }, f.name + (f.boss ? '' : ` Lv${f.lv}`)), h('div', { class: 'bar' }, h('b', { class: 'trail' }), h('i')));
      f.el.addEventListener('click', () => S.picking && S.picking('foe', f));
      foeEl.append(f.el);
    });
    allies.forEach((a, idx) => {
      const id = a.hero.id;
      a.hf = h('div', { class: 'hf' }, h('img', { src: url('bf_' + id), alt: HEROES[id].name, style: `--idle-d:${-(idx * 0.65 + 0.3)}s` }));
      a.hf.addEventListener('click', () => S.picking && S.picking('ally', a));
      heroEl.append(a.hf);
      a.el = h('div', { class: 'pc' }, h('img', { src: url(HEROES[id].img), alt: '' }), h('div', { class: 'pn' }, HEROES[id].name),
        h('div', { class: 'nums' }), h('div', { class: 'bar' }, h('b', { class: 'trail' }), h('i')), h('div', { class: 'bar mp' }, h('i')), h('div', { class: 'pst' }));
      a.el.addEventListener('click', () => S.picking && S.picking('ally', a));
      partyEl.append(a.el);
    });
    refresh();
    syncAutoUI();
    const names = [...new Set(foes.map(f => f.name))].join('、');
    log(opts.isBoss ? `${names} 擋住了去路！` : `遭遇 ${names}！`);
    await delay(stage3d.ok ? 850 : 650);

    let result = null;
    while (!result) {
      S.round++;
      const order = [...alive(allies), ...alive(foes)].map(a => ({ a, s: stat(a, 'spd') * rnd(0.85, 1.15) })).sort((x, y) => y.s - x.s).map(x => x.a);
      for (let oi = 0; oi < order.length; oi++) {
        const a = order[oi];
        if (a.hp <= 0) continue;
        if (!alive(foes).length || !alive(allies).length) break;
        renderOrder(order.slice(oi).filter(x => x.hp > 0));
        stage3d.syncStates(a);
        const skip = await startTurn(a);
        refresh();
        if (a.hp <= 0) continue;
        if (skip) continue;
        let act;
        if (a.isFoe) {
          syncAutoUI();
          act = foeAI(a);
        } else {
          a.defending = false;
          stage3d.syncStates(a);
          if (S.auto) {
            syncAutoUI();
            await delay(140);
            act = S.auto ? heroAI(a) : await waitCmd(a);
          } else {
            act = await waitCmd(a);
          }
          if (act && act.type === 'flee') {
            const ps = alive(allies).reduce((s, x) => s + stat(x, 'spd'), 0) / Math.max(1, alive(allies).length);
            const es = alive(foes).reduce((s, x) => s + stat(x, 'spd'), 0) / Math.max(1, alive(foes).length);
            if (Math.random() < 0.55 + (ps - es) * 0.025) { log('全隊撤退成功！'); await delay(700); result = 'flee'; break; }
            log('撤退失敗！'); await delay(600); continue;
          }
        }
        if (act) await perform(a, act);
        if (!a.isFoe) a.el.classList.remove('turn');
        stage3d.syncStates(null);
        refresh();
        if (!alive(foes).length) { result = 'win'; break; }
        if (!alive(allies).length) { result = 'lose'; break; }
      }
      if (!result && !alive(foes).length) result = 'win';
      if (!result && !alive(allies).length) result = 'lose';
      // 回合結束：buff 遞減
      for (const a of [...allies, ...foes]) { a.buffs = a.buffs.filter(b => --b.turns > 0); }
      refresh();
    }
    S.over = true;
    window.removeEventListener('keydown', onBattleKey);
    cmdEl.innerHTML = '';
    autoTopBtn.hidden = true;
    let out = result;
    if (result === 'win') {
      stage3d.enterVictory();
      await victory(foes, allies);
    } else if (result === 'lose') out = await defeat(opts);
    // 倒下的同伴以 1 點體力復活
    if (out !== 'retry') for (const x of activeParty()) if (x.hp <= 0) x.hp = 1;
    stage3d.destroy();
    vfx.destroy();
    root.classList.remove('is-3d');
    root.hidden = true; root.innerHTML = ''; UI.busy--;
    S = B.cur = null;
    resolve(out);
  });
}

function log(msg) { if (!S) return; S.el.logEl.textContent = msg; S.log.push(msg); if (S.log.length > 60) S.log.shift(); }

function renderOrder(list) {
  if (!S || !S.el.orderEl) return;
  const el = S.el.orderEl;
  el.innerHTML = '';
  list.slice(0, 6).forEach((a, i) => {
    const src = a.isFoe ? url(a.img) : url(HEROES[a.hero.id].img);
    el.append(h('div', { class: 'bo-it' + (a.isFoe ? ' foe' : ' ally') + (i === 0 ? ' now' : ''), title: a.name },
      h('img', { src, alt: '' })));
  });
}

function setCam(cls) {
  if (!S || !S.el.stage) return;
  S.el.stage.classList.remove('cam-hero', 'cam-foe', 'cam-impact');
  if (cls) { void S.el.stage.offsetWidth; S.el.stage.classList.add(cls); }
}

async function playCutIn(a, skName) {
  if (!S || !S.el.cutinEl || G.s.settings.fast) return;
  const el = S.el.cutinEl;
  const isHero = !a.isFoe;
  const H = isHero ? HEROES[a.hero.id] : null;
  const imgName = isHero ? 'bf_' + a.hero.id : (a.img.startsWith('p_') ? 'bf_' + a.img.slice(2) : a.img);
  const seal = isHero ? (H.title || '梁山好漢') : (a.boss ? '強敵來襲' : '絕技');
  el.innerHTML = '';
  el.className = 'b-cutin ' + (isHero ? 'hero' : 'boss');
  el.append(
    h('div', { class: 'ci-bg' }),
    h('img', { class: 'ci-art', src: url(imgName), alt: '' }),
    h('div', { class: 'ci-txt' },
      h('span', { class: 'ci-seal' }, seal),
      h('strong', { class: 'ci-name' }, skName),
      h('em', { class: 'ci-who' }, a.name))
  );
  el.hidden = false;
  await delay(760);
  el.classList.add('out');
  await delay(220);
  el.hidden = true;
}

function refresh() {
  if (!S) return;
  for (const f of S.foes) {
    f.el.classList.toggle('dead', f.hp <= 0);
    const pct = Math.max(0, f.hp / f.mhp * 100) + '%';
    f.el.querySelector('.bar i').style.width = pct;
    const tr = f.el.querySelector('.bar .trail'); if (tr) tr.style.width = pct;
    const st = f.el.querySelector('.st'); st.innerHTML = '';
    for (const k of Object.keys(f.st)) if (f.st[k] > 0 && STATUS[k]) st.append(h('span', { style: `background:${STATUS[k].color}` }, STATUS[k].name));
    for (const b of f.buffs) st.append(h('span', null, (b.mult > 1 ? '↑' : '↓') + ({ atk: '攻', def: '防', spd: '速', eva: '閃', int: '智' }[b.stat] || '')));
  }
  for (const a of S.allies) {
    const m = maxStats(a.hero);
    a.el.querySelector('.nums').textContent = `體${Math.max(0, a.hero.hp)}/${m.hp} 氣${a.hero.mp}`;
    const pct = Math.max(0, a.hero.hp / m.hp * 100) + '%';
    const mpPct = Math.max(0, a.hero.mp / Math.max(1, m.mp) * 100) + '%';
    a.el.querySelector('.bar:not(.mp) i').style.width = pct;
    const tr = a.el.querySelector('.bar:not(.mp) .trail'); if (tr) tr.style.width = pct;
    const mpi = a.el.querySelector('.bar.mp i'); if (mpi) mpi.style.width = mpPct;
    a.el.classList.toggle('dead', a.hero.hp <= 0);
    a.hf.classList.toggle('dead', a.hero.hp <= 0); a.hf.classList.toggle('turn', a.el.classList.contains('turn'));
    const st = a.el.querySelector('.pst'); st.innerHTML = '';
    for (const k of Object.keys(a.st)) if (a.st[k] > 0 && STATUS[k]) st.append(h('span', { style: `background:${STATUS[k].color}` }, STATUS[k].name));
    if (a.buffs.length) st.append(h('span', { style: 'background:#2a6' }, '強化'));
  }
}

function pop(el, text, cls = '') {
  const p = h('div', { class: 'pop ' + cls }, text); el.append(p); setTimeout(() => p.remove(), 1000);
  el.classList.remove('hit'); void el.offsetWidth; if (cls !== 'heal' && cls !== 'mp') el.classList.add('hit');
  const hf = S && S.allies.find(x => x.el === el)?.hf;
  if (hf) { const q = h('div', { class: 'pop ' + cls }, text); hf.append(q); setTimeout(() => q.remove(), 1000); hf.classList.remove('hit'); void hf.offsetWidth; if (cls !== 'heal' && cls !== 'mp') hf.classList.add('hit'); }
}
function flash(cls) { const f = S.el.fxEl; f.className = 'fx'; void f.offsetWidth; f.className = 'fx ' + cls; }
function showBanner(t) { S.el.banner.innerHTML = ''; S.el.banner.append(h('span', null, t)); }

// 回合開始：異常狀態處理。回傳 true 表示跳過行動
async function startTurn(a) {
  if (S && !a.isFoe) a.el.classList.add('turn');
  let skip = false;
  for (const k of ['poison', 'burn']) if (a.st[k] > 0) {
    const mhp = stat(a, 'mhp'); const d = Math.max(1, Math.floor(mhp * (a.boss ? 0.025 : k === 'poison' ? 0.07 : 0.06)));
    a.hp = Math.max(0, a.hp - d); a.st[k]--; pop(a.el, '-' + d); log(`${a.name} ${STATUS[k].name}，損失 ${d} 體力。`); await delay(450);
    if (a.hp <= 0) { log(`${a.name} 倒下了！`); if (a.isFoe) G.s.kills++; skip = true; }
  }
  if (!skip && a.st.stun > 0) { a.st.stun--; log(`${a.name} 暈眩中，無法行動。`); await delay(500); skip = true; }
  else if (!skip && a.st.sleep > 0) { a.st.sleep--; log(`${a.name} 昏睡不醒……`); await delay(500); skip = true; }
  if (a.st.taunt > 0 && !skip) a.st.taunt--;
  if (!a.isFoe && skip) a.el.classList.remove('turn');
  return skip;
}

// ───── 指令選擇 ─────
function cmdBtn(label, sub, fn, dis, cls) { return h('button', { onclick: fn, disabled: dis, class: cls || null }, label, sub ? h('small', null, sub) : null); }
function waitCmd(a) {
  return new Promise(res => {
    const el = S.el.cmdEl;
    S.waitingCmd = true;
    const done = act => {
      S.waitingCmd = false; S.cancelWait = null;
      el.innerHTML = ''; a.el.classList.remove('turn');
      S.picking = null; S.pickPool = null; clearPick();
      S.syncAutoUI && S.syncAutoUI();
      res(act);
    };
    S.cancelWait = () => done(heroAI(a));
    const main = () => {
      if (S.auto) { done(heroAI(a)); return; }
      el.innerHTML = ''; clearPick(); S.picking = null; S.pickPool = null;
      log(`${a.name} 的回合——請下指令。`);
      const skills = heroSkills(a.hero);
      el.append(
        cmdBtn('攻擊', null, () => { sfx('click'); target(SKILLS.attack, t => done({ type: 'skill', sk: 'attack', t })); }),
        cmdBtn('招式', `${skills.length} 式`, () => { sfx('click'); skillMenu(); }, !skills.length),
        cmdBtn('道具', null, () => { sfx('click'); itemMenu(); }),
        cmdBtn('防禦', '減傷五成', () => { sfx('click'); done({ type: 'defend' }); }),
        cmdBtn('撤退', S.opts.noEscape ? '不可撤退' : null, () => { sfx('click'); done({ type: 'flee' }); }, !!S.opts.noEscape),
        cmdBtn('自動', S.auto ? '開' : '關', () => { S.toggleAuto && S.toggleAuto(true); }, false, S.auto ? 'on' : null));
    };
    const back = () => cmdBtn('← 返回', null, () => { sfx('click'); main(); }, false, 'wide');
    const skillMenu = () => {
      el.innerHTML = ''; const list = h('div', { class: 'b-list' });
      for (const sk of heroSkills(a.hero)) {
        const Sk = SKILLS[sk];
        list.append(cmdBtn(`${Sk.name}　氣${Sk.mp}`, Sk.desc, () => { sfx('click'); target(Sk, t => done({ type: 'skill', sk, t })); }, a.hero.mp < Sk.mp));
      }
      el.append(list, back());
    };
    const itemMenu = () => {
      el.innerHTML = ''; const list = h('div', { class: 'b-list' });
      const ids = Object.keys(G.s.inv).filter(k => ITEMS[k] && ITEMS[k].type === 'use' && G.s.inv[k] > 0);
      if (!ids.length) list.append(h('div', { class: 'note', style: 'color:#fff' }, '沒有可用的道具。'));
      for (const id of ids) list.append(cmdBtn(`${ITEMS[id].name} ×${G.s.inv[id]}`, itemDesc(id), () => { sfx('click'); target(ITEMS[id], t => done({ type: 'item', id, t })); }));
      el.append(list, back());
    };
    const target = (Sk, cb) => {
      const tg = Sk.target;
      if (tg === 'self') return cb([a]);
      if (tg === 'enemies') return cb(alive(S.foes));
      if (tg === 'allies') return cb(S.allies.filter(x => x.hp > 0));
      el.innerHTML = '';
      const pool = tg === 'enemy' ? alive(S.foes) : tg === 'dead' ? S.allies.filter(x => x.hp <= 0) : S.allies.filter(x => x.hp > 0);
      if (!pool.length) { log('沒有可選擇的對象。'); main(); return; }
      if (pool.length === 1 && tg === 'enemy') return cb(pool);
      log(tg === 'enemy' ? '請點選要攻擊的敵人。' : '請點選對象。');
      for (const p of pool) { p.el.classList.add('pick'); p.hf && p.hf.classList.add('pick'); }
      S.pickPool = pool;
      S.stage3d && S.stage3d.setPickHighlight(pool);
      S.picking = (kind, x) => { if (pool.includes(x)) { sfx('click'); cb([x]); } };
      el.append(back());
    };
    main();
  });
}
function clearPick() {
  if (!S) return;
  for (const x of [...S.foes, ...S.allies]) { x.el.classList.remove('pick'); x.hf && x.hf.classList.remove('pick'); }
  S.stage3d && S.stage3d.setPickHighlight(null);
}

// ───── AI ─────
function heroAI(a) {
  const sks = heroSkills(a.hero).map(k => [k, SKILLS[k]]).filter(([, s]) => s.mp <= a.hero.mp);
  const hurt = S.allies.filter(x => x.hp > 0 && x.hp < stat(x, 'mhp') * 0.4);
  const dead = S.allies.filter(x => x.hp <= 0);
  const rev = sks.find(([, s]) => s.kind === 'revive');
  if (dead.length && rev) return { type: 'skill', sk: rev[0], t: [dead[0]] };
  const heal = sks.find(([, s]) => s.kind === 'heal' && s.target !== 'self');
  if (hurt.length && heal) return { type: 'skill', sk: heal[0], t: heal[1].target === 'allies' ? S.allies.filter(x => x.hp > 0) : [hurt[0]] };
  if (a.hp < stat(a, 'mhp') * 0.25) {
    const it = ['pill', 'herb', 'bun', 'elixir'].find(k => G.s.inv[k] > 0);
    if (it) return { type: 'item', id: it, t: [a] };
  }
  const foes = alive(S.foes);
  const weakest = foes.slice().sort((x, y) => x.hp - y.hp)[0];
  const dmg = sks.filter(([, s]) => s.kind === 'phys' || s.kind === 'mag' || s.kind === 'steal');
  const buffs = sks.filter(([, s]) => (s.kind === 'buff' || s.kind === 'debuff') && s.target !== 'self');
  if (buffs.length && S.round % 4 === 1 && a.hero.mp > stat(a, 'mmp') * 0.5 && Math.random() < 0.5) {
    const [k, s] = pick(buffs); return { type: 'skill', sk: k, t: s.target === 'enemies' ? foes : s.target === 'allies' ? S.allies.filter(x => x.hp > 0) : [weakest] };
  }
  if (dmg.length && a.hero.mp > stat(a, 'mmp') * 0.25 && Math.random() < 0.7) {
    const multi = dmg.filter(([, s]) => s.target === 'enemies');
    const [k, s] = foes.length >= 3 && multi.length ? multi[multi.length - 1] : dmg[dmg.length - 1];
    return { type: 'skill', sk: k, t: s.target === 'enemies' ? foes : [weakest] };
  }
  return { type: 'skill', sk: 'attack', t: [weakest] };
}

function foeAI(f) {
  let sk = 'attack';
  if (f.pattern) { sk = f.pattern[f.pi % f.pattern.length]; f.pi++; }
  else if (f.acts) { for (const [k, p] of f.acts) if (Math.random() < p) { sk = k; break; } }
  const Sk = SKILLS[sk];
  const al = alive(S.allies);
  let t;
  if (Sk.target === 'enemies') t = al;
  else if (Sk.target === 'self') t = [f];
  else if (Sk.target === 'allies') t = alive(S.foes);
  else {
    const taunt = al.filter(x => x.st.taunt > 0);
    t = [taunt.length && Math.random() < 0.75 ? taunt[0] : pick(al)];
  }
  return { type: 'skill', sk, t };
}

// ───── 執行行動 ─────
const actorStageEl = x => x.isFoe ? x.el : (x.hf || x.el);
async function perform(a, act) {
  if (act.type === 'defend') {
    a.defending = true; log(`${a.name} 擺好架勢防禦。`); sfx('buff');
    S.stage3d && S.stage3d.syncStates(a);
    S.vfx && S.vfx.play('buff', actorStageEl(a), [actorStageEl(a)]);
    await delay(420); return;
  }
  if (act.type === 'item') {
    const it = ITEMS[act.id]; give(act.id, -1);
    log(`${a.name} 使用了「${it.name}」。`);
    const liveT = it.dmg ? act.t.filter(x => x.hp > 0) : act.t;
    const applyFn = async () => {
      if (it.dmg) {
        sfx('fire'); flash('redf');
        S.vfx && S.vfx.play('fire', actorStageEl(a), liveT.map(actorStageEl));
        for (const t of liveT) { const d = Math.round(it.dmg * rnd(0.9, 1.1)); hurt(t, d, a); pop(t.el, '-' + d); }
      } else {
        S.vfx && S.vfx.play('heal', actorStageEl(a), liveT.map(actorStageEl));
        for (const t of liveT) {
          const before = t.hero.hp, bmp = t.hero.mp;
          applyItem(it, [t.hero]);
          if (it.cure) t.st = {};
          if (t.hero.hp > before) pop(t.el, '+' + (t.hero.hp - before), 'heal');
          else if (t.hero.mp > bmp) pop(t.el, '+' + (t.hero.mp - bmp), 'mp');
        }
        sfx('heal'); flash('healf');
      }
    };
    if (S.stage3d && S.stage3d.ok) await S.stage3d.playAction(a, liveT, it.dmg ? 'fire' : 'heal', { fast: G.s.settings.fast }, applyFn);
    else { await applyFn(); await delay(620); }
    return;
  }
  const Sk = SKILLS[act.sk];
  if (!a.isFoe && Sk.mp) a.hero.mp -= Sk.mp;
  // 主機級動態運鏡＋強招／頭目招式全螢幕水墨 Cut-in 特寫
  const isSignature = act.sk !== 'attack' && ((!a.isFoe && ((Sk.mp || 0) >= 8 || ['big', 'thunder', 'water', 'arrow', 'magic'].includes(Sk.fx))) || (a.isFoe && a.boss));
  if (act.sk !== 'attack') {
    log(`${a.name}：「${Sk.name}」！`);
    if (isSignature) await playCutIn(a, Sk.name);
    else showBanner(Sk.name);
  } else {
    log(`${a.name} 發動攻擊。`);
  }

  let targets = act.t.filter(x => Sk.kind === 'revive' ? x.hp <= 0 : x.hp > 0);
  if (!targets.length && (Sk.target === 'enemy')) { const pool = a.isFoe ? alive(S.allies) : alive(S.foes); if (pool.length) targets = [pick(pool)]; }

  const onImpact = async () => {
    const fxs = { thunder: 'thunder', magic: 'thunder', fire: 'fire', water: 'water', arrow: 'arrow', heal: 'heal', buff: 'buff', debuff: 'debuff', big: 'crit', claw: 'hit', sweep: 'slash', multi: 'hit', chain: 'hit', thrust: 'slash', slash: 'slash' };
    sfx(fxs[Sk.fx] || 'hit');
    if (Sk.fx === 'thunder' || Sk.fx === 'magic') flash('thunder');
    else if (Sk.fx === 'big') flash('flash');
    else if (Sk.fx === 'fire') flash('redf');
    if (act.sk.startsWith('t_')) sfx('roar');

    if (S.vfx && targets.length) {
      S.vfx.play(Sk.fx || 'slash', actorStageEl(a), targets.map(actorStageEl));
    }

    switch (Sk.kind) {
      case 'phys': case 'mag': case 'steal': {
        const hits = Sk.hits || 1;
        for (let i = 0; i < hits; i++) {
          let tl = targets;
          if (Sk.rand) { const pool = a.isFoe ? alive(S.allies) : alive(S.foes); if (!pool.length) break; tl = [pick(pool)]; }
          if (i > 0 && S.vfx) S.vfx.play(Sk.fx || 'slash', actorStageEl(a), tl.map(actorStageEl));
          let anyCrit = false;
          for (const t of tl) {
            if (t.hp <= 0) continue;
            const r = calcDamage(a, t, Sk);
            if (r.miss) { pop(t.el, '落空', 'miss'); sfx('miss'); continue; }
            hurt(t, r.dmg, a);
            pop(t.el, (r.crit ? '暴擊 ' : '') + r.dmg, r.crit ? 'crit' : '');
            if (r.crit) { sfx('crit'); anyCrit = true; }
            if (Sk.st && t.hp > 0) applyStatus(t, Sk.st);
            if (Sk.kind === 'steal' && t.isFoe) await steal(a, t);
          }
          if (anyCrit || Sk.fx === 'big' || Sk.fx === 'thunder') {
            setCam('cam-impact');
            if (anyCrit) flash('flash');
          }
          if (hits > 1) await delay(200);
        }
        if (Sk.self) { const d = Math.round(stat(a, 'mhp') * Sk.self); a.hp = Math.max(1, a.hp - d); pop(a.el, '-' + d); }
        break;
      }
      case 'heal': {
        for (const t of targets) {
          const amt = Math.round(Sk.power * (stat(a, 'int') * 3 + stat(a, 'mhp') * 0.08 + 20) * rnd(0.95, 1.05));
          const mhp = stat(t, 'mhp'); const before = t.hp; t.hp = Math.min(mhp, t.hp + amt);
          if (Sk.cure) t.st = {};
          pop(t.el, '+' + (t.hp - before), 'heal');
          if (Sk.buff) addBuffs(t, Sk.buff, Sk.turns);
        }
        flash('healf'); break;
      }
      case 'revive': {
        for (const t of targets) { t.hp = Math.max(1, Math.round(stat(t, 'mhp') * Sk.power)); t.st = {}; pop(t.el, '復活', 'heal'); }
        break;
      }
      case 'buff': {
        for (const t of targets) { addBuffs(t, Sk.buff, Sk.turns); if (Sk.taunt) t.st.taunt = Sk.turns; pop(t.el, '強化', 'mp'); }
        break;
      }
      case 'debuff': {
        for (const t of targets) {
          if (Sk.buff) addBuffs(t, Sk.buff, Sk.turns);
          if (Sk.st) applyStatus(t, Sk.st, true);
          pop(t.el, Sk.buff ? '弱化' : '', 'miss');
        }
        break;
      }
    }
    refresh();
    S.stage3d && S.stage3d.syncStates(a);
  };

  if (S.stage3d && S.stage3d.ok) {
    await S.stage3d.playAction(a, targets, Sk.fx || 'slash', { fast: G.s.settings.fast }, onImpact);
  } else {
    setCam(a.isFoe ? 'cam-foe' : 'cam-hero');
    if (a.isFoe) { a.el.classList.add('act'); setTimeout(() => a.el && a.el.classList.remove('act'), 420); }
    else if (a.hf) { a.hf.classList.add('act'); setTimeout(() => a.hf && a.hf.classList.remove('act'), 460); }
    await delay(act.sk === 'attack' ? 220 : 380);
    await onImpact();
    setTimeout(() => setCam(null), 260);
  }
  // 頭目狂暴
  for (const f of S.foes) if (f.enrage && !f.enraged && f.hp > 0 && f.hp < f.mhp * f.enrage[0]) {
    f.enraged = true; await delay(300); showBanner('狂暴'); log(f.enrage[1]); sfx(f.kind === 'beast' ? 'roar' : 'gong'); flash('redf'); await delay(1100);
  }
  await delay(act.sk === 'attack' ? 420 : 620);
}

function addBuffs(t, buff, turns = 3) {
  for (const [k, m] of Object.entries(buff)) {
    t.buffs = t.buffs.filter(b => !(b.stat === k && (b.mult > 1) === (m > 1)));
    t.buffs.push({ stat: k, mult: m, turns: turns + 1 });
  }
}
function applyStatus(t, [id, chance, turns], show) {
  if (!t.isFoe && id === 'poison' && t.hero.eq.c && ITEMS[t.hero.eq.c].immune === 'poison') return;
  let c = chance; if (t.boss) c *= (id === 'stun' || id === 'sleep') ? 0.35 : 0.6;
  if (Math.random() < c) { t.st[id] = Math.max(t.st[id] || 0, turns); if (show) pop(t.el, STATUS[id].name, 'miss'); }
}
function calcDamage(a, t, Sk) {
  const acc = Sk.acc || 0.95;
  const eva = (0.03 + stat(t, 'luk') * 0.0015) * evaMult(t) + (evaMult(t) > 1 ? 0.12 * (evaMult(t) - 1) * 2 : 0);
  if (acc < 9 && Math.random() > acc - eva) return { miss: true };
  let A, D;
  if (Sk.kind === 'mag') { A = stat(a, 'int') * 1.25 + stat(a, 'atk') * 0.15; D = stat(t, 'int') * 0.6 + stat(t, 'def') * 0.35; }
  else { A = stat(a, 'atk'); D = stat(t, 'def'); }
  let dmg = (Sk.power || 1) * A * A / (A + D) * rnd(0.9, 1.1);
  if (Sk.vs && t.kind === Sk.vs[0]) dmg *= Sk.vs[1];
  const critC = 0.05 + stat(a, 'luk') * 0.004 + (Sk.crit || 0);
  const crit = Math.random() < critC; if (crit) dmg *= 1.6;
  if (t.defending) dmg *= 0.5;
  return { dmg: Math.max(1, Math.round(dmg)), crit };
}
function hurt(t, d, src) {
  t.hp = Math.max(0, t.hp - d);
  if (t.st.sleep && Math.random() < 0.5) t.st.sleep = 0;
  if (t.hp <= 0) { log(`${t.name} 倒下了！`); if (t.isFoe) G.s.kills++; }
}
async function steal(a, t) {
  if (t.stolen) return; t.stolen = true;
  if (t.drop && Math.random() < 0.6) { give(t.drop[0], 1); pop(a.el, '偷得' + ITEMS[t.drop[0]].name, 'heal'); }
  else { const g = 10 + t.lv * 6; G.s.gold += g; pop(a.el, `偷得${g}兩`, 'heal'); }
  sfx('item'); await delay(300);
}

async function victory(foes, allies) {
  G.s.battles++;
  sfx('victory');
  const exp = foes.reduce((s, f) => s + f.exp, 0), gold = foes.reduce((s, f) => s + (f.gold || 0), 0);
  const drops = [];
  for (const f of foes) if (f.drop && Math.random() < f.drop[1]) { give(f.drop[0], 1); drops.push(ITEMS[f.drop[0]].name); }
  G.s.gold += gold;
  const msgs = [];
  const front = allies.map(a => a.hero.id);
  for (const hero of activeParty()) {
    if (hero.hp <= 0) continue;
    msgs.push(...gainExp(hero, front.includes(hero.id) ? exp : Math.floor(exp / 2)));
  }
  if (msgs.some(m => m.includes('升到'))) sfx('levelup');
  await showResult('勝利', [`獲得經驗 ${exp}`, `獲得銀兩 ${gold}`, drops.length ? `戰利品：${drops.join('、')}` : null, ...msgs], [['繼續', 'ok']]);
}
async function defeat(opts) {
  sfx('defeat');
  if (opts.noLose) { await showResult('敗北', ['寡不敵眾……'], [['繼續', 'ok']]); return 'lose'; }
  const r = await showResult('勝敗乃兵家常事', ['全隊倒下了。要重新挑戰嗎？', '（重新挑戰會回到戰鬥開始前的狀態）'], [['重新挑戰', 'retry'], ['放棄', 'lose']]);
  return r;
}
function showResult(title, lines, btns) {
  return new Promise(res => {
    const card = h('div', { class: 'card' }, h('h2', null, title), ...lines.filter(Boolean).map(l => h('p', null, l)),
      h('div', { style: 'display:flex;gap:10px;justify-content:center;margin-top:12px;flex-wrap:wrap' },
        ...btns.map(([t, v]) => h('button', { class: 'pbtn', style: 'min-width:9em;padding:0 16px', onclick: () => { sfx('click'); wrap.remove(); res(v); } }, t))));
    const wrap = h('div', { class: 'b-res' }, card);
    S.el.root.append(wrap);
    const key = e => { if (e.key === 'Enter') { window.removeEventListener('keydown', key); card.querySelector('button').click(); } };
    setTimeout(() => window.addEventListener('keydown', key), 300);
  });
}
