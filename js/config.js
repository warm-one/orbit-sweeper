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

    junk: { drift: 55, value: 10, goldValue: 50, rMin: 9, rMax: 20,
            tMin: 0.4, tMax: 2.5, goldT: 4, hazardT: 6 }, // 吨位：结算页的"清理量"统计

    drone: { orbitRadius: 62, angularSpeed: 2.2, captureRadius: 17 },

    combo: { step: 8, maxMult: 4, holdTime: 5 }, // 每连击 8 次倍率 +1，上限 ×4；holdTime 秒不进账清零

    slowmo: { time: 0.35, scale: 0.35 }, // 受击慢动作时长与时间缩放
    shake: { time: 0.3, power: 9 },
    particles: { cap: 500 },

    upgrades: [
      { id: 'magnet',     icon: '🧲', name: '磁力线圈', desc: '磁力范围 +18%', max: 4 },
      { id: 'engine',     icon: '🛸', name: '离子引擎', desc: '移动速度 +12%', max: 4 },
      { id: 'drone',      icon: '🤖', name: '回收无人机', desc: '一架无人机绕行，自动回收擦过的碎片', max: 2 },
      { id: 'net',        icon: '🕸️', name: '捕获网',   desc: '捕获半径 +14%', max: 3 },
      { id: 'stabilizer', icon: '🌀', name: '稳定器',   desc: '残骸稳定牵引时间 -18%', max: 3 },
      { id: 'coat',       icon: '🪶', name: '回避涂层', desc: '擦弹得分 +60%', max: 3 },
      { id: 'armor',      icon: '🛡️', name: '纳米装甲', desc: '血量上限 +1 并完全修复', max: 2 },
      { id: 'slow',       icon: '⏳', name: '时滞力场', desc: '危险残骸速度 -15%', max: 3 },
      { id: 'value',      icon: '💎', name: '回收合同', desc: '回收价值 +20%', max: 3 }
    ],

    /* 太空垃圾真实科普：结算页随机展示一条，呼应"清理轨道"的题材 */
    tips: [
      '凯斯勒效应：碎片相撞产生更多碎片，可能引发级联连锁反应，让某些轨道高度彻底不可用。',
      '国际空间站平均每年都要执行数次规避机动，躲开迎面而来的碎片。',
      '2009 年，工作的铱星 33 与废弃的宇宙 2251 卫星相撞，产生两千多块可追踪碎片。',
      '地球轨道上大于 10 厘米的可追踪物体已超过三万个；小于 1 厘米的碎片估计过亿。',
      '一块 1 厘米的铝球以轨道速度撞击，释放的能量相当于一颗手榴弹。',
      '航天器常用"惠普尔防护层"：用一层牺牲板把毫米级碎片汽化成无害的等离子体云。',
      '报废卫星的标准归宿：推入"墓地轨道"，或受控再入大气层烧毁。',
      '轨道物体相撞的相对速度可达 15 km/s，是步枪子弹的十倍以上。',
      '欧空局正在研发"太空清道夫"航天器，专门抓取废弃物体拖离轨道。',
      '低轨道碎片会被稀薄大气阻力缓慢拖落，高度越低，"自清洁"越快。'
    ],

    bestKey: 'orbitSweeper.best.v1',
    muteKey: 'orbitSweeper.muted.v1'
  };
})();
