// FF7/FF8 Remaster 風格 3D 精緻雕塑骨架角色與猛獸模型系統（Three.js）
// 採用 6.5 頭身武俠英雄比例、LatheGeometry 雕塑身形、多片動態衣襬、ExtrudeGeometry 精緻兵器與四足猛獸真實彎肢骨架
import * as THREE from './vendor/three.module.min.js';

const texCache = new Map();
function makeCanvasTex(key, w, h, drawFn) {
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  drawFn(g, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  texCache.set(key, tex);
  return tex;
}

function getFaceTex(cfg) {
  const key = 'face2:' + (cfg.skin || '#e2be98') + ':' + (cfg.beard || 'none') + ':' + (cfg.mark || 'none') + ':' + (cfg.female ? 'f' : 'm') + ':' + (cfg.fierce ? '1' : '0');
  return makeCanvasTex(key, 128, 128, (g, w, h) => {
    g.fillStyle = cfg.skin || '#e0bc96'; g.fillRect(0, 0, w, h);
    const sh = g.createRadialGradient(w * 0.5, h * 0.44, 8, w * 0.5, h * 0.52, w * 0.56);
    sh.addColorStop(0, 'rgba(255,248,236,0.2)');
    sh.addColorStop(1, 'rgba(55,28,14,0.28)');
    g.fillStyle = sh; g.fillRect(0, 0, w, h);

    if (cfg.mark === 'blue') {
      g.fillStyle = 'rgba(38,104,122,0.72)';
      g.beginPath(); g.ellipse(w * 0.67, h * 0.56, 15, 20, 0.2, 0, 6.28); g.fill();
    } else if (cfg.mark === 'red') {
      g.fillStyle = 'rgba(178,34,26,0.76)';
      g.beginPath(); g.ellipse(w * 0.67, h * 0.53, 13, 17, -0.2, 0, 6.28); g.fill();
    }

    // 細緻古風劍眉與雙眼
    g.strokeStyle = '#18120e'; g.lineWidth = cfg.female ? 3 : 4.2; g.lineCap = 'round';
    const by = h * 0.39;
    g.beginPath(); g.moveTo(w * 0.27, by - (cfg.fierce ? 4 : 1)); g.lineTo(w * 0.45, by + (cfg.fierce ? 3.5 : 1)); g.stroke();
    g.beginPath(); g.moveTo(w * 0.73, by - (cfg.fierce ? 4 : 1)); g.lineTo(w * 0.55, by + (cfg.fierce ? 3.5 : 1)); g.stroke();

    for (const ex of [w * 0.37, w * 0.63]) {
      g.fillStyle = '#fffbf4';
      g.beginPath(); g.ellipse(ex, h * 0.49, 7.5, cfg.female ? 5 : 4.2, 0, 0, 6.28); g.fill();
      g.fillStyle = '#14100d';
      g.beginPath(); g.arc(ex, h * 0.49, 3.7, 0, 6.28); g.fill();
      g.fillStyle = '#ffffff';
      g.beginPath(); g.arc(ex - 1.4, h * 0.475, 1.3, 0, 6.28); g.fill();
    }
    g.strokeStyle = 'rgba(90,52,32,0.45)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(w * 0.5, h * 0.49); g.lineTo(w * 0.485, h * 0.61); g.lineTo(w * 0.525, h * 0.62); g.stroke();

    g.strokeStyle = cfg.female ? '#a82c2c' : '#582e20'; g.lineWidth = cfg.female ? 4 : 3;
    g.beginPath();
    if (cfg.fierce) {
      g.fillStyle = '#3a1410'; g.ellipse(w * 0.5, h * 0.72, 10, 5.5, 0, 0, 6.28); g.fill();
    } else {
      g.moveTo(w * 0.43, h * 0.71); g.quadraticCurveTo(w * 0.5, h * 0.735, w * 0.57, h * 0.71); g.stroke();
    }

    g.fillStyle = cfg.hair || '#181412';
    if (cfg.beard === 'full') {
      g.beginPath();
      g.moveTo(w * 0.22, h * 0.57); g.quadraticCurveTo(w * 0.24, h * 0.96, w * 0.5, h * 0.98);
      g.quadraticCurveTo(w * 0.76, h * 0.96, w * 0.78, h * 0.57); g.lineTo(w * 0.7, h * 0.65);
      g.quadraticCurveTo(w * 0.5, h * 0.69, w * 0.3, h * 0.65); g.closePath(); g.fill();
    } else if (cfg.beard === 'goatee') {
      g.strokeStyle = '#181412'; g.lineWidth = 3.5;
      g.beginPath(); g.moveTo(w * 0.37, h * 0.67); g.quadraticCurveTo(w * 0.5, h * 0.635, w * 0.63, h * 0.67); g.stroke();
      g.beginPath(); g.moveTo(w * 0.42, h * 0.76); g.lineTo(w * 0.58, h * 0.76); g.lineTo(w * 0.5, h * 0.94); g.closePath(); g.fill();
    } else if (cfg.beard === 'stache') {
      g.strokeStyle = '#181412'; g.lineWidth = 3.2;
      g.beginPath(); g.moveTo(w * 0.37, h * 0.67); g.quadraticCurveTo(w * 0.5, h * 0.635, w * 0.63, h * 0.67); g.stroke();
    }
  });
}

function getTorsoTex(baseHex, accentHex, pattern) {
  return makeCanvasTex(`torso2:${baseHex}:${accentHex}:${pattern}`, 128, 128, (g, w, h) => {
    g.fillStyle = baseHex; g.fillRect(0, 0, w, h);
    // 細布紋陰影層次
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, 'rgba(255,255,255,0.12)');
    gr.addColorStop(0.5, 'rgba(0,0,0,0)');
    gr.addColorStop(1, 'rgba(0,0,0,0.28)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);

    // 交領衣襟與金線滾邊
    g.strokeStyle = accentHex; g.lineWidth = 6;
    g.beginPath(); g.moveTo(w * 0.25, 0); g.lineTo(w * 0.62, h * 0.68); g.stroke();
    g.beginPath(); g.moveTo(w * 0.75, 0); g.lineTo(w * 0.48, h * 0.46); g.stroke();

    if (pattern === 'armor') {
      g.strokeStyle = 'rgba(18,22,28,0.58)'; g.lineWidth = 1.6;
      for (let y = 10; y < h - 22; y += 11) {
        for (let x = 6; x < w - 6; x += 13) {
          g.fillStyle = (x + y) % 24 === 0 ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.15)';
          g.fillRect(x, y, 11, 9); g.strokeRect(x, y, 11, 9);
        }
      }
    } else if (pattern === 'taiji') {
      const cx = w * 0.5, cy = h * 0.42, r = 21;
      g.fillStyle = '#f2ede0'; g.beginPath(); g.arc(cx, cy, r, 0, 6.28); g.fill();
      g.fillStyle = '#181818'; g.beginPath(); g.arc(cx, cy, r, -Math.PI / 2, Math.PI / 2); g.fill();
      g.fillStyle = '#f2ede0'; g.beginPath(); g.arc(cx, cy - r / 2, r / 2, 0, 6.28); g.fill();
      g.fillStyle = '#181818'; g.beginPath(); g.arc(cx, cy + r / 2, r / 2, 0, 6.28); g.fill();
      g.fillStyle = '#181818'; g.beginPath(); g.arc(cx, cy - r / 2, 3.6, 0, 6.28); g.fill();
      g.fillStyle = '#f2ede0'; g.beginPath(); g.arc(cx, cy + r / 2, 3.6, 0, 6.28); g.fill();
      g.strokeStyle = '#1a1816'; g.lineWidth = 2.5; g.beginPath(); g.arc(cx, cy, r, 0, 6.28); g.stroke();
    } else if (pattern === 'tattoo') {
      g.strokeStyle = 'rgba(24,42,48,0.72)'; g.lineWidth = 2.2;
      for (let i = 0; i < 6; i++) {
        const a = i * 1.05;
        g.beginPath(); g.arc(w * 0.28 + Math.cos(a) * 9, h * 0.34 + Math.sin(a) * 9, 6.5, 0, 6.28); g.stroke();
      }
      g.fillStyle = '#2a221d';
      g.beginPath(); g.moveTo(w * 0.52, 0); g.lineTo(w, 0); g.lineTo(w, h); g.lineTo(w * 0.14, h); g.closePath(); g.fill();
    } else if (pattern === 'bare') {
      g.fillStyle = accentHex;
      g.fillRect(0, 0, w * 0.26, h); g.fillRect(w * 0.74, 0, w * 0.26, h);
      g.strokeStyle = 'rgba(70,35,18,0.45)'; g.lineWidth = 2.5;
      g.beginPath(); g.arc(w * 0.39, h * 0.36, 11, 0.2, 2.9); g.stroke();
      g.beginPath(); g.arc(w * 0.61, h * 0.36, 11, 0.2, 2.9); g.stroke();
    }
    // 束腰革帶與雕花銅扣
    g.fillStyle = accentHex; g.fillRect(0, h * 0.78, w, h * 0.16);
    g.fillStyle = '#dfb85c'; g.fillRect(w * 0.43, h * 0.77, w * 0.14, h * 0.18);
  });
}

