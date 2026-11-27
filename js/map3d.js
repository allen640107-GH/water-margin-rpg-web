// HD-2D 水墨主機級 2.5D 地圖渲染引擎（Three.js + 自訂水面/景深/泛光著色器）
// 100% 沿用既有 36 張 ASCII 地圖資料與 2D 水墨美術素材，支援高畫質 / 流暢切換與自動降級
import * as THREE from './vendor/three.module.min.js';
import { img, ready } from './assets.js';
import { G, flag } from './state.js';
import { HEROES } from './data/heroes.js';
import { ARCHETYPES, BOSSES } from './data/enemies.js';

// ── 主題光影與大氣調色（十種場景＋夜間／天候） ──
const ATMOS = {
  town:     { bg: 0x2a241b, fog: 0xd8c8a8, fogD: 0.013, sun: 0xffe4b8, sunI: 1.55, sunPos: [10, 17, 9],  hemiSky: 0xfff0d4, hemiGnd: 0x5c4a35, hemiI: 0.92, lantern: true,  particles: 'motes',  grade: [1.04, 1.01, 0.95] },
  manor:    { bg: 0x262119, fog: 0xd9cbb2, fogD: 0.012, sun: 0xffe8c2, sunI: 1.50, sunPos: [12, 18, 8],  hemiSky: 0xfff3dd, hemiGnd: 0x584938, hemiI: 0.90, lantern: true,  particles: 'petals', grade: [1.03, 1.01, 0.96] },
  village:  { bg: 0x25281c, fog: 0xd5d2b8, fogD: 0.014, sun: 0xffebc0, sunI: 1.52, sunPos: [11, 16, 10], hemiSky: 0xf4f0d4, hemiGnd: 0x4b5434, hemiI: 0.92, lantern: false, particles: 'motes',  grade: [1.02, 1.02, 0.95] },
  fort:     { bg: 0x221d18, fog: 0xc2b29b, fogD: 0.016, sun: 0xffd196, sunI: 1.55, sunPos: [-11, 15, 9], hemiSky: 0xf2d9b8, hemiGnd: 0x4a3b2c, hemiI: 0.85, lantern: true,  particles: 'embers', grade: [1.06, 0.99, 0.92] },
  wild:     { bg: 0x182118, fog: 0xaab8a4, fogD: 0.020, sun: 0xeaf0cf, sunI: 1.38, sunPos: [9, 16, 10],  hemiSky: 0xd8e5cf, hemiGnd: 0x2d3f28, hemiI: 0.88, lantern: false, particles: 'leaves', grade: [0.97, 1.03, 0.96] },
  hills:    { bg: 0x242019, fog: 0xc8bca6, fogD: 0.017, sun: 0xffdaa8, sunI: 1.52, sunPos: [-10, 14, 9], hemiSky: 0xf0dfbe, hemiGnd: 0x554736, hemiI: 0.86, lantern: false, particles: 'leaves', grade: [1.05, 1.00, 0.93] },
  snow:     { bg: 0x1a222b, fog: 0xc6d3df, fogD: 0.022, sun: 0xddeeff, sunI: 1.35, sunPos: [8, 15, 10],  hemiSky: 0xdce9f7, hemiGnd: 0x556475, hemiI: 1.02, lantern: true,  particles: 'snow',   grade: [0.94, 0.99, 1.07] },
  water:    { bg: 0x162226, fog: 0xaec2c4, fogD: 0.018, sun: 0xf3edd6, sunI: 1.42, sunPos: [10, 16, 10], hemiSky: 0xdceae8, hemiGnd: 0x354d4f, hemiI: 0.92, lantern: false, particles: 'mist',   grade: [0.95, 1.02, 1.03] },
  interior: { bg: 0x140e09, fog: 0x22160d, fogD: 0.020, sun: 0xffc680, sunI: 0.85, sunPos: [4, 14, 8],   hemiSky: 0xffd5a0, hemiGnd: 0x332012, hemiI: 0.72, lantern: true,  particles: 'motes',  grade: [1.08, 0.98, 0.88] },
  cave:     { bg: 0x0b0b10, fog: 0x131520, fogD: 0.030, sun: 0x8aa0c8, sunI: 0.55, sunPos: [3, 14, 6],   hemiSky: 0x627394, hemiGnd: 0x1d1a18, hemiI: 0.62, lantern: true,  particles: 'embers', grade: [0.94, 0.96, 1.08] },
};

// ── 水面 GLSL 著色器：雙層水波、浮光高光、岸邊白沫 ──
const WATER_VERT = `
  varying vec2 vWorldXZ;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldXZ = wp.xz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;
const WATER_FRAG = `
  uniform float uTime;
  uniform vec3 uShallow;
  uniform vec3 uDeep;
  uniform vec3 uSpec;
  uniform float uNight;
  varying vec2 vWorldXZ;
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }

  void main() {
    vec2 p = vWorldXZ * 1.35;
    float w1 = noise(p + vec2(uTime * 0.42, uTime * 0.23));
    float w2 = noise(p * 2.1 - vec2(uTime * 0.31, -uTime * 0.38));
    float wave = (w1 * 0.6 + w2 * 0.4);
    float ripple = sin(vWorldXZ.x * 5.2 + uTime * 2.2 + w1 * 4.0) * sin(vWorldXZ.y * 4.6 - uTime * 1.7 + w2 * 3.5);
    float glint = smoothstep(0.66, 0.96, wave + ripple * 0.22);

    vec3 col = mix(uDeep, uShallow, wave * 0.72 + 0.14);
    col += uSpec * glint * (uNight > 0.5 ? 0.55 : 0.75);

    // 格邊柔和波沫（vUv.x/y 靠近 0 或 1 的岸線由顏色暗示）
    float caustic = smoothstep(0.58, 0.85, sin(vWorldXZ.x * 3.0 + vWorldXZ.y * 2.5 + uTime * 1.6) * 0.5 + 0.5) * 0.12;
    col += vec3(0.85, 0.95, 0.96) * caustic;

    gl_FragColor = vec4(col, 0.74);
  }
`;

// ── HD-2D 後製著色器：Tilt-Shift 景深虛化 + 泛光 Bloom + 水墨電影調色 + 暗角 ──
const POST_VERT = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;
const POST_FRAG = `
  uniform sampler2D tDiffuse;
  uniform vec2 uRes;
  uniform float uDof;
  uniform float uBloom;
  uniform vec3 uGrade;
  uniform float uVignette;
  uniform float uTime;
  varying vec2 vUv;

  vec3 aces(vec3 x) {
    const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
    return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
  }

  void main() {
    vec2 texel = 1.0 / max(uRes, vec2(1.0));
    vec3 center = texture2D(tDiffuse, vUv).rgb;

    // 1) Tilt-Shift 景深：畫面中段（主角位置）極銳利，遠景頂部與前景底部柔和虛化
    float distY = abs(vUv.y - 0.49);
    float blurAmt = smoothstep(0.18, 0.52, distY) * uDof;
    vec3 col = center;
    if (blurAmt > 0.01) {
      vec3 acc = center * 0.24;
      float r = blurAmt * 3.2;
      acc += texture2D(tDiffuse, vUv + texel * vec2( r,  0.0)).rgb * 0.11;
      acc += texture2D(tDiffuse, vUv + texel * vec2(-r,  0.0)).rgb * 0.11;
      acc += texture2D(tDiffuse, vUv + texel * vec2( 0.0,  r)).rgb * 0.11;
      acc += texture2D(tDiffuse, vUv + texel * vec2( 0.0, -r)).rgb * 0.11;
      acc += texture2D(tDiffuse, vUv + texel * vec2( r * 0.72,  r * 0.72)).rgb * 0.08;
      acc += texture2D(tDiffuse, vUv + texel * vec2(-r * 0.72,  r * 0.72)).rgb * 0.08;
      acc += texture2D(tDiffuse, vUv + texel * vec2( r * 0.72, -r * 0.72)).rgb * 0.08;
      acc += texture2D(tDiffuse, vUv + texel * vec2(-r * 0.72, -r * 0.72)).rgb * 0.08;
      col = acc;
    }

    // 2) 柔光 Bloom（擷取燈籠、水波、亮雪與出口金光）
    if (uBloom > 0.01) {
      vec3 glow = vec3(0.0);
      float br = 4.2;
      vec2 offs[8];
      offs[0] = vec2( br, 0.0); offs[1] = vec2(-br, 0.0);
      offs[2] = vec2(0.0,  br); offs[3] = vec2(0.0, -br);
      offs[4] = vec2( br * 0.7,  br * 0.7); offs[5] = vec2(-br * 0.7,  br * 0.7);
      offs[6] = vec2( br * 0.7, -br * 0.7); offs[7] = vec2(-br * 0.7, -br * 0.7);
      for (int i = 0; i < 8; i++) {
        vec3 s = texture2D(tDiffuse, vUv + texel * offs[i]).rgb;
        float l = dot(s, vec3(0.299, 0.587, 0.114));
        glow += s * smoothstep(0.68, 1.05, l);
      }
      col += (glow / 8.0) * uBloom;
    }

    // 3) 水墨電影調色、對比與宣紙微暖質感
    col *= uGrade;
    col = mix(col, aces(col * 1.08), 0.52);

    // 4) 電影暗角（Vignette）
    vec2 dv = vUv - 0.5;
    float vig = 1.0 - dot(dv, dv) * uVignette;
    col *= clamp(vig, 0.52, 1.0);

    gl_FragColor = vec4(col, 1.0);
  }
