// 主機級「真實多動作影格＋零扭曲剛體運鏡」2.5D 戰鬥角色引擎（Three.js）
// 徹底移除單張貼圖橡皮扭曲！
// - 擁有專屬 6 動作戰鬥影格圖（img/bc_<id>.webp：待機／衝刺／蓄力／全力揮斬／受擊／勝利）的角色直接播放真實手繪影格切換！
// - 其餘角色與敵人於衝刺時自動播放真實 3 格側面奔跑影格（img/spr/<id>.webp），出招／待機顯示高解析無變形彩繪原圖＋剛體躍進＋3D 刀光與殘影！
import * as THREE from './vendor/three.module.min.js';
import { img, ready } from './assets.js';

// 已具備專屬 6 動作（3×2）手繪戰鬥影格圖的角色表
const HAS_BC = new Set(['linchong', 'luzhishen', 'wusong', 'huarong', 'e_thug', 'e_wolf']);

const UNIT_VERT = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// ── 零扭曲清晰渲染＋Sobel 擬法線立體打光＋邊緣輪廓逆光＋受擊白閃＋支援圖集 UV 裁切 ──
const UNIT_FRAG = `
  uniform sampler2D uMap;
  uniform vec4 uUvRect;    // (u0, v0, uSpan, vSpan)
  uniform vec2 uTexel;
  uniform vec3 uLightDir;
  uniform vec3 uLightCol;
  uniform vec3 uAmbCol;
  uniform vec3 uRimCol;
  uniform float uRimPower;
  uniform float uHitFlash;
  uniform float uDeadFade;
  uniform float uMirror;
  uniform vec3 uTint;
  uniform float uAlpha;
  varying vec2 vUv;

  float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

  void main() {
    float lx = uMirror < 0.0 ? (1.0 - vUv.x) : vUv.x;
    vec2 uv = uUvRect.xy + vec2(lx, vUv.y) * uUvRect.zw;
    vec4 tex = texture2D(uMap, uv);
    if (tex.a < 0.36) discard;

    // Sobel 擬法線立體感（僅影響光影明暗，完全不扭曲畫面！）
    vec2 uvMin = uUvRect.xy + uTexel;
    vec2 uvMax = uUvRect.xy + uUvRect.zw - uTexel;
    float lL = luma(texture2D(uMap, clamp(uv + vec2(-uTexel.x, 0.0), uvMin, uvMax)).rgb);
    float lR = luma(texture2D(uMap, clamp(uv + vec2( uTexel.x, 0.0), uvMin, uvMax)).rgb);
    float lD = luma(texture2D(uMap, clamp(uv + vec2(0.0, -uTexel.y), uvMin, uvMax)).rgb);
    float lU = luma(texture2D(uMap, clamp(uv + vec2(0.0,  uTexel.y), uvMin, uvMax)).rgb);
    vec3 nrm = normalize(vec3((lL - lR) * 2.0 * uMirror, (lD - lU) * 2.0, 1.0));

    float diff = clamp(dot(nrm, normalize(uLightDir)) * 0.5 + 0.72, 0.58, 1.32);
    vec3 col = tex.rgb * uTint * (uAmbCol * 0.74 + uLightCol * diff * 0.84);

    // 邊緣輪廓光（Rim Light）
    float aL = texture2D(uMap, clamp(uv + vec2(-uTexel.x * 2.5, 0.0), uvMin, uvMax)).a;
    float aR = texture2D(uMap, clamp(uv + vec2( uTexel.x * 2.5, 0.0), uvMin, uvMax)).a;
    float aU = texture2D(uMap, clamp(uv + vec2(0.0,  uTexel.y * 2.5), uvMin, uvMax)).a;
    float edgeRim = clamp(1.0 - min(min(aL, aR), aU), 0.0, 1.0);
    col += uRimCol * edgeRim * uRimPower * (0.45 + 0.55 * vUv.y);

    if (uDeadFade > 0.01) {
      float gr = luma(col);
      col = mix(col, vec3(gr * 0.45), uDeadFade * 0.85);
    }
    col = mix(col, vec3(1.0, 0.98, 0.92), clamp(uHitFlash, 0.0, 1.0));
    gl_FragColor = vec4(col, tex.a * uAlpha * (1.0 - uDeadFade * 0.4));
  }
`;