function getBeastTex(baseHex, stripeHex, kind) {
  return makeCanvasTex(`beast2:${baseHex}:${stripeHex}:${kind}`, 128, 128, (g, w, h) => {
    g.fillStyle = baseHex; g.fillRect(0, 0, w, h);
    const sh = g.createLinearGradient(0, 0, 0, h);
    sh.addColorStop(0, 'rgba(255,245,220,0.14)');
    sh.addColorStop(1, 'rgba(0,0,0,0.34)');
    g.fillStyle = sh; g.fillRect(0, 0, w, h);
    if (kind === 'tiger') {
      g.fillStyle = stripeHex;
      for (let y = 6; y < h; y += 18) {
        g.beginPath(); g.moveTo(0, y); g.quadraticCurveTo(w * 0.5, y + 7, w, y - 3);
        g.lineTo(w, y + 6); g.quadraticCurveTo(w * 0.5, y + 13, 0, y + 8); g.closePath(); g.fill();
      }
    } else if (kind === 'leopard') {
      g.strokeStyle = stripeHex; g.lineWidth = 2.8;
      for (let i = 0; i < 24; i++) { g.beginPath(); g.arc((i * 37) % w, (i * 53) % h, 6.5, 0, 6.28); g.stroke(); }
    } else if (kind === 'snake') {
      g.fillStyle = stripeHex;
      for (let y = 0; y < h; y += 14) for (let x = 0; x < w; x += 14) {
        g.beginPath(); g.moveTo(x + 7, y); g.lineTo(x + 14, y + 7); g.lineTo(x + 7, y + 14); g.lineTo(x, y + 7); g.closePath(); g.fill();
      }
    } else {
      g.strokeStyle = 'rgba(0,0,0,0.22)'; g.lineWidth = 2;
      for (let i = 0; i < 70; i++) {
        const x = (i * 29) % w, y = (i * 41) % h;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + 10, y + 3); g.stroke();
      }
    }
  });
}

// ── 15 位好漢與敵獸頭目外觀表 ──
const HERO_STYLE = {
  linchong:     { coat: '#212c45', trim: '#8fa2be', pants: '#c4ba9f', cape: '#182138', skin: '#e0bc96', hair: '#151313', beard: 'goatee', head: 'headband', weapon: 'spear',      pattern: 'armor',  scale: 1.04 },
  luzhishen:    { coat: '#d4a178', trim: '#a6261e', pants: '#7e4824', cape: null,      skin: '#d6a076', hair: '#181412', beard: 'full',   head: 'bald',     weapon: 'staff',      pattern: 'tattoo', scale: 1.15, beads: true, fierce: true },
  wusong:       { coat: '#3c2a21', trim: '#a82820', pants: '#2d231d', cape: null,      skin: '#dba982', hair: '#141212', beard: 'none',   head: 'circlet',  weapon: 'twinsaber',  pattern: 'cloth',  scale: 1.06, gourd: true },
  chaogai:      { coat: '#6e1c1a', trim: '#c7a050', pants: '#24201d', cape: '#5b1514', skin: '#d8a982', hair: '#161312', beard: 'full',   head: 'headband', weapon: 'broadsword', pattern: 'cloth',  scale: 1.12, fur: true },
  wuyong:       { coat: '#7fa0b5', trim: '#5c4128', pants: '#4a5a68', cape: null,      skin: '#e5c6a8', hair: '#161414', beard: 'goatee', head: 'scholar',  weapon: 'fan',        pattern: 'cloth',  scale: 1.00 },
  gongsunsheng: { coat: '#9ca4aa', trim: '#2c3035', pants: '#6d747a', cape: '#808890', skin: '#e0c09e', hair: '#151414', beard: 'full',   head: 'taoist',   weapon: 'taoist',     pattern: 'taiji',  scale: 1.04 },
  ruanxiaoqi:   { coat: '#3b4a36', trim: '#70583c', pants: '#2b2824', cape: null,      skin: '#c48f64', hair: '#151312', beard: 'stache', head: 'topknot',  weapon: 'trident',    pattern: 'cloth',  scale: 1.02, bambooHat: true, fierce: true },
  liutang:      { coat: '#4f3a2a', trim: '#281e18', pants: '#25211e', cape: null,      skin: '#cb946a', hair: '#b01c16', beard: 'full',   head: 'wildhair', weapon: 'pudao',      pattern: 'bare',   scale: 1.08, mark: 'red', fierce: true },
  yangzhi:      { coat: '#264432', trim: '#5c646c', pants: '#222b38', cape: null,      skin: '#ddb892', hair: '#161414', beard: 'goatee', head: 'helmet',   weapon: 'broadsword', pattern: 'armor',  scale: 1.06, mark: 'blue', helmetColor: '#434a52' },
  songjiang:    { coat: '#2a563b', trim: '#b42820', pants: '#262320', cape: null,      skin: '#ddb690', hair: '#161414', beard: 'goatee', head: 'official', weapon: 'sword',      pattern: 'cloth',  scale: 1.00 },
  likui:        { coat: '#b57b52', trim: '#1a1818', pants: '#1a1818', cape: null,      skin: '#b87c52', hair: '#121010', beard: 'full',   head: 'wildhair', weapon: 'twinaxe',    pattern: 'bare',   scale: 1.15, redSash: true, fierce: true },
  huarong:      { coat: '#c8d0da', trim: '#9c201a', pants: '#b4bcc6', cape: '#9e1f18', skin: '#ebd0b6', hair: '#161414', beard: 'none',   head: 'helmet',   weapon: 'bow',        pattern: 'armor',  scale: 1.05, helmetColor: '#d4dce6' },
  sunerniang:   { coat: '#3c5238', trim: '#a62420', pants: '#221e1d', cape: '#9c2420', skin: '#e6c2a2', hair: '#181414', beard: 'none',   head: 'peony',    weapon: 'cleaver',    pattern: 'cloth',  scale: 0.97, female: true },
  zhangshun:    { coat: '#b6c6d0', trim: '#2e5874', pants: '#a4b4be', cape: null,      skin: '#ecd2bc', hair: '#151414', beard: 'none',   head: 'ponytail', weapon: 'twindagger', pattern: 'cloth',  scale: 1.01 },
  shiqian:      { coat: '#1c1b1d', trim: '#6b5538', pants: '#181719', cape: null,      skin: '#d9b490', hair: '#141212', beard: 'stache', head: 'hood',     weapon: 'dagger',     pattern: 'cloth',  scale: 0.96 },
};

