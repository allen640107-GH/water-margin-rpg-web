// 香草社（Vanillaware）× Live2D 風格 2.5D 多關節頂點蒙皮彩繪骨架系統（Three.js + 自訂 GLSL 著色器）
// 徹底告別塊狀幾何人偶！以高細分網格（24×32）對所有手繪水墨英雄／敵人／猛獸／頭目做即時多關節變形、
// 3D 布料衣襬物理波浪、Sobel 擬法線立體打光、輪廓逆光與真實動態剪影投影！
import * as THREE from './vendor/three.module.min.js';
import { img, ready } from './assets.js';

// ── 共用 2.5D 多關節蒙皮頂點變形核心（同時驅動彩繪本體與真實 3D 陰影剪影！） ──
const RIG_VERT_CHUNK = `
  uniform float uTime;
  uniform float uPhase;
  uniform float uBreath;
  uniform float uCrouch;
  uniform float uLean;
  uniform float uTwist;
  uniform float uSwing;
  uniform float uStride;
  uniform float uHeadNod;
  uniform float uClothWind;
  uniform float uRecoil;
  uniform float uKind;   // 0 = 人形武將, 1 = 四足猛獸, 2 = 蜿蜒毒蛇
  uniform float uFacing; // -1 = 面朝左(我方好漢), +1 = 面朝右(敵人/頭目)

  vec3 deformSkeleton(vec3 pos, vec2 uv) {
    // 網格原點在腳底正中央 (y ∈ [0, H], x ∈ [-W/2, W/2])
    float h = clamp(uv.y, 0.0, 1.0);
    float edge = clamp(abs(uv.x - 0.5) * 2.0, 0.0, 1.0);
    float fwd = (uv.x - 0.5) * uFacing; // > 0 代表面朝前方／兵器側

    if (uKind < 0.5) {
      // ── 人形多關節骨架權重（腳踝、膝、骨盆、胸廓、雙肩兵器、頭部、披風） ──
      float legW   = smoothstep(0.02, 0.36, h) * (1.0 - smoothstep(0.32, 0.50, h));
      float waistW = smoothstep(0.32, 0.54, h);
      float chestW = smoothstep(0.46, 0.78, h);
      float headW  = smoothstep(0.76, 0.94, h);
      float clothW = smoothstep(0.14, 0.82, h) * pow(edge, 1.35);

      // 1) 呼吸胸廓起伏（體積守恆微擴張）
      pos.y += uBreath * chestW * 0.055;
      pos.x *= 1.0 + uBreath * chestW * 0.026;

      // 2) 下蹲／躍起壓縮（雙腳穩貼地面，膝蓋彎曲）
      pos.y *= 1.0 - uCrouch * 0.14 * (1.0 - h * 0.25);
      pos.x *= 1.0 + uCrouch * 0.08 * legW;

      // 3) 奔跑跨步剪刀擺動（下肢交替邁步＋重心高低彈跳）
      float stepWave = sin(uTime * 15.0 + uPhase);
      pos.x += stepWave * uStride * legW * (uv.x - 0.5) * 0.42;
      pos.y += abs(stepWave) * uStride * 0.06 * smoothstep(0.05, 0.25, h);
      pos.z += sin(uTime * 15.0 + uv.x * 5.0) * uStride * legW * 0.12;

      // 4) 前傾衝刺與腰部 3D 轉體（出招蓄力／揮斬真實 3D 扭腰！）
      pos.x += (uLean + uSwing * 0.65) * uFacing * waistW * 0.42;
      float tw = uTwist * waistW;
      float ct = cos(tw), st = sin(tw);
      float rx = pos.x * ct - pos.z * st;
      float rz = pos.x * st + pos.z * ct;
      pos.x = rx; pos.z = rz;

      // 5) 兵器與肩臂揮斬伸展（兵器側隨出招大幅前衝）
      float armW = smoothstep(0.42, 0.86, h) * smoothstep(-0.15, 0.45, fwd);
      pos.x += uSwing * uFacing * armW * 0.36;
      pos.y += sin(uSwing * 1.6) * armW * 0.12;
      pos.z += uSwing * armW * 0.24;

      // 6) 頭部獨立跟隨點頭與微動
      pos.y += uHeadNod * headW * 0.04;
      pos.x += uHeadNod * uFacing * headW * 0.03;

      // 7) 披風、衣袖、頭帶 3D Z 軸立體飄風物理波浪
      float windWave = sin(uTime * (3.2 + uStride * 6.0) + h * 5.5 - uv.x * 6.5 + uPhase);
      pos.z += windWave * uClothWind * clothW * 0.22;
      pos.x += windWave * uClothWind * clothW * 0.045 * (-uFacing);

      // 8) 受擊上半身劇烈後仰鞭打（腳仍釘在地上）
      pos.x -= uRecoil * uFacing * waistW * 0.48;
      pos.z -= uRecoil * chestW * 0.26;
      pos.y -= uRecoil * chestW * 0.08;
    } else if (uKind < 1.5) {
      // ── 四足猛獸骨架（猛虎、野狼、花豹、野豬、惡犬：弓背呼吸、飛撲伸展、張口咆哮、擺尾） ──
      float headZone = smoothstep(0.45, 0.88, uv.x * (uFacing > 0.0 ? 1.0 : -1.0) + (uFacing > 0.0 ? 0.0 : 1.0));
      float tailZone = 1.0 - smoothstep(0.15, 0.48, uv.x * (uFacing > 0.0 ? 1.0 : -1.0) + (uFacing > 0.0 ? 0.0 : 1.0));
      float bodyArch = sin(h * 3.14159);

      // 胸腹猛獸深呼吸與拱背
      pos.y += uBreath * smoothstep(0.2, 0.85, h) * 0.07;
      pos.x *= 1.0 + uBreath * bodyArch * 0.035;

      // 奔跑與飛撲伸長
      float gallop = sin(uTime * 14.0 + uPhase);
      pos.y += abs(gallop) * uStride * 0.11 * smoothstep(0.1, 0.5, h);
      pos.x += (uLean + uSwing * 0.85) * uFacing * (0.25 + headZone * 0.65) * 0.42;
      pos.y += uSwing * headZone * 0.18 - uCrouch * 0.16 * smoothstep(0.15, 0.8, h);

      // 獸尾與鬃毛 3D 擺動
      pos.z += sin(uTime * 4.5 + h * 4.0 + uPhase) * (tailZone * 0.22 + edge * 0.08) * uClothWind;
      // 受擊後仰
      pos.x -= uRecoil * uFacing * smoothstep(0.15, 0.85, h) * 0.42;
      pos.z -= uRecoil * 0.22;
    } else {
      // ── 毒蛇 S 形蜿蜒盤身骨架 ──
      float slither = sin(uTime * 5.2 + h * 7.5 + uPhase);
      pos.x += slither * (0.09 + uStride * 0.14) * smoothstep(0.05, 0.9, h);
      pos.z += cos(uTime * 5.2 + h * 7.5 + uPhase) * 0.16 * smoothstep(0.1, 0.9, h);
      pos.x += uSwing * uFacing * smoothstep(0.45, 0.95, h) * 0.52;
      pos.x -= uRecoil * uFacing * h * 0.38;
    }

    // 輕微 2.5D 凸面立體浮雕弧度（讓立繪在 3D 斜角鏡頭下具備飽滿厚實感！）
    float bulge = max(0.0, 1.0 - edge * edge) * sin(h * 3.14159);
    pos.z += bulge * 0.14;
    return pos;
  }
`;

