(function (global) {
  'use strict';

  const ChekiGame = global.ChekiGame;
  const CONFIG = ChekiGame.CONFIG;
  const AudioManager = ChekiGame.AudioManager;
  const PixelFilter = ChekiGame.PixelFilter;
  const AssetsManager = ChekiGame.AssetsManager;
  const Poses = ChekiGame.Poses;
  const Stickers = ChekiGame.Stickers;
  const AlbumManager = ChekiGame.AlbumManager;

  const STAGE_SCALE = CONFIG.STAGE_SCALE || 2;
  const CAPTURE_SCALE = STAGE_SCALE * 2; // 4x -> 1080x1920 高清截图底座
  const POLAROID_HD_SCALE = 2;           // 2x -> 1776x2336 / 2160x1952 高清拍立得出图
  const FRAMING_MODES = [
    { id: 'full', label: '全身', zoom: 1.0, focusY: 0.68 },
    { id: 'half', label: '半身', zoom: 1.32, focusY: 0.14 },
    { id: 'closeup', label: '特写', zoom: 1.72, focusY: 0.055 }
  ];
  const SPRITE_SLOTS = ['main', 'pose', 'pose2', 'pose3', 'pose4'];
  const TO_SIGN_PHRASES = ['今天也辛苦啦!', '谢谢来看我!', '记住你咯!', '下次还要见!'];
  const TO_SIGN_COLORS = [
    { key: 'oshi', label: '应援色' },
    { key: 'black', label: '黑' },
    { key: 'white', label: '白' }
  ];

  function getToSignMetrics(ctx, photoRect, signCfg) {
    const nick = String((signCfg && signCfg.nickname) || '').trim().slice(0, 10);
    const phrase = (signCfg && signCfg.phrase) || TO_SIGN_PHRASES[0];
    const angleRad = (((signCfg && signCfg.angleDeg != null) ? signCfg.angleDeg : -4) * Math.PI) / 180;
    const scale = Math.max(0.75, Math.min(1.4, (signCfg && signCfg.scale != null) ? signCfg.scale : 1.0));
    const anchorX = (signCfg && signCfg.x != null) ? signCfg.x : (photoRect.x + photoRect.w - 28);
    const anchorY = (signCfg && signCfg.y != null) ? signCfg.y : (photoRect.y + photoRect.h - 24);
    const fontStack = '"YouYuan", "PingFang SC", "Hiragino Maru Gothic ProN", "Segoe Print", "Comic Sans MS", "Microsoft YaHei", cursive, sans-serif';

    ctx.save();
    let nickW = 0;
    if (nick) {
      ctx.font = `900 32px ${fontStack}`;
      nickW = ctx.measureText(`To ${nick} ♥`).width;
    }
    ctx.font = `900 28px ${fontStack}`;
    const phraseW = ctx.measureText(phrase).width;
    ctx.restore();

    const maxW = Math.max(nickW, phraseW, 120);
    const left = -maxW - 14;
    const top = nick ? -74 : -34;
    const w = maxW + 28;
    const h = nick ? 88 : 48;

    return {
      nick,
      phrase,
      angleRad,
      scale,
      anchorX,
      anchorY,
      fontStack,
      box: { left, top, w, h }
    };
  }

  function drawToSignature(ctx, outW, outH, member, isGroup, photoRect, signCfg) {
    if (!signCfg || !signCfg.enabled || !photoRect) return;
    const m = getToSignMetrics(ctx, photoRect, signCfg);

    let fillCol = '#3B82F6';
    let strokeCol = '#FFFFFF';
    if (signCfg.colorKey === 'black') {
      fillCol = '#18181B';
      strokeCol = '#FFFFFF';
    } else if (signCfg.colorKey === 'white') {
      fillCol = '#FFFFFF';
      strokeCol = '#1E1B2E';
    } else {
      fillCol = isGroup
        ? '#7C3AED'
        : (member && member.isDarkColor ? '#3F3F46' : (member ? member.color : '#3B82F6'));
      strokeCol = '#FFFFFF';
    }

    ctx.save();
    ctx.imageSmoothingEnabled = true;
    if ('imageSmoothingQuality' in ctx) {
      ctx.imageSmoothingQuality = 'high';
    }
    if (signCfg.alpha != null) {
      ctx.globalAlpha = signCfg.alpha;
    }
    ctx.translate(m.anchorX, m.anchorY);
    ctx.rotate(m.angleRad);
    if (m.scale !== 1) {
      ctx.scale(m.scale, m.scale);
    }
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    if (m.nick) {
      ctx.font = `900 32px ${m.fontStack}`;
      ctx.lineWidth = 7;
      ctx.strokeStyle = strokeCol;
      ctx.shadowColor = 'rgba(15, 23, 42, 0.25)';
      ctx.shadowBlur = 2;
      ctx.shadowOffsetY = 1;
      ctx.strokeText(`To ${m.nick} ♥`, 0, -38);
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      ctx.fillStyle = fillCol;
      ctx.fillText(`To ${m.nick} ♥`, 0, -38);
    }

    ctx.font = `900 28px ${m.fontStack}`;
    ctx.lineWidth = 7;
    ctx.strokeStyle = strokeCol;
    ctx.shadowColor = 'rgba(15, 23, 42, 0.25)';
    ctx.shadowBlur = 2;
    ctx.shadowOffsetY = 1;
    ctx.strokeText(m.phrase, 0, 0);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.fillStyle = fillCol;
    ctx.fillText(m.phrase, 0, 0);

    if (signCfg.showSelection) {
      const b = m.box;
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = Math.max(2, 3.5 / m.scale);
      if (typeof ctx.setLineDash === 'function') {
        ctx.setLineDash([10 / m.scale, 7 / m.scale]);
      }
      ctx.strokeRect(b.left, b.top, b.w, b.h);
    }
    ctx.restore();
  }

  function drawCompleteMasterStamp(ctx, outW, outH, isGroup) {
    const cx = outW - (isGroup ? 178 : 196);
    const cy = isGroup ? 936 : 1124;
    const w = isGroup ? 300 : 336;
    const h = isGroup ? 30 : 38;
    const angleRad = (-4 * Math.PI) / 180;
    const labelText = 'F1owSec ★ 35/35 COMPLETE';
    let fontSize = isGroup ? 16 : 18;

    ctx.save();
    ctx.imageSmoothingEnabled = true;
    if ('imageSmoothingQuality' in ctx) {
      ctx.imageSmoothingQuality = 'high';
    }
    ctx.translate(cx, cy);
    ctx.rotate(angleRad);

    // Double-bordered rounded gold/ivory master stamp
    fillRoundedRect(ctx, -w / 2, -h / 2, w, h, 8, 'rgba(255, 251, 235, 0.94)', '#B45309', 3);
    fillRoundedRect(ctx, -w / 2 + 4, -h / 2 + 4, w - 8, h - 8, 5, null, '#F59E0B', 1.4);

    // Crisp vector corner stars & auto-fitted label
    const fontFamily = '"Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#D97706';
    ctx.font = `900 ${fontSize}px ${fontFamily}`;
    ctx.fillText('★', -w / 2 + 16, 0.5);
    ctx.fillText('★', w / 2 - 16, 0.5);

    const maxLabelW = w - 52;
    const measuredW = ctx.measureText(labelText).width;
    if (measuredW > maxLabelW && measuredW > 0) {
      fontSize = Math.max(10, Math.floor((fontSize * maxLabelW) / measuredW));
      ctx.font = `900 ${fontSize}px ${fontFamily}`;
    }

    ctx.fillStyle = '#92400E';
    ctx.fillText(labelText, 0, 0.5);

    ctx.restore();
  }

  function fillRoundedRect(ctx, x, y, w, h, radius, fillStyle, strokeStyle, lineWidth) {
    const r = Math.max(0, Math.min(radius, Math.min(w, h) / 2));
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    if (fillStyle) {
      ctx.fillStyle = fillStyle;
      ctx.fill();
    }
    if (strokeStyle && lineWidth > 0) {
      ctx.strokeStyle = strokeStyle;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }
    ctx.restore();
  }

  // Compact 5x7 pixel font bitmaps for crisp LED signage & viewfinder HUD
  const GLYPHS_5X7 = {
    ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
    '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
    '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
    '2': ['01110', '10001', '00001', '00110', '01000', '10000', '11111'],
    '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
    '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
    '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
    '6': ['01110', '10000', '10000', '11110', '10001', '10001', '01110'],
    '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
    '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
    '9': ['01110', '10001', '10001', '01111', '00001', '00001', '01110'],
    'A': ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
    'B': ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
    'C': ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
    'D': ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
    'E': ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
    'F': ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
    'G': ['01111', '10000', '10000', '10011', '10001', '10001', '01110'],
    'H': ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
    'I': ['01110', '00100', '00100', '00100', '00100', '00100', '01110'],
    'J': ['00111', '00010', '00010', '00010', '10010', '10010', '01100'],
    'K': ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
    'L': ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
    'M': ['10001', '11011', '10101', '10001', '10001', '10001', '10001'],
    'N': ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
    'O': ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
    'P': ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
    'Q': ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
    'R': ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
    'S': ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
    'T': ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
    'U': ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
    'V': ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
    'W': ['10001', '10001', '10001', '10101', '10101', '11011', '10001'],
    'X': ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
    'Y': ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
    'Z': ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
    'c': ['00000', '00000', '01111', '10000', '10000', '10000', '01111'],
    'e': ['00000', '00000', '01110', '10001', '11111', '10000', '01111'],
    'h': ['10000', '10000', '10110', '11001', '10001', '10001', '10001'],
    'o': ['00000', '00000', '01110', '10001', '10001', '10001', '01110'],
    's': ['00000', '00000', '01111', '10000', '01110', '00001', '11110'],
    't': ['00100', '00100', '01110', '00100', '00100', '00101', '00010'],
    'w': ['00000', '00000', '10001', '10001', '10101', '11011', '10001'],
    '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100'],
    ':': ['00000', '01100', '01100', '00000', '01100', '01100', '00000'],
    '!': ['00100', '00100', '00100', '00100', '00100', '00000', '00100'],
    '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
    '+': ['00000', '00100', '00100', '11111', '00100', '00100', '00000'],
    '/': ['00001', '00010', '00010', '00100', '01000', '01000', '10000'],
    '★': ['00100', '00100', '11111', '01110', '01110', '11011', '10001'],
    '♥': ['00000', '01010', '11111', '11111', '01110', '00100', '00000'],
    '✦': ['00100', '00100', '01110', '11111', '01110', '00100', '00100'],
    '✚': ['00000', '00100', '00100', '11111', '00100', '00100', '00000'],
    '♠': ['00100', '01110', '11111', '11111', '01110', '00100', '01110']
  };

  function px(ctx, x, y, w, h, color) {
    if (color) ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  function measureBitmapText(text, scale, gap) {
    const s = scale || 1;
    const g = gap != null ? gap : s;
    if (!text) return 0;
    return text.length * 5 * s + Math.max(0, text.length - 1) * g;
  }

  function drawBitmapText(ctx, text, x, y, scale, color, align, gap) {
    const s = scale || 1;
    const g = gap != null ? gap : s;
    const totalW = measureBitmapText(text, s, g);
    let startX = Math.round(x);
    if (align === 'center') startX = Math.round(x - totalW / 2);
    else if (align === 'right') startX = Math.round(x - totalW);

    const startY = Math.round(y);
    ctx.fillStyle = color || '#FFFFFF';

    for (let i = 0; i < text.length; i += 1) {
      const ch = text[i];
      const glyph = GLYPHS_5X7[ch] || GLYPHS_5X7[ch.toUpperCase()] || GLYPHS_5X7[' '];
      const gx = startX + i * (5 * s + g);
      for (let row = 0; row < 7; row += 1) {
        const line = glyph[row];
        for (let col = 0; col < 5; col += 1) {
          if (line[col] === '1') {
            ctx.fillRect(gx + col * s, startY + row * s, s, s);
          }
        }
      }
    }
  }

  function drawPixelStar(ctx, cx, cy, arm, color, coreColor) {
    const x = Math.round(cx);
    const y = Math.round(cy);
    const a = Math.max(1, Math.round(arm));
    ctx.fillStyle = color;
    ctx.fillRect(x - a, y, a * 2 + 1, 1);
    ctx.fillRect(x, y - a, 1, a * 2 + 1);
    if (coreColor) {
      ctx.fillStyle = coreColor;
      ctx.fillRect(x, y, 1, 1);
    }
  }

  function drawPixelHeart(ctx, cx, cy, unit, color) {
    const pattern = [
      '01010',
      '11111',
      '11111',
      '01110',
      '00100'
    ];
    const u = Math.max(1, Math.round(unit));
    const sx = Math.round(cx - (5 * u) / 2);
    const sy = Math.round(cy - (5 * u) / 2);
    ctx.fillStyle = color;
    for (let r = 0; r < pattern.length; r += 1) {
      for (let c = 0; c < 5; c += 1) {
        if (pattern[r][c] === '1') {
          ctx.fillRect(sx + c * u, sy + r * u, u, u);
        }
      }
    }
  }

  function formatDateDot(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}.${m}.${d}`;
  }

  function formatDateStamp(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    const ss = String(date.getSeconds()).padStart(2, '0');
    return `${y}${m}${d}_${hh}${mm}${ss}`;
  }

  function hexToRgba(hex, alpha) {
    const clean = (hex || '#FFFFFF').replace('#', '');
    const r = parseInt(clean.slice(0, 2), 16) || 255;
    const g = parseInt(clean.slice(2, 4), 16) || 255;
    const b = parseInt(clean.slice(4, 6), 16) || 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function drawPixelShadow(ctx, cx, groundY, halfW, halfH, alpha) {
    const rw = Math.max(4, Math.round(halfW));
    const rh = Math.max(2, Math.round(halfH));
    ctx.save();
    ctx.fillStyle = `rgba(8, 5, 18, ${Math.max(0.08, Math.min(0.6, alpha)).toFixed(2)})`;
    for (let dy = -rh + 1; dy <= rh - 1; dy += 1) {
      const span = Math.round(rw * Math.sqrt(Math.max(0, 1 - (dy * dy) / (rh * rh))));
      if (span > 0) {
        ctx.fillRect(Math.round(cx - span), Math.round(groundY + dy), span * 2, 1);
      }
    }
    ctx.restore();
  }

  function drawPixelNote(ctx, cx, cy, color) {
    const x = Math.round(cx);
    const y = Math.round(cy);
    ctx.save();
    ctx.fillStyle = '#1E1B2E';
    ctx.fillRect(x - 1, y - 5, 5, 2);
    ctx.fillRect(x - 1, y - 4, 2, 7);
    ctx.fillRect(x - 4, y + 1, 5, 4);
    ctx.fillStyle = color || '#FEF08A';
    ctx.fillRect(x, y - 4, 3, 1);
    ctx.fillRect(x, y - 3, 1, 6);
    ctx.fillRect(x - 3, y + 2, 3, 2);
    ctx.restore();
  }

  function drawPoseParticles(ctx, particles) {
    if (!Array.isArray(particles) || particles.length === 0) return;
    particles.forEach((p) => {
      const ratio = Math.max(0, Math.min(1, p.life / (p.maxLife || 0.7)));
      ctx.save();
      ctx.globalAlpha = ratio;
      const px0 = Math.round(p.x);
      const py0 = Math.round(p.y);
      if (p.kind === 'note') {
        drawPixelNote(ctx, px0, py0, p.color);
      } else if (p.kind === 'heart') {
        drawPixelHeart(ctx, px0, py0, 1, p.color || '#FB7185');
      } else if (p.kind === 'star') {
        drawPixelStar(ctx, px0, py0, 3, p.color || '#FEF08A', '#FFFFFF');
      } else if (p.kind === 'symbol' && Stickers && typeof Stickers.drawSticker === 'function') {
        Stickers.drawSticker(ctx, {
          defId: p.symbolId || 'star',
          x: px0,
          y: py0,
          width: 16,
          height: 16,
          unit: 1
        }, false);
      } else {
        px(ctx, px0, py0, 3, 3, p.color || '#FEF08A');
      }
      ctx.restore();
    });
  }

  function drawEmotionBubble(ctx, bubble, bx, by, member) {
    if (!bubble || bubble.life <= 0) return;
    const progress = 1 - Math.max(0, Math.min(1, bubble.life / (bubble.maxLife || 1.5)));
    const popScale = progress < 0.14 ? 0.65 + (progress / 0.14) * 0.35 : 1.0;
    const floatY = Math.round(by - progress * 8);
    const x = Math.round(bx);
    const fade = bubble.life < 0.25 ? bubble.life / 0.25 : 1;

    ctx.save();
    ctx.globalAlpha = fade;

    if (bubble.kind === 'text' && bubble.text) {
      const vf = CONFIG.VIEWFINDER;
      ctx.font = 'bold 9px "PingFang SC", "Microsoft YaHei", sans-serif';
      const tw = Math.ceil(ctx.measureText(bubble.text).width);
      const bw = Math.max(40, tw + 12);
      const bh = 16;
      const clampedCx = Math.max(vf.x + bw / 2 + 4, Math.min(vf.x + vf.w - bw / 2 - 4, x));
      ctx.translate(Math.round(clampedCx), floatY);
      if (popScale !== 1) {
        ctx.scale(popScale, popScale);
      }
      const left = -Math.round(bw / 2);
      const top = -bh;
      px(ctx, left + 1, top - 1, bw - 2, 1, '#1E1B2E');
      px(ctx, left + 1, top + bh, bw - 2, 1, '#1E1B2E');
      px(ctx, left - 1, top + 1, 1, bh - 2, '#1E1B2E');
      px(ctx, left + bw, top + 1, 1, bh - 2, '#1E1B2E');
      px(ctx, left, top, bw, bh, '#FFFFFF');
      px(ctx, left + 6, top + bh, 4, 2, '#FFFFFF');
      px(ctx, left + 5, top + bh, 1, 2, '#1E1B2E');
      px(ctx, left + 10, top + bh, 1, 1, '#1E1B2E');
      px(ctx, left + 6, top + bh + 2, 3, 1, '#1E1B2E');

      ctx.fillStyle = bubble.color || '#E11D48';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(bubble.text, 0, top + Math.round(bh / 2) + 0.5);
      ctx.restore();
      return;
    }

    ctx.translate(x, floatY);
    if (popScale !== 1) {
      ctx.scale(popScale, popScale);
    }

    const bw = 20;
    const bh = 16;
    const left = -10;
    const top = -16;

    // Pixel speech bubble + outline
    px(ctx, left + 1, top - 1, bw - 2, 1, '#1E1B2E');
    px(ctx, left + 1, top + bh, bw - 2, 1, '#1E1B2E');
    px(ctx, left - 1, top + 1, 1, bh - 2, '#1E1B2E');
    px(ctx, left + bw, top + 1, 1, bh - 2, '#1E1B2E');
    px(ctx, left, top, bw, bh, '#FFFFFF');
    // Bubble tail pointing bottom-left toward idol
    px(ctx, left + 3, top + bh, 4, 2, '#FFFFFF');
    px(ctx, left + 2, top + bh, 1, 2, '#1E1B2E');
    px(ctx, left + 7, top + bh, 1, 1, '#1E1B2E');
    px(ctx, left + 3, top + bh + 2, 3, 1, '#1E1B2E');

    const cx = 0;
    const cy = top + 8;
    const accent = (member && (member.isDarkColor ? '#71717A' : member.color)) || '#EF4444';

    if (bubble.kind === 'heart') {
      drawPixelHeart(ctx, cx, cy, 2, '#FB7185');
    } else if (bubble.kind === 'note') {
      drawPixelNote(ctx, cx, cy, accent);
    } else if (bubble.kind === 'bang') {
      px(ctx, cx - 1, cy - 5, 2, 6, '#EF4444');
      px(ctx, cx - 1, cy + 3, 2, 2, '#EF4444');
    } else if (bubble.kind === 'blush') {
      px(ctx, cx - 6, cy - 2, 1, 4, '#F43F5E');
      px(ctx, cx - 4, cy - 2, 1, 4, '#F43F5E');
      px(ctx, cx - 1, cy - 2, 1, 4, '#F43F5E');
      px(ctx, cx + 1, cy - 2, 1, 4, '#F43F5E');
      px(ctx, cx + 4, cy - 2, 1, 4, '#F43F5E');
      px(ctx, cx + 6, cy - 2, 1, 4, '#F43F5E');
    } else {
      drawPixelStar(ctx, cx, cy, 4, '#F59E0B', '#FEF08A');
      drawPixelStar(ctx, cx + 5, cy - 4, 2, accent, '#FFFFFF');
    }
    ctx.restore();
  }

  function drawCallTrails(ctx, trails, vfRect) {
    if (!Array.isArray(trails) || trails.length === 0) return;
    ctx.save();
    if (vfRect && typeof ctx.beginPath === 'function' && typeof ctx.rect === 'function' && typeof ctx.clip === 'function') {
      ctx.beginPath();
      ctx.rect(vfRect.x, vfRect.y, vfRect.w, vfRect.h);
      ctx.clip();
    }
    trails.forEach((tr) => {
      const lifeRatio = Math.max(0, Math.min(1, tr.life / (tr.maxLife || 1.2)));
      const hist = tr.history || [];
      for (let i = 0; i < hist.length; i += 1) {
        const pt = hist[i];
        const segAlpha = ((i + 1) / (hist.length + 1)) * 0.65 * lifeRatio;
        ctx.fillStyle = tr.color;
        ctx.globalAlpha = segAlpha;
        px(ctx, pt.x - 1, pt.y - 1, 3, 3);
      }
      ctx.globalAlpha = Math.min(1, lifeRatio * 1.15);
      px(ctx, tr.x - 2, tr.y - 2, 5, 5, tr.color);
      px(ctx, tr.x - 1, tr.y - 1, 3, 3, tr.coreColor || '#FFFFFF');
    });
    ctx.restore();
  }

  function drawNewStamp(ctx, outW, blinkAlpha) {
    const bw = 104;
    const bh = 44;
    const bx = outW - bw - 22;
    const by = 22;
    ctx.save();
    ctx.globalAlpha = blinkAlpha != null ? blinkAlpha : 1;
    ctx.imageSmoothingEnabled = false;
    px(ctx, bx, by, bw, bh, '#1E1B2E');
    px(ctx, bx + 4, by + 4, bw - 8, bh - 8, '#EF4444');
    px(ctx, bx + 8, by + 8, bw - 16, 4, '#FEF08A');
    drawBitmapText(ctx, 'NEW!', bx + Math.round(bw / 2), by + 16, 3, '#FFFFFF', 'center', 2);
    ctx.restore();
  }

  // ===== Procedural Background Renderer =====
  function drawBackground(ctx, bgId, member, time) {
    const W = CONFIG.CANVAS_WIDTH;
    const H = CONFIG.CANVAS_HEIGHT;

    if (bgId === 'group-memorial') {
      drawBgGroupMemorial(ctx, W, H, time);
    } else {
      const bgCfg = CONFIG.BACKGROUNDS.find((b) => b.id === bgId) || CONFIG.BACKGROUNDS[0];
      const style = bgCfg.style || bgId;
      if (style === 'rainy_cyber' || bgId === 'rainy_night') {
        drawBgRainyNight(ctx, W, H, member, time, bgCfg);
      } else if (style === 'f1_starlight' || bgId === 'f1_starlight') {
        drawBgF1Starlight(ctx, W, H, member, time, bgCfg);
      } else {
        drawBgCyberLab(ctx, W, H, member, time, bgCfg);
      }
    }

    // Consistent lower deck framing behind rhythm bar / controls
    px(ctx, 0, 274, W, 6, '#090612');
    px(ctx, 0, 280, W, H - 280, '#130f24');
    for (let x = 0; x < W; x += 8) {
      px(ctx, x, 280, 4, 2, '#1e1838');
    }
  }

  function getStageBeamColor(member) {
    return member.isDarkColor ? '#D4D4D8' : member.color;
  }

  function getStageLightColor(member) {
    return member.isDarkColor ? '#F4F4F5' : member.lightColor;
  }

  function drawBgCyberLab(ctx, W, H, member, time, bgCfg) {
    const beamMain = getStageBeamColor(member);
    const beamLight = getStageLightColor(member);

    // Deep cyber-lab backdrop
    px(ctx, 0, 0, W, 276, '#070b18');

    // Subtle hexagonal/square cyber wall grid
    for (let y = 46; y < 252; y += 12) {
      px(ctx, 0, y, W, 1, '#101a36');
    }
    for (let x = 0; x < W; x += 16) {
      px(ctx, x, 46, 1, 204, '#101a36');
    }

    // Left & right glowing laboratory energy columns
    const colBars = [18, W - 26];
    colBars.forEach((cx) => {
      px(ctx, cx, 54, 8, 196, '#0f172a');
      px(ctx, cx + 1, 56, 6, 192, '#1e293b');
      for (let y = 62; y < 242; y += 12) {
        const pulse = Math.sin(time * 4 + y * 0.15) > 0;
        px(ctx, cx + 2, y, 4, 6, pulse ? beamLight : beamMain);
      }
    });

    // Recessed holographic data screen centered behind idol
    const bx = 46;
    const by = 64;
    const bw = 178;
    const bh = 88;
    px(ctx, bx - 3, by - 3, bw + 6, bh + 6, '#040711');
    px(ctx, bx - 1, by - 1, bw + 2, bh + 2, beamMain);
    px(ctx, bx, by, bw, bh, '#0b1328');

    // Scanline stripes on cyber monitor
    for (let sy = by + 4; sy < by + bh - 4; sy += 4) {
      px(ctx, bx + 2, sy, bw - 4, 1, '#111d3a');
    }

    // Header telemetry bars & corner brackets
    px(ctx, bx + 6, by + 6, 16, 2, beamLight);
    px(ctx, bx + bw - 22, by + 6, 16, 2, beamLight);
    px(ctx, bx + 6, by + bh - 8, 22, 2, beamMain);
    px(ctx, bx + bw - 28, by + bh - 8, 22, 2, beamMain);

    // Top & sub cyber texts ("F1owSec LAB" / "TOKUTENKAI")
    const topTxt = (bgCfg && bgCfg.topText) || 'F1owSec LAB';
    const subTxt = (bgCfg && bgCfg.subText) || 'TOKUTENKAI';
    drawBitmapText(ctx, topTxt, 135 + 1, by + 18 + 1, 2, '#040711', 'center', 2);
    drawBitmapText(ctx, topTxt, 135, by + 18, 2, '#FFFFFF', 'center', 2);
    drawBitmapText(ctx, subTxt, 135, by + 40, 2, beamLight, 'center', 2);

    // Animated equalizer / data bars along bottom of cyber monitor
    for (let i = 0; i < 14; i += 1) {
      const barH = 4 + Math.round((Math.sin(time * 5.2 + i * 0.7) * 0.5 + 0.5) * 12);
      const barX = bx + 28 + i * 9;
      px(ctx, barX, by + bh - 12 - barH, 5, barH, i % 2 === 0 ? beamMain : beamLight);
    }

    // Clean indoor photo-booth floor & baseboard (no spotlights/trusses)
    px(ctx, 0, 248, W, 28, '#131932');
    px(ctx, 0, 248, W, 2, beamLight);
    for (let x = 20; x < W - 20; x += 22) {
      px(ctx, x, 250, 2, 24, '#1b294d');
    }

    // Soft pastel wall ambient dots on indoor check-in wall
    for (let i = 0; i < 10; i += 1) {
      const sx = 48 + ((i * 33) % 174);
      const sy = 158 + ((i * 23) % 82);
      if (Math.sin(time * 2.5 + i * 1.4) > 0.2) {
        px(ctx, sx, sy, 2, 2, i % 2 === 0 ? '#E2E8F0' : beamLight);
      }
    }
  }

  function drawBgRainyNight(ctx, W, H, member, time, bgCfg) {
    const beamMain = getStageBeamColor(member);
    const beamLight = getStageLightColor(member);

    // Deep blue cyber rainy night sky bands
    const skyBands = ['#040817', '#071029', '#0b183b', '#10214f', '#152b63'];
    const bandH = 42;
    for (let i = 0; i < skyBands.length; i += 1) {
      const y = i * bandH + 34;
      px(ctx, 0, y, W, bandH, skyBands[i]);
      if (i < skyBands.length - 1) {
        for (let x = 0; x < W; x += 4) {
          px(ctx, x, y + bandH - 2, 2, 2, skyBands[i + 1]);
          px(ctx, x + 2, y + bandH - 4, 2, 2, skyBands[i + 1]);
        }
      }
    }
    px(ctx, 0, 0, W, 34, skyBands[0]);

    // Soft cyan & oshi-colored cyber neon halos behind skyline
    ctx.save();
    ctx.fillStyle = hexToRgba('#38BDF8', 0.14);
    ctx.fillRect(36, 76, 84, 72);
    ctx.fillStyle = hexToRgba(beamMain, 0.18);
    ctx.fillRect(142, 68, 92, 82);
    ctx.fillStyle = hexToRgba(beamLight, 0.14);
    ctx.fillRect(72, 134, 126, 48);
    ctx.restore();

    // Distant cyber skyline silhouettes with glowing pixel windows
    const buildings = [
      [16, 130, 34, 118, '#08122b'],
      [52, 114, 30, 134, '#0b1736'],
      [188, 118, 32, 130, '#0a1532'],
      [222, 134, 34, 114, '#08122b']
    ];
    buildings.forEach(([bx0, by0, bw0, bh0, col], bIdx) => {
      px(ctx, bx0, by0, bw0, bh0, col);
      px(ctx, bx0, by0, bw0, 2, bIdx % 2 === 0 ? '#38BDF8' : beamMain);
      for (let wy = by0 + 10; wy < 238; wy += 10) {
        for (let wx = bx0 + 5; wx < bx0 + bw0 - 6; wx += 7) {
          const lit = ((wx + wy + bIdx * 5) % 4) !== 0;
          if (lit) {
            px(ctx, wx, wy, 3, 4, (wx + wy) % 3 === 0 ? '#7DD3FC' : beamLight);
          }
        }
      }
    });

    // Centered cyber neon signboard ("FLOW ONE SEC" / "RAINY MOMENT")
    const bx = 46;
    const by = 66;
    const bw = 178;
    const bh = 74;
    px(ctx, bx - 3, by - 3, bw + 6, bh + 6, '#040814');
    px(ctx, bx - 1, by - 1, bw + 2, bh + 2, '#38BDF8');
    px(ctx, bx, by, bw, bh, '#091228');

    // Inner neon trim
    px(ctx, bx + 4, by + 4, bw - 8, 2, beamMain);
    px(ctx, bx + 4, by + bh - 6, bw - 8, 2, beamLight);

    const topTxt = (bgCfg && bgCfg.topText) || 'FLOW ONE SEC';
    const subTxt = (bgCfg && bgCfg.subText) || 'RAINY MOMENT';
    const pulse = Math.sin(time * 4.2) > 0 ? '#E0F2FE' : '#7DD3FC';
    drawBitmapText(ctx, topTxt, 135 + 1, by + 16 + 1, 2, '#030712', 'center', 2);
    drawBitmapText(ctx, topTxt, 135, by + 16, 2, pulse, 'center', 2);
    drawBitmapText(ctx, subTxt, 135 + 1, by + 42 + 1, 2, '#030712', 'center', 2);
    drawBitmapText(ctx, subTxt, 135, by + 42, 2, beamLight, 'center', 2);

    // Wet neon-reflective cyber stage floor
    px(ctx, 0, 246, W, 30, '#070f24');
    px(ctx, 0, 246, W, 2, '#38BDF8');
    for (let x = 28; x < W - 28; x += 26) {
      const shimmer = Math.sin(time * 4 + x * 0.1) > 0;
      px(ctx, x, 252, 14, 2, shimmer ? hexToRgba(beamLight, 0.55) : '#1d3461');
      px(ctx, x + 4, 260, 10, 2, shimmer ? '#38BDF8' : '#16284d');
    }

    // Animated puddle ripples on wet floor
    for (let i = 0; i < 4; i += 1) {
      const p = (time * 0.9 + i * 0.25) % 1;
      const rx = 56 + i * 52;
      const rw = Math.round(6 + p * 14);
      px(ctx, rx - rw / 2, 255 + (i % 2) * 8, rw, 2, p < 0.7 ? '#7DD3FC' : beamLight);
    }

    // Dynamic slanted falling pixel raindrops (2 parallax layers)
    for (let i = 0; i < 36; i += 1) {
      const isFast = i % 2 === 0;
      const speedY = isFast ? 145 : 98;
      const speedX = isFast ? -26 : -16;
      const baseX = (i * 29) % W;
      const baseY = (i * 43) % 210;
      const ry = 46 + ((baseY + Math.floor(time * speedY)) % 202);
      const rx = ((baseX + Math.floor(time * speedX)) % W + W) % W;
      const dropCol = isFast ? (i % 6 === 0 ? beamLight : '#BAE6FD') : '#38BDF8';
      px(ctx, rx, ry, 1, 4, dropCol);
      px(ctx, rx - 1, ry + 4, 1, 4, dropCol);
      if (isFast) {
        px(ctx, rx - 2, ry + 8, 1, 3, '#E0F2FE');
      }
    }
  }

  function drawBgF1Starlight(ctx, W, H, member, time, bgCfg) {
    const beamMain = getStageBeamColor(member);
    const beamLight = getStageLightColor(member);

    // Deep starry sky gradient bands
    const bands = ['#070718', '#0d102a', '#14193f', '#1d2456', '#262f6e', '#2f3982'];
    const bandH = 38;
    for (let i = 0; i < bands.length; i += 1) {
      const y = i * bandH + 34;
      px(ctx, 0, y, W, bandH, bands[i]);
      if (i < bands.length - 1) {
        for (let x = 0; x < W; x += 4) {
          px(ctx, x, y + bandH - 2, 2, 2, bands[i + 1]);
          px(ctx, x + 2, y + bandH - 4, 2, 2, bands[i + 1]);
        }
      }
    }
    px(ctx, 0, 0, W, 34, bands[0]);

    // Soft pastel check-in wall stripes & top banner border (no spotlight cones)
    px(ctx, 0, 56, W, 2, hexToRgba(beamLight, 0.35));
    for (let x = 22; x < W - 22; x += 28) {
      px(ctx, x, 58, 1, 178, 'rgba(255, 255, 255, 0.05)');
    }

    // Top & bottom black-and-white pixel checkered decor trims
    const cell = 6;
    const topFlagY = 72;
    const botFlagY = 234;
    px(ctx, 0, topFlagY - 1, W, cell * 2 + 2, '#090612');
    px(ctx, 0, botFlagY - 1, W, cell * 2 + 2, '#090612');
    for (let x = 0; x < W; x += cell) {
      const idx = Math.floor(x / cell);
      px(ctx, x, topFlagY, cell, cell, idx % 2 === 0 ? '#FFFFFF' : '#18181B');
      px(ctx, x, topFlagY + cell, cell, cell, idx % 2 === 0 ? '#18181B' : '#FFFFFF');
      px(ctx, x, botFlagY, cell, cell, idx % 2 === 0 ? '#18181B' : '#FFFFFF');
      px(ctx, x, botFlagY + cell, cell, cell, idx % 2 === 0 ? '#FFFFFF' : '#18181B');
    }
    px(ctx, 0, topFlagY + cell * 2 + 1, W, 2, beamMain);
    px(ctx, 0, botFlagY - 3, W, 2, beamLight);

    // Header text ("F1owSec CLUB" / "TOKUTENKAI") under top checkered strip
    const topTxt = (bgCfg && bgCfg.topText) || 'F1owSec CLUB';
    const subTxt = (bgCfg && bgCfg.subText) || 'TOKUTENKAI';
    drawBitmapText(ctx, topTxt, 135 + 1, 90 + 1, 2, '#070718', 'center', 2);
    drawBitmapText(ctx, topTxt, 135, 90, 2, '#FEF08A', 'center', 2);
    drawBitmapText(ctx, subTxt, 135 + 1, 110 + 1, 2, '#070718', 'center', 2);
    drawBitmapText(ctx, subTxt, 135, 110, 2, beamLight, 'center', 2);

    // Twinkling pixel stars
    const starCoords = [
      [48, 92], [220, 92], [58, 134], [212, 130],
      [76, 158], [194, 156], [46, 196], [222, 192]
    ];
    starCoords.forEach(([sx, sy], idx) => {
      const pulse = Math.sin(time * 3.6 + idx * 1.5);
      if (pulse > 0.3) {
        drawPixelStar(ctx, sx, sy, 2, '#FFFFFF', '#FEF08A');
      } else if (pulse > -0.4) {
        px(ctx, sx, sy, 2, 2, idx % 2 === 0 ? '#E2E8F0' : beamLight);
      }
    });

    // Periodic diagonal shooting star
    const shootCycle = time % 4.2;
    if (shootCycle < 0.7) {
      const p = shootCycle / 0.7;
      const ssx = Math.round(52 + p * 124);
      const ssy = Math.round(92 + p * 54);
      px(ctx, ssx - 8, ssy - 4, 4, 2, beamLight);
      px(ctx, ssx - 4, ssy - 2, 4, 2, '#FEF08A');
      px(ctx, ssx, ssy, 3, 3, '#FFFFFF');
    }

    // Lower deck below checkered flag
    px(ctx, 0, 247, W, 29, '#10122b');
    for (let x = 24; x < W - 24; x += 18) {
      const glow = Math.sin(time * 5 + x * 0.2) > 0;
      px(ctx, x, 256, 6, 3, glow ? '#FACC15' : beamMain);
    }
  }

  function drawBgGroupMemorial(ctx, W, H, time) {
    // Royal starlight memorial gradient
    const bands = ['#0a061c', '#130c30', '#1c1447', '#271b5e', '#322375'];
    const bandH = 44;
    for (let i = 0; i < bands.length; i += 1) {
      const y = i * bandH + 40;
      px(ctx, 0, y, W, bandH, bands[i]);
      if (i < bands.length - 1) {
        for (let x = 0; x < W; x += 4) {
          px(ctx, x, y + bandH - 2, 2, 2, bands[i + 1]);
          px(ctx, x + 2, y + bandH - 4, 2, 2, bands[i + 1]);
        }
      }
    }
    px(ctx, 0, 0, W, 40, bands[0]);

    // Soft 5-color indoor tokutenkai bunting & wall frame (no spotlight cones)
    const beamPalette = CONFIG.MEMBERS.map((m) => (m.isDarkColor ? '#A1A1AA' : m.color));
    beamPalette.forEach((col, idx) => {
      const bx = 26 + idx * 46;
      px(ctx, bx, 64, 34, 3, col);
      px(ctx, bx + 4, 67, 26, 2, 'rgba(255, 255, 255, 0.35)');
    });
    for (let x = 28; x < W - 28; x += 36) {
      px(ctx, x, 72, 1, 164, 'rgba(255, 255, 255, 0.05)');
    }

    // Subtle memorial banner text in sky (ASCII-safe bitmap font)
    const title = (CONFIG.GROUP_CONFIG && CONFIG.GROUP_CONFIG.groupPhotoSub) || 'FLOW ONE SEC';
    drawBitmapText(ctx, title, 135, 80, 1, 'rgba(254, 240, 138, 0.72)', 'center', 2);

    // Sparkling stars & floating golden confetti
    for (let i = 0; i < 18; i += 1) {
      const sx = 20 + ((i * 37 + Math.floor(time * 8)) % 230);
      const sy = 68 + ((i * 29 + Math.floor(time * 14)) % 174);
      const col = i % 3 === 0 ? '#FEF08A' : beamPalette[i % beamPalette.length];
      if (i % 4 === 0) {
        drawPixelStar(ctx, sx, sy, 2, col, '#FFFFFF');
      } else {
        px(ctx, sx, sy, 2, 2, col);
      }
    }

    // Starlight stage deck with 5-color rim lights
    px(ctx, 0, 236, W, 40, '#161133');
    px(ctx, 0, 236, W, 2, '#FACC15');
    for (let x = 16; x < W - 16; x += 10) {
      const c = beamPalette[(x / 10) % beamPalette.length];
      px(ctx, x, 234, 4, 3, Math.sin(time * 5 + x * 0.1) > 0 ? '#FFFFFF' : c);
    }
  }

  function drawGroupStarlightSea(ctx, time, vf) {
    if (!vf) return;
    const palette = CONFIG.MEMBERS.map((m) => (m.isDarkColor ? '#E4E4E7' : m.color));

    ctx.save();
    if (typeof ctx.beginPath === 'function' && typeof ctx.rect === 'function' && typeof ctx.clip === 'function') {
      ctx.beginPath();
      ctx.rect(vf.x, vf.y, vf.w, vf.h);
      ctx.clip();
    }

    // 5-member oshi vertical glow columns
    const colW = Math.round(vf.w / 5);
    palette.forEach((col, idx) => {
      const pulse = 0.08 + 0.05 * Math.sin(time * 2.2 + idx * 1.15);
      const bx = vf.x + idx * colW;
      ctx.fillStyle = hexToRgba(col, pulse);
      ctx.fillRect(bx, vf.y, colW, vf.h);
    });

    // Soft golden & oshi-tinted horizon shimmer near floor
    const horizonH = 38;
    ctx.fillStyle = 'rgba(250, 204, 21, 0.09)';
    ctx.fillRect(vf.x, vf.y + vf.h - horizonH, vf.w, horizonH);

    // 28 twinkling 5-color + golden pixel stars across backdrop
    for (let i = 0; i < 28; i += 1) {
      const col = i % 5 === 4 ? '#FEF08A' : palette[i % palette.length];
      const sx = Math.round(vf.x + 8 + ((i * 37 + Math.sin(time * 0.7 + i) * 4) % Math.max(1, vf.w - 16)));
      const sy = Math.round(vf.y + 12 + ((i * 29 + Math.floor(time * (6 + (i % 4) * 2))) % Math.max(1, vf.h - 24)));
      const twinkle = 0.45 + 0.55 * Math.abs(Math.sin(time * 3.1 + i * 0.9));
      ctx.save();
      ctx.globalAlpha = twinkle;
      if (i % 3 === 0) {
        drawPixelStar(ctx, sx, sy, 3, col, '#FFFFFF');
      } else {
        drawPixelStar(ctx, sx, sy, 2, col, '#FFFFFF');
      }
      ctx.restore();
    }

    ctx.restore();
  }

  function getSpriteSize(sprite) {
    if (!sprite) return null;
    if (typeof sprite.naturalWidth === 'number') {
      if (sprite.complete === false || sprite.naturalWidth <= 0 || sprite.naturalHeight <= 0) {
        return null;
      }
      return { w: sprite.naturalWidth, h: sprite.naturalHeight };
    }
    const w = sprite.width || 0;
    const h = sprite.height || 0;
    return w > 0 && h > 0 ? { w, h } : null;
  }

  // ===== Procedural / Sprite Full-Body Idol Renderer =====
  function drawIdol(ctx, member, time, state, options) {
    const opts = options || {};
    const spriteImg = opts.spriteImg || null;
    const vf = CONFIG.VIEWFINDER;
    const spriteSize = getSpriteSize(spriteImg);
    const poseSnap = opts.poseSnapshot || null;
    const tr = poseSnap ? poseSnap.transform : {
      swayX: opts.staticPose ? 0 : Math.round(Math.sin(time * 1.55) * 2),
      bobY: opts.staticPose ? 0 : Math.round(Math.sin(time * 2.9) * 1.5),
      jumpY: 0,
      scaleX: 1,
      scaleY: 1,
      rotateRad: 0,
      shadowScale: 1,
      showBlush: false,
      shineProgress: -1
    };

    if (spriteSize) {
      const ns = opts.nativeScale != null ? opts.nativeScale : STAGE_SCALE;
      const scaleMult = (member.scale != null ? member.scale : 1.0) * (opts.extraScale != null ? opts.extraScale : 1.0);
      const offsetY = member.offsetY != null ? member.offsetY : 0;
      const logicalMaxW = (opts.maxW || vf.w - 20) * scaleMult;
      const logicalMaxH = (opts.maxH || vf.h - 24) * scaleMult;
      const nativeMaxW = Math.max(1, Math.round(logicalMaxW * ns));
      const nativeMaxH = Math.max(1, Math.round(logicalMaxH * ns));
      const ratio = Math.min(nativeMaxW / spriteSize.w, nativeMaxH / spriteSize.h);
      const dw = Math.max(1, Math.round(spriteSize.w * ratio));
      const dh = Math.max(1, Math.round(spriteSize.h * ratio));
      const logicalDw = dw / ns;

      const targetCx = opts.cx != null ? opts.cx : vf.x + vf.w / 2;
      const groundY = opts.bottomY != null ? opts.bottomY : vf.y + vf.h - 10;
      const logicalFootCx = targetCx + (opts.staticPose ? 0 : tr.swayX);
      const logicalFootY = groundY + (opts.staticPose ? 0 : tr.bobY) + tr.jumpY + offsetY;
      const flipScaleX = (opts.flipX ? -1 : 1) * tr.scaleX;
      const scaleY = tr.scaleY != null ? tr.scaleY : 1;

      ctx.save();
      if (opts.alpha != null) {
        ctx.globalAlpha *= opts.alpha;
      }
      ctx.imageSmoothingEnabled = false;
      if (!opts.skipClip && typeof ctx.beginPath === 'function' && typeof ctx.rect === 'function' && typeof ctx.clip === 'function') {
        const clipRect = opts.clipRect || vf;
        ctx.beginPath();
        ctx.rect(clipRect.x, clipRect.y, clipRect.w, clipRect.h);
        ctx.clip();
      }

      if (!opts.skipShadow) {
        const shadowW = Math.max(10, Math.round(logicalDw * 0.28 * tr.shadowScale));
        const shadowH = Math.max(3, Math.round(4 * tr.shadowScale));
        drawPixelShadow(ctx, Math.round(logicalFootCx), Math.round(groundY + 1), shadowW, shadowH, 0.42 * tr.shadowScale);
      }

      ctx.save();
      ctx.scale(1 / ns, 1 / ns);
      const footCx = Math.round(logicalFootCx * ns);
      const footY = Math.round(logicalFootY * ns);
      ctx.translate(footCx, footY);
      if (flipScaleX !== 1 || scaleY !== 1) {
        ctx.scale(flipScaleX, scaleY);
      }
      if (tr.rotateRad) {
        ctx.rotate(tr.rotateRad);
      }

      const drawX = -Math.round(dw / 2);
      const drawY = -dh;
      ctx.drawImage(spriteImg, drawX, drawY, dw, dh);

      // Soft pixel blush on cheeks during SR "shy" pose or 夸夸
      if (tr.showBlush) {
        const blushY = -Math.round(dh * 0.78);
        const blushOffsetX = Math.max(3 * ns, Math.round(dw * 0.045));
        ctx.fillStyle = 'rgba(251, 113, 133, 0.62)';
        ctx.fillRect(-blushOffsetX - 2 * ns, blushY, 3 * ns, 2 * ns);
        ctx.fillRect(blushOffsetX - ns, blushY, 3 * ns, 2 * ns);
      }

      // Hair / accessory micro pixel glint every 3~5s
      if (opts.glint && opts.glint.active && !opts.skipGlint) {
        const gx = Math.round(opts.glint.rx * dw);
        const gy = Math.round(opts.glint.ry * dh);
        const glintAlpha = Math.sin(opts.glint.progress * Math.PI);
        if (glintAlpha > 0.08) {
          ctx.save();
          ctx.globalAlpha *= glintAlpha;
          ctx.fillStyle = '#FFFFFF';
          const u = Math.max(2, ns * 2);
          ctx.fillRect(gx - u * 2, gy, u * 5, u);
          ctx.fillRect(gx, gy - u * 2, u, u * 5);
          ctx.restore();
        }
      }

      // Diagonal stage highlight sweep during SR "mirror" pose
      if (tr.shineProgress >= 0) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(drawX, drawY, dw, dh);
        ctx.clip();
        const sweepX = Math.round(drawX - 24 * ns + tr.shineProgress * (dw + 48 * ns));
        ctx.fillStyle = 'rgba(255, 255, 255, 0.26)';
        const stepRow = Math.max(2, ns * 2);
        for (let row = 0; row < dh; row += stepRow) {
          const sx = Math.round(sweepX + row * 0.28);
          ctx.fillRect(sx, drawY + row, 7 * ns, stepRow);
        }
        ctx.restore();
      }

      ctx.restore();
      ctx.restore();
      return;
    }

    const u = opts.pixelSize || 2;
    const isStatic = Boolean(opts.staticPose);
    const swayX = isStatic ? 0 : tr.swayX;
    const bobY = isStatic ? 0 : Math.round(tr.bobY + tr.jumpY);
    const hairLagX = isStatic ? 0 : Math.round(-Math.sin(time * 1.55 - 0.5) * 1.4) * u;

    // Blink logic (~every 3.2s)
    let isBlinking = false;
    if (!isStatic) {
      const blinkCycle = time % 3.2;
      isBlinking = (blinkCycle > 2.95 && blinkCycle < 3.09);
    }

    const baseCx = Math.round(opts.cx != null ? opts.cx : vf.x + vf.w / 2) + swayX;
    const groundY = Math.round(opts.bottomY != null ? opts.bottomY : vf.y + vf.h - 10);
    const baseCy = Math.round(opts.cy != null ? opts.cy : groundY - 44 * u);
    const cx = baseCx;
    const cy = baseCy + bobY;

    if (!opts.skipShadow && !opts.headOnly) {
      drawPixelShadow(ctx, baseCx, groundY + 1, 14 * u * tr.shadowScale, 3 * tr.shadowScale, 0.36 * tr.shadowScale);
    }

    ctx.save();
    const fallbackFlipScaleX = (opts.flipX ? -1 : 1) * tr.scaleX;
    if (fallbackFlipScaleX !== 1 || tr.rotateRad) {
      const pivotY = groundY + bobY;
      ctx.translate(cx, pivotY);
      if (fallbackFlipScaleX !== 1) ctx.scale(fallbackFlipScaleX, 1);
      if (tr.rotateRad) ctx.rotate(tr.rotateRad);
      ctx.translate(-cx, -pivotY);
    }

    const INK = '#231934';
    const SKIN = '#FFE5D4';
    const SKIN_SHADE = '#F7C4A8';
    const BLUSH = '#FF99B9';

    function gRect(gx, gy, gw, gh, color) {
      px(ctx, cx + gx * u, cy + gy * u, gw * u, gh * u, color);
    }

    function gRectLag(gx, gy, gw, gh, color) {
      px(ctx, cx + hairLagX + gx * u, cy + gy * u, gw * u, gh * u, color);
    }

    // 1. Back Hair Silhouette (per member hairStyle)
    drawBackHair(gRectLag, member);

    // 2. Neck & Stage Outfit (Bust / Shoulders)
    if (!opts.headOnly) {
      // Neck
      gRect(-3, 9, 6, 6, INK);
      gRect(-2, 9, 4, 5, SKIN_SHADE);

      // Shoulders & Puff Sleeves
      gRect(-19, 14, 38, 30, INK);
      gRect(-18, 15, 36, 28, member.color);

      // Left highlight & right shading on dress bodice
      gRect(-17, 16, 6, 26, member.lightColor);
      gRect(11, 16, 6, 26, member.darkColor);

      // Puff sleeve frills
      gRect(-18, 16, 7, 10, member.dressTrim);
      gRect(11, 16, 7, 10, member.dressTrim);
      gRect(-17, 25, 6, 2, member.darkColor);
      gRect(11, 25, 6, 2, member.darkColor);

      // White Sailor / Idol Collar
      gRect(-11, 14, 22, 9, INK);
      gRect(-10, 14, 20, 8, member.dressTrim);
      gRect(-8, 15, 16, 2, '#E2E8F0');
      // Collar notch
      gRect(-4, 15, 8, 5, member.color);
      gRect(-3, 15, 6, 3, SKIN);

      // Center Chest Ribbon Bow & Gem
      gRect(-7, 21, 14, 6, INK);
      gRect(-6, 22, 5, 4, member.darkColor);
      gRect(1, 22, 5, 4, member.darkColor);
      gRect(-2, 22, 4, 4, '#FACC15');
      gRect(-1, 23, 2, 2, '#FFFFFF');
      // Ribbon tails
      gRect(-4, 27, 3, 6, member.darkColor);
      gRect(1, 27, 3, 6, member.darkColor);

      // Gold Stage Buttons
      gRect(-1, 35, 2, 2, '#FACC15');
      gRect(-1, 40, 2, 2, '#FACC15');

      // Cute Raised Idol Hand Pose
      drawIdolPose(gRect, member, SKIN, SKIN_SHADE, INK, time, isStatic);
    }

    // 3. Ears & Head Contour
    gRect(-14, -4, 3, 6, INK);
    gRect(11, -4, 3, 6, INK);
    gRect(-13, -3, 2, 4, SKIN_SHADE);
    gRect(11, -3, 2, 4, SKIN_SHADE);

    // Head base outline & skin
    gRect(-12, -16, 24, 26, INK);
    gRect(-13, -12, 26, 20, INK);
    gRect(-11, -15, 22, 24, SKIN);
    gRect(-12, -11, 24, 18, SKIN);
    // Chin shadow
    gRect(-8, 7, 16, 2, SKIN_SHADE);
    // Soft cheek blush
    gRect(-10, 1, 4, 2, BLUSH);
    gRect(6, 1, 4, 2, BLUSH);

    // 4. Expressive Anime Pixel Eyes
    if (isBlinking) {
      gRect(-9, -3, 5, 1, INK);
      gRect(-10, -4, 1, 1, INK);
      gRect(4, -3, 5, 1, INK);
      gRect(9, -4, 1, 1, INK);
    } else {
      // Left eye
      gRect(-9, -6, 5, 1, INK);
      gRect(-9, -5, 5, 5, '#FFFFFF');
      gRect(-8, -5, 3, 5, member.eyeColor);
      gRect(-7, -3, 2, 2, INK);
      gRect(-8, -5, 1, 2, '#FFFFFF');
      gRect(-6, -1, 1, 1, member.lightColor);

      // Right eye
      gRect(4, -6, 5, 1, INK);
      gRect(4, -5, 5, 5, '#FFFFFF');
      gRect(5, -5, 3, 5, member.eyeColor);
      gRect(5, -3, 2, 2, INK);
      gRect(5, -5, 1, 2, '#FFFFFF');
      gRect(7, -1, 1, 1, member.lightColor);
    }

    // 5. Smile Variant
    if (member.smileType === 'cat') {
      gRect(-3, 4, 2, 1, INK);
      gRect(-1, 5, 2, 1, INK);
      gRect(1, 4, 2, 1, INK);
    } else if (member.smileType === 'open') {
      gRect(-3, 4, 6, 1, INK);
      gRect(-2, 5, 4, 2, '#FB7185');
      gRect(-2, 4, 4, 1, '#FFFFFF');
    } else if (member.smileType === 'gentle') {
      gRect(-2, 4, 4, 1, INK);
      gRect(-3, 3, 1, 1, INK);
      gRect(2, 3, 1, 1, INK);
    } else {
      gRect(-3, 4, 1, 1, INK);
      gRect(-2, 5, 4, 1, INK);
      gRect(2, 4, 1, 1, INK);
    }

    // 6. Front Hair, Side Locks & Specular Shine
    // Top hair crown
    gRect(-13, -19, 26, 9, INK);
    gRect(-11, -21, 22, 3, INK);
    gRect(-12, -18, 24, 8, member.hairBase);
    gRect(-10, -20, 20, 3, member.hairBase);

    // Glossy anime hair highlight band
    gRect(-8, -16, 5, 2, member.hairLight);
    gRect(-1, -16, 4, 2, member.hairLight);
    gRect(5, -16, 4, 2, member.hairLight);

    // Bangs strands
    gRect(-11, -11, 4, 5, member.hairBase);
    gRect(-6, -11, 3, 4, member.hairBase);
    gRect(-2, -11, 4, 5, member.hairBase);
    gRect(3, -11, 3, 4, member.hairBase);
    gRect(7, -11, 4, 5, member.hairBase);
    // Bang tips shadow
    gRect(-10, -7, 2, 1, member.hairDark);
    gRect(-1, -7, 2, 1, member.hairDark);
    gRect(8, -7, 2, 1, member.hairDark);

    // Framing side locks
    gRect(-14, -12, 3, 18, INK);
    gRect(-13, -11, 2, 16, member.hairBase);
    gRect(-13, 2, 2, 3, member.hairDark);
    gRect(11, -12, 3, 18, INK);
    gRect(11, -11, 2, 16, member.hairBase);
    gRect(11, 2, 2, 3, member.hairDark);

    // 7. Signature Hair Accessory & Pose Blush
    drawHairAccessory(gRect, member, INK);

    if (tr.showBlush) {
      gRect(-10, 2, 4, 2, '#FB7185');
      gRect(6, 2, 4, 2, '#FB7185');
    }
    ctx.restore();
  }

  function drawBackHair(gRectLag, member) {
    const INK = '#231934';
    const base = member.hairBase;
    const dark = member.hairDark;
    const light = member.hairLight;

    if (member.hairStyle === 'twintails') {
      // Twin fluffy tails
      gRectLag(-22, -10, 8, 30, INK);
      gRectLag(-21, -9, 6, 28, dark);
      gRectLag(-20, -7, 4, 22, base);
      gRectLag(-19, -4, 2, 6, light);

      gRectLag(14, -10, 8, 30, INK);
      gRectLag(15, -9, 6, 28, dark);
      gRectLag(16, -7, 4, 22, base);
      gRectLag(17, -4, 2, 6, light);
    } else if (member.hairStyle === 'ponytail') {
      // Energetic high side ponytail
      gRectLag(10, -18, 12, 32, INK);
      gRectLag(11, -17, 10, 29, dark);
      gRectLag(12, -15, 7, 24, base);
      gRectLag(14, -12, 3, 8, light);
      gRectLag(-15, -10, 30, 20, INK);
      gRectLag(-14, -9, 28, 18, dark);
    } else if (member.hairStyle === 'long') {
      // Flowing long locks
      gRectLag(-17, -11, 34, 48, INK);
      gRectLag(-16, -10, 32, 45, dark);
      gRectLag(-15, -8, 30, 38, base);
      gRectLag(-14, 14, 3, 12, light);
      gRectLag(11, 14, 3, 12, light);
    } else if (member.hairStyle === 'wavy') {
      // Wavy fluffy bob-long
      gRectLag(-19, -10, 38, 34, INK);
      gRectLag(-18, -9, 36, 31, dark);
      gRectLag(-16, -7, 32, 27, base);
      gRectLag(-20, 10, 5, 10, base);
      gRectLag(15, 10, 5, 10, base);
    } else {
      // Cute bob-ribbon silhouette
      gRectLag(-17, -11, 34, 27, INK);
      gRectLag(-16, -10, 32, 25, dark);
      gRectLag(-15, -8, 30, 21, base);
      gRectLag(-18, 6, 4, 8, base);
      gRectLag(14, 6, 4, 8, base);
    }
  }

  function drawHairAccessory(gRect, member, INK) {
    if (member.accessory === 'star') {
      // Golden star clip on left temple
      gRect(-11, -15, 5, 5, INK);
      gRect(-10, -14, 3, 3, '#FACC15');
      gRect(-9, -15, 1, 5, '#FEF08A');
      gRect(-11, -13, 5, 1, '#FEF08A');
    } else if (member.accessory === 'bows') {
      // Twin pink/white ribbons on twintail ties
      gRect(-16, -12, 5, 4, INK);
      gRect(-15, -11, 3, 2, '#FFFFFF');
      gRect(11, -12, 5, 4, INK);
      gRect(12, -11, 3, 2, '#FFFFFF');
    } else if (member.accessory === 'crown') {
      // Mini golden tiara
      gRect(-5, -24, 10, 4, INK);
      gRect(-4, -23, 2, 2, '#FACC15');
      gRect(-1, -24, 2, 3, '#FEF08A');
      gRect(2, -23, 2, 2, '#FACC15');
      gRect(-4, -21, 8, 1, '#D97706');
    } else if (member.accessory === 'moon') {
      // Crescent moon hair clip
      gRect(7, -16, 5, 6, INK);
      gRect(8, -15, 3, 4, '#FEF08A');
      gRect(9, -14, 2, 2, member.hairBase);
    } else if (member.accessory === 'beret') {
      // Cute tilted mint beret
      gRect(-9, -24, 15, 5, INK);
      gRect(-8, -23, 13, 3, member.lightColor);
      gRect(-5, -22, 6, 2, '#FFFFFF');
      gRect(-2, -25, 2, 1, INK);
    }
  }

  function drawIdolPose(gRect, member, SKIN, SKIN_SHADE, INK, time, isStatic) {
    const bounce = isStatic ? 0 : Math.round(Math.sin(time * 2.9));
    if (member.pose === 'peace') {
      // Cute V-sign near right cheek
      gRect(12, 3 + bounce, 6, 11, INK);
      gRect(13, 4 + bounce, 4, 9, SKIN);
      gRect(12, -1 + bounce, 2, 5, INK);
      gRect(16, -1 + bounce, 2, 5, INK);
      gRect(13, 0 + bounce, 1, 4, SKIN);
      gRect(16, 0 + bounce, 1, 4, SKIN);
      gRect(13, 12 + bounce, 4, 2, member.dressTrim);
    } else if (member.pose === 'heart') {
      // Cute raised heart-cheek hand
      gRect(-18, 4 + bounce, 6, 9, INK);
      gRect(-17, 5 + bounce, 4, 7, SKIN);
      gRect(-15, 4 + bounce, 3, 3, '#FB7185');
      gRect(12, 4 + bounce, 6, 9, INK);
      gRect(13, 5 + bounce, 4, 7, SKIN);
      gRect(12, 4 + bounce, 3, 3, '#FB7185');
    } else if (member.pose === 'mic') {
      // Handheld idol microphone
      gRect(-16, 8 + bounce, 6, 14, INK);
      gRect(-15, 9 + bounce, 4, 12, '#475569');
      gRect(-17, 2 + bounce, 8, 7, INK);
      gRect(-16, 3 + bounce, 6, 5, '#E2E8F0');
      gRect(-15, 4 + bounce, 2, 2, '#FFFFFF');
      gRect(-15, 13 + bounce, 4, 5, SKIN);
    } else {
      // Cheerful wave hand
      gRect(-19, 2 + bounce, 6, 10, INK);
      gRect(-18, 3 + bounce, 4, 8, SKIN);
      gRect(-18, 10 + bounce, 4, 2, member.dressTrim);
      gRect(-17, 5 + bounce, 1, 2, SKIN_SHADE);
    }
  }

  function createDefaultGroupItems() {
    // 540×960 团切默认七分身/半身大合照构图（数组从后往前代表叠放层级）
    return [
      { memberId: 'member_4', x: 92, y: 294, scale: 0.96, flipX: false, spriteSlot: 'main' },
      { memberId: 'member_5', x: 178, y: 294, scale: 0.96, flipX: false, spriteSlot: 'main' },
      { memberId: 'member_2', x: 54, y: 314, scale: 1.02, flipX: false, spriteSlot: 'main' },
      { memberId: 'member_3', x: 216, y: 314, scale: 1.02, flipX: false, spriteSlot: 'main' },
      { memberId: 'member_1', x: 135, y: 320, scale: 1.06, flipX: false, spriteSlot: 'main' }
    ];
  }

  function getGroupItemRect(item, spriteImg, member) {
    const scaleMult = ((member && member.scale != null) ? member.scale : 1.0) * (item.scale || 1.0);
    const maxW = 172 * scaleMult;
    const maxH = 230 * scaleMult;
    const size = getSpriteSize(spriteImg);
    let logicalDw = 80 * scaleMult;
    let logicalDh = 128 * scaleMult;
    if (size) {
      const ratio = Math.min(maxW / size.w, maxH / size.h);
      logicalDw = size.w * ratio;
      logicalDh = size.h * ratio;
    }
    const bodyW = Math.max(32, Math.round(logicalDw * 0.56));
    const bodyH = Math.round(logicalDh * 0.96);
    return {
      x: item.x - bodyW / 2,
      y: item.y - bodyH,
      w: bodyW,
      h: bodyH
    };
  }

  function drawGroupIdols(ctx, time, mode, options) {
    const vf = CONFIG.GROUP_VIEWFINDER;
    const opts = options || {};
    const items = Array.isArray(opts.groupItems) && opts.groupItems.length > 0
      ? opts.groupItems
      : createDefaultGroupItems();
    const getSpriteFn = typeof opts.getSprite === 'function' ? opts.getSprite : null;
    const spriteCache = opts.spriteCache || null;

    ctx.save();
    if (typeof ctx.beginPath === 'function' && typeof ctx.rect === 'function' && typeof ctx.clip === 'function') {
      ctx.beginPath();
      ctx.rect(vf.x, vf.y, vf.w, vf.h);
      ctx.clip();
    }

    items.forEach((item, idx) => {
      const member = CONFIG.MEMBERS.find((m) => m.id === item.memberId) || CONFIG.MEMBERS[idx % CONFIG.MEMBERS.length];
      if (!member) return;
      const hairStyle = item.hairStyle || (opts.defaultLanHairStyle && member.id === 'member_1' ? opts.defaultLanHairStyle : 'long');
      const spriteImg = getSpriteFn
        ? getSpriteFn(member.id, item.spriteSlot || 'main', hairStyle)
        : (spriteCache ? spriteCache[member.id] : null);

      drawIdol(ctx, member, time + idx * 0.55, mode, {
        pixelSize: 2,
        nativeScale: opts.nativeScale != null ? opts.nativeScale : STAGE_SCALE,
        cx: item.x,
        cy: item.y - 84,
        bottomY: item.y,
        maxW: 172,
        maxH: 230,
        extraScale: item.scale,
        flipX: Boolean(item.flipX),
        skipClip: true,
        spriteImg
      });

      if (opts.showSelection && item.memberId === opts.selectedMemberId) {
        const box = getGroupItemRect(item, spriteImg, member);
        const left = Math.max(vf.x + 2, box.x);
        const top = Math.max(vf.y + 2, box.y);
        const right = Math.min(vf.x + vf.w - 2, box.x + box.w);
        const bottom = Math.min(vf.y + vf.h - 2, box.y + box.h);
        const bw = Math.max(8, right - left);
        const bh = Math.max(8, bottom - top);
        const selColor = member.isDarkColor ? '#E4E4E7' : (member.lightColor || member.color || '#FACC15');

        ctx.save();
        ctx.scale(1 / STAGE_SCALE, 1 / STAGE_SCALE);
        const nx = Math.round(left * STAGE_SCALE);
        const ny = Math.round(top * STAGE_SCALE);
        const nw = Math.round(bw * STAGE_SCALE);
        const nh = Math.round(bh * STAGE_SCALE);
        if (typeof ctx.setLineDash === 'function') {
          ctx.setLineDash([8, 5]);
        }
        ctx.strokeStyle = '#090612';
        ctx.lineWidth = 4;
        ctx.strokeRect(nx, ny, nw, nh);
        ctx.strokeStyle = selColor;
        ctx.lineWidth = 2;
        ctx.strokeRect(nx, ny, nw, nh);
        if (typeof ctx.setLineDash === 'function') {
          ctx.setLineDash([]);
        }
        px(ctx, nx - 2, ny - 2, 6, 6, selColor);
        px(ctx, nx + nw - 4, ny - 2, 6, 6, selColor);
        px(ctx, nx - 2, ny + nh - 4, 6, 6, selColor);
        px(ctx, nx + nw - 4, ny + nh - 4, 6, 6, selColor);
        ctx.restore();
      }
    });

    ctx.restore();
  }

  // ===== Viewfinder HUD & Rhythm Bar Renderer =====
  function drawViewfinderHud(ctx, member, cursorPos, time, shotCount, banner, isGroup, poseInfo) {
    const vf = isGroup ? CONFIG.GROUP_VIEWFINDER : CONFIG.VIEWFINDER;
    const W = CONFIG.CANVAS_WIDTH;
    const dist = Math.abs(cursorPos - 0.5);
    const inPerfect = Boolean(poseInfo && poseInfo.isEasyMode) || dist <= CONFIG.RHYTHM_BAR.perfectHalf;
    const activePose = poseInfo && poseInfo.pose ? poseInfo.pose : null;
    const alertPulse = poseInfo && poseInfo.alertFlashTimer > 0 && (Math.sin(time * 24) > 0);
    const isRarePose = activePose && (activePose.rarity === 'SR' || activePose.rarity === 'SSR');

    // Subtle letterbox framing outside viewfinder
    ctx.save();
    ctx.fillStyle = 'rgba(10, 7, 20, 0.34)';
    ctx.fillRect(0, 46, W, vf.y - 46);
    ctx.fillRect(0, vf.y, vf.x, vf.h);
    ctx.fillRect(vf.x + vf.w, vf.y, W - (vf.x + vf.w), vf.h);
    ctx.fillRect(0, vf.y + vf.h, W, 280 - (vf.y + vf.h));
    ctx.restore();

    // Inner hairline frame (pulses gold / oshi color on SR/SSR pose switch)
    ctx.save();
    if (isRarePose && poseInfo.alertFlashTimer > 0) {
      const rareCol = activePose.rarity === 'SSR'
        ? '#FACC15'
        : (member.isDarkColor ? member.lightColor : member.color);
      ctx.strokeStyle = alertPulse ? '#FFFFFF' : rareCol;
      ctx.lineWidth = alertPulse ? 3 : 2;
    } else {
      ctx.strokeStyle = inPerfect ? 'rgba(250, 204, 21, 0.7)' : 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 1;
    }
    ctx.strokeRect(vf.x + 0.5, vf.y + 0.5, vf.w - 1, vf.h - 1);
    ctx.restore();

    // Crisp corner brackets
    let bracketColor = inPerfect ? '#FACC15' : '#FFFFFF';
    if (isRarePose && poseInfo.alertFlashTimer > 0) {
      bracketColor = activePose.rarity === 'SSR' ? '#FACC15' : (member.isDarkColor ? '#F4F4F5' : member.lightColor);
    }
    const len = 12;
    const t = 2;
    // Top-left
    px(ctx, vf.x, vf.y, len, t, bracketColor);
    px(ctx, vf.x, vf.y, t, len, bracketColor);
    // Top-right
    px(ctx, vf.x + vf.w - len, vf.y, len, t, bracketColor);
    px(ctx, vf.x + vf.w - t, vf.y, t, len, bracketColor);
    // Bottom-left
    px(ctx, vf.x, vf.y + vf.h - t, len, t, bracketColor);
    px(ctx, vf.x, vf.y + vf.h - len, t, len, bracketColor);
    // Bottom-right
    px(ctx, vf.x + vf.w - len, vf.y + vf.h - t, len, t, bracketColor);
    px(ctx, vf.x + vf.w - t, vf.y + vf.h - len, t, len, bracketColor);

    // Blinking green AF focus brackets during 180ms transition or 凑近对视 face-lock
    const focusRatio = poseInfo && poseInfo.focusFlashRatio ? poseInfo.focusFlashRatio : 0;
    const faceLockActive = Boolean(!isGroup && poseInfo && poseInfo.faceLockActive);
    const midX = vf.x + Math.floor(vf.w / 2);
    const midY = vf.y + Math.floor(vf.h / 2) - 8;
    if (!isGroup && focusRatio > 0) {
      const afSize = Math.round(16 + focusRatio * 10);
      const afCol = Math.sin(time * 42) > -0.2 ? '#4ADE80' : '#86EFAC';
      // [  ] left & right AF brackets
      px(ctx, midX - afSize, midY - 8, 5, 2, afCol);
      px(ctx, midX - afSize, midY - 8, 2, 16, afCol);
      px(ctx, midX - afSize, midY + 6, 5, 2, afCol);
      px(ctx, midX + afSize - 5, midY - 8, 5, 2, afCol);
      px(ctx, midX + afSize - 2, midY - 8, 2, 16, afCol);
      px(ctx, midX + afSize - 5, midY + 6, 5, 2, afCol);
    } else if (faceLockActive) {
      const faceY = vf.y + Math.round(vf.h * 0.34);
      const afSize = 22;
      const afCol = Math.sin(time * 8) > -0.35 ? '#4ADE80' : '#22C55E';
      px(ctx, midX - afSize, faceY - 12, 6, 2, afCol);
      px(ctx, midX - afSize, faceY - 12, 2, 24, afCol);
      px(ctx, midX - afSize, faceY + 10, 6, 2, afCol);
      px(ctx, midX + afSize - 6, faceY - 12, 6, 2, afCol);
      px(ctx, midX + afSize - 2, faceY - 12, 2, 24, afCol);
      px(ctx, midX + afSize - 6, faceY + 10, 6, 2, afCol);
      drawBitmapText(ctx, 'AF', midX + afSize + 3, faceY - 9, 1, afCol);
    } else {
      // Subtle center crosshair
      px(ctx, midX - 5, midY, 3, 1, 'rgba(255,255,255,0.45)');
      px(ctx, midX + 3, midY, 3, 1, 'rgba(255,255,255,0.45)');
      px(ctx, midX, midY - 5, 1, 3, 'rgba(255,255,255,0.45)');
      px(ctx, midX, midY + 3, 1, 3, 'rgba(255,255,255,0.45)');
    }

    // Blinking REC + live 60S / ALL★5 countdown indicator
    if (Math.sin(time * 4.5) > -0.2) {
      px(ctx, vf.x + 7, vf.y + 7, 4, 4, '#EF4444');
    }
    drawBitmapText(ctx, 'REC', vf.x + 14, vf.y + 6, 1, '#FFFFFF');
    if (isGroup) {
      drawBitmapText(ctx, 'ALL★5', vf.x + 36, vf.y + 6, 1, member.lightColor);
    } else {
      const remSec = poseInfo && poseInfo.timerSeconds != null ? Math.max(0, Math.ceil(poseInfo.timerSeconds)) : 60;
      const isUrgent = remSec <= 10;
      const timerColor = isUrgent ? (Math.sin(time * 10) > 0 ? '#EF4444' : '#FEF08A') : member.lightColor;
      drawBitmapText(ctx, `${String(remSec).padStart(2, '0')}S`, vf.x + 36, vf.y + 6, 1, timerColor);
    }

    // Shot counter
    const shotStr = `NO.${String(shotCount).padStart(2, '0')}`;
    drawBitmapText(ctx, shotStr, vf.x + vf.w - 6, vf.y + 6, 1, '#E2E8F0', 'right');

    // Floating judgment banner right after capture
    if (banner && banner.alpha > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, banner.alpha);
      const bx = vf.x + Math.floor(vf.w / 2);
      const by = vf.y + 30 - Math.round((1 - banner.alpha) * 10);
      drawBitmapText(ctx, banner.text, bx + 1, by + 1, 2, '#090612', 'center');
      drawBitmapText(ctx, banner.text, bx, by, 2, banner.color, 'center');
      ctx.restore();
    }
  }

  function drawRhythmBar(ctx, cursorPos, time, isEasyMode) {
    const rb = CONFIG.RHYTHM_BAR;
    const x = rb.x;
    const y = rb.y;
    const w = rb.w;
    const h = rb.h;

    // Header label & zone legend above bar
    if (isEasyMode) {
      drawBitmapText(ctx, 'FOCUS', x, y - 10, 1, '#FEF08A');
      ctx.save();
      ctx.scale(1 / STAGE_SCALE, 1 / STAGE_SCALE);
      ctx.font = 'bold 18px "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", monospace, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#090612';
      const tipText = '简单模式 · 必出 PERFECT';
      const tipX = Math.round((x + w) * STAGE_SCALE);
      const tipY = Math.round((y - 3) * STAGE_SCALE);
      if (typeof ctx.strokeText === 'function') {
        ctx.strokeText(tipText, tipX, tipY);
      }
      ctx.fillStyle = '#FEF08A';
      ctx.fillText(tipText, tipX, tipY);
      ctx.restore();
    } else {
      drawBitmapText(ctx, 'FOCUS', x, y - 10, 1, '#CBD5E1');
      px(ctx, x + w - 92, y - 9, 5, 5, '#FACC15');
      drawBitmapText(ctx, 'PERFECT', x + w - 84, y - 10, 1, '#FEF08A');
      px(ctx, x + w - 38, y - 9, 5, 5, '#22C55E');
      drawBitmapText(ctx, 'GREAT', x + w - 30, y - 10, 1, '#86EFAC');
    }

    // Outer pixel casing
    px(ctx, x - 3, y - 3, w + 6, h + 6, '#090612');
    px(ctx, x - 2, y - 2, w + 4, h + 4, '#4c407a');
    px(ctx, x, y, w, h, '#20193a');

    if (isEasyMode) {
      // Full-bar gold PERFECT region in Easy Mode
      px(ctx, x, y, w, h, '#EAB308');
      px(ctx, x, y, w, 5, '#FEF08A');
      px(ctx, x, y + h - 3, w, 3, '#CA8A04');
      for (let tx = x + 16; tx < x + w - 8; tx += 28) {
        if (Math.sin(time * 6 + tx * 0.15) > 0) {
          px(ctx, tx, y + 7, 2, 2, '#FFFFFF');
        }
      }
    } else {
      // Subtle GOOD zone ticks
      for (let tx = x + 10; tx < x + w - 6; tx += 12) {
        px(ctx, tx, y + h - 4, 1, 3, '#3b3166');
      }

      // GREAT green region
      const greatStart = Math.round(x + (0.5 - rb.greatHalf) * w);
      const greatW = Math.round(rb.greatHalf * 2 * w);
      px(ctx, greatStart, y, greatW, h, '#16A34A');
      px(ctx, greatStart, y, greatW, 4, '#4ADE80');
      px(ctx, greatStart, y + h - 3, greatW, 3, '#15803D');

      // PERFECT gold center region
      const perfStart = Math.round(x + (0.5 - rb.perfectHalf) * w);
      const perfW = Math.round(rb.perfectHalf * 2 * w);
      px(ctx, perfStart, y, perfW, h, '#EAB308');
      px(ctx, perfStart, y, perfW, 5, '#FEF08A');
      px(ctx, perfStart, y + h - 3, perfW, 3, '#CA8A04');
    }

    // Center target hairline
    const centerX = Math.round(x + w * 0.5);
    px(ctx, centerX, y, 1, h, '#FFFFFF');

    // Animated sparkle inside PERFECT zone
    if (Math.sin(time * 8) > 0) {
      px(ctx, centerX - 4, y + 7, 2, 2, '#FFFFFF');
      px(ctx, centerX + 3, y + 11, 2, 2, '#FFFFFF');
    }

    // Moving cursor needle
    const curX = Math.round(x + cursorPos * (w - 4));
    px(ctx, curX - 1, y - 3, 6, h + 6, '#090612');
    px(ctx, curX, y - 2, 4, h + 4, '#FFFFFF');
    px(ctx, curX + 1, y, 2, h, '#EF4444');

    // Top & bottom cursor arrowheads
    px(ctx, curX - 1, y - 5, 6, 2, '#FFFFFF');
    px(ctx, curX, y - 3, 4, 1, '#EF4444');
    px(ctx, curX - 1, y + h + 3, 6, 2, '#FFFFFF');
  }

  // ===== Particles & Flash =====
  function spawnBurstParticles(particles, member, judgmentKey, isGroup) {
    const vf = isGroup ? CONFIG.GROUP_VIEWFINDER : CONFIG.VIEWFINDER;
    const cx = vf.x + vf.w / 2;
    const cy = vf.y + vf.h / 2;
    const count = judgmentKey === 'PERFECT' ? 38 : judgmentKey === 'GREAT' ? 26 : 16;
    const groupColors = CONFIG.MEMBERS.map((m) => m.color);
    const palette = isGroup
      ? ['#FACC15', '#FFFFFF', ...groupColors]
      : judgmentKey === 'PERFECT'
        ? ['#FACC15', '#FFFFFF', member.color, member.lightColor, '#FEF08A']
        : judgmentKey === 'GREAT'
          ? ['#4ADE80', '#FFFFFF', member.color, '#BBF7D0']
          : ['#FFFFFF', member.lightColor, '#93C5FD'];

    for (let i = 0; i < count; i += 1) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.45;
      const speed = 38 + Math.random() * 96;
      const shape = i % 3 === 0 ? 'star' : (i % 5 === 0 && judgmentKey === 'PERFECT' ? 'heart' : 'square');
      particles.push({
        x: cx + (Math.random() - 0.5) * 28,
        y: cy + (Math.random() - 0.5) * 28,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 22,
        life: 0.45 + Math.random() * 0.35,
        maxLife: 0.8,
        size: shape === 'square' ? (Math.random() > 0.4 ? 3 : 2) : 2,
        shape,
        color: palette[i % palette.length]
      });
    }
  }

  function updateAndDrawParticles(ctx, particles, dt) {
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }
      p.vy += 120 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life / 0.35));
      if (p.shape === 'star') {
        drawPixelStar(ctx, p.x, p.y, 2, p.color, '#FFFFFF');
      } else if (p.shape === 'heart') {
        drawPixelHeart(ctx, p.x, p.y, 1, p.color);
      } else {
        px(ctx, p.x, p.y, p.size, p.size, p.color);
      }
      ctx.restore();
    }
  }

  // ===== Offscreen HD Polaroid Composer =====
  function composePolaroid(captureCanvas, member, judgment, isGroup, options) {
    const opts = options || {};
    const poseObj = opts.pose || null;
    const isHolo = Boolean(!isGroup && opts.isHolo);
    const pol = isGroup ? CONFIG.GROUP_POLAROID : CONFIG.POLAROID;
    const vf = isGroup ? CONFIG.GROUP_VIEWFINDER : CONFIG.VIEWFINDER;
    const S = pol.scale;

    const baseW = vf.w + pol.padX * 2;
    const baseH = vf.h + pol.padTop + pol.padBottom;
    const outW = baseW * S;
    const outH = baseH * S;
    const hdScale = POLAROID_HD_SCALE;

    const outCanvas = document.createElement('canvas');
    outCanvas.width = outW * hdScale;
    outCanvas.height = outH * hdScale;

    const ctx = outCanvas.getContext('2d');
    ctx.save();
    ctx.scale(hdScale, hdScale);
    ctx.imageSmoothingEnabled = false;

    const isPerfect = judgment.key === 'PERFECT';
    const memberColors = CONFIG.MEMBERS.map((m) => m.color);
    const groupCfg = CONFIG.GROUP_CONFIG || {
      groupName: 'F1owSec',
      groupTag: 'Flow One Sec',
      groupPhotoTitle: 'F1owSec 全员集结',
      groupPhotoSub: 'FLOW ONE SEC'
    };

    // 1. Frame Base
    if (isGroup) {
      const frameBg = isPerfect ? '#4C1D95' : '#FAF7F0';
      px(ctx, 0, 0, outW, outH, frameBg);
      px(ctx, 0, 0, outW, S, '#1e1633');
      px(ctx, 0, outH - S, outW, S, '#1e1633');
      px(ctx, 0, 0, S, outH, '#1e1633');
      px(ctx, outW - S, 0, S, outH, '#1e1633');

      // 5-color oshi ribbon accent along top & bottom edges
      const segW = Math.floor((outW - S * 2) / 5);
      memberColors.forEach((col, idx) => {
        px(ctx, S + idx * segW, S, idx === 4 ? outW - S * 2 - idx * segW : segW, S * 2, col);
        px(ctx, S + idx * segW, outH - S * 3, idx === 4 ? outW - S * 2 - idx * segW : segW, S * 2, col);
      });

      if (isPerfect) {
        const starSpots = [
          [26, 26], [outW / 2, 24], [outW - 26, 26],
          [24, outH / 2 - 40], [outW - 24, outH / 2 - 40],
          [26, outH - 208], [outW - 26, outH - 208],
          [32, outH - 28], [outW - 32, outH - 28]
        ];
        starSpots.forEach(([sx, sy], idx) => {
          const col = CONFIG.MEMBERS[idx % CONFIG.MEMBERS.length].accentColor || memberColors[idx % memberColors.length];
          if (idx % 3 === 1) {
            drawPixelHeart(ctx, sx, sy, 3, col);
          } else {
            drawPixelStar(ctx, sx, sy, 8, '#FEF08A', '#FFFFFF');
          }
        });
      }

      // Clean high-contrast chin card for wide memorial Polaroid
      const cardX = 12 * S;
      const cardY = (pol.padTop + vf.h + 7) * S;
      const cardW = outW - 24 * S;
      const cardH = (pol.padBottom - 16) * S;
      px(ctx, cardX - S, cardY - S, cardW + S * 2, cardH + S * 2, '#1e1633');
      px(ctx, cardX, cardY, cardW, cardH, '#FFFDF7');
      px(ctx, cardX, cardY, cardW, S, '#FACC15');
    } else if (isHolo) {
      // 全息闪粉金边相纸（单人集齐 6 动作永久解锁）
      const grad = ctx.createLinearGradient(0, 0, outW, outH);
      grad.addColorStop(0, '#F59E0B');
      grad.addColorStop(0.28, '#FEF08A');
      grad.addColorStop(0.55, '#FACC15');
      grad.addColorStop(0.82, '#FDE047');
      grad.addColorStop(1, '#D97706');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, outW, outH);

      // 外圈暗金边框 + 成员应援色内衬双线
      const innerLine = member.isDarkColor ? '#A1A1AA' : member.color;
      px(ctx, 0, 0, outW, S, '#1e1633');
      px(ctx, 0, outH - S, outW, S, '#1e1633');
      px(ctx, 0, 0, S, outH, '#1e1633');
      px(ctx, outW - S, 0, S, outH, '#1e1633');
      px(ctx, S * 2, S * 2, outW - S * 4, S, innerLine);
      px(ctx, S * 2, outH - S * 3, outW - S * 4, S, innerLine);

      // 全息彩虹闪粉像素矩阵
      const holoPalette = ['#FFFFFF', '#FEF08A', '#93C5FD', '#FBCFE8', '#86EFAC'];
      for (let sy = 18; sy < outH - 18; sy += 38) {
        for (let sx = 18; sx < outW - 18; sx += 44) {
          const inPhoto =
            sx > (pol.padX - 4) * S &&
            sx < (pol.padX + vf.w + 4) * S &&
            sy > (pol.padTop - 4) * S &&
            sy < (pol.padTop + vf.h + 4) * S;
          if (!inPhoto && ((sx + sy) % 3 === 0)) {
            const col = holoPalette[(sx + sy) % holoPalette.length];
            drawPixelStar(ctx, sx, sy, 6, col, '#FFFFFF');
          }
        }
      }

      const cardX = 14 * S;
      const cardY = (pol.padTop + vf.h + 8) * S;
      const cardW = outW - 28 * S;
      const cardH = (pol.padBottom - 18) * S;
      px(ctx, cardX - S, cardY - S, cardW + S * 2, cardH + S * 2, '#1e1633');
      px(ctx, cardX, cardY, cardW, cardH, '#FFFBEB');
      px(ctx, cardX, cardY, cardW, S, '#F59E0B');
    } else if (isPerfect) {
      // Limited Edition Oshi-Color Polaroid Frame (silver glow outline for black担当)
      const frameColor = member.color;
      const checkColor = member.isDarkColor ? (member.lightColor || '#A1A1AA') : member.lightColor;
      const outerStroke = member.isDarkColor ? (member.lightColor || '#A1A1AA') : '#1e1633';
      px(ctx, 0, 0, outW, outH, frameColor);
      px(ctx, 0, 0, outW, S, outerStroke);
      px(ctx, 0, outH - S, outW, S, outerStroke);
      px(ctx, 0, 0, S, outH, outerStroke);
      px(ctx, outW - S, 0, S, outH, outerStroke);

      // Pixel checker accent along outer edge
      for (let gx = S * 2; gx < outW - S * 2; gx += S * 4) {
        px(ctx, gx, S * 2, S * 2, S * 2, checkColor);
        px(ctx, gx + S * 2, outH - S * 4, S * 2, S * 2, checkColor);
      }
      for (let gy = S * 2; gy < outH - S * 2; gy += S * 4) {
        px(ctx, S * 2, gy, S * 2, S * 2, checkColor);
        px(ctx, outW - S * 4, gy + S * 2, S * 2, S * 2, checkColor);
      }

      // Scattered stars & pixel hearts on PERFECT limited border
      const starSpots = [
        [24, 24], [outW / 2, 26], [outW - 26, 24],
        [26, outH / 2 - 60], [outW - 26, outH / 2 - 40],
        [26, outH - 224], [outW - 26, outH - 224],
        [34, outH - 28], [outW - 34, outH - 28]
      ];
      starSpots.forEach(([sx, sy], idx) => {
        if (idx % 3 === 1) {
          drawPixelHeart(ctx, sx, sy, 3, '#FFFFFF');
        } else {
          drawPixelStar(ctx, sx, sy, 8, idx % 2 === 0 ? '#FEF08A' : '#FFFFFF', '#FFFFFF');
        }
      });

      // High-contrast nameplate card in bottom chin so any oshi color stays legible
      const cardX = 14 * S;
      const cardY = (pol.padTop + vf.h + 8) * S;
      const cardW = outW - 28 * S;
      const cardH = (pol.padBottom - 18) * S;
      px(ctx, cardX - S, cardY - S, cardW + S * 2, cardH + S * 2, '#1e1633');
      px(ctx, cardX, cardY, cardW, cardH, '#FFFDF7');
      px(ctx, cardX, cardY, cardW, S, checkColor);
    } else {
      // Classic Crisp Off-White Polaroid Frame
      px(ctx, 0, 0, outW, outH, '#FAF7F0');
      px(ctx, 0, 0, outW, S, '#1e1633');
      px(ctx, 0, outH - S, outW, S, '#1e1633');
      px(ctx, 0, 0, S, outH, '#1e1633');
      px(ctx, outW - S, 0, S, outH, '#1e1633');
      // Subtle paper bevel
      px(ctx, S, outH - S * 2, outW - S * 2, S, '#DFD8CC');
      px(ctx, outW - S * 2, S, S, outH - S * 2, '#DFD8CC');
    }

    // 2. Inner Photo Frame & Captured Stage Viewfinder Image
    const imgX = pol.padX * S;
    const imgY = pol.padTop * S;
    const imgW = vf.w * S;
    const imgH = vf.h * S;

    px(ctx, imgX - S * 2, imgY - S * 2, imgW + S * 4, imgH + S * 4, (isPerfect || isHolo) ? '#FFFFFF' : '#D5CEC0');
    px(ctx, imgX - S, imgY - S, imgW + S * 2, imgH + S * 2, '#1e1633');

    const srcScale = (captureCanvas.width / CONFIG.CANVAS_WIDTH) || 1;
    ctx.drawImage(
      captureCanvas,
      Math.round(vf.x * srcScale), Math.round(vf.y * srcScale),
      Math.round(vf.w * srcScale), Math.round(vf.h * srcScale),
      imgX, imgY, imgW, imgH
    );

    // Subtle pixel film sheen corner
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.fillRect(imgX + 12, imgY + 12, 48, 8);
    ctx.fillRect(imgX + 12, imgY + 20, 20, 8);
    ctx.restore();

    // 3. Printed Chin Text (Member Name, Judgment Stars, Date YYYY.MM.DD) — 2x HD native crisp typography
    ctx.imageSmoothingEnabled = true;
    if ('imageSmoothingQuality' in ctx) {
      ctx.imageSmoothingQuality = 'high';
    }
    const chinTop = imgY + imgH;
    const textLeft = (pol.padX + 8) * S;
    const textRight = outW - (pol.padX + 8) * S;
    const row1Y = chinTop + (isGroup ? 16 : 17) * S;
    const row2Y = chinTop + (isGroup ? 36 : 39) * S;
    const dateStr = formatDateDot(new Date());

    if (isGroup) {
      // 5 color pips + F1owSec ALL title
      const pipSize = 6 * S;
      memberColors.forEach((col, idx) => {
        const pxPos = textLeft + idx * (pipSize + 4);
        px(ctx, pxPos, row1Y - pipSize / 2, pipSize, pipSize, '#1e1633');
        px(ctx, pxPos + 3, row1Y - pipSize / 2 + 3, pipSize - 6, pipSize - 6, col);
      });

      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.fillStyle = '#1E1B2E';
      ctx.font = 'bold 32px "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", monospace, sans-serif';
      ctx.fillText(groupCfg.groupPhotoTitle, textLeft + 5 * (pipSize + 4) + 14, row1Y + 2);

      ctx.fillStyle = '#6D28D9';
      ctx.font = 'bold 21px "Courier New", "PingFang SC", "Microsoft YaHei", monospace, sans-serif';
      ctx.fillText(`${groupCfg.groupPhotoSub} · ${groupCfg.groupName}`, textLeft, row2Y + 2);
    } else {
      // Oshi color swatch square + Member Name + enName
      const swatchSize = 11 * S;
      px(ctx, textLeft, row1Y - swatchSize / 2, swatchSize, swatchSize, '#1e1633');
      px(ctx, textLeft + S, row1Y - swatchSize / 2 + S, swatchSize - S * 2, swatchSize - S * 2, member.color);

      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.fillStyle = '#1E1B2E';
      ctx.font = 'bold 36px "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", monospace, sans-serif';
      const displayName = member.enName ? `${member.name} ${member.enName}` : member.name;
      ctx.fillText(displayName, textLeft + swatchSize + 5 * S, row1Y + 2);

      // 动作稀有度徽章（N / R / SR / SSR）+ 高清抗锯齿描边字 + 圆角底框
      if (poseObj && Poses) {
        const rStyle = Poses.RARITY_STYLES[poseObj.rarity] || Poses.RARITY_STYLES.N;
        const badgeText = `[${poseObj.rarity} ${poseObj.name}]`;
        ctx.save();
        ctx.font = '900 26px "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", monospace, sans-serif';
        const bw = Math.ceil(ctx.measureText(badgeText).width) + 28;
        const bh = 42;
        const bx = textLeft;
        const by = row2Y - Math.round(bh / 2) + 2;
        fillRoundedRect(ctx, bx, by, bw, bh, 8, rStyle.bg, '#090612', 4);
        fillRoundedRect(ctx, bx + 3, by + 3, bw - 6, bh - 6, 6, null, rStyle.border, 2);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#090612';
        ctx.strokeText(badgeText, bx + 14, by + Math.round(bh / 2) + 1);
        ctx.fillStyle = rStyle.text;
        ctx.fillText(badgeText, bx + 14, by + Math.round(bh / 2) + 1);
        ctx.restore();
      } else {
        ctx.fillStyle = '#64748B';
        ctx.font = 'bold 21px "Courier New", "PingFang SC", "Microsoft YaHei", monospace, sans-serif';
        ctx.fillText(
          isPerfect ? `★ ${groupCfg.groupName} 应援色限定` : `${groupCfg.groupName} · 限时60秒拍立得`,
          textLeft,
          row2Y + 2
        );
      }
    }

    // Judgment stars badge on row 1 right
    ctx.textAlign = 'right';
    const badgeColor = judgment.key === 'PERFECT' ? '#B45309' : judgment.key === 'GREAT' ? '#15803D' : '#1D4ED8';
    ctx.fillStyle = badgeColor;
    ctx.font = 'bold 30px "Courier New", monospace, sans-serif';
    ctx.fillText(`${judgment.stars} ${judgment.label}`, textRight, row1Y + 2);

    // Date stamp YYYY.MM.DD on row 2 right
    ctx.fillStyle = '#334155';
    ctx.font = 'bold 26px "Courier New", monospace, sans-serif';
    ctx.fillText(dateStr, textRight, row2Y + 2);

    ctx.restore();
    outCanvas._logicalW = outW;
    outCanvas._logicalH = outH;
    outCanvas._hdScale = hdScale;
    outCanvas._photoRect = { x: imgX, y: imgY, w: imgW, h: imgH };
    outCanvas._dateStr = dateStr;
    outCanvas._isNewPose = Boolean(!isGroup && opts.isNewPose);
    outCanvas._isHolo = isHolo;
    outCanvas._poseInfo = poseObj ? { id: poseObj.id, name: poseObj.name, rarity: poseObj.rarity } : null;
    return outCanvas;
  }

  // ===== Main Game App Controller =====
  function createApp() {
    const appEl = document.getElementById('app');
    const stageCanvas = document.getElementById('stage-canvas');
    const stageCtx = stageCanvas.getContext('2d');
    stageCtx.imageSmoothingEnabled = false;

    const captureCanvas = document.createElement('canvas');
    captureCanvas.width = (CONFIG.CANVAS_WIDTH || 270) * CAPTURE_SCALE;
    captureCanvas.height = (CONFIG.CANVAS_HEIGHT || 480) * CAPTURE_SCALE;
    const captureCtx = captureCanvas.getContext('2d');
    captureCtx.imageSmoothingEnabled = false;

    const el = {
      startScreen: document.getElementById('start-screen'),
      nicknameInput: document.getElementById('nickname-input'),
      btnTicketModeStandard: document.getElementById('btn-ticket-mode-standard'),
      btnTicketModeEasy: document.getElementById('btn-ticket-mode-easy'),
      btnEnterTicket: document.getElementById('btn-enter-ticket'),
      btnOpenTicket: document.getElementById('btn-open-ticket'),
      btnSettingsModeStandard: document.getElementById('btn-settings-mode-standard'),
      btnSettingsModeEasy: document.getElementById('btn-settings-mode-easy'),
      colorDot: document.getElementById('member-color-dot'),
      memberName: document.getElementById('member-name-label'),
      memberTag: document.getElementById('member-color-tag'),
      poseHudBadge: document.getElementById('pose-hud-badge'),
      btnFraming: document.getElementById('btn-framing'),
      btnHairToggle: document.getElementById('btn-hair-toggle'),
      groupGuideToast: document.getElementById('group-guide-toast'),
      groupNameHint: document.getElementById('group-name-hint'),
      groupMemberTabs: document.getElementById('group-member-tabs'),
      timeoutOverlay: document.getElementById('timeout-overlay'),
      btnRenewTicket: document.getElementById('btn-renew-ticket'),
      groupStudioBar: document.getElementById('group-studio-bar'),
      grpSelectedName: document.getElementById('grp-selected-name'),
      btnGrpPose: document.getElementById('btn-grp-pose'),
      btnGrpHair: document.getElementById('btn-grp-hair'),
      btnGrpFlip: document.getElementById('btn-grp-flip'),
      btnGrpZoomIn: document.getElementById('btn-grp-zoom-in'),
      btnGrpZoomOut: document.getElementById('btn-grp-zoom-out'),
      btnGrpTop: document.getElementById('btn-grp-top'),
      btnGrpSoul: document.getElementById('btn-grp-soul'),
      btnAlbum: document.getElementById('btn-album'),
      albumCountBadge: document.getElementById('album-count-badge'),
      btnBgSwitch: document.getElementById('btn-bg-switch'),
      bgLabel: document.getElementById('bg-label'),
      btnSettings: document.getElementById('btn-settings'),
      btnMute: document.getElementById('btn-mute'),
      iconSoundOn: document.getElementById('icon-sound-on'),
      iconSoundOff: document.getElementById('icon-sound-off'),
      btnShutter: document.getElementById('btn-shutter'),
      btnPoseSwitch: document.getElementById('btn-pose-switch'),
      poseCooldownFill: document.getElementById('pose-cooldown-fill'),
      btnCall: document.getElementById('btn-call'),
      collectionLabel: document.getElementById('collection-label'),
      collectionStars: document.getElementById('collection-stars'),
      memberBar: document.getElementById('member-bar'),
      previewModal: document.getElementById('preview-modal'),
      modalBadge: document.getElementById('modal-judgment-badge'),
      btnModalClose: document.getElementById('btn-modal-close'),
      editorCanvas: document.getElementById('polaroid-editor-canvas'),
      developPanel: document.getElementById('develop-panel'),
      developHint: document.getElementById('develop-hint'),
      developBarFill: document.getElementById('develop-bar-fill'),
      developPercent: document.getElementById('develop-percent'),
      diyPanel: document.getElementById('diy-panel'),
      btnCompleteStamp: document.getElementById('btn-complete-stamp'),
      btnToSignToggle: document.getElementById('btn-tosign-toggle'),
      btnToSignColor: document.getElementById('btn-tosign-color'),
      btnStickerUndo: document.getElementById('btn-sticker-undo'),
      btnStickerClear: document.getElementById('btn-sticker-clear'),
      stickerTransformBar: document.getElementById('sticker-transform-bar'),
      btnStkRotL: document.getElementById('btn-stk-rot-l'),
      btnStkRotR: document.getElementById('btn-stk-rot-r'),
      btnStkZoomIn: document.getElementById('btn-stk-zoom-in'),
      btnStkZoomOut: document.getElementById('btn-stk-zoom-out'),
      btnStkDelete: document.getElementById('btn-stk-delete'),
      toSignTransformBar: document.getElementById('tosign-transform-bar'),
      btnToSignZoomIn: document.getElementById('btn-tosign-zoom-in'),
      btnToSignZoomOut: document.getElementById('btn-tosign-zoom-out'),
      btnToSignReset: document.getElementById('btn-tosign-reset'),
      stickerTray: document.getElementById('sticker-tray'),
      btnRetake: document.getElementById('btn-retake'),
      btnSaveAlbum: document.getElementById('btn-save-album'),
      btnExportPng: document.getElementById('btn-export-png'),
      modalToast: document.getElementById('modal-toast'),
      albumModal: document.getElementById('album-modal'),
      albumModalCount: document.getElementById('album-modal-count'),
      btnAlbumClose: document.getElementById('btn-album-close'),
      tabAlbum: document.getElementById('tab-album'),
      tabDex: document.getElementById('tab-dex'),
      dexTotalBadge: document.getElementById('dex-total-badge'),
      albumGrid: document.getElementById('album-grid'),
      albumEmpty: document.getElementById('album-empty'),
      dexPanel: document.getElementById('dex-panel'),
      albumDetailModal: document.getElementById('album-detail-modal'),
      albumDetailMeta: document.getElementById('album-detail-meta'),
      albumDetailImg: document.getElementById('album-detail-img'),
      btnDetailBack: document.getElementById('btn-detail-back'),
      btnDetailDelete: document.getElementById('btn-detail-delete'),
      btnDetailDownload: document.getElementById('btn-detail-download'),
      unlockModal: document.getElementById('unlock-modal'),
      btnUnlockClose: document.getElementById('btn-unlock-close'),
      btnUnlockTry: document.getElementById('btn-unlock-try'),
      allCompleteModal: document.getElementById('all-complete-modal'),
      btnAllCompleteOk: document.getElementById('btn-all-complete-ok'),
      settingsModal: document.getElementById('settings-modal'),
      btnSettingsClose: document.getElementById('btn-settings-close'),
      btnSettingsReset: document.getElementById('btn-settings-reset'),
      btnSettingsDone: document.getElementById('btn-settings-done'),
      toggleFilterScanlines: document.getElementById('toggle-filter-scanlines'),
      toggleFilterCyber: document.getElementById('toggle-filter-cyber'),
      toggleFilterWarm: document.getElementById('toggle-filter-warm'),
      toggleFilterGlow: document.getElementById('toggle-filter-glow'),
      saveImageModal: document.getElementById('save-image-modal'),
      saveImagePreview: document.getElementById('save-image-preview'),
      btnSaveImageClose: document.getElementById('btn-save-image-close'),
      btnSaveImageDone: document.getElementById('btn-save-image-done'),
      globalToast: document.getElementById('global-toast')
    };

    const editorCtx = el.editorCanvas.getContext('2d');
    editorCtx.imageSmoothingEnabled = false;
    const stickerSession = new Stickers.StickerSession();
    const poseController = Poses
      ? new Poses.PoseController({
          onRareAlert: (rarity) => {
            if (state.mode === 'AIMING' && !state.isGroupMode) {
              AudioManager.playRarePoseAlert(rarity);
            }
          }
        })
      : null;

    function loadSavedPref(key, fallback) {
      try {
        if (typeof global.localStorage !== 'undefined' && global.localStorage) {
          const val = global.localStorage.getItem(key);
          return val != null ? val : fallback;
        }
      } catch (_err) {
        // Ignore storage read error
      }
      return fallback;
    }

    function savePref(key, val) {
      try {
        if (typeof global.localStorage !== 'undefined' && global.localStorage) {
          global.localStorage.setItem(key, String(val));
        }
      } catch (_err) {
        // Ignore storage write error
      }
    }

    const savedNick = String(loadSavedPref(CONFIG.NICKNAME_STORAGE_KEY || 'f1owsec_nickname_v1', '')).slice(0, 10);
    const savedHair = loadSavedPref(CONFIG.HAIR_PREF_STORAGE_KEY || 'f1owsec_hair_pref_v1', 'long') === 'short' ? 'short' : 'long';
    const savedGameMode = loadSavedPref(CONFIG.GAME_MODE_STORAGE_KEY || 'f1owsec_game_mode_v1', 'standard') === 'easy' ? 'easy' : 'standard';

    const state = {
      memberIndex: 0,
      isGroupMode: false,
      bgIndex: 0,
      mode: el.startScreen ? 'START' : 'AIMING', // 'START' | 'AIMING' | 'CAPTURING' | 'DEVELOPING' | 'DIY' | 'ALBUM'
      nickname: savedNick,
      lanHairStyle: savedHair,
      gameMode: savedGameMode,
      enteringTicket: false,
      lastRenderedSpriteByMember: {},
      timerSeconds: 60,
      timerExpired: false,
      lastTenBubbleCooldown: 0,
      framingIndex: 0,
      framingZoom: 1.0,
      framingFocusY: 0.68,
      callTrails: [],
      groupItems: createDefaultGroupItems().map((it) => (
        it.memberId === 'member_1' ? Object.assign({}, it, { hairStyle: savedHair }) : it
      )),
      selectedGroupMemberId: null,
      groupDragging: false,
      groupDragOffsetX: 0,
      groupDragOffsetY: 0,
      groupGuideTimerId: null,
      groupGuideFadeTimerId: null,
      groupNameHintTimerId: null,
      groupNameHintFadeTimerId: null,
      groupMemberTabBtns: [],
      groupSoulModeIndex: -1,
      groupStarlightSea: false,
      completeStampEnabled: true,
      lastDevelopUnlockRes: null,
      stickerGesture: null,
      stageLastTouchTs: 0,
      lastHudBadgeKey: '',
      cursorPos: 0.5,
      cursorDir: 1,
      time: 0,
      lastTs: 0,
      flashAlpha: 0,
      shotCount: 1,
      particles: [],
      banner: null,
      basePolaroidCanvas: null,
      photoRect: null,
      lastDateStr: '',
      lastJudgment: null,
      lastMember: null,
      lastIsGroup: false,
      lastPoseInfo: null,
      lastIsNewPose: false,
      lastIsHolo: false,
      toSignEnabled: true,
      toSignColorIndex: 0,
      toSignX: null,
      toSignY: null,
      toSignScale: 1.0,
      toSignSelected: false,
      toSignDragging: false,
      toSignDragOffsetX: 0,
      toSignDragOffsetY: 0,
      currentSignPhrase: TO_SIGN_PHRASES[0],
      currentSignAngleDeg: -4,
      albumTab: 'album',
      developProgress: 0,
      developCompleted: false,
      developSparkles: [],
      isRubbing: false,
      rubDownX: 0,
      rubDownY: 0,
      rubMovedDist: 0,
      lastPointerX: 0,
      lastPointerY: 0,
      lastRubSfxTime: 0,
      lastTouchTs: 0,
      isSavingAlbum: false,
      savedCurrentToAlbum: false,
      currentDetailId: null,
      captureTimerId: null,
      developTimerId: null,
      toastTimerId: null,
      globalToastTimerId: null,
      avatarCanvases: {},
      memberButtons: [],
      groupButton: null
    };

    function getActiveSprite(memberId, variant, hairStyle) {
      if (!AssetsManager) {
        return state.lastRenderedSpriteByMember[memberId] || null;
      }
      const effectiveHair = memberId === 'member_1' ? (hairStyle || state.lanHairStyle) : null;
      const sprite = AssetsManager.getSprite(memberId, variant, effectiveHair);
      if (sprite) {
        state.lastRenderedSpriteByMember[memberId] = sprite;
        return sprite;
      }
      return state.lastRenderedSpriteByMember[memberId] || null;
    }

    function getActiveSpriteMap(variant) {
      return AssetsManager ? AssetsManager.getSpriteMap(variant, { member_1: state.lanHairStyle }) : {};
    }

    function renderSoloStageScene(ctx, bgId, member, time, mode, poseSnap, renderOpts) {
      const vf = CONFIG.VIEWFINDER;
      const poseZoom = poseSnap && poseSnap.cameraZoom ? poseSnap.cameraZoom : 1.0;
      const framingZoom = state.framingZoom || 1.0;
      const zoom = Math.min(1.90, poseZoom * framingZoom);
      const nativeScale = (renderOpts && renderOpts.nativeScale != null) ? renderOpts.nativeScale : STAGE_SCALE;
      const spriteVariant = poseSnap && poseSnap.spriteSlot
        ? poseSnap.spriteSlot
        : (poseSnap && poseSnap.pose && poseSnap.pose.usePoseSprite ? 'pose' : 'main');
      const hairStyle = member.id === 'member_1' ? state.lanHairStyle : null;
      const spriteImg = getActiveSprite(member.id, spriteVariant, hairStyle);

      // 2.5D 视差手持微晃（快门按下一刻锁定为 0）
      const isCaptureLock = mode === 'CAPTURING';
      const bgShiftX = isCaptureLock ? 0 : Math.sin(time * 0.9) * 0.5;
      const bgShiftY = isCaptureLock ? 0 : Math.cos(time * 1.15) * 0.5;
      const idolShiftX = isCaptureLock ? 0 : Math.sin(time * 0.9) * 1.5;
      const idolShiftY = isCaptureLock ? 0 : Math.cos(time * 1.15) * 1.5;

      const tr = poseSnap && poseSnap.transform ? poseSnap.transform : { swayX: 0, bobY: 0, jumpY: 0 };
      const idolCx = vf.x + vf.w / 2 + idolShiftX;
      const idolBottomY = vf.y + vf.h - 10 + idolShiftY;

      ctx.imageSmoothingEnabled = false;
      drawBackground(ctx, bgId, member, time);

      if (zoom > 1.01) {
        const focusX = vf.x + vf.w / 2;
        const focusY = vf.y + vf.h * (state.framingFocusY != null ? state.framingFocusY : 0.14);
        ctx.save();
        ctx.beginPath();
        ctx.rect(vf.x, vf.y, vf.w, vf.h);
        ctx.clip();
        ctx.translate(focusX, focusY);
        ctx.scale(zoom, zoom);
        ctx.translate(-focusX, -focusY);

        ctx.save();
        ctx.translate(bgShiftX, bgShiftY);
        drawBackground(ctx, bgId, member, time);
        ctx.restore();

        if (poseSnap && poseSnap.prevGhost && poseSnap.afterimageAlpha > 0.01) {
          const ghostSprite = getActiveSprite(member.id, poseSnap.prevGhost.spriteSlot || 'main', hairStyle);
          drawIdol(ctx, member, time, mode, {
            spriteImg: ghostSprite,
            nativeScale,
            poseSnapshot: { transform: poseSnap.prevGhost.transform },
            cx: idolCx,
            bottomY: idolBottomY,
            alpha: poseSnap.afterimageAlpha,
            skipShadow: true,
            skipGlint: true,
            skipClip: true
          });
        }

        drawIdol(ctx, member, time, mode, {
          spriteImg,
          nativeScale,
          poseSnapshot: poseSnap,
          cx: idolCx,
          bottomY: idolBottomY,
          glint: poseSnap ? poseSnap.glint : null,
          skipClip: true
        });
        if (poseSnap && poseSnap.fxParticles) {
          drawPoseParticles(ctx, poseSnap.fxParticles);
        }
        ctx.restore();
      } else {
        ctx.save();
        ctx.beginPath();
        ctx.rect(vf.x, vf.y, vf.w, vf.h);
        ctx.clip();
        ctx.save();
        ctx.translate(bgShiftX, bgShiftY);
        drawBackground(ctx, bgId, member, time);
        ctx.restore();

        if (poseSnap && poseSnap.prevGhost && poseSnap.afterimageAlpha > 0.01) {
          const ghostSprite = getActiveSprite(member.id, poseSnap.prevGhost.spriteSlot || 'main', hairStyle);
          drawIdol(ctx, member, time, mode, {
            spriteImg: ghostSprite,
            nativeScale,
            poseSnapshot: { transform: poseSnap.prevGhost.transform },
            cx: idolCx,
            bottomY: idolBottomY,
            alpha: poseSnap.afterimageAlpha,
            skipShadow: true,
            skipGlint: true,
            skipClip: true
          });
        }

        drawIdol(ctx, member, time, mode, {
          spriteImg,
          nativeScale,
          poseSnapshot: poseSnap,
          cx: idolCx,
          bottomY: idolBottomY,
          glint: poseSnap ? poseSnap.glint : null,
          skipClip: true
        });
        if (poseSnap && poseSnap.fxParticles) {
          drawPoseParticles(ctx, poseSnap.fxParticles);
        }
        ctx.restore();
      }

      if (poseSnap && poseSnap.emotionBubble) {
        const isText = poseSnap.emotionBubble.kind === 'text';
        const bubbleX = isText
          ? vf.x + vf.w * 0.65 + (tr.swayX || 0) * 0.3
          : Math.min(vf.x + vf.w - 22, vf.x + vf.w / 2 + (tr.swayX || 0) * 0.5 + 27);
        const bubbleY = zoom > 1.35 ? vf.y + 42 : 100 + (tr.bobY || 0) + (tr.jumpY || 0) * 0.45;
        ctx.save();
        ctx.beginPath();
        ctx.rect(vf.x, vf.y, vf.w, vf.h);
        ctx.clip();
        drawEmotionBubble(ctx, poseSnap.emotionBubble, bubbleX, bubbleY, member);
        ctx.restore();
      }
    }

    function drawMemberAvatar(avCanvas, m) {
      if (!avCanvas) return;
      const avCtx = avCanvas.getContext('2d');
      avCtx.imageSmoothingEnabled = false;
      px(avCtx, 0, 0, 36, 36, '#151029');
      px(avCtx, 2, 2, 32, 32, hexToRgba(m.isDarkColor ? '#A1A1AA' : m.color, 0.22));

      const spriteImg = getActiveSprite(m.id, 'main', m.id === 'member_1' ? state.lanHairStyle : null);
      const spriteSize = getSpriteSize(spriteImg);
      if (spriteSize) {
        const sw = spriteSize.w;
        const sh = spriteSize.h;
        // Center upper-portrait slice inside 36x36 avatar
        const cropSize = Math.round(Math.min(sw * 0.48, sh * 0.36));
        const sx = Math.max(0, Math.round((sw - cropSize) / 2));
        const sy = Math.max(0, Math.round(sh * 0.04));
        avCtx.drawImage(spriteImg, sx, sy, cropSize, cropSize, 2, 2, 32, 32);
        return;
      }

      drawIdol(avCtx, m, 0, 'AIMING', {
        pixelSize: 1,
        cx: 18,
        cy: 22,
        staticPose: true
      });
    }

    function refreshAllAvatars(targetMemberId) {
      CONFIG.MEMBERS.forEach((m) => {
        if (!targetMemberId || targetMemberId === m.id) {
          if (state.avatarCanvases[m.id]) {
            drawMemberAvatar(state.avatarCanvases[m.id], m);
          }
        }
      });
    }

    function getCurrentMember() {
      return state.isGroupMode ? CONFIG.GROUP_MEMBER : CONFIG.MEMBERS[state.memberIndex];
    }

    function getCurrentBg() {
      return CONFIG.BACKGROUNDS[state.bgIndex];
    }

    function showModalToast(msg, isError) {
      el.modalToast.textContent = msg;
      el.modalToast.classList.toggle('is-error', Boolean(isError));
      el.modalToast.classList.remove('hidden');
      if (state.toastTimerId) {
        global.clearTimeout(state.toastTimerId);
      }
      state.toastTimerId = global.setTimeout(() => {
        el.modalToast.classList.add('hidden');
      }, isError ? 4200 : 2200);
    }

    function showGlobalToast(msg) {
      el.globalToast.textContent = msg;
      el.globalToast.classList.remove('hidden');
      if (state.globalToastTimerId) {
        global.clearTimeout(state.globalToastTimerId);
      }
      state.globalToastTimerId = global.setTimeout(() => {
        el.globalToast.classList.add('hidden');
      }, 2200);
    }

    function applyMemberTheme() {
      const m = getCurrentMember();
      appEl.setAttribute('data-member', m.id);
      appEl.style.setProperty('--oshi-color', m.color);
      appEl.style.setProperty('--oshi-light', m.lightColor);
      appEl.style.setProperty('--oshi-accent', m.accentColor || m.color);
      appEl.style.setProperty('--oshi-dark', m.darkColor);

      el.memberName.textContent = m.name;
      el.memberTag.textContent = m.colorTag;

      state.memberButtons.forEach((btn, idx) => {
        const isActive = !state.isGroupMode && idx === state.memberIndex;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-pressed', String(isActive));
      });

      if (state.groupButton) {
        state.groupButton.classList.toggle('active', state.isGroupMode);
        state.groupButton.setAttribute('aria-pressed', String(state.isGroupMode));
      }

      applyBackgroundLabel();
    }

    function updatePoseHudBadge() {
      if (!el.poseHudBadge) return;
      el.poseHudBadge.classList.toggle('is-hidden-group', state.isGroupMode);
      if (state.isGroupMode || !poseController || !Poses) {
        state.lastHudBadgeKey = '';
        return;
      }
      const pose = poseController.currentPose;
      const key = `${pose.id}:${pose.rarity}`;
      if (key === state.lastHudBadgeKey) return;
      state.lastHudBadgeKey = key;

      const rStyle = Poses.RARITY_STYLES[pose.rarity] || Poses.RARITY_STYLES.N;
      el.poseHudBadge.textContent = `[${pose.rarity} ${pose.name}]`;
      el.poseHudBadge.style.setProperty('--badge-bg', rStyle.bg);
      el.poseHudBadge.style.setProperty('--badge-border', rStyle.border);
      el.poseHudBadge.style.setProperty('--badge-text', rStyle.text);
    }

    function updateFramingUI() {
      if (!el.btnFraming) return;
      el.btnFraming.classList.toggle('is-hidden-group', state.isGroupMode);
      const fm = FRAMING_MODES[state.framingIndex] || FRAMING_MODES[0];
      el.btnFraming.textContent = fm.label;
      el.btnFraming.setAttribute('data-framing', fm.id);
    }

    function updateHairToggleUI() {
      if (!el.btnHairToggle) return;
      const showHairBtn = !state.isGroupMode && getCurrentMember().id === 'member_1';
      el.btnHairToggle.classList.toggle('hidden', !showHairBtn);
      el.btnHairToggle.classList.toggle('is-hidden-group', state.isGroupMode);
      if (showHairBtn) {
        const isShort = state.lanHairStyle === 'short';
        el.btnHairToggle.textContent = isShort ? '发型：短发' : '发型：长发';
        el.btnHairToggle.classList.toggle('is-short', isShort);
      }
    }

    function toggleLanHair() {
      if (state.mode !== 'AIMING' || state.isGroupMode || getCurrentMember().id !== 'member_1') return;
      state.lanHairStyle = state.lanHairStyle === 'short' ? 'long' : 'short';
      savePref(CONFIG.HAIR_PREF_STORAGE_KEY || 'f1owsec_hair_pref_v1', state.lanHairStyle);
      const grpLan = state.groupItems.find((it) => it.memberId === 'member_1');
      if (grpLan) {
        grpLan.hairStyle = state.lanHairStyle;
      }
      const curSlot = (poseController && poseController.activeSpriteSlot) || 'main';
      if (AssetsManager && typeof AssetsManager.prioritizeMember === 'function') {
        AssetsManager.prioritizeMember('member_1', state.lanHairStyle);
        if (typeof AssetsManager.prioritizeSlot === 'function') {
          AssetsManager.prioritizeSlot('member_1', curSlot, state.lanHairStyle, 0);
        }
      }
      updateHairToggleUI();
      refreshAllAvatars('member_1');
      AudioManager.playUiClick();
      const isShort = state.lanHairStyle === 'short';
      const isPending = AssetsManager &&
        typeof AssetsManager.isSlotPending === 'function' &&
        AssetsManager.isSlotPending('member_1', curSlot, state.lanHairStyle) &&
        !AssetsManager.isSlotLoaded('member_1', curSlot, state.lanHairStyle);
      showGlobalToast(
        isPending
          ? `★ ${isShort ? '短发' : '长发'}立绘加载中…`
          : `★ 蓝已切换为${isShort ? '短发' : '长发'}造型！`
      );
    }

    function buildGroupMemberTabs() {
      if (!el.groupMemberTabs) return;
      el.groupMemberTabs.innerHTML = '';
      state.groupMemberTabBtns = [];
      CONFIG.MEMBERS.forEach((m) => {
        const tab = document.createElement('button');
        tab.type = 'button';
        tab.className = 'grp-member-tab';
        tab.textContent = m.name;
        tab.setAttribute('role', 'tab');
        tab.setAttribute('aria-selected', 'false');
        tab.setAttribute('data-member-id', m.id);
        tab.style.setProperty('--tab-color', m.color);
        tab.style.setProperty('--tab-bg', m.isDarkColor ? '#3F3F46' : m.color);
        tab.style.setProperty('--tab-border', m.isDarkColor ? '#E4E4E7' : (m.lightColor || '#FFFFFF'));
        tab.addEventListener('click', () => {
          selectGroupMemberById(m.id);
        });
        el.groupMemberTabs.appendChild(tab);
        state.groupMemberTabBtns.push(tab);
      });
    }

    function selectGroupMemberById(memberId) {
      if (!state.isGroupMode || state.mode !== 'AIMING' || !memberId) return;
      state.selectedGroupMemberId = memberId;
      AudioManager.playUiClick();
      updateGroupStudioBar();
    }

    function updateGroupStudioBar() {
      if (el.groupMemberTabs) {
        el.groupMemberTabs.classList.toggle('hidden', !state.isGroupMode);
        state.groupMemberTabBtns.forEach((btn) => {
          const isSel = state.isGroupMode && btn.getAttribute('data-member-id') === state.selectedGroupMemberId;
          btn.classList.toggle('is-selected', isSel);
          btn.setAttribute('aria-selected', String(isSel));
        });
      }

      if (!el.groupStudioBar) return;
      const selected = state.isGroupMode && state.selectedGroupMemberId
        ? CONFIG.MEMBERS.find((m) => m.id === state.selectedGroupMemberId)
        : null;
      if (!selected) {
        el.groupStudioBar.classList.add('hidden');
        return;
      }
      el.groupStudioBar.classList.remove('hidden');
      if (el.grpSelectedName) {
        el.grpSelectedName.textContent = selected.name;
        el.grpSelectedName.style.setProperty('--grp-chip-color', selected.isDarkColor ? '#3F3F46' : selected.color);
      }
      if (el.btnGrpHair) {
        el.btnGrpHair.classList.toggle('hidden', selected.id !== 'member_1');
      }
      if (el.btnGrpSoul) {
        const allUnlocked = AlbumManager && AlbumManager.isAllPosesCompleted && AlbumManager.isAllPosesCompleted();
        el.btnGrpSoul.classList.toggle('hidden', !allUnlocked);
        el.btnGrpSoul.classList.toggle('is-active', allUnlocked && state.groupSoulModeIndex >= 0);
      }
    }

    function applyBackgroundLabel() {
      if (state.isGroupMode) {
        el.bgLabel.textContent = '★ 星光纪念';
        el.btnBgSwitch.disabled = true;
      } else {
        const bg = getCurrentBg();
        el.bgLabel.textContent = `${state.bgIndex + 1}/${CONFIG.BACKGROUNDS.length} ${bg.shortName}`;
        el.btnBgSwitch.disabled = false;
      }
      if (el.btnPoseSwitch) {
        el.btnPoseSwitch.classList.toggle('is-hidden-group', state.isGroupMode);
      }
      if (el.btnCall) {
        el.btnCall.classList.toggle('is-hidden-group', state.isGroupMode);
      }
      if (el.timeoutOverlay) {
        el.timeoutOverlay.classList.toggle('hidden', state.isGroupMode || !state.timerExpired);
      }
      el.btnShutter.disabled = !state.isGroupMode && state.timerExpired;
      updateFramingUI();
      updateHairToggleUI();
      updatePoseHudBadge();
      updateGroupStudioBar();
    }

    function applyMuteState() {
      const muted = AudioManager.isMuted();
      el.btnMute.classList.toggle('is-muted', muted);
      el.btnMute.setAttribute('aria-pressed', String(muted));
      el.iconSoundOn.classList.toggle('hidden', muted);
      el.iconSoundOff.classList.toggle('hidden', !muted);
    }

    function buildMemberBar(groupUnlocked) {
      el.memberBar.innerHTML = '';
      state.memberButtons = [];
      state.avatarCanvases = {};
      state.groupButton = null;
      el.memberBar.classList.toggle('has-group', Boolean(groupUnlocked));

      CONFIG.MEMBERS.forEach((m, idx) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'member-btn';
        btn.style.setProperty('--btn-color', m.color);
        btn.style.setProperty('--btn-accent', m.accentColor || m.color);
        btn.setAttribute('aria-label', `切换到${m.name}`);

        const avatarWrap = document.createElement('span');
        avatarWrap.className = 'avatar-wrap';

        const avCanvas = document.createElement('canvas');
        avCanvas.width = 36;
        avCanvas.height = 36;
        avCanvas.className = 'member-avatar-canvas';
        state.avatarCanvases[m.id] = avCanvas;
        drawMemberAvatar(avCanvas, m);

        avatarWrap.appendChild(avCanvas);

        const nameSpan = document.createElement('span');
        nameSpan.className = 'member-btn-name';
        nameSpan.textContent = m.name;

        btn.appendChild(avatarWrap);
        btn.appendChild(nameSpan);

        btn.addEventListener('click', () => {
          selectMember(idx);
        });

        el.memberBar.appendChild(btn);
        state.memberButtons.push(btn);
      });

      if (groupUnlocked) {
        const gBtn = document.createElement('button');
        gBtn.type = 'button';
        gBtn.className = 'member-btn member-btn-group';
        gBtn.style.setProperty('--btn-color', '#FACC15');
        gBtn.style.setProperty('--btn-accent', '#FACC15');
        gBtn.setAttribute('aria-label', '切换到全员团切');

        const avatarWrap = document.createElement('span');
        avatarWrap.className = 'avatar-wrap';

        const gCanvas = document.createElement('canvas');
        gCanvas.width = 36;
        gCanvas.height = 36;
        gCanvas.className = 'member-avatar-canvas';
        const gCtx = gCanvas.getContext('2d');
        gCtx.imageSmoothingEnabled = false;

        px(gCtx, 0, 0, 36, 36, '#241247');
        const cols = CONFIG.MEMBERS.map((m) => m.color);
        cols.forEach((c, i) => {
          px(gCtx, 3 + i * 6, 3, 5, 4, c);
          px(gCtx, 3 + i * 6, 29, 5, 4, c);
        });
        drawPixelStar(gCtx, 18, 17, 7, '#FACC15', '#FFFFFF');
        drawPixelStar(gCtx, 10, 12, 2, '#93C5FD', '#FFFFFF');
        drawPixelStar(gCtx, 26, 12, 2, '#FBCFE8', '#FFFFFF');

        avatarWrap.appendChild(gCanvas);

        const nameSpan = document.createElement('span');
        nameSpan.className = 'member-btn-name';
        nameSpan.textContent = '全员团切';

        gBtn.appendChild(avatarWrap);
        gBtn.appendChild(nameSpan);

        gBtn.addEventListener('click', () => {
          selectGroupMode();
        });

        el.memberBar.appendChild(gBtn);
        state.groupButton = gBtn;
      }
    }

    function refreshCollectionUI() {
      const count = AlbumManager.getCount();
      el.albumCountBadge.textContent = String(count);

      const collectedIds = AlbumManager.getCollectedMemberIds();
      const collectedCount = collectedIds.size;
      const unlocked = AlbumManager.isGroupUnlocked();

      el.collectionLabel.textContent = unlocked
        ? '★ 5/5 全员团切已解锁'
        : `集邮 ${collectedCount}/5`;
      el.collectionLabel.classList.toggle('is-complete', unlocked);

      el.collectionStars.innerHTML = '';
      CONFIG.MEMBERS.forEach((m) => {
        const isLit = collectedIds.has(m.id);
        const pip = document.createElement('span');
        pip.className = `star-pip${isLit ? ' is-lit' : ''}`;
        pip.style.setProperty('--star-color', m.isDarkColor ? '#D4D4D8' : m.color);
        pip.title = `${m.name}: ${isLit ? '已集邮' : '未集邮'}`;

        const fillCol = isLit ? m.color : 'none';
        const strokeCol = isLit ? '#FFFFFF' : (m.isDarkColor ? '#A1A1AA' : m.color);
        pip.innerHTML = `<svg viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true"><polygon points="8,1 10,6 15,6 11,9 12,14 8,11 4,14 5,9 1,6 6,6" fill="${fillCol}" stroke="${strokeCol}" stroke-width="1.4"/></svg>`;
        el.collectionStars.appendChild(pip);
      });

      const hadGroup = Boolean(state.groupButton);
      if (hadGroup !== unlocked || state.memberButtons.length === 0) {
        if (!unlocked && state.isGroupMode) {
          state.isGroupMode = false;
          state.memberIndex = 0;
        }
        buildMemberBar(unlocked);
      }
      applyMemberTheme();
    }

    function hideGroupNameHint() {
      if (state.groupNameHintTimerId) {
        global.clearTimeout(state.groupNameHintTimerId);
        state.groupNameHintTimerId = null;
      }
      if (state.groupNameHintFadeTimerId) {
        global.clearTimeout(state.groupNameHintFadeTimerId);
        state.groupNameHintFadeTimerId = null;
      }
      if (el.groupNameHint) {
        el.groupNameHint.classList.add('hidden');
        el.groupNameHint.classList.remove('is-fading');
      }
    }

    function triggerGroupNameHint() {
      if (!el.groupNameHint) return;
      hideGroupNameHint();
      el.groupNameHint.classList.remove('hidden');
      state.groupNameHintFadeTimerId = global.setTimeout(() => {
        if (el.groupNameHint) el.groupNameHint.classList.add('is-fading');
      }, 2600);
      state.groupNameHintTimerId = global.setTimeout(() => {
        hideGroupNameHint();
      }, 3000);
    }

    function hideGroupGuide() {
      if (state.groupGuideTimerId) {
        global.clearTimeout(state.groupGuideTimerId);
        state.groupGuideTimerId = null;
      }
      if (state.groupGuideFadeTimerId) {
        global.clearTimeout(state.groupGuideFadeTimerId);
        state.groupGuideFadeTimerId = null;
      }
      if (el.groupGuideToast) {
        el.groupGuideToast.classList.add('hidden');
        el.groupGuideToast.classList.remove('is-fading');
      }
    }

    function triggerGroupGuideIfNeeded() {
      if (!el.groupGuideToast) return;
      const guideKey = CONFIG.GROUP_GUIDE_STORAGE_KEY || 'f1owsec_group_guide_seen_v1';
      if (loadSavedPref(guideKey, '') === '1') return;
      savePref(guideKey, '1');
      hideGroupGuide();
      el.groupGuideToast.classList.remove('hidden');
      state.groupGuideFadeTimerId = global.setTimeout(() => {
        if (el.groupGuideToast) el.groupGuideToast.classList.add('is-fading');
      }, 2600);
      state.groupGuideTimerId = global.setTimeout(() => {
        hideGroupGuide();
      }, 3000);
    }

    function getLastTenContext() {
      const m = getCurrentMember();
      const isLastTen = !state.isGroupMode && state.timerSeconds > 0 && state.timerSeconds <= 10;
      const uncollectedIds = (isLastTen && m && m.id && AlbumManager.getMemberUncollectedPoses)
        ? AlbumManager.getMemberUncollectedPoses(m.id)
        : null;
      return {
        isLastTenSeconds: isLastTen,
        uncollectedIds
      };
    }

    function renewTicket() {
      state.timerSeconds = 60;
      state.timerExpired = false;
      state.lastTenBubbleCooldown = 0;
      if (el.timeoutOverlay) {
        el.timeoutOverlay.classList.add('hidden');
      }
      if (state.mode === 'AIMING') {
        el.btnShutter.disabled = false;
      }
      AudioManager.playUiClick();
      showGlobalToast('★ 已续券！特典会拍立得时间重置 60 秒');
    }

    function openStartScreen() {
      if (!el.startScreen) return;
      if (state.mode === 'DEVELOPING' || state.mode === 'DIY' || state.mode === 'ALBUM') return;
      AudioManager.playUiClick();
      state.mode = 'START';
      if (el.nicknameInput) {
        el.nicknameInput.value = state.nickname || '';
      }
      el.startScreen.classList.remove('hidden');
    }

    function enterFromTicket() {
      if (state.enteringTicket) return;

      if (el.nicknameInput) {
        const cleanNick = String(el.nicknameInput.value || '').trim().slice(0, 10);
        state.nickname = cleanNick;
        el.nicknameInput.value = cleanNick;
        savePref(CONFIG.NICKNAME_STORAGE_KEY || 'f1owsec_nickname_v1', cleanNick);
      }

      const completeEntry = (skipSound) => {
        state.enteringTicket = false;
        if (el.btnEnterTicket) {
          el.btnEnterTicket.disabled = false;
          el.btnEnterTicket.textContent = '检票入场';
        }
        if (el.startScreen) {
          el.startScreen.classList.add('hidden');
        }
        state.mode = 'AIMING';
        if (!skipSound) {
          AudioManager.playUiClick();
        }
      };

      if (
        AssetsManager &&
        typeof AssetsManager.isCriticalReady === 'function' &&
        !AssetsManager.isCriticalReady() &&
        typeof AssetsManager.preloadCritical === 'function'
      ) {
        state.enteringTicket = true;
        AudioManager.playUiClick();
        if (el.btnEnterTicket) {
          el.btnEnterTicket.disabled = true;
          el.btnEnterTicket.textContent = '立绘加载中…';
        }
        AssetsManager.preloadCritical(3500).then(
          () => completeEntry(true),
          () => completeEntry(true)
        );
        return;
      }

      completeEntry(false);
    }

    function selectMember(index) {
      if (state.mode !== 'AIMING') return;
      if (!state.isGroupMode && index === state.memberIndex) return;
      state.isGroupMode = false;
      state.selectedGroupMemberId = null;
      state.groupDragging = false;
      state.callTrails = [];
      hideGroupGuide();
      hideGroupNameHint();
      state.memberIndex = index;
      const nextMember = getCurrentMember();
      if (AssetsManager && nextMember && typeof AssetsManager.prioritizeMember === 'function') {
        const nextHair = nextMember.id === 'member_1' ? state.lanHairStyle : null;
        AssetsManager.prioritizeMember(nextMember.id, nextHair);
        if (
          typeof AssetsManager.isSlotPending === 'function' &&
          AssetsManager.isSlotPending(nextMember.id, 'main', nextHair) &&
          !AssetsManager.isSlotLoaded(nextMember.id, 'main', nextHair)
        ) {
          showGlobalToast(`★ ${nextMember.name}立绘加载中…`);
        }
      }
      if (poseController) {
        poseController.resetForMember(nextMember);
      }
      applyMemberTheme();
      AudioManager.playSwitch();
    }

    function selectGroupMode() {
      if (state.mode !== 'AIMING') return;
      if (!AlbumManager.isGroupUnlocked()) return;
      if (state.isGroupMode) return;
      state.isGroupMode = true;
      state.groupDragging = false;
      state.callTrails = [];
      if (!state.selectedGroupMemberId && state.groupItems.length > 0) {
        state.selectedGroupMemberId = 'member_1';
      }
      if (poseController) {
        poseController.resetForMember(null);
      }
      applyMemberTheme();
      triggerGroupGuideIfNeeded();
      triggerGroupNameHint();
      AudioManager.playSwitch();
    }

    function cycleFraming() {
      if (state.mode !== 'AIMING' || state.isGroupMode) return;
      state.framingIndex = (state.framingIndex + 1) % FRAMING_MODES.length;
      updateFramingUI();
      AudioManager.playUiClick();
    }

    function triggerCall() {
      if (state.mode !== 'AIMING' || state.isGroupMode || !poseController) return;
      const member = getCurrentMember();
      const phrase = poseController.triggerCallBoost(member);
      AudioManager.playStickerPlace();
      updateCallButtonUI();
      showGlobalToast(`♥ 夸夸成功：${phrase}（SR/SSR概率提升）`);
    }

    function updateCallButtonUI() {
      if (!el.btnCall || !poseController) return;
      el.btnCall.classList.toggle('is-boosted', poseController.callRareBoostTimer > 0 && !state.isGroupMode);
    }

    function getSelectedGroupItem() {
      if (!state.selectedGroupMemberId) return null;
      return state.groupItems.find((it) => it.memberId === state.selectedGroupMemberId) || null;
    }

    function cycleSelectedGroupPose() {
      const item = getSelectedGroupItem();
      if (!item || !state.isGroupMode || state.mode !== 'AIMING') return;
      const idx = SPRITE_SLOTS.indexOf(item.spriteSlot || 'main');
      const nextSlot = SPRITE_SLOTS[(idx + 1) % SPRITE_SLOTS.length];
      item.spriteSlot = nextSlot;
      const hairStyle = item.memberId === 'member_1' ? (item.hairStyle || state.lanHairStyle) : null;
      if (AssetsManager && typeof AssetsManager.prioritizeSlot === 'function') {
        AssetsManager.prioritizeSlot(item.memberId, nextSlot, hairStyle, 1);
      }
      AudioManager.playUiClick();
      if (
        AssetsManager &&
        typeof AssetsManager.isSlotPending === 'function' &&
        AssetsManager.isSlotPending(item.memberId, nextSlot, hairStyle) &&
        !AssetsManager.isSlotLoaded(item.memberId, nextSlot, hairStyle)
      ) {
        showGlobalToast('★ 动作立绘加载中…');
      }
    }

    function cycleSelectedGroupHair() {
      const item = getSelectedGroupItem();
      if (!item || item.memberId !== 'member_1' || !state.isGroupMode || state.mode !== 'AIMING') return;
      item.hairStyle = item.hairStyle === 'short' ? 'long' : 'short';
      state.lanHairStyle = item.hairStyle;
      savePref(CONFIG.HAIR_PREF_STORAGE_KEY || 'f1owsec_hair_pref_v1', state.lanHairStyle);
      const curSlot = item.spriteSlot || 'main';
      if (AssetsManager && typeof AssetsManager.prioritizeMember === 'function') {
        AssetsManager.prioritizeMember('member_1', item.hairStyle);
        if (typeof AssetsManager.prioritizeSlot === 'function') {
          AssetsManager.prioritizeSlot('member_1', curSlot, item.hairStyle, 0);
        }
      }
      refreshAllAvatars('member_1');
      AudioManager.playUiClick();
      const isShort = item.hairStyle === 'short';
      const isPending = AssetsManager &&
        typeof AssetsManager.isSlotPending === 'function' &&
        AssetsManager.isSlotPending('member_1', curSlot, item.hairStyle) &&
        !AssetsManager.isSlotLoaded('member_1', curSlot, item.hairStyle);
      showGlobalToast(
        isPending
          ? `★ ${isShort ? '短发' : '长发'}立绘加载中…`
          : `★ 蓝已切换为${isShort ? '短发' : '长发'}造型！`
      );
    }

    function flipSelectedGroupItem() {
      const item = getSelectedGroupItem();
      if (!item || !state.isGroupMode || state.mode !== 'AIMING') return;
      item.flipX = !item.flipX;
      AudioManager.playUiClick();
    }

    function scaleSelectedGroupItem(delta) {
      const item = getSelectedGroupItem();
      if (!item || !state.isGroupMode || state.mode !== 'AIMING') return;
      item.scale = Math.max(0.55, Math.min(1.65, Math.round((item.scale + delta) * 100) / 100));
      AudioManager.playUiClick();
    }

    function bringSelectedGroupItemTop() {
      const idx = state.groupItems.findIndex((it) => it.memberId === state.selectedGroupMemberId);
      if (idx < 0 || !state.isGroupMode || state.mode !== 'AIMING') return;
      const [item] = state.groupItems.splice(idx, 1);
      state.groupItems.push(item);
      AudioManager.playUiClick();
    }

    function cycleGroupSoulMode() {
      if (!state.isGroupMode || state.mode !== 'AIMING') return;
      if (!AlbumManager || !AlbumManager.isAllPosesCompleted || !AlbumManager.isAllPosesCompleted()) return;

      state.groupSoulModeIndex = (state.groupSoulModeIndex + 1) % 3;
      const vf = CONFIG.GROUP_VIEWFINDER;

      if (state.groupSoulModeIndex === 0) {
        // 1. 全员比心：5 人统一切换至 pose4，并排成后排 3 人、前排 2 人的居中错落站位
        state.groupStarlightSea = false;
        const hairPref = state.lanHairStyle;
        state.groupItems = [
          { memberId: 'member_4', x: 68, y: 290, scale: 0.94, flipX: false, spriteSlot: 'pose4' },
          { memberId: 'member_1', x: 135, y: 288, scale: 0.96, flipX: false, spriteSlot: 'pose4', hairStyle: hairPref },
          { memberId: 'member_5', x: 202, y: 290, scale: 0.94, flipX: false, spriteSlot: 'pose4' },
          { memberId: 'member_2', x: 96, y: 318, scale: 1.04, flipX: false, spriteSlot: 'pose4' },
          { memberId: 'member_3', x: 174, y: 318, scale: 1.04, flipX: false, spriteSlot: 'pose4' }
        ];
        AudioManager.playStickerPlace();
        showGlobalToast('★ 团魂定格：全员比心 ♥');
      } else if (state.groupSoulModeIndex === 1) {
        // 2. 全员歪头：5 人统一切换至 pose3 并微调居中
        state.groupStarlightSea = false;
        const count = state.groupItems.length || 1;
        const avgX = state.groupItems.reduce((sum, it) => sum + (it.x || 135), 0) / count;
        const shiftX = Math.round(135 - avgX);
        state.groupItems.forEach((it) => {
          it.spriteSlot = 'pose3';
          if (Math.abs(shiftX) >= 4) {
            it.x = Math.max(vf.x + 26, Math.min(vf.x + vf.w - 26, it.x + shiftX));
          }
        });
        AudioManager.playStickerPlace();
        showGlobalToast('★ 团魂定格：全员歪头 ♪');
      } else {
        // 3. 星海应援：叠加 5 位成员应援色的柔和像素星芒光效
        state.groupStarlightSea = true;
        AudioManager.playUnlockFanfare();
        showGlobalToast('★ 团魂定格：星海应援 ✦');
      }

      updateGroupStudioBar();
    }

    function clientToStageLogicalCoords(clientX, clientY) {
      const rect = stageCanvas.getBoundingClientRect ? stageCanvas.getBoundingClientRect() : null;
      if (!rect || !rect.width || !rect.height) {
        return { x: CONFIG.CANVAS_WIDTH / 2, y: CONFIG.CANVAS_HEIGHT / 2 };
      }
      return {
        x: ((clientX - rect.left) / rect.width) * CONFIG.CANVAS_WIDTH,
        y: ((clientY - rect.top) / rect.height) * CONFIG.CANVAS_HEIGHT
      };
    }

    function handleStageDown(lx, ly) {
      if (!state.isGroupMode || state.mode !== 'AIMING') return false;
      const vf = CONFIG.GROUP_VIEWFINDER;
      if (lx < vf.x || lx > vf.x + vf.w || ly < vf.y || ly > vf.y + vf.h) {
        return false;
      }

      let hitItem = null;
      const pad = 6;
      if (state.selectedGroupMemberId) {
        const curSel = state.groupItems.find((it) => it.memberId === state.selectedGroupMemberId);
        if (curSel) {
          const selMember = CONFIG.MEMBERS.find((m) => m.id === curSel.memberId);
          const selHair = curSel.hairStyle || (curSel.memberId === 'member_1' ? state.lanHairStyle : null);
          const selSprite = getActiveSprite(curSel.memberId, curSel.spriteSlot || 'main', selHair);
          const selBox = getGroupItemRect(curSel, selSprite, selMember);
          if (lx >= selBox.x - pad && lx <= selBox.x + selBox.w + pad && ly >= selBox.y - pad && ly <= selBox.y + selBox.h + pad) {
            hitItem = curSel;
          }
        }
      }
      if (!hitItem) {
        for (let i = state.groupItems.length - 1; i >= 0; i -= 1) {
          const item = state.groupItems[i];
          const member = CONFIG.MEMBERS.find((m) => m.id === item.memberId);
          const hairStyle = item.hairStyle || (item.memberId === 'member_1' ? state.lanHairStyle : null);
          const spriteImg = getActiveSprite(item.memberId, item.spriteSlot || 'main', hairStyle);
          const box = getGroupItemRect(item, spriteImg, member);
          if (lx >= box.x - pad && lx <= box.x + box.w + pad && ly >= box.y - pad && ly <= box.y + box.h + pad) {
            hitItem = item;
            break;
          }
        }
      }

      if (hitItem) {
        state.selectedGroupMemberId = hitItem.memberId;
        state.groupDragging = true;
        state.groupDragOffsetX = hitItem.x - lx;
        state.groupDragOffsetY = hitItem.y - ly;
        AudioManager.playUiClick();
        updateGroupStudioBar();
      } else {
        state.selectedGroupMemberId = null;
        state.groupDragging = false;
        updateGroupStudioBar();
      }
      return true;
    }

    function handleStageMove(lx, ly) {
      if (!state.isGroupMode || state.mode !== 'AIMING' || !state.groupDragging) return false;
      const item = getSelectedGroupItem();
      if (!item) return false;
      const vf = CONFIG.GROUP_VIEWFINDER;
      item.x = Math.max(vf.x + 12, Math.min(vf.x + vf.w - 12, Math.round((lx + state.groupDragOffsetX) * 2) / 2));
      item.y = Math.max(vf.y + 48, Math.min(vf.y + vf.h + 120, Math.round((ly + state.groupDragOffsetY) * 2) / 2));
      return true;
    }

    function handleStageUp() {
      state.groupDragging = false;
    }

    function handleManualPoseSwitch() {
      if (state.mode !== 'AIMING' || state.isGroupMode || !poseController) return;
      const curMember = getCurrentMember();
      const switchOpts = Object.assign({}, getLastTenContext(), {
        sequential: state.gameMode === 'easy'
      });
      if (poseController.triggerManualSwitch(curMember, switchOpts)) {
        AudioManager.playUiClick();
        updatePoseButtonUI();
        updatePoseHudBadge();
        const targetSlot = poseController.activeSpriteSlot || 'main';
        const hairStyle = curMember && curMember.id === 'member_1' ? state.lanHairStyle : null;
        if (AssetsManager && curMember && typeof AssetsManager.prioritizeSlot === 'function') {
          AssetsManager.prioritizeSlot(curMember.id, targetSlot, hairStyle, 1);
          if (
            typeof AssetsManager.isSlotPending === 'function' &&
            AssetsManager.isSlotPending(curMember.id, targetSlot, hairStyle) &&
            !AssetsManager.isSlotLoaded(curMember.id, targetSlot, hairStyle)
          ) {
            showGlobalToast('★ 动作立绘加载中…');
          }
        }
      }
    }

    function updatePoseButtonUI() {
      if (!el.btnPoseSwitch || !poseController) return;
      const ratio = poseController.getCooldownProgress();
      el.btnPoseSwitch.disabled = ratio > 0 || state.isGroupMode;
      if (el.poseCooldownFill) {
        el.poseCooldownFill.style.width = `${Math.round(ratio * 100)}%`;
      }
    }

    function cycleBackground() {
      if (state.mode !== 'AIMING' || state.isGroupMode) return;
      state.bgIndex = (state.bgIndex + 1) % CONFIG.BACKGROUNDS.length;
      applyBackgroundLabel();
      AudioManager.playBgSwitch();
    }

    function toggleMute() {
      AudioManager.toggleMute();
      applyMuteState();
    }

    function evaluateJudgment(cursorPos) {
      if (state.gameMode === 'easy') {
        return CONFIG.JUDGMENTS.PERFECT;
      }
      const dist = Math.abs(cursorPos - 0.5);
      if (dist <= CONFIG.RHYTHM_BAR.perfectHalf) {
        return CONFIG.JUDGMENTS.PERFECT;
      }
      if (dist <= CONFIG.RHYTHM_BAR.greatHalf) {
        return CONFIG.JUDGMENTS.GREAT;
      }
      return CONFIG.JUDGMENTS.GOOD;
    }

    function triggerShutter() {
      if (state.mode !== 'AIMING') return;
      if (!state.isGroupMode && state.timerExpired) return;

      state.mode = 'CAPTURING';
      state.groupDragging = false;
      el.btnShutter.disabled = true;
      el.btnShutter.classList.add('is-pressed');

      const isGroup = state.isGroupMode;
      const member = getCurrentMember();
      const bgId = isGroup ? 'group-memorial' : getCurrentBg().id;
      const judgment = evaluateJudgment(state.cursorPos);
      const poseSnap = (!isGroup && poseController) ? poseController.snapshot(state.time) : null;
      const poseObj = poseSnap ? poseSnap.pose : null;
      const isNewPose = Boolean(!isGroup && poseObj && !AlbumManager.isPoseUnlocked(member.id, poseObj.id));
      const isHolo = Boolean(!isGroup && AlbumManager.isMemberHoloUnlocked(member.id));

      // Render clean 1080x1920 offscreen HD scene (no HUD, no selection box, no flash)
      const vf = isGroup ? CONFIG.GROUP_VIEWFINDER : CONFIG.VIEWFINDER;
      captureCtx.imageSmoothingEnabled = false;
      captureCtx.clearRect(0, 0, captureCanvas.width, captureCanvas.height);
      captureCtx.save();
      captureCtx.scale(CAPTURE_SCALE, CAPTURE_SCALE);
      if (isGroup) {
        drawBackground(captureCtx, bgId, member, state.time);
        if (state.groupStarlightSea) {
          drawGroupStarlightSea(captureCtx, state.time, vf);
        }
        drawGroupIdols(captureCtx, state.time, 'CAPTURING', {
          groupItems: state.groupItems,
          getSprite: getActiveSprite,
          nativeScale: CAPTURE_SCALE,
          defaultLanHairStyle: state.lanHairStyle,
          showSelection: false
        });
      } else {
        renderSoloStageScene(captureCtx, bgId, member, state.time, 'CAPTURING', poseSnap, {
          nativeScale: CAPTURE_SCALE
        });
      }
      captureCtx.restore();

      if (PixelFilter && typeof PixelFilter.applyAtmosphereFilters === 'function') {
        PixelFilter.applyAtmosphereFilters(captureCtx, {
          x: vf.x * CAPTURE_SCALE,
          y: vf.y * CAPTURE_SCALE,
          w: vf.w * CAPTURE_SCALE,
          h: vf.h * CAPTURE_SCALE
        });
      }

      const polaroidCanvas = composePolaroid(captureCanvas, member, judgment, isGroup, {
        pose: poseObj,
        isNewPose,
        isHolo
      });

      // Full-screen flash + 8-bit shutter SFX + particle burst + floating judgment
      state.flashAlpha = 1.0;
      state.banner = {
        text: `${judgment.label}!`,
        color: judgment.color,
        alpha: 1.5
      };
      spawnBurstParticles(state.particles, member, judgment.key, isGroup);

      AudioManager.playShutter();
      global.setTimeout(() => {
        AudioManager.playJudgment(judgment.key);
      }, 90);

      if (state.captureTimerId) {
        global.clearTimeout(state.captureTimerId);
      }

      state.captureTimerId = global.setTimeout(() => {
        openStudioModal(polaroidCanvas, member, judgment, isGroup);
      }, 560);
    }

    // ===== Develop & Sticker DIY Studio =====
    function buildStickerTray() {
      el.stickerTray.innerHTML = '';
      const palette = stickerSession.getPalette();
      palette.forEach((def) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'sticker-btn';
        btn.setAttribute('aria-label', `添加${def.title}贴纸`);

        const iconCanvas = document.createElement('canvas');
        iconCanvas.width = def.isVector ? 72 : 36;
        iconCanvas.height = def.isVector ? 72 : 36;
        iconCanvas.className = `sticker-icon-canvas${def.isVector ? ' is-vector' : ''}`;
        Stickers.renderIconToCanvas(iconCanvas, def, state.lastMember, state.lastIsGroup, state.lastDateStr);

        const label = document.createElement('span');
        label.className = 'sticker-btn-label';
        label.textContent = def.title;

        btn.appendChild(iconCanvas);
        btn.appendChild(label);
        btn.addEventListener('click', () => {
          if (state.mode !== 'DIY') return;
          state.toSignSelected = false;
          state.toSignDragging = false;
          stickerSession.addSticker(def.id);
          markDirtyDiy();
          updateStickerTransformBar();
          updateToSignTransformBar();
          AudioManager.playStickerPlace();
          renderEditorCanvas();
        });

        el.stickerTray.appendChild(btn);
      });
    }

    function updateStickerTransformBar() {
      if (!el.stickerTransformBar) return;
      const show = state.mode === 'DIY' && Boolean(stickerSession.getSelectedItem());
      el.stickerTransformBar.classList.toggle('hidden', !show);
    }

    function updateToSignTransformBar() {
      if (!el.toSignTransformBar) return;
      const show = state.mode === 'DIY' && state.toSignEnabled && state.toSignSelected;
      el.toSignTransformBar.classList.toggle('hidden', !show);
    }

    function hitTestToSign(x, y) {
      if (!state.toSignEnabled || !state.photoRect) return false;
      const m = getToSignMetrics(editorCtx, state.photoRect, getToSignConfig(1, false));
      const dx = x - m.anchorX;
      const dy = y - m.anchorY;
      const cos = Math.cos(-m.angleRad);
      const sin = Math.sin(-m.angleRad);
      const lx = (dx * cos - dy * sin) / m.scale;
      const ly = (dx * sin + dy * cos) / m.scale;
      const pad = 12 / m.scale;
      const b = m.box;
      return (
        lx >= b.left - pad &&
        lx <= b.left + b.w + pad &&
        ly >= b.top - pad &&
        ly <= b.top + b.h + pad
      );
    }

    function updateCompleteStampUI() {
      if (!el.btnCompleteStamp || !AlbumManager) return;
      const unlocked = AlbumManager.isAllPosesCompleted && AlbumManager.isAllPosesCompleted();
      el.btnCompleteStamp.classList.toggle('hidden', !unlocked);
      if (unlocked) {
        el.btnCompleteStamp.classList.toggle('is-on', Boolean(state.completeStampEnabled));
        el.btnCompleteStamp.textContent = state.completeStampEnabled ? '全制霸印章' : '全制霸印章:关';
      }
    }

    function checkAndTriggerAllCompletedCelebration() {
      if (!AlbumManager || !AlbumManager.isAllPosesCompleted || !AlbumManager.isAllPosesCompleted()) return false;
      updateCompleteStampUI();
      updateGroupStudioBar();
      if (AlbumManager.hasCelebratedAllCompleted && !AlbumManager.hasCelebratedAllCompleted()) {
        AlbumManager.markAllCompletedCelebrated();
        AudioManager.playUnlockFanfare();
        if (el.allCompleteModal) {
          el.allCompleteModal.classList.remove('hidden');
        }
        return true;
      }
      return false;
    }

    function markDirtyDiy() {
      state.savedCurrentToAlbum = false;
      el.btnSaveAlbum.textContent = '保存至相册';
    }

    function updateDevelopUI() {
      const pct = Math.min(100, Math.round(state.developProgress * 100));
      el.developBarFill.style.width = `${pct}%`;
      el.developPercent.textContent = `${pct}%`;
    }

    function spawnEditorSparkles(cx, cy, count) {
      const n = count || 5;
      for (let i = 0; i < n; i += 1) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 70 + Math.random() * 140;
        state.developSparkles.push({
          x: cx + (Math.random() - 0.5) * 32,
          y: cy + (Math.random() - 0.5) * 32,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 0.28 + Math.random() * 0.2,
          color: i % 2 === 0 ? '#FFFFFF' : '#FEF08A'
        });
      }
    }

    function addDevelopProgress(delta, cx, cy) {
      if (state.mode !== 'DEVELOPING' || state.developCompleted) return;
      state.developProgress = Math.min(1, state.developProgress + delta);
      updateDevelopUI();

      if (cx != null && cy != null) {
        spawnEditorSparkles(cx, cy, 4);
      }

      const now = Date.now();
      if (now - state.lastRubSfxTime > 65) {
        state.lastRubSfxTime = now;
        AudioManager.playRub(state.developProgress);
      }

      if (state.developProgress >= 1) {
        completeDeveloping();
      }
    }

    function completeDeveloping() {
      if (state.developCompleted) return;
      state.developCompleted = true;
      state.developProgress = 1;
      state.isRubbing = false;
      updateDevelopUI();

      if (state.photoRect) {
        spawnEditorSparkles(
          state.photoRect.x + state.photoRect.w / 2,
          state.photoRect.y + state.photoRect.h / 2,
          18
        );
      }

      AudioManager.playDevelopComplete();
      el.developHint.textContent = '显影完成！进入宿题贴纸 DIY...';

      if (!state.lastIsGroup && state.lastMember && state.lastPoseInfo && state.lastPoseInfo.id && AlbumManager) {
        state.lastDevelopUnlockRes = AlbumManager.unlockPose(state.lastMember.id, state.lastPoseInfo.id);
        refreshCollectionUI();
        updateCompleteStampUI();
      }

      if (state.developTimerId) {
        global.clearTimeout(state.developTimerId);
      }
      state.developTimerId = global.setTimeout(() => {
        if (state.mode !== 'DEVELOPING') return;
        state.mode = 'DIY';
        el.developPanel.classList.add('hidden');
        el.diyPanel.classList.remove('hidden');
        el.editorCanvas.classList.add('is-diy');
        buildStickerTray();
        updateCompleteStampUI();
        updateStickerTransformBar();
        updateToSignTransformBar();
        renderEditorCanvas();
        checkAndTriggerAllCompletedCelebration();
      }, 240);
    }

    function updateToSignUI() {
      if (el.btnToSignToggle) {
        el.btnToSignToggle.textContent = state.toSignEnabled ? 'To签：开' : 'To签：关';
        el.btnToSignToggle.classList.toggle('is-on', state.toSignEnabled);
      }
      if (el.btnToSignColor) {
        const cur = TO_SIGN_COLORS[state.toSignColorIndex] || TO_SIGN_COLORS[0];
        el.btnToSignColor.textContent = `笔迹：${cur.label}`;
      }
    }

    function openStudioModal(polaroidCanvas, member, judgment, isGroup) {
      state.mode = 'DEVELOPING';
      state.basePolaroidCanvas = polaroidCanvas;
      state.photoRect = polaroidCanvas._photoRect || { x: 64, y: 64, w: 760, h: 848 };
      state.lastDateStr = polaroidCanvas._dateStr || formatDateDot(new Date());
      state.lastJudgment = judgment;
      state.lastMember = member;
      state.lastIsGroup = Boolean(isGroup);
      state.lastPoseInfo = polaroidCanvas._poseInfo || null;
      state.lastIsNewPose = Boolean(polaroidCanvas._isNewPose);
      state.lastIsHolo = Boolean(polaroidCanvas._isHolo);
      state.currentSignPhrase = TO_SIGN_PHRASES[Math.floor(Math.random() * TO_SIGN_PHRASES.length)];
      state.currentSignAngleDeg = -3 - Math.random() * 2;
      state.developProgress = 0;
      state.developCompleted = false;
      state.developSparkles = [];
      state.isRubbing = false;
      state.rubMovedDist = 0;
      state.savedCurrentToAlbum = false;
      state.isSavingAlbum = false;
      state.lastDevelopUnlockRes = null;
      state.stickerGesture = null;
      state.toSignX = null;
      state.toSignY = null;
      state.toSignScale = 1.0;
      state.toSignSelected = false;
      state.toSignDragging = false;

      el.btnShutter.classList.remove('is-pressed');
      el.editorCanvas.width = polaroidCanvas.width;
      el.editorCanvas.height = polaroidCanvas.height;
      el.editorCanvas.classList.toggle('is-wide', Boolean(isGroup));
      el.editorCanvas.classList.remove('is-diy');

      const logicalW = polaroidCanvas._logicalW || polaroidCanvas.width;
      const logicalH = polaroidCanvas._logicalH || polaroidCanvas.height;
      stickerSession.reset(
        logicalW,
        logicalH,
        member,
        isGroup,
        state.lastDateStr
      );

      el.modalBadge.textContent = isGroup
        ? `${judgment.stars} ${judgment.label} · 全员团切纪念版`
        : `${judgment.stars} ${judgment.label} · ${judgment.subText}`;
      el.modalBadge.style.color = judgment.color;

      el.developHint.textContent = '滑动擦拭显影';
      updateDevelopUI();
      updateToSignUI();
      updateCompleteStampUI();
      updateStickerTransformBar();
      updateToSignTransformBar();
      el.developPanel.classList.remove('hidden');
      el.diyPanel.classList.add('hidden');
      el.modalToast.classList.add('hidden');
      el.btnSaveAlbum.textContent = '保存至相册';
      el.btnExportPng.textContent = '导出图片';

      el.previewModal.classList.remove('hidden');
      state.shotCount += 1;
      renderEditorCanvas();
    }

    function getToSignConfig(alphaOverride, showSelection) {
      const colorObj = TO_SIGN_COLORS[state.toSignColorIndex] || TO_SIGN_COLORS[0];
      return {
        enabled: state.toSignEnabled,
        nickname: state.nickname,
        phrase: state.currentSignPhrase,
        colorKey: colorObj.key,
        angleDeg: state.currentSignAngleDeg,
        x: state.toSignX,
        y: state.toSignY,
        scale: state.toSignScale,
        showSelection: Boolean(showSelection),
        alpha: alphaOverride
      };
    }

    function renderEditorCanvas(dt) {
      if (!state.basePolaroidCanvas) return;
      const stepDt = dt || 0;
      const w = el.editorCanvas.width;
      const h = el.editorCanvas.height;
      const hd = state.basePolaroidCanvas._hdScale || 1;
      const lw = state.basePolaroidCanvas._logicalW || w;
      const lh = state.basePolaroidCanvas._logicalH || h;

      editorCtx.imageSmoothingEnabled = false;
      editorCtx.clearRect(0, 0, w, h);
      editorCtx.drawImage(state.basePolaroidCanvas, 0, 0);

      editorCtx.save();
      if (hd !== 1) {
        editorCtx.scale(hd, hd);
      }

      if (state.mode === 'DEVELOPING' && state.photoRect) {
        const alpha = Math.max(0, Math.pow(1 - state.developProgress, 0.85) * 0.97);
        if (alpha > 0.005) {
          editorCtx.save();
          editorCtx.fillStyle = `rgba(14, 13, 22, ${alpha.toFixed(3)})`;
          editorCtx.fillRect(state.photoRect.x, state.photoRect.y, state.photoRect.w, state.photoRect.h);
          editorCtx.restore();
        }
        drawToSignature(
          editorCtx,
          lw,
          lh,
          state.lastMember,
          state.lastIsGroup,
          state.photoRect,
          getToSignConfig(Math.max(0.35, state.developProgress))
        );
      }

      if (state.mode === 'DIY') {
        drawToSignature(
          editorCtx,
          lw,
          lh,
          state.lastMember,
          state.lastIsGroup,
          state.photoRect,
          getToSignConfig(1, state.toSignSelected)
        );
        if (AlbumManager && AlbumManager.isAllPosesCompleted && AlbumManager.isAllPosesCompleted() && state.completeStampEnabled) {
          drawCompleteMasterStamp(editorCtx, lw, lh, state.lastIsGroup);
        }
        stickerSession.renderAll(editorCtx, true);
      }

      if (state.lastIsNewPose && state.mode === 'DIY') {
        const blink = 0.65 + 0.35 * Math.sin(state.time * 9);
        drawNewStamp(editorCtx, lw, blink);
      }

      for (let i = state.developSparkles.length - 1; i >= 0; i -= 1) {
        const sp = state.developSparkles[i];
        sp.life -= stepDt;
        if (sp.life <= 0) {
          state.developSparkles.splice(i, 1);
          continue;
        }
        sp.x += sp.vx * stepDt;
        sp.y += sp.vy * stepDt;
        editorCtx.save();
        editorCtx.globalAlpha = Math.max(0, Math.min(1, sp.life / 0.25));
        drawPixelStar(editorCtx, sp.x, sp.y, 12, sp.color, '#FFFFFF');
        editorCtx.restore();
      }

      editorCtx.restore();
    }

    function buildFinalPolaroidCanvas() {
      if (!state.basePolaroidCanvas) return null;
      const out = document.createElement('canvas');
      out.width = state.basePolaroidCanvas.width;
      out.height = state.basePolaroidCanvas.height;
      const hd = state.basePolaroidCanvas._hdScale || 1;
      const lw = state.basePolaroidCanvas._logicalW || out.width;
      const lh = state.basePolaroidCanvas._logicalH || out.height;
      const ctx = out.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = '#FAF7F0';
      ctx.fillRect(0, 0, out.width, out.height);
      ctx.drawImage(state.basePolaroidCanvas, 0, 0);

      ctx.save();
      if (hd !== 1) {
        ctx.scale(hd, hd);
      }
      drawToSignature(
        ctx,
        lw,
        lh,
        state.lastMember,
        state.lastIsGroup,
        state.photoRect,
        getToSignConfig(1, false)
      );
      if (AlbumManager && AlbumManager.isAllPosesCompleted && AlbumManager.isAllPosesCompleted() && state.completeStampEnabled) {
        drawCompleteMasterStamp(ctx, lw, lh, state.lastIsGroup);
      }
      stickerSession.renderAll(ctx, false);
      if (state.lastIsNewPose) {
        drawNewStamp(ctx, lw, 1);
      }
      ctx.restore();
      return out;
    }

    function retakePhoto() {
      AudioManager.playUiClick();
      if (state.developTimerId) {
        global.clearTimeout(state.developTimerId);
        state.developTimerId = null;
      }
      el.previewModal.classList.add('hidden');
      el.modalToast.classList.add('hidden');
      el.btnShutter.disabled = !state.isGroupMode && state.timerExpired;
      state.mode = 'AIMING';
    }

    function triggerDownloadUrl(url, filename) {
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    function downloadCanvasPng(canvas, filename) {
      if (!canvas) return { ok: false, reason: 'NO_CANVAS' };
      const quality = Math.max(0.92, (CONFIG.ALBUM && CONFIG.ALBUM.jpegQuality) || 0.88);
      const securityMsg = '本地直接双击打开时浏览器禁止导出外部图片画布，请使用本地静态服务器打开以保存/导出成片。';
      try {
        if (typeof canvas.toBlob === 'function') {
          let failedAsync = false;
          canvas.toBlob((blob) => {
            try {
              if (blob && global.URL && typeof global.URL.createObjectURL === 'function') {
                const url = global.URL.createObjectURL(blob);
                triggerDownloadUrl(url, filename);
                global.setTimeout(() => global.URL.revokeObjectURL(url), 1500);
              } else {
                triggerDownloadUrl(canvas.toDataURL('image/jpeg', quality), filename);
              }
            } catch (_innerErr) {
              failedAsync = true;
              showModalToast(securityMsg, true);
            }
          }, 'image/jpeg', quality);
          if (failedAsync) {
            return { ok: false, reason: 'SECURITY_ERROR', message: securityMsg };
          }
        } else {
          triggerDownloadUrl(canvas.toDataURL('image/jpeg', quality), filename);
        }
        return { ok: true };
      } catch (err) {
        const isSecurity =
          err &&
          (err.name === 'SecurityError' ||
            String(err.message || '').toLowerCase().includes('tainted'));
        return {
          ok: false,
          reason: isSecurity ? 'SECURITY_ERROR' : 'EXPORT_ERROR',
          message: isSecurity ? securityMsg : '导出图片失败，请重试。'
        };
      }
    }

    function shouldUseLongPressSave() {
      const ua = (global.navigator && global.navigator.userAgent) || '';
      if (/MicroMessenger|Weibo|QQ\/|MQQBrowser/i.test(ua)) return true;
      const isIos = /iPhone|iPad|iPod/i.test(ua);
      const isSafari = /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS/i.test(ua);
      return isIos && isSafari;
    }

    function openSaveImageModal(dataUrl) {
      if (!el.saveImageModal || !el.saveImagePreview) return false;
      el.saveImagePreview.src = dataUrl;
      el.saveImageModal.classList.remove('hidden');
      return true;
    }

    function closeSaveImageModal() {
      if (!el.saveImageModal) return;
      AudioManager.playUiClick();
      el.saveImageModal.classList.add('hidden');
    }

    function exportPolaroidPng() {
      const finalCanvas = buildFinalPolaroidCanvas();
      if (!finalCanvas) return;
      AudioManager.playUiClick();

      const memberId = state.lastMember ? state.lastMember.id : 'idol';
      const judgmentKey = state.lastJudgment ? state.lastJudgment.key : 'CHEKI';
      const quality = Math.max(0.92, (CONFIG.ALBUM && CONFIG.ALBUM.jpegQuality) || 0.88);
      const filename = `cheki_${memberId}_${judgmentKey}_${formatDateStamp(new Date())}.jpg`;

      if (shouldUseLongPressSave()) {
        try {
          const dataUrl = finalCanvas.toDataURL('image/jpeg', quality);
          openSaveImageModal(dataUrl);
          el.btnExportPng.textContent = '长按保存';
          return;
        } catch (_err) {
          showModalToast('导出图片失败，请使用本地服务访问后重试。', true);
          return;
        }
      }

      const res = downloadCanvasPng(finalCanvas, filename);
      if (!res.ok) {
        showModalToast(res.message || '导出失败，请重试。', true);
        return;
      }
      el.btnExportPng.textContent = '已导出图片 ✓';
      showModalToast('已导出高清 JPEG 拍立得！', false);
    }

    async function saveCurrentToAlbum() {
      const finalCanvas = buildFinalPolaroidCanvas();
      if (!finalCanvas || state.isSavingAlbum) return;
      if (state.savedCurrentToAlbum) {
        showModalToast('这张拍立得已经保存到相册啦！', false);
        return;
      }

      state.isSavingAlbum = true;
      el.btnSaveAlbum.disabled = true;
      AudioManager.playUiClick();

      let res;
      try {
        res = await AlbumManager.savePhoto({
          canvas: finalCanvas,
          member: state.lastMember,
          judgment: state.lastJudgment,
          dateStr: state.lastDateStr || formatDateDot(new Date()),
          isGroup: state.lastIsGroup,
          poseId: state.lastPoseInfo ? state.lastPoseInfo.id : null,
          poseName: state.lastPoseInfo ? state.lastPoseInfo.name : null,
          poseRarity: state.lastPoseInfo ? state.lastPoseInfo.rarity : null,
          isHolo: state.lastIsHolo
        });
      } catch (_err) {
        res = { ok: false, message: '本地相册已满，请先长按保存到手机' };
      } finally {
        state.isSavingAlbum = false;
        el.btnSaveAlbum.disabled = false;
      }

      if (!res || !res.ok) {
        refreshCollectionUI();
        showModalToast((res && res.message) || '本地相册已满，请先长按保存到手机', true);
        return;
      }

      state.savedCurrentToAlbum = true;
      el.btnSaveAlbum.textContent = '已存相册 ✓';
      refreshCollectionUI();
      updateCompleteStampUI();
      updateGroupStudioBar();

      const totalPoses = Poses ? Poses.POSE_LIST.length : 7;
      const effectiveNewPose = Boolean(res.isNewPose || (state.lastDevelopUnlockRes && state.lastDevelopUnlockRes.isNew));
      const effectiveJustHolo = Boolean(res.justUnlockedHolo || (state.lastDevelopUnlockRes && state.lastDevelopUnlockRes.justUnlockedHolo));
      state.lastDevelopUnlockRes = null;

      if (effectiveJustHolo && state.lastMember) {
        AudioManager.playUnlockFanfare();
        showModalToast(`★ 已集齐【${state.lastMember.name}】${totalPoses}种动作！永久解锁全息金边相纸！`, false);
      } else if (effectiveNewPose && state.lastPoseInfo) {
        showModalToast(`★ 新动作收录 [${state.lastPoseInfo.rarity} ${state.lastPoseInfo.name}] 已存相册！`, false);
      } else {
        showModalToast('已保存到本地拍切集邮册！', false);
      }

      checkAndTriggerAllCompletedCelebration();

      if (res.justUnlockedGroup) {
        AudioManager.playUnlockFanfare();
        el.unlockModal.classList.remove('hidden');
      }
    }

    // ===== Album Modal, 30-Slot Pose Dex & Detail Lightbox =====
    function renderDexPanel() {
      if (!el.dexPanel || !Poses) return;
      const totalUnlocked = AlbumManager.getTotalUnlockedPoses();
      const totalPossible = CONFIG.MEMBERS.length * Poses.POSE_LIST.length;
      if (el.dexTotalBadge) {
        el.dexTotalBadge.textContent = `${totalUnlocked}/${totalPossible}`;
      }

      el.dexPanel.innerHTML = '';
      CONFIG.MEMBERS.forEach((m) => {
        const unlockedIds = AlbumManager.getMemberUnlockedPoses(m.id);
        const isHolo = AlbumManager.isMemberHoloUnlocked(m.id);

        const card = document.createElement('div');
        card.className = `dex-member-card${isHolo ? ' is-holo' : ''}`;

        const head = document.createElement('div');
        head.className = 'dex-member-head';

        const titleWrap = document.createElement('span');
        titleWrap.className = 'dex-member-title';
        const dot = document.createElement('span');
        dot.className = 'dex-member-dot';
        dot.style.background = m.color;
        const txt = document.createElement('span');
        txt.textContent = m.enName ? `${m.name} (${m.enName})` : m.name;
        titleWrap.appendChild(dot);
        titleWrap.appendChild(txt);

        const rightWrap = document.createElement('span');
        rightWrap.className = 'dex-member-count';
        if (isHolo) {
          const holoTag = document.createElement('span');
          holoTag.className = 'dex-holo-badge';
          holoTag.textContent = '★ 全息金边解锁';
          rightWrap.appendChild(holoTag);
        } else {
          rightWrap.textContent = `${unlockedIds.length}/${Poses.POSE_LIST.length}`;
        }

        head.appendChild(titleWrap);
        head.appendChild(rightWrap);
        card.appendChild(head);

        const grid = document.createElement('div');
        grid.className = 'dex-grid';

        Poses.POSE_LIST.forEach((pose) => {
          const unlocked = unlockedIds.includes(pose.id);
          const rStyle = Poses.RARITY_STYLES[pose.rarity] || Poses.RARITY_STYLES.N;
          const slot = document.createElement('div');
          slot.className = `dex-slot${unlocked ? ' is-unlocked' : ''}${pose.rarity === 'SSR' ? ' is-ssr' : ''}`;
          slot.style.setProperty('--slot-border', rStyle.border);
          slot.style.setProperty('--slot-bg', unlocked ? rStyle.bg : '#1e1b2e');
          slot.style.setProperty('--slot-text', unlocked ? rStyle.text : '#64748B');

          const rBadge = document.createElement('span');
          rBadge.className = 'dex-slot-rarity';
          rBadge.textContent = pose.rarity;

          const pName = document.createElement('span');
          pName.className = 'dex-slot-name';
          pName.textContent = unlocked ? pose.name : '???';

          slot.appendChild(rBadge);
          slot.appendChild(pName);
          grid.appendChild(slot);
        });

        card.appendChild(grid);
        el.dexPanel.appendChild(card);
      });
    }

    function switchAlbumTab(tab) {
      state.albumTab = tab === 'dex' ? 'dex' : 'album';
      const isDex = state.albumTab === 'dex';

      if (el.tabAlbum) {
        el.tabAlbum.classList.toggle('active', !isDex);
        el.tabAlbum.setAttribute('aria-selected', String(!isDex));
      }
      if (el.tabDex) {
        el.tabDex.classList.toggle('active', isDex);
        el.tabDex.setAttribute('aria-selected', String(isDex));
      }

      if (isDex) {
        el.albumGrid.classList.add('hidden');
        el.albumEmpty.classList.add('hidden');
        if (el.dexPanel) el.dexPanel.classList.remove('hidden');
        renderDexPanel();
      } else {
        if (el.dexPanel) el.dexPanel.classList.add('hidden');
        renderAlbumGrid();
      }
    }

    function renderAlbumGrid() {
      const items = AlbumManager.getItems();
      el.albumModalCount.textContent = `(${items.length}张)`;
      el.albumGrid.innerHTML = '';

      if (el.dexTotalBadge && Poses) {
        el.dexTotalBadge.textContent = `${AlbumManager.getTotalUnlockedPoses()}/${CONFIG.MEMBERS.length * Poses.POSE_LIST.length}`;
      }

      if (state.albumTab === 'dex') {
        el.albumGrid.classList.add('hidden');
        el.albumEmpty.classList.add('hidden');
        return;
      }

      if (items.length === 0) {
        el.albumGrid.classList.add('hidden');
        el.albumEmpty.classList.remove('hidden');
        return;
      }

      el.albumEmpty.classList.add('hidden');
      el.albumGrid.classList.remove('hidden');

      items.forEach((item) => {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'album-thumb-card';
        card.style.setProperty('--thumb-color', item.memberColor || '#FACC15');

        const img = document.createElement('img');
        img.className = 'album-thumb-img';
        if (item.dataUrl) {
          img.src = item.dataUrl;
        }
        img.alt = `${item.memberName} 拍立得`;

        const meta = document.createElement('div');
        meta.className = 'album-thumb-meta';

        const memberWrap = document.createElement('span');
        memberWrap.className = 'album-thumb-member';
        const dot = document.createElement('span');
        dot.className = 'album-thumb-dot';
        dot.style.background = item.memberColor || '#FACC15';
        const nameTxt = document.createElement('span');
        nameTxt.textContent = item.memberName;
        memberWrap.appendChild(dot);
        memberWrap.appendChild(nameTxt);

        const dateTxt = document.createElement('span');
        dateTxt.textContent = `${item.stars || ''} ${(item.dateStr || '').slice(5)}`;

        meta.appendChild(memberWrap);
        meta.appendChild(dateTxt);

        card.appendChild(img);
        card.appendChild(meta);

        card.addEventListener('click', () => {
          openAlbumDetail(item.id);
        });

        el.albumGrid.appendChild(card);
      });
    }

    function openAlbumModal() {
      if (state.mode !== 'AIMING') return;
      AudioManager.playUiClick();
      state.mode = 'ALBUM';
      switchAlbumTab('album');
      el.albumModal.classList.remove('hidden');
    }

    function closeAlbumModal() {
      AudioManager.playUiClick();
      el.albumDetailModal.classList.add('hidden');
      el.albumModal.classList.add('hidden');
      state.currentDetailId = null;
      state.mode = 'AIMING';
    }

    function openAlbumDetail(itemId) {
      const item = AlbumManager.getById(itemId);
      if (!item) return;
      AudioManager.playUiClick();
      state.currentDetailId = item.id;
      if (item.dataUrl) {
        el.albumDetailImg.src = item.dataUrl;
      } else {
        el.albumDetailImg.removeAttribute('src');
      }
      el.albumDetailMeta.textContent = `${item.memberName} · ${item.stars} ${item.judgmentKey} · ${item.dateStr}`;
      el.albumDetailModal.classList.remove('hidden');
    }

    function closeAlbumDetail() {
      AudioManager.playUiClick();
      el.albumDetailModal.classList.add('hidden');
      state.currentDetailId = null;
    }

    function downloadDetailItem() {
      if (!state.currentDetailId) return;
      const item = AlbumManager.getById(state.currentDetailId);
      if (!item || !item.dataUrl) {
        showGlobalToast('图片数据正在加载或已损坏');
        return;
      }
      AudioManager.playUiClick();
      if (shouldUseLongPressSave()) {
        openSaveImageModal(item.dataUrl);
        return;
      }
      const ext = item.dataUrl.indexOf('image/jpeg') >= 0 ? 'jpg' : 'png';
      const filename = `cheki_${item.memberId}_${item.judgmentKey}_${(item.dateStr || '').replace(/\./g, '')}.${ext}`;
      triggerDownloadUrl(item.dataUrl, filename);
    }

    function deleteDetailItem() {
      if (!state.currentDetailId) return;
      AudioManager.playUiClick();
      AlbumManager.deleteItem(state.currentDetailId);
      el.albumDetailModal.classList.add('hidden');
      state.currentDetailId = null;
      renderAlbumGrid();
      refreshCollectionUI();
    }

    // ===== Editor Canvas Pointer / Touch Input =====
    function clientToEditorCoords(clientX, clientY) {
      const logicalW = (state.basePolaroidCanvas && state.basePolaroidCanvas._logicalW) || el.editorCanvas.width;
      const logicalH = (state.basePolaroidCanvas && state.basePolaroidCanvas._logicalH) || el.editorCanvas.height;
      const rect = el.editorCanvas.getBoundingClientRect ? el.editorCanvas.getBoundingClientRect() : null;
      if (!rect || !rect.width || !rect.height) {
        return { x: logicalW / 2, y: logicalH / 2 };
      }
      return {
        x: ((clientX - rect.left) / rect.width) * logicalW,
        y: ((clientY - rect.top) / rect.height) * logicalH
      };
    }

    function handleEditorDown(x, y) {
      if (state.mode === 'DEVELOPING') {
        state.isRubbing = true;
        state.rubDownX = x;
        state.rubDownY = y;
        state.rubMovedDist = 0;
        state.lastPointerX = x;
        state.lastPointerY = y;
        addDevelopProgress(0.06, x, y);
      } else if (state.mode === 'DIY') {
        const hitSticker = stickerSession.startDrag(x, y);
        if (hitSticker) {
          state.toSignSelected = false;
          state.toSignDragging = false;
        } else if (hitTestToSign(x, y)) {
          stickerSession.clearSelection();
          state.toSignSelected = true;
          state.toSignDragging = true;
          const m = getToSignMetrics(editorCtx, state.photoRect, getToSignConfig(1, false));
          state.toSignDragOffsetX = m.anchorX - x;
          state.toSignDragOffsetY = m.anchorY - y;
        } else {
          state.toSignSelected = false;
          state.toSignDragging = false;
        }
        updateStickerTransformBar();
        updateToSignTransformBar();
        renderEditorCanvas();
      }
    }

    function handleEditorMove(x, y) {
      if (state.mode === 'DEVELOPING' && state.isRubbing) {
        const dx = x - state.lastPointerX;
        const dy = y - state.lastPointerY;
        const dist = Math.hypot(dx, dy);
        state.lastPointerX = x;
        state.lastPointerY = y;
        state.rubMovedDist += dist;
        if (dist > 3) {
          addDevelopProgress(Math.min(0.085, dist * 0.00075), x, y);
        }
      } else if (state.mode === 'DIY' && stickerSession.dragging) {
        if (stickerSession.moveDrag(x, y)) {
          markDirtyDiy();
          renderEditorCanvas();
        }
      } else if (state.mode === 'DIY' && state.toSignDragging) {
        const logicalW = (state.basePolaroidCanvas && state.basePolaroidCanvas._logicalW) || el.editorCanvas.width;
        const logicalH = (state.basePolaroidCanvas && state.basePolaroidCanvas._logicalH) || el.editorCanvas.height;
        state.toSignX = Math.max(40, Math.min(logicalW - 12, Math.round(x + state.toSignDragOffsetX)));
        state.toSignY = Math.max(40, Math.min(logicalH - 12, Math.round(y + state.toSignDragOffsetY)));
        markDirtyDiy();
        renderEditorCanvas();
      }
    }

    function handleEditorUp() {
      const wasRubbing = state.isRubbing;
      state.isRubbing = false;
      state.toSignDragging = false;
      if (state.mode === 'DEVELOPING' && !state.developCompleted && wasRubbing && state.rubMovedDist < 14) {
        completeDeveloping();
        return;
      }
      if (state.mode === 'DIY' && stickerSession.dragging) {
        stickerSession.endDrag();
        renderEditorCanvas();
      }
    }

    function isTimerEligible() {
      if (state.mode !== 'AIMING' || state.isGroupMode || state.timerExpired) return false;
      if (el.startScreen && !el.startScreen.classList.contains('hidden')) return false;
      if (el.settingsModal && !el.settingsModal.classList.contains('hidden')) return false;
      if (el.albumModal && !el.albumModal.classList.contains('hidden')) return false;
      if (el.unlockModal && !el.unlockModal.classList.contains('hidden')) return false;
      if (el.allCompleteModal && !el.allCompleteModal.classList.contains('hidden')) return false;
      if (el.saveImageModal && !el.saveImageModal.classList.contains('hidden')) return false;
      return true;
    }

    function update(dt) {
      state.time += dt;

      if (state.mode === 'AIMING' && (state.isGroupMode || !state.timerExpired)) {
        state.cursorPos += state.cursorDir * CONFIG.RHYTHM_BAR.speed * dt;
        if (state.cursorPos >= 1) {
          state.cursorPos = 2 - state.cursorPos;
          state.cursorDir = -1;
        } else if (state.cursorPos <= 0) {
          state.cursorPos = -state.cursorPos;
          state.cursorDir = 1;
        }
        state.cursorPos = Math.max(0, Math.min(1, state.cursorPos));
      }

      if (isTimerEligible()) {
        state.timerSeconds = Math.max(0, state.timerSeconds - dt);
        if (state.timerSeconds > 0 && state.timerSeconds <= 10 && poseController && Poses) {
          state.lastTenBubbleCooldown -= dt;
          if (state.lastTenBubbleCooldown <= 0) {
            state.lastTenBubbleCooldown = 3.2;
            const phrases = Poses.LAST_TEN_TEXTS || ['最后10秒啦!'];
            poseController.spawnTextBubble(
              phrases[Math.floor(Math.random() * phrases.length)],
              '#F59E0B'
            );
          }
        }
        if (state.timerSeconds <= 0 && !state.timerExpired) {
          state.timerExpired = true;
          el.btnShutter.disabled = true;
          if (el.timeoutOverlay) {
            el.timeoutOverlay.classList.remove('hidden');
          }
        }
      }

      if (state.flashAlpha > 0) {
        state.flashAlpha = Math.max(0, state.flashAlpha - dt * 4.0);
      }

      if (state.banner) {
        state.banner.alpha -= dt * 1.4;
        if (state.banner.alpha <= 0) {
          state.banner = null;
        }
      }

      const lastTenCtx = getLastTenContext();
      if (poseController) {
        const poseActive = state.mode === 'AIMING' && !state.timerExpired;
        poseController.update(
          dt,
          getCurrentMember(),
          state.isGroupMode,
          poseActive,
          Object.assign({}, lastTenCtx, { easyMode: state.gameMode === 'easy' })
        );
        updatePoseButtonUI();
        updateCallButtonUI();
        updatePoseHudBadge();
      }

      const targetFraming = FRAMING_MODES[state.framingIndex] || FRAMING_MODES[0];
      const targetFocusY = targetFraming.focusY;
      const lerpRate = Math.min(1, dt * 8.5);
      state.framingZoom += (targetFraming.zoom - state.framingZoom) * lerpRate;
      state.framingFocusY += (targetFocusY - state.framingFocusY) * lerpRate;
    }

    function render(dt) {
      const isGroup = state.isGroupMode;
      const member = getCurrentMember();
      const bgId = isGroup ? 'group-memorial' : getCurrentBg().id;
      const W = CONFIG.CANVAS_WIDTH;
      const H = CONFIG.CANVAS_HEIGHT;
      const vf = isGroup ? CONFIG.GROUP_VIEWFINDER : CONFIG.VIEWFINDER;
      const poseSnap = (!isGroup && poseController) ? poseController.snapshot(state.time) : null;

      stageCtx.imageSmoothingEnabled = false;
      stageCtx.clearRect(0, 0, stageCanvas.width, stageCanvas.height);

      stageCtx.save();
      stageCtx.scale(STAGE_SCALE, STAGE_SCALE);

      if (isGroup) {
        drawBackground(stageCtx, bgId, member, state.time);
        if (state.groupStarlightSea) {
          drawGroupStarlightSea(stageCtx, state.time, vf);
        }
        drawGroupIdols(stageCtx, state.time, state.mode, {
          groupItems: state.groupItems,
          getSprite: getActiveSprite,
          defaultLanHairStyle: state.lanHairStyle,
          selectedMemberId: state.selectedGroupMemberId,
          showSelection: state.mode === 'AIMING'
        });
      } else {
        renderSoloStageScene(stageCtx, bgId, member, state.time, state.mode, poseSnap);
      }

      if (PixelFilter && typeof PixelFilter.applyAtmosphereFilters === 'function') {
        stageCtx.save();
        stageCtx.scale(1 / STAGE_SCALE, 1 / STAGE_SCALE);
        PixelFilter.applyAtmosphereFilters(stageCtx, {
          x: vf.x * STAGE_SCALE,
          y: vf.y * STAGE_SCALE,
          w: vf.w * STAGE_SCALE,
          h: vf.h * STAGE_SCALE
        });
        stageCtx.restore();
      }

      drawViewfinderHud(
        stageCtx,
        member,
        state.cursorPos,
        state.time,
        state.shotCount,
        state.banner,
        isGroup,
        poseController
          ? {
              pose: poseController.currentPose,
              alertFlashTimer: poseController.alertFlashTimer,
              focusFlashRatio: poseSnap ? poseSnap.focusFlashRatio : 0,
              faceLockActive: Boolean(poseSnap && poseSnap.faceLockActive),
              timerSeconds: state.timerSeconds,
              isEasyMode: state.gameMode === 'easy'
            }
          : { timerSeconds: state.timerSeconds, isEasyMode: state.gameMode === 'easy' }
      );
      drawRhythmBar(stageCtx, state.cursorPos, state.time, state.gameMode === 'easy');

      updateAndDrawParticles(stageCtx, state.particles, dt);

      if (state.flashAlpha > 0) {
        stageCtx.save();
        stageCtx.fillStyle = `rgba(255, 255, 255, ${state.flashAlpha.toFixed(3)})`;
        stageCtx.fillRect(0, 0, W, H);
        stageCtx.restore();
      }

      stageCtx.restore();

      if (state.mode === 'DEVELOPING' || state.mode === 'DIY') {
        renderEditorCanvas(dt);
      }
    }

    function tick(ts) {
      if (!state.lastTs) state.lastTs = ts;
      const dt = Math.min(0.05, Math.max(0.001, (ts - state.lastTs) / 1000));
      state.lastTs = ts;

      update(dt);
      render(dt);

      if (typeof global.requestAnimationFrame === 'function') {
        global.requestAnimationFrame(tick);
      }
    }

    function syncGameModeUI() {
      const isEasy = state.gameMode === 'easy';
      const pairs = [
        [el.btnTicketModeStandard, !isEasy],
        [el.btnTicketModeEasy, isEasy],
        [el.btnSettingsModeStandard, !isEasy],
        [el.btnSettingsModeEasy, isEasy]
      ];
      pairs.forEach(([btn, active]) => {
        if (!btn) return;
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
    }

    function setGameMode(nextMode, silent) {
      const normalized = nextMode === 'easy' ? 'easy' : 'standard';
      const changed = state.gameMode !== normalized;
      state.gameMode = normalized;
      savePref(CONFIG.GAME_MODE_STORAGE_KEY || 'f1owsec_game_mode_v1', normalized);
      syncGameModeUI();
      if (!silent && changed) {
        showGlobalToast(
          normalized === 'easy'
            ? '★ 已切换为简单模式：顺序动作 · 必出 PERFECT'
            : '★ 已切换为标准模式'
        );
      }
    }

    function syncSettingsUI() {
      syncGameModeUI();
      if (!PixelFilter || !el.settingsModal) return;
      const s = PixelFilter.getSettings();

      const updateToggleBtn = (btn, on) => {
        if (!btn) return;
        btn.classList.toggle('is-on', on);
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
        btn.textContent = on ? '开' : '关';
      };

      updateToggleBtn(el.toggleFilterScanlines, Boolean(s.scanlines));
      updateToggleBtn(el.toggleFilterCyber, Boolean(s.cyberCool));
      updateToggleBtn(el.toggleFilterWarm, Boolean(s.warmFilm));
      updateToggleBtn(el.toggleFilterGlow, Boolean(s.stageGlow));
    }

    function openSettingsModal() {
      if (!el.settingsModal) return;
      AudioManager.playUiClick();
      syncSettingsUI();
      el.settingsModal.classList.remove('hidden');
    }

    function closeSettingsModal() {
      if (!el.settingsModal) return;
      AudioManager.playUiClick();
      el.settingsModal.classList.add('hidden');
    }

    function applyFilterSettings(partial) {
      if (!PixelFilter) return;
      AudioManager.playUiClick();
      PixelFilter.updateSettings(partial);
      syncSettingsUI();
    }

    function bindReliableTap(btn, handler) {
      if (!btn || typeof handler !== 'function') return;
      let lastTapTs = 0;
      let pressTimerId = null;

      const flashPressed = () => {
        btn.classList.add('is-pressed');
        if (pressTimerId) global.clearTimeout(pressTimerId);
        pressTimerId = global.setTimeout(() => {
          btn.classList.remove('is-pressed');
          pressTimerId = null;
        }, 140);
      };

      const invoke = (e) => {
        if (e && typeof e.stopPropagation === 'function') {
          e.stopPropagation();
        }
        flashPressed();
        handler(e);
      };

      if (typeof global.PointerEvent === 'function') {
        let activePointerId = null;
        btn.addEventListener('pointerdown', (e) => {
          if (e.button !== undefined && e.button !== 0) return;
          e.stopPropagation();
          activePointerId = e.pointerId;
          btn.classList.add('is-pressed');
        });
        btn.addEventListener('pointerup', (e) => {
          if (e.button !== undefined && e.button !== 0) return;
          if (activePointerId !== null && e.pointerId !== activePointerId) return;
          activePointerId = null;
          e.stopPropagation();
          if (typeof btn.getBoundingClientRect === 'function' && typeof e.clientX === 'number') {
            const r = btn.getBoundingClientRect();
            const pad = 10;
            if (e.clientX < r.left - pad || e.clientX > r.right + pad || e.clientY < r.top - pad || e.clientY > r.bottom + pad) {
              btn.classList.remove('is-pressed');
              return;
            }
          }
          lastTapTs = Date.now();
          invoke(e);
        });
        btn.addEventListener('pointercancel', () => {
          activePointerId = null;
          btn.classList.remove('is-pressed');
        });
      }

      btn.addEventListener('touchstart', (e) => {
        e.stopPropagation();
        btn.classList.add('is-pressed');
      }, { passive: true });

      btn.addEventListener('touchend', (e) => {
        e.stopPropagation();
        if (typeof global.PointerEvent !== 'function') {
          lastTapTs = Date.now();
          if (e.cancelable) e.preventDefault();
          invoke(e);
        }
      }, { passive: false });

      btn.addEventListener('touchcancel', () => {
        btn.classList.remove('is-pressed');
      }, { passive: true });

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (Date.now() - lastTapTs < 450) {
          return;
        }
        lastTapTs = Date.now();
        invoke(e);
      });
    }

    function bindEvents() {
      if (el.btnEnterTicket) {
        el.btnEnterTicket.addEventListener('click', enterFromTicket);
      }
      const bindModeOption = (btn, modeVal) => {
        if (!btn) return;
        bindReliableTap(btn, () => {
          AudioManager.playUiClick();
          setGameMode(modeVal);
        });
      };
      bindModeOption(el.btnTicketModeStandard, 'standard');
      bindModeOption(el.btnTicketModeEasy, 'easy');
      bindModeOption(el.btnSettingsModeStandard, 'standard');
      bindModeOption(el.btnSettingsModeEasy, 'easy');
      if (el.nicknameInput) {
        el.nicknameInput.addEventListener('input', () => {
          const clean = String(el.nicknameInput.value || '').slice(0, 10);
          state.nickname = clean;
          savePref(CONFIG.NICKNAME_STORAGE_KEY || 'f1owsec_nickname_v1', clean.trim());
        });
        el.nicknameInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            enterFromTicket();
          }
        });
      }
      if (el.btnOpenTicket) {
        el.btnOpenTicket.addEventListener('click', openStartScreen);
      }
      if (el.btnRenewTicket) {
        el.btnRenewTicket.addEventListener('click', renewTicket);
      }
      if (el.btnHairToggle) {
        bindReliableTap(el.btnHairToggle, toggleLanHair);
      }
      if (el.btnGrpHair) {
        bindReliableTap(el.btnGrpHair, cycleSelectedGroupHair);
      }
      if (el.btnToSignToggle) {
        el.btnToSignToggle.addEventListener('click', () => {
          if (state.mode !== 'DIY') return;
          state.toSignEnabled = !state.toSignEnabled;
          if (!state.toSignEnabled) {
            state.toSignSelected = false;
            state.toSignDragging = false;
          }
          updateToSignUI();
          updateToSignTransformBar();
          markDirtyDiy();
          AudioManager.playUiClick();
          renderEditorCanvas();
        });
      }
      if (el.btnToSignColor) {
        el.btnToSignColor.addEventListener('click', () => {
          if (state.mode !== 'DIY') return;
          state.toSignColorIndex = (state.toSignColorIndex + 1) % TO_SIGN_COLORS.length;
          state.toSignEnabled = true;
          updateToSignUI();
          updateToSignTransformBar();
          markDirtyDiy();
          AudioManager.playUiClick();
          renderEditorCanvas();
        });
      }

      el.btnBgSwitch.addEventListener('click', cycleBackground);
      el.btnMute.addEventListener('click', toggleMute);
      el.btnAlbum.addEventListener('click', openAlbumModal);
      el.btnAlbumClose.addEventListener('click', closeAlbumModal);

      if (el.btnPoseSwitch) {
        el.btnPoseSwitch.addEventListener('click', handleManualPoseSwitch);
      }
      if (el.btnFraming) {
        el.btnFraming.addEventListener('click', cycleFraming);
      }
      if (el.btnCall) {
        el.btnCall.addEventListener('click', triggerCall);
      }
      if (el.btnGrpPose) {
        el.btnGrpPose.addEventListener('click', cycleSelectedGroupPose);
      }
      if (el.btnGrpFlip) {
        el.btnGrpFlip.addEventListener('click', flipSelectedGroupItem);
      }
      if (el.btnGrpZoomIn) {
        el.btnGrpZoomIn.addEventListener('click', () => scaleSelectedGroupItem(0.08));
      }
      if (el.btnGrpZoomOut) {
        el.btnGrpZoomOut.addEventListener('click', () => scaleSelectedGroupItem(-0.08));
      }
      if (el.btnGrpTop) {
        el.btnGrpTop.addEventListener('click', bringSelectedGroupItemTop);
      }
      if (el.btnGrpSoul) {
        el.btnGrpSoul.addEventListener('click', cycleGroupSoulMode);
      }
      if (el.btnCompleteStamp) {
        el.btnCompleteStamp.addEventListener('click', () => {
          if (state.mode !== 'DIY') return;
          if (!AlbumManager || !AlbumManager.isAllPosesCompleted || !AlbumManager.isAllPosesCompleted()) return;
          state.completeStampEnabled = !state.completeStampEnabled;
          updateCompleteStampUI();
          markDirtyDiy();
          AudioManager.playUiClick();
          renderEditorCanvas();
        });
      }
      if (el.btnStkRotL) {
        el.btnStkRotL.addEventListener('click', () => {
          if (state.mode !== 'DIY') return;
          if (stickerSession.rotateSelected(-15)) {
            markDirtyDiy();
            AudioManager.playUiClick();
            renderEditorCanvas();
          }
        });
      }
      if (el.btnStkRotR) {
        el.btnStkRotR.addEventListener('click', () => {
          if (state.mode !== 'DIY') return;
          if (stickerSession.rotateSelected(15)) {
            markDirtyDiy();
            AudioManager.playUiClick();
            renderEditorCanvas();
          }
        });
      }
      if (el.btnStkZoomIn) {
        el.btnStkZoomIn.addEventListener('click', () => {
          if (state.mode !== 'DIY') return;
          if (stickerSession.scaleSelected(0.15)) {
            markDirtyDiy();
            AudioManager.playUiClick();
            renderEditorCanvas();
          }
        });
      }
      if (el.btnStkZoomOut) {
        el.btnStkZoomOut.addEventListener('click', () => {
          if (state.mode !== 'DIY') return;
          if (stickerSession.scaleSelected(-0.15)) {
            markDirtyDiy();
            AudioManager.playUiClick();
            renderEditorCanvas();
          }
        });
      }
      if (el.btnStkDelete) {
        el.btnStkDelete.addEventListener('click', () => {
          if (state.mode !== 'DIY') return;
          if (stickerSession.deleteSelected()) {
            markDirtyDiy();
            updateStickerTransformBar();
            AudioManager.playUiClick();
            renderEditorCanvas();
          }
        });
      }
      if (el.btnToSignZoomIn) {
        el.btnToSignZoomIn.addEventListener('click', () => {
          if (state.mode !== 'DIY' || !state.toSignEnabled) return;
          state.toSignScale = Math.min(1.4, Math.round((state.toSignScale + 0.15) * 100) / 100);
          markDirtyDiy();
          AudioManager.playUiClick();
          renderEditorCanvas();
        });
      }
      if (el.btnToSignZoomOut) {
        el.btnToSignZoomOut.addEventListener('click', () => {
          if (state.mode !== 'DIY' || !state.toSignEnabled) return;
          state.toSignScale = Math.max(0.75, Math.round((state.toSignScale - 0.15) * 100) / 100);
          markDirtyDiy();
          AudioManager.playUiClick();
          renderEditorCanvas();
        });
      }
      if (el.btnToSignReset) {
        el.btnToSignReset.addEventListener('click', () => {
          if (state.mode !== 'DIY' || !state.toSignEnabled) return;
          state.toSignX = null;
          state.toSignY = null;
          state.toSignScale = 1.0;
          state.toSignDragging = false;
          markDirtyDiy();
          AudioManager.playUiClick();
          renderEditorCanvas();
        });
      }
      if (el.btnAllCompleteOk) {
        el.btnAllCompleteOk.addEventListener('click', () => {
          AudioManager.playUiClick();
          if (el.allCompleteModal) {
            el.allCompleteModal.classList.add('hidden');
          }
          updateCompleteStampUI();
          updateGroupStudioBar();
          if (state.mode === 'DIY') {
            renderEditorCanvas();
          }
        });
      }

      // Stage canvas drag & selection in Group Free-Posing Mode
      stageCanvas.addEventListener('touchstart', (e) => {
        if (e.target !== stageCanvas) return;
        if (!state.isGroupMode || state.mode !== 'AIMING') return;
        state.stageLastTouchTs = Date.now();
        if (e.touches && e.touches[0]) {
          const pt = clientToStageLogicalCoords(e.touches[0].clientX, e.touches[0].clientY);
          if (handleStageDown(pt.x, pt.y)) {
            e.preventDefault();
          }
        }
      }, { passive: false });

      stageCanvas.addEventListener('touchmove', (e) => {
        if (!state.isGroupMode || state.mode !== 'AIMING' || !state.groupDragging) return;
        e.preventDefault();
        state.stageLastTouchTs = Date.now();
        if (e.touches && e.touches[0]) {
          const pt = clientToStageLogicalCoords(e.touches[0].clientX, e.touches[0].clientY);
          handleStageMove(pt.x, pt.y);
        }
      }, { passive: false });

      stageCanvas.addEventListener('touchend', () => {
        state.stageLastTouchTs = Date.now();
        handleStageUp();
      });

      stageCanvas.addEventListener('touchcancel', () => {
        handleStageUp();
      });

      stageCanvas.addEventListener('mousedown', (e) => {
        if (e.target !== stageCanvas) return;
        if (Date.now() - state.stageLastTouchTs < 500) return;
        if (!state.isGroupMode || state.mode !== 'AIMING') return;
        if (e.button !== undefined && e.button !== 0) return;
        const pt = clientToStageLogicalCoords(e.clientX, e.clientY);
        handleStageDown(pt.x, pt.y);
      });

      global.addEventListener('mousemove', (e) => {
        if (Date.now() - state.stageLastTouchTs < 500) return;
        if (!state.groupDragging) return;
        const pt = clientToStageLogicalCoords(e.clientX, e.clientY);
        handleStageMove(pt.x, pt.y);
      });

      global.addEventListener('mouseup', () => {
        if (Date.now() - state.stageLastTouchTs < 500) return;
        handleStageUp();
      });

      if (el.tabAlbum) {
        el.tabAlbum.addEventListener('click', () => {
          AudioManager.playUiClick();
          switchAlbumTab('album');
        });
      }
      if (el.tabDex) {
        el.tabDex.addEventListener('click', () => {
          AudioManager.playUiClick();
          switchAlbumTab('dex');
        });
      }

      if (el.btnSettings) {
        el.btnSettings.addEventListener('click', openSettingsModal);
      }
      if (el.btnSettingsClose) {
        el.btnSettingsClose.addEventListener('click', closeSettingsModal);
      }
      if (el.btnSettingsDone) {
        el.btnSettingsDone.addEventListener('click', closeSettingsModal);
      }
      if (el.btnSettingsReset) {
        el.btnSettingsReset.addEventListener('click', () => {
          if (!PixelFilter) return;
          AudioManager.playUiClick();
          PixelFilter.resetSettings();
          syncSettingsUI();
          showGlobalToast('已关闭全部氛围滤镜');
        });
      }
      if (el.toggleFilterScanlines) {
        el.toggleFilterScanlines.addEventListener('click', () => {
          const cur = PixelFilter.getSettings();
          applyFilterSettings({ scanlines: !cur.scanlines });
        });
      }
      if (el.toggleFilterCyber) {
        el.toggleFilterCyber.addEventListener('click', () => {
          const cur = PixelFilter.getSettings();
          applyFilterSettings({ cyberCool: !cur.cyberCool });
        });
      }
      if (el.toggleFilterWarm) {
        el.toggleFilterWarm.addEventListener('click', () => {
          const cur = PixelFilter.getSettings();
          applyFilterSettings({ warmFilm: !cur.warmFilm });
        });
      }
      if (el.toggleFilterGlow) {
        el.toggleFilterGlow.addEventListener('click', () => {
          const cur = PixelFilter.getSettings();
          applyFilterSettings({ stageGlow: !cur.stageGlow });
        });
      }
      if (el.btnSaveImageClose) {
        el.btnSaveImageClose.addEventListener('click', closeSaveImageModal);
      }
      if (el.btnSaveImageDone) {
        el.btnSaveImageDone.addEventListener('click', closeSaveImageModal);
      }

      // Shutter button (low-latency pointerdown + fallback click)
      let pointerTriggered = false;
      el.btnShutter.addEventListener('pointerdown', (e) => {
        if (e.button !== undefined && e.button !== 0) return;
        pointerTriggered = true;
        global.setTimeout(() => {
          pointerTriggered = false;
        }, 350);
        triggerShutter();
      });
      el.btnShutter.addEventListener('click', () => {
        if (pointerTriggered) {
          pointerTriggered = false;
          return;
        }
        triggerShutter();
      });

      // Editor canvas touch & mouse events (prevent scroll/pull-to-refresh + 2-finger pinch/rotate)
      el.editorCanvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        state.lastTouchTs = Date.now();
        if (state.mode === 'DIY' && e.touches && e.touches.length === 2) {
          stickerSession.endDrag();
          state.toSignDragging = false;
          const pt1 = clientToEditorCoords(e.touches[0].clientX, e.touches[0].clientY);
          const pt2 = clientToEditorCoords(e.touches[1].clientX, e.touches[1].clientY);
          if (!stickerSession.getSelectedItem()) {
            stickerSession.startDrag((pt1.x + pt2.x) / 2, (pt1.y + pt2.y) / 2);
            stickerSession.endDrag();
            updateStickerTransformBar();
          }
          const sel = stickerSession.getSelectedItem();
          if (sel) {
            state.stickerGesture = {
              startDist: Math.max(8, Math.hypot(pt2.x - pt1.x, pt2.y - pt1.y)),
              startAngle: Math.atan2(pt2.y - pt1.y, pt2.x - pt1.x),
              baseScale: sel.scale || 1,
              baseRot: sel.rotationDeg || 0
            };
          }
          return;
        }
        state.stickerGesture = null;
        if (e.touches && e.touches[0]) {
          const pt = clientToEditorCoords(e.touches[0].clientX, e.touches[0].clientY);
          handleEditorDown(pt.x, pt.y);
        }
      }, { passive: false });

      el.editorCanvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        state.lastTouchTs = Date.now();
        if (state.mode === 'DIY' && e.touches && e.touches.length === 2 && state.stickerGesture) {
          const pt1 = clientToEditorCoords(e.touches[0].clientX, e.touches[0].clientY);
          const pt2 = clientToEditorCoords(e.touches[1].clientX, e.touches[1].clientY);
          const curDist = Math.max(8, Math.hypot(pt2.x - pt1.x, pt2.y - pt1.y));
          const curAngle = Math.atan2(pt2.y - pt1.y, pt2.x - pt1.x);
          const dAngle = Math.atan2(
            Math.sin(curAngle - state.stickerGesture.startAngle),
            Math.cos(curAngle - state.stickerGesture.startAngle)
          );
          const nextScale = state.stickerGesture.baseScale * (curDist / state.stickerGesture.startDist);
          const nextRot = state.stickerGesture.baseRot + (dAngle * 180) / Math.PI;
          if (stickerSession.setSelectedTransform(nextScale, nextRot)) {
            markDirtyDiy();
            renderEditorCanvas();
          }
          return;
        }
        if (e.touches && e.touches[0]) {
          const pt = clientToEditorCoords(e.touches[0].clientX, e.touches[0].clientY);
          handleEditorMove(pt.x, pt.y);
        }
      }, { passive: false });

      el.editorCanvas.addEventListener('touchend', (e) => {
        e.preventDefault();
        state.lastTouchTs = Date.now();
        if (!e.touches || e.touches.length < 2) {
          state.stickerGesture = null;
        }
        if (!e.touches || e.touches.length === 0) {
          handleEditorUp();
        }
      }, { passive: false });

      el.editorCanvas.addEventListener('touchcancel', (e) => {
        e.preventDefault();
        state.stickerGesture = null;
        handleEditorUp();
      }, { passive: false });

      el.editorCanvas.addEventListener('mousedown', (e) => {
        if (Date.now() - state.lastTouchTs < 500) return;
        if (e.button !== undefined && e.button !== 0) return;
        const pt = clientToEditorCoords(e.clientX, e.clientY);
        handleEditorDown(pt.x, pt.y);
      });

      global.addEventListener('mousemove', (e) => {
        if (Date.now() - state.lastTouchTs < 500) return;
        if (!state.isRubbing && !stickerSession.dragging && !state.toSignDragging) return;
        const pt = clientToEditorCoords(e.clientX, e.clientY);
        handleEditorMove(pt.x, pt.y);
      });

      global.addEventListener('mouseup', () => {
        if (Date.now() - state.lastTouchTs < 500) return;
        handleEditorUp();
      });

      // Studio DIY & Export buttons
      el.btnStickerUndo.addEventListener('click', () => {
        if (state.mode !== 'DIY') return;
        if (stickerSession.undo()) {
          AudioManager.playUiClick();
          markDirtyDiy();
          updateStickerTransformBar();
          renderEditorCanvas();
        }
      });

      el.btnStickerClear.addEventListener('click', () => {
        if (state.mode !== 'DIY') return;
        if (stickerSession.items.length > 0) {
          stickerSession.clear();
          AudioManager.playUiClick();
          markDirtyDiy();
          updateStickerTransformBar();
          renderEditorCanvas();
        }
      });

      el.btnRetake.addEventListener('click', retakePhoto);
      el.btnModalClose.addEventListener('click', retakePhoto);
      el.btnSaveAlbum.addEventListener('click', saveCurrentToAlbum);
      el.btnExportPng.addEventListener('click', exportPolaroidPng);

      // Album detail actions
      el.btnDetailBack.addEventListener('click', closeAlbumDetail);
      el.btnDetailDownload.addEventListener('click', downloadDetailItem);
      el.btnDetailDelete.addEventListener('click', deleteDetailItem);

      // Unlock modal actions
      el.btnUnlockClose.addEventListener('click', () => {
        AudioManager.playUiClick();
        el.unlockModal.classList.add('hidden');
      });
      el.btnUnlockTry.addEventListener('click', () => {
        AudioManager.playUiClick();
        el.unlockModal.classList.add('hidden');
        el.previewModal.classList.add('hidden');
        el.albumModal.classList.add('hidden');
        el.albumDetailModal.classList.add('hidden');
        el.btnShutter.disabled = false;
        state.mode = 'AIMING';
        selectGroupMode();
      });

      // Keyboard shortcuts for desktop comfort
      global.addEventListener('keydown', (e) => {
        if (document.activeElement === el.nicknameInput) return;
        if (el.startScreen && !el.startScreen.classList.contains('hidden')) return;

        if (e.code === 'Space' || e.code === 'Enter') {
          const settingsOpen = el.settingsModal && !el.settingsModal.classList.contains('hidden');
          const saveOpen = el.saveImageModal && !el.saveImageModal.classList.contains('hidden');
          if (!settingsOpen && !saveOpen && state.mode === 'AIMING' && document.activeElement !== el.btnBgSwitch && document.activeElement !== el.btnMute && document.activeElement !== el.btnAlbum && document.activeElement !== el.btnSettings) {
            e.preventDefault();
            triggerShutter();
          }
        } else if (e.code === 'Escape') {
          if (el.saveImageModal && !el.saveImageModal.classList.contains('hidden')) {
            closeSaveImageModal();
          } else if (el.settingsModal && !el.settingsModal.classList.contains('hidden')) {
            closeSettingsModal();
          } else if (el.allCompleteModal && !el.allCompleteModal.classList.contains('hidden')) {
            el.allCompleteModal.classList.add('hidden');
          } else if (!el.unlockModal.classList.contains('hidden')) {
            el.unlockModal.classList.add('hidden');
          } else if (!el.albumDetailModal.classList.contains('hidden')) {
            closeAlbumDetail();
          } else if (!el.albumModal.classList.contains('hidden')) {
            closeAlbumModal();
          } else if (state.mode === 'DEVELOPING' || state.mode === 'DIY') {
            retakePhoto();
          }
        }
      });

      // Prevent accidental double-tap zoom / context menu inside game shell (except detail / long-press save photo)
      appEl.addEventListener('contextmenu', (e) => {
        if (e.target !== el.albumDetailImg && e.target !== el.saveImagePreview) {
          e.preventDefault();
        }
      });
      appEl.addEventListener('dblclick', (e) => {
        e.preventDefault();
      });
    }

    function init() {
      if (el.nicknameInput) {
        el.nicknameInput.value = state.nickname || '';
      }
      if (el.startScreen) {
        el.startScreen.classList.remove('hidden');
      }
      buildGroupMemberTabs();
      refreshCollectionUI();
      applyBackgroundLabel();
      applyMuteState();
      syncGameModeUI();
      syncSettingsUI();
      if (AlbumManager && typeof AlbumManager.onChange === 'function') {
        AlbumManager.onChange(() => {
          refreshCollectionUI();
          if (state.mode === 'ALBUM') {
            renderAlbumGrid();
          }
        });
      }
      if (AssetsManager) {
        AssetsManager.onChange((memberId) => {
          refreshAllAvatars(memberId);
          if (typeof global.requestAnimationFrame !== 'function') {
            render(0.016);
          }
        });
        AssetsManager.preloadAll();
      }
      bindEvents();
      render(0.016);
      if (typeof global.requestAnimationFrame === 'function') {
        global.requestAnimationFrame(tick);
      }
    }

    init();

    return {
      state,
      stickerSession,
      enterFromTicket,
      openStartScreen,
      renewTicket,
      setGameMode,
      toggleLanHair,
      selectMember,
      selectGroupMode,
      cycleBackground,
      cycleFraming,
      triggerCall,
      toggleMute,
      triggerShutter,
      shouldUseLongPressSave,
      openSaveImageModal,
      closeSaveImageModal,
      addDevelopProgress,
      completeDeveloping,
      buildFinalPolaroidCanvas,
      saveCurrentToAlbum,
      retakePhoto,
      exportPolaroidPng,
      openAlbumModal,
      closeAlbumModal,
      openAlbumDetail,
      deleteDetailItem,
      downloadDetailItem,
      evaluateJudgment,
      composePolaroid,
      refreshCollectionUI,
      handleEditorDown,
      handleEditorMove,
      handleEditorUp,
      renderFrame: (dt) => {
        update(dt || 0.016);
        render(dt || 0.016);
      }
    };
  }

  ChekiGame.init = createApp;

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        ChekiGame.App = createApp();
      });
    } else {
      ChekiGame.App = createApp();
    }
  }
})(window);