const FOE_STYLE = {
  thug:     { coat: '#363234', trim: '#88423a', pants: '#2b292c', skin: '#d4a47c', hair: '#181412', beard: 'none',   head: 'topknot',  weapon: 'club',       pattern: 'bare',  scale: 1.02, fierce: true },
  bandit:   { coat: '#4a3525', trim: '#8a2820', pants: '#2c241d', skin: '#cfa078', hair: '#181412', beard: 'full',   head: 'headband', weapon: 'broadsword', pattern: 'cloth', scale: 1.04, fierce: true },
  soldier:  { coat: '#6e2320', trim: '#4e545c', pants: '#282628', skin: '#d8b08a', hair: '#181412', beard: 'stache', head: 'helmet',   weapon: 'spear',      pattern: 'armor', scale: 1.04, helmetColor: '#565c64' },
  armored:  { coat: '#383e48', trim: '#c8a048', pants: '#242830', skin: '#d6ae88', hair: '#181412', beard: 'full',   head: 'helmet',   weapon: 'broadsword', pattern: 'armor', scale: 1.14, helmetColor: '#3e4652' },
  archer:   { coat: '#3d4c34', trim: '#7c5c34', pants: '#2b2c26', skin: '#d8b28c', hair: '#181412', beard: 'none',   head: 'headband', weapon: 'bow',        pattern: 'cloth', scale: 1.00 },
  yamen:    { coat: '#242834', trim: '#a62c24', pants: '#1d1e24', skin: '#d8b28e', hair: '#181412', beard: 'stache', head: 'official', weapon: 'club',       pattern: 'cloth', scale: 1.02 },
  militia:  { coat: '#5c4e38', trim: '#823426', pants: '#342c22', skin: '#d4aa82', hair: '#181412', beard: 'none',   head: 'headband', weapon: 'spear',      pattern: 'cloth', scale: 1.00 },
  pirate:   { coat: '#2a404c', trim: '#9e3828', pants: '#20262c', skin: '#c8966c', hair: '#161412', beard: 'full',   head: 'headband', weapon: 'broadsword', pattern: 'bare',  scale: 1.04, fierce: true },
  b_luqian:       { coat: '#4c1e24', trim: '#d2aa52', pants: '#261e22', cape: '#3a141a', skin: '#dfc0a0', hair: '#151313', beard: 'goatee', head: 'official', weapon: 'sword',      pattern: 'armor', scale: 1.12 },
  b_ximenqing:    { coat: '#6c2444', trim: '#e0be64', pants: '#2c1e2a', cape: '#521834', skin: '#ebd0b8', hair: '#151313', beard: 'stache', head: 'scholar',  weapon: 'fan',        pattern: 'cloth', scale: 1.08 },
  b_jiangmenshen: { coat: '#3e2620', trim: '#b43424', pants: '#241a16', skin: '#cf9870', hair: '#161212', beard: 'full',   head: 'headband', weapon: 'twinaxe',    pattern: 'bare',  scale: 1.24, fierce: true },
  b_wanglun:      { coat: '#4a5c4a', trim: '#c8a454', pants: '#283028', skin: '#e4c8ac', hair: '#181616', beard: 'goatee', head: 'scholar',  weapon: 'sword',      pattern: 'cloth', scale: 1.06 },
  b_huangwenbing: { coat: '#542632', trim: '#c8a24a', pants: '#241c20', skin: '#dfc2a4', hair: '#181616', beard: 'stache', head: 'official', weapon: 'sword',      pattern: 'cloth', scale: 1.06 },
  b_denglong:     { coat: '#48281c', trim: '#c48a34', pants: '#281d18', cape: '#381c14', skin: '#cc966e', hair: '#161210', beard: 'full',   head: 'helmet',   weapon: 'broadsword', pattern: 'armor', scale: 1.20, fierce: true, helmetColor: '#5c4028' },
  b_zhubiao:      { coat: '#1e283c', trim: '#d6aa4a', pants: '#1a202c', cape: '#8c1c18', skin: '#e2c09e', hair: '#151313', beard: 'none',   head: 'helmet',   weapon: 'spear',      pattern: 'armor', scale: 1.18, helmetColor: '#3c4452' },
  b_luantingyu:   { coat: '#2e2420', trim: '#d8b256', pants: '#1f1a18', cape: '#6e1a16', skin: '#d8b08a', hair: '#161414', beard: 'full',   head: 'helmet',   weapon: 'club',       pattern: 'armor', scale: 1.22, helmetColor: '#4c4640' },
  b_commander:    { coat: '#6e1818', trim: '#e6c05e', pants: '#241818', cape: '#5c1212', skin: '#dcba96', hair: '#181616', beard: 'full',   head: 'helmet',   weapon: 'broadsword', pattern: 'armor', scale: 1.22, helmetColor: '#7a5c28' },
  tiger:   { beast: 'quad', kind: 'tiger',   base: '#dc8422', stripe: '#1a120a', belly: '#f2dfc2', scale: 1.44 },
  b_tiger: { beast: 'quad', kind: 'tiger',   base: '#e28820', stripe: '#181008', belly: '#f4e2c6', scale: 1.56 },
  wolf:    { beast: 'quad', kind: 'wolf',    base: '#686e78', stripe: '#383d46', belly: '#bec4cc', scale: 1.04 },
  leopard: { beast: 'quad', kind: 'leopard', base: '#d4a244', stripe: '#2c1e0e', belly: '#efe0be', scale: 1.08 },
  boar:    { beast: 'quad', kind: 'boar',    base: '#543f34', stripe: '#2a1e18', belly: '#685246', scale: 1.05, tusks: true },
  dog:     { beast: 'quad', kind: 'dog',     base: '#88603c', stripe: '#422c18', belly: '#c6a47e', scale: 0.90 },
  snake:   { beast: 'snake', kind: 'snake',  base: '#3a6e38', stripe: '#1c381a', belly: '#b4c886', scale: 1.04 },
};

// 細緻水墨輪廓線（輕薄不死黑）
const outlineMat = new THREE.MeshBasicMaterial({ color: 0x140f0a, side: THREE.BackSide });
function makePart(geo, mat, opts = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = opts.shadow !== false;
  m.receiveShadow = opts.receive !== false;
  if (opts.outline !== false) {
    const out = new THREE.Mesh(geo, outlineMat);
    const s = opts.outlineScale || 1.028;
    out.scale.set(s, s, s);
    out.castShadow = false; out.receiveShadow = false;
    m.add(out);
  }
  return m;
}
function stdMat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.68,
    metalness: opts.metalness ?? 0.1,
    map: opts.map || null,
    emissive: opts.emissive || 0x000000,
    emissiveIntensity: opts.emissiveIntensity || 0,
    side: opts.doubleSide ? THREE.DoubleSide : THREE.FrontSide,
  });
}

// ── 雕塑級 3D 兵器（細長刀身、優美反曲弓、紅纓點鋼槍、半月禪杖） ──
function makeCurvedBladeGeo(length = 0.95, width = 0.11, curve = 0.08) {
  const sh = new THREE.Shape();
  sh.moveTo(0, 0);
  sh.quadraticCurveTo(curve, length * 0.55, 0.02, length);
  sh.lineTo(-width * 0.35, length * 0.86);
  sh.quadraticCurveTo(curve - width, length * 0.45, -width * 0.65, 0);
  sh.closePath();
  return new THREE.ExtrudeGeometry(sh, { depth: 0.018, bevelEnabled: true, bevelThickness: 0.005, bevelSize: 0.005, bevelSegments: 2 });
}

