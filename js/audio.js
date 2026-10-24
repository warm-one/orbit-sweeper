/* 轨道清道夫 · Web Audio 合成音效 —— 零音频文件，全部由振荡器与噪声实时合成 */
(function () {
  'use strict';

  const OS = window.OS;

  const audio = {
    ctx: null,
    muted: false,

    /* 必须在用户手势（点击/按键）里调用，否则浏览器禁止出声 */
    init() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) {
          try { this.ctx = new AC(); } catch (e) { this.ctx = null; }
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    },

    /* 单音：type 波形、freq 起始频率、slide 滑向频率、dur 时长、delay 延迟 */
    tone({ freq = 440, slide = null, dur = 0.15, type = 'sine', vol = 0.18, delay = 0 }) {
      if (!this.ctx || this.muted) return;
      const t0 = this.ctx.currentTime + delay;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if (slide != null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slide), t0 + dur);
      gain.gain.setValueAtTime(vol, t0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain).connect(this.ctx.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    },

    /* 噪声 burst：撞击 / 爆炸的"碎裂感" */
    noise({ dur = 0.25, vol = 0.25, delay = 0 }) {
      if (!this.ctx || this.muted) return;
      const t0 = this.ctx.currentTime + delay;
      const len = Math.max(1, (dur * this.ctx.sampleRate) | 0);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 900;
      const gain = this.ctx.createGain();
      gain.gain.value = vol;
      src.connect(filter).connect(gain).connect(this.ctx.destination);
      src.start(t0);
    },

    play(name, opt = {}) {
      if (!this.ctx || this.muted) return;
      switch (name) {
        case 'capture': {
          /* 捕获音随连击数逐步升调，越连越高昂 */
          const combo = Math.min(opt.combo || 0, 24);
          const base = 480 * Math.pow(1.045, combo);
          this.tone({ freq: base, slide: base * 1.45, dur: 0.1, type: 'triangle', vol: 0.12 });
          break;
        }
        case 'gold':
          this.tone({ freq: 660, dur: 0.1, type: 'triangle', vol: 0.15 });
          this.tone({ freq: 990, dur: 0.16, type: 'triangle', vol: 0.15, delay: 0.08 });
          break;
        case 'hit':
          this.noise({ dur: 0.3, vol: 0.3 });
          this.tone({ freq: 160, slide: 60, dur: 0.3, type: 'square', vol: 0.16 });
          break;
        case 'upgrade':
          this.tone({ freq: 523, dur: 0.12, type: 'sine', vol: 0.16 });
          this.tone({ freq: 784, dur: 0.2, type: 'sine', vol: 0.16, delay: 0.09 });
          break;
        case 'wave':
          [523, 659, 784].forEach((f, i) => this.tone({ freq: f, dur: 0.14, type: 'triangle', vol: 0.13, delay: i * 0.09 }));
          break;
        case 'over':
          [440, 349, 262].forEach((f, i) => this.tone({ freq: f, dur: 0.3, type: 'sine', vol: 0.15, delay: i * 0.18 }));
          break;
        case 'ui':
          this.tone({ freq: 700, dur: 0.06, type: 'square', vol: 0.05 });
          break;
      }
    }
  };

  OS.audio = audio;
})();
