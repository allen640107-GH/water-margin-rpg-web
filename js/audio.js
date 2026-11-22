// WebAudio 自製合成音樂與音效（五聲音階，無外部音檔、無付費 API）
const MUTE_KEY = 'shuihu.mute';
let ctx = null, master = null, musicG = null, sfxG = null;
let muted = false, gestured = false;
try { muted = localStorage.getItem(MUTE_KEY) === '1'; } catch (e) {}
let cur = null, timer = null, nextT = 0, step = 0, seq = null;

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = muted ? 0 : 0.8; master.connect(ctx.destination);
  musicG = ctx.createGain(); musicG.gain.value = 0.32; musicG.connect(master);
  sfxG = ctx.createGain(); sfxG.gain.value = 0.7; sfxG.connect(master);
  return ctx;
}

export function resume() {
  if (!gestured) return;
  const c = ensure(); if (!c) return;
  if (c.state !== 'running' && document.visibilityState !== 'hidden') c.resume().catch(() => {});
  if (cur && !seq) { seq = buildSeq(THEMES[cur] || THEMES.field); step = 0; nextT = c.currentTime + 0.1; }
  if (cur && !timer) startSeq();
}
export function audioState() { return { ctx: ctx ? ctx.state : 'none', cur, t: ctx ? ctx.currentTime : 0, muted, timer: !!timer }; }
export function isMuted() { return muted; }
export function setMuted(m) {
  muted = m; try { localStorage.setItem(MUTE_KEY, m ? '1' : '0'); } catch (e) {}
  if (master) master.gain.setTargetAtTime(m ? 0 : 0.8, ctx.currentTime, 0.05);
}

export function installAudioUnlock() {
  const h = () => { gestured = true; resume(); };
  for (const ev of ['pointerdown', 'touchend', 'keydown', 'click']) window.addEventListener(ev, h, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.visibilityState === 'hidden') { ctx.suspend().catch(() => {}); }
    else resume();
  });
  window.addEventListener('pageshow', () => resume());
}

// ── 樂器 ──
const SCALE = [0, 2, 4, 7, 9]; // 宮商角徵羽
function freq(base, deg, oct = 0) {
  const n = SCALE.length; const o = Math.floor(deg / n) + oct; const d = ((deg % n) + n) % n;
  return base * Math.pow(2, (SCALE[d] + 12 * o) / 12);
}
function pluck(t, f, dur, vol = 0.3, dest = musicG) {
  const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
  o.type = 'triangle'; o2.type = 'sawtooth'; o.frequency.value = f; o2.frequency.value = f * 1.003;
  lp.type = 'lowpass'; lp.frequency.setValueAtTime(f * 6, t); lp.frequency.exponentialRampToValueAtTime(f * 1.2, t + dur);
  const g2 = ctx.createGain(); g2.gain.value = 0.25;
  o.connect(g); o2.connect(g2); g2.connect(g); g.connect(lp); lp.connect(dest);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
}
function flute(t, f, dur, vol = 0.16, dest = musicG) {
  const o = ctx.createOscillator(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
  o.type = 'sine'; o.frequency.value = f; lfo.frequency.value = 5.5; lg.gain.value = f * 0.012;
  lfo.connect(lg); lg.connect(o.frequency);
  o.connect(g); g.connect(dest);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.08); g.gain.setValueAtTime(vol, t + dur * 0.7); g.gain.linearRampToValueAtTime(0.0001, t + dur);
  o.start(t); lfo.start(t); o.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
}
let noiseBuf = null;
function noise() {
  if (noiseBuf) return noiseBuf;
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
}
function drum(t, f = 90, vol = 0.5, dur = 0.25, dest = musicG) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.frequency.setValueAtTime(f * 1.8, t); o.frequency.exponentialRampToValueAtTime(f * 0.6, t + dur);
  o.connect(g); g.connect(dest);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.start(t); o.stop(t + dur + 0.02);
}
function nz(t, dur, vol, type = 'bandpass', f = 2000, q = 1, dest = sfxG, f2) {
  const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noise(); fl.type = type; fl.frequency.setValueAtTime(f, t); if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur); fl.Q.value = q;
  s.connect(fl); fl.connect(g); g.connect(dest);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
}
function wood(t, vol = 0.25, dest = musicG) { nz(t, 0.05, vol, 'bandpass', 1800, 8, dest); }
function gong(t, vol = 0.35) {
  for (const [f, v] of [[110, 1], [167, 0.6], [231, 0.4], [319, 0.25]]) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = f; o.connect(g); g.connect(musicG);
    g.gain.setValueAtTime(vol * v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2); o.start(t); o.stop(t + 2.3);
  }
}

