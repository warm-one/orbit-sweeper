/* 轨道清道夫 · 游戏核心：固定步长循环、波次管理、磁力捕获、碰撞、升级与状态机 */
(function () {
  'use strict';

  const OS = window.OS;
  const C = window.OSCFG;

  OS.Game = class {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.w = 900;
      this.h = 600;

      /* 状态机：menu | playing | paused | upgrade | gameover */
      this.state = 'menu';
      this.ship = new OS.Ship();
      this.stars = new OS.Starfield(this.w, this.h);
      this.junk = [];
      this.hazards = [];
      this.particles = [];
      this.floats = [];
      this.pool = new OS.Pool(() => ({}));
      this.input = { keys: { left: false, right: false, up: false, down: false }, tx: null, ty: null };

      this.score = 0;
      this.combo = 0;
      this.mult = 1;
      this.comboTimer = 0;
      this.wave = 0;
      this.upgradeCounts = {};
      this.stats = { junk: 0, stab: 0, graze: 0 };
      this.hazardTimer = 0;
      this.hazardDelay = C.wave.hazardDelayStart;
      this.shake = 0;
      this.slowmo = 0;
      this.acc = 0;
      this.time = 0;

      this.best = OS.loadJSON(C.bestKey, []);
      this.newBestIndex = -1;

      /* 存档容错：数据损坏（非数组/条目形状不对）时静默丢弃，不让结算页崩溃 */
      if (!Array.isArray(this.best)) this.best = [];
      this.best = this.best.filter((e) =>
        e && typeof e === 'object' &&
        typeof e.score === 'number' && isFinite(e.score) &&
        typeof e.wave === 'number' && typeof e.ts === 'number'
      ).slice(0, 5);

      /* 由 main.js 注入的 UI 回调 */
      this.onStateChange = null;
      this.onHud = null;
      this.onHeartsChange = null;
      this.onWaveBanner = null;
      this.onUpgradeOffer = null;
      this.onGameOver = null;

      this.spawnMenuJunk();
    }

    resize(w, h) {
      this.w = w;
      this.h = h;
      this.stars.resize(w, h);
      /* 窗口变小时把实体收回边界内 */
      for (const j of this.junk) {
        j.x = OS.clamp(j.x, j.radius, w - j.radius);
        j.y = OS.clamp(j.y, j.radius, h - j.radius);
      }
      this.ship.x = OS.clamp(this.ship.x, this.ship.radius, w - this.ship.radius);
      this.ship.y = OS.clamp(this.ship.y, this.ship.radius, h - this.ship.radius);
    }

    setState(s) {
      this.state = s;
      if (s === 'playing') this.acc = 0; // 从暂停/升级恢复时不补帧
      if (this.onStateChange) this.onStateChange(s);
    }

    /* ---------- 一局生命周期 ---------- */
    startRun() {
      this.score = 0;
      this.combo = 0;
      this.mult = 1;
      this.comboTimer = 0;
      this.wave = 0;
      this.upgradeCounts = {};
      this.stats = { junk: 0, stab: 0, graze: 0 };
      this.newBestIndex = -1;
      this.shake = 0;
      this.slowmo = 0;
      this.junk.length = 0;
      this.hazards.length = 0;
      this.floats.length = 0;
      this.ship.reset(this.w, this.h);
      this.setState('playing');
      this.nextWave();
      if (this.onHeartsChange) this.onHeartsChange();
    }

    /* 菜单背景的装饰性漂浮垃圾 */
    spawnMenuJunk() {
      this.junk.length = 0;
      for (let i = 0; i < 10; i++) {
        this.junk.push(new OS.Junk(this.w, this.h, Math.random() < 0.1, -999, -999));
      }
    }

    backToMenu() {
      this.spawnMenuJunk();
      this.setState('menu');
    }

    /* ---------- 波次 ---------- */
    nextWave() {
      this.wave++;
      const n = Math.min(C.wave.maxJunk, C.wave.baseJunk + (this.wave - 1) * C.wave.junkPerWave);
      for (let i = 0; i < n; i++) {
        this.junk.push(new OS.Junk(this.w, this.h, Math.random() < C.wave.goldChance, this.ship.x, this.ship.y));
      }
      this.hazardDelay = this.hazardDelayFor(this.wave);
      this.hazardTimer = OS.rand(2.2, 3.2);
      if (this.onWaveBanner) this.onWaveBanner(this.wave);
    }

    hazardDelayFor(wave) {
      return Math.max(C.wave.hazardDelayMin, C.wave.hazardDelayStart - (wave - 1) * C.wave.hazardDelayDecay);
    }

    /* ---------- 主循环入口（dt 为真实秒） ---------- */
    frame(dt) {
      if (this.state === 'playing') {
        const scale = this.slowmo > 0 ? C.slowmo.scale : 1;
        this.acc += dt * scale;
        let guard = 0;
        /* 状态切换（波次完成/游戏结束）后立即停止推进本帧剩余步长，
           防止重复结算、排行榜重复写入与音效叠加 */
        while (this.acc >= C.step && this.state === 'playing' && guard++ < 16) {
          this.step(C.step);
          this.acc -= C.step;
        }
        if (this.slowmo > 0) this.slowmo = Math.max(0, this.slowmo - dt);
      } else if (this.state === 'menu') {
        /* 菜单里让装饰垃圾继续漂浮 */
        this.acc += dt;
        let guard = 0;
        while (this.acc >= C.step && guard++ < 8) {
          this.time += C.step;
          for (const j of this.junk) j.step(C.step, this.w, this.h);
          this.acc -= C.step;
        }
      }
      this.render(dt);
      if (this.onHud) this.onHud();
    }

    /* ---------- 固定步长世界推进（仅 playing） ---------- */
    step(dt) {
      this.time += dt;
      const ship = this.ship;
      ship.step(dt, this.input, this.w, this.h);

      /* 磁力牵引 + 捕获 */
      for (let i = this.junk.length - 1; i >= 0; i--) {
        const j = this.junk[i];
        const dx = ship.x - j.x, dy = ship.y - j.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d < ship.magnetRadius) {
          const pull = C.ship.magnetPull * (1 - d / ship.magnetRadius) + 220;
          j.vx += (dx / d) * pull * dt;
          j.vy += (dy / d) * pull * dt;
          /* 牵引限速，避免甩飞穿模 */
          const sp = Math.hypot(j.vx, j.vy);
          if (sp > 420) { j.vx = (j.vx / sp) * 420; j.vy = (j.vy / sp) * 420; }
        }
        j.step(dt, this.w, this.h);
        if (d < ship.captureRadius + j.radius) this.capture(j, i);
      }

      /* 危险残骸：生成、推进、拦截/擦弹/碰撞 */
      this.hazardTimer -= dt;
      if (this.hazardTimer <= 0) {
        const speed = Math.min(
          C.wave.hazardSpeedMax,
          C.wave.hazardSpeed + (this.wave - 1) * C.wave.hazardSpeedPerWave
        ) * ship.mods.hazardSpeedMul;
        this.hazards.push(new OS.Hazard(this.w, this.h, speed));
        this.hazardTimer = this.hazardDelay * OS.rand(0.75, 1.25);
      }
      for (let i = this.hazards.length - 1; i >= 0; i--) {
        const hz = this.hazards[i];
        hz.step(dt);
        if (hz.active) {
          const dx = ship.x - hz.x, dy = ship.y - hz.y;
          const d = Math.hypot(dx, dy) || 1;
          const rr = hz.radius + ship.radius - 2;

          /* 碰撞 → 损血 */
          if (ship.invuln <= 0 && d < rr) {
            this.damage(hz, i);
            continue;
          }

          /* 磁力牵引：强减速 + 稳定进度，牵引满则回收（残骸拦截） */
          if (d < ship.magnetRadius) {
            const drag = 1 / (1 + C.hazard.magnetDrag * dt);
            hz.vx *= drag;
            hz.vy *= drag;
            hz.stability += dt / ship.stabilizeTime;
            if (hz.stability >= 1) {
              this.stabilize(hz, i);
              continue;
            }
          } else if (hz.stability > 0) {
            hz.stability = Math.max(0, hz.stability - dt / C.hazard.stabilityDecay);
          }

          /* 擦弹：贴着残骸擦过（未碰撞）也结算 */
          if (!hz.grazed && d < C.hazard.grazeRadius && d > rr + 4) {
            hz.grazed = true;
            this.graze(hz, d);
          }
        }
        if (hz.offscreen(this.w, this.h)) this.hazards.splice(i, 1);
      }

      /* 推进器尾焰 */
      if (ship.thrusting && !OS.reducedMotion.matches &&
          Math.hypot(ship.vx, ship.vy) > 40 &&
          Math.random() < 0.6 && this.particles.length < C.particles.cap) {
        const ang = Math.atan2(ship.vy, ship.vx);
        const p = this.pool.get();
        const spread = OS.rand(-0.5, 0.5);
        p.x = ship.x - Math.cos(ang) * 13;
        p.y = ship.y - Math.sin(ang) * 13;
        p.vx = -Math.cos(ang + spread) * OS.rand(60, 140);
        p.vy = -Math.sin(ang + spread) * OS.rand(60, 140);
        p.life = p.maxLife = OS.rand(0.2, 0.4);
        p.size = OS.rand(1.2, 2.6);
        p.color = 'rgba(103,232,249,0.9)';
        p.drag = 3;
        this.particles.push(p);
      }

      /* 连击超时：holdTime 秒不进账则清零，逼迫玩家保持移动 */
      if (this.combo > 0) {
        this.comboTimer -= dt;
        if (this.comboTimer <= 0) {
          if (this.combo >= C.combo.step) OS.audio.play('comboBreak');
          this.combo = 0;
          this.mult = 1;
          this.comboTimer = 0;
        }
      }

      OS.Particles.step(this, dt);
      this.stepFloats(dt);
      if (this.shake > 0) this.shake -= dt;

      /* 波次清空 → 进入升级选择 */
      if (this.junk.length === 0) this.waveClear();
    }

    capture(j, i) {
      this.junk.splice(i, 1);
      this.combo++;
      this.comboTimer = C.combo.holdTime;
      this.mult = Math.min(C.combo.maxMult, 1 + Math.floor(this.combo / C.combo.step));
      const gained = Math.round(j.value * this.ship.mods.valueMul * this.mult);
      this.score += gained;
      this.stats.junk++;
      this.floats.push({
        x: j.x, y: j.y,
        text: `+${gained}`,
        sub: this.mult > 1 ? `×${this.mult}` : '',
        life: 0.9, maxLife: 0.9,
        gold: j.gold
      });
      OS.Particles.burst(this, j.x, j.y, j.gold ? 26 : 14, j.gold ? '#fbbf24' : '#67e8f9');
      OS.audio.play(j.gold ? 'gold' : 'capture', { combo: this.combo });
    }

    /* 残骸拦截：稳定进度吸满，把高速残骸变成高分回收 */
    stabilize(hz, i) {
      this.hazards.splice(i, 1);
      this.combo++;
      this.comboTimer = C.combo.holdTime;
      this.mult = Math.min(C.combo.maxMult, 1 + Math.floor(this.combo / C.combo.step));
      const gained = Math.round(C.hazard.value * this.ship.mods.valueMul * this.mult);
      this.score += gained;
      this.stats.stab++;
      this.floats.push({
        x: hz.x, y: hz.y,
        text: `拦截 +${gained}`,
        sub: this.mult > 1 ? `×${this.mult}` : '',
        life: 1.1, maxLife: 1.1,
        gold: true
      });
      OS.Particles.burst(this, hz.x, hz.y, 24, '#f87171', { speed: 220 });
      OS.Particles.burst(this, hz.x, hz.y, 18, '#67e8f9', { speed: 260 });
      OS.audio.play('stabil');
    }

    /* 擦弹：贴着残骸擦过的高风险走位奖励 */
    graze(hz, d) {
      this.combo++;
      this.comboTimer = C.combo.holdTime;
      this.mult = Math.min(C.combo.maxMult, 1 + Math.floor(this.combo / C.combo.step));
      const gained = Math.round(C.hazard.grazeValue * this.ship.mods.grazeMul * this.mult);
      this.score += gained;
      this.stats.graze++;
      this.floats.push({
        x: this.ship.x + (hz.x - this.ship.x) / 2,
        y: this.ship.y + (hz.y - this.ship.y) / 2 - 12,
        text: `擦弹 +${gained}`,
        sub: '',
        life: 0.8, maxLife: 0.8,
        gold: false, small: true
      });
      OS.audio.play('graze');
    }

    damage(hz, i) {
      if (this.state !== 'playing') return;
      const ship = this.ship;
      this.hazards.splice(i, 1);
      ship.hp--;
      this.combo = 0;
      this.mult = 1;
      this.comboTimer = 0;
      ship.invuln = C.hp.invuln;
      /* 沿撞击方向击退 */
      const dx = ship.x - hz.x, dy = ship.y - hz.y;
      const d = Math.hypot(dx, dy) || 1;
      ship.vx = (dx / d) * C.ship.knockback;
      ship.vy = (dy / d) * C.ship.knockback;
      if (!OS.reducedMotion.matches) {
        this.shake = C.shake.time;
        this.slowmo = C.slowmo.time;
      }
      OS.Particles.burst(this, hz.x, hz.y, 30, '#f87171', { speed: 240 });
      OS.audio.play('hit');
      if (this.onHeartsChange) this.onHeartsChange();
      if (ship.hp <= 0) this.gameOver();
    }

    waveClear() {
      if (this.state !== 'playing') return;
      OS.audio.play('wave');
      this.setState('upgrade');
      if (this.onUpgradeOffer) this.onUpgradeOffer(this.pickUpgrades());
    }

    pickUpgrades() {
      const pool = C.upgrades.filter((u) => (this.upgradeCounts[u.id] || 0) < u.max);
      for (let i = pool.length - 1; i > 0; i--) {
        const j = (Math.random() * (i + 1)) | 0;
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      return pool.slice(0, 3);
    }

    applyUpgrade(u) {
      this.upgradeCounts[u.id] = (this.upgradeCounts[u.id] || 0) + 1;
      const ship = this.ship;
      switch (u.id) {
        case 'magnet': ship.magnetRadius *= 1.18; break;
        case 'engine': ship.maxSpeed *= 1.12; ship.accel *= 1.08; break;
        case 'net': ship.captureRadius *= 1.14; break;
        case 'stabilizer': ship.stabilizeTime *= 0.82; break;
        case 'coat': ship.mods.grazeMul *= 1.6; break;
        case 'armor':
          ship.hpMax = Math.min(C.hp.max, ship.hpMax + 1);
          ship.hp = ship.hpMax;
          if (this.onHeartsChange) this.onHeartsChange();
          break;
        case 'slow': ship.mods.hazardSpeedMul *= 0.85; break;
        case 'value': ship.mods.valueMul *= 1.2; break;
      }
      OS.audio.play('upgrade');
      this.setState('playing');
      this.nextWave();
    }

    /* 升级全部满级时直接进入下一波；仅在升级面板状态下有效（防连点跳波） */
    continueWave() {
      if (this.state !== 'upgrade') return;
      this.setState('playing');
      this.nextWave();
    }

    gameOver() {
      if (this.state === 'gameover') return;
      OS.Particles.burst(this, this.ship.x, this.ship.y, 60, '#67e8f9', { speed: 320, lifeMul: 1.6 });
      OS.Particles.burst(this, this.ship.x, this.ship.y, 30, '#f87171', { speed: 220, lifeMul: 1.6 });
      OS.audio.play('over');
      this.saveBest();
      this.setState('gameover');
      if (this.onGameOver) this.onGameOver();
    }

    saveBest() {
      this.newBestIndex = -1;
      const entry = { score: this.score, wave: this.wave, ts: Date.now() };
      this.best.push(entry);
      this.best.sort((a, b) => b.score - a.score);
      this.best = this.best.slice(0, 5);
      this.newBestIndex = this.best.indexOf(entry);
      OS.saveJSON(C.bestKey, this.best);
    }

    /* ---------- 浮动得分文字 ---------- */
    stepFloats(dt) {
      for (let i = this.floats.length - 1; i >= 0; i--) {
        const f = this.floats[i];
        f.life -= dt;
        f.y -= 34 * dt;
        if (f.life <= 0) this.floats.splice(i, 1);
      }
    }

    drawFloats(ctx) {
      if (!this.floats.length) return;
      ctx.textAlign = 'center';
      for (const f of this.floats) {
        ctx.globalAlpha = Math.min(1, (f.life / f.maxLife) * 2);
        ctx.fillStyle = f.gold ? '#fde68a' : '#a5f3fc';
        ctx.font = (f.small ? '500 12px ' : '600 15px ') + '"Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif';
        ctx.fillText(f.sub ? `${f.text} ${f.sub}` : f.text, f.x, f.y);
      }
      ctx.globalAlpha = 1;
    }

    /* ---------- 渲染 ---------- */
    render(dt) {
      const ctx = this.ctx;
      const w = this.w, h = this.h;
      ctx.clearRect(0, 0, w, h);

      ctx.save();
      if (this.shake > 0) {
        const p = (this.shake / C.shake.time) * C.shake.power;
        ctx.translate(OS.rand(-p, p), OS.rand(-p, p));
      }

      this.stars.draw(ctx, dt, this.ship.x, this.ship.y, OS.reducedMotion.matches);

      /* 磁力圈与捕获圈 */
      if (this.state === 'playing' || this.state === 'paused' || this.state === 'upgrade') {
        const ship = this.ship;
        const pulse = 0.5 + 0.5 * Math.sin(this.time * 3);
        ctx.strokeStyle = `rgba(103,232,249,${(0.10 + 0.06 * pulse).toFixed(3)})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(ship.x, ship.y, ship.magnetRadius, 0, OS.TAU);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(103,232,249,0.28)';
        ctx.beginPath();
        ctx.arc(ship.x, ship.y, ship.captureRadius, 0, OS.TAU);
        ctx.stroke();
      }

      for (const j of this.junk) j.draw(ctx);
      for (const hz of this.hazards) hz.draw(ctx, w, h);

      if (this.state === 'playing' || this.state === 'paused' || this.state === 'upgrade') {
        this.drawShip(ctx);
      }

      OS.Particles.draw(ctx, this);
      this.drawFloats(ctx);
      ctx.restore();
    }

    drawShip(ctx) {
      const ship = this.ship;
      /* 受击无敌期闪烁 */
      if (ship.invuln > 0 && Math.floor(ship.invuln * 12) % 2 === 0) return;
      const a = Math.atan2(ship.vy, ship.vx);
      ctx.save();
      ctx.translate(ship.x, ship.y);
      ctx.rotate(a + Math.PI / 2); /* 船体图形默认朝上 */

      /* 前方磁力线圈弧 */
      ctx.strokeStyle = 'rgba(103,232,249,0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, ship.radius + 5, -Math.PI * 0.8, -Math.PI * 0.2);
      ctx.stroke();

      /* 船体 */
      ctx.fillStyle = '#e8eefc';
      ctx.beginPath();
      ctx.moveTo(0, -ship.radius - 3);
      ctx.lineTo(ship.radius * 0.85, ship.radius);
      ctx.lineTo(0, ship.radius * 0.55);
      ctx.lineTo(-ship.radius * 0.85, ship.radius);
      ctx.closePath();
      ctx.fill();

      /* 座舱 */
      ctx.fillStyle = '#0ea5b7';
      ctx.beginPath();
      ctx.arc(0, -2, 3.4, 0, OS.TAU);
      ctx.fill();
      ctx.restore();
    }
  };
})();