function buildWeapon(kind) {
  const g = new THREE.Group();
  const steel = stdMat(0xe4ecf4, { roughness: 0.22, metalness: 0.86 });
  const darkSteel = stdMat(0x4e5662, { roughness: 0.32, metalness: 0.78 });
  const wood = stdMat(0x5c361a, { roughness: 0.76 });
  const gold = stdMat(0xe4b852, { roughness: 0.26, metalness: 0.82 });
  const red = stdMat(0xc4241a, { roughness: 0.72 });

  if (kind === 'spear' || kind === 'trident') {
    const shaft = makePart(new THREE.CylinderGeometry(0.02, 0.024, 2.35, 8), wood, { outline: false });
    shaft.position.y = 0.62;
    const collar = makePart(new THREE.CylinderGeometry(0.032, 0.026, 0.1, 8), gold, { outline: false });
    collar.position.y = 1.78;
    const tip = makePart(new THREE.ConeGeometry(0.048, 0.4, 6), steel, { outline: false });
    tip.position.y = 2.02;
    const tassel = makePart(new THREE.ConeGeometry(0.068, 0.22, 8), red, { outline: false });
    tassel.rotation.x = Math.PI; tassel.position.y = 1.66;
    g.add(shaft, collar, tip, tassel);
    if (kind === 'trident') {
      for (const sx of [-0.095, 0.095]) {
        const pr = makePart(new THREE.ConeGeometry(0.028, 0.26, 5), steel, { outline: false });
        pr.position.set(sx, 1.96, 0); pr.rotation.z = sx > 0 ? -0.28 : 0.28;
        g.add(pr);
      }
    }
  } else if (kind === 'staff') {
    const shaft = makePart(new THREE.CylinderGeometry(0.028, 0.028, 2.25, 8), darkSteel, { outline: false });
    shaft.position.y = 0.58;
    const shovel = makePart(makeCurvedBladeGeo(0.32, 0.18, 0.02), steel, { outline: false });
    shovel.position.set(0.04, 1.68, -0.01);
    const moon = makePart(new THREE.TorusGeometry(0.11, 0.02, 6, 14, Math.PI * 1.15), steel, { outline: false });
    moon.position.set(0, -0.58, 0); moon.rotation.z = Math.PI * 0.92;
    g.add(shaft, shovel, moon);
  } else if (kind === 'broadsword' || kind === 'pudao') {
    const hLen = kind === 'pudao' ? 0.92 : 0.34;
    const handle = makePart(new THREE.CylinderGeometry(0.022, 0.024, hLen, 8), wood, { outline: false });
    handle.position.y = hLen * 0.28;
    const guard = makePart(new THREE.CylinderGeometry(0.08, 0.08, 0.03, 10), gold, { outline: false });
    guard.position.y = hLen * 0.78;
    const blade = makePart(makeCurvedBladeGeo(1.06, 0.13, 0.09), steel, { outline: false });
    blade.position.set(0.03, hLen * 0.78, -0.01);
    g.add(handle, guard, blade);
  } else if (kind === 'sword' || kind === 'taoist') {
    const handle = makePart(new THREE.CylinderGeometry(0.018, 0.02, 0.26, 8), wood, { outline: false });
    handle.position.y = 0.08;
    const guard = makePart(new THREE.BoxGeometry(0.18, 0.035, 0.045), gold, { outline: false });
    guard.position.y = 0.22;
    const blade = makePart(makeCurvedBladeGeo(1.02, 0.065, 0.0), steel, { outline: false });
    blade.position.set(0.01, 0.23, -0.01);
    g.add(handle, guard, blade);
  } else if (kind === 'twinaxe') {
    const handle = makePart(new THREE.CylinderGeometry(0.024, 0.024, 0.82, 8), wood, { outline: false });
    handle.position.y = 0.32;
    const blade = makePart(makeCurvedBladeGeo(0.32, 0.22, 0.08), steel, { outline: false });
    blade.rotation.z = -Math.PI / 2; blade.position.set(0.02, 0.72, -0.01);
    g.add(handle, blade);
  } else if (kind === 'bow') {
    // 細緻宋代反曲寶弓（纖細優雅弧線＋金弓梢＋弦＋羽箭）
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.62, -0.08),
      new THREE.Vector3(0, -0.34, 0.16),
      new THREE.Vector3(0, 0.0, 0.06),
      new THREE.Vector3(0, 0.34, 0.16),
      new THREE.Vector3(0, 0.62, -0.08),
    ]);
    const bow = makePart(new THREE.TubeGeometry(curve, 24, 0.019, 8, false), darkSteel, { outline: false });
    const grip = makePart(new THREE.CylinderGeometry(0.024, 0.024, 0.18, 8), gold, { outline: false });
    grip.position.set(0, 0, 0.06);
    const str = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 1.24, 4), stdMat(0xf5ecdc));
    str.position.set(0, 0, -0.08);
    const arrow = makePart(new THREE.CylinderGeometry(0.01, 0.01, 0.96, 6), wood, { outline: false });
    arrow.rotation.x = Math.PI / 2; arrow.position.set(0, 0.02, 0.18);
    const head = makePart(new THREE.ConeGeometry(0.024, 0.09, 4), steel, { outline: false });
    head.rotation.x = Math.PI / 2; head.position.set(0, 0.02, 0.68);
    g.add(bow, grip, str, arrow, head);
  } else if (kind === 'fan') {
    const h = makePart(new THREE.CylinderGeometry(0.014, 0.016, 0.22, 6), wood, { outline: false });
    h.position.y = 0.08;
    const f = makePart(new THREE.CylinderGeometry(0.24, 0.04, 0.38, 12), stdMat(0xf2efe8, { roughness: 0.85 }), { outline: false });
    f.scale.set(1, 1, 0.12); f.position.y = 0.36;
    g.add(h, f);
  } else if (kind === 'cleaver') {
    const h = makePart(new THREE.CylinderGeometry(0.02, 0.02, 0.2, 6), wood, { outline: false });
    const b = makePart(new THREE.BoxGeometry(0.15, 0.38, 0.016), steel, { outline: false });
    b.position.set(0.03, 0.28, 0);
    g.add(h, b);
  } else if (kind === 'club') {
    const c = makePart(new THREE.CylinderGeometry(0.048, 0.024, 1.25, 8), darkSteel, { outline: false });
    c.position.y = 0.54;
    const head = makePart(new THREE.OctahedronGeometry(0.095, 1), darkSteel, { outline: false });
    head.position.y = 1.15;
    g.add(c, head);
  } else {
    const h = makePart(new THREE.CylinderGeometry(0.018, 0.02, 0.2, 6), wood, { outline: false });
    const guard = makePart(new THREE.BoxGeometry(0.11, 0.03, 0.035), gold, { outline: false });
    guard.position.y = 0.12;
    const b = makePart(makeCurvedBladeGeo(kind === 'twinsaber' ? 0.68 : 0.44, 0.07, 0.05), steel, { outline: false });
    b.position.set(0.02, 0.13, -0.01);
    g.add(h, guard, b);
  }
  return g;
}

// ── 6.5 頭身 FF8 風格雕塑人形骨架建構器 ──
const torsoProfile = [
  new THREE.Vector2(0.0, 0.0),
  new THREE.Vector2(0.17, 0.02),   // 窄腰
  new THREE.Vector2(0.185, 0.16),
  new THREE.Vector2(0.245, 0.44),  // 挺拔胸廓
  new THREE.Vector2(0.265, 0.56),  // 寬肩
  new THREE.Vector2(0.14, 0.62),   // 領口
  new THREE.Vector2(0.0, 0.63),
];
const torsoLatheGeo = new THREE.LatheGeometry(torsoProfile, 14);