// ── 曲目定義（演算法生成，固定種子使每首曲子穩定）──
const THEMES = {
  title: { base: 220, bpm: 66, inst: 'flute', drone: true, seed: 7, perc: 'none', len: 32 },
  town: { base: 261.6, bpm: 96, inst: 'pluck', drone: false, seed: 11, perc: 'wood', len: 32 },
  field: { base: 293.7, bpm: 104, inst: 'pluck', drone: true, seed: 23, perc: 'light', len: 32 },
  snow: { base: 196, bpm: 72, inst: 'flute', drone: true, seed: 31, perc: 'none', len: 32 },
  dungeon: { base: 174.6, bpm: 84, inst: 'pluck', drone: true, seed: 41, perc: 'slow', len: 32, minor: true },
  water: { base: 246.9, bpm: 88, inst: 'flute', drone: true, seed: 53, perc: 'light', len: 32 },
  battle: { base: 220, bpm: 148, inst: 'pluck', drone: false, seed: 61, perc: 'battle', len: 32, minor: true },
  boss: { base: 164.8, bpm: 160, inst: 'pluck', drone: true, seed: 71, perc: 'boss', len: 32, minor: true },
  hall: { base: 261.6, bpm: 80, inst: 'flute', drone: true, seed: 83, perc: 'wood', len: 32 },
  sad: { base: 196, bpm: 60, inst: 'flute', drone: true, seed: 97, perc: 'none', len: 32, minor: true },
};
function rng(seed) { let s = seed * 9301 + 49297; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; }
function buildSeq(th) {
  const r = rng(th.seed), mel = []; let d = 5;
  for (let i = 0; i < th.len; i++) {
    if (i % 8 === 7 || (i % 4 === 3 && r() < 0.4)) { mel.push(null); continue; }
    d += Math.round((r() - 0.5) * 4); d = Math.max(2, Math.min(10, d));
    if (i % 16 === 15) d = 5; mel.push(d);
  }
  // 第二段重複第一段變奏
  return mel.map((x, i) => (i >= 16 && x != null && i % 3 === 0) ? x + 1 : x);
}
function startSeq() {
  if (!ctx || !cur) return;
  clearInterval(timer); nextT = Math.max(ctx.currentTime + 0.05, nextT);
  timer = setInterval(tick, 90);
}
function tick() {
  if (!ctx || !cur || ctx.state !== 'running') return;
  const th = THEMES[cur], beat = 60 / th.bpm / 2;
  if (nextT < ctx.currentTime - 0.1) nextT = ctx.currentTime + 0.05;
  while (nextT < ctx.currentTime + 0.35) {
    const i = step % th.len, n = seq[i], t = nextT;
    const base = th.minor ? th.base * 0.84 : th.base;
    if (n != null) {
      if (th.inst === 'flute') { if (i % 2 === 0) flute(t, freq(base, n), beat * 2.2); }
      else pluck(t, freq(base, n), beat * 1.8, 0.22);
    }
    if (th.drone && i % 8 === 0) { flute(t, freq(base, 0, -1), beat * 7.5, 0.07); }
    if (!th.drone && i % 4 === 0) pluck(t, freq(base, i % 16 < 8 ? 0 : 3, -1), beat * 3, 0.16);
    switch (th.perc) {
      case 'wood': if (i % 4 === 2) wood(t, 0.12); break;
      case 'light': if (i % 8 === 0) drum(t, 80, 0.18); break;
      case 'slow': if (i % 8 === 0) drum(t, 60, 0.3, 0.5); break;
      case 'battle': if (i % 2 === 0) drum(t, 90, i % 4 === 0 ? 0.42 : 0.2); if (i % 4 === 3) wood(t, 0.15); break;
      case 'boss': if (i % 2 === 0) drum(t, 70, 0.45); if (i % 8 === 6) drum(t, 110, 0.3); if (i % 32 === 0) gong(t, 0.25); break;
    }
    nextT += beat; step++;
  }
}
export function playMusic(name) {
  if (name === cur) return;
  cur = name; step = 0;
  if (!ctx) { seq = null; return; }
  if (!name) { clearInterval(timer); timer = null; return; }
  seq = buildSeq(THEMES[name] || THEMES.field);
  nextT = ctx.currentTime + 0.1;
  musicG.gain.cancelScheduledValues(ctx.currentTime);
  musicG.gain.setValueAtTime(0.0001, ctx.currentTime); musicG.gain.linearRampToValueAtTime(0.32, ctx.currentTime + 0.8);
  startSeq();
}
export function currentMusic() { return cur; }

