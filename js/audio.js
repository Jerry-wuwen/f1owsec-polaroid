(function (global) {
  'use strict';

  const ChekiGame = global.ChekiGame || (global.ChekiGame = {});
  const DEFAULT_BGM_VOLUME = 0.38;

  class PixelAudioManager {
    constructor() {
      this._ctx = null;
      this._muted = this._loadMutedPref();
      this._noiseBuffer = null;

      this._bgmGain = null;
      this._introBuffer = null;
      this._loopBuffer = null;
      this._introSource = null;
      this._loopSource = null;
      this._bgmLoadPromise = null;
      this._bgmFailed = false;
      this._bgmStarted = false;
      this._pendingBgmStart = false;
      this._lastScheduled = null;
      this._visibilityBound = false;

      this._bindVisibilityListener();
    }

    _getMuteStorageKey() {
      return (ChekiGame.CONFIG && ChekiGame.CONFIG.AUDIO_MUTE_STORAGE_KEY) || 'f1owsec_audio_muted_v1';
    }

    _loadMutedPref() {
      try {
        if (typeof global.localStorage !== 'undefined' && global.localStorage) {
          return global.localStorage.getItem(this._getMuteStorageKey()) === '1';
        }
      } catch (_err) {
        // Ignore storage read errors
      }
      return false;
    }

    _saveMutedPref(muted) {
      try {
        if (typeof global.localStorage !== 'undefined' && global.localStorage) {
          global.localStorage.setItem(this._getMuteStorageKey(), muted ? '1' : '0');
        }
      } catch (_err) {
        // Ignore storage write errors
      }
    }

    _bindVisibilityListener() {
      if (this._visibilityBound) return;
      if (typeof global.document === 'undefined' || typeof global.document.addEventListener !== 'function') {
        return;
      }
      this._visibilityBound = true;
      this._onVisibilityChange = () => {
        this._handleVisibilityChange();
      };
      global.document.addEventListener('visibilitychange', this._onVisibilityChange);
    }

    _handleVisibilityChange() {
      if (!this._ctx) return;
      try {
        if (global.document && global.document.hidden) {
          if (typeof this._ctx.suspend === 'function') {
            const p = this._ctx.suspend();
            if (p && typeof p.catch === 'function') p.catch(() => {});
          }
        } else if (!this._muted) {
          if (typeof this._ctx.resume === 'function') {
            const p = this._ctx.resume();
            if (p && typeof p.catch === 'function') p.catch(() => {});
          }
          if (this._pendingBgmStart && !this._bgmStarted && this._introBuffer && this._loopBuffer) {
            this._pendingBgmStart = false;
            this._startSeamlessBgm(this._ctx);
          }
        }
      } catch (_err) {
        // Ignore visibility suspend/resume errors
      }
    }

    _ensureContext(allowWhenMuted) {
      if (this._muted && !allowWhenMuted) return null;
      try {
        if (!this._ctx) {
          const AudioCtx = global.AudioContext || global.webkitAudioContext;
          if (!AudioCtx) return null;
          this._ctx = new AudioCtx();
        }
        if (!this._muted && this._ctx.state === 'suspended' && typeof this._ctx.resume === 'function') {
          const p = this._ctx.resume();
          if (p && typeof p.catch === 'function') {
            p.catch(() => {});
          }
        }
        return this._ctx;
      } catch (_err) {
        return null;
      }
    }

    _ensureBgmGain(ctx) {
      if (!ctx) return null;
      if (!this._bgmGain && typeof ctx.createGain === 'function') {
        this._bgmGain = ctx.createGain();
        if (typeof this._bgmGain.connect === 'function' && ctx.destination) {
          this._bgmGain.connect(ctx.destination);
        }
      }
      this._applyBgmGain();
      return this._bgmGain;
    }

    _applyBgmGain() {
      if (!this._bgmGain || !this._bgmGain.gain) return;
      const target = this._muted ? 0 : DEFAULT_BGM_VOLUME;
      try {
        if (this._ctx && typeof this._bgmGain.gain.setValueAtTime === 'function') {
          this._bgmGain.gain.setValueAtTime(target, this._ctx.currentTime || 0);
        }
        this._bgmGain.gain.value = target;
      } catch (_err) {
        // Ignore gain automation errors
      }
    }

    _decodeAudioData(ctx, arrayBuffer) {
      return new Promise((resolve, reject) => {
        let settled = false;
        const onOk = (buf) => {
          if (!settled) {
            settled = true;
            resolve(buf);
          }
        };
        const onErr = (err) => {
          if (!settled) {
            settled = true;
            reject(err || new Error('decodeAudioData failed'));
          }
        };
        try {
          const maybePromise = ctx.decodeAudioData(arrayBuffer, onOk, onErr);
          if (maybePromise && typeof maybePromise.then === 'function') {
            maybePromise.then(onOk, onErr);
          }
        } catch (err) {
          onErr(err);
        }
      });
    }

    _fetchAndDecode(ctx, url) {
      if (typeof global.fetch !== 'function') {
        return Promise.reject(new Error('fetch unavailable'));
      }
      return global.fetch(url)
        .then((res) => {
          if (!res || !res.ok) {
            throw new Error(`Audio fetch failed: ${res ? res.status : 'unknown'}`);
          }
          return res.arrayBuffer();
        })
        .then((arrayBuf) => this._decodeAudioData(ctx, arrayBuf));
    }

    _loadBgmBuffers(ctx) {
      if (this._introBuffer && this._loopBuffer) {
        return Promise.resolve(true);
      }
      if (this._bgmFailed) {
        return Promise.resolve(false);
      }
      if (this._bgmLoadPromise) {
        return this._bgmLoadPromise;
      }

      const ver = (ChekiGame.CONFIG && ChekiGame.CONFIG.ASSET_VERSION) || '20261123g';
      const introUrl = `./assets/audio/bgm_intro.wav?v=${encodeURIComponent(ver)}`;
      const loopUrl = `./assets/audio/bgm_loop.wav?v=${encodeURIComponent(ver)}`;

      this._bgmLoadPromise = Promise.all([
        this._fetchAndDecode(ctx, introUrl),
        this._fetchAndDecode(ctx, loopUrl)
      ]).then(([introBuf, loopBuf]) => {
        this._introBuffer = introBuf;
        this._loopBuffer = loopBuf;
        return Boolean(introBuf && loopBuf);
      }).catch(() => {
        // Silent graceful fallback if audio assets fail to load or decode
        this._bgmFailed = true;
        this._bgmLoadPromise = null;
        return false;
      });

      return this._bgmLoadPromise;
    }

    _stopBgmSources() {
      [this._introSource, this._loopSource].forEach((src) => {
        if (!src) return;
        try {
          src.onended = null;
          if (typeof src.stop === 'function') src.stop(0);
          if (typeof src.disconnect === 'function') src.disconnect();
        } catch (_err) {
          // Ignore already-stopped source errors
        }
      });
      this._introSource = null;
      this._loopSource = null;
    }

    _startSeamlessBgm(ctx) {
      if (!ctx || this._bgmStarted || !this._introBuffer || !this._loopBuffer) return;
      const gainNode = this._ensureBgmGain(ctx);
      if (!gainNode) return;

      try {
        this._stopBgmSources();

        const startTime = (ctx.currentTime || 0) + 0.04;
        const introDur = Math.max(0, Number(this._introBuffer.duration) || 0);
        const loopStartTime = startTime + introDur;

        const introSource = ctx.createBufferSource();
        introSource.buffer = this._introBuffer;
        introSource.loop = false;
        introSource.connect(gainNode);
        introSource.onended = () => {
          if (this._introSource === introSource) {
            this._introSource = null;
          }
        };

        const loopSource = ctx.createBufferSource();
        loopSource.buffer = this._loopBuffer;
        loopSource.loop = true;
        loopSource.connect(gainNode);

        introSource.start(startTime);
        loopSource.start(loopStartTime);

        this._introSource = introSource;
        this._loopSource = loopSource;
        this._bgmStarted = true;
        this._lastScheduled = { startTime, loopStartTime, introDuration: introDur };
      } catch (_err) {
        this._bgmStarted = false;
      }
    }

    unlockAndStartBgm() {
      if (this._muted) return Promise.resolve(false);
      const ctx = this._ensureContext(false);
      if (!ctx) return Promise.resolve(false);

      this._ensureBgmGain(ctx);
      if (this._bgmStarted || this._bgmFailed) {
        return Promise.resolve(this._bgmStarted);
      }

      if (this._introBuffer && this._loopBuffer) {
        if (typeof global.document !== 'undefined' && global.document.hidden) {
          this._pendingBgmStart = true;
          return Promise.resolve(false);
        }
        this._startSeamlessBgm(ctx);
        return Promise.resolve(this._bgmStarted);
      }

      return this._loadBgmBuffers(ctx).then((ok) => {
        if (!ok || this._bgmStarted) return this._bgmStarted;
        const hidden = typeof global.document !== 'undefined' && Boolean(global.document.hidden);
        if (this._muted || hidden) {
          this._pendingBgmStart = true;
          return false;
        }
        this._startSeamlessBgm(ctx);
        return this._bgmStarted;
      });
    }

    _getNoiseBuffer(ctx) {
      if (this._noiseBuffer && this._noiseBuffer.sampleRate === ctx.sampleRate) {
        return this._noiseBuffer;
      }
      const length = Math.floor(ctx.sampleRate * 0.14);
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) {
        data[i] = Math.random() * 2 - 1;
      }
      this._noiseBuffer = buffer;
      return buffer;
    }

    _playTone(freq, endFreq, duration, type, startOffset, peakGain) {
      const ctx = this._ensureContext();
      if (!ctx) return;

      const start = ctx.currentTime + (startOffset || 0);
      const dur = Math.max(0.02, duration || 0.08);
      const gainVal = peakGain != null ? peakGain : 0.14;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type || 'square';
      osc.frequency.setValueAtTime(freq, start);
      if (endFreq && endFreq !== freq) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), start + dur);
      }

      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(gainVal, start + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + dur + 0.015);
    }

    _playNoiseBurst(startOffset, duration, filterFreq, peakGain) {
      const ctx = this._ensureContext();
      if (!ctx) return;

      const start = ctx.currentTime + (startOffset || 0);
      const dur = Math.max(0.015, duration || 0.04);

      const src = ctx.createBufferSource();
      src.buffer = this._getNoiseBuffer(ctx);

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(filterFreq || 2200, start);
      filter.Q.setValueAtTime(1.2, start);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(peakGain != null ? peakGain : 0.16, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);

      src.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      src.start(start);
      src.stop(start + dur + 0.01);
    }

    isMuted() {
      return this._muted;
    }

    setMuted(muted) {
      this._muted = Boolean(muted);
      this._saveMutedPref(this._muted);
      this._applyBgmGain();
      if (!this._muted) {
        this._ensureContext(false);
        this._applyBgmGain();
        if (!this._bgmStarted) {
          this.unlockAndStartBgm();
        }
      }
      return this._muted;
    }

    toggleMute() {
      this.setMuted(!this._muted);
      if (!this._muted) {
        this.playUiClick();
      }
      return this._muted;
    }

    playShutter() {
      if (this._muted) return;
      try {
        // First click ("ka"): sharp blade release + downward square chirp
        this._playNoiseBurst(0, 0.036, 2600, 0.22);
        this._playTone(1200, 280, 0.045, 'square', 0, 0.14);

        // Second latch ("cha"): spring return 60ms later
        this._playNoiseBurst(0.06, 0.055, 1650, 0.2);
        this._playTone(420, 110, 0.065, 'triangle', 0.06, 0.18);
      } catch (_err) {
        // Ignore audio errors when context is restricted
      }
    }

    playJudgment(judgmentKey) {
      if (this._muted) return;
      try {
        if (judgmentKey === 'PERFECT') {
          const notes = [523.25, 659.25, 783.99, 987.77, 1046.5, 1318.51];
          notes.forEach((freq, idx) => {
            const offset = idx * 0.052;
            const isLast = idx === notes.length - 1;
            const dur = isLast ? 0.26 : 0.08;
            this._playTone(freq, freq, dur, 'square', offset, 0.11);
            this._playTone(freq * 0.5, freq * 0.5, dur, 'triangle', offset, 0.09);
          });
        } else if (judgmentKey === 'GREAT') {
          const notes = [783.99, 987.77, 1174.66];
          notes.forEach((freq, idx) => {
            const offset = idx * 0.065;
            const dur = idx === notes.length - 1 ? 0.18 : 0.085;
            this._playTone(freq, freq, dur, 'square', offset, 0.1);
          });
        } else {
          this._playTone(659.25, 659.25, 0.08, 'triangle', 0, 0.13);
          this._playTone(783.99, 783.99, 0.14, 'triangle', 0.075, 0.13);
        }
      } catch (_err) {
        // Ignore audio errors
      }
    }

    playSwitch() {
      if (this._muted) return;
      try {
        this._playTone(523.25, 587.33, 0.055, 'square', 0, 0.09);
        this._playTone(783.99, 880.0, 0.08, 'square', 0.052, 0.09);
      } catch (_err) {
        // Ignore audio errors
      }
    }

    playBgSwitch() {
      if (this._muted) return;
      try {
        this._playTone(329.63, 329.63, 0.055, 'triangle', 0, 0.12);
        this._playTone(440.0, 440.0, 0.055, 'triangle', 0.05, 0.12);
        this._playTone(659.25, 659.25, 0.09, 'square', 0.1, 0.08);
      } catch (_err) {
        // Ignore audio errors
      }
    }

    playUiClick() {
      if (this._muted) return;
      try {
        this._playTone(660, 520, 0.045, 'square', 0, 0.08);
      } catch (_err) {
        // Ignore audio errors
      }
    }

    playRub(progress) {
      if (this._muted) return;
      try {
        const p = Math.max(0, Math.min(1, progress || 0));
        const baseFreq = 520 + p * 460;
        this._playNoiseBurst(0, 0.022, 3200 + p * 1200, 0.055);
        this._playTone(baseFreq, baseFreq + 160, 0.035, 'triangle', 0, 0.07);
      } catch (_err) {
        // Ignore audio errors
      }
    }

    playDevelopComplete() {
      if (this._muted) return;
      try {
        const notes = [659.25, 830.61, 987.77, 1318.51];
        notes.forEach((freq, idx) => {
          const offset = idx * 0.055;
          const dur = idx === notes.length - 1 ? 0.24 : 0.08;
          this._playTone(freq, freq, dur, 'square', offset, 0.09);
          this._playTone(freq * 0.5, freq * 0.5, dur, 'triangle', offset, 0.08);
        });
      } catch (_err) {
        // Ignore audio errors
      }
    }

    playStickerPlace() {
      if (this._muted) return;
      try {
        this._playTone(440, 880, 0.055, 'triangle', 0, 0.1);
        this._playTone(660, 990, 0.045, 'square', 0.015, 0.055);
      } catch (_err) {
        // Ignore audio errors
      }
    }

    playUnlockFanfare() {
      if (this._muted) return;
      try {
        const notes = [523.25, 659.25, 783.99, 1046.5, 987.77, 1046.5, 1318.51, 1567.98];
        notes.forEach((freq, idx) => {
          const offset = idx * 0.065;
          const dur = idx === notes.length - 1 ? 0.32 : 0.09;
          this._playTone(freq, freq, dur, 'square', offset, 0.1);
          this._playTone(freq * 0.5, freq * 0.5, dur, 'triangle', offset, 0.09);
        });
      } catch (_err) {
        // Ignore audio errors
      }
    }

    playRarePoseAlert(rarity) {
      if (this._muted) return;
      try {
        if (rarity === 'SSR') {
          const notes = [880, 1174.66, 1396.91, 1760];
          notes.forEach((freq, idx) => {
            const offset = idx * 0.055;
            const dur = idx === notes.length - 1 ? 0.2 : 0.075;
            this._playTone(freq, freq, dur, 'square', offset, 0.1);
            this._playTone(freq * 0.5, freq * 0.5, dur, 'triangle', offset, 0.08);
          });
        } else if (rarity === 'SR') {
          this._playTone(783.99, 987.77, 0.065, 'square', 0, 0.085);
          this._playTone(1174.66, 1174.66, 0.11, 'triangle', 0.06, 0.09);
        }
      } catch (_err) {
        // Ignore audio errors
      }
    }
  }

  ChekiGame.AudioManager = new PixelAudioManager();
})(window);