function buildHumanoidRig(cfg, isFoe) {
  const root = new THREE.Group();
  const s = cfg.scale || 1.0;
  const body = new THREE.Group();
  body.scale.set(s, s, s);
  root.add(body);

  const skinMat = stdMat(cfg.skin || '#deb892', { roughness: 0.72 });
  const coatMat = stdMat(0xffffff, { map: getTorsoTex(cfg.coat, cfg.trim || '#b02820', cfg.pattern || 'cloth'), roughness: 0.68 });
  const sleeveMat = stdMat(cfg.pattern === 'bare' ? cfg.skin : cfg.coat, { roughness: 0.72 });
  const pantsMat = stdMat(cfg.pants || '#252220', { roughness: 0.8 });
  const bootMat = stdMat('#1f1812', { roughness: 0.72 });
  const trimMat = stdMat(cfg.trim || '#a6261e', { roughness: 0.62 });
  const hairMat = stdMat(cfg.hair || '#151210', { roughness: 0.82 });

  // 骨盆（修長腿長比例：骨盆高度 1.04m）
  const pelvis = new THREE.Group();
  pelvis.position.y = 1.04;
  body.add(pelvis);

  const hipMesh = makePart(new THREE.CylinderGeometry(0.175, 0.19, 0.18, 12), pantsMat);
  pelvis.add(hipMesh);

  // 四片式開衩動態戰袍下襬（前後左右各自擺動，不再是僵硬燈罩！）
  const robeMat = stdMat(cfg.coat, { roughness: 0.78, doubleSide: true });
  const flapF = new THREE.Group(); flapF.position.set(0, -0.02, 0.17);
  const flapB = new THREE.Group(); flapB.position.set(0, -0.02, -0.17);
  const fGeo = new THREE.PlaneGeometry(0.32, 0.56); fGeo.translate(0, -0.28, 0);
  flapF.add(makePart(fGeo, robeMat, { outline: false }));
  flapB.add(makePart(fGeo, robeMat, { outline: false }));
  pelvis.add(flapF, flapB);

  // 挺拔雕塑上身
  const spine = new THREE.Group();
  spine.position.y = 0.06;
  pelvis.add(spine);

  const torso = makePart(torsoLatheGeo, coatMat);
  const wScale = cfg.female ? 0.82 : (cfg.scale > 1.12 ? 1.15 : 0.96);
  torso.scale.set(wScale, 1.0, 0.78);
  spine.add(torso);

  // 頸部
  const neck = makePart(new THREE.CylinderGeometry(0.058, 0.068, 0.12, 10), skinMat, { outline: false });
  neck.position.y = 0.65;
  spine.add(neck);

  // 肩甲／毛領／佛珠／斗笠／酒葫蘆
  const shoulderX = 0.26 * wScale;
  if (cfg.pattern === 'armor') {
    const armorMat = stdMat(cfg.helmetColor || '#707d8e', { roughness: 0.28, metalness: 0.75 });
    for (const sx of [-1, 1]) {
      const pauldron = makePart(new THREE.SphereGeometry(0.125, 12, 8, 0, 6.28, 0, Math.PI * 0.58), armorMat);
      pauldron.scale.set(1.15, 0.85, 1.0);
      pauldron.position.set(sx * (shoulderX + 0.02), 0.56, 0);
      pauldron.rotation.z = sx * -0.42;
      spine.add(pauldron);
    }
  }
  if (cfg.fur) {
    const fur = makePart(new THREE.TorusGeometry(0.19, 0.065, 8, 14), stdMat('#7c6852', { roughness: 0.95 }));
    fur.rotation.x = Math.PI / 2; fur.position.y = 0.6;
    spine.add(fur);
  }
  if (cfg.beads) {
    const beads = makePart(new THREE.TorusGeometry(0.17, 0.036, 7, 16), stdMat('#4a2a14', { roughness: 0.55 }));
    beads.rotation.x = Math.PI / 2 + 0.35; beads.position.set(0, 0.56, 0.05);
    spine.add(beads);
  }
  if (cfg.bambooHat) {
    const hat = makePart(new THREE.ConeGeometry(0.38, 0.16, 16), stdMat('#8a7048', { roughness: 0.9, doubleSide: true }));
    hat.rotation.x = -Math.PI * 0.48; hat.position.set(0, 0.42, -0.22);
    spine.add(hat);
  }
  if (cfg.gourd) {
    const g1 = makePart(new THREE.SphereGeometry(0.075, 8, 8), stdMat('#c48a38', { roughness: 0.48 }));
    const g2 = makePart(new THREE.SphereGeometry(0.052, 8, 8), stdMat('#c48a38', { roughness: 0.48 }));
    g1.position.set(-0.22, 0.0, -0.04); g2.position.set(-0.22, 0.1, -0.04);
    pelvis.add(g1, g2);
  }
  if (cfg.redSash) {
    const sash = makePart(new THREE.TorusGeometry(0.195, 0.042, 6, 14), stdMat('#b82018', { roughness: 0.72 }));
    sash.rotation.x = Math.PI / 2; sash.position.y = 0.05;
    pelvis.add(sash);
  }

  // 飄逸分層披風（上窄下寬梯形剪裁＋動態飄揚）
  let cape = null;
  if (cfg.cape) {
    cape = new THREE.Group();
    cape.position.set(0, 0.58, -0.15);
    const cSh = new THREE.Shape();
    cSh.moveTo(-0.2, 0); cSh.lineTo(0.2, 0); cSh.lineTo(0.38, -1.12); cSh.lineTo(0, -1.04); cSh.lineTo(-0.38, -1.12); cSh.closePath();
    const capeGeo = new THREE.ShapeGeometry(cSh, 4);
    cape.add(makePart(capeGeo, stdMat(cfg.cape, { roughness: 0.82, doubleSide: true }), { outline: false }));
    spine.add(cape);
  }

  // 雕塑比例頭部（6.5 頭身：橢圓俊臉，非大圓球）
  const head = new THREE.Group();
  head.position.y = 0.79;
  spine.add(head);

  const faceMat = stdMat(0xffffff, { map: getFaceTex(cfg), roughness: 0.68 });
  const headMesh = makePart(new THREE.SphereGeometry(0.152, 18, 14), faceMat);
  headMesh.scale.set(0.92, 1.12, 0.96);
  headMesh.rotation.y = -Math.PI / 2;
  head.add(headMesh);

  const hType = cfg.head || 'topknot';
  if (hType !== 'bald') {
    const hairCap = makePart(new THREE.SphereGeometry(0.16, 14, 10, 0, 6.28, 0, Math.PI * 0.58), hairMat);
    hairCap.scale.set(0.94, 1.1, 0.98);
    hairCap.position.y = 0.015;
    head.add(hairCap);
  }
  if (hType === 'helmet') {
    const hMat = stdMat(cfg.helmetColor || '#c0ccd8', { roughness: 0.25, metalness: 0.82 });
    const dome = makePart(new THREE.SphereGeometry(0.172, 16, 10, 0, 6.28, 0, Math.PI * 0.56), hMat);
    dome.scale.set(0.95, 1.1, 1.0); dome.position.y = 0.04;
    const spike = makePart(new THREE.ConeGeometry(0.036, 0.14, 6), hMat, { outline: false });
    spike.position.y = 0.25;
    const plume = makePart(new THREE.ConeGeometry(0.055, 0.36, 7), stdMat('#bc1e18', { roughness: 0.72 }), { outline: false });
    plume.rotation.x = -1.25; plume.position.set(0, 0.26, -0.18);
    head.add(dome, spike, plume);
  } else if (hType === 'headband' || hType === 'circlet') {
    const band = makePart(new THREE.TorusGeometry(0.155, 0.022, 6, 18), hType === 'circlet' ? stdMat('#d0dae4', { metalness: 0.85, roughness: 0.22 }) : trimMat, { outline: false });
    band.rotation.x = Math.PI / 2; band.position.y = 0.065;
    const bun = makePart(new THREE.SphereGeometry(0.065, 8, 8), hairMat);
    bun.position.set(0, 0.2, -0.02);
    head.add(band, bun);
  } else if (hType === 'official' || hType === 'scholar') {
    const hat = makePart(new THREE.CylinderGeometry(0.11, 0.14, 0.2, 8), stdMat('#191718', { roughness: 0.72 }));
    hat.position.y = 0.18;
    head.add(hat);
    for (const sx of [-1, 1]) {
      const wing = makePart(new THREE.BoxGeometry(0.22, 0.034, 0.02), stdMat('#191718', { roughness: 0.72 }), { outline: false });
      wing.position.set(sx * 0.18, 0.11, -0.04);
      wing.rotation.z = sx * (hType === 'official' ? -0.42 : -0.78);
      head.add(wing);
    }
  } else if (hType === 'taoist') {
    const crown = makePart(new THREE.CylinderGeometry(0.055, 0.07, 0.13, 8), stdMat('#b4bec8', { metalness: 0.65, roughness: 0.32 }));
    crown.position.y = 0.21;
    const longHair = makePart(new THREE.ConeGeometry(0.16, 0.44, 8), hairMat, { outline: false });
    longHair.rotation.x = 0.18; longHair.position.set(0, -0.08, -0.14);
    head.add(crown, longHair);
  } else if (hType === 'peony') {
    const bun = makePart(new THREE.SphereGeometry(0.082, 10, 10), hairMat);
    bun.position.set(0, 0.19, -0.04);
    const flower = makePart(new THREE.DodecahedronGeometry(0.072, 0), stdMat('#cc222a', { roughness: 0.65 }), { outline: false });
    flower.position.set(0.1, 0.17, 0.03);
    head.add(bun, flower);
  } else if (hType === 'wildhair') {
    const mane = makePart(new THREE.DodecahedronGeometry(0.2, 1), hairMat);
    mane.position.set(0, 0.08, -0.07);
    head.add(mane);
  } else if (hType === 'ponytail') {
    const tail = makePart(new THREE.ConeGeometry(0.062, 0.44, 7), hairMat, { outline: false });
    tail.rotation.x = -0.8; tail.position.set(0, 0.08, -0.2);
    head.add(tail);
  } else if (hType === 'hood') {
    const hood = makePart(new THREE.SphereGeometry(0.175, 12, 10), stdMat('#19181a', { roughness: 0.85 }));
    hood.position.set(0, 0.03, -0.03);
    head.add(hood);
  } else if (hType === 'topknot') {
    const bun = makePart(new THREE.SphereGeometry(0.068, 8, 8), hairMat);
    bun.position.set(0, 0.2, -0.02);
    head.add(bun);
  }

  // 修長雙臂與戰袍衣袖
  const armR = new THREE.Group(); armR.position.set(-(shoulderX + 0.03), 0.55, 0);
  const armL = new THREE.Group(); armL.position.set(+(shoulderX + 0.03), 0.55, 0);
  spine.add(armR, armL);

  const buildArm = (parent) => {
    const upper = makePart(new THREE.CylinderGeometry(0.056, 0.048, 0.3, 10), sleeveMat);
    upper.position.y = -0.15;
    parent.add(upper);
    const elbow = new THREE.Group(); elbow.position.y = -0.31;
    parent.add(elbow);
    const lower = makePart(new THREE.CylinderGeometry(0.048, 0.038, 0.28, 10), cfg.pattern === 'bare' ? skinMat : sleeveMat);
    lower.position.y = -0.14;
    const fist = makePart(new THREE.SphereGeometry(0.052, 8, 8), skinMat, { outline: false });
    fist.position.y = -0.29;
    const handMount = new THREE.Group(); handMount.position.y = -0.29;
    elbow.add(lower, fist, handMount);
    return { elbow, handMount };
  };
  const rArm = buildArm(armR);
  const lArm = buildArm(armL);

  const wKind = cfg.weapon || 'sword';
  if (wKind === 'bow') {
    lArm.handMount.add(buildWeapon('bow'));
  } else if (wKind === 'twinaxe' || wKind === 'twinsaber' || wKind === 'twindagger') {
    const w1 = buildWeapon(wKind); w1.rotation.x = Math.PI * 0.45;
    const w2 = buildWeapon(wKind); w2.rotation.x = Math.PI * 0.45;
    rArm.handMount.add(w1); lArm.handMount.add(w2);
  } else if (wKind === 'cleaver') {
    const w1 = buildWeapon('dagger'); w1.rotation.x = Math.PI * 0.45;
    const w2 = buildWeapon('cleaver'); w2.rotation.x = Math.PI * 0.45;
    rArm.handMount.add(w1); lArm.handMount.add(w2);
  } else if (wKind === 'taoist') {
    const sw = buildWeapon('taoist'); sw.rotation.x = Math.PI * 0.42;
    rArm.handMount.add(sw);
    const wh = new THREE.Group();
    const whH = makePart(new THREE.CylinderGeometry(0.015, 0.015, 0.26, 6), stdMat('#5c3a1e'), { outline: false });
    const whT = makePart(new THREE.ConeGeometry(0.075, 0.38, 8), stdMat('#ece8de'), { outline: false });
    whT.position.y = 0.32; wh.add(whH, whT); wh.rotation.x = Math.PI * 0.45;
    lArm.handMount.add(wh);
  } else {
    const w = buildWeapon(wKind);
    w.rotation.x = (wKind === 'spear' || wKind === 'trident' || wKind === 'staff') ? Math.PI * 0.36 : Math.PI * 0.45;
    rArm.handMount.add(w);
  }

  // 修長武者雙腿（大腿＋膝關節＋綁腿戰靴）
  const legR = new THREE.Group(); legR.position.set(-0.11, -0.04, 0);
  const legL = new THREE.Group(); legL.position.set(+0.11, -0.04, 0);
  pelvis.add(legR, legL);

  const buildLeg = (parent) => {
    const thigh = makePart(new THREE.CylinderGeometry(0.078, 0.06, 0.44, 10), pantsMat);
    thigh.position.y = -0.22;
    parent.add(thigh);
    const knee = new THREE.Group(); knee.position.y = -0.46;
    parent.add(knee);
    const shin = makePart(new THREE.CylinderGeometry(0.058, 0.045, 0.46, 10), bootMat);
    shin.position.y = -0.23;
    const foot = makePart(new THREE.BoxGeometry(0.11, 0.08, 0.24), bootMat, { outline: false });
    foot.position.set(0, -0.48, 0.055);
    knee.add(shin, foot);
    return { knee };
  };
  const rLeg = buildLeg(legR);
  const lLeg = buildLeg(legL);

  return {
    root, body, kind: 'human', wKind, isFoe,
    parts: { pelvis, spine, head, cape, flapF, flapB, armR, armL, elbowR: rArm.elbow, elbowL: lArm.elbow, legR, legL, kneeR: rLeg.knee, kneeL: lLeg.knee },
    height: 2.15 * s,
  };
}

