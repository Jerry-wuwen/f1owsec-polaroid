(function (global) {
  'use strict';

  const ChekiGame = global.ChekiGame || (global.ChekiGame = {});
  const CONFIG = ChekiGame.CONFIG;

  function getPoseStorageKey() {
    return (CONFIG.POSE_COLLECTION && CONFIG.POSE_COLLECTION.storageKey) || 'f1owsec_pose_dex_v1';
  }

  function getMetaStorageKey() {
    return (CONFIG.ALBUM && CONFIG.ALBUM.metaStorageKey) || 'f1owsec_cheki_meta_v3';
  }

  function getLegacyAlbumKey() {
    return (CONFIG.ALBUM && CONFIG.ALBUM.storageKey) || 'f1owsec_cheki_album_v2';
  }

  function getPoseCount() {
    return (ChekiGame.Poses && Array.isArray(ChekiGame.Poses.POSE_LIST))
      ? ChekiGame.Poses.POSE_LIST.length
      : 7;
  }

  function getValidPoseIds() {
    if (ChekiGame.Poses && Array.isArray(ChekiGame.Poses.POSE_LIST)) {
      return new Set(ChekiGame.Poses.POSE_LIST.map((p) => p.id));
    }
    return null;
  }

  class LocalAlbumManager {
    constructor() {
      this._metaItems = [];
      this._imageCache = {};
      this._poseDexMemory = {};
      this._allCompletedCelebratedMem = false;
      this._listeners = [];
      this._db = null;
      this._dbReadyPromise = null;

      this._loadMetaAndLegacy();
      this._poseDex = this._loadPoseDex();
      this._initDb();
    }

    onChange(cb) {
      if (typeof cb === 'function') {
        this._listeners.push(cb);
      }
    }

    _notify() {
      this._listeners.forEach((cb) => {
        try {
          cb();
        } catch (_err) {
          // Keep album listeners isolated
        }
      });
    }

    _hasStorage() {
      try {
        return typeof global.localStorage !== 'undefined' && global.localStorage !== null;
      } catch (_err) {
        return false;
      }
    }

    _stripDataUrl(item) {
      if (!item || typeof item !== 'object') return null;
      return {
        id: item.id,
        memberId: item.memberId,
        memberName: item.memberName,
        memberColor: item.memberColor,
        judgmentKey: item.judgmentKey,
        stars: item.stars,
        dateStr: item.dateStr,
        isGroup: Boolean(item.isGroup),
        poseId: item.poseId || null,
        poseName: item.poseName || null,
        poseRarity: item.poseRarity || null,
        isNewPose: Boolean(item.isNewPose),
        isHolo: Boolean(item.isHolo),
        width: item.width || 0,
        height: item.height || 0,
        createdAt: item.createdAt || Date.now()
      };
    }

    _loadMetaAndLegacy() {
      if (!this._hasStorage()) return;
      try {
        const metaRaw = global.localStorage.getItem(getMetaStorageKey());
        if (metaRaw) {
          const parsed = JSON.parse(metaRaw);
          if (parsed && Array.isArray(parsed.items)) {
            this._metaItems = parsed.items;
          }
        }
      } catch (_err) {
        this._metaItems = [];
      }

      // 将旧版 localStorage v2 中的图片自动迁移到内存，待 IndexedDB 就绪后转存并清理
      try {
        const legacyRaw = global.localStorage.getItem(getLegacyAlbumKey());
        if (legacyRaw) {
          const legacyParsed = JSON.parse(legacyRaw);
          if (legacyParsed && Array.isArray(legacyParsed.items) && legacyParsed.items.length > 0) {
            const existingIds = new Set(this._metaItems.map((it) => it.id));
            const migrated = [];
            legacyParsed.items.forEach((item) => {
              if (!item || !item.id) return;
              if (item.dataUrl) {
                this._imageCache[item.id] = item.dataUrl;
              }
              if (!existingIds.has(item.id)) {
                const clean = this._stripDataUrl(item);
                if (clean) migrated.push(clean);
              }
            });
            if (migrated.length > 0) {
              this._metaItems = [...this._metaItems, ...migrated];
              this._persistMeta(this._metaItems);
            }
          }
          this._legacyNeedsCleanup = true;
        }
      } catch (_err) {
        // Ignore legacy parse failures
      }
    }

    _persistMeta(metaItems) {
      if (!this._hasStorage()) return { ok: true };
      try {
        global.localStorage.setItem(
          getMetaStorageKey(),
          JSON.stringify({ items: metaItems })
        );
        return { ok: true };
      } catch (_err) {
        return {
          ok: false,
          reason: 'STORAGE_FULL',
          message: '本地相册已满，请先长按保存到手机'
        };
      }
    }

    _initDb() {
      if (this._dbReadyPromise) return this._dbReadyPromise;
      const idb = global.indexedDB;
      if (!idb || typeof idb.open !== 'function') {
        this._dbReadyPromise = Promise.resolve(null);
        return this._dbReadyPromise;
      }

      const dbName = (CONFIG.ALBUM && CONFIG.ALBUM.dbName) || 'f1owsec_cheki_db_v1';
      const storeName = (CONFIG.ALBUM && CONFIG.ALBUM.storeName) || 'photos';

      this._dbReadyPromise = new Promise((resolve) => {
        try {
          const req = idb.open(dbName, 1);
          req.onupgradeneeded = (e) => {
            try {
              const db = e.target.result;
              if (!db.objectStoreNames.contains(storeName)) {
                db.createObjectStore(storeName, { keyPath: 'id' });
              }
            } catch (_err) {
              // Ignore upgrade errors
            }
          };
          req.onsuccess = (e) => {
            this._db = e.target.result;
            this._hydrateFromDbAndMigrate().then(() => {
              resolve(this._db);
            });
          };
          req.onerror = () => {
            resolve(null);
          };
        } catch (_err) {
          resolve(null);
        }
      });

      return this._dbReadyPromise;
    }

    async _hydrateFromDbAndMigrate() {
      if (!this._db) return;
      const storeName = (CONFIG.ALBUM && CONFIG.ALBUM.storeName) || 'photos';

      // 先把旧版待迁移的图片写入 IndexedDB
      const pendingKeys = Object.keys(this._imageCache);
      for (let i = 0; i < pendingKeys.length; i += 1) {
        const id = pendingKeys[i];
        try {
          await this._putImageToDb(id, this._imageCache[id]);
        } catch (_err) {
          // Ignore single migration error
        }
      }
      if (this._legacyNeedsCleanup && this._hasStorage()) {
        try {
          global.localStorage.removeItem(getLegacyAlbumKey());
        } catch (_err) {
          // Ignore cleanup errors
        }
        this._legacyNeedsCleanup = false;
      }

      // 从 IndexedDB 读取全部已保存图片到内存缓存
      try {
        await new Promise((resolve) => {
          const tx = this._db.transaction(storeName, 'readonly');
          const store = tx.objectStore(storeName);
          const req = store.getAll();
          req.onsuccess = () => {
            const rows = req.result || [];
            rows.forEach((row) => {
              if (row && row.id && row.dataUrl) {
                this._imageCache[row.id] = row.dataUrl;
              }
            });
            resolve();
          };
          req.onerror = () => resolve();
        });
      } catch (_err) {
        // Ignore read error
      }
      this._notify();
    }

    _putImageToDb(id, dataUrl) {
      if (!this._db) return Promise.resolve(true);
      const storeName = (CONFIG.ALBUM && CONFIG.ALBUM.storeName) || 'photos';
      return new Promise((resolve, reject) => {
        try {
          const tx = this._db.transaction(storeName, 'readwrite');
          const store = tx.objectStore(storeName);
          store.put({ id, dataUrl, createdAt: Date.now() });
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => reject(tx.error || new Error('IDB write failed'));
          tx.onabort = () => reject(tx.error || new Error('IDB write aborted'));
        } catch (err) {
          reject(err);
        }
      });
    }

    _deleteImageFromDb(id) {
      if (!this._db) return Promise.resolve();
      const storeName = (CONFIG.ALBUM && CONFIG.ALBUM.storeName) || 'photos';
      return new Promise((resolve) => {
        try {
          const tx = this._db.transaction(storeName, 'readwrite');
          tx.objectStore(storeName).delete(id);
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        } catch (_err) {
          resolve();
        }
      });
    }

    _loadPoseDex() {
      const validMembers = new Set((CONFIG.MEMBERS || []).map((m) => m.id));
      const validPoses = getValidPoseIds();
      const clean = {};
      validMembers.forEach((id) => {
        clean[id] = [];
      });

      if (!this._hasStorage()) {
        return Object.assign(clean, this._poseDexMemory);
      }

      try {
        const raw = global.localStorage.getItem(getPoseStorageKey());
        if (!raw) return clean;
        const parsed = JSON.parse(raw);
        const unlocked = parsed && parsed.unlocked;
        if (unlocked && typeof unlocked === 'object') {
          validMembers.forEach((id) => {
            if (Array.isArray(unlocked[id])) {
              const filtered = unlocked[id].map(String).filter((pid) => !validPoses || validPoses.has(pid));
              clean[id] = Array.from(new Set(filtered));
            }
          });
        }
      } catch (_err) {
        // Ignore corrupt dex data
      }
      return clean;
    }

    _persistPoseDex(dex) {
      if (!this._hasStorage()) {
        this._poseDexMemory = JSON.parse(JSON.stringify(dex));
        return;
      }
      try {
        global.localStorage.setItem(
          getPoseStorageKey(),
          JSON.stringify({ unlocked: dex })
        );
      } catch (_err) {
        // Ignore storage write errors
      }
    }

    getUnlockedMap() {
      const copy = {};
      Object.keys(this._poseDex).forEach((k) => {
        copy[k] = this._poseDex[k].slice();
      });
      return copy;
    }

    getMemberUnlockedPoses(memberId) {
      return (this._poseDex[memberId] || []).slice();
    }

    getMemberUncollectedPoses(memberId) {
      const unlocked = new Set(this.getMemberUnlockedPoses(memberId));
      const validPoses = getValidPoseIds();
      if (!validPoses) return [];
      return Array.from(validPoses).filter((pid) => !unlocked.has(pid));
    }

    isPoseUnlocked(memberId, poseId) {
      if (!memberId || !poseId) return false;
      const list = this._poseDex[memberId];
      return Array.isArray(list) ? list.includes(poseId) : false;
    }

    isMemberHoloUnlocked(memberId) {
      return this.getMemberUnlockedPoses(memberId).length >= getPoseCount();
    }

    getTotalUnlockedPoses() {
      return (CONFIG.MEMBERS || []).reduce(
        (sum, m) => sum + this.getMemberUnlockedPoses(m.id).length,
        0
      );
    }

    getTotalPossiblePoses() {
      return (CONFIG.MEMBERS || []).length * getPoseCount();
    }

    isAllPosesCompleted() {
      const total = this.getTotalPossiblePoses();
      return total > 0 && this.getTotalUnlockedPoses() >= total;
    }

    hasCelebratedAllCompleted() {
      if (!this._hasStorage()) {
        return this._allCompletedCelebratedMem;
      }
      try {
        const val = global.localStorage.getItem('all_completed_celebrated');
        return val === '1' || val === 'true';
      } catch (_err) {
        return this._allCompletedCelebratedMem;
      }
    }

    markAllCompletedCelebrated() {
      this._allCompletedCelebratedMem = true;
      if (!this._hasStorage()) return;
      try {
        global.localStorage.setItem('all_completed_celebrated', '1');
      } catch (_err) {
        // Ignore storage write errors
      }
    }

    unlockPose(memberId, poseId) {
      if (!memberId || !poseId || !this._poseDex[memberId]) {
        return { isNew: false, totalForMember: 0, justUnlockedHolo: false };
      }
      const list = this._poseDex[memberId];
      const wasHolo = list.length >= getPoseCount();
      if (list.includes(poseId)) {
        return { isNew: false, totalForMember: list.length, justUnlockedHolo: false };
      }
      list.push(poseId);
      this._persistPoseDex(this._poseDex);
      const nowHolo = list.length >= getPoseCount();
      return {
        isNew: true,
        totalForMember: list.length,
        justUnlockedHolo: !wasHolo && nowHolo
      };
    }

    encodeForStorage(sourceCanvas) {
      const maxStoreW = (CONFIG.ALBUM && CONFIG.ALBUM.maxStoreWidth) || 1080;
      const targetW = Math.min(maxStoreW, sourceCanvas.width);
      const scale = targetW / sourceCanvas.width;
      const targetH = Math.round(sourceCanvas.height * scale);

      const offCanvas = document.createElement('canvas');
      offCanvas.width = targetW;
      offCanvas.height = targetH;
      const ctx = offCanvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      if ('imageSmoothingQuality' in ctx) {
        ctx.imageSmoothingQuality = 'high';
      }
      ctx.fillStyle = '#FAF7F0';
      ctx.fillRect(0, 0, targetW, targetH);
      ctx.drawImage(sourceCanvas, 0, 0, targetW, targetH);

      const quality = (CONFIG.ALBUM && CONFIG.ALBUM.jpegQuality) || 0.88;
      let dataUrl = '';
      try {
        dataUrl = offCanvas.toDataURL('image/jpeg', quality);
      } catch (err) {
        const isSecurity =
          err &&
          (err.name === 'SecurityError' ||
            String(err.message || '').toLowerCase().includes('tainted'));
        if (isSecurity) {
          return {
            ok: false,
            reason: 'SECURITY_ERROR',
            message: '本地直接双击打开时浏览器禁止导出画布，请使用本地静态服务器访问。'
          };
        }
        return {
          ok: false,
          reason: 'ENCODE_ERROR',
          message: '图片编码失败，请重试。'
        };
      }

      return {
        ok: true,
        dataUrl,
        width: targetW,
        height: targetH
      };
    }

    getItems() {
      return this._metaItems.map((meta) => Object.assign({}, meta, {
        dataUrl: this._imageCache[meta.id] || ''
      }));
    }

    getCount() {
      return this._metaItems.length;
    }

    getById(id) {
      const meta = this._metaItems.find((it) => it.id === id);
      if (!meta) return null;
      return Object.assign({}, meta, {
        dataUrl: this._imageCache[meta.id] || ''
      });
    }

    getCollectedMemberIds() {
      const validIds = new Set(CONFIG.MEMBERS.map((m) => m.id));
      const collected = new Set();
      this._metaItems.forEach((it) => {
        if (validIds.has(it.memberId)) {
          collected.add(it.memberId);
        }
      });
      return collected;
    }

    isMemberCollected(memberId) {
      return this.getCollectedMemberIds().has(memberId);
    }

    isGroupUnlocked() {
      return this.getCollectedMemberIds().size >= CONFIG.MEMBERS.length;
    }

    async savePhoto(payload) {
      const { canvas, member, judgment, dateStr, isGroup, poseId, poseName, poseRarity, isHolo } = payload;
      const wasUnlocked = this.isGroupUnlocked();

      // 图鉴进度保存在 localStorage（独立于图片存储，确保极端存储失败也不丢进度）
      let poseUnlockRes = { isNew: false, totalForMember: 0, justUnlockedHolo: false };
      if (!isGroup && member && poseId) {
        poseUnlockRes = this.unlockPose(member.id, poseId);
      }

      try {
        await this._initDb();
        const encoded = this.encodeForStorage(canvas);
        if (!encoded.ok) {
          return Object.assign({}, encoded, {
            isNewPose: poseUnlockRes.isNew,
            justUnlockedHolo: poseUnlockRes.justUnlockedHolo
          });
        }

        const itemMeta = {
          id: `cheki_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          memberId: isGroup ? CONFIG.GROUP_MEMBER.id : member.id,
          memberName: isGroup ? CONFIG.GROUP_MEMBER.name : member.name,
          memberColor: isGroup ? CONFIG.GROUP_MEMBER.color : member.color,
          judgmentKey: judgment.key,
          stars: judgment.stars,
          dateStr: dateStr,
          isGroup: Boolean(isGroup),
          poseId: poseId || null,
          poseName: poseName || null,
          poseRarity: poseRarity || null,
          isNewPose: poseUnlockRes.isNew,
          isHolo: Boolean(isHolo),
          width: encoded.width,
          height: encoded.height,
          createdAt: Date.now()
        };

        await this._putImageToDb(itemMeta.id, encoded.dataUrl);
        const nextMeta = [itemMeta, ...this._metaItems];
        const metaRes = this._persistMeta(nextMeta);
        if (!metaRes.ok) {
          return Object.assign({}, metaRes, {
            isNewPose: poseUnlockRes.isNew,
            justUnlockedHolo: poseUnlockRes.justUnlockedHolo
          });
        }

        this._metaItems = nextMeta;
        this._imageCache[itemMeta.id] = encoded.dataUrl;
        const nowUnlocked = this.isGroupUnlocked();

        return {
          ok: true,
          item: Object.assign({}, itemMeta, { dataUrl: encoded.dataUrl }),
          justUnlockedGroup: !wasUnlocked && nowUnlocked,
          isNewPose: poseUnlockRes.isNew,
          justUnlockedHolo: poseUnlockRes.justUnlockedHolo
        };
      } catch (_err) {
        return {
          ok: false,
          reason: 'STORAGE_FULL',
          message: '本地相册已满，请先长按保存到手机',
          isNewPose: poseUnlockRes.isNew,
          justUnlockedHolo: poseUnlockRes.justUnlockedHolo
        };
      }
    }

    deleteItem(id) {
      const nextMeta = this._metaItems.filter((it) => it.id !== id);
      const result = this._persistMeta(nextMeta);
      if (!result.ok) {
        return result;
      }
      this._metaItems = nextMeta;
      delete this._imageCache[id];
      try {
        this._deleteImageFromDb(id);
      } catch (_err) {
        // Ignore IndexedDB delete errors
      }
      return {
        ok: true,
        isGroupUnlocked: this.isGroupUnlocked()
      };
    }
  }

  ChekiGame.AlbumManager = new LocalAlbumManager();
})(window);