// ── 音效 ──
export function sfx(name) {
  if (!ctx || ctx.state !== 'running') return;
  const t = ctx.currentTime + 0.01;
  switch (name) {
    case 'click': wood(t, 0.35, sfxG); break;
    case 'hit': nz(t, 0.12, 0.6, 'lowpass', 1200, 1); drum(t, 120, 0.5, 0.12, sfxG); break;
    case 'slash': nz(t, 0.18, 0.5, 'highpass', 6000, 1, sfxG, 1500); break;
    case 'crit': nz(t, 0.2, 0.7, 'lowpass', 2500, 1); drum(t, 90, 0.7, 0.2, sfxG); pluck(t, 880, 0.2, 0.2, sfxG); break;
    case 'miss': nz(t, 0.2, 0.25, 'bandpass', 900, 2, sfxG, 3000); break;
    case 'heal': [0, 2, 4, 7].forEach((d, i) => pluck(t + i * 0.07, freq(523, d), 0.4, 0.2, sfxG)); break;
    case 'buff': [0, 2, 4].forEach((d, i) => flute(t + i * 0.06, freq(392, d + i), 0.25, 0.18, sfxG)); break;
    case 'debuff': [4, 2, 0].forEach((d, i) => flute(t + i * 0.08, freq(330, d), 0.25, 0.16, sfxG)); break;
    case 'magic': case 'thunder': nz(t, 0.6, 0.6, 'lowpass', 600, 1, sfxG, 120); drum(t, 50, 0.6, 0.6, sfxG); nz(t, 0.15, 0.5, 'highpass', 4000, 1, sfxG); break;
    case 'fire': nz(t, 0.5, 0.45, 'bandpass', 800, 0.7, sfxG, 300); break;
    case 'water': nz(t, 0.4, 0.4, 'lowpass', 1500, 2, sfxG, 300); break;
    case 'arrow': { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(2400, t); o.frequency.exponentialRampToValueAtTime(700, t + 0.18); o.connect(g); g.connect(sfxG); g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2); o.start(t); o.stop(t + 0.22); break; }
    case 'roar': { const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter(); o.type = 'sawtooth'; o.frequency.setValueAtTime(90, t); o.frequency.linearRampToValueAtTime(60, t + 0.9); f.type = 'lowpass'; f.frequency.value = 500; o.connect(f); f.connect(g); g.connect(sfxG); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.5, t + 0.1); g.gain.exponentialRampToValueAtTime(0.0001, t + 1); o.start(t); o.stop(t + 1.05); nz(t, 0.9, 0.3, 'lowpass', 400, 1); break; }
    case 'chest': case 'item': [0, 4, 7, 9].forEach((d, i) => pluck(t + i * 0.06, freq(659, d % 5), 0.3, 0.18, sfxG)); break;
    case 'levelup': [0, 1, 2, 3, 4, 5].forEach((d, i) => pluck(t + i * 0.08, freq(392, d), 0.35, 0.22, sfxG)); break;
    case 'victory': [0, 2, 4, 5, 7].forEach((d, i) => pluck(t + i * 0.12, freq(392, d), 0.5, 0.25, sfxG)); drum(t, 80, 0.4, 0.3, sfxG); break;
    case 'defeat': [4, 3, 2, 0].forEach((d, i) => flute(t + i * 0.25, freq(262, d), 0.4, 0.2, sfxG)); break;
    case 'gong': gong(t, 0.4); break;
    case 'door': drum(t, 140, 0.3, 0.15, sfxG); wood(t + 0.08, 0.3, sfxG); break;
    case 'push': drum(t, 60, 0.4, 0.25, sfxG); nz(t, 0.25, 0.3, 'lowpass', 500, 1); break;
    case 'switch': wood(t, 0.4, sfxG); wood(t + 0.1, 0.3, sfxG); break;
    case 'encounter': drum(t, 100, 0.5, 0.2, sfxG); drum(t + 0.15, 100, 0.5, 0.2, sfxG); pluck(t + 0.3, 220, 0.4, 0.25, sfxG); break;
    case 'step': break;
  }
}