const UNIT_VERT = `
  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying vec3 vViewDir;
  ${RIG_VERT_CHUNK}
  void main() {
    vUv = uv;
    vec3 p = deformSkeleton(position, uv);
    vec4 wp = modelMatrix * vec4(p, 1.0);
    vWorldPos = wp.xyz;
    vViewDir = normalize(cameraPosition - wp.xyz);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

// ── Sobel 擬法線立體打光＋邊緣輪廓逆光＋受擊白閃＋倒地水墨消散 ──
const UNIT_FRAG = `
  uniform sampler2D uMap;
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
  varying vec3 vWorldPos;
  varying vec3 vViewDir;

  float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

  void main() {
    vec2 uv = vec2(uMirror < 0.0 ? 1.0 - vUv.x : vUv.x, vUv.y);
    vec4 tex = texture2D(uMap, uv);
    if (tex.a < 0.36) discard;

    // 1) Sobel 擬法線：由手繪筆觸明暗即時推算 3D 浮雕法線，讓場景主光與火光真實打在甲冑肌肉上！
    float lL = luma(texture2D(uMap, uv + vec2(-uTexel.x, 0.0)).rgb);
    float lR = luma(texture2D(uMap, uv + vec2( uTexel.x, 0.0)).rgb);
    float lD = luma(texture2D(uMap, uv + vec2(0.0, -uTexel.y)).rgb);
    float lU = luma(texture2D(uMap, uv + vec2(0.0,  uTexel.y)).rgb);
    vec3 nrm = normalize(vec3((lL - lR) * 2.4 * uMirror, (lD - lU) * 2.4, 1.0));

    float diff = clamp(dot(nrm, normalize(uLightDir)) * 0.55 + 0.62, 0.45, 1.28);
    vec3 col = tex.rgb * uTint * (uAmbCol * 0.62 + uLightCol * diff * 0.78);

    // 2) 邊緣水墨輪廓光（檢測透明邊緣做立體 Rim Light，讓角色從 3D 背景中鮮明跳出！）
    float aL = texture2D(uMap, uv + vec2(-uTexel.x * 2.5, 0.0)).a;
    float aR = texture2D(uMap, uv + vec2( uTexel.x * 2.5, 0.0)).a;
    float aU = texture2D(uMap, uv + vec2(0.0,  uTexel.y * 2.5)).a;
    float edgeRim = clamp(1.0 - min(min(aL, aR), aU), 0.0, 1.0);
    col += uRimCol * edgeRim * uRimPower * (0.45 + 0.55 * vUv.y);

    // 3) 倒地墨化減飽和
    if (uDeadFade > 0.01) {
      float gr = luma(col);
      col = mix(col, vec3(gr * 0.45), uDeadFade * 0.85);
    }

    // 4) 受擊白熱高光爆發
    col = mix(col, vec3(1.0, 0.98, 0.92), clamp(uHitFlash, 0.0, 1.0));

    gl_FragColor = vec4(col, tex.a * uAlpha * (1.0 - uDeadFade * 0.42));
  }