// ── 雕塑級四足猛獸骨架（弓背猛虎／餓狼／花豹／野豬／惡犬：雙節彎肢＋尖吻利牙＋三段流暢長尾） ──
const beastBodyProfile = [
  new THREE.Vector2(0.0, -0.58),
  new THREE.Vector2(0.17, -0.48),  // 精瘦後臀
  new THREE.Vector2(0.19, -0.22),
  new THREE.Vector2(0.175, 0.02),  // 收腹腰線
  new THREE.Vector2(0.255, 0.34),  // 強壯前胸
  new THREE.Vector2(0.22, 0.54),   // 肩頸
  new THREE.Vector2(0.0, 0.62),
];
const beastTrunkGeo = new THREE.LatheGeometry(beastBodyProfile, 14);
beastTrunkGeo.rotateX(Math.PI / 2);

function buildQuadBeastRig(cfg) {
  const root = new THREE.Group();
  const s = cfg.scale || 1.0;
  const body = new THREE.Group();
  body.scale.set(s, s, s);
  root.add(body);

  const furMat = stdMat(0xffffff, { map: getBeastTex(cfg.base, cfg.stripe, cfg.kind), roughness: 0.82 });
  const bellyMat = stdMat(cfg.belly || '#e8d8be', { roughness: 0.85 });
  const darkMat = stdMat('#1a1410', { roughness: 0.5 });

  const torso = new THREE.Group();
  torso.position.y = 0.78;
  body.add(torso);

  const trunk = makePart(beastTrunkGeo, furMat);
  trunk.scale.set(0.92, 1.05, 1.0);
  torso.add(trunk);

  // 頸毛鬃毛與尖銳猛獸頭部
  const head = new THREE.Group();
  head.position.set(0, 0.2, 0.62);
  torso.add(head);

  const skull = makePart(new THREE.SphereGeometry(0.21, 14, 12), furMat);
  skull.scale.set(0.95, 0.88, 1.15);
  const snout = makePart(new THREE.ConeGeometry(0.125, 0.32, 8), furMat);
  snout.rotation.x = Math.PI / 2; snout.position.set(0, -0.03, 0.26);
  const jaw = makePart(new THREE.ConeGeometry(0.09, 0.26, 7), bellyMat, { outline: false });
  jaw.rotation.x = Math.PI / 2 + 0.16; jaw.position.set(0, -0.11, 0.2);
  const nose = makePart(new THREE.SphereGeometry(0.038, 6, 6), darkMat, { outline: false });
  nose.position.set(0, -0.01, 0.41);
  head.add(skull, snout, jaw, nose);

  for (const sx of [-1, 1]) {
    const ear = makePart(new THREE.ConeGeometry(0.06, 0.17, 5), furMat);
    ear.position.set(sx * 0.13, 0.18, -0.04); ear.rotation.z = sx * -0.3; ear.rotation.x = -0.25;
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.032, 6, 6), stdMat('#ffd84a', { emissive: 0xff9810, emissiveIntensity: 0.85 }));
    eye.position.set(sx * 0.1, 0.05, 0.17);
    const fang = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.075, 4), stdMat('#fffaf0'));
    fang.rotation.x = Math.PI; fang.position.set(sx * 0.055, -0.09, 0.3);
    head.add(ear, eye, fang);
    if (cfg.tusks) {
      const tusk = makePart(new THREE.ConeGeometry(0.028, 0.22, 5), stdMat('#f6eedc'), { outline: false });
      tusk.position.set(sx * 0.1, -0.05, 0.32); tusk.rotation.x = 0.65; tusk.rotation.z = sx * -0.35;
      head.add(tusk);
    }
  }

  // 真實雙節彎曲獸肢（上臂／大腿 → 踝節 → 獸爪）
  const legs = [];
  const legDefs = [
    [-0.18, -0.02, 0.36, true],  [0.18, -0.02, 0.36, true],
    [-0.17, -0.02, -0.38, false],[0.17, -0.02, -0.38, false],
  ];
  for (const [lx, ly, lz, isFront] of legDefs) {
    const hip = new THREE.Group(); hip.position.set(lx, ly, lz);
    const upper = makePart(new THREE.CylinderGeometry(0.085, 0.055, 0.38, 8), furMat);
    upper.position.set(0, -0.18, isFront ? -0.03 : 0.05);
    upper.rotation.x = isFront ? 0.2 : -0.32;
    const lower = makePart(new THREE.CylinderGeometry(0.052, 0.04, 0.38, 8), furMat);
    lower.position.set(0, -0.52, isFront ? 0.03 : -0.04);
    lower.rotation.x = isFront ? -0.14 : 0.24;
    const paw = makePart(new THREE.SphereGeometry(0.078, 8, 6), bellyMat, { outline: false });
    paw.scale.set(1.0, 0.52, 1.35); paw.position.set(0, -0.71, 0.06);
    hip.add(upper, lower, paw);
    torso.add(hip);
    legs.push(hip);
  }

  // 優雅長尾
  const tail = new THREE.Group();
  tail.position.set(0, 0.08, -0.52);
  const tCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0.08, -0.32),
    new THREE.Vector3(0, 0.24, -0.58),
  ]);
  tail.add(makePart(new THREE.TubeGeometry(tCurve, 12, 0.042, 7, false), furMat, { outline: false }));
  torso.add(tail);

  return {
    root, body, kind: 'quad', wKind: 'claw', isFoe: true,
    parts: { torso, head, jaw, tail, legs },
    height: 1.42 * s,
  };
}

