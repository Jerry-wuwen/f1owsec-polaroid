(function (global) {
  'use strict';

  const ChekiGame = global.ChekiGame || (global.ChekiGame = {});

  // 1. 团体与全局文案配置
  const GROUP_CONFIG = {
    groupName: 'F1owSec',
    groupTag: 'Flow One Sec',
    groupPhotoTitle: 'F1owSec 全员集结',
    groupPhotoSub: 'FLOW ONE SEC'
  };

  // 2. 五位成员官方设定（按担当色与官方符号配置）
  const MEMBERS = [
    {
      id: 'member_1',
      name: '蓝',
      enName: '',
      color: '#3B82F6',          // 蓝色担当
      lightColor: '#93C5FD',
      accentColor: '#3B82F6',
      darkColor: '#1D4ED8',
      deepColor: '#1E3A8A',
      hairBase: '#2563EB',
      hairLight: '#60A5FA',
      hairDark: '#1E3A8A',
      eyeColor: '#2563EB',
      dressTrim: '#FFFFFF',
      colorTag: '蓝色担当',
      hairStyle: 'bob-ribbon',
      accessory: 'star',
      smileType: 'cheerful',
      pose: 'peace',
      spriteUrl: './assets/member_1.png',
      poseSpriteUrl: './assets/member_1_pose.png',
      pose2SpriteUrl: './assets/member_1_pose2.png',
      pose3SpriteUrl: './assets/member_1_pose3.png',
      pose4SpriteUrl: './assets/member_1_pose4.png',
      hairVariants: {
        long: {
          label: '长发',
          spriteUrl: './assets/member_1.png',
          poseSpriteUrl: './assets/member_1_pose.png',
          pose2SpriteUrl: './assets/member_1_pose2.png',
          pose3SpriteUrl: './assets/member_1_pose3.png',
          pose4SpriteUrl: './assets/member_1_pose4.png'
        },
        short: {
          label: '短发',
          spriteUrl: './assets/member_1_short.png',
          poseSpriteUrl: './assets/member_1_short_pose.png',
          pose2SpriteUrl: './assets/member_1_short_pose2.png',
          pose3SpriteUrl: './assets/member_1_short_pose3.png',
          pose4SpriteUrl: './assets/member_1_short_pose4.png'
        }
      },
      scale: 1.0,
      offsetY: 0,
      sticker: {
        id: 'star',              // 🌟 像素星星
        label: '星星',
        stampText: 'BLUE ★'
      }
    },
    {
      id: 'member_2',
      name: '奈',
      enName: 'Miona',
      color: '#EF4444',          // 红色担当
      lightColor: '#FCA5A5',
      accentColor: '#EF4444',
      darkColor: '#B91C1C',
      deepColor: '#7F1D1D',
      hairBase: '#DC2626',
      hairLight: '#FCA5A5',
      hairDark: '#991B1B',
      eyeColor: '#DC2626',
      dressTrim: '#FFF5F5',
      colorTag: '红色担当',
      hairStyle: 'twintails',
      accessory: 'bows',
      smileType: 'cat',
      pose: 'heart',
      spriteUrl: './assets/member_2.png',
      poseSpriteUrl: './assets/member_2_pose.png',
      pose2SpriteUrl: './assets/member_2_pose2.png',
      pose3SpriteUrl: './assets/member_2_pose3.png',
      pose4SpriteUrl: './assets/member_2_pose4.png',
      scale: 1.0,
      offsetY: 0,
      sticker: {
        id: 'cherry',            // 🍒 像素樱桃
        label: '樱桃',
        stampText: 'MIONA ♥'
      }
    },
    {
      id: 'member_3',
      name: '纱',
      enName: 'Fuka',
      color: '#F472B6',          // 粉色担当
      lightColor: '#FBCFE8',
      accentColor: '#F472B6',
      darkColor: '#BE185D',
      deepColor: '#831843',
      hairBase: '#EC4899',
      hairLight: '#F9A8D4',
      hairDark: '#9D174D',
      eyeColor: '#DB2777',
      dressTrim: '#FFF1F2',
      colorTag: '粉色担当',
      hairStyle: 'wavy',
      accessory: 'bows',
      smileType: 'open',
      pose: 'mic',
      spriteUrl: './assets/member_3.png',
      poseSpriteUrl: './assets/member_3_pose.png',
      pose2SpriteUrl: './assets/member_3_pose2.png',
      pose3SpriteUrl: './assets/member_3_pose3.png',
      pose4SpriteUrl: './assets/member_3_pose4.png',
      scale: 1.0,
      offsetY: 0,
      sticker: {
        id: 'dice',              // 🎲 像素骰子
        label: '骰子',
        stampText: 'FUKA ✦'
      }
    },
    {
      id: 'member_4',
      name: '桐',
      enName: 'Akiri',
      color: '#22C55E',          // 绿色担当
      lightColor: '#86EFAC',
      accentColor: '#22C55E',
      darkColor: '#15803D',
      deepColor: '#14532D',
      hairBase: '#16A34A',
      hairLight: '#86EFAC',
      hairDark: '#166534',
      eyeColor: '#15803D',
      dressTrim: '#F0FDF4',
      colorTag: '绿色担当',
      hairStyle: 'ponytail',
      accessory: 'beret',
      smileType: 'cheerful',
      pose: 'wave',
      spriteUrl: './assets/member_4.png',
      poseSpriteUrl: './assets/member_4_pose.png',
      pose2SpriteUrl: './assets/member_4_pose2.png',
      pose3SpriteUrl: './assets/member_4_pose3.png',
      pose4SpriteUrl: './assets/member_4_pose4.png',
      scale: 1.0,
      offsetY: 0,
      sticker: {
        id: 'bandaid',           // 🩹 像素创可贴
        label: '创可贴',
        stampText: 'AKIRI ✚'
      }
    },
    {
      id: 'member_5',
      name: '树',
      enName: 'Akiko',
      color: '#27272A',          // 黑色担当（深炭黑）
      lightColor: '#A1A1AA',     // 银灰高光
      accentColor: '#A1A1AA',    // 亮银UI高亮边框与发光色
      darkColor: '#18181B',
      deepColor: '#09090B',
      isDarkColor: true,
      hairBase: '#27272A',
      hairLight: '#A1A1AA',
      hairDark: '#09090B',
      eyeColor: '#52525B',
      dressTrim: '#F4F4F5',
      colorTag: '黑色担当',
      hairStyle: 'long',
      accessory: 'moon',
      smileType: 'gentle',
      pose: 'peace',
      spriteUrl: './assets/member_5.png',
      poseSpriteUrl: './assets/member_5_pose.png',
      pose2SpriteUrl: './assets/member_5_pose2.png',
      pose3SpriteUrl: './assets/member_5_pose3.png',
      pose4SpriteUrl: './assets/member_5_pose4.png',
      scale: 1.0,
      offsetY: 0,
      sticker: {
        id: 'pine',              // 🌲 像素松树
        label: '松树',
        stampText: 'AKIKO ♠'
      }
    }
  ];

  // 3. 室内特典会打卡墙背景与灯牌文案配置（贴合 F1owSec 官方设定）
  const BACKGROUNDS = [
    {
      id: 'cyber_lab',
      name: '赛博打卡墙',
      shortName: '赛博墙',
      topText: 'F1owSec LAB',
      subText: 'TOKUTENKAI',
      style: 'cyber_grid'        // 室内霓虹打卡板 + 成员应援色边框
    },
    {
      id: 'rainy_night',
      name: '雨夜打卡墙',
      shortName: '雨夜墙',
      topText: 'FLOW ONE SEC',
      subText: 'RAINY MOMENT',
      style: 'rainy_cyber'       // 雨夜玻璃窗打卡墙 + 细微雨丝
    },
    {
      id: 'f1_starlight',
      name: '星光格子墙',
      shortName: '格子墙',
      topText: 'F1owSec CLUB',
      subText: 'TOKUTENKAI',
      style: 'f1_starlight'      // F1owSec 主题方格打卡墙 + 黑白格子装饰条
    }
  ];

  ChekiGame.GROUP_CONFIG = GROUP_CONFIG;
  ChekiGame.MEMBERS = MEMBERS;
  ChekiGame.BACKGROUNDS = BACKGROUNDS;

  ChekiGame.CONFIG = {
    ASSET_VERSION: '20261123e',
    CANVAS_WIDTH: 270,
    CANVAS_HEIGHT: 480,
    STAGE_SCALE: 2,
    STAGE_WIDTH: 540,
    STAGE_HEIGHT: 960,

    VIEWFINDER: {
      x: 40,
      y: 58,
      w: 190,
      h: 212
    },

    GROUP_VIEWFINDER: {
      x: 14,
      y: 72,
      w: 242,
      h: 174
    },

    RHYTHM_BAR: {
      x: 24,
      y: 294,
      w: 222,
      h: 20,
      speed: 1.08,
      perfectHalf: 0.08,
      greatHalf: 0.24
    },

    POLAROID: {
      scale: 4,
      padX: 16,
      padTop: 16,
      padBottom: 64
    },

    GROUP_POLAROID: {
      scale: 4,
      padX: 14,
      padTop: 14,
      padBottom: 56
    },

    GROUP_CONFIG: GROUP_CONFIG,

    GROUP_MEMBER: {
      id: 'all',
      name: '全员团切',
      shortLabel: '蓝·奈·纱·桐·树',
      enName: GROUP_CONFIG.groupPhotoTitle,
      color: '#FACC15',
      lightColor: '#FEF08A',
      accentColor: '#FACC15',
      darkColor: '#7C3AED',
      deepColor: '#3B0764',
      colorTag: GROUP_CONFIG.groupTag
    },

    NICKNAME_STORAGE_KEY: 'f1owsec_nickname_v1',
    HAIR_PREF_STORAGE_KEY: 'f1owsec_hair_pref_v1',
    GROUP_GUIDE_STORAGE_KEY: 'f1owsec_group_guide_seen_v1',
    GAME_MODE_STORAGE_KEY: 'f1owsec_game_mode_v1',

    ALBUM: {
      storageKey: 'f1owsec_cheki_album_v2',
      metaStorageKey: 'f1owsec_cheki_meta_v3',
      dbName: 'f1owsec_cheki_db_v1',
      storeName: 'photos',
      maxStoreWidth: 1080,
      jpegQuality: 0.88,
      maxPngChars: 130000
    },

    POSE_COLLECTION: {
      storageKey: 'f1owsec_pose_dex_v1'
    },

    PIXEL_FILTER: {
      storageKey: 'f1owsec_vibe_filter_v2',
      defaults: {
        scanlines: false,
        cyberCool: false,
        warmFilm: false,
        stageGlow: false
      }
    },

    MEMBERS: MEMBERS,
    BACKGROUNDS: BACKGROUNDS,

    JUDGMENTS: {
      PERFECT: {
        key: 'PERFECT',
        label: 'PERFECT',
        stars: '★★★',
        color: '#FACC15',
        subText: '应援色限定拍立得!'
      },
      GREAT: {
        key: 'GREAT',
        label: 'GREAT',
        stars: '★★☆',
        color: '#4ADE80',
        subText: '绝佳抓拍!'
      },
      GOOD: {
        key: 'GOOD',
        label: 'GOOD',
        stars: '★☆☆',
        color: '#93C5FD',
        subText: '可爱留念!'
      }
    }
  };
})(window);