`;

// 同步形變的 3D 剪影陰影著色器（確保角色投在雪地與石板上的影子與手繪輪廓 100% 貼合！）
const DEPTH_VERT = `
  varying vec2 vUv;
  ${RIG_VERT_CHUNK}
  void main() {
    vUv = uv;
    vec3 p = deformSkeleton(position, uv);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;
const DEPTH_FRAG = `
  uniform sampler2D uMap;
  uniform float uMirror;
  varying vec2 vUv;
  void main() {
    vec2 uv = vec2(uMirror < 0.0 ? 1.0 - vUv.x : vUv.x, vUv.y);
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

// 圓形柔和地影貼圖
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

// 依據角色類型與體型推算 3D 戰場尺寸與骨架種類
function unitSpec(actor) {
  if (!actor.isFoe) {
    const id = actor.hero.id;
    const tall = (id === 'luzhishen' || id === 'likui') ? 2.55 : (id === 'chaogai' || id === 'wusong') ? 2.4 : 2.3;
    const isBow = id === 'huarong';
    return { asset: 'bf_' + id, height: tall, kind: 0, mirror: 1, facing: -1, wKind: isBow ? 'bow' : 'melee' };
  }
  const rawImg = actor.img || 'e_bandit';
  const isHeroBoss = rawImg.startsWith('p_');
  const asset = isHeroBoss ? 'bf_' + rawImg.slice(2) : rawImg;
  const isSnake = /snake/.test(rawImg) || actor.key === 'snake';
  const isQuad = /tiger|wolf|leopard|boar|dog/.test(rawImg) || ['tiger', 'wolf', 'leopard', 'boar', 'dog'].includes(actor.key);
  let height = 2.25;
  if (actor.big || actor.boss) height = isQuad ? 2.55 : 2.65;
  else if (isQuad) height = /dog/.test(rawImg) ? 1.75 : 2.05;
  else if (isSnake) height = 1.65;
  const isBow = /archer/.test(rawImg);
  return {
    asset,
    height,
    kind: isSnake ? 2 : isQuad ? 1 : 0,
    mirror: isHeroBoss ? -1 : 1,
    facing: 1,
    wKind: isBow ? 'bow' : 'melee',
  };
}

// ── 建立 2.5D 多關節蒙皮彩繪戰鬥單位 ──
export function createBattleUnitModel(actor, biome = null) {
  const spec = unitSpec(actor);
  const rec = getUnitTex(spec.asset);
  const root = new THREE.Group();

  // 高細分 24×32 蒙皮網格（腳底置於 y=0）
  const geo = new THREE.PlaneGeometry(1, 1, 24, 32);
  geo.translate(0, 0.5, 0);

  const sunCol = biome ? new THREE.Color(biome.sun) : new THREE.Color(0xfff0d4);
  const ambCol = biome ? new THREE.Color(biome.amb) : new THREE.Color(0x9a9080);
  const rimCol = biome ? new THREE.Color(biome.rim) : new THREE.Color(0xffb45c);

  const uniforms = {
    uMap: { value: rec.tex },
    uTexel: { value: new THREE.Vector2(1 / 512, 1 / 512) },
    uLightDir: { value: new THREE.Vector3(0.5, 0.72, 0.48) },
    uLightCol: { value: sunCol },
    uAmbCol: { value: ambCol },
    uRimCol: { value: rimCol },
    uRimPower: { value: actor.isFoe ? 0.55 : 0.72 },
    uHitFlash: { value: 0 },
    uDeadFade: { value: 0 },
    uMirror: { value: spec.mirror },
    uTint: { value: new THREE.Color(0xffffff) },
    uAlpha: { value: 1.0 },
    // 骨架即時控制參數
    uTime: { value: 0 },
    uPhase: { value: Math.random() * 6.28 },
    uBreath: { value: 0 },
    uCrouch: { value: 0 },
    uLean: { value: 0 },
    uTwist: { value: 0 },
    uSwing: { value: 0 },
    uStride: { value: 0 },
    uHeadNod: { value: 0 },
    uClothWind: { value: 1.0 },
    uRecoil: { value: 0 },
    uKind: { value: spec.kind },
    uFacing: { value: spec.facing },
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
  mesh.receiveShadow = false;
  mesh.customDepthMaterial = new THREE.ShaderMaterial({
    vertexShader: DEPTH_VERT,
    fragmentShader: DEPTH_FRAG,
    uniforms,
    side: THREE.DoubleSide,
  });
  root.add(mesh);

  // 腳底接地柔陰影
  const shGeo = new THREE.PlaneGeometry(1.6, 0.9);
  shGeo.rotateX(-Math.PI / 2);
  const shadowDisc = new THREE.Mesh(shGeo, new THREE.MeshBasicMaterial({ map: getContactShadowTex(), transparent: true, depthWrite: false }));
  shadowDisc.position.y = 0.015;
  root.add(shadowDisc);

  // 防禦護盾與腳下回合光環
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

  const syncAspect = () => {
    if (ready(rec.im)) {
      if (!rec.uploaded) { rec.tex.image = rec.im; rec.tex.needsUpdate = true; rec.uploaded = true; }
      const aspect = rec.im.width / Math.max(1, rec.im.height);
      const w = spec.height * aspect;
      mesh.scale.set(w, spec.height, 1);
      uniforms.uTexel.value.set(1 / Math.max(128, rec.im.width), 1 / Math.max(128, rec.im.height));
      shadowDisc.scale.set(Math.min(1.65, w * 0.72), 1, 1);
    } else {
      mesh.scale.set(spec.height * 0.78, spec.height, 1);
    }
  };
  syncAspect();
  rec.im.addEventListener('load', syncAspect, { once: true });

  return {
    root, mesh, shadowDisc, shield, aura, uniforms, rec, syncAspect,
    spec, wKind: spec.wKind, isFoe: !!actor.isFoe, height: spec.height,
    state: 'idle', stateT: 0, phase: uniforms.uPhase.value,
    homePos: new THREE.Vector3(), homeRotY: 0,
    hitFlash: 0, isTurn: false, defending: false, enraged: false,
  };
}

// ── 建立 3D 衝刺／斬擊殘影分身（Vanillaware / Muramasa 風格殘影特效！） ──
export function createAfterimageMesh(rig, colorHex = 0xffd470) {
  const u = {};
  for (const [k, v] of Object.entries(rig.uniforms)) {
    u[k] = { value: v.value && v.value.clone ? v.value.clone() : v.value };
  }
  u.uTint.value = new THREE.Color(colorHex);
  u.uAlpha.value = 0.48;
  u.uRimPower.value = 1.6;
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
  m.rotation.copy(rig.root.rotation);
  return { mesh: m, mat, uniforms: u };
}

// ── 每幀驅動 2.5D 多關節蒙皮動畫狀態機 ──
export function animateBattleRig(rig, dt, t, camera) {
  if (!rig.rec.uploaded && ready(rig.rec.im)) rig.syncAspect();
  rig.stateT += dt;

  const u = rig.uniforms;
  const st = rig.state;
  const lerp = (cur, target, speed) => cur + (target - cur) * Math.min(1, dt * speed);
  u.uTime.value = t;

  // 柔和朝向攝影機（保持 3/4 立體透視，絕不側翻成薄紙！）
  if (camera) {
    const dx = camera.position.x - rig.root.position.x;
    const dz = camera.position.z - rig.root.position.z;
    const faceCam = Math.atan2(dx, dz);
    rig.root.rotation.y = faceCam * 0.62;
  }

  // 回合／狂暴輪廓光與腳下光環
  rig.shield.visible = !!rig.defending && st !== 'dead';
  if (rig.shield.visible) rig.shield.rotation.y += dt * 1.6;

  const wantAura = st === 'cast' ? 0.92 : rig.isTurn ? (0.55 + 0.25 * Math.sin(t * 6)) : rig.enraged ? 0.6 : 0;
  rig.aura.material.opacity = lerp(rig.aura.material.opacity, wantAura, 10);
  rig.aura.material.color.setHex(rig.enraged ? 0xff2c1a : st === 'cast' ? 0x70d8ff : 0xffd864);
  rig.aura.rotation.z = t * 1.4;

  // 輪廓光隨回合／狂暴動態增強
  const wantRim = rig.enraged ? 1.55 : rig.isTurn ? 1.35 : st === 'cast' ? 1.7 : (rig.isFoe ? 0.52 : 0.72);
  u.uRimPower.value = lerp(u.uRimPower.value, wantRim, 8);
  if (rig.enraged) u.uRimCol.value.setHex(0xff3820);
  else if (st === 'cast') u.uRimCol.value.setHex(0x88dcff);
  else if (rig.isTurn) u.uRimCol.value.setHex(0xffe078);

  if (rig.hitFlash > 0) {
    rig.hitFlash = Math.max(0, rig.hitFlash - dt * 5.2);
  }
  u.uHitFlash.value = rig.hitFlash;

  // 動作狀態機 → 驅動多關節 Shader 權重
  const ph = t * 2.8 + rig.phase;
  if (st === 'dead') {
    u.uDeadFade.value = lerp(u.uDeadFade.value, 1.0, 5);
    u.uCrouch.value = lerp(u.uCrouch.value, 1.6, 6);
    u.uLean.value = lerp(u.uLean.value, -0.5, 5);
    u.uBreath.value = 0; u.uStride.value = 0; u.uSwing.value = 0; u.uClothWind.value = 0.2;
    rig.mesh.rotation.z = lerp(rig.mesh.rotation.z, rig.isFoe ? -0.35 : 0.35, 6);
    return;
  }
  u.uDeadFade.value = lerp(u.uDeadFade.value, 0.0, 8);
  rig.mesh.rotation.z = lerp(rig.mesh.rotation.z, 0, 10);

  if (st === 'idle') {
    u.uBreath.value = Math.sin(ph);
    u.uCrouch.value = lerp(u.uCrouch.value, 0.12 + Math.sin(ph * 0.5) * 0.08, 7);
    u.uLean.value = lerp(u.uLean.value, Math.sin(ph * 0.5) * 0.06, 7);
    u.uTwist.value = lerp(u.uTwist.value, Math.sin(ph * 0.45) * 0.14, 7);
    u.uSwing.value = lerp(u.uSwing.value, 0, 10);
    u.uStride.value = lerp(u.uStride.value, 0, 10);
    u.uHeadNod.value = Math.sin(ph * 0.75) * 0.35;
    u.uClothWind.value = lerp(u.uClothWind.value, 1.05, 6);
    u.uRecoil.value = lerp(u.uRecoil.value, 0, 12);
  } else if (st === 'run') {
    u.uBreath.value = 0.3;
    u.uCrouch.value = lerp(u.uCrouch.value, 0.35, 12);
    u.uLean.value = lerp(u.uLean.value, 0.72, 12);
    u.uTwist.value = Math.sin(t * 15) * 0.24;
    u.uSwing.value = lerp(u.uSwing.value, 0.15, 10);
    u.uStride.value = lerp(u.uStride.value, 1.0, 14);
    u.uHeadNod.value = 0.25;
    u.uClothWind.value = 2.1;
    u.uRecoil.value = 0;
  } else if (st === 'attack') {
    const k = Math.min(1, rig.stateT / 0.42);
    if (k < 0.32) {
      // 蓄力後拉與深蹲
      const p = k / 0.32;
      u.uCrouch.value = 0.55 * p;
      u.uLean.value = -0.45 * p;
      u.uTwist.value = -0.68 * p * rig.spec.facing;
      u.uSwing.value = -0.35 * p;
      u.uClothWind.value = 1.6;
    } else {
      // 爆發前劈＋扭腰揮斬！
      const p = Math.min(1, (k - 0.32) / 0.36);
      const ease = 1 - Math.pow(1 - p, 3);
      u.uCrouch.value = 0.55 * (1 - ease);
      u.uLean.value = -0.45 + 1.35 * ease;
      u.uTwist.value = (-0.68 + 1.48 * ease) * rig.spec.facing;
      u.uSwing.value = -0.35 + 1.55 * ease;
      u.uClothWind.value = 2.6;
    }
    u.uStride.value = 0.2;
  } else if (st === 'cast') {
    const pulse = Math.sin(rig.stateT * 10);
    u.uBreath.value = 0.8 + pulse * 0.35;
    u.uCrouch.value = lerp(u.uCrouch.value, -0.18, 8);
    u.uLean.value = lerp(u.uLean.value, -0.18, 8);
    u.uTwist.value = pulse * 0.28;
    u.uSwing.value = 0.28 + pulse * 0.15;
    u.uHeadNod.value = 0.55;
    u.uClothWind.value = 2.5;
  } else if (st === 'hit') {
    const k = Math.min(1, rig.stateT / 0.38);
    const snap = Math.sin(k * Math.PI);
    u.uRecoil.value = snap * 1.15;
    u.uCrouch.value = snap * 0.35;
    u.uTwist.value = -snap * 0.45 * rig.spec.facing;
    u.uClothWind.value = 2.0;
  } else if (st === 'victory') {
    const v = Math.sin(t * 4.2 + rig.phase);
    u.uBreath.value = 0.7 + v * 0.35;
    u.uCrouch.value = lerp(u.uCrouch.value, -0.12 + Math.max(0, v) * 0.14, 8);
    u.uLean.value = lerp(u.uLean.value, 0.15, 6);
    u.uTwist.value = Math.sin(t * 2.2) * 0.25;
    u.uSwing.value = 0.22 + Math.max(0, v) * 0.25;
    u.uClothWind.value = 1.85;
  }
}
