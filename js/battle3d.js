// FF7 / FF8 風格 3D 電影運鏡戰鬥舞台、動態攝影機導演與 3D 招式特效引擎（Three.js）
import * as THREE from './vendor/three.module.min.js';
import { img, ready } from './assets.js';
import { createBattleUnitModel, animateBattleRig, createAfterimageMesh } from './battle_models.js';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

function getSoftDotTex() {
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(16, 16, 1, 16, 16, 15);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.5, 'rgba(255,248,235,0.65)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}

// 依戰場背景名自動匹配 3D 地形紋理、光影、手繪景觀樹與氛圍
function biomeFromBg(bg) {
  if (/shanshen|caoliao/.test(bg)) {
    return { gtex: 'map/tx_snow', fog: 0x263242, fogD: 0.024, sun: 0xd8ecff, sunI: 1.5, rim: 0xff7b34, rimI: 1.5, amb: 0x8ea8c6, fire: true, pKind: 'snowfire', tree: 'map/tree_snowpine', prop: 'map/lantern' };
  }
  if (/dongjing|cangzhou|yanggu|fachang|baihutang|zhujiazhuang/.test(bg)) {
    return { gtex: 'map/tx_paving', fog: 0x282118, fogD: 0.022, sun: 0xffe4b6, sunI: 1.65, rim: 0xff9a44, rimI: 1.15, amb: 0x9c886c, fire: /fachang|zhujia/.test(bg), pKind: 'embers', tree: 'map/tree_willow', prop: 'map/lantern' };
  }
  if (/marsh|river|xunyang/.test(bg)) {
    return { gtex: 'map/tx_sand', fog: 0x1d2b30, fogD: 0.024, sun: 0xebf2e2, sunI: 1.48, rim: 0x6ec0d8, rimI: 1.15, amb: 0x6c8c90, fire: false, pKind: 'mist', tree: 'map/reeds', prop: 'map/rock' };
  }
  if (/cave/.test(bg)) {
    return { gtex: 'map/tx_rocktop', fog: 0x12131c, fogD: 0.032, sun: 0x9bb2df, sunI: 1.0, rim: 0xff8232, rimI: 1.6, amb: 0x525c78, fire: true, pKind: 'embers', tree: 'map/rock', prop: 'map/lantern' };
  }
  if (/tavern|juyiting/.test(bg)) {
    return { gtex: 'map/tx_wood', fog: 0x241810, fogD: 0.024, sun: 0xffd292, sunI: 1.35, rim: 0xff9840, rimI: 1.35, amb: 0x8a6a4c, fire: true, pKind: 'motes', tree: 'map/tree_bamboo', prop: 'map/lantern' };
  }
  return { gtex: 'map/tx_grass', fog: 0x222a20, fogD: 0.022, sun: 0xfff0c8, sunI: 1.6, rim: 0xffb25e, rimI: 1.0, amb: 0x7c8e6e, fire: false, pKind: 'leaves', tree: 'map/tree_pine', prop: 'map/rock' };
}

function loadTex(name, repeat = 1) {
  const im = img(name);
  const tex = new THREE.Texture(im);
  tex.colorSpace = THREE.SRGBColorSpace;
  if (repeat > 1) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat, repeat);
  }
  const sync = () => { if (ready(im)) { tex.image = im; tex.needsUpdate = true; } };
  sync();
  im.addEventListener('load', sync, { once: true });
  return tex;
}

