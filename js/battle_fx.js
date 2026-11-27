// 家用主機級戰鬥水墨粒子與招式特效引擎（60 FPS Canvas VFX）
// 支援所有招式類型（斬擊、突刺、雷電、火炎、水濤、箭雨、鎖鏈、重擊、治療、強化／弱化）與場景氛圍粒子

function rnd(a, b) { return a + Math.random() * (b - a); }

export class BattleVFX {
  constructor(root, bgName = '') {
    this.root = root;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'b-vfx';
    this.canvas.setAttribute('aria-hidden', 'true');
    root.append(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = 1;
    this.h = 1;
    this.fx = [];
    this.particles = [];
    this.ambient = [];
    this.alive = true;
    this.raf = 0;
    this.lastT = performance.now();

    this.resize = this.resize.bind(this);
    this.resize();
    window.addEventListener('resize', this.resize);
    this.initAmbient(bgName || '');
    this.loop(this.lastT);
  }

  resize() {
    if (!this.alive) return;
    const r = this.root.getBoundingClientRect();
    this.w = Math.max(1, r.width || window.innerWidth);
    this.h = Math.max(1, r.height || window.innerHeight);
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
  }

  initAmbient(bg) {
    let mode = 'motes';
    if (/shanshen|caoliao/.test(bg)) mode = 'snowfire';
    else if (/fachang|zhujia|fort|yanwu/.test(bg)) mode = 'embers';
    else if (/marsh|river|xunyang/.test(bg)) mode = 'mist';
    else if (/yezhu|jingyang|huangni|qingfeng|pantuolu/.test(bg)) mode = 'leaves';
    this.ambientMode = mode;

    const count = mode === 'snowfire' ? 68 : mode === 'embers' ? 48 : 38;
    for (let i = 0; i < count; i++) {
      this.ambient.push({
        x: Math.random() * this.w,
        y: Math.random() * this.h,
        s: rnd(1.5, mode === 'mist' ? 28 : 4.2),
        vx: rnd(-18, 22),
        vy: mode === 'embers' ? rnd(-55, -18) : mode === 'snowfire' ? (i % 3 === 0 ? rnd(-42, -16) : rnd(22, 58)) : rnd(10, 32),
        ph: rnd(0, 6.28),
        a: rnd(0.25, 0.85),
        fire: mode === 'embers' || (mode === 'snowfire' && i % 3 === 0),
      });
    }
  }

  rectOf(el) {
    if (!el) return { x: this.w * 0.5, y: this.h * 0.45, w: 120, h: 120 };
    const br = this.root.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return {
      x: r.left - br.left + r.width / 2,
      y: r.top - br.top + r.height * 0.46,
      w: Math.max(64, r.width),
      h: Math.max(64, r.height),
    };
  }

  spawnParticles(x, y, count, opts = {}) {
    for (let i = 0; i < count; i++) {
      const ang = opts.angle != null ? opts.angle + rnd(-(opts.spread || 0.5), opts.spread || 0.5) : rnd(0, 6.283);
      const spd = rnd(opts.minSpd || 70, opts.maxSpd || 290);
      this.particles.push({
        x: x + rnd(-16, 16),
        y: y + rnd(-16, 16),
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd + (opts.vyBias || 0),
        g: opts.g ?? 220,
        size: rnd(opts.minS || 2.5, opts.maxS || 7),
        life: 0,
        maxLife: rnd(opts.minL || 0.28, opts.maxL || 0.65),
        color: Array.isArray(opts.color) ? opts.color[Math.floor(Math.random() * opts.color.length)] : (opts.color || '#ffd878'),
        ink: !!opts.ink,
        glow: opts.glow !== false,
      });
    }
  }

  // 主入口：依招式類型播放對應水墨／元素特效
  play(fxType, fromEl, targetEls, opts = {}) {
    if (!this.alive) return;
    const from = this.rectOf(fromEl);
    const targets = (targetEls && targetEls.length ? targetEls : [null]).map(el => this.rectOf(el));
    const now = performance.now();

    switch (fxType) {
      case 'slash':
        for (const t of targets) {
          this.fx.push({ kind: 'slash', x: t.x, y: t.y, r: Math.max(70, t.w * 0.62), ang: rnd(-0.7, -0.35), t0: now, dur: 380, color: '#fff3d0', accent: '#c8372a' });
          this.spawnParticles(t.x, t.y, 18, { color: ['#fff6d8', '#ffd26a', '#1b1410'], ink: true });
        }
        break;
      case 'sweep': {
        const cx = targets.reduce((s, t) => s + t.x, 0) / targets.length;
        const cy = targets.reduce((s, t) => s + t.y, 0) / targets.length;
        const span = Math.max(160, this.w * 0.36);
        this.fx.push({ kind: 'sweep', x: cx, y: cy, r: span, t0: now, dur: 480, color: '#ffe5a3', accent: '#b8251a' });
        for (const t of targets) {
          this.spawnParticles(t.x, t.y, 14, { color: ['#ffe5a3', '#d93829', '#14100d'], ink: true, maxSpd: 340 });
        }
        break;
      }
      case 'thrust':
        for (const t of targets) {
          const ang = Math.atan2(t.y - from.y, t.x - from.x);
          this.fx.push({ kind: 'thrust', fx: from.x, fy: from.y, x: t.x, y: t.y, ang, t0: now, dur: 400 });
          this.spawnParticles(t.x, t.y, 22, { angle: ang, spread: 0.55, color: ['#ffffff', '#ffe08a', '#e04832'], maxSpd: 390 });
        }
        break;
      case 'claw':
      case 'multi':
        for (const t of targets) {
          for (let k = 0; k < 3; k++) {
            this.fx.push({ kind: 'slash', x: t.x + rnd(-26, 26), y: t.y + rnd(-22, 22), r: Math.max(58, t.w * 0.52), ang: -0.65 + k * 0.48, t0: now + k * 65, dur: 310, color: '#fff0d8', accent: '#d83828' });
          }
          this.spawnParticles(t.x, t.y, 22, { color: ['#ffdf85', '#e24030', '#16100d'], ink: true });
        }
        break;
      case 'big':
        for (const t of targets) {
          this.fx.push({ kind: 'big', x: t.x, y: t.y, r: Math.max(110, t.w * 0.85), t0: now, dur: 620 });
          this.spawnParticles(t.x, t.y, 38, { color: ['#fff6d2', '#ffae38', '#d42618', '#15100c'], maxSpd: 440, minS: 3, maxS: 10, ink: true });
        }
        break;
      case 'thunder':
      case 'magic':
        for (const t of targets) {
          const pts = this.makeBolt(t.x + rnd(-25, 25), 0, t.x, t.y + 18, 9);
          const br = this.makeBolt(pts[4][0], pts[4][1], t.x + rnd(-80, 80), t.y - 10, 5);
          this.fx.push({ kind: 'thunder', x: t.x, y: t.y, pts, br, t0: now, dur: 540 });
          this.spawnParticles(t.x, t.y, 26, { color: ['#ffffff', '#a8d8ff', '#5ca8ff'], g: 80, maxSpd: 360 });
        }
        break;
      case 'fire':
        for (const t of targets) {
          this.fx.push({ kind: 'fire', x: t.x, y: t.y, r: Math.max(76, t.w * 0.65), t0: now, dur: 620 });
          this.spawnParticles(t.x, t.y, 34, { color: ['#fff1a8', '#ff8c28', '#d62814'], vyBias: -140, g: -40, maxSpd: 260, maxS: 9 });
        }
        break;
      case 'water':
        for (const t of targets) {
          this.fx.push({ kind: 'water', x: t.x, y: t.y, r: Math.max(85, t.w * 0.72), t0: now, dur: 580 });
          this.spawnParticles(t.x, t.y, 28, { color: ['#eefaff', '#74c6e8', '#1e5c82'], vyBias: -90, g: 310, maxSpd: 310 });
        }
        break;
      case 'arrow':
        targets.forEach((t, idx) => {
          this.fx.push({ kind: 'arrow', fx: from.x, fy: from.y - 12, x: t.x, y: t.y, t0: now + idx * 70, dur: 320 });
          setTimeout(() => {
            if (this.alive) this.spawnParticles(t.x, t.y, 18, { color: ['#ffffff', '#ffe285', '#f08a30'], maxSpd: 320 });
          }, 170 + idx * 70);
        });
        break;
      case 'chain':
        for (const t of targets) {
          this.fx.push({ kind: 'chain', x: t.x, y: t.y, r: Math.max(62, t.w * 0.52), t0: now, dur: 560 });
          this.spawnParticles(t.x, t.y, 16, { color: ['#ffd970', '#c09040', '#ffffff'], maxSpd: 220 });
        }
        break;
      case 'heal':
        for (const t of targets) {
          this.fx.push({ kind: 'aura', x: t.x, y: t.y, r: Math.max(66, t.w * 0.58), color: '#6eff9d', accent: '#eaffd0', dir: -1, t0: now, dur: 680 });
          this.spawnParticles(t.x, t.y + 30, 22, { color: ['#e8ffdc', '#78f5a2', '#ffe78a'], vyBias: -130, g: -60, maxSpd: 140 });
        }
        break;
      case 'buff':
        for (const t of targets) {
          this.fx.push({ kind: 'aura', x: t.x, y: t.y, r: Math.max(64, t.w * 0.56), color: '#ffd35a', accent: '#fff4cf', dir: -1, t0: now, dur: 620 });
          this.spawnParticles(t.x, t.y + 24, 20, { color: ['#fff6d2', '#ffcf54', '#ff9838'], vyBias: -140, g: -40, maxSpd: 150 });
        }
        break;
      case 'debuff':
        for (const t of targets) {
          this.fx.push({ kind: 'aura', x: t.x, y: t.y, r: Math.max(64, t.w * 0.56), color: '#9c6cff', accent: '#28183a', dir: 1, t0: now, dur: 620 });
          this.spawnParticles(t.x, t.y - 24, 18, { color: ['#b68cff', '#5c349e', '#1a1226'], vyBias: 90, g: 80, maxSpd: 140, ink: true });
        }
        break;
      default:
        for (const t of targets) {
          this.fx.push({ kind: 'slash', x: t.x, y: t.y, r: 72, ang: -0.5, t0: now, dur: 350, color: '#fff3d0', accent: '#c8372a' });
          this.spawnParticles(t.x, t.y, 14, { color: ['#fff4d0', '#ffca60'] });
        }
    }
  }

  makeBolt(x0, y0, x1, y1, segs) {
    const pts = [[x0, y0]];
    for (let i = 1; i < segs; i++) {
      const k = i / segs;
      pts.push([x0 + (x1 - x0) * k + rnd(-34, 34), y0 + (y1 - y0) * k + rnd(-12, 12)]);
    }
    pts.push([x1, y1]);
    return pts;
  }

  loop(now) {
    if (!this.alive) return;
    const dt = Math.min(0.05, (now - this.lastT) / 1000);
    this.lastT = now;

    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);

    this.drawAmbient(ctx, dt, now / 1000);
    this.drawFX(ctx, now);
    this.drawParticles(ctx, dt);

    this.raf = requestAnimationFrame(t => this.loop(t));
  }