`;

// ── 動態紋理快取（與 js/assets.js 連動，圖載完自動上傳 GPU） ──
const texCache = new Map();
function getTexture(assetName, opts = {}) {
  const key = assetName + (opts.repeat ? ':rep' : '') + (opts.nearest ? ':n' : '');
  let rec = texCache.get(key);
  if (!rec) {
    const im = img(assetName);
    const tex = new THREE.Texture(im);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.generateMipmaps = !opts.noMip;
    tex.minFilter = opts.noMip ? THREE.LinearFilter : THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    if (opts.repeat) {
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = opts.repeatY ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
    } else {
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
    }
    rec = { tex, im, uploaded: false };
    texCache.set(key, rec);
  }
  if (!rec.uploaded && ready(rec.im)) {
    rec.tex.image = rec.im;
    rec.tex.needsUpdate = true;
    rec.uploaded = true;
  }
  return rec;
}

// 圓形柔邊地面陰影貼圖（程序產生，免外部圖檔）
let shadowDiscTex = null;
function getShadowDiscTex() {
  if (shadowDiscTex) return shadowDiscTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 4, 32, 32, 30);
  gr.addColorStop(0, 'rgba(10,7,4,0.52)');
  gr.addColorStop(0.6, 'rgba(10,7,4,0.22)');
  gr.addColorStop(1, 'rgba(10,7,4,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  shadowDiscTex = new THREE.CanvasTexture(c);
  return shadowDiscTex;
}

// 柔光粒子貼圖
let softParticleTex = null;
function getParticleTex() {
  if (softParticleTex) return softParticleTex;
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(16, 16, 1, 16, 16, 15);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.45, 'rgba(255,250,235,0.65)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 32, 32);
  softParticleTex = new THREE.CanvasTexture(c);
  return softParticleTex;
}

// 出口光柱貼圖
let beamTex = null;
function getBeamTex() {
  if (beamTex) return beamTex;
  const c = document.createElement('canvas');
  c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 128, 0, 0);
  gr.addColorStop(0, 'rgba(255,220,120,0.58)');
  gr.addColorStop(0.45, 'rgba(255,230,150,0.22)');
  gr.addColorStop(1, 'rgba(255,240,180,0)');
  g.fillStyle = gr;
  g.fillRect(8, 0, 48, 128);
  beamTex = new THREE.CanvasTexture(c);
  return beamTex;
}

// ── 角色精靈 UV 設定（3 欄 × 4 列） ──
function setSpriteUV(geo, frame, dir) {
  const u0 = frame / 3;
  const u1 = (frame + 1) / 3;
  // Three.js UV 原點在左下，所以 row 0 (上) 在 v = [0.75, 1.0]，row 3 (左) 在 [0, 0.25]
  const v1 = 1 - dir / 4;
  const v0 = 1 - (dir + 1) / 4;
  const uv = geo.attributes.uv;
  uv.setXY(0, u0, v1);
  uv.setXY(1, u1, v1);
  uv.setXY(2, u0, v0);
  uv.setXY(3, u1, v0);
  uv.needsUpdate = true;
}

// ── 狀態與實例 ──
export class HD2DRenderer {
  constructor(overlayCanvas) {
    this.overlay = overlayCanvas;
    this.ok = false;
    this.quality = 'high'; // 'high' | 'lite'
    this.cw = 1;
    this.ch = 1;
    this.dpr = 1;

    try {
      const cv = document.createElement('canvas');
      cv.id = 'map3d';
      cv.setAttribute('aria-hidden', 'true');
      overlayCanvas.parentElement.insertBefore(cv, overlayCanvas);
      this.canvas = cv;

      this.renderer = new THREE.WebGLRenderer({
        canvas: cv,
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
      });
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.renderer.toneMapping = THREE.NoToneMapping; // 後製 shader 處理電影調色

      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(34, 1, 0.5, 140);

      // 後製管線
      this.rt = null;
      this.postScene = new THREE.Scene();
      this.postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      this.postMat = new THREE.ShaderMaterial({
        vertexShader: POST_VERT,
        fragmentShader: POST_FRAG,
        uniforms: {
          tDiffuse: { value: null },
          uRes: { value: new THREE.Vector2(1, 1) },
          uDof: { value: 1.0 },
          uBloom: { value: 0.36 },
          uGrade: { value: new THREE.Vector3(1.02, 1.0, 0.96) },
          uVignette: { value: 0.55 },
          uTime: { value: 0 },
        },
        depthTest: false,
        depthWrite: false,
      });
      this.postQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.postMat);
      this.postScene.add(this.postQuad);

      // 射線投射（滑鼠點擊精準對應 3D 地面座標）
      this.raycaster = new THREE.Raycaster();
      this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

      // 場景群組
      this.staticGroup = new THREE.Group();
      this.dynamicGroup = new THREE.Group();
      this.lightGroup = new THREE.Group();
      this.scene.add(this.staticGroup, this.dynamicGroup, this.lightGroup);

      // 共用幾何
      this.unitPlane = new THREE.PlaneGeometry(1, 1);
      this.shadowGeo = new THREE.PlaneGeometry(1, 1);
      this.shadowGeo.rotateX(-Math.PI / 2);
      this.shadowMat = new THREE.MeshBasicMaterial({
        map: getShadowDiscTex(),
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      });

      // 鏡頭狀態
      this.camTarget = new THREE.Vector3(0, 0.35, 0);
      this.camInit = false;
      this.lastTime = 0;
      this.shakeAmt = 0;

      // 場景追蹤
      this.mapId = null;
      this.groundTex = null;
      this.groundCanvasRef = null;
      this.waterUniforms = null;
      this.swayTrees = [];
      this.swayReeds = [];
      this.lanternLights = [];
      this.heroLight = null;
      this.sunLight = null;
      this.particles = null;
      this.particleMeta = null;
      this.entityPool = new Map();
      this.boatGroup = null;
      this.destRing = null;
      this.worldImgMesh = null;
      // 活靈活現角色動態與腳步特效狀態
      this.footPuffs = [];
      this.lastStepCount = -1;
      this.lastPlayerDir = -1;
      this.turnBounce = 0;
      this.puffGeo = new THREE.PlaneGeometry(0.32, 0.32);
      this.puffGeo.rotateX(-Math.PI / 2);

      this.canvas.addEventListener('webglcontextlost', e => {
        e.preventDefault();
        this.ok = false;
      });
      this.ok = true;
    } catch (err) {
      console.warn('HD-2D WebGL 初始化失敗，降級為 2D 渲染', err);
      this.ok = false;
    }
  }

  setQuality(q) {
    this.quality = q === 'lite' ? 'lite' : 'high';
    if (!this.ok) return;
    this.renderer.shadowMap.enabled = true;
    this.resize(this.cw, this.ch, this.dpr);
  }

  setVisible(vis) {
    if (this.canvas) this.canvas.hidden = !vis;
  }

  triggerShake(power = 0.28) {
    this.shakeAmt = Math.max(this.shakeAmt, power);
  }

  resize(cw, ch, dpr) {
    if (!this.ok) return;
    this.cw = Math.max(1, cw);
    this.ch = Math.max(1, ch);
    this.dpr = Math.min(dpr || 1, this.quality === 'high' ? 2 : 1.5);
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(this.cw, this.ch, false);
    this.camera.aspect = this.cw / this.ch;
    this.camera.updateProjectionMatrix();

    const rw = Math.max(1, Math.round(this.cw * this.dpr));
    const rh = Math.max(1, Math.round(this.ch * this.dpr));
    if (this.rt) this.rt.dispose();
    this.rt = new THREE.WebGLRenderTarget(rw, rh, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
    });
    this.postMat.uniforms.uRes.value.set(rw, rh);
  }

  // 清除上一張地圖的靜態／動態物件
  clearScene() {
    const disposeGroup = (grp, keepShared = true) => {
      while (grp.children.length) {
        const ch = grp.children.pop();
        ch.traverse(obj => {
          if (obj.geometry && obj.geometry !== this.unitPlane && obj.geometry !== this.shadowGeo) {
            obj.geometry.dispose();
          }
          if (obj.material && obj.material !== this.shadowMat && !obj.userData.sharedMat) {
            if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
            else obj.material.dispose();
          }
        });
      }
    };
    disposeGroup(this.staticGroup);
    disposeGroup(this.dynamicGroup);
    disposeGroup(this.lightGroup);
    if (this.groundTex) { this.groundTex.dispose(); this.groundTex = null; }
    this.groundCanvasRef = null;
    this.waterUniforms = null;
    this.swayTrees = [];
    this.swayReeds = [];
    this.lanternLights = [];
    this.heroLight = null;
    this.sunLight = null;
    this.particles = null;
    this.particleMeta = null;
    this.entityPool.clear();
    this.footPuffs = [];
    this.lastStepCount = -1;
    this.lastPlayerDir = -1;
    this.turnBounce = 0;
    this.boatGroup = null;
    this.destRing = null;
    this.worldImgMesh = null;
    this.camInit = false;
  }

  // 根據目前地圖重建 3D 場景
  buildMap(M, S, helpers) {
    if (!this.ok) return;
    this.clearScene();
    this.mapId = M.id;

    const def = M.def;
    const tname = S.themeName || 'town';
    const baseAtm = ATMOS[tname] || ATMOS.town;
    const isNight = !!def.night;
    const isSnow = def.weather === 'snow' || tname === 'snow';
    const isFog = def.weather === 'fog';
    const isHeat = def.weather === 'heat';
    const isFire = M.id === 'caoliao' || M.id === 'shanshenmiao' || M.id === 'fachang';

    // 背景與景深霧色
    let bgHex = baseAtm.bg;
    let fogHex = baseAtm.fog;
    let fogD = baseAtm.fogD;
    if (isNight) { bgHex = 0x0b1020; fogHex = 0x162038; fogD = Math.max(fogD, 0.022); }
    if (isFog) { fogHex = 0xd2d8d6; fogD = 0.036; }
    if (isHeat) { fogHex = 0xe8c788; fogD = 0.015; }
    this.scene.background = new THREE.Color(bgHex);
    this.scene.fog = new THREE.FogExp2(fogHex, fogD);

    // 後製調色參數
    const g = baseAtm.grade.slice();
    if (isNight) { g[0] *= 0.88; g[1] *= 0.94; g[2] *= 1.14; }
    if (isHeat) { g[0] *= 1.08; g[1] *= 1.02; g[2] *= 0.88; }
    this.postMat.uniforms.uGrade.value.set(g[0], g[1], g[2]);
    this.postMat.uniforms.uDof.value = this.quality === 'high' ? (def.image ? 0.35 : 0.95) : 0.0;
    this.postMat.uniforms.uBloom.value = this.quality === 'high' ? (isNight || isFire ? 0.48 : 0.30) : 0.0;
    this.postMat.uniforms.uVignette.value = isNight || tname === 'cave' || tname === 'interior' ? 0.88 : 0.52;

    // 主光源（日光／月光＋即時陰影）
    const hemiSky = isNight ? 0x3b4f82 : baseAtm.hemiSky;
    const hemiGnd = isNight ? 0x141724 : baseAtm.hemiGnd;
    const hemiI = isNight ? 0.62 : baseAtm.hemiI;
    this.lightGroup.add(new THREE.HemisphereLight(hemiSky, hemiGnd, hemiI));

    const sunColor = isNight ? 0x8fb4ff : isHeat ? 0xffd188 : baseAtm.sun;
    const sunInt = isNight ? 0.72 : baseAtm.sunI;
    const sun = new THREE.DirectionalLight(sunColor, sunInt);
    sun.position.set(...baseAtm.sunPos);
    sun.castShadow = true;
    const smSize = this.quality === 'high' ? 2048 : 1024;
    sun.shadow.mapSize.set(smSize, smSize);
    sun.shadow.camera.near = 2;
    sun.shadow.camera.far = 48;
    const sd = 13;
    sun.shadow.camera.left = -sd;
    sun.shadow.camera.right = sd;
    sun.shadow.camera.top = sd;
    sun.shadow.camera.bottom = -sd;
    sun.shadow.bias = -0.0008;
    sun.shadow.normalBias = 0.03;
    this.lightGroup.add(sun);
    this.lightGroup.add(sun.target);
    this.sunLight = sun;
    this.sunOffset = new THREE.Vector3(...baseAtm.sunPos);

    // 主角隨身暖光（夜晚、洞窟、室內亮如燈籠，白天為微弱暖補光）
    const heroLightI = isNight || tname === 'cave' ? 2.6 : tname === 'interior' ? 1.8 : 0.55;
    const heroLightDist = isNight || tname === 'cave' ? 8.5 : 5.5;
    this.heroLight = new THREE.PointLight(0xffb45c, heroLightI, heroLightDist, 1.5);
    this.heroLight.position.set(M.px + 0.5, 1.4, M.py + 0.5);
    this.lightGroup.add(this.heroLight);

    // ── 世界地圖特殊處理（古卷軸俯視光影） ──
    if (def.image) {
      this.buildImageMap(M, def);
      this.buildParticles(M, 'motes', isNight);
      return;
    }

    // ── 1) 地表平面（銜接 map.js 預繪柔邊地表） ──
    const gGeo = new THREE.PlaneGeometry(M.W, M.H);
    gGeo.rotateX(-Math.PI / 2);
    const gMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: isSnow ? 0.78 : 0.92,
      metalness: 0.02,
    });
    const groundMesh = new THREE.Mesh(gGeo, gMat);
    groundMesh.position.set(M.W / 2, 0, M.H / 2);
    groundMesh.receiveShadow = true;
    this.staticGroup.add(groundMesh);
    this.groundMesh = groundMesh;

    // 外圍延伸地裙（避免傾斜鏡頭看到地圖邊緣黑塊）
    const skirtGeo = new THREE.PlaneGeometry(M.W + 32, M.H + 32);
    skirtGeo.rotateX(-Math.PI / 2);
    const skirtMat = new THREE.MeshStandardMaterial({
      color: isSnow ? 0xb5c3cf : tname === 'water' ? 0x3b6374 : tname === 'cave' || tname === 'interior' ? 0x16110c : 0x3e4c2e,
      roughness: 1.0,
    });
    const skirt = new THREE.Mesh(skirtGeo, skirtMat);
    skirt.position.set(M.W / 2, -0.06, M.H / 2);
    skirt.receiveShadow = true;
    this.staticGroup.add(skirt);

    // ── 2) 動態水面著色器網格 ──
    this.buildWater(M, S, isNight, isSnow);

    // ── 3) 真 3D 城牆、懸崖、木柵與木橋 ──
    this.buildWallsAndBridges(M, S, helpers);

    // ── 4) 立體建築、門與自動燈籠點光源 ──
    this.buildBuildings(M, S, baseAtm, isNight, isFire);

    // ── 5) 立體樹木與蘆葦 ──
    this.buildFoliage(M, S);

    // ── 6) 3D 氣候與氛圍粒子 ──
    const pKind = isSnow ? 'snow' : isFog ? 'mist' : isFire ? 'embers' : baseAtm.particles;
    this.buildParticles(M, pKind, isNight);

    // ── 7) 目的地光環 ──
    const drGeo = new THREE.RingGeometry(0.24, 0.36, 24);
    drGeo.rotateX(-Math.PI / 2);
    const drMat = new THREE.MeshBasicMaterial({
      color: 0xffdf7a,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.destRing = new THREE.Mesh(drGeo, drMat);
    this.destRing.visible = false;
    this.dynamicGroup.add(this.destRing);
  }

  buildImageMap(M, def) {
    const geo = new THREE.PlaneGeometry(M.W, M.H);
    geo.rotateX(-Math.PI / 2);
    const rec = getTexture(def.image);
    const mat = new THREE.MeshStandardMaterial({ map: rec.tex, roughness: 0.88, metalness: 0.02 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(M.W / 2, 0, M.H / 2);
    mesh.receiveShadow = true;
    this.staticGroup.add(mesh);
    this.worldImgMesh = { mesh, rec };
  }

  buildWater(M, S, isNight, isSnow) {
    const positions = [];
    const uvs = [];
    const indices = [];
    let vi = 0;
    for (let y = 0; y < M.H; y++) {
      for (let x = 0; x < M.W; x++) {
        const c = M.rows[y][x];
        const isW = c === '~' || (M.def.boat && (c === 'r' || c === 'o'));
        if (!isW) continue;
        const x0 = x - 0.03, x1 = x + 1.03, z0 = y - 0.03, z1 = y + 1.03;
        positions.push(x0, 0.022, z0, x1, 0.022, z0, x1, 0.022, z1, x0, 0.022, z1);
        uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
        indices.push(vi, vi + 2, vi + 1, vi, vi + 3, vi + 2);
        vi += 4;
      }
    }
    if (!vi) return;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    this.waterUniforms = {
      uTime: { value: 0 },
      uShallow: { value: new THREE.Color(isSnow ? 0x5c8499 : isNight ? 0x1d3f54 : 0x4b879c) },
      uDeep:    { value: new THREE.Color(isSnow ? 0x2a4557 : isNight ? 0x0e2030 : 0x204d60) },
      uSpec:    { value: new THREE.Color(isNight ? 0x9ec8ff : 0xfff3d1) },
      uNight:   { value: isNight ? 1.0 : 0.0 },
    };
    const mat = new THREE.ShaderMaterial({
      vertexShader: WATER_VERT,
      fragmentShader: WATER_FRAG,
      uniforms: this.waterUniforms,
      transparent: true,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    this.staticGroup.add(mesh);
  }

  buildWallsAndBridges(M, S, helpers) {
    const tile = helpers.tile;
    const solidGroup = helpers.solidGroup;

    // 依材質分群組建立 3D 擠出牆體（單一合併幾何＝極少 Draw Call）
    const buckets = new Map();
    const pushQuad = (matKey, p0, p1, p2, p3, u0, v0, u1, v1) => {
      let b = buckets.get(matKey);
      if (!b) { b = { pos: [], uv: [], idx: [], vi: 0 }; buckets.set(matKey, b); }
      b.pos.push(...p0, ...p1, ...p2, ...p3);
      b.uv.push(u0, v0, u1, v0, u1, v1, u0, v1);
      b.idx.push(b.vi, b.vi + 1, b.vi + 2, b.vi, b.vi + 2, b.vi + 3);
      b.vi += 4;
    };

    for (let y = 0; y < M.H; y++) {
      for (let x = 0; x < M.W; x++) {
        const c = tile(x, y);
        // 木橋：略高於水面＋兩側立體木欄杆
        if (c === '=') {
          const vert = tile(x, y - 1) === '=' || tile(x, y + 1) === '=' ||
            (!['~', 'r'].includes(tile(x, y - 1)) && !['~', 'r'].includes(tile(x, y + 1)) ? false : (tile(x - 1, y) === '~' && tile(x + 1, y) === '~'));
          const by = 0.1;
          const x0 = vert ? x + 0.06 : x - 0.02, x1 = vert ? x + 0.94 : x + 1.02;
          const z0 = vert ? y - 0.02 : y + 0.1, z1 = vert ? y + 1.02 : y + 0.9;
          pushQuad('wood', [x0, by, z1], [x1, by, z1], [x1, by, z0], [x0, by, z0], 0, 0, 1.5, 1.5);
          // 橋側厚邊＋低矮護欄
          pushQuad('wood_dark', [x0, 0, z1], [x1, 0, z1], [x1, by, z1], [x0, by, z1], 0, 0, 1, 0.35);
          const rh = by + 0.16;
          if (!vert) {
            pushQuad('wood_rail', [x0, by, z0 + 0.06], [x1, by, z0 + 0.06], [x1, rh, z0 + 0.06], [x0, rh, z0 + 0.06], 0, 0, 1, 0.3);
            pushQuad('wood_rail', [x0, by, z1 - 0.04], [x1, by, z1 - 0.04], [x1, rh, z1 - 0.04], [x0, rh, z1 - 0.04], 0, 0, 1, 0.3);
          } else {
            pushQuad('wood_rail', [x0 + 0.05, by, z1], [x0 + 0.05, by, z0], [x0 + 0.05, rh, z0], [x0 + 0.05, rh, z1], 0, 0, 1, 0.3);
            pushQuad('wood_rail', [x1 - 0.05, by, z0], [x1 - 0.05, by, z1], [x1 - 0.05, rh, z1], [x1 - 0.05, rh, z0], 0, 0, 1, 0.3);
          }
          continue;
        }

        const style = c === '^' ? (S.wallStyle === 'interior' ? 'interior' : 'cliff') : c === '#' ? S.wallStyle : null;
        if (!style || style === 'forest') continue;

        const h = style === 'cliff' ? 1.05 : style === 'palisade' ? 1.15 : style === 'interior' ? 1.35 : 1.25;
        const sideKey = 'strip_' + (style === 'cliff' ? 'cliff' : style === 'interior' ? 'interior' : style === 'palisade' ? 'palisade' : 'citywall');
        const topKey = style === 'cliff' ? 'top_cliff' : style === 'interior' ? 'top_interior' : style === 'palisade' ? 'top_palisade' : 'top_citywall';

        const x0 = x, x1 = x + 1, z0 = y, z1 = y + 1;
        // 牆頂
        pushQuad(topKey, [x0, h, z1], [x1, h, z1], [x1, h, z0], [x0, h, z0], x * 0.5, y * 0.5, (x + 1) * 0.5, (y + 1) * 0.5);
        // 南面（朝攝影機，最重要！）
        if (y + 1 < M.H && !solidGroup(tile(x, y + 1))) {
          pushQuad(sideKey, [x0, 0, z1], [x1, 0, z1], [x1, h, z1], [x0, h, z1], x * 0.5, 0, (x + 1) * 0.5, 1);
        }
        // 東面與西面（立體轉角厚度）
        if (x + 1 < M.W && !solidGroup(tile(x + 1, y))) {
          pushQuad(sideKey, [x1, 0, z1], [x1, 0, z0], [x1, h, z0], [x1, h, z1], y * 0.5, 0, (y + 1) * 0.5, 1);
        }
        if (x - 1 >= 0 && !solidGroup(tile(x - 1, y))) {
          pushQuad(sideKey, [x0, 0, z0], [x0, 0, z1], [x0, h, z1], [x0, h, z0], y * 0.5, 0, (y + 1) * 0.5, 1);
        }
      }
    }

    const matMap = {
      strip_citywall: { tex: 'map/strip_citywall', color: 0xffffff, rep: true },
      strip_cliff:    { tex: 'map/strip_cliff',    color: 0xeae4dc, rep: true },
      strip_palisade: { tex: 'map/strip_palisade', color: 0xf2e4d2, rep: true },
      strip_interior: { tex: 'map/strip_interior', color: 0xe6d4bc, rep: true },
      top_citywall:   { tex: 'map/tx_paving',      color: 0x7a7672, rep: true, repY: true },
      top_cliff:      { tex: 'map/tx_rocktop',     color: 0x9b958a, rep: true, repY: true },
      top_palisade:   { tex: 'map/tx_wood',        color: 0x6b4d2e, rep: true, repY: true },
      top_interior:   { tex: 'map/tx_wood',        color: 0x2c1b10, rep: true, repY: true },
      wood:           { tex: 'map/tx_wood',        color: 0xf4d6ad, rep: true, repY: true, emissive: 0x2a1b0e },
      wood_dark:      { tex: 'map/tx_wood',        color: 0x7b5330, rep: true, repY: true },
      wood_rail:      { tex: 'map/tx_wood',        color: 0xc28f5c, rep: true, repY: true, doubleSide: true },
    };

    for (const [k, b] of buckets) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
      geo.setIndex(b.idx);
      geo.computeVertexNormals();
      const cfg = matMap[k];
      const rec = getTexture(cfg.tex, { repeat: cfg.rep, repeatY: cfg.repY });
      const mat = new THREE.MeshStandardMaterial({
        map: rec.tex,
        color: cfg.color,
        roughness: 0.88,
        metalness: 0.04,
        emissive: cfg.emissive || 0x000000,
        emissiveIntensity: cfg.emissive ? 0.35 : 0,
        side: cfg.doubleSide ? THREE.DoubleSide : THREE.FrontSide,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = !k.startsWith('wood');
      mesh.receiveShadow = true;
      mesh.userData.texRec = rec;
      this.staticGroup.add(mesh);
    }
  }

  buildBuildings(M, S, atm, isNight, isFire) {
    let lanternBudget = this.quality === 'high' ? 6 : 3;
    const lanternPositions = [];

    for (const b of S.blds) {
      const w = b.x1 - b.x0 + 1;
      const h = b.y1 - b.y0 + 1;
      if (b.strip) {
        // 室內隔牆：立體牆板
        const rec = getTexture('map/strip_interior', { repeat: true });
        const wh = h + 0.7;
        const geo = new THREE.PlaneGeometry(w, wh);
        const uv = geo.attributes.uv;
        uv.setXY(1, w * 0.45, 1);
        uv.setXY(3, w * 0.45, 0);
        const mat = new THREE.MeshStandardMaterial({ map: rec.tex, roughness: 0.9, side: THREE.DoubleSide });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(b.x0 + w / 2, wh / 2, b.y1 + 0.95);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData.texRec = rec;
        this.staticGroup.add(mesh);
      } else {
        const asset = 'map/bld_' + b.kind;
        const rec = getTexture(asset);
        const aspect = ready(rec.im) ? rec.im.height / rec.im.width : 0.78;
        const tw = w + 0.36;
        const th = Math.max(h + 0.45, Math.min(h + 1.9, tw * aspect));
        const mat = new THREE.MeshStandardMaterial({
          map: rec.tex,
          alphaTest: 0.42,
          roughness: 0.88,
          metalness: 0.03,
          side: THREE.DoubleSide,
        });
        const mesh = new THREE.Mesh(this.unitPlane, mat);
        mesh.scale.set(tw, th, 1);
        // 微微向攝影機傾仰，讓屋瓦與飛簷呈現 HD-2D 立體層次
        mesh.rotation.x = -0.18;
        const baseZ = b.y1 + 0.92;
        mesh.position.set(b.x0 + w / 2, th * 0.49, baseZ);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData.texRec = rec;
        mesh.userData.bldScale = { tw, h, baseZ };
        this.staticGroup.add(mesh);

        // 建築底部陰影帶
        const sh = new THREE.Mesh(this.shadowGeo, this.shadowMat);
        sh.scale.set(tw * 1.05, 1, 1.0);
        sh.position.set(b.x0 + w / 2, 0.012, baseZ + 0.12);
        this.staticGroup.add(sh);

        // 燈籠光源候選位置
        if ((atm.lantern || isNight || isFire || b.kind === 'tavern' || b.kind === 'fort') && b.doors.length) {
          const [dx, dy] = b.doors[0];
          lanternPositions.push([dx + 0.5, 1.35, dy + 1.25]);
        }
      }

      // 門片
      for (const [dx, dy] of b.doors) {
        const dAsset = 'map/' + (b.strip ? 'door_wood' : b.big ? S.theme.bigDoor : S.theme.door);
        const dRec = getTexture(dAsset);
        const dMat = new THREE.MeshStandardMaterial({
          map: dRec.tex,
          alphaTest: 0.4,
          roughness: 0.85,
          side: THREE.DoubleSide,
        });
        const dm = new THREE.Mesh(this.unitPlane, dMat);
        dm.scale.set(0.95, 1.25, 1);
        dm.rotation.x = -0.18;
        dm.position.set(dx + 0.5, 0.62, dy + 1.02);
        dm.userData.texRec = dRec;
        this.staticGroup.add(dm);
      }
    }

    // 配置場景暖色燈籠點光源（有機搖曳火光）
    for (const [lx, ly, lz] of lanternPositions.slice(0, lanternBudget)) {
      const col = isFire ? 0xff6d2a : 0xffa448;
      const intensity = isNight || isFire ? 2.6 : 1.15;
      const pl = new THREE.PointLight(col, intensity, isNight ? 7.5 : 5.5, 1.6);
      pl.position.set(lx, ly, lz);
      this.lightGroup.add(pl);
      this.lanternLights.push({ light: pl, base: intensity, phase: lx * 1.7 + lz * 2.3 });

      // 燈籠光暈微珠
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: getParticleTex(),
        color: col,
        transparent: true,
        opacity: isNight || isFire ? 0.85 : 0.45,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }));
      glow.position.set(lx, ly - 0.1, lz - 0.05);
      glow.scale.set(0.75, 0.75, 1);
      this.staticGroup.add(glow);
    }
  }

  buildFoliage(M, S) {
    const sharedMats = new Map();
    const getFolMat = (asset) => {
      if (sharedMats.has(asset)) return sharedMats.get(asset);
      const rec = getTexture(asset);
      const mat = new THREE.MeshStandardMaterial({
        map: rec.tex,
        alphaTest: 0.42,
        roughness: 0.9,
        metalness: 0.0,
        side: THREE.DoubleSide,
      });
      const out = { mat, rec };
      sharedMats.set(asset, out);
      return out;
    };

    for (const tr of S.trees) {
      const asset = 'map/tree_' + tr.kind;
      const { mat, rec } = getFolMat(asset);
      const mesh = new THREE.Mesh(this.unitPlane, mat);
      const h = tr.h * 1.08;
      const aspect = ready(rec.im) ? rec.im.width / rec.im.height : 0.85;
      const w = Math.min(tr.dense ? 1.65 : 2.05, h * aspect * (tr.dense ? 1.15 : 1.0));
      mesh.scale.set(w, h, 1);
      const cx = tr.x + 0.5 + tr.j;
      const cz = tr.y + 0.88;
      mesh.position.set(cx, h * 0.48, cz);
      mesh.rotation.x = -0.22;
      mesh.castShadow = !tr.dense || ((tr.x + tr.y) % 2 === 0);
      mesh.receiveShadow = true;
      mesh.userData.sharedMat = true;
      mesh.userData.texRec = rec;
      this.staticGroup.add(mesh);
      this.swayTrees.push({ mesh, phase: tr.x * 0.7 + tr.y * 1.1, amp: tr.dense ? 0.012 : 0.02 });

      if (!tr.dense) {
        const sh = new THREE.Mesh(this.shadowGeo, this.shadowMat);
        sh.scale.set(w * 0.82, 1, 0.75);
        sh.position.set(cx, 0.013, cz + 0.04);
        this.staticGroup.add(sh);
      }
    }

    if (S.reeds.length) {
      const { mat, rec } = getFolMat('map/reeds');
      for (const r of S.reeds) {
        for (let k = 0; k < 2; k++) {
          const mesh = new THREE.Mesh(this.unitPlane, mat);
          const h = 1.0 + k * 0.22;
          mesh.scale.set(0.75, h, 1);
          mesh.position.set(r.x + 0.3 + k * 0.42, h * 0.46, r.y + 0.72 + k * 0.22);
          mesh.rotation.x = -0.2;
          mesh.userData.sharedMat = true;
          mesh.userData.texRec = rec;
          this.staticGroup.add(mesh);
          this.swayReeds.push({ mesh, phase: r.x + k * 2.1 + r.y * 0.6 });
        }
      }
    }
  }

  buildParticles(M, kind, isNight) {
    const count = this.quality === 'high'
      ? (kind === 'snow' ? 320 : kind === 'embers' ? 140 : kind === 'mist' ? 90 : 110)
      : (kind === 'snow' ? 140 : 60);
    const pos = new Float32Array(count * 3);
    const seeds = new Float32Array(count * 3);
    const spanX = Math.max(18, M.W + 6);
    const spanZ = Math.max(16, M.H + 6);
    for (let i = 0; i < count; i++) {
      pos[i * 3]     = Math.random() * spanX - 3;
      pos[i * 3 + 1] = Math.random() * 7 + 0.3;
      pos[i * 3 + 2] = Math.random() * spanZ - 3;
      seeds[i * 3]     = 0.5 + Math.random();
      seeds[i * 3 + 1] = Math.random() * 6.28;
      seeds[i * 3 + 2] = 0.5 + Math.random();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const colorMap = {
      snow: 0xf4faff,
      embers: 0xff8c38,
      petals: 0xffd7c8,
      leaves: 0xb7c97a,
      mist: 0xdde8e6,
      motes: isNight ? 0x99d8ff : 0xffe9a8,
    };
    const sizeMap = { snow: 0.24, embers: 0.22, petals: 0.22, leaves: 0.24, mist: 1.8, motes: 0.18 };
    const mat = new THREE.PointsMaterial({
      map: getParticleTex(),
      color: colorMap[kind] || 0xffe9a8,
      size: sizeMap[kind] || 0.2,
      transparent: true,
      opacity: kind === 'mist' ? 0.16 : kind === 'snow' ? 0.88 : 0.72,
      blending: kind === 'embers' || kind === 'motes' || kind === 'snow' ? THREE.AdditiveBlending : THREE.NormalBlending,
      depthWrite: false,
    });
    const pts = new THREE.Points(geo, mat);
    this.staticGroup.add(pts);
    this.particles = pts;
    this.particleMeta = { kind, seeds, spanX, spanZ, count };
  }

  // 取得或建立動態實體（角色 / NPC / 敵人 / 道具 / 機關）
  acquireEntity(id, kind) {
    let e = this.entityPool.get(id);
    if (e && e.kind === kind) {
      e.used = true;
      e.group.visible = true;
      return e;
    }
    if (e) {
      this.dynamicGroup.remove(e.group);
    }
    const group = new THREE.Group();
    const out = { id, kind, group, used: true };

    if (kind === 'char') {
      const geo = new THREE.PlaneGeometry(1, 1);
      const mat = new THREE.MeshStandardMaterial({
        alphaTest: 0.38,
        roughness: 0.85,
        metalness: 0.04,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.rotation.x = -0.22;
      const sh = new THREE.Mesh(this.shadowGeo, this.shadowMat);
      sh.position.y = 0.016;
      const ringGeo = new THREE.RingGeometry(0.32, 0.42, 24);
      ringGeo.rotateX(-Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0xff5522, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.y = 0.025;
      ring.visible = false;
      group.add(sh, ring, mesh);
      out.mesh = mesh; out.geo = geo; out.mat = mat; out.sh = sh; out.ring = ring;
    } else if (kind === 'prop') {
      const mat = new THREE.MeshStandardMaterial({ alphaTest: 0.38, roughness: 0.86, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(this.unitPlane, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.rotation.x = -0.2;
      const sh = new THREE.Mesh(this.shadowGeo, this.shadowMat);
      sh.position.y = 0.015;
      group.add(sh, mesh);
      out.mesh = mesh; out.mat = mat; out.sh = sh;
    } else if (kind === 'exit') {
      const rGeo = new THREE.RingGeometry(0.28, 0.42, 24);
      rGeo.rotateX(-Math.PI / 2);
      const rMat = new THREE.MeshBasicMaterial({ color: 0xffd56a, transparent: true, opacity: 0.72, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
      const ring = new THREE.Mesh(rGeo, rMat);
      ring.position.y = 0.03;
      const bGeo = new THREE.PlaneGeometry(0.85, 1.5);
      const bMat = new THREE.MeshBasicMaterial({ map: getBeamTex(), transparent: true, opacity: 0.55, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
      const b1 = new THREE.Mesh(bGeo, bMat); b1.position.y = 0.75;
      const b2 = new THREE.Mesh(bGeo, bMat); b2.position.y = 0.75; b2.rotation.y = Math.PI / 2;
      group.add(ring, b1, b2);
      out.ring = ring; out.b1 = b1; out.b2 = b2;
    } else if (kind === 'plate') {
      const geo = new THREE.CylinderGeometry(0.36, 0.4, 0.07, 16);
      const mat = new THREE.MeshStandardMaterial({ color: 0x8a6030, roughness: 0.7 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.y = 0.035;
      mesh.receiveShadow = true;
      group.add(mesh);
      out.mesh = mesh; out.mat = mat;
    } else if (kind === 'switch') {
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.18, 0.35), new THREE.MeshStandardMaterial({ color: 0x4b4a48, roughness: 0.85 }));
      base.position.y = 0.09;
      base.castShadow = true;
      const lever = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.65, 8), new THREE.MeshStandardMaterial({ color: 0xcc3322, roughness: 0.5 }));
      lever.position.y = 0.38;
      group.add(base, lever);
      out.lever = lever;
    } else if (kind === 'reset') {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.7, 10), new THREE.MeshStandardMaterial({ color: 0x6b4728, roughness: 0.85 }));
      post.position.y = 0.35; post.castShadow = true;
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 12), new THREE.MeshStandardMaterial({ color: 0xdfb655, emissive: 0x5c3c0a, roughness: 0.35 }));
      orb.position.y = 0.82;
      group.add(post, orb);
      out.orb = orb;
    }

    this.dynamicGroup.add(group);
    this.entityPool.set(id, out);
    return out;
  }

  ensureBoat() {
    if (this.boatGroup) return this.boatGroup;
    const g = new THREE.Group();
    const hullMat = new THREE.MeshStandardMaterial({ color: 0x5c3a1e, roughness: 0.85 });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x8a5b32, roughness: 0.8 });
    const hull = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.24, 1.32), hullMat);
    hull.position.y = 0.1; hull.castShadow = true;
    const bow = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.45, 4), hullMat);
    bow.rotation.x = Math.PI / 2; bow.rotation.y = Math.PI / 4; bow.position.set(0, 0.14, 0.82);
    const rim = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.06, 1.36), trimMat);
    rim.position.y = 0.22;
    const wake = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.62, 20), new THREE.MeshBasicMaterial({ color: 0xdff5ff, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false }));
    wake.rotation.x = -Math.PI / 2; wake.position.y = 0.04;
    g.add(hull, bow, rim, wake);
    this.dynamicGroup.add(g);
    this.boatGroup = g;
    return g;
  }

  spawnFootPuff(wx, wz, terrain, isBoat = false) {
    if (!this.ok) return;
    const count = isBoat ? 1 : 3;
    const col = isBoat ? 0xdff6ff : terrain === '*' ? 0xf2f8ff : terrain === ',' ? 0xc8d2a2 : terrain === 's' ? 0xe4cc8c : 0xcfb994;
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({
        map: getParticleTex(),
        color: col,
        transparent: true,
        opacity: isBoat ? 0.55 : 0.65,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(this.puffGeo, mat);
      mesh.position.set(wx + (Math.random() - 0.5) * 0.24, isBoat ? 0.04 : 0.06 + Math.random() * 0.08, wz + (Math.random() - 0.5) * 0.16);
      const s = isBoat ? 1.8 : 0.55 + Math.random() * 0.45;
      mesh.scale.set(s, s, s);
      this.dynamicGroup.add(mesh);
      this.footPuffs.push({
        mesh, mat, life: 0, maxLife: isBoat ? 0.72 : 0.42 + Math.random() * 0.16,
        vx: (Math.random() - 0.5) * (isBoat ? 0.15 : 0.7),
        vy: isBoat ? 0.0 : 0.55 + Math.random() * 0.35,
        vz: (Math.random() - 0.5) * (isBoat ? 0.15 : 0.45),
        isBoat,
      });
    }
  }

  updateFootPuffs(dt) {
    for (let i = this.footPuffs.length - 1; i >= 0; i--) {
      const p = this.footPuffs[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        this.dynamicGroup.remove(p.mesh);
        p.mat.dispose();
        this.footPuffs.splice(i, 1);
        continue;
      }
      const k = p.life / p.maxLife;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      const sc = p.isBoat ? (1.8 + k * 2.2) : (0.7 + k * 0.9);
      p.mesh.scale.set(sc, sc, sc);
      p.mat.opacity = (1 - k) * (p.isBoat ? 0.48 : 0.58);
    }
  }

  // 每幀更新並渲染 HD-2D 畫面
  render(now, M, S, helpers) {
    if (!this.ok || !M.def) return false;
    const t = now / 1000;
    const dt = Math.min(0.05, this.lastTime ? (now - this.lastTime) / 1000 : 0.016);
    this.lastTime = now;

    if (this.mapId !== M.id) {
      this.buildMap(M, S, helpers);
    }

    // 同步 map.js 預繪好的柔邊地表畫布至 GPU
    if (!M.def.image && S.ground && this.groundMesh) {
      if (this.groundCanvasRef !== S.ground || (S.complete && !this.groundUploadedComplete)) {
        if (this.groundTex) this.groundTex.dispose();
        const tex = new THREE.CanvasTexture(S.ground);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
        this.groundMesh.material.map = tex;
        this.groundMesh.material.needsUpdate = true;
        this.groundTex = tex;
        this.groundCanvasRef = S.ground;
        this.groundUploadedComplete = !!S.complete;
      }
    }

    // 檢查非同步圖片載入完成後補上傳紋理與更新建築高寬比
    this.staticGroup.traverse(obj => {
      const rec = obj.userData && obj.userData.texRec;
      if (rec && !rec.uploaded && ready(rec.im)) {
        rec.tex.image = rec.im;
        rec.tex.needsUpdate = true;
        rec.uploaded = true;
        if (obj.userData.bldScale) {
          const { tw, h, baseZ } = obj.userData.bldScale;
          const th = Math.max(h + 0.45, Math.min(h + 1.9, tw * rec.im.height / rec.im.width));
          obj.scale.set(tw, th, 1);
          obj.position.y = th * 0.49;
          obj.position.z = baseZ;
        }
      }
    });
    if (this.worldImgMesh && !this.worldImgMesh.rec.uploaded && ready(this.worldImgMesh.rec.im)) {
      this.worldImgMesh.rec.tex.image = this.worldImgMesh.rec.im;
      this.worldImgMesh.rec.tex.needsUpdate = true;
      this.worldImgMesh.rec.uploaded = true;
    }

    // 更新動態水面、燈火搖曳、風吹樹影與 3D 粒子
    if (this.waterUniforms) this.waterUniforms.uTime.value = t;
    for (const l of this.lanternLights) {
      l.light.intensity = l.base * (0.9 + 0.12 * Math.sin(t * 5.2 + l.phase) + 0.06 * Math.sin(t * 11.7 + l.phase * 2));
    }
    for (const tr of this.swayTrees) {
      tr.mesh.rotation.z = Math.sin(t * 1.15 + tr.phase) * tr.amp;
    }
    for (const rd of this.swayReeds) {
      rd.mesh.rotation.z = Math.sin(t * 1.85 + rd.phase) * 0.085;
    }
    if (this.particles && this.particleMeta) {
      const pm = this.particleMeta;
      const arr = this.particles.geometry.attributes.position.array;
      for (let i = 0; i < pm.count; i++) {
        const i3 = i * 3;
        const spd = pm.seeds[i3], ph = pm.seeds[i3 + 1];
        if (pm.kind === 'snow') {
          arr[i3] += Math.sin(t * 0.9 + ph) * dt * 0.65 - dt * 0.35;
          arr[i3 + 1] -= dt * (1.2 + spd * 0.8);
          arr[i3 + 2] += Math.cos(t * 0.7 + ph) * dt * 0.3;
          if (arr[i3 + 1] < 0.05) { arr[i3 + 1] = 6.8 + Math.random() * 1.5; arr[i3] = Math.random() * pm.spanX - 3; }
        } else if (pm.kind === 'embers') {
          arr[i3] += Math.sin(t * 1.8 + ph) * dt * 0.4;
          arr[i3 + 1] += dt * (0.55 + spd * 0.45);
          if (arr[i3 + 1] > 6.5) { arr[i3 + 1] = 0.15; arr[i3] = Math.random() * pm.spanX - 3; }
        } else if (pm.kind === 'mist') {
          arr[i3] += dt * (0.28 + spd * 0.2);
          if (arr[i3] > pm.spanX) arr[i3] = -3;
        } else {
          arr[i3] += Math.sin(t * 0.6 + ph) * dt * 0.25;
          arr[i3 + 1] += (pm.kind === 'leaves' || pm.kind === 'petals' ? -0.32 : Math.sin(t * 0.8 + ph) * 0.12) * dt;
          if (arr[i3 + 1] < 0.1) arr[i3 + 1] = 5.5;
          if (arr[i3 + 1] > 6.5) arr[i3 + 1] = 0.4;
        }
      }
      this.particles.geometry.attributes.position.needsUpdate = true;
    }

    // ── 同步所有動態實體（角色、跟隨同伴、NPC、敵人、寶箱、機關、出口） ──
    for (const e of this.entityPool.values()) e.used = false;
    const fx = M.fx ?? M.px, fy = M.fy ?? M.py;

    // 1) 目的地金環
    if (this.destRing) {
      if (M.dest) {
        this.destRing.visible = true;
        this.destRing.position.set(M.dest[0] + 0.5, 0.035, M.dest[1] + 0.5);
        const s = 1 + Math.sin(t * 6) * 0.12;
        this.destRing.scale.set(s, s, 1);
      } else {
        this.destRing.visible = false;
      }
    }

    // 2) 地圖物件與 NPC／敵人
    for (const i of M.inst) {
      if (!helpers.visible(i)) continue;
      const d = i.d;
      const ty = d.type;
      const cx = i.x + 0.5, cz = i.y + 0.88;

      if (ty === 'exit') {
        const e = this.acquireEntity('inst:' + i.id, 'exit');
        e.group.position.set(cx, 0, i.y + 0.5);
        e.ring.rotation.z = t * 1.1;
        e.b1.material.opacity = 0.4 + Math.sin(t * 3.2 + i.x) * 0.18;
      } else if (ty === 'plate') {
        const on = M.inst.some(b => b.d.type === 'boulder' && b.x === i.x && b.y === i.y);
        const e = this.acquireEntity('inst:' + i.id, 'plate');
        e.group.position.set(cx, 0, i.y + 0.5);
        e.mat.color.setHex(on ? 0xffd54f : 0x7c5328);
        e.mat.emissive.setHex(on ? 0x6b4700 : 0x000000);
      } else if (ty === 'switch') {
        const on = flag(d.flag);
        const e = this.acquireEntity('inst:' + i.id, 'switch');
        e.group.position.set(cx, 0, i.y + 0.5);
        e.lever.rotation.z = on ? -0.55 : 0.55;
        e.lever.material.color.setHex(on ? 0xffd34a : 0xcc3322);
      } else if (ty === 'reset') {
        const e = this.acquireEntity('inst:' + i.id, 'reset');
        e.group.position.set(cx, 0, i.y + 0.5);
        e.orb.position.y = 0.82 + Math.sin(t * 2.5) * 0.06;
      } else if (ty === 'gate') {
        if (!helpers.gateOpen(i)) {
          const asset = 'map/' + (S.wallStyle === 'citywall' ? 'door_city' : 'door_stockade');
          this.updatePropEntity('inst:' + i.id, asset, cx, i.y + 0.96, 1.45, 1.0);
        }
      } else if (ty === 'chest') {
        const open = flag('c:' + i.id);
        this.updatePropEntity('inst:' + i.id, open ? 'map/chest_open' : 'map/chest', cx, cz, 0.88, open ? 0.78 : 1.0);
      } else if (ty === 'boulder') {
        this.updatePropEntity('inst:' + i.id, 'map/boulder', cx, cz, 1.0, 1.0);
      } else if (ty === 'sign') {
        this.updatePropEntity('inst:' + i.id, 'map/signpost', cx, cz, 1.05, 1.0);
      } else if (ty === 'obj' && helpers.PROPS.has(d.img)) {
        this.updatePropEntity('inst:' + i.id, 'map/' + d.img, cx, cz, 1.55 * (d.scale || 1), 1.0);
      } else if (ty === 'npc') {
        if (d.img && helpers.PROPS.has(d.img)) {
          this.updatePropEntity('inst:' + i.id, 'map/' + d.img, cx, cz, 1.25, 1.0);
        } else {
          const name = d.img || 'n_villager';
          const bob = Math.sin(t * 2.2 + i.x * 1.7) * 0.015;
          this.updateCharEntity('inst:' + i.id, name, i.face ?? 2, 1, i.x, i.y, helpers, { bob });
        }
      } else if (ty === 'foe') {
        const f0 = d.foe.split('+')[0];
        const isBoss = !!(BOSSES[f0] && BOSSES[f0].boss);
        const dx = M.px - i.x, dy = M.py - i.y, close = Math.abs(dx) + Math.abs(dy) <= 4;
        const dir = close ? (Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0)) : (i.face ?? 2);
        const frame = close ? [0, 1, 2, 1][Math.floor(t * 3 + i.x) % 4] : 1;
        let lv = 1;
        if (f0.includes('@')) lv = +f0.split('@')[1];
        else if (BOSSES[f0]) lv = BOSSES[f0].lv;
        const diff = lv - helpers.avgLevel();
        const ringColor = isBoss ? 0xff2818 : diff >= 3 ? 0xff4a2a : diff <= -4 ? 0xaaaaaa : 0xee9530;
        this.updateCharEntity('inst:' + i.id, helpers.foeImg(d.foe), dir, frame, i.x, i.y, helpers, {
          scale: isBoss ? 1.12 : 1.0,
          bob: Math.sin(t * 2.4 + i.y) * 0.016,
          ringColor,
          ringPulse: isBoss ? 0.65 + Math.sin(t * 4) * 0.3 : 0.78,
        });
      }
    }

    // 3) 跟隨同伴（最多兩位，同步步伐彈跳與傾斜）
    const animK = M.anim ? Math.min(1, (now - M.anim.t0) / M.anim.dur) : 0;
    const stepHop = M.anim ? Math.sin(animK * Math.PI) * 0.12 : 0;
    if (!M.def.boat && !M.def.image) {
      const fol = (G.s.party || []).slice(1, 3);
      fol.forEach((id, n) => {
        const a = M.trail[n], b = n === 0 ? [M.px, M.py] : M.trail[n - 1];
        if (!a || !HEROES[id]) return;
        const k = M.anim ? animK : 1;
        const px = M.anim ? a[0] + (b[0] - a[0]) * k : a[0];
        const py = M.anim ? a[1] + (b[1] - a[1]) * k : a[1];
        if (Math.abs(px - fx) + Math.abs(py - fy) < 0.45) return;
        const dir = M.anim ? (b[0] > a[0] ? 1 : b[0] < a[0] ? 3 : b[1] > a[1] ? 2 : 0) : (a[2] ?? 2);
        const fLean = M.anim ? (dir === 1 ? -0.065 : dir === 3 ? 0.065 : Math.sin(animK * Math.PI * 2) * 0.035) : Math.sin(t * 2.1 + n * 1.4) * 0.014;
        const fBob = M.anim ? 0 : Math.sin(now / 430 + n * 1.6) * 0.02;
        this.updateCharEntity('fol:' + n, HEROES[id].img, dir, helpers.walkFrame(now), px, py, helpers, {
          bob: fBob, yOff: stepHop * 0.9, leanZ: fLean, heroRim: true,
        });
      });
    }

    // 4) 主角（活靈活現：轉向彈性、邁步躍動、重心前傾、微風衣擺、腳步揚塵／水波）
    const lead = (G.s.party && G.s.party[0]) || 'linchong';
    const pName = HEROES[lead].img, pDir = G.s.dir ?? 2, pFrame = helpers.walkFrame(now);
    if (this.lastPlayerDir !== -1 && this.lastPlayerDir !== pDir) this.turnBounce = 1.0;
    this.lastPlayerDir = pDir;
    this.turnBounce = Math.max(0, this.turnBounce - dt * 7.5);
    const turnSquashX = 1 - Math.sin(this.turnBounce * Math.PI) * 0.14;
    const turnStretchY = 1 + Math.sin(this.turnBounce * Math.PI) * 0.07;

    const steps = G.s.steps || 0;
    if (this.lastStepCount !== -1 && steps !== this.lastStepCount) {
      const terr = helpers.tile(M.px, M.py);
      this.spawnFootPuff(M.px + 0.5, M.py + 0.85, terr, !!M.def.boat);
    }
    this.lastStepCount = steps;
    this.updateFootPuffs(dt);

    const pBob = M.anim ? (Math.sin(animK * Math.PI) * 0.035) : (Math.sin(now / 380) * 0.022);
    const pLean = M.anim
      ? (pDir === 1 ? -0.085 : pDir === 3 ? 0.085 : Math.sin(animK * Math.PI * 2) * 0.042)
      : Math.sin(t * 1.9) * 0.016;

    if (M.def.boat) {
      const rock = Math.sin(now / 500) * 0.045;
      const boat = this.ensureBoat();
      boat.visible = true;
      boat.position.set(fx + 0.5, rock, fy + 0.62);
      boat.rotation.y = (pDir === 1 || pDir === 3) ? Math.PI / 2 : 0;
      boat.rotation.z = Math.sin(now / 650) * 0.055;
      this.updateCharEntity('player', pName, pDir, 1, fx, fy - 0.14, helpers, {
        bob: pBob, yOff: 0.24 + rock, leanZ: pLean * 0.5, squashX: turnSquashX, stretchY: turnStretchY, heroRim: true,
      });
    } else {
      if (this.boatGroup) this.boatGroup.visible = false;
      this.updateCharEntity('player', pName, pDir, pFrame, fx, fy, helpers, {
        bob: pBob, yOff: stepHop, leanZ: pLean, squashX: turnSquashX, stretchY: turnStretchY, heroRim: true,
      });
    }

    // 隱藏本幀未使用的實體
    for (const e of this.entityPool.values()) {
      if (!e.used) e.group.visible = false;
    }

    // ── 平滑電影鏡頭跟隨（Exponential Lerp + 輕微朝向預判 + 震動） ──
    const lookX = (pDir === 1 ? 0.35 : pDir === 3 ? -0.35 : 0);
    const lookZ = (pDir === 2 ? 0.25 : pDir === 0 ? -0.35 : 0);
    const wantX = fx + 0.5 + lookX;
    const wantZ = fy + 0.5 + lookZ;

    if (!this.camInit) {
      this.camTarget.set(wantX, 0.35, wantZ);
      this.camInit = true;
    } else {
      const alpha = 1 - Math.exp(-8.5 * dt);
      this.camTarget.x += (wantX - this.camTarget.x) * alpha;
      this.camTarget.z += (wantZ - this.camTarget.z) * alpha;
    }

    // 依直式／橫式螢幕自動調整距離，確保視野在手機與電腦皆舒適
    const portrait = this.ch > this.cw;
    const dist = M.def.image ? Math.max(M.W, M.H) * 0.95 : (portrait ? 12.2 : 10.6);
    const elev = M.def.image ? dist * 1.15 : (portrait ? 11.4 : 9.4);

    let sx = 0, sy = 0;
    if (this.shakeAmt > 0.002) {
      sx = (Math.random() - 0.5) * this.shakeAmt;
      sy = (Math.random() - 0.5) * this.shakeAmt;
      this.shakeAmt *= Math.exp(-10 * dt);
    } else {
      this.shakeAmt = 0;
    }

    this.camera.position.set(this.camTarget.x + sx, elev + sy, this.camTarget.z + dist);
    this.camera.lookAt(this.camTarget.x, 0.32, this.camTarget.z - 0.25);

    // 讓主陰影與主角隨身暖光追蹤主角
    if (this.sunLight) {
      this.sunLight.target.position.set(this.camTarget.x, 0, this.camTarget.z);
      this.sunLight.position.set(
        this.camTarget.x + this.sunOffset.x,
        this.sunOffset.y,
        this.camTarget.z + this.sunOffset.z
      );
      this.sunLight.target.updateMatrixWorld();
    }
    if (this.heroLight) {
      this.heroLight.position.set(fx + 0.5, 1.45, fy + 0.85);
    }

    // ── 執行渲染（高畫質：兩階段後製景深＋泛光；流暢模式：直出） ──
    this.postMat.uniforms.uTime.value = t;
    if (this.quality === 'high' && this.rt) {
      this.renderer.setRenderTarget(this.rt);
      this.renderer.render(this.scene, this.camera);
      this.renderer.setRenderTarget(null);
      this.postMat.uniforms.tDiffuse.value = this.rt.texture;
      this.renderer.render(this.postScene, this.postCam);
    } else {
      this.renderer.setRenderTarget(null);
      this.renderer.render(this.scene, this.camera);
    }
    return true;
  }

  updateCharEntity(id, name, dir, frame, tx, ty, helpers, o) {
    const e = this.acquireEntity(id, 'char');
    const asset = 'spr/' + helpers.sprName(name);
    const rec = getTexture(asset, { noMip: true });
    if (e.mat.map !== rec.tex) {
      e.mat.map = rec.tex;
      e.mat.needsUpdate = true;
    }
    const h = helpers.sprH(name) * (o.scale || 1);
    const cw = ready(rec.im) ? rec.im.width / 3 : 128;
    const ch = ready(rec.im) ? rec.im.height / 4 : 160;
    const w = h * cw / ch;
    setSpriteUV(e.geo, frame, dir);

    const bob = o.bob || 0;
    const yOff = o.yOff || 0;
    const sx = (o.squashX || 1) * (1 - bob * 0.35);
    const sy = (o.stretchY || 1) * (1 + bob);
    e.mesh.scale.set(w * sx, h * sy, 1);
    e.mesh.position.set(0, yOff + h * sy * 0.48, 0);
    e.mesh.rotation.z = o.leanZ || 0;
    if (o.heroRim) {
      e.mat.emissive.setHex(0x2a1d10);
      e.mat.emissiveIntensity = 0.28;
    } else {
      e.mat.emissive.setHex(0x000000);
      e.mat.emissiveIntensity = 0;
    }
    const shShrink = Math.max(0.72, 1 - yOff * 0.8);
    e.sh.scale.set(w * 0.84 * shShrink, 1, 0.58 * shShrink);
    if (o.ringColor != null) {
      e.ring.visible = true;
      e.ring.material.color.setHex(o.ringColor);
      e.ring.material.opacity = o.ringPulse ?? 0.78;
    } else {
      e.ring.visible = false;
    }
    e.group.position.set(tx + 0.5, 0, ty + 0.88);
  }

  updatePropEntity(id, asset, cx, cz, hgt, alpha) {
    const e = this.acquireEntity(id, 'prop');
    const rec = getTexture(asset);
    if (e.mat.map !== rec.tex) {
      e.mat.map = rec.tex;
      e.mat.needsUpdate = true;
    }
    const aspect = ready(rec.im) ? rec.im.width / rec.im.height : 1.0;
    const w = Math.min(hgt * aspect, 1.35);
    const h = w / aspect;
    e.mesh.scale.set(w, h, 1);
    e.mesh.position.set(0, h * 0.48, 0);
    e.mat.opacity = alpha ?? 1;
    e.mat.transparent = alpha != null && alpha < 0.99;
    e.sh.scale.set(w * 0.85, 1, 0.58);
    e.group.position.set(cx, 0, cz);
  }

  // 螢幕像素座標 → 3D 地面格座標（精準對應滑鼠／觸控點地尋路）
  screenToTile(sx, sy) {
    if (!this.ok) return null;
    const ndc = new THREE.Vector2((sx / this.cw) * 2 - 1, -(sy / this.ch) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.groundPlane, hit)) return null;
    return [Math.floor(hit.x), Math.floor(hit.z)];
  }

  // 3D 世界座標 → 螢幕像素座標（供 2D 畫布繪製超銳利繁體中文名牌與驚嘆號）
  worldToScreen(wx, wy, wz) {
    const v = new THREE.Vector3(wx, wy, wz);
    v.project(this.camera);
    if (v.z > 1) return null;
    return [(v.x * 0.5 + 0.5) * this.cw, (-v.y * 0.5 + 0.5) * this.ch];
  }
}
