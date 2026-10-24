/* 轨道清道夫 · 数值配置表 —— 所有可调参数集中在这里，调难度与手感只改这个文件 */
(function () {
  'use strict';

  window.OSCFG = {
    step: 1 / 60,        // 固定物理步长（秒）
    maxFrameDt: 0.25,    // 单帧最多推进的真实时间；被节流的环境允许补帧，物理仍按固定步长子步进

    ship: {
      accel: 1500,       // 加速度 px/s²
      maxSpeed: 330,     // 最大速度 px/s
      drag: 3.0,         // 速度阻尼系数（越大越跟手）
      radius: 13,        // 船体碰撞半径
      captureRadius: 30, // 捕获判定半径
      magnetRadius: 115, // 磁力范围
      magnetPull: 2400,  // 磁力牵引加速度
      knockback: 260     // 被残骸撞上的击退速度
    },

    hp: { start: 3, max: 5, invuln: 1.3 },

    wave: {
      baseJunk: 6, junkPerWave: 2, maxJunk: 26,
      goldChance: 0.08,                                 // 金色垃圾（高价）概率
      hazardDelayStart: 3.4, hazardDelayDecay: 0.25, hazardDelayMin: 1.5, // 残骸生成间隔随波次缩短
      hazardSpeed: 140, hazardSpeedPerWave: 7, hazardSpeedMax: 320,
      warning: 0.7,        // 残骸入场前的边缘预警时长
      spawnClearRadius: 150 // 垃圾生成点与船的最小距离
    },

    hazard: {
      magnetDrag: 3.5,     // 残骸进入磁力圈后的减速强度
      stabilizeTime: 1.15, // 持续牵引该时长即可"稳定化"残骸（秒）
      stabilityDecay: 1.6, // 离开磁力圈后稳定进度完全回落的秒数
      value: 80,           // 稳定化回收得分
      grazeRadius: 46,     // 擦弹判定距离（须大于碰撞距离）
      grazeValue: 15       // 擦弹得分
    },

    junk: { drift: 55, value: 10, goldValue: 50, rMin: 9, rMax: 20 },

    combo: { step: 8, maxMult: 4, holdTime: 5 }, // 每连击 8 次倍率 +1，上限 ×4；holdTime 秒不进账清零

    slowmo: { time: 0.35, scale: 0.35 }, // 受击慢动作时长与时间缩放
    shake: { time: 0.3, power: 9 },
    particles: { cap: 500 },

    upgrades: [
      { id: 'magnet',     icon: '🧲', name: '磁力线圈', desc: '磁力范围 +18%', max: 4 },
      { id: 'engine',     icon: '🛸', name: '离子引擎', desc: '移动速度 +12%', max: 4 },
      { id: 'net',        icon: '🕸️', name: '捕获网',   desc: '捕获半径 +14%', max: 3 },
      { id: 'stabilizer', icon: '🌀', name: '稳定器',   desc: '残骸稳定牵引时间 -18%', max: 3 },
      { id: 'coat',       icon: '🪶', name: '回避涂层', desc: '擦弹得分 +60%', max: 3 },
      { id: 'armor',      icon: '🛡️', name: '纳米装甲', desc: '血量上限 +1 并完全修复', max: 2 },
      { id: 'slow',       icon: '⏳', name: '时滞力场', desc: '危险残骸速度 -15%', max: 3 },
      { id: 'value',      icon: '💎', name: '回收合同', desc: '回收价值 +20%', max: 3 }
    ],

    bestKey: 'orbitSweeper.best.v1',
    muteKey: 'orbitSweeper.muted.v1'
  };
})();
