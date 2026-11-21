/* Tepi Kata Studio — Mesin Tema & Konfigurasi Terpisah (studio/config.json)
 * Dimuat dengan cache: 'no-store' + fallback bawaan agar aplikasi tidak pernah blank.
 * Dipakai bersama oleh studio/index.html, studio/dashboard.js, studio/settings.html, dan album/album.js.
 */
(function (global) {
  'use strict';

  var PREVIEW_KEY = 'tepikata_studio_preview_config';
  var DRAFT_KEY = 'tepikata_studio_draft_config';

  var PRESETS = {
    'fine-art-white': {
      id: 'fine-art-white',
      name: 'Fine-Art Gallery White',
      tagline: 'Senada portofolio Tepi Kata — galeri putih bersih, tinta obsidian & aksen antique bronze',
      cornerStyle: 'sharp',
      colors: {
        bg: '#FFFFFF',
        surface: '#F8F8F8',
        soft: '#F2F0EC',
        ink: '#121212',
        muted: '#686868',
        line: '#E5E2DC',
        accent: '#96764A',
        accentLight: '#C9AE82',
        headerBg: '#FFFFFF',
        headerSurface: '#F8F8F8',
        headerInk: '#121212',
        headerMuted: '#686868'
      },
      fonts: {
        display: 'Cormorant Garamond',
        body: 'Inter'
      }
    },
    'editorial-obsidian': {
      id: 'editorial-obsidian',
      name: 'Editorial Obsidian & Bronze',
      tagline: 'Header gelap obsidian #121212 dengan aksen bronze hangat & kartu putih bersih',
      cornerStyle: 'sharp',
      colors: {
        bg: '#F8F8F8',
        surface: '#FFFFFF',
        soft: '#EFECE6',
        ink: '#121212',
        muted: '#686868',
        line: '#E4E0D8',
        accent: '#96764A',
        accentLight: '#C9AE82',
        headerBg: '#121212',
        headerSurface: '#1E1E1E',
        headerInk: '#F8F6F2',
        headerMuted: '#C9AE82'
      },
      fonts: {
        display: 'Cormorant Garamond',
        body: 'Inter'
      }
    },
    'classic-plum': {
      id: 'classic-plum',
      name: 'Classic Plum',
      tagline: 'Tampilan ungu plum & krem bawaan asli Tepi Kata Studio — 1 klik kembali kapan saja',
      cornerStyle: 'rounded',
      colors: {
        bg: '#F1EEEA',
        surface: '#FFFFFF',
        soft: '#F3EEE8',
        ink: '#1D1A1B',
        muted: '#77706B',
        line: '#E7E1DA',
        accent: '#B08A57',
        accentLight: '#D9C2A0',
        headerBg: '#2E1A24',
        headerSurface: '#4B2A3A',
        headerInk: '#F7EFEA',
        headerMuted: '#D9C2A0'
      },
      fonts: {
        display: 'Bodoni Moda',
        body: 'Plus Jakarta Sans'
      }
    }
  };

  var FONT_PAIRS = [
    { id: 'cormorant-inter', label: 'Cormorant Garamond + Inter (Fine-Art)', display: 'Cormorant Garamond', body: 'Inter' },
    { id: 'bodoni-inter', label: 'Bodoni Moda + Inter (Editorial)', display: 'Bodoni Moda', body: 'Inter' },
    { id: 'bodoni-jakarta', label: 'Bodoni Moda + Plus Jakarta Sans (Classic)', display: 'Bodoni Moda', body: 'Plus Jakarta Sans' }
  ];

  var DEFAULT_CONFIG = {
    version: 1,
    theme: {
      preset: 'classic-plum',
      cornerStyle: 'rounded',
      colors: {
        bg: '#F1EEEA',
        surface: '#FFFFFF',
        soft: '#F3EEE8',
        ink: '#1D1A1B',
        muted: '#77706B',
        line: '#E7E1DA',
        accent: '#B08A57',
        accentLight: '#D9C2A0',
        headerBg: '#2E1A24',
        headerSurface: '#4B2A3A',
        headerInk: '#F7EFEA',
        headerMuted: '#D9C2A0'
      },
      fonts: {
        display: 'Bodoni Moda',
        body: 'Plus Jakarta Sans'
      }
    },
    collage: {
      source: 'drive',
      filter: 'sepia',
      showHero: true,
      showBackground: true,
      photos: []
    },
    album: {
      defaultWidth: 25,
      defaultHeight: 30,
      defaultMargin: 1.2,
      defaultGap: 0.5,
      defaultPageBg: '#ffffff'
    },
    client: {
      brand: 'TEPI KATA',
      greeting: 'Selamat datang',
      emptyEyebrow: 'Galeri foto klien',
      emptyTitle: 'Tepi Kata',
      emptyNote: 'Buka link pribadi yang dikirim fotografer Anda untuk melihat galeri foto Anda.',
      loadingMessages: [
        'Foto-foto hari bahagia Anda sedang disiapkan.',
        'Menyusun foto dari setiap sesi…',
        'Sebentar lagi, hampir siap…',
        'Galeri berisi banyak foto, terima kasih sudah menunggu.'
      ]
    }
  };

  function clone(o) {
    return JSON.parse(JSON.stringify(o));
  }

  function validHex(v, fallback) {
    var s = String(v || '').trim();
    if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toUpperCase();
    if (/^#[0-9a-fA-F]{3}$/.test(s)) {
      return ('#' + s[1] + s[1] + s[2] + s[2] + s[3] + s[3]).toUpperCase();
    }
    return fallback;
  }

  function hexToRgb(hex) {
    var h = validHex(hex, '#121212').slice(1);
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16)
    ];
  }

  function luminance(hex) {
    var rgb = hexToRgb(hex).map(function (c) {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  }

  function isLightHex(hex) {
    return luminance(hex) > 0.45;
  }

  function mixHex(hexA, hexB, weightB) {
    var a = hexToRgb(hexA), b = hexToRgb(hexB), w = Math.max(0, Math.min(1, weightB));
    var out = [0, 1, 2].map(function (i) {
      var v = Math.round(a[i] * (1 - w) + b[i] * w);
      return ('0' + v.toString(16)).slice(-2);
    });
    return '#' + out.join('').toUpperCase();
  }

  function clampNum(v, min, max, fallback) {
    var n = parseFloat(v);
    if (isNaN(n)) return fallback;
    return Math.max(min, Math.min(max, Math.round(n * 100) / 100));
  }

  function mergeConfig(raw) {
    var base = clone(DEFAULT_CONFIG);
    if (!raw || typeof raw !== 'object') return base;

    if (raw.theme && typeof raw.theme === 'object') {
      var t = raw.theme;
      if (t.preset && (PRESETS[t.preset] || t.preset === 'custom')) {
        base.theme.preset = t.preset;
      }
      if (t.cornerStyle === 'sharp' || t.cornerStyle === 'rounded') {
        base.theme.cornerStyle = t.cornerStyle;
      }
      if (t.colors && typeof t.colors === 'object') {
        Object.keys(base.theme.colors).forEach(function (k) {
          if (t.colors[k]) base.theme.colors[k] = validHex(t.colors[k], base.theme.colors[k]);
        });
      }
      if (t.fonts && typeof t.fonts === 'object') {
        if (t.fonts.display) base.theme.fonts.display = String(t.fonts.display).trim();
        if (t.fonts.body) base.theme.fonts.body = String(t.fonts.body).trim();
      }
    }

    if (raw.collage && typeof raw.collage === 'object') {
      var col = raw.collage;
      if (col.source === 'custom' || col.source === 'drive' || col.source === 'none') {
        base.collage.source = col.source;
      }
      if (col.filter === 'natural' || col.filter === 'mono' || col.filter === 'sepia') {
        base.collage.filter = col.filter;
      }
      if (typeof col.showHero === 'boolean') base.collage.showHero = col.showHero;
      if (typeof col.showBackground === 'boolean') base.collage.showBackground = col.showBackground;
      if (Array.isArray(col.photos)) {
        base.collage.photos = col.photos.filter(function (p) {
          return typeof p === 'string' && p.trim().length > 0;
        }).map(function (p) { return p.trim(); });
      }
    }

    if (raw.album && typeof raw.album === 'object') {
      var al = raw.album;
      base.album.defaultWidth = clampNum(al.defaultWidth, 10, 80, base.album.defaultWidth);
      base.album.defaultHeight = clampNum(al.defaultHeight, 10, 80, base.album.defaultHeight);
      base.album.defaultMargin = clampNum(al.defaultMargin, 0, 5, base.album.defaultMargin);
      base.album.defaultGap = clampNum(al.defaultGap, 0, 3, base.album.defaultGap);
      if (al.defaultPageBg) base.album.defaultPageBg = validHex(al.defaultPageBg, base.album.defaultPageBg).toLowerCase();
    }

    if (raw.client && typeof raw.client === 'object') {
      var cl = raw.client;
      if (typeof cl.brand === 'string' && cl.brand.trim()) base.client.brand = cl.brand.trim();
      if (typeof cl.greeting === 'string' && cl.greeting.trim()) base.client.greeting = cl.greeting.trim();
      if (typeof cl.emptyEyebrow === 'string' && cl.emptyEyebrow.trim()) base.client.emptyEyebrow = cl.emptyEyebrow.trim();
      if (typeof cl.emptyTitle === 'string' && cl.emptyTitle.trim()) base.client.emptyTitle = cl.emptyTitle.trim();
      if (typeof cl.emptyNote === 'string' && cl.emptyNote.trim()) base.client.emptyNote = cl.emptyNote.trim();
      if (Array.isArray(cl.loadingMessages)) {
        var msgs = cl.loadingMessages.map(function (m) { return String(m || '').trim(); }).filter(Boolean);
        if (msgs.length) base.client.loadingMessages = msgs;
      }
    }

    return base;
  }

  function applyPresetToConfig(cfg, presetId) {
    var p = PRESETS[presetId];
    if (!p) return cfg;
    var next = mergeConfig(cfg);
    next.theme.preset = p.id;
    next.theme.cornerStyle = p.cornerStyle;
    next.theme.colors = clone(p.colors);
    next.theme.fonts = clone(p.fonts);
    return next;
  }

  function fontStack(name, kind) {
    var n = String(name || '').replace(/["';]/g, '').trim();
    if (kind === 'display') {
      return '"' + (n || 'Bodoni Moda') + '", "Cormorant Garamond", Georgia, serif';
    }
    return '"' + (n || 'Plus Jakarta Sans') + '", "Inter", system-ui, -apple-system, sans-serif';
  }

  // Optional in-memory registry for unsaved uploaded photos (for instant live preview)
  var previewPhotoMap = {};

  function setPreviewPhotos(map) {
    previewPhotoMap = map || {};
  }

  function resolvePhotoUrl(path, basePrefix) {
    var p = String(path || '').trim();
    if (!p) return '';
    if (previewPhotoMap[p]) return previewPhotoMap[p];
    if (/^(data:|blob:|https?:\/\/|\/)/i.test(p)) return p;
    var prefix = basePrefix == null ? '' : String(basePrefix);
    var clean = p.replace(/^studio\//i, '');
    return prefix + clean;
  }

  function applyTheme(rawCfg, opts) {
    opts = opts || {};
    var cfg = mergeConfig(rawCfg);
    var c = cfg.theme.colors;
    var sharp = cfg.theme.cornerStyle === 'sharp';
    var lightHeader = isLightHex(c.headerBg);
    var root = document.documentElement;

    var bgRgb = hexToRgb(c.bg).join(',');
    var surfaceRgb = hexToRgb(c.surface).join(',');
    var hdrRgb = hexToRgb(c.headerBg).join(',');
    var inkRgb = hexToRgb(c.ink).join(',');
    var accentRgb = hexToRgb(c.accent).join(',');

    var hdrInk = lightHeader
      ? (isLightHex(c.headerInk) ? '#121212' : c.headerInk)
      : (isLightHex(c.headerInk) ? c.headerInk : '#F7EFEA');
    var hdrMuted = lightHeader
      ? (isLightHex(c.headerMuted) ? '#686868' : c.headerMuted)
      : c.headerMuted;
    var hdrLead = lightHeader ? mixHex(hdrInk, c.headerBg, 0.34) : mixHex(hdrInk, c.headerBg, 0.16);
    var hdrAccent = lightHeader ? c.accent : c.accentLight;
    var btnPrimaryBg = lightHeader ? c.ink : (c.headerSurface || c.headerBg);
    var btnPrimaryInk = isLightHex(btnPrimaryBg) ? '#121212' : '#FFFFFF';
    var tagBg = lightHeader ? c.soft : mixHex(c.headerSurface || c.headerBg, '#FFFFFF', 0.90);
    var tagInk = lightHeader ? c.ink : (c.headerSurface || c.headerBg);
    var accentDark = mixHex(c.accent, '#000000', 0.18);

    var vars = {
      '--tk-bg': c.bg,
      '--tk-surface': c.surface,
      '--tk-soft': c.soft,
      '--tk-ink': c.ink,
      '--tk-muted': c.muted,
      '--tk-line': c.line,
      '--tk-accent': c.accent,
      '--tk-accent-light': c.accentLight,
      '--tk-accent-dark': accentDark,
      '--tk-hdr-bg': c.headerBg,
      '--tk-hdr-surface': c.headerSurface || c.headerBg,
      '--tk-hdr-ink': hdrInk,
      '--tk-hdr-muted': hdrMuted,
      '--tk-hdr-lead': hdrLead,
      '--tk-hdr-accent': hdrAccent,
      '--tk-btn-primary-bg': btnPrimaryBg,
      '--tk-btn-primary-ink': btnPrimaryInk,
      '--tk-tag-bg': tagBg,
      '--tk-tag-ink': tagInk,
      '--tk-bg-rgb': bgRgb,
      '--tk-surface-rgb': surfaceRgb,
      '--tk-hdr-rgb': hdrRgb,
      '--tk-ink-rgb': inkRgb,
      '--tk-accent-rgb': accentRgb,
      '--tk-font-display': fontStack(cfg.theme.fonts.display, 'display'),
      '--tk-font-body': fontStack(cfg.theme.fonts.body, 'body'),
      '--tk-r-card': sharp ? '0px' : '18px',
      '--tk-r-btn': sharp ? '0px' : '12px',
      '--tk-r-chip': sharp ? '0px' : '999px',
      '--tk-r-input': sharp ? '0px' : '16px',
      '--tk-r-badge': sharp ? '0px' : '12px',
      '--tk-r-icon': sharp ? '0px' : '50%',
      '--tk-r-sheet': sharp ? '0px' : '18px',
      '--tk-r-pill': sharp ? '2px' : '999px'
    };

    Object.keys(vars).forEach(function (k) {
      root.style.setProperty(k, vars[k]);
    });

    root.setAttribute('data-tk-preset', cfg.theme.preset);
    root.setAttribute('data-tk-corners', cfg.theme.cornerStyle);
    root.setAttribute('data-tk-header-tone', lightHeader ? 'light' : 'dark');
    root.setAttribute('data-tk-collage-filter', cfg.collage.filter);
    root.setAttribute('data-tk-collage-source', cfg.collage.source);

    var metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', opts.themeColorFromBg ? c.bg : c.headerBg);
    }

    global.TepiKataConfig = cfg;

    if (!opts.silent) {
      try {
        var ev;
        if (typeof CustomEvent === 'function') {
          ev = new CustomEvent('tepikata:config', { detail: cfg });
        } else {
          ev = document.createEvent('CustomEvent');
          ev.initCustomEvent('tepikata:config', false, false, cfg);
        }
        global.dispatchEvent(ev);
      } catch (e) { /* ignore */ }
    }

    return cfg;
  }

  function isPreviewMode() {
    try {
      return new URLSearchParams(global.location.search).get('preview') === '1';
    } catch (e) {
      return /[?&]preview=1(?:&|$)/.test(global.location.search || '');
    }
  }

  function readPreviewConfig() {
    try {
      var raw = localStorage.getItem(PREVIEW_KEY);
      if (!raw) return null;
      return mergeConfig(JSON.parse(raw));
    } catch (e) {
      return null;
    }
  }

  function savePreviewConfig(cfg) {
    try {
      localStorage.setItem(PREVIEW_KEY, JSON.stringify(mergeConfig(cfg)));
      return true;
    } catch (e) {
      return false;
    }
  }

  function clearPreviewConfig() {
    try { localStorage.removeItem(PREVIEW_KEY); } catch (e) { /* ignore */ }
  }

  function loadConfig(opts) {
    opts = opts || {};
    var url = opts.url || 'config.json';

    if (opts.allowPreview !== false && isPreviewMode()) {
      var pv = readPreviewConfig();
      if (pv) {
        applyTheme(pv, opts);
        return Promise.resolve(pv);
      }
    }

    if (global.location && global.location.protocol === 'file:') {
      var fallback = mergeConfig(DEFAULT_CONFIG);
      applyTheme(fallback, opts);
      return Promise.resolve(fallback);
    }

    var sep = url.indexOf('?') >= 0 ? '&' : '?';
    return fetch(url + sep + 'v=' + Date.now(), { cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (json) {
        var merged = mergeConfig(json);
        applyTheme(merged, opts);
        return merged;
      })
      .catch(function () {
        var fb = mergeConfig(DEFAULT_CONFIG);
        applyTheme(fb, opts);
        return fb;
      });
  }

  function getAppsScriptSnippet() {
    return [
      '<!-- Tempel sebelum </body> di Studio.html (Google Apps Script) agar tab Data Klien ikut tema config.json -->',
      '<script>',
      '(function(){',
      '  fetch("https://tepikata.github.io/studio/config.json?v="+Date.now(),{cache:"no-store"})',
      '    .then(function(r){return r.ok?r.json():null;})',
      '    .then(function(cfg){',
      '      if(!cfg||!cfg.theme||!cfg.theme.colors)return;',
      '      var c=cfg.theme.colors,s=cfg.theme.cornerStyle==="sharp",r=document.documentElement;',
      '      r.style.setProperty("--bg",c.bg);',
      '      r.style.setProperty("--card",c.surface);',
      '      r.style.setProperty("--ink",c.ink);',
      '      r.style.setProperty("--muted",c.muted);',
      '      r.style.setProperty("--line",c.line);',
      '      r.style.setProperty("--aksen",c.accent);',
      '      r.style.setProperty("--plum-tua",c.headerBg);',
      '      r.style.setProperty("--plum",c.headerSurface||c.headerBg);',
      '      r.style.setProperty("--emas-muda",c.accentLight);',
      '      var css="";',
      '      if(s) css+=".card,.item,.box,.btn,input,select{border-radius:0!important}";',
      '      if(cfg.collage&&cfg.collage.source==="none") css+=".dk-latar,.dk-arsip{display:none!important}";',
      '      if(cfg.collage&&cfg.collage.filter==="mono") css+=".dk-latar img,.dk-arsip img{filter:grayscale(1) contrast(1.06)!important}";',
      '      if(cfg.collage&&cfg.collage.filter==="natural") css+=".dk-latar img,.dk-arsip img{filter:saturate(.95) contrast(1.02)!important}";',
      '      if(css){var st=document.createElement("style");st.textContent=css;document.head.appendChild(st);}',
      '    }).catch(function(){});',
      '})();',
      '</script>'
    ].join('\n');
  }

  global.TepiKataTheme = {
    PREVIEW_KEY: PREVIEW_KEY,
    DRAFT_KEY: DRAFT_KEY,
    PRESETS: PRESETS,
    FONT_PAIRS: FONT_PAIRS,
    DEFAULT_CONFIG: DEFAULT_CONFIG,
    clone: clone,
    validHex: validHex,
    hexToRgb: hexToRgb,
    isLightHex: isLightHex,
    mergeConfig: mergeConfig,
    applyPresetToConfig: applyPresetToConfig,
    applyTheme: applyTheme,
    loadConfig: loadConfig,
    isPreviewMode: isPreviewMode,
    readPreviewConfig: readPreviewConfig,
    savePreviewConfig: savePreviewConfig,
    clearPreviewConfig: clearPreviewConfig,
    setPreviewPhotos: setPreviewPhotos,
    resolvePhotoUrl: resolvePhotoUrl,
    getAppsScriptSnippet: getAppsScriptSnippet
  };
})(window);
