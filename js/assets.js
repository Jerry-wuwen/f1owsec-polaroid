(function (global) {
  'use strict';

  const ChekiGame = global.ChekiGame || (global.ChekiGame = {});
  const CONFIG = ChekiGame.CONFIG || {};

  const FALLBACK_SLOTS = ['main', 'pose', 'pose2', 'pose3', 'pose4'];
  const SLOT_CONFIG_PROPS = [
    ['main', 'spriteUrl'],
    ['pose', 'poseSpriteUrl'],
    ['pose2', 'pose2SpriteUrl'],
    ['pose3', 'pose3SpriteUrl'],
    ['pose4', 'pose4SpriteUrl']
  ];

  class AssetsManager {
    constructor() {
      this._cleanMain = {};
      this._cleanPose = {};
      this._cleanPose2 = {};
      this._cleanPose3 = {};
      this._cleanPose4 = {};
      this._processedMain = {};
      this._processedPose = {};
      this._processedPose2 = {};
      this._processedPose3 = {};
      this._processedPose4 = {};
      this._variantClean = {};
      this._variantProcessed = {};
      this._slotStatus = {};
      this._queue = [];
      this._activeCount = 0;
      this._maxConcurrent = 4;
      this._maxRetries = 2;
      this._seqCounter = 0;
      this._criticalWaiters = [];
      this._listeners = [];
      this._preloaded = false;
    }

    _statusKey(memberId, hairKey, slot) {
      return `${memberId}|${hairKey || 'default'}|${slot}`;
    }

    _resolveHairKey(memberId, hairStyle) {
      if (!hairStyle || hairStyle === 'long') return null;
      const members = Array.isArray(CONFIG.MEMBERS) ? CONFIG.MEMBERS : [];
      const member = members.find((m) => m && m.id === memberId);
      if (member && member.hairVariants && member.hairVariants[hairStyle]) {
        return hairStyle;
      }
      if (this._variantProcessed[memberId] && this._variantProcessed[memberId][hairStyle]) {
        return hairStyle;
      }
      return null;
    }

    _normalizeUrl(url, retryIndex) {
      if (!url || typeof url !== 'string') return '';
      let clean = url.trim();
      if (!clean) return '';
      if (/^(data:|blob:|https?:)/i.test(clean)) {
        return clean;
      }
      clean = clean.replace(/^\/+/, './');
      if (!clean.startsWith('./') && !clean.startsWith('../')) {
        clean = `./${clean}`;
      }
      const ver = CONFIG.ASSET_VERSION || '20261123f';
      if (!/[?&]v=/.test(clean)) {
        clean += `${clean.includes('?') ? '&' : '?'}v=${encodeURIComponent(ver)}`;
      }
      if (retryIndex > 0) {
        clean += `${clean.includes('?') ? '&' : '?'}r=${retryIndex}`;
      }
      return clean;
    }

    onChange(callback) {
      if (typeof callback === 'function') {
        this._listeners.push(callback);
      }
    }

    _notify(memberId) {
      this._listeners.forEach((cb) => {
        try {
          cb(memberId || null);
        } catch (_err) {
          // Keep listener notifications isolated
        }
      });
    }

    _applyFilter(cleanSprite) {
      if (!cleanSprite) return null;
      const filter = ChekiGame.PixelFilter;
      if (filter && typeof filter.processSprite === 'function') {
        return filter.processSprite(cleanSprite) || cleanSprite;
      }
      return cleanSprite;
    }

    _setSlot(memberId, slot, keyed, processed) {
      if (slot === 'pose4') {
        this._cleanPose4[memberId] = keyed;
        this._processedPose4[memberId] = processed;
      } else if (slot === 'pose3') {
        this._cleanPose3[memberId] = keyed;
        this._processedPose3[memberId] = processed;
      } else if (slot === 'pose2') {
        this._cleanPose2[memberId] = keyed;
        this._processedPose2[memberId] = processed;
      } else if (slot === 'pose') {
        this._cleanPose[memberId] = keyed;
        this._processedPose[memberId] = processed;
      } else {
        this._cleanMain[memberId] = keyed;
        this._processedMain[memberId] = processed;
      }
    }

    _setVariantSlot(memberId, hairKey, slot, keyed, processed) {
      if (!this._variantClean[memberId]) this._variantClean[memberId] = {};
      if (!this._variantProcessed[memberId]) this._variantProcessed[memberId] = {};
      if (!this._variantClean[memberId][hairKey]) this._variantClean[memberId][hairKey] = {};
      if (!this._variantProcessed[memberId][hairKey]) this._variantProcessed[memberId][hairKey] = {};
      this._variantClean[memberId][hairKey][slot] = keyed;
      this._variantProcessed[memberId][hairKey][slot] = processed;
    }

    _commitSlot(memberId, hairKey, slot, keyed, processed) {
      if (hairKey) {
        this._setVariantSlot(memberId, hairKey, slot, keyed, processed);
      } else {
        this._setSlot(memberId, slot, keyed, processed);
      }
    }

    _getCriticalKeys() {
      const members = Array.isArray(CONFIG.MEMBERS) ? CONFIG.MEMBERS : [];
      const first = members.find((m) => m && m.id === 'member_1') || members[0];
      if (!first || !first.id) return [];

      const keys = [];
      if (first.spriteUrl) {
        keys.push(this._statusKey(first.id, null, 'main'));
      }
      if (first.hairVariants && typeof first.hairVariants === 'object') {
        Object.keys(first.hairVariants).forEach((hairKey) => {
          if (hairKey === 'long') return;
          const hv = first.hairVariants[hairKey];
          if (hv && hv.spriteUrl) {
            keys.push(this._statusKey(first.id, hairKey, 'main'));
          }
        });
      }
      return keys;
    }

    isCriticalReady() {
      const keys = this._getCriticalKeys();
      if (keys.length === 0) return true;
      return keys.every((k) => {
        const st = this._slotStatus[k];
        return st === 'loaded' || st === 'failed';
      });
    }

    _checkCriticalWaiters() {
      if (this._criticalWaiters.length === 0) return;
      if (!this.isCriticalReady()) return;
      const waiters = this._criticalWaiters.splice(0, this._criticalWaiters.length);
      waiters.forEach((finish) => {
        try {
          finish(true);
        } catch (_err) {
          // Isolate resolver callbacks
        }
      });
    }

    preloadCritical(timeoutMs) {
      this.preloadAll();
      if (this.isCriticalReady()) {
        return Promise.resolve(true);
      }
      const limit = typeof timeoutMs === 'number' && timeoutMs > 0 ? timeoutMs : 3500;
      return new Promise((resolve) => {
        let done = false;
        let timerId = null;
        const finish = (ready) => {
          if (done) return;
          done = true;
          if (timerId !== null && typeof global.clearTimeout === 'function') {
            global.clearTimeout(timerId);
          }
          resolve(Boolean(ready));
        };
        this._criticalWaiters.push(finish);
        if (typeof global.setTimeout === 'function') {
          timerId = global.setTimeout(() => {
            const idx = this._criticalWaiters.indexOf(finish);
            if (idx >= 0) this._criticalWaiters.splice(idx, 1);
            finish(this.isCriticalReady());
          }, limit);
        }
      });
    }

    _sortQueue() {
      this._queue.sort((a, b) => (a.priority - b.priority) || (a.seq - b.seq));
    }

    _enqueueSlot(memberId, hairKey, url, slot, priority) {
      const statusKey = this._statusKey(memberId, hairKey, slot);
      const curStatus = this._slotStatus[statusKey];

      if (curStatus === 'loaded' || curStatus === 'failed' || curStatus === 'loading' || curStatus === 'queued') {
        return;
      }

      if (!url || typeof global.Image !== 'function') {
        this._slotStatus[statusKey] = 'failed';
        this._commitSlot(memberId, hairKey, slot, null, null);
        this._checkCriticalWaiters();
        return;
      }

      this._slotStatus[statusKey] = 'queued';
      this._queue.push({
        statusKey,
        memberId,
        hairKey,
        url,
        slot,
        priority: priority != null ? priority : 4,
        seq: this._seqCounter++,
        attempt: 0
      });
      this._sortQueue();
    }

    _pumpQueue() {
      while (this._activeCount < this._maxConcurrent && this._queue.length > 0) {
        const task = this._queue.shift();
        if (!task) break;
        const curStatus = this._slotStatus[task.statusKey];
        if (curStatus === 'loaded' || curStatus === 'failed') {
          continue;
        }
        this._activeCount += 1;
        this._runTask(task);
      }
    }

    _runTask(task) {
      const { statusKey, memberId, hairKey, url, slot, attempt } = task;

      if (typeof global.Image !== 'function') {
        this._activeCount = Math.max(0, this._activeCount - 1);
        this._slotStatus[statusKey] = 'failed';
        this._commitSlot(memberId, hairKey, slot, null, null);
        this._checkCriticalWaiters();
        this._pumpQueue();
        return;
      }

      this._slotStatus[statusKey] = 'loading';
      const img = new global.Image();
      let settled = false;

      const failSlot = () => {
        if (settled) return;
        settled = true;
        img.onload = null;
        img.onerror = null;
        this._activeCount = Math.max(0, this._activeCount - 1);

        if (this._slotStatus[statusKey] === 'loaded') {
          this._checkCriticalWaiters();
          this._pumpQueue();
          return;
        }

        if (attempt < this._maxRetries) {
          const nextAttempt = attempt + 1;
          const requeue = () => {
            if (this._slotStatus[statusKey] === 'loaded') return;
            this._slotStatus[statusKey] = 'queued';
            this._queue.push({
              statusKey,
              memberId,
              hairKey,
              url,
              slot,
              priority: Math.min(task.priority, 0.5),
              seq: this._seqCounter++,
              attempt: nextAttempt
            });
            this._sortQueue();
            this._pumpQueue();
          };
          if (typeof global.setTimeout === 'function') {
            global.setTimeout(requeue, 250 * nextAttempt);
          } else {
            requeue();
          }
          this._pumpQueue();
          return;
        }

        this._slotStatus[statusKey] = 'failed';
        this._commitSlot(memberId, hairKey, slot, null, null);
        this._notify(memberId);
        this._checkCriticalWaiters();
        this._pumpQueue();
      };

      img.onload = () => {
        if (settled) return;
        if (typeof img.naturalWidth === 'number' && (img.naturalWidth <= 0 || img.naturalHeight <= 0)) {
          failSlot();
          return;
        }
        settled = true;
        img.onload = null;
        img.onerror = null;
        this._activeCount = Math.max(0, this._activeCount - 1);

        if (this._slotStatus[statusKey] !== 'loaded') {
          const filter = ChekiGame.PixelFilter;
          const keyed = (filter && typeof filter.removeGreenScreen === 'function')
            ? filter.removeGreenScreen(img)
            : img;
          const processed = this._applyFilter(keyed);

          this._slotStatus[statusKey] = 'loaded';
          this._commitSlot(memberId, hairKey, slot, keyed, processed);
          this._notify(memberId);
          this._checkCriticalWaiters();
        }
        this._pumpQueue();
      };

      img.onerror = failSlot;
      img.src = this._normalizeUrl(url, attempt);
    }

    _loadImageSlot(memberId, url, slot, priority) {
      this._enqueueSlot(memberId, null, url, slot, priority);
      this._pumpQueue();
    }

    _loadVariantImageSlot(memberId, hairKey, url, slot, priority) {
      this._enqueueSlot(memberId, hairKey, url, slot, priority);
      this._pumpQueue();
    }

    prioritizeSlot(memberId, variant, hairStyle, targetPriority) {
      if (!memberId) return;
      const slot = this._normalizeVariant(variant);
      const hairKey = this._resolveHairKey(memberId, hairStyle);
      const key = this._statusKey(memberId, hairKey, slot);
      const pVal = typeof targetPriority === 'number' ? targetPriority : 0.5;

      let changed = false;
      this._queue.forEach((task) => {
        if (task.statusKey === key && task.priority > pVal) {
          task.priority = pVal;
          changed = true;
        }
      });
      if (changed) {
        this._sortQueue();
      }
      this._pumpQueue();
    }

    prioritizeMember(memberId, hairStyle) {
      if (!memberId) return;
      const hairKey = this._resolveHairKey(memberId, hairStyle);
      FALLBACK_SLOTS.forEach((slot) => {
        const p = slot === 'main' ? 0.5 : 0.7;
        if (hairKey) {
          this.prioritizeSlot(memberId, slot, hairKey, p);
        }
        this.prioritizeSlot(memberId, slot, null, hairKey ? p + 0.2 : p);
      });
    }

    isSlotLoaded(memberId, variant, hairStyle) {
      if (!memberId) return false;
      const slot = this._normalizeVariant(variant);
      const hairKey = this._resolveHairKey(memberId, hairStyle);
      return this._slotStatus[this._statusKey(memberId, hairKey, slot)] === 'loaded';
    }

    isSlotPending(memberId, variant, hairStyle) {
      if (!memberId) return false;
      const slot = this._normalizeVariant(variant);
      const hairKey = this._resolveHairKey(memberId, hairStyle);
      const st = this._slotStatus[this._statusKey(memberId, hairKey, slot)];
      return st === 'queued' || st === 'loading';
    }

    preloadAll() {
      if (this._preloaded) return;
      this._preloaded = true;

      const members = Array.isArray(CONFIG.MEMBERS) ? CONFIG.MEMBERS : [];
      const firstMember = members.find((m) => m && m.id === 'member_1') || members[0];
      const otherMembers = members.filter((m) => m && m.id && (!firstMember || m.id !== firstMember.id));

      // P0: 首批关键立绘 —— 「蓝」默认立绘 + 短发主立绘
      if (firstMember && firstMember.id) {
        this._enqueueSlot(firstMember.id, null, firstMember.spriteUrl, 'main', 0);
        if (firstMember.hairVariants && typeof firstMember.hairVariants === 'object') {
          Object.keys(firstMember.hairVariants).forEach((hairKey) => {
            if (hairKey === 'long') return;
            const hv = firstMember.hairVariants[hairKey];
            if (hv) {
              this._enqueueSlot(firstMember.id, hairKey, hv.spriteUrl, 'main', 0);
            }
          });
        }
      }

      // P1 (优先级 1.2): 「蓝」默认与短发全部动作立绘 (pose ~ pose4)，先于其他 4 位成员加载以保证进舞台立即可切动作
      if (firstMember && firstMember.id) {
        SLOT_CONFIG_PROPS.slice(1).forEach(([slot, prop]) => {
          this._enqueueSlot(firstMember.id, null, firstMember[prop], slot, 1.2);
        });
        if (firstMember.hairVariants && typeof firstMember.hairVariants === 'object') {
          Object.keys(firstMember.hairVariants).forEach((hairKey) => {
            if (hairKey === 'long') return;
            const hv = firstMember.hairVariants[hairKey];
            if (!hv) return;
            SLOT_CONFIG_PROPS.slice(1).forEach(([slot, prop]) => {
              this._enqueueSlot(firstMember.id, hairKey, hv[prop], slot, 1.2);
            });
          });
        }
      }

      // P2 (优先级 2): 其余 4 位成员主立绘
      otherMembers.forEach((member) => {
        this._enqueueSlot(member.id, null, member.spriteUrl, 'main', 2);
      });

      // P3 (优先级 3): 其余 4 位成员动作立绘及额外发型变体
      SLOT_CONFIG_PROPS.slice(1).forEach(([slot, prop]) => {
        otherMembers.forEach((member) => {
          this._enqueueSlot(member.id, null, member[prop], slot, 3);
        });
      });

      otherMembers.forEach((member) => {
        if (!member.hairVariants || typeof member.hairVariants !== 'object') return;
        Object.keys(member.hairVariants).forEach((hairKey) => {
          if (hairKey === 'long') return;
          const hv = member.hairVariants[hairKey];
          if (!hv) return;
          SLOT_CONFIG_PROPS.forEach(([slot, prop], idx) => {
            this._enqueueSlot(member.id, hairKey, hv[prop], slot, idx === 0 ? 2 : 3);
          });
        });
      });

      this._pumpQueue();
    }

    reprocessAll() {
      const members = Array.isArray(CONFIG.MEMBERS) ? CONFIG.MEMBERS : [];
      members.forEach((member) => {
        if (!member || !member.id) return;
        this._processedMain[member.id] = this._cleanMain[member.id]
          ? this._applyFilter(this._cleanMain[member.id])
          : null;
        this._processedPose[member.id] = this._cleanPose[member.id]
          ? this._applyFilter(this._cleanPose[member.id])
          : null;
        this._processedPose2[member.id] = this._cleanPose2[member.id]
          ? this._applyFilter(this._cleanPose2[member.id])
          : null;
        this._processedPose3[member.id] = this._cleanPose3[member.id]
          ? this._applyFilter(this._cleanPose3[member.id])
          : null;
        this._processedPose4[member.id] = this._cleanPose4[member.id]
          ? this._applyFilter(this._cleanPose4[member.id])
          : null;

        const cleanVars = this._variantClean[member.id];
        if (cleanVars && typeof cleanVars === 'object') {
          Object.keys(cleanVars).forEach((hairKey) => {
            const slots = cleanVars[hairKey];
            if (!slots) return;
            FALLBACK_SLOTS.forEach((s) => {
              this._setVariantSlot(
                member.id,
                hairKey,
                s,
                slots[s] || null,
                slots[s] ? this._applyFilter(slots[s]) : null
              );
            });
          });
        }
      });
      this._notify(null);
    }

    _normalizeVariant(variant) {
      if (variant === 'pose4' || variant === 4) return 'pose4';
      if (variant === 'pose3' || variant === 3) return 'pose3';
      if (variant === 'pose2' || variant === 2) return 'pose2';
      if (variant === 'pose' || variant === 'pose1' || variant === 1 || variant === true) return 'pose';
      return 'main';
    }

    _getDefaultProcessedSlot(memberId, slot) {
      if (slot === 'pose4') return this._processedPose4[memberId] || null;
      if (slot === 'pose3') return this._processedPose3[memberId] || null;
      if (slot === 'pose2') return this._processedPose2[memberId] || null;
      if (slot === 'pose') return this._processedPose[memberId] || null;
      return this._processedMain[memberId] || null;
    }

    getSprite(memberId, variant, hairStyle) {
      const slot = this._normalizeVariant(variant);

      if (hairStyle && hairStyle !== 'long' && this._variantProcessed[memberId]) {
        const hv = this._variantProcessed[memberId][hairStyle];
        if (hv) {
          if (hv[slot]) return hv[slot];
          for (let i = 0; i < FALLBACK_SLOTS.length; i += 1) {
            const fbSlot = FALLBACK_SLOTS[i];
            if (hv[fbSlot]) return hv[fbSlot];
          }
        }
      }

      const direct = this._getDefaultProcessedSlot(memberId, slot);
      if (direct) return direct;

      for (let i = 0; i < FALLBACK_SLOTS.length; i += 1) {
        const fb = this._getDefaultProcessedSlot(memberId, FALLBACK_SLOTS[i]);
        if (fb) return fb;
      }

      return null;
    }

    getSpriteMap(variant, hairStyleMap) {
      const members = Array.isArray(CONFIG.MEMBERS) ? CONFIG.MEMBERS : [];
      const map = {};
      members.forEach((m) => {
        const hs = hairStyleMap && typeof hairStyleMap === 'object' ? hairStyleMap[m.id] : hairStyleMap;
        map[m.id] = this.getSprite(m.id, variant, hs);
      });
      return map;
    }

    getLoadedCount() {
      return Object.keys(this._processedMain).filter((k) => Boolean(this._processedMain[k])).length;
    }
  }

  ChekiGame.AssetsManager = new AssetsManager();
})(window);