  drawAmbient(ctx, dt, t) {
    ctx.save();
    for (const p of this.ambient) {
      p.x += (p.vx + Math.sin(t * 1.4 + p.ph) * 14) * dt;
      p.y += p.vy * dt;
      if (p.x < -40) p.x = this.w + 30;
      if (p.x > this.w + 40) p.x = -30;
      if (p.y < -40) p.y = this.h + 30;
      if (p.y > this.h + 40) p.y = -30;

      if (this.ambientMode === 'mist') {
        ctx.fillStyle = `rgba(220,234,232,${p.a * 0.12})`;
        ctx.beginPath(); ctx.ellipse(p.x, p.y, p.s * 3.2, p.s * 0.9, 0, 0, 6.28); ctx.fill();
      } else if (p.fire) {
        ctx.fillStyle = `rgba(255,148,54,${p.a * (0.65 + 0.35 * Math.sin(t * 7 + p.ph))})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.s * 0.72, 0, 6.28); ctx.fill();
      } else if (this.ambientMode === 'snowfire') {
        ctx.fillStyle = `rgba(242,248,255,${p.a * 0.72})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.s * 0.78, 0, 6.28); ctx.fill();
      } else if (this.ambientMode === 'leaves') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(t * 1.2 + p.ph);
        ctx.fillStyle = `rgba(182,198,118,${p.a * 0.55})`;
        ctx.beginPath(); ctx.ellipse(0, 0, p.s * 1.4, p.s * 0.55, 0, 0, 6.28); ctx.fill();
        ctx.restore();
      } else {
        ctx.fillStyle = `rgba(255,232,168,${p.a * 0.42})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.s * 0.65, 0, 6.28); ctx.fill();
      }
    }
    ctx.restore();
  }

  drawFX(ctx, now) {
    this.fx = this.fx.filter(f => now < f.t0 + f.dur);
    for (const f of this.fx) {
      if (now < f.t0) continue;
      const k = (now - f.t0) / f.dur;
      const fade = 1 - k;
      ctx.save();

      if (f.kind === 'slash') {
        ctx.translate(f.x, f.y);
        ctx.rotate(f.ang);
        const sweep = Math.min(1, k * 2.2);
        const a0 = -1.25, a1 = a0 + 2.5 * sweep;
        // 水墨外暈
        ctx.strokeStyle = `rgba(16,12,10,${fade * 0.85})`;
        ctx.lineWidth = 22 * fade;
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(0, f.r * 0.35, f.r, a0, a1); ctx.stroke();
        // 朱紅氣勁
        ctx.strokeStyle = f.accent;
        ctx.globalAlpha = fade * 0.9;
        ctx.lineWidth = 11 * fade;
        ctx.beginPath(); ctx.arc(0, f.r * 0.35, f.r * 0.98, a0, a1); ctx.stroke();
        // 白熱刀鋒核心
        ctx.strokeStyle = f.color;
        ctx.globalAlpha = fade;
        ctx.lineWidth = 4.5 * fade;
        ctx.beginPath(); ctx.arc(0, f.r * 0.35, f.r * 0.96, a0 + 0.1, a1); ctx.stroke();
      } else if (f.kind === 'sweep') {
        ctx.translate(f.x, f.y);
        const sw = Math.min(1, k * 1.9);
        ctx.strokeStyle = `rgba(18,12,10,${fade * 0.8})`;
        ctx.lineWidth = 30 * fade; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.ellipse(0, 12, f.r, f.r * 0.28, -0.08, Math.PI * (1.15 - sw * 1.15), Math.PI * 1.15); ctx.stroke();
        ctx.strokeStyle = f.accent; ctx.globalAlpha = fade * 0.9; ctx.lineWidth = 15 * fade;
        ctx.beginPath(); ctx.ellipse(0, 12, f.r * 0.98, f.r * 0.26, -0.08, Math.PI * (1.15 - sw * 1.15), Math.PI * 1.15); ctx.stroke();
        ctx.strokeStyle = f.color; ctx.globalAlpha = fade; ctx.lineWidth = 5 * fade;
        ctx.beginPath(); ctx.ellipse(0, 12, f.r * 0.95, f.r * 0.24, -0.08, Math.PI * (1.15 - sw * 1.15), Math.PI * 1.15); ctx.stroke();
      } else if (f.kind === 'thrust') {
        const px = f.fx + (f.x - f.fx) * Math.min(1, k * 2.4);
        const py = f.fy + (f.y - f.fy) * Math.min(1, k * 2.4);
        const gr = ctx.createLinearGradient(f.fx, f.fy, px, py);
        gr.addColorStop(0, 'rgba(255,220,120,0)');
        gr.addColorStop(0.7, `rgba(255,190,80,${fade * 0.85})`);
        gr.addColorStop(1, `rgba(255,255,255,${fade})`);
        ctx.strokeStyle = gr; ctx.lineWidth = 14 * fade; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(f.fx, f.fy); ctx.lineTo(px, py); ctx.stroke();
        // 衝擊環
        ctx.translate(f.x, f.y);
        ctx.rotate(f.ang);
        ctx.strokeStyle = `rgba(255,236,170,${fade})`;
        ctx.lineWidth = 4 * fade;
        ctx.beginPath(); ctx.ellipse(0, 0, 18 + k * 42, 40 + k * 78, 0, 0, 6.28); ctx.stroke();
      } else if (f.kind === 'big') {
        const r = f.r * (0.35 + k * 1.15);
        // 水墨爆裂外環
        ctx.strokeStyle = `rgba(18,10,8,${fade * 0.9})`;
        ctx.lineWidth = 18 * fade;
        ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, 6.28); ctx.stroke();
        // 金紅光爆核心
        const gr = ctx.createRadialGradient(f.x, f.y, 4, f.x, f.y, r);
        gr.addColorStop(0, `rgba(255,250,220,${fade * 0.95})`);
        gr.addColorStop(0.45, `rgba(218,52,28,${fade * 0.65})`);
        gr.addColorStop(1, 'rgba(20,10,8,0)');
        ctx.fillStyle = gr;
        ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, 6.28); ctx.fill();
        // 筆觸放射裂紋
        ctx.strokeStyle = `rgba(255,225,130,${fade})`;
        ctx.lineWidth = 3.5 * fade;
        for (let i = 0; i < 8; i++) {
          const a = i * 0.785 + 0.2;
          ctx.beginPath();
          ctx.moveTo(f.x + Math.cos(a) * r * 0.28, f.y + Math.sin(a) * r * 0.28);
          ctx.lineTo(f.x + Math.cos(a) * r * 1.12, f.y + Math.sin(a) * r * 1.12);
          ctx.stroke();
        }
      } else if (f.kind === 'thunder') {
        const flick = (Math.floor(k * 14) % 2 === 0) ? 1 : 0.55;
        const drawPath = (pts, w, col) => {
          ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineJoin = 'miter';
          ctx.beginPath(); pts.forEach((p, idx) => idx ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke();
        };
        ctx.globalAlpha = fade * flick;
        drawPath(f.pts, 18, 'rgba(100,180,255,0.55)');
        drawPath(f.pts, 5.5, '#ffffff');
        drawPath(f.br, 8, 'rgba(120,190,255,0.4)');
        drawPath(f.br, 2.5, '#eef8ff');
        // 落雷地面光環
        ctx.strokeStyle = `rgba(170,225,255,${fade})`;
        ctx.lineWidth = 5 * fade;
        ctx.beginPath(); ctx.ellipse(f.x, f.y + 24, 24 + k * 78, 10 + k * 28, 0, 0, 6.28); ctx.stroke();
      } else if (f.kind === 'fire') {
        const r = f.r * (0.5 + k * 0.85);
        const gr = ctx.createRadialGradient(f.x, f.y, 4, f.x, f.y - k * 28, r);
        gr.addColorStop(0, `rgba(255,250,190,${fade * 0.95})`);
        gr.addColorStop(0.45, `rgba(255,112,26,${fade * 0.78})`);
        gr.addColorStop(0.8, `rgba(180,24,12,${fade * 0.4})`);
        gr.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gr;
        ctx.beginPath(); ctx.arc(f.x, f.y - k * 20, r, 0, 6.28); ctx.fill();
      } else if (f.kind === 'water') {
        const r = f.r * (0.45 + k * 0.95);
        ctx.strokeStyle = `rgba(28,88,128,${fade * 0.85})`;
        ctx.lineWidth = 22 * fade; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(f.x, f.y + 14, r, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
        ctx.strokeStyle = `rgba(195,240,255,${fade * 0.95})`;
        ctx.lineWidth = 8 * fade;
        ctx.beginPath(); ctx.arc(f.x, f.y + 14, r * 0.92, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
      } else if (f.kind === 'arrow') {
        const p = Math.min(1, k * 1.7);
        const x = f.fx + (f.x - f.fx) * p;
        const y = f.fy + (f.y - f.fy) * p;
        const tx = f.fx + (f.x - f.fx) * Math.max(0, p - 0.35);
        const ty = f.fy + (f.y - f.fy) * Math.max(0, p - 0.35);
        const gr = ctx.createLinearGradient(tx, ty, x, y);
        gr.addColorStop(0, 'rgba(255,210,90,0)');
        gr.addColorStop(1, `rgba(255,248,210,${fade})`);
        ctx.strokeStyle = gr; ctx.lineWidth = 6; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x, y); ctx.stroke();
        if (p >= 0.95) {
          ctx.strokeStyle = `rgba(255,220,120,${fade})`;
          ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(f.x, f.y, (k - 0.5) * 90, 0, 6.28); ctx.stroke();
        }
      } else if (f.kind === 'chain') {
        ctx.strokeStyle = `rgba(225,175,78,${fade})`;
        ctx.lineWidth = 6 * fade;
        ctx.setLineDash([12, 8]);
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.ellipse(f.x, f.y + (i - 1) * 20, f.r * (1.2 - k * 0.45), f.r * 0.25, (i - 1) * 0.25, 0, 6.28);
          ctx.stroke();
        }
      } else if (f.kind === 'aura') {
        const yOff = f.dir * k * 48;
        const gr = ctx.createRadialGradient(f.x, f.y + yOff, 6, f.x, f.y + yOff, f.r * (0.7 + k * 0.5));
        gr.addColorStop(0, f.accent);
        gr.addColorStop(0.5, f.color);
        gr.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = fade * 0.65;
        ctx.fillStyle = gr;
        ctx.beginPath(); ctx.arc(f.x, f.y + yOff, f.r * (0.7 + k * 0.5), 0, 6.28); ctx.fill();
        ctx.globalAlpha = fade * 0.9;
        ctx.strokeStyle = f.color; ctx.lineWidth = 4 * fade;
        ctx.beginPath(); ctx.ellipse(f.x, f.y + 30 + yOff, f.r * (0.4 + k * 0.65), f.r * 0.22, 0, 0, 6.28); ctx.stroke();
      }
      ctx.restore();
    }
  }

  drawParticles(ctx, dt) {
    this.particles = this.particles.filter(p => p.life < p.maxLife);
    for (const p of this.particles) {
      p.life += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.g * dt;
      p.vx *= 0.96;
      const a = Math.max(0, 1 - p.life / p.maxLife);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      if (p.ink) {
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, p.size * (0.6 + a * 0.6), p.size * 0.6, Math.atan2(p.vy, p.vx), 0, 6.28);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * a, 0, 6.28);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  destroy() {
    this.alive = false;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.resize);
    if (this.canvas && this.canvas.parentElement) this.canvas.remove();
  }
}
