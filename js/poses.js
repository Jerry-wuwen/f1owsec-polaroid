(function (global) {
  'use strict';

  const ChekiGame = global.ChekiGame || (global.ChekiGame = {});

  const RARITY_STYLES = {
    N: {
      label: 'N',
      bg: '#334155',
      border: '#94A3B8',
      text: '#F8FAFC'
    },
    R: {
      label: 'R',
      bg: '#0369A1',
      border: '#38BDF8',
      text: '#E0F2FE'
    },
    SR: {
      label: 'SR',
      bg: '#6D28D9',
      border: '#C084FC',
      text: '#F5F3FF'
    },
    SSR: {
      label: 'SSR',
      bg: '#B45309',
      border: '#FACC15',
      text: '#FEF08A'
    }
  };

  // 7 个特典会动作（概率权重合计 100%，全员 35 格图鉴，居中不跑偏）
  const POSE_LIST = [
    {
      id: 'normal',
      name: '待机营业',
      rarity: 'N',
      weight: 22,
      spriteSlot: 'main',
      usePoseSprite: false,
      targetZoom: 1.0,
      flipX: false,
      tiltDeg: 0,
      fixedDuration: 0
    },
    {
      id: 'bounce',
      name: '元气跳跳',
      rarity: 'N',
      weight: 20,
      spriteSlot: 'pose',
      usePoseSprite: true,
      targetZoom: 1.0,
      flipX: false,
      tiltDeg: 0,
      fixedDuration: 0
    },
    {
      id: 'closeup',
      name: '凑近对视',
      rarity: 'R',
      weight: 16,
      spriteSlot: 'pose',
      spriteSlots: ['pose', 'main'],
      usePoseSprite: true,
      targetZoom: 1.08,
      flipX: false,
      tiltDeg: 0,
      faceLock: true,
      fixedDuration: 0
    },
    {
      id: 'cheek_tilt',
      name: '捧脸歪头',
      rarity: 'R',
      weight: 16,
      spriteSlot: 'pose3',
      usePoseSprite: true,
      targetZoom: 1.02,
      flipX: false,
      tiltDeg: 4,
      fixedDuration: 0
    },
    {
      id: 'shy',
      name: '被夸害羞',
      rarity: 'SR',
      weight: 11,
      spriteSlot: 'main',
      usePoseSprite: false,
      targetZoom: 1.04,
      flipX: false,
      tiltDeg: 0,
      fixedDuration: 0
    },
    {
      id: 'double_heart',
      name: '双手比心',
      rarity: 'SR',
      weight: 10,
      spriteSlot: 'pose4',
      usePoseSprite: true,
      targetZoom: 1.04,
      flipX: false,
      tiltDeg: 0,
      fixedDuration: 0
    },
    {
      id: 'fanservice',
      name: '专属饭撒',
      rarity: 'SSR',
      weight: 5,
      spriteSlot: 'pose2',
      usePoseSprite: true,
      targetZoom: 1.08,
      flipX: false,
      tiltDeg: 0,
      fixedDuration: 1.6
    }
  ];

  const BUBBLE_KINDS = ['heart', 'note', 'bang', 'blush', 'sparkle'];
  const PRAISE_TEXTS = ['今天超可爱!', '演出辛苦啦!', '这套超好看!'];
  const LAST_TEN_TEXTS = ['最后10秒啦!', '记住你啦!', '下次见♥'];

  function getPoseById(id) {
    return POSE_LIST.find((p) => p.id === id) || POSE_LIST[0];
  }

  function pickWeightedPose(optOrBoost, excludeId, extraRareBoost) {
    const opts = (optOrBoost && typeof optOrBoost === 'object')
      ? optOrBoost
      : {
          boostRare: Boolean(optOrBoost),
          excludeId: excludeId || null,
          extraRareBoost: Boolean(extraRareBoost),
          isLastTenSeconds: false,
          uncollectedIds: null
        };

    const candidates = POSE_LIST.filter((p) => p.id !== opts.excludeId);
    const pool = candidates.length > 0 ? candidates : POSE_LIST;
    const uncollectedSet = Array.isArray(opts.uncollectedIds) && opts.uncollectedIds.length > 0
      ? new Set(opts.uncollectedIds)
      : null;

    const weights = pool.map((p) => {
      let w = p.weight;
      if (opts.extraRareBoost) {
        if (p.rarity === 'SSR') w = 14;
        else if (p.rarity === 'SR') w = 18;
        else if (p.rarity === 'N') w = 12;
      } else if (opts.boostRare) {
        if (p.rarity === 'SSR') w = 10;
        else if (p.rarity === 'SR') w = 15;
        else if (p.rarity === 'N') w = 15;
      }

      if (opts.isLastTenSeconds) {
        if (uncollectedSet) {
          if (uncollectedSet.has(p.id)) {
            w *= 2;
          }
        } else if (p.rarity === 'SR' || p.rarity === 'SSR') {
          w *= 2;
        }
      }
      return Math.max(0.5, w);
    });

    const total = weights.reduce((acc, w) => acc + w, 0);
    let r = Math.random() * total;
    for (let i = 0; i < pool.length; i += 1) {
      r -= weights[i];
      if (r <= 0) return pool[i];
    }
    return pool[pool.length - 1];
  }

  function getTransform(poseObj, poseElapsed, totalTime, poseDir) {
    const pose = poseObj || POSE_LIST[0];
    const t = totalTime || 0;
    const elapsed = poseElapsed || 0;
    const dir = poseDir && poseDir < 0 ? -1 : 1;

    // 1. 双频自然呼吸与重心 ±1° 微晃
    const breathScaleY = 1 + Math.sin(t * 2.15) * 0.011 + Math.sin(t * 3.47 + 1.1) * 0.005;
    const breathScaleX = 1 - (breathScaleY - 1) * 0.45;
    const microTiltRad = ((Math.sin(t * 1.13) * 0.65 + Math.sin(t * 1.87 + 0.8) * 0.35) * Math.PI) / 180;

    if (pose.id === 'bounce') {
      const cycle = Math.abs(Math.sin(elapsed * 4.5));
      const jumpY = -Math.round(Math.pow(cycle, 0.85) * 11);
      const squash = cycle < 0.16 ? (1 - cycle / 0.16) * 0.045 : 0;
      const shadowScale = Math.max(0.55, 1 - Math.abs(jumpY) / 24);
      return {
        swayX: Math.round(Math.sin(t * 1.4) * 0.8),
        bobY: 0,
        jumpY,
        scaleX: breathScaleX * (1 + squash * 0.6),
        scaleY: breathScaleY * (1 - squash),
        rotateRad: microTiltRad,
        shadowScale,
        showBlush: false,
        shineProgress: -1
      };
    }

    if (pose.id === 'closeup') {
      return {
        swayX: Math.round(Math.sin(t * 1.3) * 1.0),
        bobY: Math.round(Math.sin(t * 2.1) * 0.8),
        jumpY: 0,
        scaleX: breathScaleX,
        scaleY: breathScaleY,
        rotateRad: microTiltRad,
        shadowScale: 1,
        showBlush: false,
        shineProgress: -1
      };
    }

    if (pose.id === 'cheek_tilt') {
      const tiltRad = ((dir * 4) * Math.PI) / 180;
      // 补偿脚底支点旋转引起的头部横向偏移，保证全景别绝对居中
      const pivotCompensateX = -Math.round(Math.sin(tiltRad) * 85);
      return {
        swayX: pivotCompensateX + Math.round(Math.sin(t * 1.5) * 0.6),
        bobY: Math.round(Math.sin(t * 2.2) * 1),
        jumpY: 0,
        scaleX: breathScaleX,
        scaleY: breathScaleY,
        rotateRad: tiltRad + microTiltRad * 0.6,
        shadowScale: 1,
        showBlush: false,
        shineProgress: -1
      };
    }

    if (pose.id === 'shy') {
      return {
        swayX: Math.round(Math.sin(t * 3.4) * 1.8),
        bobY: Math.round(Math.sin(t * 2.4) * 1),
        jumpY: 0,
        scaleX: breathScaleX,
        scaleY: breathScaleY,
        rotateRad: microTiltRad * 1.2,
        shadowScale: 1,
        showBlush: true,
        shineProgress: -1
      };
    }

    if (pose.id === 'double_heart') {
      const pulse = Math.sin(elapsed * 5.2) * 0.012;
      return {
        swayX: Math.round(Math.sin(t * 2.0) * 1.0),
        bobY: Math.round(Math.sin(t * 3.2) * 1.0),
        jumpY: 0,
        scaleX: breathScaleX - pulse * 0.4,
        scaleY: breathScaleY + pulse,
        rotateRad: microTiltRad,
        shadowScale: 1,
        showBlush: false,
        shineProgress: -1
      };
    }

    if (pose.id === 'fanservice') {
      const jumpY = -Math.round(Math.abs(Math.sin(elapsed * 6.5)) * 6);
      return {
        swayX: Math.round(Math.sin(t * 4.5) * 1.5),
        bobY: 0,
        jumpY,
        scaleX: breathScaleX,
        scaleY: breathScaleY,
        rotateRad: microTiltRad,
        shadowScale: Math.max(0.75, 1 - Math.abs(jumpY) / 24),
        showBlush: false,
        shineProgress: (elapsed % 1.2) / 1.2
      };
    }

    // normal: 双频自然微晃（居中稳定）
    return {
      swayX: Math.round(Math.sin(t * 1.37) * 1.0 + Math.sin(t * 2.23) * 0.4),
      bobY: Math.round(Math.sin(t * 2.61) * 1.0 + Math.sin(t * 4.13) * 0.4),
      jumpY: 0,
      scaleX: breathScaleX,
      scaleY: breathScaleY,
      rotateRad: microTiltRad,
      shadowScale: 1,
      showBlush: false,
      shineProgress: -1
    };
  }

  class PoseController {
    constructor(options) {
      const opts = options || {};
      this.onRareAlert = typeof opts.onRareAlert === 'function' ? opts.onRareAlert : null;
      this.currentPose = POSE_LIST[0];
      this.activeSpriteSlot = this.currentPose.spriteSlot || 'main';
      this.poseElapsed = 0;
      this.lastTotalTime = 0;
      this.poseDir = 1;
      this.nextSwitchIn = 2.1;
      this.cameraZoom = 1.0;
      this.manualCooldown = 0;
      this.cooldownDuration = 1.5;
      this.alertFlashTimer = 0;
      this.emotionBubble = null;
      this.callReactionDuration = 1.15;
      this.callReactionTimer = 0;
      this.callRareBoostTimer = 0;

      // 180ms 万能对焦过渡状态
      this.transitionDuration = 0.18;
      this.transitionTimer = 0;
      this.focusFlashTimer = 0;
      this.prevGhost = null;

      // 3~5s 发丝/头饰像素星芒微闪
      this.nextGlintIn = 2.6 + Math.random() * 2.0;
      this.glintDuration = 0.35;
      this.glintActiveTimer = 0;
      this.glintOffset = { rx: 0.08, ry: -0.84 };

      this.fxParticles = [];
      this.fxSpawnTimer = 0;
    }

    spawnBubble(preferredKind) {
      const lastKind = this.emotionBubble && this.emotionBubble.kind !== 'text' ? this.emotionBubble.kind : null;
      let kind = preferredKind;
      if (!kind) {
        const choices = BUBBLE_KINDS.filter((k) => k !== lastKind);
        kind = choices[Math.floor(Math.random() * choices.length)] || BUBBLE_KINDS[0];
      }
      this.emotionBubble = {
        kind,
        life: 1.5,
        maxLife: 1.5
      };
    }

    spawnTextBubble(text, color) {
      if (!text) return;
      this.emotionBubble = {
        kind: 'text',
        text: String(text),
        color: color || '#FB7185',
        life: 1.65,
        maxLife: 1.65
      };
    }

    triggerCallBoost(member) {
      this.callReactionTimer = this.callReactionDuration;
      this.callRareBoostTimer = 6.0;
      const phrase = PRAISE_TEXTS[Math.floor(Math.random() * PRAISE_TEXTS.length)];
      const mColor = (member && (member.isDarkColor ? '#F43F5E' : member.color)) || '#FB7185';
      this.spawnTextBubble(phrase, mColor);
      this.fxParticles.push({
        kind: 'heart',
        x: 118 + Math.random() * 34,
        y: 108,
        vx: (Math.random() - 0.5) * 18,
        vy: -26,
        life: 0.9,
        maxLife: 0.9,
        color: '#FB7185'
      });
      this.fxParticles.push({
        kind: 'star',
        x: 102 + Math.random() * 66,
        y: 116,
        vx: (Math.random() - 0.5) * 24,
        vy: -22,
        life: 0.85,
        maxLife: 0.85,
        color: mColor
      });
      return phrase;
    }

    _spawnHeartBurst(member) {
      const mColor = (member && (member.isDarkColor ? member.lightColor : member.color)) || '#FB7185';
      for (let i = 0; i < 12; i += 1) {
        const angle = (Math.PI * 2 * i) / 12 + (Math.random() - 0.5) * 0.25;
        const speed = 18 + Math.random() * 34;
        this.fxParticles.push({
          kind: i % 3 === 0 ? 'star' : 'heart',
          x: 96 + Math.random() * 78,
          y: 112 + Math.random() * 64,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 18,
          life: 0.7 + Math.random() * 0.35,
          maxLife: 1.05,
          color: i % 2 === 0 ? '#FB7185' : mColor
        });
      }
    }

    _spawnFanserviceBurst(member) {
      const color = (member && (member.isDarkColor ? member.lightColor : member.color)) || '#FACC15';
      const light = (member && member.lightColor) || '#FEF08A';
      const symbolId = (member && member.sticker && member.sticker.id) || 'star';

      for (let i = 0; i < 24; i += 1) {
        const angle = (Math.PI * 2 * i) / 24 + (Math.random() - 0.5) * 0.3;
        const speed = 28 + Math.random() * 64;
        const kind = i % 4 === 0 ? 'symbol' : (i % 2 === 0 ? 'star' : 'dot');
        this.fxParticles.push({
          kind,
          symbolId,
          x: 48 + Math.random() * 174,
          y: 74 + Math.random() * 174,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 16,
          life: 0.8 + Math.random() * 0.5,
          maxLife: 1.3,
          color: i % 3 === 0 ? '#FFFFFF' : (i % 2 === 0 ? color : light)
        });
      }
    }

    setPose(poseObj, member, suppressAlert, options) {
      const opts = options || {};
      const nextPose = poseObj || POSE_LIST[0];

      if (!suppressAlert) {
        const prevTr = getTransform(this.currentPose, this.poseElapsed, this.lastTotalTime, this.poseDir);
        this.prevGhost = {
          pose: this.currentPose,
          spriteSlot: this.activeSpriteSlot || this.currentPose.spriteSlot || 'main',
          transform: prevTr
        };
        this.transitionTimer = this.transitionDuration;
        this.focusFlashTimer = this.transitionDuration;
      } else {
        this.prevGhost = null;
        this.transitionTimer = 0;
        this.focusFlashTimer = 0;
      }

      this.currentPose = nextPose;
      if (Array.isArray(nextPose.spriteSlots) && nextPose.spriteSlots.length > 0) {
        // 凑近对视：优先切到 pose1 (~65%) / 主立绘 (~35%)
        this.activeSpriteSlot = Math.random() < 0.65 ? nextPose.spriteSlots[0] : nextPose.spriteSlots[nextPose.spriteSlots.length - 1];
      } else {
        this.activeSpriteSlot = nextPose.spriteSlot || 'main';
      }
      this.poseElapsed = 0;
      this.poseDir = Math.random() > 0.5 ? 1 : -1;
      this.fxSpawnTimer = 0;
      this.fxParticles = [];

      if (this.currentPose.fixedDuration && this.currentPose.fixedDuration > 0) {
        this.nextSwitchIn = this.currentPose.fixedDuration;
      } else {
        this.nextSwitchIn = 1.9 + Math.random() * 0.7;
      }

      if (this.currentPose.id === 'fanservice') {
        this._spawnFanserviceBurst(member);
      } else if (this.currentPose.id === 'double_heart') {
        this._spawnHeartBurst(member);
      }

      if (!suppressAlert) {
        if (this.currentPose.id === 'fanservice' && opts.isLastTenSeconds) {
          const phrase = LAST_TEN_TEXTS[Math.floor(Math.random() * LAST_TEN_TEXTS.length)];
          this.spawnTextBubble(phrase, '#F59E0B');
        } else if (opts.isLastTenSeconds && Math.random() < 0.65) {
          const phrase = LAST_TEN_TEXTS[Math.floor(Math.random() * LAST_TEN_TEXTS.length)];
          this.spawnTextBubble(phrase, '#F59E0B');
        } else if (this.currentPose.id === 'cheek_tilt') {
          this.spawnBubble('note');
        } else if (this.currentPose.id === 'shy') {
          this.spawnBubble('blush');
        } else if (this.currentPose.id === 'double_heart') {
          this.spawnBubble('heart');
        } else {
          this.spawnBubble();
        }
      }

      if (!suppressAlert && (this.currentPose.rarity === 'SR' || this.currentPose.rarity === 'SSR')) {
        this.alertFlashTimer = 0.95;
        if (this.onRareAlert) {
          this.onRareAlert(this.currentPose.rarity, this.currentPose);
        }
      } else {
        this.alertFlashTimer = 0;
      }
    }

    resetForMember(member) {
      this.cameraZoom = 1.0;
      this.emotionBubble = null;
      this.callReactionTimer = 0;
      this.callRareBoostTimer = 0;
      this.prevGhost = null;
      this.transitionTimer = 0;
      this.focusFlashTimer = 0;
      this.activeSpriteSlot = POSE_LIST[0].spriteSlot || 'main';
      this.setPose(POSE_LIST[0], member, true);
    }

    triggerManualSwitch(member, extraOpts) {
      if (this.manualCooldown > 0) return false;
      this.manualCooldown = this.cooldownDuration;
      const opts = extraOpts || {};
      const nextPose = pickWeightedPose({
        boostRare: true,
        extraRareBoost: this.callRareBoostTimer > 0,
        excludeId: this.currentPose.id,
        isLastTenSeconds: Boolean(opts.isLastTenSeconds),
        uncollectedIds: opts.uncollectedIds || null
      });
      this.setPose(nextPose, member, false, opts);
      return true;
    }

    _spawnAmbientFx(member) {
      const poseId = this.currentPose.id;
      const mColor = (member && (member.isDarkColor ? member.lightColor : member.color)) || '#FACC15';
      const mLight = (member && member.lightColor) || '#FEF08A';

      if (poseId === 'bounce' || poseId === 'cheek_tilt') {
        this.fxParticles.push({
          kind: 'note',
          x: 112 + Math.random() * 46,
          y: 100 + Math.random() * 14,
          vx: (Math.random() - 0.5) * 14,
          vy: -24 - Math.random() * 12,
          life: 0.75,
          maxLife: 0.75,
          color: Math.random() > 0.4 ? mLight : '#FEF08A'
        });
      } else if (poseId === 'closeup') {
        this.fxParticles.push({
          kind: 'star',
          x: 82 + Math.random() * 106,
          y: 92 + Math.random() * 72,
          vx: (Math.random() - 0.5) * 8,
          vy: -14 - Math.random() * 8,
          life: 0.65,
          maxLife: 0.65,
          color: Math.random() > 0.5 ? '#FEF08A' : mLight
        });
      } else if (poseId === 'shy') {
        this.fxParticles.push({
          kind: 'heart',
          x: 116 + Math.random() * 38,
          y: 102 + Math.random() * 16,
          vx: (Math.random() - 0.5) * 12,
          vy: -22 - Math.random() * 10,
          life: 0.85,
          maxLife: 0.85,
          color: '#FB7185'
        });
      } else if (poseId === 'double_heart') {
        this.fxParticles.push({
          kind: Math.random() > 0.35 ? 'heart' : 'star',
          x: 92 + Math.random() * 86,
          y: 102 + Math.random() * 70,
          vx: (Math.random() - 0.5) * 16,
          vy: -22 - Math.random() * 12,
          life: 0.8,
          maxLife: 0.8,
          color: Math.random() > 0.4 ? '#FB7185' : mLight
        });
      } else if (poseId === 'fanservice') {
        const symbolId = (member && member.sticker && member.sticker.id) || 'star';
        this.fxParticles.push({
          kind: Math.random() > 0.45 ? 'symbol' : 'star',
          symbolId,
          x: 50 + Math.random() * 170,
          y: 74 + Math.random() * 172,
          vx: (Math.random() - 0.5) * 44,
          vy: -28 - Math.random() * 24,
          life: 0.7,
          maxLife: 0.7,
          color: Math.random() > 0.5 ? mColor : '#FEF08A'
        });
      }
    }

    update(dt, member, isGroup, isAiming, contextOpts) {
      const ctxOpts = contextOpts || {};
      this.lastTotalTime += dt;

      if (this.manualCooldown > 0) {
        this.manualCooldown = Math.max(0, this.manualCooldown - dt);
      }
      if (this.alertFlashTimer > 0) {
        this.alertFlashTimer = Math.max(0, this.alertFlashTimer - dt);
      }
      if (this.callReactionTimer > 0) {
        this.callReactionTimer = Math.max(0, this.callReactionTimer - dt);
      }
      if (this.callRareBoostTimer > 0) {
        this.callRareBoostTimer = Math.max(0, this.callRareBoostTimer - dt);
      }
      if (this.transitionTimer > 0) {
        this.transitionTimer = Math.max(0, this.transitionTimer - dt);
        if (this.transitionTimer <= 0) {
          this.prevGhost = null;
        }
      }
      if (this.focusFlashTimer > 0) {
        this.focusFlashTimer = Math.max(0, this.focusFlashTimer - dt);
      }
      if (this.emotionBubble) {
        this.emotionBubble.life -= dt;
        if (this.emotionBubble.life <= 0) {
          this.emotionBubble = null;
        }
      }

      // 发丝/头饰微闪
      if (this.glintActiveTimer > 0) {
        this.glintActiveTimer = Math.max(0, this.glintActiveTimer - dt);
      } else {
        this.nextGlintIn -= dt;
        if (this.nextGlintIn <= 0) {
          this.glintActiveTimer = this.glintDuration;
          this.glintOffset = {
            rx: -0.10 + Math.random() * 0.22,
            ry: -0.90 + Math.random() * 0.14
          };
          this.nextGlintIn = 3.0 + Math.random() * 2.0;
        }
      }

      if (isGroup) {
        if (this.currentPose.id !== 'normal') {
          this.currentPose = POSE_LIST[0];
          this.fxParticles = [];
        }
        this.emotionBubble = null;
        this.callReactionTimer = 0;
        this.callRareBoostTimer = 0;
        this.prevGhost = null;
        this.transitionTimer = 0;
        this.focusFlashTimer = 0;
        this.cameraZoom += (1.0 - this.cameraZoom) * Math.min(1, dt * 8);
        return;
      }

      if (isAiming) {
        this.poseElapsed += dt;
        if (this.poseElapsed >= this.nextSwitchIn) {
          const nextPose = pickWeightedPose({
            boostRare: this.callRareBoostTimer > 0,
            extraRareBoost: this.callRareBoostTimer > 0,
            excludeId: this.currentPose.id,
            isLastTenSeconds: Boolean(ctxOpts.isLastTenSeconds),
            uncollectedIds: ctxOpts.uncollectedIds || null
          });
          this.setPose(nextPose, member, false, ctxOpts);
        }
      }

      const targetZoom = this.currentPose.targetZoom || 1.0;
      this.cameraZoom += (targetZoom - this.cameraZoom) * Math.min(1, dt * 7.5);

      const spawnInterval =
        this.currentPose.id === 'fanservice'
          ? 0.12
          : this.currentPose.id === 'double_heart'
            ? 0.24
            : (this.currentPose.id === 'bounce' || this.currentPose.id === 'cheek_tilt' || this.currentPose.id === 'shy')
              ? 0.28
              : this.currentPose.id === 'closeup'
                ? 0.32
                : 99;

      this.fxSpawnTimer += dt;
      if (this.fxSpawnTimer >= spawnInterval && this.fxParticles.length < 36) {
        this.fxSpawnTimer = 0;
        this._spawnAmbientFx(member);
      }

      for (let i = this.fxParticles.length - 1; i >= 0; i -= 1) {
        const p = this.fxParticles[i];
        p.life -= dt;
        if (p.life <= 0) {
          this.fxParticles.splice(i, 1);
          continue;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.kind === 'dot' || p.kind === 'symbol') {
          p.vy += 28 * dt;
        }
      }
    }

    getCooldownProgress() {
      if (this.manualCooldown <= 0) return 0;
      return Math.min(1, this.manualCooldown / this.cooldownDuration);
    }

    snapshot(totalTime) {
      const tr = getTransform(this.currentPose, this.poseElapsed, totalTime, this.poseDir);

      // 180ms 相机对焦蓄力压扁 -> 弹性回落
      let afterimageAlpha = 0;
      if (this.transitionTimer > 0) {
        const elapsedTrans = this.transitionDuration - this.transitionTimer;
        if (elapsedTrans < 0.06) {
          const squashP = Math.sin((elapsedTrans / 0.06) * Math.PI);
          tr.scaleX *= (1 + 0.06 * squashP);
          tr.scaleY *= (1 - 0.07 * squashP);
        } else {
          const settleP = (elapsedTrans - 0.06) / 0.12;
          const overshoot = Math.sin(settleP * Math.PI) * (1 - settleP) * 0.05;
          tr.scaleY *= (1 + overshoot);
          tr.scaleX *= (1 - overshoot * 0.45);
        }
        if (this.prevGhost && elapsedTrans >= 0.05) {
          afterimageAlpha = Math.max(0, ((this.transitionDuration - elapsedTrans) / 0.13) * 0.42);
        }
      }

      if (this.callReactionTimer > 0) {
        const callElapsed = this.callReactionDuration - this.callReactionTimer;
        const callHop = -Math.round(Math.abs(Math.sin(callElapsed * 10)) * 10);
        tr.jumpY = Math.min(tr.jumpY, callHop);
        tr.shadowScale = Math.min(tr.shadowScale, Math.max(0.55, 1 - Math.abs(tr.jumpY) / 28));
        tr.showBlush = true;
      }

      return {
        pose: this.currentPose,
        spriteSlot: this.activeSpriteSlot || this.currentPose.spriteSlot || 'main',
        faceLockActive: Boolean(this.currentPose && this.currentPose.faceLock),
        poseElapsed: this.poseElapsed,
        cameraZoom: this.cameraZoom,
        transform: tr,
        prevGhost: afterimageAlpha > 0.01 ? this.prevGhost : null,
        afterimageAlpha,
        focusFlashRatio: this.focusFlashTimer > 0 ? this.focusFlashTimer / this.transitionDuration : 0,
        glint: this.glintActiveTimer > 0
          ? {
              active: true,
              progress: 1 - this.glintActiveTimer / this.glintDuration,
              rx: this.glintOffset.rx,
              ry: this.glintOffset.ry
            }
          : null,
        emotionBubble: this.emotionBubble ? Object.assign({}, this.emotionBubble) : null,
        callBoostActive: this.callRareBoostTimer > 0,
        fxParticles: this.fxParticles.map((p) => Object.assign({}, p))
      };
    }
  }

  ChekiGame.Poses = {
    POSE_LIST,
    RARITY_STYLES,
    PRAISE_TEXTS,
    LAST_TEN_TEXTS,
    getPoseById,
    pickWeightedPose,
    getTransform,
    PoseController
  };
})(window);