const DEPTH_FRAG = `
  uniform sampler2D uMap;
  uniform vec4 uUvRect;
  uniform float uMirror;
  varying vec2 vUv;
  void main() {
    float lx = uMirror < 0.0 ? (1.0 - vUv.x) : vUv.x;
    vec2 uv = uUvRect.xy + vec2(lx, vUv.y) * uUvRect.zw;
    if (texture2D(uMap, uv).a < 0.42) discard;
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
  }
`;

const unitTexCache = new Map();
function getUnitTex(assetName) {
  let rec = unitTexCache.get(assetName);
  if (!rec) {
    const im = img(assetName);
    const tex = new THREE.Texture(im);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    rec = { tex, im, uploaded: false };
    unitTexCache.set(assetName, rec);
  }
  if (!rec.uploaded && ready(rec.im)) {
    rec.tex.image = rec.im;
    rec.tex.needsUpdate = true;
    rec.uploaded = true;
  }
  return rec;
}

let contactShadowTex = null;
function getContactShadowTex() {
  if (contactShadowTex) return contactShadowTex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 4, 32, 32, 30);
  gr.addColorStop(0, 'rgba(8,6,4,0.62)');
  gr.addColorStop(0.6, 'rgba(8,6,4,0.26)');
  gr.addColorStop(1, 'rgba(8,6,4,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  contactShadowTex = new THREE.CanvasTexture(c);
  return contactShadowTex;
}

function unitSpec(actor) {
  if (!actor.isFoe) {
    const id = actor.hero.id;
    const tall = (id === 'luzhishen' || id === 'likui') ? 2.55 : (id === 'chaogai' || id === 'wusong') ? 2.42 : 2.34;
    return {
      bcKey: HAS_BC.has(id) ? 'bc_' + id : null,
      asset: 'bf_' + id,
      sprAsset: 'spr/' + id,
      height: tall,
      mirror: 1,
      facing: -1,
      wKind: id === 'huarong' ? 'bow' : 'melee',
    };
  }
  const rawImg = actor.img || 'e_bandit';
  const isHeroBoss = rawImg.startsWith('p_');
  const cleanId = rawImg.replace(/^p_/, '');
  const bcMatch = HAS_BC.has(rawImg) ? 'bc_' + rawImg : (isHeroBoss && HAS_BC.has(cleanId) ? 'bc_' + cleanId : null);
  const asset = isHeroBoss ? 'bf_' + cleanId : rawImg;
  const isQuad = /tiger|wolf|leopard|boar|dog/.test(rawImg);
  let height = 2.28;
  if (actor.big || actor.boss) height = isQuad ? 2.55 : 2.65;
  else if (isQuad) height = /dog/.test(rawImg) ? 1.8 : 2.08;
  else if (/snake/.test(rawImg)) height = 1.65;
  return {
    bcKey: bcMatch,
    asset,
    sprAsset: 'spr/' + cleanId,
    height,
    mirror: isHeroBoss ? -1 : 1,
    facing: 1,
    wKind: /archer/.test(rawImg) ? 'bow' : 'melee',
  };
}

