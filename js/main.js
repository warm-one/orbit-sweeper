/* 轨道清道夫 · 输入绑定、UI 同步与主循环启动 */
(function () {
  'use strict';

  const OS = window.OS;
  const C = window.OSCFG;
  const $ = (sel) => document.querySelector(sel);

  const canvas = $('#game');
  const game = new OS.Game(canvas);
  window.OSGame = game; /* 调试用句柄 */

  /* ---------- 画布尺寸（含 DPR 适配） ---------- */
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    game.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    game.resize(w, h);
  }
  window.addEventListener('resize', resize);
  resize();

  /* ---------- DOM 引用 ---------- */
  const els = {
    hud: $('#hud'),
    score: $('#hudScore'),
    combo: $('#hudCombo'),
    comboBar: $('#hudComboBar'),
    wave: $('#hudWave'),
    hearts: $('#hudHearts'),
    pauseBtn: $('#pauseBtn'),
    muteBtn: $('#muteBtn'),
    banner: $('#waveBanner'),
    bannerText: $('#waveBannerText'),
    overlay: $('#overlay'),
    menu: $('#menuPanel'),
    pause: $('#pausePanel'),
    upgrade: $('#upgradePanel'),
    gameover: $('#gameoverPanel'),
    bestListMenu: $('#bestListMenu'),
    bestListOver: $('#bestListOver'),
    overScore: $('#overScore'),
    overWave: $('#overWave'),
    overNew: $('#overNew'),
    upgradeCards: $('#upgradeCards'),
    upgradeSkip: $('#upgradeSkip'),
    startBtn: $('#startBtn'),
    resumeBtn: $('#resumeBtn'),
    quitBtn: $('#quitBtn'),
    againBtn: $('#againBtn'),
    menuBtn: $('#menuBtn')
  };

  /* ---------- 状态 → 界面同步 ---------- */
  const statePanels = { menu: els.menu, paused: els.pause, upgrade: els.upgrade, gameover: els.gameover };

  function showState(s) {
    document.body.dataset.state = s;
    for (const key in statePanels) statePanels[key].classList.toggle('hidden', key !== s);
    els.hud.classList.toggle('hidden', s === 'menu');
    els.overlay.classList.toggle('hidden', s === 'playing');
    if (s !== 'playing') document.title = '轨道清道夫 · Orbit Sweeper';
    if (s === 'menu' || s === 'gameover') renderBest();
  }
  game.onStateChange = showState;

  /* ---------- 血量 ---------- */
  function renderHearts() {
    const ship = game.ship;
    let html = '';
    for (let i = 0; i < ship.hpMax; i++) {
      html += `<span class="heart${i < ship.hp ? '' : ' lost'}">♥</span>`;
    }
    els.hearts.innerHTML = html;
  }
  game.onHeartsChange = renderHearts;

  /* ---------- 波次横幅 ---------- */
  let bannerTimer = null;
  game.onWaveBanner = (wave) => {
    els.bannerText.textContent = `第 ${wave} 波`;
    els.banner.classList.remove('hidden');
    els.banner.classList.remove('show');
    void els.banner.offsetWidth; /* 强制重排以重启动画 */
    els.banner.classList.add('show');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => {
      els.banner.classList.remove('show');
      els.banner.classList.add('hidden');
    }, 1400);
  };

  /* ---------- 升级三选一 ---------- */
  let offered = [];

  function chooseUpgrade(idx) {
    const u = offered[idx];
    if (!u || game.state !== 'upgrade') return;
    OS.audio.play('ui');
    game.applyUpgrade(u);
  }

  game.onUpgradeOffer = (list) => {
    offered = list;
    els.upgradeCards.innerHTML = '';
    if (!list.length) {
      /* 所有强化满级时给出继续按钮 */
      const btn = document.createElement('button');
      btn.className = 'upgrade-card';
      btn.innerHTML = '<span class="u-icon">🛰️</span><span class="u-main"><span class="u-name">全部强化已满级</span><span class="u-desc">点击继续下一波</span></span>';
      btn.addEventListener('click', () => {
        OS.audio.play('ui');
        game.continueWave();
      });
      els.upgradeCards.appendChild(btn);
      els.upgradeSkip.classList.add('hidden');
      return;
    }
    els.upgradeSkip.classList.remove('hidden');
    list.forEach((u, idx) => {
      const lv = game.upgradeCounts[u.id] || 0;
      const btn = document.createElement('button');
      btn.className = 'upgrade-card';
      btn.innerHTML =
        `<span class="u-icon" aria-hidden="true">${u.icon}</span>` +
        `<span class="u-main"><span class="u-name">${u.name}</span><span class="u-desc">${u.desc}</span></span>` +
        `<span class="u-lv">Lv.${lv} → ${lv + 1}</span>` +
        `<span class="u-key">${idx + 1}</span>`;
      btn.addEventListener('click', () => chooseUpgrade(idx));
      els.upgradeCards.appendChild(btn);
    });
  };

  /* ---------- 排行榜 ---------- */
  function renderBest() {
    const rows = game.best.map((e, i) =>
      `<li class="${i === game.newBestIndex ? 'new' : ''}">` +
      `<span class="b-rank">${i + 1}</span><span class="b-score">${e.score}</span>` +
      `<span class="b-wave">第 ${e.wave} 波</span><span class="b-date">${OS.fmtDate(e.ts)}</span></li>`
    ).join('');
    const empty = '<li class="empty">暂无记录 · 完成一次任务创建纪录</li>';
    els.bestListMenu.innerHTML = rows || empty;
    els.bestListOver.innerHTML = rows || empty;
  }

  game.onGameOver = () => {
    els.overScore.textContent = game.score;
    els.overWave.textContent = game.wave;
    els.overNew.classList.toggle('hidden', game.newBestIndex !== 0);
    const s = game.stats;
    document.getElementById('overMisc').textContent =
      `本局回收 ${s.junk} 件 · 拦截残骸 ${s.stab} · 擦弹 ${s.graze} 次`;
  };

  /* ---------- HUD 增量刷新（只在数值变化时写 DOM） ---------- */
  const hudCache = { score: -1, wave: -1, mult: -1, comboPct: -1 };
  game.onHud = () => {
    if (game.score !== hudCache.score) {
      hudCache.score = game.score;
      els.score.textContent = game.score;
    }
    if (game.wave !== hudCache.wave) {
      hudCache.wave = game.wave;
      els.wave.textContent = game.wave;
    }
    if (game.mult !== hudCache.mult) {
      hudCache.mult = game.mult;
      els.combo.textContent = '×' + game.mult;
      els.combo.classList.toggle('hot', game.mult > 1);
    }
    /* 连击倒计时条：只在可见状态变化或进度变化超过 2% 时写 DOM */
    const pct = game.combo > 0 ? game.comboTimer / C.combo.holdTime : 0;
    if (pct !== hudCache.comboPct) {
      hudCache.comboPct = pct;
      els.comboBar.style.transform = 'scaleX(' + pct.toFixed(3) + ')';
      els.comboBar.classList.toggle('on', game.combo > 0);
    }
    if (game.state === 'playing') {
      document.title = `${game.score} · 第 ${game.wave} 波 · 轨道清道夫`;
    }
  };

  /* ---------- 暂停 ---------- */
  function togglePause() {
    if (game.state === 'playing') {
      game.setState('paused');
      OS.audio.play('ui');
    } else if (game.state === 'paused') {
      game.setState('playing');
      OS.audio.play('ui');
    }
  }

  /* ---------- 静音 ---------- */
  function applyMuteIcon() {
    els.muteBtn.textContent = OS.audio.muted ? '🔇' : '🔊';
  }
  OS.audio.muted = !!OS.loadJSON(C.muteKey, false);
  applyMuteIcon();
  els.muteBtn.addEventListener('click', () => {
    OS.audio.init();
    OS.audio.muted = !OS.audio.muted;
    OS.saveJSON(C.muteKey, OS.audio.muted);
    applyMuteIcon();
  });

  /* ---------- 按钮事件 ---------- */
  els.startBtn.addEventListener('click', () => {
    OS.audio.init();
    OS.audio.play('ui');
    game.startRun();
  });
  els.againBtn.addEventListener('click', () => {
    OS.audio.play('ui');
    game.startRun();
  });
  els.resumeBtn.addEventListener('click', togglePause);
  els.pauseBtn.addEventListener('click', togglePause);
  els.quitBtn.addEventListener('click', () => {
    OS.audio.play('ui');
    game.backToMenu();
  });
  els.menuBtn.addEventListener('click', () => {
    OS.audio.play('ui');
    game.backToMenu();
  });
  els.upgradeSkip.addEventListener('click', () => {
    OS.audio.play('ui');
    game.continueWave();
  });

  /* ---------- 键盘 ---------- */
  const keyMap = {
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'up', KeyW: 'up',
    ArrowDown: 'down', KeyS: 'down'
  };

  window.addEventListener('keydown', (e) => {
    OS.audio.init();
    const dir = keyMap[e.code];
    if (dir) {
      game.input.keys[dir] = true;
      e.preventDefault();
      return;
    }
    if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
    if (e.code === 'Space' && game.state === 'menu') {
      game.startRun();
      e.preventDefault();
    }
    if (game.state === 'upgrade') {
      if (e.code === 'Digit1') chooseUpgrade(0);
      if (e.code === 'Digit2') chooseUpgrade(1);
      if (e.code === 'Digit3') chooseUpgrade(2);
    }
    if (e.code === 'Enter' && game.state === 'gameover') game.startRun();
  });

  window.addEventListener('keyup', (e) => {
    const dir = keyMap[e.code];
    if (dir) game.input.keys[dir] = false;
  });

  /* ---------- 指针 / 触屏（按住拖动，船跟随） ---------- */
  canvas.addEventListener('pointerdown', (e) => {
    OS.audio.init();
    if (game.state !== 'playing') return;
    if (canvas.setPointerCapture) {
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* 忽略 */ }
    }
    game.input.tx = e.clientX;
    game.input.ty = e.clientY;
  });
  canvas.addEventListener('pointermove', (e) => {
    if (game.input.tx == null) return;
    game.input.tx = e.clientX;
    game.input.ty = e.clientY;
  });
  const releasePointer = () => {
    game.input.tx = null;
    game.input.ty = null;
  };
  window.addEventListener('pointerup', releasePointer);
  canvas.addEventListener('pointercancel', releasePointer);

  /* ---------- 切后台自动暂停 ---------- */
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.state === 'playing') game.setState('paused');
  });

  /* ---------- 主循环：rAF 驱动；环境挂起 rAF 时由定时器兜底，保证预览面板等场景仍可运行 ---------- */
  let last = performance.now();
  function pump() {
    const now = performance.now();
    let dt = (now - last) / 1000;
    last = now;
    if (dt > C.maxFrameDt) dt = C.maxFrameDt;
    game.frame(dt);
  }
  function loop() {
    pump();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
  setInterval(() => {
    /* rAF 最近 250ms 内驱动过就交给 rAF，避免双驱动叠加 */
    if (performance.now() - last < 250) return;
    pump();
  }, 100);

  /* ---------- 启动 ---------- */
  renderHearts();
  showState('menu');
})();
