/* 轨道清道夫 · 工具库：数学、随机、对象池、本地存储 */
(function () {
  'use strict';

  const OS = (window.OS = {});

  OS.TAU = Math.PI * 2;
  OS.rand = (a, b) => a + Math.random() * (b - a);
  OS.randInt = (a, b) => Math.floor(OS.rand(a, b + 1));
  OS.pick = (arr) => arr[(Math.random() * arr.length) | 0];
  OS.clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  OS.lerp = (a, b, t) => a + (b - a) * t;
  OS.dist2 = (ax, ay, bx, by) => {
    const dx = bx - ax, dy = by - ay;
    return dx * dx + dy * dy;
  };

  /* 对象池：粒子等短命对象循环复用，避免频繁 GC 造成掉帧 */
  OS.Pool = class {
    constructor(factory) {
      this.factory = factory;
      this.free = [];
    }
    get() {
      return this.free.pop() || this.factory();
    }
    put(obj) {
      if (this.free.length < 1024) this.free.push(obj);
    }
  };

  OS.loadJSON = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  };
  OS.saveJSON = (key, val) => {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* 隐私模式等场景静默失败 */ }
  };

  OS.fmtDate = (ts) => {
    const d = new Date(ts);
    const p = (n) => String(n).padStart(2, '0');
    return `${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  };

  OS.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
})();