export class Battle3DStage {
  constructor(root, allies, foes, bgName = 'bg_yezhulin', onProject = null) {
    this.root = root;
    this.allies = allies;
    this.foes = foes;
    this.onProject = onProject;
    this.alive = true;
    this.ok = false;
    this.units = new Map(); // actor -> rig
    this.fxObjs = [];
    this.pointers = [];

    try {
      const cv = document.createElement('canvas');
      cv.className = 'b-3d';
      root.insertBefore(cv, root.firstChild);
      this.canvas = cv;

      this.renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: false, powerPreference: 'high-performance' });
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.12;
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.4, 120);
      this.raycaster = new THREE.Raycaster();

      this.biome = biomeFromBg(bgName);
      this.scene.background = new THREE.Color(this.biome.fog);
      this.scene.fog = new THREE.FogExp2(this.biome.fog, this.biome.fogD);

      // 攝影機導演狀態（FF7/FF8 電影運鏡）
      this.camMode = 'intro'; // intro | idle | custom | victory
      this.camPos = new THREE.Vector3(-4.5, 2.5, 10.5);
      this.camLook = new THREE.Vector3(-1.2, 1.3, 0);
      this.wantPos = new THREE.Vector3(6.4, 4.15, 8.8);
      this.wantLook = new THREE.Vector3(-0.35, 1.2, 0.1);
      this.introT = 0;
      this.shake = 0;
      this.dimSky = 0;
      this.hitStop = 0;      // 主機級打擊頓幀（Hit-Stop）秒數
      this.afterimages = []; // 3D 衝刺與必殺殘影佇列
      this.t = 0;
      this.lastNow = performance.now();

      this.buildArena(bgName);
      this.buildUnits();
      this.buildParticles();

      this.resize = this.resize.bind(this);
      this.resize();
      window.addEventListener('resize', this.resize);
      this.ok = true;
      this.loop(this.lastNow);
    } catch (e) {
      console.warn('3D 戰鬥舞台初始化失敗，維持 2D 顯示', e);
      this.ok = false;
    }
  }

  resize() {
    if (!this.alive || !this.renderer) return;
    const r = this.root.getBoundingClientRect();
    this.w = Math.max(1, r.width || window.innerWidth);
    this.h = Math.max(1, r.height || window.innerHeight);
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(this.w, this.h, false);
    this.camera.aspect = this.w / this.h;
    this.camera.updateProjectionMatrix();
  }

  buildArena(bgName) {
    const b = this.biome;
    // 主燈光：三點電影打光（主光＋暖/冷逆光＋半球環境光）
    this.hemi = new THREE.HemisphereLight(b.amb, 0x261d14, 0.95);
    this.scene.add(this.hemi);

    const sun = new THREE.DirectionalLight(b.sun, b.sunI);
    sun.position.set(7, 13, 9);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 2; sun.shadow.camera.far = 38;
    sun.shadow.camera.left = -12; sun.shadow.camera.right = 12;
    sun.shadow.camera.top = 10; sun.shadow.camera.bottom = -10;
    sun.shadow.bias = -0.0006;
    this.scene.add(sun);
    this.sun = sun;

    const rim = new THREE.DirectionalLight(b.rim, b.rimI);
    rim.position.set(-10, 6, -8);
    this.scene.add(rim);

    // 3D 圓形戰場地面
    const gTex = loadTex(b.gtex, 9);
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(24, 48),
      new THREE.MeshStandardMaterial({ map: gTex, roughness: 0.9, metalness: 0.04 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // 戰場中央淡淡太極石紋地徽（增添古風武俠儀式感）
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(4.6, 4.9, 48),
      new THREE.MeshBasicMaterial({ color: 0xd8b25a, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.015;
    this.scene.add(ring);

    // 環景水墨天幕（將原本精美水墨 bg_*.webp 彎曲包裹成 3D 遠景！）
    const bgTex = loadTex(bgName || 'bg_yezhulin', 1);
    const domeGeo = new THREE.CylinderGeometry(24, 24, 21, 36, 1, true, Math.PI * 0.45, Math.PI * 1.15);
    const domeMat = new THREE.MeshBasicMaterial({ map: bgTex, side: THREE.BackSide, fog: false, color: 0xded8cc });
    const dome = new THREE.Mesh(domeGeo, domeMat);
    dome.position.set(0, 7.2, -1);
    this.scene.add(dome);
    this.domeMat = domeMat;

    // 兩側採用原本精美手繪水墨景觀樹、燈籠與岩石（取代簡陋幾何塊！）
    const dotTex = getSoftDotTex();
    const treeTex = loadTex(b.tree || 'map/tree_pine', 1);
    const propTex = loadTex(b.prop || 'map/rock', 1);
    const treeSpots = [[-8.6, -5.8, 4.4], [-3.8, -7.8, 4.8], [4.2, -7.6, 4.6], [8.8, -5.2, 4.2]];
    for (const [tx, tz, th] of treeSpots) {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(th * 0.85, th),
        new THREE.MeshStandardMaterial({ map: treeTex, alphaTest: 0.42, roughness: 0.9, side: THREE.DoubleSide })
      );
      m.position.set(tx, th * 0.48, tz);
      m.castShadow = true;
      this.scene.add(m);
    }

    this.braziers = [];
    for (const [bx, bz] of [[-6.4, -3.4], [6.4, -3.4]]) {
      const pm = new THREE.Mesh(
        new THREE.PlaneGeometry(1.4, 1.9),
        new THREE.MeshStandardMaterial({ map: propTex, alphaTest: 0.4, roughness: 0.88, side: THREE.DoubleSide })
      );
      pm.position.set(bx, 0.92, bz);
      pm.castShadow = true;
      this.scene.add(pm);
      if (b.fire) {
        const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex, color: 0xff9238, transparent: true, opacity: 0.82, blending: THREE.AdditiveBlending, depthWrite: false }));
        glow.position.set(bx, 1.45, bz + 0.1); glow.scale.set(1.5, 1.5, 1);
        const pl = new THREE.PointLight(0xff802c, 3.4, 14, 1.5);
        pl.position.set(bx, 1.6, bz + 0.2);
        this.scene.add(glow, pl);
        this.braziers.push({ flame: glow, pl, ph: bx });
      }
    }
  }

  buildUnits() {
    // 我方好漢站位（右側斜列梯隊，確保 3-4 人從攝影機視角完全不重疊！）
    const an = this.allies.length;
    this.allies.forEach((a, i) => {
      const rig = createBattleUnitModel(a, this.biome);
      const frac = an === 1 ? 0 : (i / (an - 1) - 0.5);
      const x = 3.05 + frac * 1.15;
      const z = frac * Math.min(4.6, (an - 1) * 1.95) + 0.15;
      rig.homePos.set(x, 0, z);
      rig.homeRotY = -Math.PI * 0.18;
      rig.root.position.copy(rig.homePos);
      rig.root.rotation.y = rig.homeRotY;
      rig.root.userData.actor = a;
      this.scene.add(rig.root);
      this.units.set(a, rig);
    });

    // 敵方／頭目站位（左側斜列梯隊，正對我方且彼此錯開！）
    const fn = this.foes.length;
    this.foes.forEach((f, i) => {
      const rig = createBattleUnitModel(f, this.biome);
      const frac = fn === 1 ? 0 : (i / (fn - 1) - 0.5);
      const x = -3.55 - frac * 1.35;
      const z = frac * Math.min(5.2, (fn - 1) * 2.35) - 0.15;
      rig.homePos.set(x, 0, z);
      rig.homeRotY = Math.PI * 0.18;
      rig.root.position.copy(rig.homePos);
      rig.root.rotation.y = rig.homeRotY;
      rig.root.userData.actor = f;
      this.scene.add(rig.root);
      this.units.set(f, rig);
    });
  }

  buildParticles() {
    const count = 130;
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);
    const kind = this.biome.pKind;
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 22;
      pos[i * 3 + 1] = Math.random() * 7 + 0.2;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 16;
      vel[i * 3] = (Math.random() - 0.5) * 0.7;
      vel[i * 3 + 1] = kind === 'embers' ? (0.6 + Math.random() * 0.9) : kind === 'snowfire' ? (i % 3 === 0 ? 0.7 : -1.1) : -0.35;
      vel[i * 3 + 2] = (Math.random() - 0.5) * 0.5;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const col = kind === 'snowfire' ? 0xf2f8ff : kind === 'embers' ? 0xff983c : kind === 'leaves' ? 0xc8d888 : 0xffe8a8;
    const mat = new THREE.PointsMaterial({ map: getSoftDotTex(), color: col, size: 0.24, transparent: true, opacity: 0.82, blending: THREE.AdditiveBlending, depthWrite: false });
    this.pts = new THREE.Points(geo, mat);
    this.ptsVel = vel;
    this.scene.add(this.pts);
  }

  // 更新角色即時狀態（回合高光、防禦護盾、狂暴光環、倒地）
  syncStates(activeActor = null) {
    if (!this.ok) return;
    for (const [actor, rig] of this.units) {
      rig.isTurn = actor === activeActor;
      rig.defending = !!actor.defending;
      rig.enraged = !!actor.enraged;
      if (actor.hp <= 0 && rig.state !== 'dead') {
        rig.state = 'dead'; rig.stateT = 0;
      } else if (actor.hp > 0 && rig.state === 'dead') {
        rig.state = 'idle'; rig.stateT = 0;
      }
    }
  }

  // 3D 選取目標浮動金菱指標（FF7/FF8 經典指標！）
  setPickHighlight(pool) {
    for (const m of this.pointers) this.scene.remove(m);
    this.pointers = [];
    if (!pool || !pool.length) return;
    for (const a of pool) {
      const rig = this.units.get(a);
      if (!rig) continue;
      const ptr = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.24, 0),
        new THREE.MeshBasicMaterial({ color: 0xffe268 })
      );
      ptr.position.set(rig.root.position.x, rig.height + 0.55, rig.root.position.z);
      ptr.userData.rig = rig;
      this.scene.add(ptr);
      this.pointers.push(ptr);
    }
  }

  // 點擊 3D 畫布精準選取角色／怪物
  pickAtScreen(clientX, clientY, pool) {
    if (!this.ok || !pool || !pool.length) return null;
    const r = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    let best = null, bestD = 99;
    for (const a of pool) {
      const rig = this.units.get(a);
      if (!rig) continue;
      const center = rig.root.position.clone().add(new THREE.Vector3(0, rig.height * 0.5, 0));
      const d = this.raycaster.ray.distanceToPoint(center);
      if (d < 1.35 && d < bestD) { bestD = d; best = a; }
    }
    return best;
  }

  spawnAfterimage(rig, colorHex) {
    if (!this.ok || !rig) return;
    const ai = createAfterimageMesh(rig, colorHex);
    this.scene.add(ai.mesh);
    this.afterimages.push({ ...ai, life: 0, dur: 0.34 });
  }

  // ── FF7/FF8 電影級攻擊演出（衝刺殘影→運鏡特寫→多關節揮斬＋打擊頓幀→躍起跳回） ──
  async playAction(attacker, targets, fxType, opts = {}, onImpact = null) {
    if (!this.ok) { if (onImpact) await onImpact(); return; }
    const rig = this.units.get(attacker);
    if (!rig) { if (onImpact) await onImpact(); return; }

    const fast = !!opts.fast;
    const spd = fast ? 0.42 : 1.0;
    const isMelee = !['thunder', 'magic', 'fire', 'water', 'arrow', 'heal', 'buff', 'debuff', 'chain'].includes(fxType) && rig.wKind !== 'bow';
    const mainT = targets && targets[0] ? this.units.get(targets[0]) : null;
    const tPos = mainT ? mainT.root.position.clone() : new THREE.Vector3(attacker.isFoe ? 3.5 : -3.5, 0, 0);

    this.camMode = 'custom';
    const trailCol = attacker.isFoe ? 0xff5a38 : 0xffdc78;

    if (isMelee && mainT) {
      // 1) 電影側角追蹤＋角色跨過 3D 戰場衝刺並留下 3D 水墨金光殘影！
      const stopPos = tPos.clone().add(new THREE.Vector3(attacker.isFoe ? -1.6 : 1.6, 0, 0));
      this.wantPos.set(stopPos.x + (attacker.isFoe ? 2.4 : 2.1), 2.55, stopPos.z + 5.6);
      this.wantLook.set((stopPos.x + tPos.x) * 0.5, 1.25, tPos.z);

      rig.state = 'run'; rig.stateT = 0;
      await this.tweenPos(rig.root.position, rig.homePos, stopPos, 280 * spd, 0.14, rig, trailCol);

      // 2) 多關節揮斬／飛撲＋3D 刀光特效＋65ms 主機級打擊頓幀（Hit-Stop）！
      rig.state = 'attack'; rig.stateT = 0;
      await sleep(145 * spd);
      this.spawnAfterimage(rig, trailCol);
      this.spawn3DFX(fxType, rig.root.position, targets.map(t => this.units.get(t)?.root.position).filter(Boolean));
      this.hitStop = fast ? 0.025 : (fxType === 'big' ? 0.085 : 0.055);
      this.shake = fxType === 'big' ? 0.48 : 0.26;
      for (const t of targets) {
        const tr = this.units.get(t);
        if (tr) { tr.state = 'hit'; tr.stateT = 0; tr.hitFlash = 1.0; }
      }
      if (onImpact) await onImpact();
      await sleep(250 * spd);

      // 3) 輕功後躍返回陣位
      rig.state = 'run'; rig.stateT = 0;
      await this.tweenPos(rig.root.position, stopPos, rig.homePos, 240 * spd, 0.92, rig, trailCol);
      rig.state = attacker.hp > 0 ? 'idle' : 'dead';
    } else {
      // 遠程弓箭／道術雷火／全體必殺／治療：FF8 低角特寫施法！
      const sign = attacker.isFoe ? -1 : 1;
      this.wantPos.set(rig.homePos.x + sign * 1.4, 2.2, rig.homePos.z + 4.4);
      this.wantLook.set(rig.homePos.x, 1.38, rig.homePos.z);
      rig.state = fxType === 'arrow' ? 'attack' : 'cast';
      rig.stateT = 0;
      if (['thunder', 'magic', 'big', 'fire'].includes(fxType)) this.dimSky = 0.58;
      await sleep(320 * spd);

      const cx = targets.reduce((s, t) => s + (this.units.get(t)?.root.position.x || 0), 0) / Math.max(1, targets.length);
      const cz = targets.reduce((s, t) => s + (this.units.get(t)?.root.position.z || 0), 0) / Math.max(1, targets.length);
      this.wantPos.set(cx + 2.8, 3.4, cz + 6.8);
      this.wantLook.set(cx, 1.25, cz);

      const tPositions = targets.map(t => this.units.get(t)?.root.position).filter(Boolean);
      this.spawn3DFX(fxType, rig.root.position, tPositions);
      if (!['heal', 'buff'].includes(fxType)) {
        this.hitStop = fast ? 0.025 : (['big', 'thunder', 'fire'].includes(fxType) ? 0.08 : 0.045);
        this.shake = ['big', 'thunder', 'fire'].includes(fxType) ? 0.54 : 0.26;
        for (const t of targets) {
          const tr = this.units.get(t);
          if (tr) { tr.state = 'hit'; tr.stateT = 0; tr.hitFlash = 1.0; }
        }
      }
      if (onImpact) await onImpact();
      await sleep(340 * spd);
      this.dimSky = 0;
      rig.state = attacker.hp > 0 ? 'idle' : 'dead';
    }

    for (const t of targets) {
      const tr = this.units.get(t);
      if (tr && tr.state === 'hit') tr.state = t.hp > 0 ? 'idle' : 'dead';
    }
    this.camMode = 'idle';
  }

  // 勝利環繞運鏡與 3D 勝利慶祝動作！
  enterVictory() {
    if (!this.ok) return;
    this.camMode = 'victory';
    for (const a of this.allies) {
      const rig = this.units.get(a);
      if (rig && a.hp > 0) { rig.state = 'victory'; rig.stateT = 0; }
    }
  }

  tweenPos(targetVec, from, to, durMs, arcH = 0, trailRig = null, trailCol = 0xffdc78) {
    return new Promise(res => {
      const t0 = performance.now();
      let ghostCount = 0;
      const step = () => {
        if (!this.alive) return res();
        const k = clamp((performance.now() - t0) / Math.max(16, durMs), 0, 1);
        const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        targetVec.lerpVectors(from, to, e);
        targetVec.y = arcH ? Math.sin(k * Math.PI) * arcH : 0;
        if (trailRig && k > 0.18 + ghostCount * 0.26 && ghostCount < 3) {
          ghostCount++;
          this.spawnAfterimage(trailRig, trailCol);
        }
        if (k < 1) requestAnimationFrame(step);
        else { targetVec.copy(to); targetVec.y = 0; res(); }
      };
      requestAnimationFrame(step);
    });
  }

  // ── 3D 空間實體招式特效（刀光圓弧、落雷光柱、火柱、水浪、箭雨、治療光環） ──
  spawn3DFX(fxType, fromPos, targetPositions) {
    const addFX = (mesh, dur, updater) => {
      this.scene.add(mesh);
      this.fxObjs.push({ mesh, life: 0, dur, updater });
    };

    for (const tp of targetPositions) {
      if (fxType === 'thunder' || fxType === 'magic') {
        const bolt = new THREE.Mesh(
          new THREE.CylinderGeometry(0.18, 0.42, 11, 8, 1, true),
          new THREE.MeshBasicMaterial({ color: 0xbfe4ff, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })
        );
        bolt.position.set(tp.x, 5.5, tp.z);
        addFX(bolt, 0.52, (m, k) => { m.scale.x = m.scale.z = 1 + k * 0.8; m.material.opacity = (1 - k) * ((Math.floor(k * 16) % 2) ? 1 : 0.45); });
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.9, 24), new THREE.MeshBasicMaterial({ color: 0x70c4ff, transparent: true, opacity: 0.9, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
        ring.rotation.x = -Math.PI / 2; ring.position.set(tp.x, 0.08, tp.z);
        addFX(ring, 0.55, (m, k) => { m.scale.setScalar(1 + k * 2.6); m.material.opacity = 1 - k; });
      } else if (fxType === 'fire') {
        const pillar = new THREE.Mesh(
          new THREE.CylinderGeometry(0.75, 0.3, 4.2, 12, 1, true),
          new THREE.MeshBasicMaterial({ color: 0xff6e1a, transparent: true, opacity: 0.88, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })
        );
        pillar.position.set(tp.x, 1.8, tp.z);
        addFX(pillar, 0.62, (m, k) => { m.rotation.y += 0.25; m.scale.set(1 + k * 0.7, 0.6 + k * 1.1, 1 + k * 0.7); m.material.opacity = 1 - k; });
      } else if (fxType === 'water') {
        const wave = new THREE.Mesh(
          new THREE.TorusGeometry(0.95, 0.26, 8, 24),
          new THREE.MeshBasicMaterial({ color: 0x4db4e6, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending })
        );
        wave.rotation.x = -Math.PI / 2; wave.position.set(tp.x, 0.25, tp.z);
        addFX(wave, 0.58, (m, k) => { m.scale.setScalar(0.6 + k * 2.2); m.position.y = 0.25 + Math.sin(k * Math.PI) * 1.4; m.material.opacity = 1 - k; });
      } else if (fxType === 'arrow') {
        const arr = new THREE.Mesh(
          new THREE.ConeGeometry(0.12, 1.4, 6),
          new THREE.MeshBasicMaterial({ color: 0xffe484, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending })
        );
        const start = fromPos.clone().add(new THREE.Vector3(0, 1.35, 0));
        const end = tp.clone().add(new THREE.Vector3(0, 1.1, 0));
        arr.position.copy(start); arr.lookAt(end); arr.rotateX(Math.PI / 2);
        addFX(arr, 0.28, (m, k) => { m.position.lerpVectors(start, end, k); m.material.opacity = k > 0.85 ? (1 - k) * 6 : 1; });
      } else if (fxType === 'heal' || fxType === 'buff' || fxType === 'debuff') {
        const col = fxType === 'heal' ? 0x6cff9a : fxType === 'buff' ? 0xffd55c : 0x9b68ff;
        for (let r = 0; r < 2; r++) {
          const halo = new THREE.Mesh(
            new THREE.TorusGeometry(0.85, 0.06, 8, 24),
            new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending })
          );
          halo.rotation.x = Math.PI / 2;
          halo.position.set(tp.x, r * 0.4, tp.z);
          addFX(halo, 0.65, (m, k) => { m.position.y = (fxType === 'debuff' ? 2.4 - k * 2.2 : 0.2 + k * 2.2) + r * 0.35; m.rotation.z += 0.14; m.material.opacity = 1 - k; });
        }
      } else {
        // 斬擊／突刺／重擊：立體發光刀弧＋氣爆球
        const slash = new THREE.Mesh(
          new THREE.TorusGeometry(fxType === 'big' ? 1.5 : 1.05, fxType === 'big' ? 0.16 : 0.09, 6, 18, Math.PI * 1.15),
          new THREE.MeshBasicMaterial({ color: fxType === 'big' ? 0xff5a2c : 0xfff0b8, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending })
        );
        slash.position.set(tp.x, 1.15, tp.z);
        slash.rotation.set(0.3, Math.random() * 2, -0.5);
        addFX(slash, 0.38, (m, k) => { m.rotation.z += 0.22; m.scale.setScalar(0.85 + k * 0.85); m.material.opacity = 1 - k; });
        if (fxType === 'big') {
          const shock = new THREE.Mesh(
            new THREE.SphereGeometry(0.65, 14, 12),
            new THREE.MeshBasicMaterial({ color: 0xffc65c, transparent: true, opacity: 0.72, wireframe: true, blending: THREE.AdditiveBlending })
          );
          shock.position.set(tp.x, 1.1, tp.z);
          addFX(shock, 0.5, (m, k) => { m.scale.setScalar(1 + k * 3.4); m.material.opacity = (1 - k) * 0.8; });
        }
      }
    }
  }

  // 3D 世界座標 → 螢幕座標（供戰鬥 HUD 精準貼附血條、名字與傷害跳字）
  projectActor(actor, heightRatio = 1.05) {
    const rig = this.units.get(actor);
    if (!rig || !this.ok) return null;
    const v = rig.root.position.clone();
    v.y += rig.height * heightRatio;
    v.project(this.camera);
    if (v.z > 1) return null;
    return { x: (v.x * 0.5 + 0.5) * this.w, y: (-v.y * 0.5 + 0.5) * this.h };
  }

  loop(now) {
    if (!this.alive) return;
    const rawDt = Math.min(0.05, (now - this.lastNow) / 1000);
    this.lastNow = now;

    // 主機級 Hit-Stop 打擊頓幀：命中瞬間定格角色動畫與粒子，保留攝影機震動製造強烈打擊重量感！
    let dt = rawDt;
    if (this.hitStop > 0) {
      this.hitStop = Math.max(0, this.hitStop - rawDt);
      dt = rawDt * 0.06;
    }
    this.t += dt;

    // 1) 驅動所有 2.5D 多關節蒙皮彩繪角色與猛獸動畫
    for (const rig of this.units.values()) {
      animateBattleRig(rig, dt, this.t, this.camera);
    }

    // 1b) 更新 3D 衝刺殘影淡出
    for (let i = this.afterimages.length - 1; i >= 0; i--) {
      const ai = this.afterimages[i];
      ai.life += rawDt;
      if (ai.life >= ai.dur) {
        this.scene.remove(ai.mesh);
        ai.mat.dispose();
        this.afterimages.splice(i, 1);
      } else {
        ai.uniforms.uAlpha.value = (1 - ai.life / ai.dur) * 0.45;
      }
    }

    // 2) 驅動火盆、指標、3D 特效與場景粒子
    for (const b of this.braziers) {
      b.pl.intensity = 2.8 + Math.sin(this.t * 8 + b.ph) * 0.65;
      b.flame.scale.y = 0.85 + Math.sin(this.t * 11 + b.ph) * 0.22;
    }
    for (const ptr of this.pointers) {
      ptr.rotation.y += dt * 3.6;
      ptr.position.y = ptr.userData.rig.height + 0.55 + Math.sin(this.t * 6) * 0.12;
    }
    for (let i = this.fxObjs.length - 1; i >= 0; i--) {
      const f = this.fxObjs[i];
      f.life += dt;
      if (f.life >= f.dur) {
        this.scene.remove(f.mesh);
        f.mesh.geometry && f.mesh.geometry.dispose();
        f.mesh.material && f.mesh.material.dispose();
        this.fxObjs.splice(i, 1);
      } else {
        f.updater(f.mesh, f.life / f.dur);
      }
    }
    if (this.pts) {
      const arr = this.pts.geometry.attributes.position.array;
      for (let i = 0; i < arr.length; i += 3) {
        arr[i] += this.ptsVel[i] * dt;
        arr[i + 1] += this.ptsVel[i + 1] * dt;
        arr[i + 2] += this.ptsVel[i + 2] * dt;
        if (arr[i + 1] < 0.1) arr[i + 1] = 6.8;
        if (arr[i + 1] > 7.2) arr[i + 1] = 0.2;
      }
      this.pts.geometry.attributes.position.needsUpdate = true;
    }

    // 施法時天幕壓暗增添戲劇張力
    if (this.domeMat) {
      const wantB = 1 - this.dimSky * 0.58;
      const c = this.domeMat.color.r;
      const nc = c + (wantB * 0.87 - c) * Math.min(1, dt * 6);
      this.domeMat.color.setRGB(nc, nc * 0.97, nc * 0.92);
    }

    // 3) FF8 經典寬銀幕 3/4 電影運鏡（完整收錄 4 名我方好漢與敵方陣型，不切邊！）
    const portrait = this.h > this.w;
    if (this.camMode === 'intro') {
      this.introT += dt;
      const k = clamp(this.introT / 0.88, 0, 1);
      const e = 1 - Math.pow(1 - k, 3);
      const basePos = portrait ? new THREE.Vector3(1.2, 4.6, 13.4) : new THREE.Vector3(1.2, 3.35, 11.2);
      this.camPos.lerpVectors(new THREE.Vector3(-4.8, 2.4, 11.4), basePos, e);
      this.camLook.lerpVectors(new THREE.Vector3(-2.0, 1.2, 0), new THREE.Vector3(0.0, 1.2, 0.1), e);
      if (k >= 1) this.camMode = 'idle';
    } else if (this.camMode === 'idle') {
      const basePos = portrait ? new THREE.Vector3(1.2, 4.6, 13.4) : new THREE.Vector3(1.2, 3.35, 11.2);
      this.wantPos.set(
        basePos.x + Math.sin(this.t * 0.36) * 0.85,
        basePos.y + Math.sin(this.t * 0.52) * 0.2,
        basePos.z + Math.cos(this.t * 0.36) * 0.5
      );
      this.wantLook.set(0.0, 1.2, 0.1);
      const a = 1 - Math.exp(-4.5 * dt);
      this.camPos.lerp(this.wantPos, a);
      this.camLook.lerp(this.wantLook, a);
    } else if (this.camMode === 'victory') {
      const ang = this.t * 0.55;
      this.wantPos.set(3.5 + Math.cos(ang) * 4.4, 2.35, Math.sin(ang) * 4.4);
      this.wantLook.set(3.5, 1.15, 0.2);
      const a = 1 - Math.exp(-3.5 * dt);
      this.camPos.lerp(this.wantPos, a);
      this.camLook.lerp(this.wantLook, a);
    } else {
      const a = 1 - Math.exp(-7.5 * dt);
      this.camPos.lerp(this.wantPos, a);
      this.camLook.lerp(this.wantLook, a);
    }

    let sx = 0, sy = 0;
    if (this.shake > 0.005) {
      sx = (Math.random() - 0.5) * this.shake;
      sy = (Math.random() - 0.5) * this.shake;
      this.shake *= Math.exp(-9.5 * dt);
    } else {
      this.shake = 0;
    }

    this.camera.position.set(this.camPos.x + sx, this.camPos.y + sy, this.camPos.z);
    this.camera.lookAt(this.camLook);
    this.renderer.render(this.scene, this.camera);

    // 4) 將 3D 敵我螢幕投影同步給 HUD 血條與跳字層
    if (this.onProject) this.onProject(this);

    this.raf = requestAnimationFrame(t => this.loop(t));
  }

  destroy() {
    this.alive = false;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.resize);
    if (this.renderer) {
      this.scene.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
          else o.material.dispose();
        }
      });
      this.renderer.dispose();
    }
    if (this.canvas && this.canvas.parentElement) this.canvas.remove();
  }
}
