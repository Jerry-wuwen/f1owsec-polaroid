(function (global) {
  'use strict';

  const ChekiGame = global.ChekiGame || (global.ChekiGame = {});
  const CONFIG = ChekiGame.CONFIG || {};

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
      this._listeners = [];
      this._preloaded = false;
    }

    _statusKey(memberId, hairKey, slot) {
      return `${memberId}|${hairKey || 'default'}|${slot}`;
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
      const ver = CONFIG.ASSET_VERSION || '20261123';
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

    _commitSlot(memberId, hairKey, slot, keyed, processed) {
      if (hairKey) {
        this._setVariantSlot(memberId, hairKey, slot, keyed, processed);
      } else {
        this._setSlot(memberId, slot, keyed, processed);
      }
    }

    _loadSlot(memberId, hairKey, url, slot, retryCount) {
      const statusKey = this._statusKey(memberId, hairKey, slot);
      const attempt = retryCount || 0;
      const curStatus = this._slotStatus[statusKey];

      if (curStatus === 'loaded') return;
      if (attempt === 0 && (curStatus === 'loading' || curStatus === 'failed')) {
        return;
      }

      if (!url || typeof global.Image !== 'function') {
        this._slotStatus[statusKey] = 'failed';
        this._commitSlot(memberId, hairKey, slot, null, null);
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
        if (this._slotStatus[statusKey] === 'loaded') return;

        if (attempt < 1) {
          this._loadSlot(memberId, hairKey, url, slot, attempt + 1);
          return;
        }
        this._slotStatus[statusKey] = 'failed';
        this._commitSlot(memberId, hairKey, slot, null, null);
        this._notify(memberId);
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
        if (this._slotStatus[statusKey] === 'loaded') return;

        const filter = ChekiGame.PixelFilter;
        const keyed = (filter && typeof filter.removeGreenScreen === 'function')
          ? filter.removeGreenScreen(img)
          : img;
        const processed = this._applyFilter(keyed);

        this._slotStatus[statusKey] = 'loaded';
        this._commitSlot(memberId, hairKey, slot, keyed, processed);
        this._notify(memberId);
      };

      img.onerror = failSlot;
      img.src = this._normalizeUrl(url, attempt);
    }

    _loadImageSlot(memberId, url, slot) {
      this._loadSlot(memberId, null, url, slot, 0);
    }

    _setVariantSlot(memberId, hairKey, slot, keyed, processed) {
      if (!this._variantClean[memberId]) this._variantClean[memberId] = {};
      if (!this._variantProcessed[memberId]) this._variantProcessed[memberId] = {};
      if (!this._variantClean[memberId][hairKey]) this._variantClean[memberId][hairKey] = {};
      if (!this._variantProcessed[memberId][hairKey]) this._variantProcessed[memberId][hairKey] = {};
      this._variantClean[memberId][hairKey][slot] = keyed;
      this._variantProcessed[memberId][hairKey][slot] = processed;
    }

    _loadVariantImageSlot(memberId, hairKey, url, slot) {
      this._loadSlot(memberId, hairKey, url, slot, 0);
    }

    preloadAll() {
      if (this._preloaded) return;
      this._preloaded = true;

      const members = Array.isArray(CONFIG.MEMBERS) ? CONFIG.MEMBERS : [];
      // 1. 优先请求全部成员主立绘，避免移动端并发队列阻塞首屏显影
      members.forEach((member) => {
        if (!member || !member.id) return;
        this._loadImageSlot(member.id, member.spriteUrl, 'main');
      });

      // 2. 随后按动作槽位依次预加载 pose ~ pose4
      const poseSlotKeys = [
        ['pose', 'poseSpriteUrl'],
        ['pose2', 'pose2SpriteUrl'],
        ['pose3', 'pose3SpriteUrl'],
        ['pose4', 'pose4SpriteUrl']
      ];
      poseSlotKeys.forEach(([slot, prop]) => {
        members.forEach((member) => {
          if (!member || !member.id) return;
          this._loadImageSlot(member.id, member[prop], slot);
        });
      });

      // 3. 最后预加载额外发型变体
      const variantSlotKeys = [
        ['main', 'spriteUrl'],
        ['pose', 'poseSpriteUrl'],
        ['pose2', 'pose2SpriteUrl'],
        ['pose3', 'pose3SpriteUrl'],
        ['pose4', 'pose4SpriteUrl']
      ];
      members.forEach((member) => {
        if (!member || !member.id || !member.hairVariants || typeof member.hairVariants !== 'object') {
          return;
        }
        Object.keys(member.hairVariants).forEach((hairKey) => {
          if (hairKey === 'long') return;
          const hv = member.hairVariants[hairKey];
          if (!hv) return;
          variantSlotKeys.forEach(([slot, prop]) => {
            this._loadVariantImageSlot(member.id, hairKey, hv[prop], slot);
          });
        });
      });
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
            ['main', 'pose', 'pose2', 'pose3', 'pose4'].forEach((s) => {
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
      const fallbackSlots = ['main', 'pose', 'pose2', 'pose3', 'pose4'];

      if (hairStyle && hairStyle !== 'long' && this._variantProcessed[memberId]) {
        const hv = this._variantProcessed[memberId][hairStyle];
        if (hv) {
          if (hv[slot]) return hv[slot];
          for (let i = 0; i < fallbackSlots.length; i += 1) {
            const fbSlot = fallbackSlots[i];
            if (hv[fbSlot]) return hv[fbSlot];
          }
        }
      }

      const direct = this._getDefaultProcessedSlot(memberId, slot);
      if (direct) return direct;

      for (let i = 0; i < fallbackSlots.length; i += 1) {
        const fb = this._getDefaultProcessedSlot(memberId, fallbackSlots[i]);
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
