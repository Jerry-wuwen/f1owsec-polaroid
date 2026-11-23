(function (global) {
  'use strict';

  const ChekiGame = global.ChekiGame || (global.ChekiGame = {});
  const CONFIG = ChekiGame.CONFIG || {};

  const FILTER_CFG = CONFIG.PIXEL_FILTER || {
    storageKey: 'f1owsec_vibe_filter_v2',
    defaults: {
      scanlines: false,
      cyberCool: false,
      warmFilm: false,
      stageGlow: false
    }
  };

  function hasLocalStorage() {
    try {
      return typeof global.localStorage !== 'undefined' && global.localStorage !== null;
    } catch (_err) {
      return false;
    }
  }

  function sanitizeSettings(raw) {
    const defaults = FILTER_CFG.defaults || {};
    const obj = raw && typeof raw === 'object' ? raw : {};

    return {
      scanlines: typeof obj.scanlines === 'boolean' ? obj.scanlines : Boolean(defaults.scanlines),
      cyberCool: typeof obj.cyberCool === 'boolean' ? obj.cyberCool : Boolean(defaults.cyberCool),
      warmFilm: typeof obj.warmFilm === 'boolean' ? obj.warmFilm : Boolean(defaults.warmFilm),
      stageGlow: typeof obj.stageGlow === 'boolean' ? obj.stageGlow : Boolean(defaults.stageGlow)
    };
  }

  let currentSettings = loadSettings();

  function loadSettings() {
    if (!hasLocalStorage()) {
      return sanitizeSettings(FILTER_CFG.defaults);
    }
    try {
      const saved = global.localStorage.getItem(FILTER_CFG.storageKey);
      if (!saved) return sanitizeSettings(FILTER_CFG.defaults);
      return sanitizeSettings(JSON.parse(saved));
    } catch (_err) {
      return sanitizeSettings(FILTER_CFG.defaults);
    }
  }

  function saveSettings(next) {
    if (!hasLocalStorage()) return;
    try {
      global.localStorage.setItem(FILTER_CFG.storageKey, JSON.stringify(next));
    } catch (_err) {
      // Ignore storage write errors
    }
  }

  function getSettings() {
    return Object.assign({}, currentSettings);
  }

  function updateSettings(partial) {
    currentSettings = sanitizeSettings(Object.assign({}, currentSettings, partial));
    saveSettings(currentSettings);
    return getSettings();
  }

  function resetSettings() {
    currentSettings = sanitizeSettings(FILTER_CFG.defaults);
    saveSettings(currentSettings);
    return getSettings();
  }

  function getImageDimensions(sourceImg) {
    if (!sourceImg) return { w: 0, h: 0 };
    if (typeof sourceImg.naturalWidth === 'number') {
      if (sourceImg.complete === false || sourceImg.naturalWidth <= 0 || sourceImg.naturalHeight <= 0) {
        return { w: 0, h: 0 };
      }
      return { w: sourceImg.naturalWidth, h: sourceImg.naturalHeight };
    }
    const w = sourceImg.width || 0;
    const h = sourceImg.height || 0;
    return w > 0 && h > 0 ? { w, h } : { w: 0, h: 0 };
  }

  function isBrightGreenPixel(r, g, b, a) {
    return a > 128 && g > 170 && g > r * 1.4 && g > b * 1.4;
  }

  function isGreenScreenKey(r, g, b, a) {
    if (a <= 0) return false;
    if (g > 170 && g > r * 1.4 && g > b * 1.4) return true;
    return g > 120 && g > r * 1.35 && g > b * 1.35 && (g - Math.max(r, b)) > 35;
  }

  /**
   * 离屏自动绿幕去背：检测四角亮绿背景，自动透明化并清理边界 1px 绿幕溢色。
   */
  function removeGreenScreen(sourceImg) {
    const dims = getImageDimensions(sourceImg);
    if (dims.w <= 0 || dims.h <= 0) return sourceImg;

    const w = dims.w;
    const h = dims.h;
    const offCanvas = document.createElement('canvas');
    offCanvas.width = w;
    offCanvas.height = h;

    const ctx = offCanvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(sourceImg, 0, 0, w, h);

    let imgData;
    try {
      imgData = ctx.getImageData(0, 0, w, h);
    } catch (_securityErr) {
      return sourceImg;
    }

    const data = imgData.data;
    const corners = [
      0,
      (w - 1) * 4,
      ((h - 1) * w) * 4,
      ((h - 1) * w + (w - 1)) * 4
    ];

    let greenCornerCount = 0;
    corners.forEach((idx) => {
      if (isBrightGreenPixel(data[idx], data[idx + 1], data[idx + 2], data[idx + 3])) {
        greenCornerCount += 1;
      }
    });

    // 非绿幕图直接保留原图，不做多余拷贝
    if (greenCornerCount < 2) {
      return sourceImg;
    }

    const total = w * h;
    const clearedMask = new Uint8Array(total);

    // 第一遍：清除绿幕与绿幕过渡边缘
    for (let p = 0; p < total; p += 1) {
      const idx = p * 4;
      if (isGreenScreenKey(data[idx], data[idx + 1], data[idx + 2], data[idx + 3])) {
        data[idx] = 0;
        data[idx + 1] = 0;
        data[idx + 2] = 0;
        data[idx + 3] = 0;
        clearedMask[p] = 1;
      }
    }

    // 第二遍：仅对紧邻已清除区域的 1px 外轮廓清理绿色溢色，不损伤绿色服饰/发丝内部
    for (let y = 0; y < h; y += 1) {
      const rowOffset = y * w;
      for (let x = 0; x < w; x += 1) {
        const p = rowOffset + x;
        if (clearedMask[p]) continue;
        const idx = p * 4;
        if (data[idx + 3] === 0) continue;

        const nearCleared =
          (x > 0 && clearedMask[p - 1]) ||
          (x < w - 1 && clearedMask[p + 1]) ||
          (y > 0 && clearedMask[p - w]) ||
          (y < h - 1 && clearedMask[p + w]);

        if (nearCleared) {
          const maxRb = Math.max(data[idx], data[idx + 2]);
          if (data[idx + 1] > maxRb) {
            data[idx + 1] = maxRb;
          }
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);
    return offCanvas;
  }

  /**
   * 无损透传原图，不再对 GBA/NDS 像素立绘进行降采样、量化或描边破坏。
   */
  function processSprite(sourceImg) {
    return sourceImg || null;
  }

  /**
   * 4 种无损掌机氛围滤镜（直接绘制在舞台取景区域上方，可任意叠加）。
   */
  function applyAtmosphereFilters(ctx, rect, overrideSettings) {
    if (!ctx || !rect) return;
    const settings = overrideSettings ? sanitizeSettings(overrideSettings) : currentSettings;
    if (!settings.scanlines && !settings.cyberCool && !settings.warmFilm && !settings.stageGlow) {
      return;
    }

    const x = Math.round(rect.x || 0);
    const y = Math.round(rect.y || 0);
    const w = Math.round(rect.w || 0);
    const h = Math.round(rect.h || 0);
    if (w <= 0 || h <= 0) return;

    ctx.save();
    if (typeof ctx.beginPath === 'function' && typeof ctx.rect === 'function' && typeof ctx.clip === 'function') {
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.clip();
    }

    // ② 赛博冷色调
    if (settings.cyberCool) {
      ctx.fillStyle = 'rgba(34, 211, 238, 0.13)';
      ctx.fillRect(x, y, w, h);
      if (typeof ctx.createLinearGradient === 'function') {
        const coolGrad = ctx.createLinearGradient(x, y + h, x, y);
        coolGrad.addColorStop(0, 'rgba(30, 58, 138, 0.18)');
        coolGrad.addColorStop(1, 'rgba(56, 189, 248, 0.04)');
        ctx.fillStyle = coolGrad;
        ctx.fillRect(x, y, w, h);
      }
    }

    // ③ 暖色拍立得胶片
    if (settings.warmFilm) {
      ctx.fillStyle = 'rgba(251, 191, 36, 0.13)';
      ctx.fillRect(x, y, w, h);
      if (typeof ctx.createRadialGradient === 'function') {
        const cx = x + w * 0.5;
        const cy = y + h * 0.48;
        const maxR = Math.max(w, h) * 0.78;
        const warmGrad = ctx.createRadialGradient(cx, cy, maxR * 0.25, cx, cy, maxR);
        warmGrad.addColorStop(0, 'rgba(254, 243, 199, 0.05)');
        warmGrad.addColorStop(1, 'rgba(120, 53, 15, 0.18)');
        ctx.fillStyle = warmGrad;
        ctx.fillRect(x, y, w, h);
      }
    }

    // ④ 舞台柔光
    if (settings.stageGlow) {
      if (typeof ctx.createRadialGradient === 'function') {
        const gx = x + w * 0.5;
        const gy = y + h * 0.16;
        const glowR = Math.max(w, h) * 0.72;
        const glowGrad = ctx.createRadialGradient(gx, gy, 0, gx, gy, glowR);
        glowGrad.addColorStop(0, 'rgba(255, 245, 255, 0.22)');
        glowGrad.addColorStop(0.5, 'rgba(244, 114, 182, 0.08)');
        glowGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = glowGrad;
        ctx.fillRect(x, y, w, h);
      }
      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.fillRect(x, y, w, h);
    }

    // ① GBA 液晶微扫描线
    if (settings.scanlines) {
      ctx.fillStyle = 'rgba(10, 8, 22, 0.16)';
      for (let sy = y; sy < y + h; sy += 4) {
        ctx.fillRect(x, sy, w, 1);
      }
      ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
      for (let sx = x; sx < x + w; sx += 4) {
        ctx.fillRect(sx, y, 1, h);
      }
    }

    ctx.restore();
  }

  ChekiGame.PixelFilter = {
    getSettings,
    updateSettings,
    resetSettings,
    removeGreenScreen,
    processSprite,
    applyAtmosphereFilters,
    getImageDimensions
  };
})(window);