export function createBattleUnitModel(actor, biome = null) {
  const spec = unitSpec(actor);
  const mainRec = getUnitTex(spec.bcKey || spec.asset);
  const sprRec = !spec.bcKey ? getUnitTex(spec.sprAsset) : null;
  const root = new THREE.Group();

  // 剛體平面（0 橡皮扭曲！）
  const geo = new THREE.PlaneGeometry(1, 1);
  geo.translate(0, 0.5, 0);

  const sunCol = biome ? new THREE.Color(biome.sun) : new THREE.Color(0xfff0d4);
  const ambCol = biome ? new THREE.Color(biome.amb) : new THREE.Color(0x9a9080);
  const rimCol = biome ? new THREE.Color(biome.rim) : new THREE.Color(0xffb45c);

  const uniforms = {
    uMap: { value: mainRec.tex },
    uUvRect: { value: new THREE.Vector4(0, 0, 1, 1) },
    uTexel: { value: new THREE.Vector2(1 / 512, 1 / 512) },
    uLightDir: { value: new THREE.Vector3(0.5, 0.72, 0.48) },
    uLightCol: { value: sunCol },
    uAmbCol: { value: ambCol },
    uRimCol: { value: rimCol },
    uRimPower: { value: actor.isFoe ? 0.5 : 0.68 },
    uHitFlash: { value: 0 },
    uDeadFade: { value: 0 },
    uMirror: { value: spec.mirror },
    uTint: { value: new THREE.Color(0xffffff) },
    uAlpha: { value: 1.0 },
  };

  const mat = new THREE.ShaderMaterial({
    vertexShader: UNIT_VERT,
    fragmentShader: UNIT_FRAG,
    uniforms,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: true,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.customDepthMaterial = new THREE.ShaderMaterial({
    vertexShader: UNIT_VERT,
    fragmentShader: DEPTH_FRAG,
    uniforms,
    side: THREE.DoubleSide,
  });
  root.add(mesh);

  const shGeo = new THREE.PlaneGeometry(1.65, 0.9);
  shGeo.rotateX(-Math.PI / 2);
  const shadowDisc = new THREE.Mesh(shGeo, new THREE.MeshBasicMaterial({ map: getContactShadowTex(), transparent: true, depthWrite: false }));
  shadowDisc.position.y = 0.015;
  root.add(shadowDisc);

  const shield = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.15, 1),
    new THREE.MeshBasicMaterial({ color: 0xffda6a, transparent: true, opacity: 0.28, wireframe: true, blending: THREE.AdditiveBlending })
  );
  shield.position.y = spec.height * 0.48;
  shield.visible = false;
  root.add(shield);

  const aura = new THREE.Mesh(
    new THREE.RingGeometry(0.68, 0.92, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd864, transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  aura.rotation.x = -Math.PI / 2;
  aura.position.y = 0.028;
  root.add(aura);

  const rig = {
    root, mesh, shadowDisc, shield, aura, uniforms,
    mainRec, sprRec, spec,
    wKind: spec.wKind, isFoe: !!actor.isFoe, height: spec.height,
    baseW: spec.height * 0.95, baseH: spec.height,
    state: 'idle', stateT: 0, phase: Math.random() * 6.28,
    homePos: new THREE.Vector3(), homeRotY: 0,
    hitFlash: 0, isTurn: false, defending: false, enraged: false,
    useSprMode: false,
  };

  const syncAspect = () => {
    if (ready(mainRec.im)) {
      if (!mainRec.uploaded) { mainRec.tex.image = mainRec.im; mainRec.tex.needsUpdate = true; mainRec.uploaded = true; }
      const cellW = spec.bcKey ? mainRec.im.width / 3 : mainRec.im.width;
      const cellH = spec.bcKey ? mainRec.im.height / 2 : mainRec.im.height;
      const aspect = cellW / Math.max(1, cellH);
      rig.baseH = spec.bcKey ? spec.height * 1.15 : spec.height;
      rig.baseW = rig.baseH * aspect;
      mesh.scale.set(rig.baseW, rig.baseH, 1);
      uniforms.uTexel.value.set(1 / Math.max(128, mainRec.im.width), 1 / Math.max(128, mainRec.im.height));
      shadowDisc.scale.set(Math.min(1.7, rig.baseW * 0.65), 1, 1);
    } else {
      mesh.scale.set(rig.baseW, rig.baseH, 1);
    }
  };
  rig.syncAspect = syncAspect;
  syncAspect();
  mainRec.im.addEventListener('load', syncAspect, { once: true });
  return rig;
}

// ── 3D 衝刺／斬擊殘影分身（完整保留當下動作影格，零扭曲！） ──
export function createAfterimageMesh(rig, colorHex = 0xffd470) {
  const u = {};
  for (const [k, v] of Object.entries(rig.uniforms)) {
    u[k] = { value: v.value && v.value.clone ? v.value.clone() : v.value };
  }
  u.uTint.value = new THREE.Color(colorHex);
  u.uAlpha.value = 0.46;
  u.uRimPower.value = 1.5;
  const mat = new THREE.ShaderMaterial({
    vertexShader: UNIT_VERT,
    fragmentShader: UNIT_FRAG,
    uniforms: u,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const m = new THREE.Mesh(rig.mesh.geometry, mat);
  m.scale.copy(rig.mesh.scale);
  m.position.copy(rig.root.position);
  m.position.y += rig.mesh.position.y;
  m.rotation.copy(rig.root.rotation);
  return { mesh: m, mat, uniforms: u };
}

// 設定 3×2 戰鬥動作影格（0:待機 1:衝刺 2:蓄力 3:揮斬 4:受擊 5:勝利/倒地）
function setBCFrame(rig, idx) {
  const col = idx % 3;
  const row = Math.floor(idx / 3); // row 0 在頂部 (v = 0.5..1.0), row 1 在底部 (v = 0..0.5)
  rig.uniforms.uMap.value = rig.mainRec.tex;
  rig.uniforms.uUvRect.value.set(col / 3, row === 0 ? 0.5 : 0.0, 1 / 3, 0.5);
  rig.uniforms.uMirror.value = rig.spec.mirror;
  rig.mesh.scale.set(rig.baseW, rig.baseH, 1);
}

// 設定既有行走圖 3×4 影格（給尚未有專屬 bc_* 圖的角色於衝刺時播放真實奔跑雙腳！）
function setSprRunFrame(rig, t) {
  if (!rig.sprRec || !ready(rig.sprRec.im)) {
    rig.uniforms.uMap.value = rig.mainRec.tex;
    rig.uniforms.uUvRect.value.set(0, 0, 1, 1);
    return;
  }
  if (!rig.sprRec.uploaded) { rig.sprRec.tex.image = rig.sprRec.im; rig.sprRec.tex.needsUpdate = true; rig.sprRec.uploaded = true; }
  const frame = [0, 1, 2, 1][Math.floor(t * 14) % 4];
  const dir = rig.isFoe ? 1 : 3; // 敵人面向右 (row 1)，我方面向左 (row 3)
  rig.uniforms.uMap.value = rig.sprRec.tex;
  rig.uniforms.uUvRect.value.set(frame / 3, 1 - (dir + 1) / 4, 1 / 3, 0.25);
  rig.uniforms.uMirror.value = 1;
  const aspect = (rig.sprRec.im.width / 3) / (rig.sprRec.im.height / 4);
  const h = rig.height * 0.96;
  rig.mesh.scale.set(h * aspect, h, 1);
}

// ── 每幀驅動真實多動作影格切換與乾淨剛體位移（完全不扭曲貼圖！） ──
export function animateBattleRig(rig, dt, t, camera) {
  if (!rig.mainRec.uploaded && ready(rig.mainRec.im)) rig.syncAspect();
  rig.stateT += dt;

  const u = rig.uniforms;
  const st = rig.state;
  const lerp = (cur, target, speed) => cur + (target - cur) * Math.min(1, dt * speed);

  // 柔和面向攝影機
  if (camera) {
    const dx = camera.position.x - rig.root.position.x;
    const dz = camera.position.z - rig.root.position.z;
    rig.root.rotation.y = Math.atan2(dx, dz) * 0.58;
  }

  // 防禦護盾與腳下回合光環
  rig.shield.visible = !!rig.defending && st !== 'dead';
  if (rig.shield.visible) rig.shield.rotation.y += dt * 1.6;

  const wantAura = st === 'cast' ? 0.92 : rig.isTurn ? (0.55 + 0.25 * Math.sin(t * 6)) : rig.enraged ? 0.6 : 0;
  rig.aura.material.opacity = lerp(rig.aura.material.opacity, wantAura, 10);
  rig.aura.material.color.setHex(rig.enraged ? 0xff2c1a : st === 'cast' ? 0x70d8ff : 0xffd864);
  rig.aura.rotation.z = t * 1.4;

  const wantRim = rig.enraged ? 1.55 : rig.isTurn ? 1.35 : st === 'cast' ? 1.7 : (rig.isFoe ? 0.5 : 0.68);
  u.uRimPower.value = lerp(u.uRimPower.value, wantRim, 8);
  if (rig.enraged) u.uRimCol.value.setHex(0xff3820);
  else if (st === 'cast') u.uRimCol.value.setHex(0x88dcff);
  else if (rig.isTurn) u.uRimCol.value.setHex(0xffe078);

  if (rig.hitFlash > 0) rig.hitFlash = Math.max(0, rig.hitFlash - dt * 5.2);
  u.uHitFlash.value = rig.hitFlash;

  const hasBC = !!rig.spec.bcKey && ready(rig.mainRec.im);

  if (st === 'dead') {
    u.uDeadFade.value = lerp(u.uDeadFade.value, 1.0, 5);
    if (hasBC && rig.isFoe) {
      setBCFrame(rig, 5); // 敵方專屬倒地影格
      rig.mesh.rotation.z = lerp(rig.mesh.rotation.z, 0, 8);
    } else {
      if (hasBC) setBCFrame(rig, 4);
      else { u.uMap.value = rig.mainRec.tex; u.uUvRect.value.set(0, 0, 1, 1); u.uMirror.value = rig.spec.mirror; }
      rig.mesh.rotation.z = lerp(rig.mesh.rotation.z, rig.isFoe ? -0.22 : 0.22, 6);
    }
    rig.mesh.position.set(0, 0, 0);
    return;
  }

  u.uDeadFade.value = lerp(u.uDeadFade.value, 0.0, 8);
  rig.mesh.rotation.z = lerp(rig.mesh.rotation.z, 0, 12);

  if (hasBC) {
    // ── 真實 6 動作手繪影格切換（0 橡皮扭曲！） ──
    if (st === 'run') {
      setBCFrame(rig, 1);
      rig.mesh.position.set(0, Math.abs(Math.sin(t * 16)) * 0.14, 0);
    } else if (st === 'attack') {
      const k = rig.stateT / 0.42;
      if (k < 0.36) {
        // 蓄力起手影格（Frame 2）
        setBCFrame(rig, 2);
        rig.mesh.position.set(-rig.spec.facing * 0.18 * (k / 0.36), 0, 0);
      } else {
        // 全力揮斬／突刺／拉弓射箭影格（Frame 3）
        setBCFrame(rig, 3);
        const p = Math.min(1, (k - 0.36) / 0.25);
        rig.mesh.position.set(rig.spec.facing * 0.42 * p, Math.sin(p * Math.PI) * 0.12, 0);
      }
    } else if (st === 'cast') {
      setBCFrame(rig, 5);
      rig.mesh.position.set(0, 0.08 + Math.sin(t * 7) * 0.04, 0);
    } else if (st === 'hit') {
      setBCFrame(rig, 4);
      const snap = Math.sin(Math.min(1, rig.stateT / 0.36) * Math.PI);
      rig.mesh.position.set(-rig.spec.facing * snap * 0.34, 0, 0);
    } else if (st === 'victory') {
      setBCFrame(rig, 5);
      rig.mesh.position.set(0, Math.max(0, Math.sin(t * 5 + rig.phase)) * 0.12, 0);
    } else {
      // 待機：乾淨微呼吸上下浮動（完全不拉扯貼圖）
      setBCFrame(rig, 0);
      rig.mesh.position.set(0, Math.sin(t * 2.8 + rig.phase) * 0.025, 0);
    }
  } else {
    // ── 尚未建專屬 6 格圖之角色：衝刺播真實行走圖雙腳動畫，戰鬥播無扭曲高解析立繪＋剛體躍進！ ──
    if (st === 'run') {
      setSprRunFrame(rig, t);
      rig.mesh.position.set(0, Math.abs(Math.sin(t * 16)) * 0.14, 0);
    } else {
      u.uMap.value = rig.mainRec.tex;
      u.uUvRect.value.set(0, 0, 1, 1);
      u.uMirror.value = rig.spec.mirror;
      rig.mesh.scale.set(rig.baseW, rig.baseH, 1);
      if (st === 'attack') {
        const k = rig.stateT / 0.42;
        if (k < 0.34) {
          rig.mesh.position.set(-rig.spec.facing * 0.22 * (k / 0.34), 0, 0);
        } else {
          const p = Math.min(1, (k - 0.34) / 0.28);
          rig.mesh.position.set(rig.spec.facing * 0.55 * p, Math.sin(p * Math.PI) * 0.24, 0);
        }
      } else if (st === 'hit') {
        const snap = Math.sin(Math.min(1, rig.stateT / 0.36) * Math.PI);
        rig.mesh.position.set(-rig.spec.facing * snap * 0.35, 0, 0);
      } else if (st === 'cast' || st === 'victory') {
        rig.mesh.position.set(0, Math.max(0, Math.sin(t * 5 + rig.phase)) * 0.14, 0);
      } else {
        rig.mesh.position.set(0, Math.sin(t * 2.8 + rig.phase) * 0.025, 0);
      }
    }
  }
}