function buildSnakeRig(cfg) {
  const root = new THREE.Group();
  const s = cfg.scale || 1.0;
  const body = new THREE.Group(); body.scale.set(s, s, s);
  root.add(body);
  const skin = stdMat(0xffffff, { map: getBeastTex(cfg.base, cfg.stripe, 'snake'), roughness: 0.42, metalness: 0.14 });
  const segs = [];
  for (let i = 0; i < 7; i++) {
    const r = i === 0 ? 0.15 : Math.max(0.055, 0.14 - i * 0.014);
    const seg = makePart(new THREE.SphereGeometry(r, 10, 8), skin);
    seg.scale.set(1.1, 0.85, 1.3);
    seg.position.set(Math.sin(i * 0.9) * 0.26, i < 2 ? 0.72 - i * 0.26 : 0.14, 0.42 - i * 0.24);
    body.add(seg); segs.push(seg);
  }
  for (const sx of [-0.075, 0.075]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 6), stdMat('#ff4824', { emissive: 0xff2200, emissiveIntensity: 0.9 }));
    eye.position.set(sx, 0.05, 0.12);
    segs[0].add(eye);
  }
  return { root, body, kind: 'snake', wKind: 'claw', isFoe: true, parts: { segs, head: segs[0] }, height: 1.05 * s };
}

