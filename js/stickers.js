(function (global) {
  'use strict';

  const ChekiGame = global.ChekiGame || (global.ChekiGame = {});

  // Compact 5x7 pixel font for badges, date stamps, and member tags
  const MINI_GLYPHS = {
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
    'a': ['00000', '00000', '01110', '00001', '01111', '10001', '01111'],
    'b': ['10000', '10000', '11110', '10001', '10001', '10001', '11110'],
    'c': ['00000', '00000', '01111', '10000', '10000', '10000', '01111'],
    'd': ['00001', '00001', '01111', '10001', '10001', '10001', '01111'],
    'e': ['00000', '00000', '01110', '10001', '11111', '10000', '01111'],
    'f': ['00110', '01000', '11100', '01000', '01000', '01000', '01000'],
    'g': ['00000', '01111', '10001', '10001', '01111', '00001', '01110'],
    'h': ['10000', '10000', '10110', '11001', '10001', '10001', '10001'],
    'i': ['00100', '00000', '01100', '00100', '00100', '00100', '01110'],
    'l': ['01100', '00100', '00100', '00100', '00100', '00100', '01110'],
    'm': ['00000', '00000', '11010', '10101', '10101', '10001', '10001'],
    'n': ['00000', '00000', '11110', '10001', '10001', '10001', '10001'],
    'o': ['00000', '00000', '01110', '10001', '10001', '10001', '01110'],
    'r': ['00000', '00000', '10110', '11001', '10000', '10000', '10000'],
    's': ['00000', '00000', '01111', '10000', '01110', '00001', '11110'],
    't': ['00100', '00100', '01110', '00100', '00100', '00101', '00010'],
    'u': ['00000', '00000', '10001', '10001', '10001', '10011', '01101'],
    'w': ['00000', '00000', '10001', '10001', '10101', '11011', '10001'],
    '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100'],
    ':': ['00000', '01100', '01100', '00000', '01100', '01100', '00000'],
    '!': ['00100', '00100', '00100', '00100', '00100', '00000', '00100'],
    '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
    '+': ['00000', '00100', '00100', '11111', '00100', '00100', '00000'],
    '/': ['00001', '00010', '00010', '00100', '01000', '01000', '10000'],
    '★': ['00100', '00100', '11111', '01110', '01110', '11011', '10001'],
    '♥': ['00000', '01010', '11111', '11111', '01110', '00100', '00000']
  };

  function drawBitmap(ctx, text, cx, topY, scale, color, gap) {
    const s = Math.max(1, Math.round(scale));
    const g = gap != null ? gap : s;
    const totalW = text.length * 5 * s + Math.max(0, text.length - 1) * g;
    const startX = Math.round(cx - totalW / 2);
    const sy = Math.round(topY);
    ctx.fillStyle = color;
    for (let i = 0; i < text.length; i += 1) {
      const ch = text[i];
      const glyph = MINI_GLYPHS[ch] || MINI_GLYPHS[ch.toUpperCase()] || MINI_GLYPHS[' '];
      const gx = startX + i * (5 * s + g);
      for (let r = 0; r < 7; r += 1) {
        const line = glyph[r];
        for (let c = 0; c < 5; c += 1) {
          if (line[c] === '1') {
            ctx.fillRect(gx + c * s, sy + r * s, s, s);
          }
        }
      }
    }
  }

  function drawPixelMatrix(ctx, matrix, palette, x, y, u) {
    const rows = matrix.length;
    const cols = matrix[0].length;
    const sx = Math.round(x - (cols * u) / 2);
    const sy = Math.round(y - (rows * u) / 2);
    for (let r = 0; r < rows; r += 1) {
      const row = matrix[r];
      for (let c = 0; c < cols; c += 1) {
        const ch = row[c];
        if (ch === '.') continue;
        const col = palette[ch];
        if (!col) continue;
        ctx.fillStyle = col;
        ctx.fillRect(sx + c * u, sy + r * u, u, u);
      }
    }
  }

  // ===== 5 Member Exclusive 16x16 Pixel Matrices =====
  // 1. 蓝 - 发光星星
  const MATRIX_STAR = [
    '.......kk.......',
    '...s..kyyk..s...',
    '......kyyk......',
    '.....kywwyk.....',
    '.sssskyyyykssss.',
    '.kkkkyyyyyykkkk.',
    'kywwyyyyyyyyyygk',
    '.kywyyyyyyyyygk.',
    '..kyyyyyyyyygk..',
    '...kyyyyyyygk...',
    '...kyyyggyyyk...',
    '..kyyygk.kgyyk..',
    '..kyygk...kgyk..',
    '.kygk.......kgk.',
    '.kk...........k.',
    '................'
  ];

  // 2. 奈 Miona - 双颗红樱桃
  const MATRIX_CHERRY = [
    '.......kkkkk....',
    '......kgggggk...',
    '.....kgklllggk..',
    '....kgk....kggk.',
    '...kgk......kgk.',
    '..kgk........kgk',
    '.kkkkk......kkkk',
    'krrrrrk..krrrrrk',
    'krwwrrk..krwwrrk',
    'krrrrrk..krrrrrk',
    'krrrrdk..krrrrdk',
    'krrrddk..krrrddk',
    '.kdddk....kdddk.',
    '..kkk......kkk..',
    '................',
    '................'
  ];

  // 3. 纱 Fuka - 白色红点骰子
  const MATRIX_DICE = [
    '..kkkkkkkkkkkk..',
    '.kwwwwwwwwwwwwk.',
    'kwwwwwwwwwwwwwwk',
    'kwwrrwwwwwwrrwwk',
    'kwwrrwwwwwwrrwwk',
    'kwwwwwwwwwwwwwwk',
    'kwwwwwwwwwwwwwwk',
    'kwwwwwwrrwwwwwwk',
    'kwwwwwwrrwwwwwwk',
    'kwwwwwwwwwwwwwwk',
    'kwwrrwwwwwwrrwwk',
    'kwwrrwwwwwwrrwwk',
    'kwwwwwwwwwwsswwk',
    '.kssssssssssssk.',
    '..kkkkkkkkkkkk..',
    '................'
  ];

  // 4. 桐 Akiri - 米色创可贴
  const MATRIX_BANDAID = [
    '................',
    '................',
    '................',
    '..kkkkkkkkkkkk..',
    '.kmmmmmmmmmmmmk.',
    'kmwmkddddddkmwmk',
    'kmmmkdwdwdwkmmmk',
    'kmwmkddddddkmwmk',
    'kmmmkdwdwdwkmmmk',
    'kmwmkddddddkmwmk',
    '.kmmmmmmmmmmmmk.',
    '.kssssssssssssk.',
    '..kkkkkkkkkkkk..',
    '................',
    '................',
    '................'
  ];

  // 5. 树 Akiko - 深绿松树
  const MATRIX_PINE = [
    '.......kk.......',
    '......kyyk......',
    '.....kggggk.....',
    '....kglggggk....',
    '.....kddddk.....',
    '....kggggggk....',
    '...kglgggggdk...',
    '..kgggggggggdk..',
    '....kddddddk....',
    '...kggggggggk...',
    '..kglgggggggdk..',
    '.kgggggggggggdk.',
    '..kkkkkkkkkkkk..',
    '......kbbk......',
    '......kbbk......',
    '......kkkk......'
  ];

  // ===== F1owSec Theme & Universal 16x16 Pixel Matrices =====
  // 黑白赛车格子旗
  const MATRIX_FLAG = [
    '.kk.............',
    'ksskkkkkkkkkkkk.',
    'kskwwbbwwbbwwbbk',
    'kskwwbbwwbbwwbbk',
    'kskbbwwbbwwbbwwk',
    'kskbbwwbbwwbbwwk',
    'kskwwbbwwbbwwbbk',
    'kskwwbbwwbbwwbbk',
    'kskbbwwbbwwbbwwk',
    'kskbbwwbbwwbbwwk',
    'kskkkkkkkkkkkkk.',
    'ksk.............',
    'ksk.............',
    'ksk.............',
    'ksk.............',
    '.k..............'
  ];

  // 像素小雨滴
  const MATRIX_RAINDROP = [
    '.......kk.......',
    '......kcck......',
    '.....kcwwck.....',
    '....kcwcccbk....',
    '...kcwcccccbk...',
    '..kcwcccccccbk..',
    '..kcccccccccbk..',
    '.kccccccccccbbk.',
    '.kccccccccccbbk.',
    '.kccccccccccbbk.',
    '..kccccccccbbk..',
    '..kbbbbbbbbbbk..',
    '...kkkkkkkkkk...',
    '................',
    '.k............k.',
    '..kk..kkkk..kk..'
  ];

  // 像素红心
  const MATRIX_HEART = [
    '................',
    '..kkkk....kkkk..',
    '.krrrrk..krrrrk.',
    'krrwwrrkkrrrrrrk',
    'krrwrrrrrrrrrrdk',
    'krrrrrrrrrrrrrdk',
    'krrrrrrrrrrrrrdk',
    '.krrrrrrrrrrrdk.',
    '..krrrrrrrrrdk..',
    '...krrrrrrrdk...',
    '....krrrrrdk....',
    '.....krrrdk.....',
    '......krdk......',
    '.......kk.......',
    '................',
    '................'
  ];

  // 双色闪光星
  const MATRIX_SPARKLE_STAR = [
    '.....kk.........',
    '....kppk........',
    '....kpwk........',
    '..kkpwwpkk......',
    '.kpppwwpppk.....',
    'kppwwwwwwppk.k..',
    '.kpppwwpppk.kck.',
    '..kkpwwpkk.kcwck',
    '....kppk..kcwwck',
    '....kppk...kcck.',
    '.....kk....kcck.',
    '............k...',
    '....k...........',
    '...kyk..........',
    '...kyk..........',
    '....k...........'
  ];

  // 八分音符
  const MATRIX_NOTE = [
    '......kkkkkkkk..',
    '.....kcccccccck.',
    '.....kcwwwwwwck.',
    '.....kcccccccck.',
    '.....kcckkkccck.',
    '.....kcck..kcck.',
    '.....kcck..kcck.',
    '.....kcck..kcck.',
    '..kkkkcck.kkcck.',
    '.kcccccckkcccck.',
    'kccwwccckccwcck.',
    'kccccccckccccck.',
    '.kcccccddkcccdk.',
    '..kkkkkkk.kkkk..',
    '................',
    '................'
  ];

  // 小皇冠
  const MATRIX_CROWN = [
    '................',
    '................',
    '..k....kk....k..',
    '.kyk..kyyk..kyk.',
    '.kyykkywwykkyyk.',
    'kyyyykwwwwkyyyyk',
    'kyryykywwykyybyk',
    'kyyyyyyyyyyyyyyk',
    'kygyyyryyygyyyyk',
    'kggggggggggggggk',
    'kyyyyyyyyyyyyyyk',
    '.kggggggggggggk.',
    '..kkkkkkkkkkkk..',
    '................',
    '................',
    '................'
  ];

  // 像素蝴蝶结
  const MATRIX_RIBBON = [
    '................',
    '................',
    '.kkkk......kkkk.',
    'kppppk....kppppk',
    'kpwwppkkkkppwwpk',
    'kpwppppddppppwpk',
    'kpppppdwwdpppppk',
    'kppddpdwwdpddppk',
    '.kkkkpddddpkkkk.',
    '...kppkddkppk...',
    '..kpppk..kpppk..',
    '.kppdk....kdppk.',
    '.kppk......kppk.',
    '..kk........kk..',
    '................',
    '................'
  ];

  // LOVE 像素字
  const MATRIX_LOVE = [
    '.kkk.....kkkkk..',
    '.kpk....kpppppk.',
    '.kpk....kpk.kpk.',
    '.kpk....kpk.kpk.',
    '.kppkkk.kppdppk.',
    '.kppppk..kkkkk..',
    '.kkkkkk.........',
    '................',
    '.kk..kk..kkkkkk.',
    '.kpk.kpk.kppppk.',
    '.kpk.kpk.kpk....',
    '.kpk.kpk.kpppk..',
    '..kpdpk..kpk....',
    '..kpppk..kppppk.',
    '...kkk...kkkkkk.',
    '................'
  ];

  const JOURNAL_PHRASE_STYLES = {
    phrase_shentui: {
      text: '神推!',
      tapeBg: '#FFE4E6',
      tapeStripe: 'rgba(244, 63, 94, 0.18)',
      border: '#F43F5E',
      fill: '#E11D48',
      accent: '#FACC15',
      width: 210,
      height: 82
    },
    phrase_haoye: {
      text: '好耶!',
      tapeBg: '#FEF3C7',
      tapeStripe: 'rgba(245, 158, 11, 0.20)',
      border: '#F59E0B',
      fill: '#D97706',
      accent: '#EF4444',
      width: 210,
      height: 82
    },
    phrase_xihuan: {
      text: '喜欢♥',
      tapeBg: '#FCE7F3',
      tapeStripe: 'rgba(236, 72, 153, 0.18)',
      border: '#EC4899',
      fill: '#DB2777',
      accent: '#FB7185',
      width: 224,
      height: 82
    },
    phrase_chaokeai: {
      text: '超可爱',
      tapeBg: '#F3E8FF',
      tapeStripe: 'rgba(168, 85, 247, 0.18)',
      border: '#A855F7',
      fill: '#7E22CE',
      accent: '#F472B6',
      width: 230,
      height: 82
    },
    phrase_f1owsec: {
      text: 'F1owSec',
      tapeBg: '#DBEAFE',
      tapeStripe: 'rgba(37, 99, 235, 0.16)',
      border: '#3B82F6',
      fill: '#1D4ED8',
      accent: '#FACC15',
      width: 256,
      height: 80
    },
    phrase_cheki: {
      text: 'CHEKi!',
      tapeBg: '#CCFBF1',
      tapeStripe: 'rgba(13, 148, 136, 0.18)',
      border: '#14B8A6',
      fill: '#0F766E',
      accent: '#F59E0B',
      width: 236,
      height: 80
    }
  };

  function drawJournalPhraseSticker(ctx, defId, x, y, width, height, isMiniIcon) {
    const st = JOURNAL_PHRASE_STYLES[defId];
    if (!st) return;

    const w = Math.max(24, width || st.width);
    const h = Math.max(14, height || st.height);

    ctx.save();
    ctx.imageSmoothingEnabled = true;
    if ('imageSmoothingQuality' in ctx) {
      ctx.imageSmoothingQuality = 'high';
    }

    // Pure transparent cutout marker / handwritten typography (no box or tape background)
    const fontStack = '"YouYuan", "PingFang SC", "Hiragino Maru Gothic ProN", "Segoe Print", "Comic Sans MS", "Microsoft YaHei", cursive, sans-serif';
    let fontSize = isMiniIcon ? Math.max(13, Math.round(h * 0.62)) : 44;
    const maxTextW = w - (isMiniIcon ? 6 : 16);
    ctx.font = `900 ${fontSize}px ${fontStack}`;
    const measured = ctx.measureText(st.text).width;
    if (measured > maxTextW && measured > 0) {
      fontSize = Math.max(8, Math.floor((fontSize * maxTextW) / measured));
      ctx.font = `900 ${fontSize}px ${fontStack}`;
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const drawY = y + (isMiniIcon ? 0.5 : 1.5);

    // 1. Subtle outer dark ink contour so white outline stays visible on light Polaroid borders
    ctx.lineWidth = isMiniIcon ? 5.2 : 14;
    ctx.strokeStyle = 'rgba(24, 18, 43, 0.88)';
    ctx.strokeText(st.text, x, drawY);

    // 2. Crisp white inner halo contour so vivid marker ink pops on dark stage backdrops
    ctx.lineWidth = isMiniIcon ? 3.4 : 9.5;
    ctx.strokeStyle = '#FFFFFF';
    ctx.strokeText(st.text, x, drawY);

    // 3. Vivid marker fill
    ctx.fillStyle = st.fill;
    ctx.fillText(st.text, x, drawY);

    ctx.restore();
  }

  function drawSticker(ctx, item, isMiniIcon) {
    ctx.save();
    if (JOURNAL_PHRASE_STYLES[item.defId]) {
      drawJournalPhraseSticker(ctx, item.defId, item.x, item.y, item.width, item.height, isMiniIcon);
      ctx.restore();
      return;
    }
    ctx.imageSmoothingEnabled = false;
    const x = Math.round(item.x);
    const y = Math.round(item.y);
    const u = item.unit || 7;

    if (item.defId === 'star') {
      drawPixelMatrix(ctx, MATRIX_STAR, {
        k: '#231934',
        y: '#FACC15',
        g: '#D97706',
        w: '#FFFFFF',
        s: '#FEF08A'
      }, x, y, u);
    } else if (item.defId === 'cherry') {
      drawPixelMatrix(ctx, MATRIX_CHERRY, {
        k: '#231934',
        g: '#22C55E',
        l: '#86EFAC',
        r: '#EF4444',
        d: '#B91C1C',
        w: '#FFFFFF'
      }, x, y, u);
    } else if (item.defId === 'dice') {
      drawPixelMatrix(ctx, MATRIX_DICE, {
        k: '#231934',
        w: '#FFFFFF',
        r: '#EF4444',
        s: '#CBD5E1'
      }, x, y, u);
    } else if (item.defId === 'bandaid') {
      drawPixelMatrix(ctx, MATRIX_BANDAID, {
        k: '#231934',
        m: '#E7C8A0',
        s: '#C49B6C',
        d: '#FBF3E4',
        w: '#B48352'
      }, x, y, u);
    } else if (item.defId === 'pine') {
      drawPixelMatrix(ctx, MATRIX_PINE, {
        k: '#231934',
        y: '#FEF08A',
        g: '#166534',
        l: '#22C55E',
        d: '#14532D',
        b: '#78350F'
      }, x, y, u);
    } else if (item.defId === 'flag') {
      drawPixelMatrix(ctx, MATRIX_FLAG, {
        k: '#231934',
        w: '#FFFFFF',
        b: '#18181B',
        s: '#CBD5E1'
      }, x, y, u);
    } else if (item.defId === 'raindrop') {
      drawPixelMatrix(ctx, MATRIX_RAINDROP, {
        k: '#231934',
        c: '#38BDF8',
        b: '#0284C7',
        w: '#FFFFFF'
      }, x, y, u);
    } else if (item.defId === 'heart') {
      drawPixelMatrix(ctx, MATRIX_HEART, {
        k: '#231934',
        r: '#F43F5E',
        d: '#BE123C',
        w: '#FFFFFF'
      }, x, y, u);
    } else if (item.defId === 'sparkleStar') {
      drawPixelMatrix(ctx, MATRIX_SPARKLE_STAR, {
        k: '#231934',
        p: '#F472B6',
        c: '#38BDF8',
        y: '#FACC15',
        w: '#FFFFFF'
      }, x, y, u);
    } else if (item.defId === 'note') {
      drawPixelMatrix(ctx, MATRIX_NOTE, {
        k: '#231934',
        c: '#22D3EE',
        d: '#0891B2',
        w: '#FFFFFF'
      }, x, y, u);
    } else if (item.defId === 'crown') {
      drawPixelMatrix(ctx, MATRIX_CROWN, {
        k: '#231934',
        y: '#FACC15',
        g: '#D97706',
        w: '#FFFFFF',
        r: '#EF4444',
        b: '#3B82F6'
      }, x, y, u);
    } else if (item.defId === 'ribbon') {
      drawPixelMatrix(ctx, MATRIX_RIBBON, {
        k: '#231934',
        p: '#F472B6',
        d: '#DB2777',
        w: '#FFFFFF'
      }, x, y, u);
    } else if (item.defId === 'textLove') {
      drawPixelMatrix(ctx, MATRIX_LOVE, {
        k: '#231934',
        p: '#F43F5E',
        d: '#BE123C',
        w: '#FFFFFF'
      }, x, y, u);
    } else if (item.defId === 'tagF1owSec') {
      const bw = isMiniIcon ? 32 : item.width;
      const bh = isMiniIcon ? 18 : item.height;
      const bx = Math.round(x - bw / 2);
      const by = Math.round(y - bh / 2);
      const b = isMiniIcon ? 1 : 4;

      ctx.fillStyle = '#231934';
      ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = '#38BDF8';
      ctx.fillRect(bx + b, by + b, bw - b * 2, bh - b * 2);
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(bx + b * 2, by + b * 2, bw - b * 4, bh - b * 4);

      if (isMiniIcon) {
        drawBitmap(ctx, 'F1S', x, by + 5, 1, '#FFFFFF', 1);
      } else {
        ctx.fillStyle = '#FACC15';
        ctx.fillRect(bx + b * 2, by + b * 2, 10, bh - b * 4);
        drawBitmap(ctx, 'F1owSec', x + 4, by + 16, 4, '#FFFFFF', 3);
      }
    } else if (item.defId === 'tagSlogan') {
      const bw = isMiniIcon ? 32 : item.width;
      const bh = isMiniIcon ? 18 : item.height;
      const bx = Math.round(x - bw / 2);
      const by = Math.round(y - bh / 2);
      const b = isMiniIcon ? 1 : 4;

      ctx.fillStyle = '#231934';
      ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = '#A855F7';
      ctx.fillRect(bx + b, by + b, bw - b * 2, bh - b * 2);
      ctx.fillStyle = '#1E1B4B';
      ctx.fillRect(bx + b * 2, by + b * 2, bw - b * 4, bh - b * 4);

      if (isMiniIcon) {
        drawBitmap(ctx, 'ONE', x, by + 5, 1, '#FDE047', 1);
      } else {
        drawBitmap(ctx, 'Flow One Sec', x, by + 17, 3, '#FEF08A', 2);
      }
    } else if (item.defId === 'badgeF1Club') {
      const bw = isMiniIcon ? 32 : item.width;
      const bh = isMiniIcon ? 22 : item.height;
      const bx = Math.round(x - bw / 2);
      const by = Math.round(y - bh / 2);
      const b = isMiniIcon ? 1 : 4;

      ctx.fillStyle = '#231934';
      ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = '#FACC15';
      ctx.fillRect(bx + b, by + b, bw - b * 2, bh - b * 2);
      ctx.fillStyle = '#140D29';
      ctx.fillRect(bx + b * 2, by + b * 2, bw - b * 4, bh - b * 4);

      if (isMiniIcon) {
        drawBitmap(ctx, 'F1', x, by + 4, 1, '#FEF08A', 1);
        drawBitmap(ctx, 'CLUB', x, by + 12, 1, '#38BDF8', 1);
      } else {
        // Black & white checkered stripe on top & bottom inside badge
        const cell = 8;
        for (let cx = bx + b * 2; cx < bx + bw - b * 2 - 4; cx += cell) {
          const isEven = Math.floor((cx - bx) / cell) % 2 === 0;
          ctx.fillStyle = isEven ? '#FFFFFF' : '#27272A';
          ctx.fillRect(cx, by + b * 2, Math.min(cell, bx + bw - b * 2 - cx), 6);
        }
        ctx.fillStyle = '#FEF08A';
        ctx.font = 'bold 28px "PingFang SC", "Microsoft YaHei", monospace, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('F1俱乐部', x, by + Math.round(bh / 2) + 4);
      }
    } else if (item.defId === 'datestamp') {
      const dw = isMiniIcon ? 32 : item.width;
      const dh = isMiniIcon ? 18 : item.height;
      const dx = Math.round(x - dw / 2);
      const dy = Math.round(y - dh / 2);
      const b = isMiniIcon ? 1 : 4;

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(dx, dy, dw, dh);
      ctx.fillStyle = '#E11D48';
      ctx.fillRect(dx, dy, dw, b);
      ctx.fillRect(dx, dy + dh - b, dw, b);
      ctx.fillRect(dx, dy, b, dh);
      ctx.fillRect(dx + dw - b, dy, b, dh);

      if (isMiniIcon) {
        const shortDate = (item.dateStr || '2026.11.22').slice(5);
        drawBitmap(ctx, shortDate, x, dy + 5, 1, '#E11D48', 1);
      } else {
        drawBitmap(ctx, item.dateStr || '2026.11.22', x, dy + 14, 4, '#E11D48', 2);
      }
    }

    ctx.restore();
  }

  function getPalette(member, isGroup, dateStr) {
    const memberDefs = [
      { id: 'star', title: '发光星星', width: 112, height: 112, unit: 7 },
      { id: 'cherry', title: '红樱桃', width: 112, height: 112, unit: 7 },
      { id: 'dice', title: '红点骰子', width: 112, height: 112, unit: 7 },
      { id: 'bandaid', title: '创可贴', width: 112, height: 112, unit: 7 },
      { id: 'pine', title: '深绿松树', width: 112, height: 112, unit: 7 }
    ];

    const exclusiveId = (!isGroup && member && member.sticker && member.sticker.id) || '';
    const orderedMemberDefs = exclusiveId
      ? [
          ...memberDefs.filter((d) => d.id === exclusiveId),
          ...memberDefs.filter((d) => d.id !== exclusiveId)
        ]
      : memberDefs;

    const phraseDefs = Object.keys(JOURNAL_PHRASE_STYLES).map((id) => {
      const st = JOURNAL_PHRASE_STYLES[id];
      return {
        id,
        title: st.text,
        width: st.width,
        height: st.height,
        unit: 4,
        isVector: true
      };
    });

    const themeDefs = [
      { id: 'flag', title: '格子旗', width: 112, height: 112, unit: 7 },
      { id: 'raindrop', title: '小雨滴', width: 112, height: 112, unit: 7 },
      { id: 'heart', title: '像素红心', width: 112, height: 112, unit: 7 },
      { id: 'sparkleStar', title: '双色闪星', width: 112, height: 112, unit: 7 },
      { id: 'note', title: '八分音符', width: 112, height: 112, unit: 7 },
      { id: 'crown', title: '小皇冠', width: 112, height: 112, unit: 7 },
      { id: 'ribbon', title: '蝴蝶结', width: 112, height: 112, unit: 7 },
      { id: 'tagF1owSec', title: 'F1owSec', width: 224, height: 60, unit: 4 },
      { id: 'tagSlogan', title: 'FlowOneSec', width: 256, height: 56, unit: 4 },
      { id: 'badgeF1Club', title: 'F1俱乐部', width: 204, height: 76, unit: 4 },
      { id: 'textLove', title: 'LOVE', width: 112, height: 112, unit: 7 },
      { id: 'datestamp', title: '日期戳', width: 256, height: 56, unit: 4, dateStr }
    ];

    if (!isGroup && orderedMemberDefs.length > 0 && exclusiveId) {
      return [orderedMemberDefs[0], ...phraseDefs, ...orderedMemberDefs.slice(1), ...themeDefs];
    }
    return [...phraseDefs, ...orderedMemberDefs, ...themeDefs];
  }

  function renderIconToCanvas(canvas, def, _member, _isGroup, dateStr) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (def && def.isVector) {
      ctx.imageSmoothingEnabled = true;
      if ('imageSmoothingQuality' in ctx) {
        ctx.imageSmoothingQuality = 'high';
      }
      const scale = Math.min((canvas.width - 8) / def.width, (canvas.height - 8) / def.height);
      const item = {
        defId: def.id,
        x: canvas.width / 2,
        y: canvas.height / 2,
        width: Math.round(def.width * scale),
        height: Math.round(def.height * scale),
        unit: 2,
        dateStr
      };
      drawSticker(ctx, item, true);
      return;
    }

    ctx.imageSmoothingEnabled = false;
    const item = {
      defId: def.id,
      x: canvas.width / 2,
      y: canvas.height / 2,
      width: canvas.width - 4,
      height: canvas.height - 4,
      unit: 2,
      dateStr: dateStr
    };
    drawSticker(ctx, item, true);
  }

  class StickerSession {
    constructor() {
      this.canvasW = 888;
      this.canvasH = 1168;
      this.member = null;
      this.isGroup = false;
      this.dateStr = '';
      this.palette = [];
      this.items = [];
      this.selectedIndex = -1;
      this.dragging = false;
      this.dragOffsetX = 0;
      this.dragOffsetY = 0;
    }

    reset(canvasW, canvasH, member, isGroup, dateStr) {
      this.canvasW = canvasW;
      this.canvasH = canvasH;
      this.member = member;
      this.isGroup = Boolean(isGroup);
      this.dateStr = dateStr || '';
      this.palette = getPalette(member, this.isGroup, this.dateStr);
      this.items = [];
      this.selectedIndex = -1;
      this.dragging = false;
    }

    getPalette() {
      return this.palette;
    }

    _clampItem(item) {
      item.x = Math.max(24, Math.min(this.canvasW - 24, item.x));
      item.y = Math.max(24, Math.min(this.canvasH - 24, item.y));
    }

    addSticker(defId) {
      const def = this.palette.find((p) => p.id === defId);
      if (!def) return null;

      const idx = this.items.length;
      const offsetX = ((idx % 5) - 2) * 32;
      const offsetY = (Math.floor(idx / 5) % 3 - 1) * 32 - 60;

      const item = {
        defId: def.id,
        x: Math.round(this.canvasW / 2 + offsetX),
        y: Math.round(this.canvasH / 2 + offsetY),
        width: def.width,
        height: def.height,
        unit: def.unit,
        scale: 1,
        rotationDeg: 0,
        isVector: Boolean(def.isVector),
        dateStr: this.dateStr
      };
      this._clampItem(item);
      this.items.push(item);
      this.selectedIndex = this.items.length - 1;
      return item;
    }

    getSelectedItem() {
      if (this.selectedIndex < 0 || this.selectedIndex >= this.items.length) return null;
      return this.items[this.selectedIndex] || null;
    }

    rotateSelected(deltaDeg) {
      const item = this.getSelectedItem();
      if (!item) return false;
      item.rotationDeg = Math.round(((item.rotationDeg || 0) + deltaDeg) * 10) / 10;
      return true;
    }

    scaleSelected(delta) {
      const item = this.getSelectedItem();
      if (!item) return false;
      const next = (item.scale || 1) + delta;
      item.scale = Math.max(0.45, Math.min(2.4, Math.round(next * 100) / 100));
      return true;
    }

    setSelectedTransform(scale, rotationDeg) {
      const item = this.getSelectedItem();
      if (!item) return false;
      if (scale != null && Number.isFinite(scale)) {
        item.scale = Math.max(0.45, Math.min(2.4, Math.round(scale * 1000) / 1000));
      }
      if (rotationDeg != null && Number.isFinite(rotationDeg)) {
        item.rotationDeg = Math.round(rotationDeg * 10) / 10;
      }
      return true;
    }

    deleteSelected() {
      if (this.selectedIndex < 0 || this.selectedIndex >= this.items.length) return null;
      const [removed] = this.items.splice(this.selectedIndex, 1);
      this.selectedIndex = -1;
      this.dragging = false;
      return removed;
    }

    clearSelection() {
      this.selectedIndex = -1;
      this.dragging = false;
    }

    undo() {
      if (this.items.length === 0) return null;
      const removed = this.items.pop();
      this.selectedIndex = this.items.length - 1;
      this.dragging = false;
      return removed;
    }

    clear() {
      this.items = [];
      this.selectedIndex = -1;
      this.dragging = false;
    }

    hitTest(x, y) {
      const pad = 18;
      for (let i = this.items.length - 1; i >= 0; i -= 1) {
        const it = this.items[i];
        const sc = it.scale || 1;
        const rad = -((it.rotationDeg || 0) * Math.PI) / 180;
        const dx = x - it.x;
        const dy = y - it.y;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const localX = (dx * cos - dy * sin) / sc;
        const localY = (dx * sin + dy * cos) / sc;
        const hw = it.width / 2 + pad / sc;
        const hh = it.height / 2 + pad / sc;
        if (Math.abs(localX) <= hw && Math.abs(localY) <= hh) {
          return i;
        }
      }
      return -1;
    }

    startDrag(x, y) {
      const idx = this.hitTest(x, y);
      if (idx === -1) {
        this.selectedIndex = -1;
        this.dragging = false;
        return false;
      }
      const [picked] = this.items.splice(idx, 1);
      this.items.push(picked);
      this.selectedIndex = this.items.length - 1;
      this.dragging = true;
      this.dragOffsetX = x - picked.x;
      this.dragOffsetY = y - picked.y;
      return true;
    }

    moveDrag(x, y) {
      if (!this.dragging || this.selectedIndex < 0) return false;
      const item = this.items[this.selectedIndex];
      if (!item) return false;
      item.x = Math.round(x - this.dragOffsetX);
      item.y = Math.round(y - this.dragOffsetY);
      this._clampItem(item);
      return true;
    }

    endDrag() {
      this.dragging = false;
    }

    renderAll(ctx, showSelectionOutline) {
      ctx.save();
      this.items.forEach((item, idx) => {
        const sc = item.scale || 1;
        const rad = ((item.rotationDeg || 0) * Math.PI) / 180;

        ctx.save();
        ctx.translate(Math.round(item.x), Math.round(item.y));
        if (rad !== 0) {
          ctx.rotate(rad);
        }
        if (sc !== 1) {
          ctx.scale(sc, sc);
        }

        drawSticker(ctx, Object.assign({}, item, { x: 0, y: 0 }), false);

        if (showSelectionOutline && idx === this.selectedIndex) {
          const sx = -item.width / 2 - 8 / sc;
          const sy = -item.height / 2 - 8 / sc;
          const sw = item.width + 16 / sc;
          const sh = item.height + 16 / sc;
          ctx.imageSmoothingEnabled = true;
          ctx.strokeStyle = '#FACC15';
          ctx.lineWidth = Math.max(2, 4 / sc);
          if (typeof ctx.setLineDash === 'function') {
            ctx.setLineDash([12 / sc, 8 / sc]);
          }
          ctx.strokeRect(sx, sy, sw, sh);
        }
        ctx.restore();
      });
      ctx.restore();
    }
  }

  ChekiGame.Stickers = {
    getPalette,
    renderIconToCanvas,
    drawSticker,
    StickerSession
  };
})(window);
