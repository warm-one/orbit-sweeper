/* 轨道清道夫 · 实体：飞船、太空垃圾、危险残骸、粒子系统、星空 */
(function () {
  'use strict';

  const OS = window.OS;
  const C = window.OSCFG;

  /* ---------- 飞船 ---------- */
  OS.Ship = class {
    constructor() {
      this.radius = C.ship.radius;
      this.base = {
        accel: C.ship.accel,
        maxSpeed: C.ship.maxSpeed,
        captureRadius: C.ship.captureRadius,
        magnetRadius: C.ship.magnetRadius
      };
      this.mods = { hazardSpeedMul: 1, valueMul: 1, grazeMul: 1 };
      this.reset(800, 600);
    }

    reset(w, h) {
      this.x = w / 2;
      this.y = h / 2;
      this.vx = 0;
      this.vy = 0;
      this.accel = this.base.accel;
      this.maxSpeed = this.base.maxSpeed;
      this.captureRadius = this.base.captureRadius;
      this.magnetRadius = this.base.magnetRadius;
      this.stabilizeTime = C.hazard.stabilizeTime;
      this.mods.hazardSpeedMul = 1;
      this.mods.valueMul = 1;
      this.mods.grazeMul = 1;
      this.hpMax = C.hp.start;
      this.hp = C.hp.start;
      this.invuln = 0;
      this.thrusting = false;
    }

    /* 键盘优先，其次按住指针（触屏/鼠标）跟随 */
    step(dt, input, w, h) {
      let ax = 0, ay = 0;
      const k = input.keys;
      if (k.left) ax -= 1;
      if (k.right) ax += 1;
      if (k.up) ay -= 1;
      if (k.down) ay += 1;

      if (ax || ay) {
        const d = Math.hypot(ax, ay);
        ax /= d; ay /= d;
      } else if (input.tx != null) {
        const dx = input.tx - this.x, dy = input.ty - this.y;
        const d = Math.hypot(dx, dy);
        if (d > 6) { ax = dx / d; ay = dy / d; }
      }
      /* 只有真正产生了加速度才点亮尾焰 */
      this.thrusting = !!(ax || ay);

      this.vx += ax * this.accel * dt;
      this.vy += ay * this.accel * dt;
      const damp = 1 / (1 + C.ship.drag * dt);
      this.vx *= damp;
      this.vy *= damp;
      const sp = Math.hypot(this.vx, this.vy);
      if (sp > this.maxSpeed) {
        const s = this.maxSpeed / sp;
        this.vx *= s;
        this.vy *= s;
      }
      this.x += this.vx * dt;
      this.y += this.vy * dt;

      /* 边界软反弹 */
      if (this.x < this.radius) { this.x = this.radius; this.vx *= -0.4; }
      if (this.x > w - this.radius) { this.x = w - this.radius; this.vx *= -0.4; }
      if (this.y < this.radius) { this.y = this.radius; this.vy *= -0.4; }
      if (this.y > h - this.radius) { this.y = h - this.radius; this.vy *= -0.4; }

      if (this.invuln > 0) this.invuln -= dt;
    }
  };

  /* ---------- 太空垃圾（回收目标） ---------- */
  OS.Junk = class {
    constructor(w, h, gold, shipX, shipY) {
      this.gold = !!gold;
      this.radius = OS.rand(C.junk.rMin, C.junk.rMax);
      this.value = this.gold ? C.junk.goldValue : C.junk.value;

      /* 生成点避开飞船，防止"白送" */
      let x, y, tries = 0;
      do {
        x = OS.rand(30, w - 30);
        y = OS.rand(30, h - 30);
        tries++;
      } while (tries < 24 && OS.dist2(x, y, shipX, shipY) < C.wave.spawnClearRadius * C.wave.spawnClearRadius);
      this.x = x;
      this.y = y;

      const a = OS.rand(0, OS.TAU);
      const sp = OS.rand(12, C.junk.drift);
      this.vx = Math.cos(a) * sp;
      this.vy = Math.sin(a) * sp;
      this.rot = OS.rand(0, OS.TAU);
      this.rotSpeed = OS.rand(-1.2, 1.2);

      /* 每件垃圾随机生成不规则多边形轮廓 */
      const n = OS.randInt(5, 8);
      this.verts = [];
      for (let i = 0; i < n; i++) {
        this.verts.push({ a: (i / n) * OS.TAU + OS.rand(-0.2, 0.2), r: OS.rand(0.6, 1.05) });
      }
    }

    step(dt, w, h) {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.rot += this.rotSpeed * dt;
      const m = this.radius;
      if (this.x < m) { this.x = m; this.vx = Math.abs(this.vx); }
      if (this.x > w - m) { this.x = w - m; this.vx = -Math.abs(this.vx); }
      if (this.y < m) { this.y = m; this.vy = Math.abs(this.vy); }
      if (this.y > h - m) { this.y = h - m; this.vy = -Math.abs(this.vy); }
    }

    draw(ctx) {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rot);
      ctx.beginPath();
      for (let i = 0; i < this.verts.length; i++) {
        const v = this.verts[i];
        const px = Math.cos(v.a) * v.r * this.radius;
        const py = Math.sin(v.a) * v.r * this.radius;
        if (i) ctx.lineTo(px, py);
        else ctx.moveTo(px, py);
      }
      ctx.closePath();
      if (this.gold) {
        ctx.fillStyle = 'rgba(251,191,36,0.92)';
        ctx.shadowColor = 'rgba(251,191,36,0.8)';
        ctx.shadowBlur = 14;
      } else {
        ctx.fillStyle = 'rgba(148,163,196,0.85)';
      }
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = this.gold ? 'rgba(255,224,138,0.9)' : 'rgba(190,204,232,0.5)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.restore();
    }
  };

  /* ---------- 危险残骸（高速穿过航道，碰到损血） ---------- */
  OS.Hazard = class {
    constructor(w, h, speed) {
      const side = OS.randInt(0, 3); // 0上 1右 2下 3左
      const pad = 30;
      this.warning = C.wave.warning;
      let x, y;
      if (side === 0) { x = OS.rand(0, w); y = -pad; }
      else if (side === 1) { x = w + pad; y = OS.rand(0, h); }
      else if (side === 2) { x = OS.rand(0, w); y = h + pad; }
      else { x = -pad; y = OS.rand(0, h); }
      this.x = x;
      this.y = y;

      /* 朝场内随机点飞，带一点角度扰动 */
      const tx = OS.rand(w * 0.15, w * 0.85);
      const ty = OS.rand(h * 0.15, h * 0.85);
      const d = Math.hypot(tx - x, ty - y) || 1;
      this.vx = ((tx - x) / d) * speed;
      this.vy = ((ty - y) / d) * speed;
      this.angle = Math.atan2(this.vy, this.vx);
      this.radius = 13;
      this.len = 34;
      this.blink = 0;
      this.stability = 0;  // 0~1，被磁力持续牵引的稳定进度
      this.grazed = false; // 擦弹每颗只结算一次
    }

    get active() {
      return this.warning <= 0;
    }

    step(dt) {
      this.blink += dt;
      if (this.warning > 0) {
        this.warning -= dt;
        return;
      }
      this.x += this.vx * dt;
      this.y += this.vy * dt;
    }

    offscreen(w, h) {
      return this.x < -80 || this.x > w + 80 || this.y < -80 || this.y > h + 80;
    }

    draw(ctx, w, h) {
      if (this.warning > 0) {
        /* 入场预警：边缘闪烁小箭头 */
        if (Math.floor(this.blink * 8) % 2 === 0) return;
        const cx = OS.clamp(this.x, 26, w - 26);
        const cy = OS.clamp(this.y, 26, h - 26);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(this.angle);
        ctx.fillStyle = 'rgba(248,113,113,0.9)';
        ctx.beginPath();
        ctx.moveTo(12, 0);
        ctx.lineTo(-8, -8);
        ctx.lineTo(-8, 8);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        return;
      }

      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle);
      ctx.shadowColor = 'rgba(248,113,113,0.55)';
      ctx.shadowBlur = 12;
      ctx.fillStyle = '#f87171';
      ctx.beginPath();
      ctx.moveTo(this.len / 2, 0);
      ctx.lineTo(-this.len / 2 + 6, -this.radius);
      ctx.lineTo(-this.len / 2, 0);
      ctx.lineTo(-this.len / 2 + 6, this.radius);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(254,202,202,0.9)';
      ctx.fillRect(this.len / 2 - 8, -2, 6, 4);
      ctx.restore();

      /* 稳定化进度弧：越接近完成越亮，完成时被回收 */
      if (this.stability > 0) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.strokeStyle = `rgba(103,232,249,${(0.45 + 0.5 * this.stability).toFixed(3)})`;
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(0, 0, this.len / 2 + 8, -Math.PI / 2, -Math.PI / 2 + this.stability * OS.TAU);
        ctx.stroke();
        ctx.restore();
      }
    }
  };

  /* ---------- 粒子系统（对象池驱动） ---------- */
  OS.Particles = {
    burst(g, x, y, n, color, opts = {}) {
      if (OS.reducedMotion.matches) n = Math.min(n, 6);
      const speed = opts.speed || 150;
      for (let i = 0; i < n; i++) {
        if (g.particles.length >= C.particles.cap) break;
        const a = OS.rand(0, OS.TAU);
        const sp = OS.rand(speed * 0.3, speed);
        const p = g.pool.get();
        p.x = x;
        p.y = y;
        p.vx = Math.cos(a) * sp;
        p.vy = Math.sin(a) * sp;
        p.life = p.maxLife = OS.rand(0.35, 0.8) * (opts.lifeMul || 1);
        p.size = OS.rand(1.5, 3.6);
        p.color = color;
        p.drag = 2.5;
        g.particles.push(p);
      }
    },

    step(g, dt) {
      for (let i = g.particles.length - 1; i >= 0; i--) {
        const p = g.particles[i];
        p.life -= dt;
        if (p.life <= 0) {
          g.particles.splice(i, 1);
          g.pool.put(p);
          continue;
        }
        const damp = 1 / (1 + p.drag * dt);
        p.vx *= damp;
        p.vy *= damp;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
    },

    draw(ctx, g) {
      for (const p of g.particles) {
        ctx.globalAlpha = p.life / p.maxLife;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
      ctx.globalAlpha = 1;
    }
  };

  /* ---------- 星空（两层视差 + 缓慢漂移 + 微闪烁） ---------- */
  OS.Starfield = class {
    constructor(w, h) {
      this.resize(w, h);
    }

    resize(w, h) {
      this.w = w;
      this.h = h;
      this.t = 0;
      this.layers = [
        { depth: 0.25, drift: 2.5, stars: [] },
        { depth: 0.6, drift: 5.5, stars: [] }
      ];
      const counts = [Math.round((w * h) / 16000), Math.round((w * h) / 26000)];
      this.layers.forEach((layer, li) => {
        for (let i = 0; i < counts[li]; i++) {
          layer.stars.push({
            x: Math.random() * w,
            y: Math.random() * h,
            r: li === 0 ? OS.rand(0.4, 1.0) : OS.rand(0.8, 1.7),
            tw: OS.rand(0, OS.TAU),
            base: OS.rand(0.25, li === 0 ? 0.55 : 0.85)
          });
        }
      });
    }

    draw(ctx, dt, shipX, shipY, reduced) {
      this.t += dt;
      for (const layer of this.layers) {
        const ox = reduced ? 0 : ((shipX / this.w) - 0.5) * layer.depth * -46;
        const oy = reduced ? 0 : ((shipY / this.h) - 0.5) * layer.depth * -46;
        const drift = reduced ? 0 : this.t * layer.drift;
        for (const s of layer.stars) {
          const y = (((s.y + drift + oy) % this.h) + this.h) % this.h;
          const x = (((s.x + ox) % this.w) + this.w) % this.w;
          ctx.globalAlpha = s.base * (0.7 + 0.3 * Math.sin(this.t * 1.7 + s.tw));
          ctx.fillStyle = '#cdd7f5';
          ctx.fillRect(x, y, s.r, s.r);
        }
      }
      ctx.globalAlpha = 1;
    }
  };
})();