export function createBattleUnitModel(actor) {
  let rig;
  if (!actor.isFoe) {
    rig = buildHumanoidRig(HERO_STYLE[actor.hero.id] || HERO_STYLE.linchong, false);
  } else {
    const imgKey = (actor.img || '').replace(/^p_/, '');
    if (HERO_STYLE[imgKey]) {
      rig = buildHumanoidRig({ ...HERO_STYLE[imgKey], scale: (HERO_STYLE[imgKey].scale || 1) * 1.1 }, true);
    } else {
      const fcfg = FOE_STYLE[actor.key] || FOE_STYLE[actor.img] || FOE_STYLE[imgKey] || FOE_STYLE.bandit;
      if (fcfg.beast === 'quad') rig = buildQuadBeastRig(fcfg);
      else if (fcfg.beast === 'snake') rig = buildSnakeRig(fcfg);
      else rig = buildHumanoidRig(fcfg, true);
    }
  }

  const shield = new THREE.Mesh(new THREE.IcosahedronGeometry(1.08, 1), new THREE.MeshBasicMaterial({ color: 0xffda6a, transparent: true, opacity: 0.3, wireframe: true }));
  shield.position.y = rig.height * 0.48; shield.visible = false;
  rig.root.add(shield); rig.shield = shield;

  const aura = new THREE.Mesh(
    new THREE.RingGeometry(0.55, 0.74, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd55a, transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  aura.rotation.x = -Math.PI / 2; aura.position.y = 0.035;
  rig.root.add(aura); rig.aura = aura;

  rig.state = 'idle'; rig.stateT = 0; rig.phase = Math.random() * 6.28;
  rig.homePos = new THREE.Vector3(); rig.homeRotY = 0;
  rig.hitFlash = 0; rig.isTurn = false; rig.defending = false; rig.enraged = false;
  return rig;
}

export function animateBattleRig(rig, dt, t) {
  rig.stateT += dt;
  const p = rig.parts, st = rig.state, ph = t * 3.1 + rig.phase;

  rig.shield.visible = !!rig.defending && st !== 'dead';
  if (rig.shield.visible) rig.shield.rotation.y += dt * 1.4;

  const wantAura = st === 'cast' ? 0.9 : rig.isTurn ? (0.5 + 0.24 * Math.sin(t * 6)) : rig.enraged ? 0.55 : 0;
  rig.aura.material.opacity += (wantAura - rig.aura.material.opacity) * Math.min(1, dt * 10);
  rig.aura.material.color.setHex(rig.enraged ? 0xff2c1a : st === 'cast' ? 0x70d8ff : 0xffd864);
  rig.aura.rotation.z = t * 1.4;

  if (rig.hitFlash > 0) {
    rig.hitFlash = Math.max(0, rig.hitFlash - dt * 4.5);
    rig.body.traverse(o => {
      if (o.isMesh && o.material && o.material.emissive && o.material !== outlineMat) {
        o.material.emissive.setHex(rig.hitFlash > 0.05 ? 0xffffff : 0x000000);
        o.material.emissiveIntensity = rig.hitFlash * 0.85;
      }
    });
  }

  if (rig.kind === 'human') {
    if (st === 'dead') {
      p.pelvis.position.y += (0.28 - p.pelvis.position.y) * Math.min(1, dt * 7);
      p.pelvis.rotation.x += (-1.35 - p.pelvis.rotation.x) * Math.min(1, dt * 7);
      return;
    }
    p.pelvis.rotation.x = 0;
    if (st === 'idle') {
      const b = Math.sin(ph);
      p.pelvis.position.y = 1.04 + b * 0.028;
      p.spine.rotation.set(0.08 + b * 0.02, Math.sin(ph * 0.5) * 0.07, 0);
      p.head.rotation.set(-0.04, -p.spine.rotation.y * 0.6, 0);
      p.armR.rotation.set(-0.58 + b * 0.06, 0, -0.2); p.elbowR.rotation.x = -0.58;
      p.armL.rotation.set(-0.45 - b * 0.05, 0, 0.22); p.elbowL.rotation.x = -0.52;
      p.legR.rotation.set(-0.16, 0, -0.06); p.kneeR.rotation.x = 0.25;
      p.legL.rotation.set(0.15, 0, 0.06);   p.kneeL.rotation.x = 0.2;
      p.flapF.rotation.x = -0.14 - b * 0.04; p.flapB.rotation.x = 0.16 + b * 0.04;
      if (p.cape) p.cape.rotation.x = 0.22 + Math.sin(t * 2.8 + rig.phase) * 0.12;
    } else if (st === 'run') {
      const cyc = t * 15;
      p.pelvis.position.y = 1.0 + Math.abs(Math.sin(cyc)) * 0.13;
      p.spine.rotation.set(0.35, Math.sin(cyc) * 0.16, 0);
      p.legR.rotation.x = Math.sin(cyc) * 0.92; p.kneeR.rotation.x = Math.max(0, -Math.cos(cyc) * 0.95);
      p.legL.rotation.x = -Math.sin(cyc) * 0.92; p.kneeL.rotation.x = Math.max(0, Math.cos(cyc) * 0.95);
      p.armR.rotation.set(-0.4 - Math.sin(cyc) * 0.52, 0, -0.16); p.elbowR.rotation.x = -0.65;
      p.armL.rotation.set(-0.4 + Math.sin(cyc) * 0.6, 0, 0.16);  p.elbowL.rotation.x = -0.65;
      p.flapF.rotation.x = -0.35; p.flapB.rotation.x = 0.48;
      if (p.cape) p.cape.rotation.x = 0.72 + Math.sin(cyc * 1.5) * 0.14;
    } else if (st === 'attack') {
      const k = Math.min(1, rig.stateT / 0.42);
      if (k < 0.35) {
        const u = k / 0.35;
        p.pelvis.position.y = 0.98;
        p.spine.rotation.set(-0.18 * u, -0.58 * u, 0);
        p.armR.rotation.set(-2.2 * u - 0.4, 0, -0.5 * u); p.elbowR.rotation.x = -0.3;
      } else {
        const u = Math.min(1, (k - 0.35) / 0.35);
        p.pelvis.position.y = 1.0 + Math.sin(u * Math.PI) * 0.16;
        p.spine.rotation.set(0.32 * u, -0.58 + 1.3 * u, 0);
        p.armR.rotation.set(-2.6 + 2.9 * u, 0, -0.5 + 0.85 * u); p.elbowR.rotation.x = -0.18;
        p.armL.rotation.set(-0.75 * u, 0, 0.5 * u);
      }
      if (p.cape) p.cape.rotation.x = 0.85;
    } else if (st === 'cast') {
      const u = Math.sin(rig.stateT * 9);
      p.pelvis.position.y = 1.08 + Math.sin(rig.stateT * 5) * 0.05;
      p.spine.rotation.set(-0.14, 0, 0);
      p.armR.rotation.set(-2.35 + u * 0.12, 0, -0.32); p.elbowR.rotation.x = -0.22;
      p.armL.rotation.set(-2.15 - u * 0.12, 0, 0.32);  p.elbowL.rotation.x = -0.22;
      if (p.cape) p.cape.rotation.x = 0.58 + u * 0.16;
    } else if (st === 'hit') {
      const bump = Math.sin(Math.min(1, rig.stateT / 0.36) * Math.PI);
      p.pelvis.position.y = 1.0 - bump * 0.08;
      p.spine.rotation.set(-0.42 * bump, 0, (rig.isFoe ? -1 : 1) * 0.18 * bump);
      p.head.rotation.x = -0.32 * bump;
    } else if (st === 'victory') {
      const v = Math.sin(t * 4.5 + rig.phase);
      p.pelvis.position.y = 1.06 + Math.max(0, v) * 0.08;
      p.spine.rotation.set(-0.08, Math.sin(t * 1.8) * 0.18, 0);
      p.armR.rotation.set(-2.55 + v * 0.15, 0, -0.2); p.elbowR.rotation.x = -0.16;
      p.armL.rotation.set(-0.42, 0, 0.42); p.elbowL.rotation.x = -0.62;
      if (p.cape) p.cape.rotation.x = 0.4 + Math.sin(t * 4) * 0.15;
    }
  } else if (rig.kind === 'quad') {
    if (st === 'dead') {
      p.torso.position.y += (0.26 - p.torso.position.y) * Math.min(1, dt * 7);
      p.torso.rotation.z += (1.45 - p.torso.rotation.z) * Math.min(1, dt * 7);
      return;
    }
    p.torso.rotation.z = 0;
    if (st === 'run') {
      const cyc = t * 14;
      p.torso.position.y = 0.78 + Math.abs(Math.sin(cyc)) * 0.16;
      p.torso.rotation.x = Math.sin(cyc) * 0.15;
      p.legs[0].rotation.x = Math.sin(cyc) * 0.85; p.legs[1].rotation.x = Math.sin(cyc + 0.4) * 0.85;
      p.legs[2].rotation.x = -Math.sin(cyc) * 0.85; p.legs[3].rotation.x = -Math.sin(cyc + 0.4) * 0.85;
      p.jaw.rotation.x = Math.PI / 2 + 0.42;
    } else if (st === 'attack') {
      const leap = Math.sin(Math.min(1, rig.stateT / 0.42) * Math.PI);
      p.torso.position.y = 0.78 + leap * 0.5;
      p.torso.rotation.x = -0.42 * leap;
      p.legs[0].rotation.x = -1.1 * leap; p.legs[1].rotation.x = -1.1 * leap;
      p.jaw.rotation.x = Math.PI / 2 + 0.56;
    } else if (st === 'hit') {
      const bump = Math.sin(Math.min(1, rig.stateT / 0.36) * Math.PI);
      p.torso.position.y = 0.78 - bump * 0.08;
      p.head.rotation.x = -0.35 * bump;
    } else {
      p.torso.position.y = 0.78 + Math.sin(ph) * 0.032;
      p.torso.rotation.x = 0;
      p.head.rotation.y = Math.sin(ph * 0.6) * 0.14;
      p.jaw.rotation.x = Math.PI / 2 + 0.16 + Math.max(0, Math.sin(ph * 0.7)) * 0.14;
      p.tail.rotation.y = Math.sin(ph * 1.4) * 0.42;
      p.legs.forEach(l => { l.rotation.x = 0; });
    }
  } else if (rig.kind === 'snake') {
    if (st === 'dead') { rig.body.scale.y += (0.25 - rig.body.scale.y) * Math.min(1, dt * 6); return; }
    p.segs.forEach((seg, idx) => {
      seg.position.x = Math.sin(t * 4.5 + idx * 0.9 + rig.phase) * 0.24;
      seg.position.z = (st === 'attack' && idx === 0) ? 0.42 + Math.sin(Math.min(1, rig.stateT / 0.38) * Math.PI) * 0.85 : 0.42 - idx * 0.24;
    });
  }
}
