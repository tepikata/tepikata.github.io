/* Tepi Kata Studio — Antarmuka Pengaturan (Drawer Cepat & Editor Lengkap)
 * Mendukung live preview, 3 tema preset + color picker, kolase foto + kompresi & upload ke GitHub,
 * pengaturan default Album & Layar Klien, Simpan & Publish via GitHub REST API, serta Unduh/Impor JSON.
 */
(function (global) {
  'use strict';

  var T = global.TepiKataTheme;
  if (!T) return;

  var GH_TOKEN_KEY = 'tepikata_studio_gh_token';
  var GH_OWNER_KEY = 'tepikata_studio_gh_owner';
  var GH_REPO_KEY = 'tepikata_studio_gh_repo';
  var GH_BRANCH_KEY = 'tepikata_studio_gh_branch';

  var ALBUM_SIZES = [
    ['25×30 cm (potret)', 25, 30],
    ['30×25 cm (lanskap)', 30, 25],
    ['30×30 cm', 30, 30],
    ['25×25 cm', 25, 25],
    ['20×20 cm', 20, 20],
    ['30×20 cm (lanskap)', 30, 20],
    ['40×30 cm', 40, 30],
    ['60×30 cm (bentang)', 60, 30]
  ];

  var state = T.mergeConfig(global.TepiKataConfig || T.DEFAULT_CONFIG);
  var liveSnapshot = JSON.stringify(state);
  var pendingUploads = {}; // { "images/latar-....jpg": { base64, dataUrl, sizeKB, name } }
  var activeTab = 'tema';
  var activePreviewMode = 'studio';
  var mountMode = 'drawer'; // 'drawer' | 'full'
  var hostEl = null;
  var drawerRoot = null;
  var isOpen = false;
  var isPublishing = false;
  var toastTimer = null;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function isDirty() {
    return JSON.stringify(state) !== liveSnapshot || referencedPendingPaths().length > 0;
  }

  function getGhCfg() {
    try {
      return {
        token: (localStorage.getItem(GH_TOKEN_KEY) || '').trim(),
        owner: (localStorage.getItem(GH_OWNER_KEY) || 'tepikata').trim() || 'tepikata',
        repo: (localStorage.getItem(GH_REPO_KEY) || 'tepikata.github.io').trim() || 'tepikata.github.io',
        branch: (localStorage.getItem(GH_BRANCH_KEY) || 'main').trim() || 'main'
      };
    } catch (e) {
      return { token: '', owner: 'tepikata', repo: 'tepikata.github.io', branch: 'main' };
    }
  }

  function saveGhCfg(cfg) {
    try {
      if (cfg.token != null) {
        if (cfg.token.trim()) localStorage.setItem(GH_TOKEN_KEY, cfg.token.trim());
        else localStorage.removeItem(GH_TOKEN_KEY);
      }
      if (cfg.owner != null) localStorage.setItem(GH_OWNER_KEY, cfg.owner.trim() || 'tepikata');
      if (cfg.repo != null) localStorage.setItem(GH_REPO_KEY, cfg.repo.trim() || 'tepikata.github.io');
      if (cfg.branch != null) localStorage.setItem(GH_BRANCH_KEY, cfg.branch.trim() || 'main');
    } catch (e) { /* ignore */ }
  }

  function saveDraft() {
    try {
      localStorage.setItem(T.DRAFT_KEY, JSON.stringify({ updatedAt: Date.now(), config: state }));
    } catch (e) { /* ignore */ }
  }

  function clearDraft() {
    try { localStorage.removeItem(T.DRAFT_KEY); } catch (e) { /* ignore */ }
  }

  function loadDraftIfAny() {
    try {
      var raw = localStorage.getItem(T.DRAFT_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (parsed && parsed.config) return T.mergeConfig(parsed.config);
    } catch (e) { /* ignore */ }
    return null;
  }

  function syncPreviewPhotoMap() {
    var map = {};
    Object.keys(pendingUploads).forEach(function (k) {
      map[k] = pendingUploads[k].dataUrl;
    });
    T.setPreviewPhotos(map);
  }

  function referencedPendingPaths() {
    var photos = (state.collage && state.collage.photos) || [];
    return photos.filter(function (p) { return !!pendingUploads[p]; });
  }

  function showToast(msg) {
    var el = document.getElementById('tkSetToast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'tkSetToast';
      el.className = 'tk-set-toast';
      el.setAttribute('role', 'status');
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2800);
  }

  function applyLive(skipSaveDraft) {
    syncPreviewPhotoMap();
    state = T.mergeConfig(state);
    if (mountMode === 'drawer') {
      T.applyTheme(state);
    } else {
      global.TepiKataConfig = state;
      renderFullPreview();
    }
    if (!skipSaveDraft) saveDraft();
    updateDirtyBadge();
  }

  function updateDirtyBadge() {
    var dirty = isDirty();
    var els = document.querySelectorAll('[data-tk-dirty]');
    Array.prototype.forEach.call(els, function (el) {
      el.textContent = dirty ? 'Belum dipublish' : 'Sinkron dengan live';
      el.classList.toggle('is-dirty', dirty);
    });
    var dots = document.querySelectorAll('[data-tk-gh-dot]');
    var hasTok = !!getGhCfg().token;
    Array.prototype.forEach.call(dots, function (d) {
      d.classList.toggle('on', hasTok);
    });
  }

  /* ---------- Kompresi Gambar di Browser (maks lebar 1600px, JPEG 80%) ---------- */
  function compressImage(file) {
    return new Promise(function (resolve, reject) {
      if (!file || !/^image\//i.test(file.type || '')) {
        return reject(new Error('File bukan gambar yang didukung.'));
      }
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error('Gagal membaca file gambar.')); };
      reader.onload = function () {
        var img = new Image();
        img.onerror = function () { reject(new Error('Gambar tidak bisa diproses di browser.')); };
        img.onload = function () {
          var maxW = 1600;
          var w = img.naturalWidth || img.width;
          var h = img.naturalHeight || img.height;
          if (!w || !h) return reject(new Error('Dimensi gambar tidak valid.'));
          if (w > maxW) {
            h = Math.round(h * (maxW / w));
            w = maxW;
          }
          var canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          var ctx = canvas.getContext('2d');
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, w, h);
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, w, h);
          var dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          var base64 = dataUrl.split(',')[1] || '';
          var sizeKB = Math.max(1, Math.round((base64.length * 3) / 4 / 1024));
          resolve({ dataUrl: dataUrl, base64: base64, sizeKB: sizeKB, w: w, h: h });
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function sanitizeFilename(name, idx) {
    var base = String(name || 'foto')
      .replace(/\.[^.]+$/, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 28) || 'foto';
    var stamp = Date.now().toString(36) + (idx ? '-' + idx : '');
    return 'images/' + base + '-' + stamp + '.jpg';
  }

  /* ---------- GitHub REST API (PUT /repos/{owner}/{repo}/contents/...) ---------- */
  function utf8ToBase64(str) {
    var bytes = new TextEncoder().encode(str);
    var bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  function ghHeaders(token, withJson) {
    var h = {
      'Authorization': 'Bearer ' + token,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    };
    if (withJson) h['Content-Type'] = 'application/json';
    return h;
  }

  function ghTestConnection(cfg) {
    if (!cfg.token) return Promise.reject(new Error('Masukkan GitHub Personal Access Token terlebih dahulu.'));
    var url = 'https://api.github.com/repos/' + encodeURIComponent(cfg.owner) + '/' + encodeURIComponent(cfg.repo);
    return fetch(url, { headers: ghHeaders(cfg.token, false), cache: 'no-store' })
      .then(function (res) {
        return res.json().then(function (body) {
          if (!res.ok) {
            throw new Error('HTTP ' + res.status + ': ' + (body.message || 'Token tidak valid atau repo tidak ditemukan.'));
          }
          var canPush = !!(body.permissions && body.permissions.push);
          return {
            fullName: body.full_name,
            defaultBranch: body.default_branch,
            canPush: canPush
          };
        });
      });
  }

  function ghGetSha(cfg, repoPath) {
    var url = 'https://api.github.com/repos/' + encodeURIComponent(cfg.owner) + '/' + encodeURIComponent(cfg.repo) +
      '/contents/' + repoPath.split('/').map(encodeURIComponent).join('/') + '?ref=' + encodeURIComponent(cfg.branch);
    return fetch(url, { headers: ghHeaders(cfg.token, false), cache: 'no-store' })
      .then(function (res) {
        if (res.status === 404) return null;
        return res.json().then(function (b) { return res.ok ? b.sha : null; });
      })
      .catch(function () { return null; });
  }

  function ghPutFile(cfg, repoPath, base64Content, message) {
    return ghGetSha(cfg, repoPath).then(function (sha) {
      var url = 'https://api.github.com/repos/' + encodeURIComponent(cfg.owner) + '/' + encodeURIComponent(cfg.repo) +
        '/contents/' + repoPath.split('/').map(encodeURIComponent).join('/');
      var payload = {
        message: message,
        content: base64Content,
        branch: cfg.branch
      };
      if (sha) payload.sha = sha;
      return fetch(url, {
        method: 'PUT',
        headers: ghHeaders(cfg.token, true),
        body: JSON.stringify(payload)
      }).then(function (res) {
        return res.json().then(function (body) {
          if (!res.ok) {
            throw new Error('Gagal menyimpan ' + repoPath + ' (HTTP ' + res.status + '): ' + (body.message || 'Periksa izin Contents: Read and write.'));
          }
          return body;
        });
      });
    });
  }

  /* ---------- Scoped Styles ---------- */
  function injectStyles() {
    if (document.getElementById('tkSetStyles')) return;
    var s = document.createElement('style');
    s.id = 'tkSetStyles';
    s.textContent = [
      '.tk-set-ov{position:fixed;inset:0;z-index:80;background:rgba(18,18,18,.48);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);display:flex;justify-content:flex-end;align-items:stretch;opacity:0;pointer-events:none;transition:opacity .22s ease}',
      '.tk-set-ov.open{opacity:1;pointer-events:auto}',
      '.tk-set-panel{width:min(490px,100vw);height:100%;background:#F8F8F8;color:#121212;display:flex;flex-direction:column;font:14px/1.5 "Inter",system-ui,sans-serif;box-shadow:-16px 0 44px rgba(0,0,0,.22);transform:translateX(24px);transition:transform .24s ease}',
      '.tk-set-ov.open .tk-set-panel{transform:translateX(0)}',
      '@media (max-width:640px){.tk-set-ov{align-items:flex-end}.tk-set-panel{width:100vw;height:92vh;transform:translateY(28px);box-shadow:0 -12px 36px rgba(0,0,0,.24)}}',
      '.tk-set-panel *,.tk-set-root *{box-sizing:border-box}',
      '.tk-set-panel button,.tk-set-root button,.tk-set-panel input,.tk-set-root input,.tk-set-panel select,.tk-set-root select,.tk-set-panel textarea,.tk-set-root textarea{font-family:"Inter",system-ui,sans-serif}',
      '.tk-set-hd{background:#FFFFFF;border-bottom:1px solid rgba(18,18,18,.1);padding:14px 18px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex:0 0 auto}',
      '.tk-set-hd-title{display:flex;flex-direction:column;gap:2px;min-width:0}',
      '.tk-set-hd-eyebrow{font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:#96764A;font-weight:600}',
      '.tk-set-hd-title h2{margin:0;font:500 22px/1.1 "Cormorant Garamond","Bodoni Moda",Georgia,serif;color:#121212;letter-spacing:.01em}',
      '.tk-set-hd-acts{display:flex;align-items:center;gap:8px;flex:0 0 auto}',
      '.tk-set-link{display:inline-flex;align-items:center;gap:5px;padding:7px 10px;border:1px solid rgba(18,18,18,.15);background:#FFFFFF;color:#121212;text-decoration:none;font-size:11px;font-weight:500;letter-spacing:.1em;text-transform:uppercase;cursor:pointer}',
      '.tk-set-link:hover{border-color:#96764A;color:#96764A}',
      '.tk-set-close{width:36px;height:36px;border:1px solid rgba(18,18,18,.14);background:#FFFFFF;color:#121212;font-size:18px;cursor:pointer;display:grid;place-items:center}',
      '.tk-set-close:hover{border-color:#121212}',
      '.tk-set-tabs{display:flex;background:#FFFFFF;border-bottom:1px solid rgba(18,18,18,.1);padding:0 14px;gap:4px;overflow-x:auto;scrollbar-width:none;flex:0 0 auto}',
      '.tk-set-tabs::-webkit-scrollbar{display:none}',
      '.tk-set-tab{position:relative;flex:0 0 auto;border:0;background:transparent;padding:12px 10px;font-size:11px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:#686868;cursor:pointer;white-space:nowrap}',
      '.tk-set-tab.on{color:#121212}',
      '.tk-set-tab.on::after{content:"";position:absolute;left:10px;right:10px;bottom:0;height:2px;background:#96764A}',
      '.tk-set-body{flex:1 1 auto;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:16px 18px 28px}',
      '.tk-set-foot{flex:0 0 auto;background:#FFFFFF;border-top:1px solid rgba(18,18,18,.1);padding:12px 18px calc(12px + env(safe-area-inset-bottom,0px));display:flex;align-items:center;justify-content:space-between;gap:10px}',
      '.tk-set-status{font-size:11px;color:#686868;display:flex;align-items:center;gap:6px}',
      '.tk-set-status.is-dirty{color:#96764A;font-weight:600}',
      '.tk-set-ghdot{width:8px;height:8px;border-radius:50%;background:#C4BEB7;display:inline-block;flex:0 0 auto}',
      '.tk-set-ghdot.on{background:#2F7D4F}',
      '.tk-set-card{background:#FFFFFF;border:1px solid rgba(18,18,18,.1);padding:16px;margin-bottom:14px}',
      '.tk-set-card h3{margin:0 0 12px;font-size:10.5px;letter-spacing:.2em;text-transform:uppercase;color:#686868;font-weight:600}',
      '.tk-set-lbl{display:block;font-size:10.5px;letter-spacing:.16em;text-transform:uppercase;color:#686868;font-weight:600;margin:12px 0 6px}',
      '.tk-set-lbl:first-child{margin-top:0}',
      '.tk-set-inp,.tk-set-sel,.tk-set-ta{width:100%;border:1px solid rgba(18,18,18,.16);background:#FFFFFF;color:#121212;padding:10px 12px;font-size:13.5px;border-radius:0;outline:none;transition:border-color .18s}',
      '.tk-set-inp:focus,.tk-set-sel:focus,.tk-set-ta:focus{border-color:#96764A;box-shadow:0 0 0 1px #96764A}',
      '.tk-set-ta{min-height:92px;resize:vertical;line-height:1.5}',
      '.tk-set-help{margin:6px 0 0;font-size:12px;color:#686868;line-height:1.45}',
      '.tk-set-grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px}',
      '@media (max-width:420px){.tk-set-grid2{grid-template-columns:1fr}}',
      '.tk-set-presets{display:grid;gap:10px}',
      '.tk-set-preset{width:100%;text-align:left;border:1px solid rgba(18,18,18,.12);background:#FFFFFF;padding:12px;cursor:pointer;display:flex;gap:12px;align-items:center;transition:border-color .18s,box-shadow .18s}',
      '.tk-set-preset:hover{border-color:#96764A}',
      '.tk-set-preset.on{border-color:#121212;box-shadow:0 0 0 1px #121212}',
      '.tk-set-swatch{width:54px;height:44px;flex:0 0 54px;border:1px solid rgba(18,18,18,.12);display:flex;flex-direction:column;overflow:hidden}',
      '.tk-set-swatch-top{height:52%;display:flex;align-items:center;justify-content:center;font-size:9px;letter-spacing:.12em;font-weight:600}',
      '.tk-set-swatch-bot{height:48%;display:flex;align-items:center;justify-content:center;gap:4px}',
      '.tk-set-swatch-dot{width:8px;height:8px;border-radius:50%}',
      '.tk-set-preset-info{flex:1;min-width:0}',
      '.tk-set-preset-name{font-size:13.5px;font-weight:600;color:#121212;display:flex;align-items:center;gap:6px}',
      '.tk-set-preset-tag{font-size:11.5px;color:#686868;line-height:1.35;margin-top:2px}',
      '.tk-set-seg{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}',
      '.tk-set-seg3{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}',
      '@media (max-width:420px){.tk-set-seg3{grid-template-columns:1fr}}',
      '.tk-set-opt{border:1px solid rgba(18,18,18,.14);background:#FFFFFF;color:#121212;padding:10px 10px;font-size:12.5px;font-weight:500;cursor:pointer;text-align:center;transition:all .16s}',
      '.tk-set-opt:hover{border-color:#96764A}',
      '.tk-set-opt.on{background:#121212;border-color:#121212;color:#FFFFFF}',
      '.tk-set-colors{display:grid;grid-template-columns:1fr 1fr;gap:10px}',
      '.tk-set-cfield{display:flex;align-items:center;gap:8px;border:1px solid rgba(18,18,18,.14);background:#FFFFFF;padding:6px 8px}',
      '.tk-set-cfield input[type="color"]{width:28px;height:28px;padding:0;border:0;background:transparent;cursor:pointer;flex:0 0 28px}',
      '.tk-set-cfield input[type="text"]{border:0;outline:none;width:100%;font-size:12px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:#121212;text-transform:uppercase;background:transparent}',
      '.tk-set-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:10px 14px;border:1px solid rgba(18,18,18,.18);background:#FFFFFF;color:#121212;font-size:11.5px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;cursor:pointer;transition:all .16s}',
      '.tk-set-btn:hover{border-color:#121212}',
      '.tk-set-btn.primary{background:#121212;border-color:#121212;color:#FFFFFF}',
      '.tk-set-btn.primary:hover{background:#96764A;border-color:#96764A}',
      '.tk-set-btn.accent{background:#96764A;border-color:#96764A;color:#FFFFFF}',
      '.tk-set-btn.danger{color:#B3352A;border-color:rgba(179,53,42,.3)}',
      '.tk-set-btn:disabled{opacity:.5;cursor:not-allowed}',
      '.tk-set-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}',
      '.tk-set-grow{flex:1 1 auto}',
      '.tk-set-check{display:flex;align-items:center;gap:8px;font-size:13px;color:#121212;cursor:pointer;margin:8px 0}',
      '.tk-set-check input{width:16px;height:16px;accent-color:#96764A}',
      '.tk-set-upload{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;border:1.5px dashed rgba(150,118,74,.55);background:#FCFBF9;padding:18px 14px;text-align:center;cursor:pointer;margin:10px 0}',
      '.tk-set-upload:hover{background:#F7F3EC;border-color:#96764A}',
      '.tk-set-upload strong{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#121212}',
      '.tk-set-upload span{font-size:12px;color:#686868}',
      '.tk-set-photos{display:grid;gap:8px;margin-top:10px}',
      '.tk-set-photo{display:flex;align-items:center;gap:10px;border:1px solid rgba(18,18,18,.1);background:#FFFFFF;padding:8px}',
      '.tk-set-photo img{width:54px;height:42px;object-fit:cover;background:#EAE6E0;flex:0 0 54px}',
      '.tk-set-photo-meta{flex:1;min-width:0}',
      '.tk-set-photo-name{font-size:12.5px;font-weight:500;color:#121212;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.tk-set-photo-sub{font-size:11px;color:#686868}',
      '.tk-set-photo-sub.new{color:#96764A;font-weight:600}',
      '.tk-set-pacts{display:flex;gap:4px;flex:0 0 auto}',
      '.tk-set-pbtn{width:30px;height:30px;border:1px solid rgba(18,18,18,.14);background:#FFFFFF;color:#121212;cursor:pointer;display:grid;place-items:center;font-size:13px}',
      '.tk-set-pbtn:disabled{opacity:.35;cursor:default}',
      '.tk-set-pbtn.del{color:#B3352A}',
      '.tk-set-log{margin-top:10px;background:#121212;color:#F2EFEA;padding:12px;font:12px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace;max-height:190px;overflow-y:auto;white-space:pre-wrap}',
      '.tk-set-log .err{color:#F59E96}',
      '.tk-set-log .ok{color:#8ED1A4}',
      '.tk-set-msg{margin-top:8px;padding:9px 11px;font-size:12.5px;border:1px solid rgba(18,18,18,.12);background:#F8F8F8}',
      '.tk-set-msg.ok{background:#EEF7F1;border-color:#B9DFC6;color:#1F5E36}',
      '.tk-set-msg.err{background:#FDF1F0;border-color:#F0C2BD;color:#99281F}',
      '.tk-set-code{width:100%;min-height:130px;font:11.5px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;background:#161616;color:#EFECE6;border:0;padding:10px;resize:vertical}',
      '.tk-set-details{border:1px solid rgba(18,18,18,.1);background:#FFFFFF;padding:12px 14px;margin-bottom:14px}',
      '.tk-set-details summary{cursor:pointer;font-size:11px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:#121212}',
      '.tk-set-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:120;background:#121212;color:#FFFFFF;padding:10px 18px;font:500 13px/1.4 "Inter",system-ui,sans-serif;opacity:0;pointer-events:none;transition:opacity .2s;max-width:calc(100vw - 32px);text-align:center;box-shadow:0 10px 28px rgba(0,0,0,.25)}',
      '.tk-set-toast.show{opacity:1}',
      /* Full Page Live Preview Mockup */
      '.tk-pv-wrap{border:1px solid rgba(18,18,18,.12);background:#FFFFFF;overflow:hidden}',
      '.tk-pv-tabs{display:flex;border-bottom:1px solid rgba(18,18,18,.1);background:#F8F8F8}',
      '.tk-pv-tabs button{flex:1;border:0;background:transparent;padding:10px 8px;font-size:10.5px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:#686868;cursor:pointer}',
      '.tk-pv-tabs button.on{background:#FFFFFF;color:#121212;box-shadow:inset 0 -2px 0 #96764A}',
      '.tk-pv-stage{min-height:390px;position:relative;overflow:hidden;transition:all .2s ease}'
    ].join('\n');
    document.head.appendChild(s);
  }

  /* ---------- Render Bagian Konten Tab ---------- */
  function renderTemaTab() {
    var curPreset = state.theme.preset;
    var c = state.theme.colors;
    var corners = state.theme.cornerStyle;
    var curFontId = '';
    T.FONT_PAIRS.forEach(function (fp) {
      if (fp.display === state.theme.fonts.display && fp.body === state.theme.fonts.body) curFontId = fp.id;
    });

    var presetOrder = ['fine-art-white', 'editorial-obsidian', 'classic-plum'];
    var presetsHtml = presetOrder.map(function (id) {
      var p = T.PRESETS[id];
      var pc = p.colors;
      var active = curPreset === id;
      return '<button type="button" class="tk-set-preset' + (active ? ' on' : '') + '" data-preset="' + id + '">' +
        '<span class="tk-set-swatch">' +
        '<span class="tk-set-swatch-top" style="background:' + pc.headerBg + ';color:' + pc.headerInk + '">Aa</span>' +
        '<span class="tk-set-swatch-bot" style="background:' + pc.bg + '">' +
        '<span class="tk-set-swatch-dot" style="background:' + pc.surface + ';border:1px solid ' + pc.line + '"></span>' +
        '<span class="tk-set-swatch-dot" style="background:' + pc.accent + '"></span>' +
        '<span class="tk-set-swatch-dot" style="background:' + pc.ink + '"></span>' +
        '</span></span>' +
        '<span class="tk-set-preset-info">' +
        '<span class="tk-set-preset-name">' + esc(p.name) + (active ? ' ✓' : '') + '</span>' +
        '<span class="tk-set-preset-tag">' + esc(p.tagline) + '</span>' +
        '</span></button>';
    }).join('');

    var colorFields = [
      ['headerBg', 'Header / Hero'],
      ['bg', 'Latar Halaman'],
      ['surface', 'Permukaan Kartu'],
      ['ink', 'Tinta Utama'],
      ['muted', 'Teks Sekunder'],
      ['accent', 'Aksen Utama'],
      ['accentLight', 'Aksen Muda'],
      ['line', 'Garis Pembatas']
    ];

    var colorsHtml = colorFields.map(function (f) {
      var val = c[f[0]] || '#121212';
      return '<div><label class="tk-set-lbl" style="margin-top:0">' + f[1] + '</label>' +
        '<div class="tk-set-cfield">' +
        '<input type="color" data-color="' + f[0] + '" value="' + esc(val) + '" aria-label="' + f[1] + '">' +
        '<input type="text" data-color-hex="' + f[0] + '" value="' + esc(val) + '" maxlength="7" aria-label="Hex ' + f[1] + '">' +
        '</div></div>';
    }).join('');

    return '<div class="tk-set-card"><h3>1 · Tema Preset (1-Klik)</h3><div class="tk-set-presets">' + presetsHtml + '</div></div>' +
      '<div class="tk-set-card"><h3>2 · Bentuk Sudut &amp; Tipografi</h3>' +
      '<label class="tk-set-lbl">Bentuk Sudut Kartu &amp; Tombol</label>' +
      '<div class="tk-set-seg">' +
      '<button type="button" class="tk-set-opt' + (corners === 'sharp' ? ' on' : '') + '" data-corner="sharp">Tajam Arsitektural</button>' +
      '<button type="button" class="tk-set-opt' + (corners === 'rounded' ? ' on' : '') + '" data-corner="rounded">Halus Melengkung</button>' +
      '</div>' +
      '<label class="tk-set-lbl" for="tkFontPair">Pasangan Font Editorial</label>' +
      '<select class="tk-set-sel" id="tkFontPair">' +
      T.FONT_PAIRS.map(function (fp) {
        return '<option value="' + fp.id + '"' + (fp.id === curFontId ? ' selected' : '') + '>' + esc(fp.label) + '</option>';
      }).join('') +
      '</select></div>' +
      '<details class="tk-set-details"' + (curPreset === 'custom' ? ' open' : '') + '>' +
      '<summary>3 · Kustomisasi Warna Manual (Color Picker)</summary>' +
      '<p class="tk-set-help" style="margin-bottom:12px">Ubah warna tertentu sesuai selera. Kontras teks header &amp; logo menyesuaikan otomatis.</p>' +
      '<div class="tk-set-colors">' + colorsHtml + '</div></details>';
  }

  function renderFotoTab() {
    var col = state.collage;
    var photos = col.photos || [];
    var photoRows = photos.length ? photos.map(function (p, i) {
      var pend = pendingUploads[p];
      var src = T.resolvePhotoUrl(p, '');
      var fname = p.split('/').pop();
      return '<div class="tk-set-photo">' +
        '<img src="' + esc(src) + '" alt="">' +
        '<div class="tk-set-photo-meta">' +
        '<div class="tk-set-photo-name">' + esc(fname) + '</div>' +
        '<div class="tk-set-photo-sub' + (pend ? ' new' : '') + '">' + (pend ? ('Siap diunggah · ' + pend.sizeKB + ' KB') : esc(p)) + '</div>' +
        '</div>' +
        '<div class="tk-set-pacts">' +
        '<button type="button" class="tk-set-pbtn" data-pmove="up" data-pi="' + i + '" aria-label="Pindah naik"' + (i === 0 ? ' disabled' : '') + '>↑</button>' +
        '<button type="button" class="tk-set-pbtn" data-pmove="down" data-pi="' + i + '" aria-label="Pindah turun"' + (i === photos.length - 1 ? ' disabled' : '') + '>↓</button>' +
        '<button type="button" class="tk-set-pbtn del" data-pdel="' + i + '" aria-label="Hapus foto">✕</button>' +
        '</div></div>';
    }).join('') : '<p class="tk-set-help">Belum ada foto pilihan sendiri. Upload beberapa foto pernikahan terbaik dari HP/laptop — otomatis dikompresi maks lebar 1600px (JPEG 80%) ke folder <code>studio/images/</code>.</p>';

    return '<div class="tk-set-card"><h3>1 · Sumber Foto Kolase Latar</h3>' +
      '<div class="tk-set-seg3">' +
      '<button type="button" class="tk-set-opt' + (col.source === 'custom' ? ' on' : '') + '" data-csource="custom">Foto Pilihan Sendiri</button>' +
      '<button type="button" class="tk-set-opt' + (col.source === 'drive' ? ' on' : '') + '" data-csource="drive">Otomatis Google Drive</button>' +
      '<button type="button" class="tk-set-opt' + (col.source === 'none' ? ' on' : '') + '" data-csource="none">Polos Tanpa Kolase</button>' +
      '</div>' +
      '<label class="tk-set-lbl">Filter Warna Foto Kolase</label>' +
      '<div class="tk-set-seg3">' +
      '<button type="button" class="tk-set-opt' + (col.filter === 'natural' ? ' on' : '') + '" data-cfilter="natural">Editorial Natural</button>' +
      '<button type="button" class="tk-set-opt' + (col.filter === 'mono' ? ' on' : '') + '" data-cfilter="mono">Monokrom B&amp;W</button>' +
      '<button type="button" class="tk-set-opt' + (col.filter === 'sepia' ? ' on' : '') + '" data-cfilter="sepia">Sepia Hangat</button>' +
      '</div>' +
      '<div style="margin-top:12px">' +
      '<label class="tk-set-check"><input type="checkbox" id="tkShowHero"' + (col.showHero !== false ? ' checked' : '') + '> Tampilkan kolase di header hero (<code>.dk-arsip</code>)</label>' +
      '<label class="tk-set-check"><input type="checkbox" id="tkShowBg"' + (col.showBackground !== false ? ' checked' : '') + '> Tampilkan kolase di latar daftar (<code>.dk-latar</code>)</label>' +
      '</div></div>' +
      '<div class="tk-set-card"><h3>2 · Foto Kolase Pilihan Sendiri (' + photos.length + ')</h3>' +
      '<label class="tk-set-upload" for="tkPhotoUpload">' +
      '<strong>＋ Upload Foto dari HP / Laptop</strong>' +
      '<span>Bisa pilih banyak foto sekaligus · otomatis dikompresi maks 1600px (JPEG 80%)</span>' +
      '<input type="file" id="tkPhotoUpload" accept="image/*" multiple style="display:none">' +
      '</label>' +
      '<div class="tk-set-photos">' + photoRows + '</div></div>';
  }

  function renderAlbumKlienTab() {
    var al = state.album;
    var cl = state.client;
    var matchedIdx = -1;
    ALBUM_SIZES.forEach(function (x, i) {
      if (x[1] === al.defaultWidth && x[2] === al.defaultHeight) matchedIdx = i;
    });
    var bgPresets = [['#ffffff', 'Putih (#FFFFFF)'], ['#f4efe8', 'Krem (#F4EFE8)'], ['#1f1c19', 'Hitam (#1F1C19)']];
    var bgMatch = bgPresets.some(function (b) { return b[0].toLowerCase() === (al.defaultPageBg || '').toLowerCase(); });

    return '<div class="tk-set-card"><h3>1 · Pengaturan Bawaan Draf Album (album.js)</h3>' +
      '<p class="tk-set-help" style="margin-top:0;margin-bottom:10px">Dipakai otomatis saat menyusun draf album baru di Studio &amp; draf awal klien. Tema Draf Album juga otomatis mengikuti warna &amp; sudut pada tab Tema.</p>' +
      '<label class="tk-set-lbl" for="tkAlbPreset">Preset Ukuran Album</label>' +
      '<select class="tk-set-sel" id="tkAlbPreset">' +
      ALBUM_SIZES.map(function (x, i) {
        return '<option value="' + i + '"' + (i === matchedIdx ? ' selected' : '') + '>' + esc(x[0]) + '</option>';
      }).join('') +
      '<option value="custom"' + (matchedIdx < 0 ? ' selected' : '') + '>Kustom (' + al.defaultWidth + '×' + al.defaultHeight + ' cm)</option>' +
      '</select>' +
      '<div class="tk-set-grid2" style="margin-top:10px">' +
      '<div><label class="tk-set-lbl" for="tkAlbW">Lebar (cm)</label><input class="tk-set-inp" id="tkAlbW" type="number" step="1" min="10" max="80" value="' + esc(al.defaultWidth) + '"></div>' +
      '<div><label class="tk-set-lbl" for="tkAlbH">Tinggi (cm)</label><input class="tk-set-inp" id="tkAlbH" type="number" step="1" min="10" max="80" value="' + esc(al.defaultHeight) + '"></div>' +
      '<div><label class="tk-set-lbl" for="tkAlbMargin">Margin Tepi (cm)</label><input class="tk-set-inp" id="tkAlbMargin" type="number" step="0.1" min="0" max="5" value="' + esc(al.defaultMargin) + '"></div>' +
      '<div><label class="tk-set-lbl" for="tkAlbGap">Jarak Antar Foto (cm)</label><input class="tk-set-inp" id="tkAlbGap" type="number" step="0.1" min="0" max="3" value="' + esc(al.defaultGap) + '"></div>' +
      '</div>' +
      '<label class="tk-set-lbl" for="tkAlbBg">Warna Latar Halaman Album</label>' +
      '<div class="tk-set-row">' +
      '<select class="tk-set-sel tk-set-grow" id="tkAlbBg">' +
      bgPresets.map(function (b) {
        return '<option value="' + b[0] + '"' + (b[0].toLowerCase() === (al.defaultPageBg || '').toLowerCase() ? ' selected' : '') + '>' + esc(b[1]) + '</option>';
      }).join('') +
      (!bgMatch ? '<option value="' + esc(al.defaultPageBg) + '" selected>Kustom (' + esc(al.defaultPageBg) + ')</option>' : '') +
      '</select>' +
      '<input type="color" id="tkAlbBgPick" value="' + esc(al.defaultPageBg || '#ffffff') + '" style="width:42px;height:40px;border:1px solid rgba(18,18,18,.16);padding:2px;background:#fff;cursor:pointer" aria-label="Pilih warna latar album">' +
      '</div></div>' +
      '<div class="tk-set-card"><h3>2 · Layar Tunggu Galeri Klien (index.html &amp; 404.html)</h3>' +
      '<div class="tk-set-grid2">' +
      '<div><label class="tk-set-lbl" for="tkClBrand">Teks Merek (pojok kiri atas)</label><input class="tk-set-inp" id="tkClBrand" value="' + esc(cl.brand) + '"></div>' +
      '<div><label class="tk-set-lbl" for="tkClGreet">Teks Sapaan Klien</label><input class="tk-set-inp" id="tkClGreet" value="' + esc(cl.greeting) + '"></div>' +
      '</div>' +
      '<label class="tk-set-lbl" for="tkClEmptyTitle">Judul Halaman Utama (tanpa link klien)</label>' +
      '<input class="tk-set-inp" id="tkClEmptyTitle" value="' + esc(cl.emptyTitle) + '">' +
      '<label class="tk-set-lbl" for="tkClEmptyNote">Keterangan Halaman Utama</label>' +
      '<input class="tk-set-inp" id="tkClEmptyNote" value="' + esc(cl.emptyNote) + '">' +
      '<label class="tk-set-lbl" for="tkClMsgs">Pesan Tunggu Bergantian (1 baris = 1 pesan)</label>' +
      '<textarea class="tk-set-ta" id="tkClMsgs">' + esc((cl.loadingMessages || []).join('\n')) + '</textarea>' +
      '</div>' +
      '<details class="tk-set-details"><summary>3 · Sinkronisasi Tema Tab Data Klien (Apps Script Studio.html)</summary>' +
      '<p class="tk-set-help" style="margin:8px 0 10px">Tab <b>Data Klien</b> dimuat dari iframe Google Apps Script (<code>Studio.html</code>). Tombol Setting (⚙) tetap muncul di pojok kanan bawah tab Data Klien. Jika ingin warna &amp; sudut di dalam iframe <code>Studio.html</code> ikut tersinkron otomatis dengan <code>studio/config.json</code>, tempel snippet ringan ini sebelum <code>&lt;/body&gt;</code> di Apps Script:</p>' +
      '<textarea class="tk-set-code" id="tkGasSnippet" readonly>' + esc(T.getAppsScriptSnippet()) + '</textarea>' +
      '<div class="tk-set-row" style="margin-top:8px"><button type="button" class="tk-set-btn" id="tkCopyGas">Salin Snippet Studio.html</button></div>' +
      '</details>';
  }

  function renderPublishTab() {
    var gh = getGhCfg();
    var pendCount = referencedPendingPaths().length;
    return '<div class="tk-set-card"><h3>Metode 1 · Simpan &amp; Publish Langsung ke GitHub</h3>' +
      '<p class="tk-set-help" style="margin-top:0;margin-bottom:10px">Token disimpan <b>HANYA di browser perangkat ini</b> (<code>localStorage</code>) dan tidak pernah masuk ke kode repository. Gunakan <b>GitHub Fine-Grained Personal Access Token</b> dengan izin <code>Contents: Read and write</code> untuk repo <code>tepikata/tepikata.github.io</code>.</p>' +
      '<label class="tk-set-lbl" for="tkGhToken">GitHub Personal Access Token</label>' +
      '<div class="tk-set-row">' +
      '<input class="tk-set-inp tk-set-grow" id="tkGhToken" type="password" placeholder="github_pat_…" autocomplete="off" value="' + esc(gh.token) + '">' +
      '<button type="button" class="tk-set-btn" id="tkGhToggle" title="Tampilkan / sembunyikan token">Lihat</button>' +
      '</div>' +
      '<details style="margin-top:10px"><summary style="cursor:pointer;font-size:11.5px;color:#686868">Pengaturan Repository (' + esc(gh.owner + '/' + gh.repo + ' · ' + gh.branch) + ')</summary>' +
      '<div class="tk-set-grid2" style="margin-top:8px">' +
      '<div><label class="tk-set-lbl" for="tkGhOwner">Owner</label><input class="tk-set-inp" id="tkGhOwner" value="' + esc(gh.owner) + '"></div>' +
      '<div><label class="tk-set-lbl" for="tkGhRepo">Repository</label><input class="tk-set-inp" id="tkGhRepo" value="' + esc(gh.repo) + '"></div>' +
      '</div>' +
      '<label class="tk-set-lbl" for="tkGhBranch">Branch</label><input class="tk-set-inp" id="tkGhBranch" value="' + esc(gh.branch) + '">' +
      '</details>' +
      '<div class="tk-set-row" style="margin-top:12px">' +
      '<button type="button" class="tk-set-btn" id="tkGhTest">Tes Koneksi</button>' +
      '<button type="button" class="tk-set-btn primary tk-set-grow" id="tkGhPublish"' + (isPublishing ? ' disabled' : '') + '>' + (isPublishing ? 'Mempublikasikan…' : ('Simpan & Publish' + (pendCount ? ' (+' + pendCount + ' Foto)' : ''))) + '</button>' +
      '</div>' +
      '<div id="tkGhTestMsg"></div>' +
      '<div id="tkGhLog" class="tk-set-log" style="display:none"></div>' +
      '</div>' +
      '<div class="tk-set-card"><h3>Metode 2 · Pratinjau &amp; Cadangan Manual (config.json)</h3>' +
      '<p class="tk-set-help" style="margin-top:0;margin-bottom:12px">Uji tampilan sebelum publish atau unduh/impor file <code>studio/config.json</code> secara manual tanpa token GitHub.</p>' +
      '<div class="tk-set-row">' +
      '<button type="button" class="tk-set-btn" id="tkPrevStudio">Pratinjau Studio ↗</button>' +
      '<button type="button" class="tk-set-btn" id="tkPrevClient">Pratinjau Layar Klien ↗</button>' +
      '</div>' +
      '<div class="tk-set-row" style="margin-top:8px">' +
      '<button type="button" class="tk-set-btn" id="tkDownloadJson">Unduh config.json</button>' +
      '<label class="tk-set-btn" for="tkImportJson" style="margin:0">Impor config.json<input type="file" id="tkImportJson" accept=".json,application/json" style="display:none"></label>' +
      '<button type="button" class="tk-set-btn danger" id="tkResetLive">Muat Ulang Live</button>' +
      '</div></div>';
  }

  function renderActiveTabHtml() {
    if (activeTab === 'foto') return renderFotoTab();
    if (activeTab === 'album') return renderAlbumKlienTab();
    if (activeTab === 'publish') return renderPublishTab();
    return renderTemaTab();
  }

  /* ---------- Interactive Live Preview (Full Page Editor) ---------- */
  function renderFullPreview() {
    var stage = document.getElementById('tkFullPreviewStage');
    if (!stage) return;
    var c = state.theme.colors;
    var sharp = state.theme.cornerStyle === 'sharp';
    var lightHdr = T.isLightHex(c.headerBg);
    var rCard = sharp ? '0px' : '14px';
    var rChip = sharp ? '0px' : '999px';
    var dispFont = '"' + state.theme.fonts.display + '", Georgia, serif';
    var bodyFont = '"' + state.theme.fonts.body + '", system-ui, sans-serif';
    var hdrInk = lightHdr ? '#121212' : c.headerInk;
    var hdrAccent = lightHdr ? c.accent : c.accentLight;
    var hdrMuted = lightHdr ? c.muted : c.headerMuted;
    var filterCss = state.collage.filter === 'mono'
      ? 'grayscale(1) contrast(1.06)'
      : state.collage.filter === 'natural'
        ? 'saturate(.95) contrast(1.02)'
        : 'sepia(.35) saturate(.75) contrast(.92)';

    var samplePhoto = '';
    if (state.collage.source === 'custom' && state.collage.photos.length) {
      samplePhoto = T.resolvePhotoUrl(state.collage.photos[0], '');
    }

    if (activePreviewMode === 'klien') {
      var bgRgb = T.hexToRgb(c.headerBg).join(',');
      stage.innerHTML = '<div style="min-height:390px;background:' + c.headerBg + ';color:' + hdrInk + ';font-family:' + bodyFont + ';position:relative;display:flex;flex-direction:column;justify-content:space-between;padding:24px">' +
        (samplePhoto ? '<div style="position:absolute;inset:0;background:url(\'' + esc(samplePhoto) + '\') center/cover;filter:' + filterCss + ';opacity:.38"></div>' : '') +
        '<div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(' + bgRgb + ',.5) 0%,rgba(' + bgRgb + ',.2) 40%,rgba(' + bgRgb + ',.94) 100%)"></div>' +
        '<div style="position:relative;z-index:1;font-size:11px;letter-spacing:.24em;text-transform:uppercase;color:' + hdrAccent + '">' + esc(state.client.brand) + '</div>' +
        '<div style="position:relative;z-index:1;padding-top:110px">' +
        '<p style="margin:0;font-size:13px;color:' + hdrMuted + '">' + esc(state.client.greeting) + '</p>' +
        '<div style="font:400 44px/.95 ' + dispFont + ';margin:8px 0 0;color:' + hdrInk + '">Alya &amp; Raka</div>' +
        '<p style="margin:12px 0 0;font-size:13px;color:' + hdrMuted + '">' + esc((state.client.loadingMessages || [])[0] || '') + '</p>' +
        '<div style="width:180px;height:2px;margin-top:14px;background:' + (lightHdr ? 'rgba(18,18,18,.12)' : 'rgba(255,255,255,.18)') + '"><span style="display:block;width:62%;height:100%;background:' + c.accent + '"></span></div>' +
        '</div></div>';
      return;
    }

    if (activePreviewMode === 'album') {
      var ar = state.album.defaultWidth + ' / ' + state.album.defaultHeight;
      var padPct = Math.min(18, Math.round((state.album.defaultMargin / Math.max(10, state.album.defaultWidth)) * 100));
      var gapPx = Math.max(2, Math.round(state.album.defaultGap * 6));
      stage.innerHTML = '<div style="min-height:390px;background:' + c.bg + ';color:' + c.ink + ';font-family:' + bodyFont + '">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 16px;background:' + c.headerBg + ';color:' + hdrInk + ';border-bottom:1px solid ' + c.line + ';font-size:12px">' +
        '<span style="padding:5px 10px;border-radius:' + rChip + ';background:' + (lightHdr ? c.ink : c.surface) + ';color:' + (lightHdr ? '#fff' : c.ink) + ';font-weight:600;font-size:11px">← Kembali</span>' +
        '<span>Album · ' + state.album.defaultWidth + '×' + state.album.defaultHeight + ' cm</span></div>' +
        '<div style="padding:18px 20px">' +
        '<div style="font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:' + c.accent + '">Draf Album</div>' +
        '<div style="font:400 28px/1.1 ' + dispFont + ';margin:4px 0 12px">Alya &amp; Raka</div>' +
        '<div style="max-width:240px;margin:0 auto;aspect-ratio:' + ar + ';background:' + state.album.defaultPageBg + ';padding:' + padPct + '%;display:grid;grid-template-columns:1fr 1fr;gap:' + gapPx + 'px;box-shadow:0 8px 24px rgba(0,0,0,.1);border:1px solid ' + c.line + '">' +
        '<div style="background:linear-gradient(135deg,#D9D2C8,#BEB5A8);grid-row:span 2"></div>' +
        '<div style="background:linear-gradient(135deg,#CFC7BC,#B3AA9D)"></div>' +
        '<div style="background:linear-gradient(135deg,#DDD7CE,#C3BBB0)"></div>' +
        '</div>' +
        '<div style="display:flex;gap:8px;margin-top:16px">' +
        '<span style="flex:1;text-align:center;padding:9px;border:1px solid ' + c.ink + ';border-radius:' + rCard + ';font-size:12px;font-weight:600">Minta revisi</span>' +
        '<span style="flex:1;text-align:center;padding:9px;background:' + (lightHdr ? c.ink : c.headerBg) + ';color:#fff;border-radius:' + rCard + ';font-size:12px;font-weight:600">Setujui album</span>' +
        '</div></div></div>';
      return;
    }

    // Studio Preview
    var collageBadge = state.collage.source === 'none'
      ? 'Latar Polos'
      : (state.collage.source === 'custom'
        ? ('Kolase Pilihan (' + state.collage.photos.length + ' foto · ' + state.collage.filter + ')')
        : ('Kolase Google Drive · ' + state.collage.filter));

    stage.innerHTML = '<div style="min-height:390px;background:' + c.bg + ';color:' + c.ink + ';font-family:' + bodyFont + '">' +
      '<div style="background:' + c.headerBg + ';color:' + hdrInk + ';padding:14px 18px 22px;position:relative;overflow:hidden;border-bottom:' + (lightHdr ? '1px solid ' + c.line : '0') + '">' +
      (samplePhoto && state.collage.showHero !== false ? '<div style="position:absolute;right:10px;top:8px;width:96px;height:66px;background:#fff;padding:4px;transform:rotate(4deg);opacity:.55;box-shadow:0 6px 14px rgba(0,0,0,.2)"><img src="' + esc(samplePhoto) + '" style="width:100%;height:100%;object-fit:cover;filter:' + filterCss + '"></div>' : '') +
      '<div style="display:flex;justify-content:space-between;align-items:center;position:relative;z-index:1">' +
      '<div><div style="font-size:13px;letter-spacing:.2em;font-weight:600">' + esc(state.client.brand) + '</div><div style="font-size:10px;color:' + hdrAccent + '">Studio · Upcoming Event</div></div>' +
      '<div style="display:flex;gap:6px"><span style="width:28px;height:28px;border:1px solid ' + (lightHdr ? c.line : 'rgba(255,255,255,.25)') + ';border-radius:' + (sharp ? '0' : '50%') + ';display:grid;place-items:center;font-size:13px">⚙</span><span style="width:28px;height:28px;border:1px solid ' + (lightHdr ? c.line : 'rgba(255,255,255,.25)') + ';border-radius:' + (sharp ? '0' : '50%') + ';display:grid;place-items:center;font-size:13px">↻</span></div></div>' +
      '<div style="margin-top:16px;position:relative;z-index:1">' +
      '<div style="font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:' + hdrAccent + '">UPCOMING EVENT</div>' +
      '<div style="font:400 34px/1 ' + dispFont + ';margin-top:6px">November <em style="color:' + hdrAccent + '">2026</em></div>' +
      '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:12px">' +
      '<div style="padding:8px 10px;border-radius:' + rCard + ';background:' + (lightHdr ? c.surface : 'rgba(255,255,255,.08)') + ';border:1px solid ' + (lightHdr ? c.line : 'rgba(255,255,255,.16)') + '"><b style="font:400 22px/1 ' + dispFont + ';display:block">12</b><span style="font-size:10px;color:' + hdrMuted + '">Terjadwal</span></div>' +
      '<div style="padding:8px 10px;border-radius:' + rCard + ';background:' + (lightHdr ? c.surface : 'rgba(255,255,255,.08)') + ';border:1px solid ' + (lightHdr ? c.line : 'rgba(255,255,255,.16)') + '"><b style="font:400 22px/1 ' + dispFont + ';display:block">8</b><span style="font-size:10px;color:' + hdrMuted + '">Selesai</span></div>' +
      '<div style="padding:8px 10px;border-radius:' + rCard + ';background:' + (lightHdr ? c.surface : 'rgba(255,255,255,.08)') + ';border:1px solid ' + (lightHdr ? c.line : 'rgba(255,255,255,.16)') + '"><b style="font:400 22px/1 ' + dispFont + ';display:block;color:' + c.accent + '">0</b><span style="font-size:10px;color:' + hdrMuted + '">Kosong</span></div>' +
      '</div></div></div>' +
      '<div style="padding:14px 18px">' +
      '<div style="background:' + c.surface + ';border:1px solid ' + c.line + ';border-radius:' + rCard + ';padding:12px;display:flex;align-items:center;gap:12px;margin-bottom:10px">' +
      '<span style="width:40px;height:40px;border-radius:' + (sharp ? '0' : '10px') + ';background:linear-gradient(145deg,' + c.accentLight + ',' + c.accent + ');color:#fff;display:grid;place-items:center;font:400 18px/1 ' + dispFont + '">24</span>' +
      '<div style="flex:1"><div style="font-size:13.5px;font-weight:600">Alya &amp; Raka <span style="font-weight:400;color:' + c.muted + '">· Akad Resepsi</span></div><div style="font-size:11px;color:' + c.muted + ';margin-top:2px">08.00 · Gedung Balla Lompoa</div></div>' +
      '<span style="font-size:10.5px;padding:3px 8px;border-radius:' + rChip + ';background:' + c.soft + ';color:' + c.ink + ';font-weight:600">Terjadwal</span>' +
      '</div>' +
      '<div style="font-size:11px;color:' + c.muted + ';text-align:center">' + esc(collageBadge) + '</div>' +
      '</div></div>';
  }

  /* ---------- Event Binding untuk Semua Tab ---------- */
  function bindTabEvents(container) {
    // 1. Preset buttons
    Array.prototype.forEach.call(container.querySelectorAll('[data-preset]'), function (btn) {
      btn.onclick = function () {
        var pid = btn.getAttribute('data-preset');
        state = T.applyPresetToConfig(state, pid);
        applyLive();
        rerenderBody();
        showToast('Tema ' + T.PRESETS[pid].name + ' diterapkan (pratinjau langsung)');
      };
    });

    // 2. Corner style
    Array.prototype.forEach.call(container.querySelectorAll('[data-corner]'), function (btn) {
      btn.onclick = function () {
        state.theme.cornerStyle = btn.getAttribute('data-corner');
        applyLive();
        rerenderBody();
      };
    });

    // 3. Font pair
    var fpSel = container.querySelector('#tkFontPair');
    if (fpSel) {
      fpSel.onchange = function () {
        var found = T.FONT_PAIRS.find(function (x) { return x.id === fpSel.value; });
        if (found) {
          state.theme.fonts = { display: found.display, body: found.body };
          applyLive();
        }
      };
    }

    // 4. Custom color pickers & hex inputs
    function onColorChange(key, val) {
      var hex = T.validHex(val, null);
      if (!hex) return;
      state.theme.preset = 'custom';
      state.theme.colors[key] = hex;
      if (key === 'headerBg') {
        var light = T.isLightHex(hex);
        state.theme.colors.headerInk = light ? '#121212' : '#F7EFEA';
        state.theme.colors.headerMuted = light ? '#686868' : state.theme.colors.accentLight;
        state.theme.colors.headerSurface = light ? state.theme.colors.surface : hex;
      }
      applyLive();
    }
    Array.prototype.forEach.call(container.querySelectorAll('[data-color]'), function (inp) {
      inp.oninput = function () {
        var k = inp.getAttribute('data-color');
        var hexEl = container.querySelector('[data-color-hex="' + k + '"]');
        if (hexEl) hexEl.value = inp.value.toUpperCase();
        onColorChange(k, inp.value);
      };
    });
    Array.prototype.forEach.call(container.querySelectorAll('[data-color-hex]'), function (inp) {
      inp.onchange = function () {
        var k = inp.getAttribute('data-color-hex');
        var hex = T.validHex(inp.value, state.theme.colors[k]);
        inp.value = hex;
        var colEl = container.querySelector('[data-color="' + k + '"]');
        if (colEl) colEl.value = hex;
        onColorChange(k, hex);
      };
    });

    // 5. Collage source & filter & toggles
    Array.prototype.forEach.call(container.querySelectorAll('[data-csource]'), function (btn) {
      btn.onclick = function () {
        state.collage.source = btn.getAttribute('data-csource');
        applyLive();
        rerenderBody();
      };
    });
    Array.prototype.forEach.call(container.querySelectorAll('[data-cfilter]'), function (btn) {
      btn.onclick = function () {
        state.collage.filter = btn.getAttribute('data-cfilter');
        applyLive();
        rerenderBody();
      };
    });
    var shHero = container.querySelector('#tkShowHero');
    if (shHero) shHero.onchange = function () { state.collage.showHero = shHero.checked; applyLive(); };
    var shBg = container.querySelector('#tkShowBg');
    if (shBg) shBg.onchange = function () { state.collage.showBackground = shBg.checked; applyLive(); };

    // 6. Photo upload (multi-file + browser compression max 1600px JPEG 80%)
    var upInp = container.querySelector('#tkPhotoUpload');
    if (upInp) {
      upInp.onchange = function () {
        var files = Array.prototype.slice.call(upInp.files || []);
        if (!files.length) return;
        showToast('Mengompresi ' + files.length + ' foto…');
        var added = 0;
        var chain = Promise.resolve();
        files.forEach(function (file, idx) {
          chain = chain.then(function () {
            return compressImage(file).then(function (res) {
              var relPath = sanitizeFilename(file.name, idx);
              pendingUploads[relPath] = {
                base64: res.base64,
                dataUrl: res.dataUrl,
                sizeKB: res.sizeKB,
                name: file.name
              };
              state.collage.photos.push(relPath);
              state.collage.source = 'custom';
              added++;
            }).catch(function (err) {
              showToast('Lewati ' + file.name + ': ' + err.message);
            });
          });
        });
        chain.then(function () {
          upInp.value = '';
          if (added) {
            applyLive();
            rerenderBody();
            showToast(added + ' foto siap dipratinjau & diunggah saat Publish');
          }
        });
      };
    }

    // 7. Photo reorder & delete
    Array.prototype.forEach.call(container.querySelectorAll('[data-pmove]'), function (btn) {
      btn.onclick = function () {
        var dir = btn.getAttribute('data-pmove');
        var i = +btn.getAttribute('data-pi');
        var arr = state.collage.photos;
        var target = dir === 'up' ? i - 1 : i + 1;
        if (target < 0 || target >= arr.length) return;
        var tmp = arr[i]; arr[i] = arr[target]; arr[target] = tmp;
        applyLive();
        rerenderBody();
      };
    });
    Array.prototype.forEach.call(container.querySelectorAll('[data-pdel]'), function (btn) {
      btn.onclick = function () {
        var i = +btn.getAttribute('data-pdel');
        var removed = state.collage.photos.splice(i, 1)[0];
        if (removed && pendingUploads[removed]) delete pendingUploads[removed];
        applyLive();
        rerenderBody();
      };
    });

    // 8. Album settings
    var albPre = container.querySelector('#tkAlbPreset');
    var albW = container.querySelector('#tkAlbW');
    var albH = container.querySelector('#tkAlbH');
    var albM = container.querySelector('#tkAlbMargin');
    var albG = container.querySelector('#tkAlbGap');
    var albBg = container.querySelector('#tkAlbBg');
    var albBgPick = container.querySelector('#tkAlbBgPick');
    if (albPre) {
      albPre.onchange = function () {
        var idx = +albPre.value;
        if (!isNaN(idx) && ALBUM_SIZES[idx]) {
          state.album.defaultWidth = ALBUM_SIZES[idx][1];
          state.album.defaultHeight = ALBUM_SIZES[idx][2];
          if (albW) albW.value = state.album.defaultWidth;
          if (albH) albH.value = state.album.defaultHeight;
          applyLive();
        }
      };
    }
    if (albW) albW.onchange = function () { state.album.defaultWidth = Math.max(10, Math.min(80, parseFloat(albW.value) || 25)); applyLive(); };
    if (albH) albH.onchange = function () { state.album.defaultHeight = Math.max(10, Math.min(80, parseFloat(albH.value) || 30)); applyLive(); };
    if (albM) albM.onchange = function () { state.album.defaultMargin = Math.max(0, Math.min(5, parseFloat(albM.value) || 0)); applyLive(); };
    if (albG) albG.onchange = function () { state.album.defaultGap = Math.max(0, Math.min(3, parseFloat(albG.value) || 0)); applyLive(); };
    if (albBg) {
      albBg.onchange = function () {
        state.album.defaultPageBg = albBg.value;
        if (albBgPick) albBgPick.value = albBg.value;
        applyLive();
      };
    }
    if (albBgPick) {
      albBgPick.oninput = function () {
        state.album.defaultPageBg = albBgPick.value;
        applyLive();
      };
    }

    // 9. Client waiting screen settings
    function bindTxt(id, setter) {
      var el = container.querySelector('#' + id);
      if (!el) return;
      el.oninput = function () { setter(el.value); applyLive(); };
    }
    bindTxt('tkClBrand', function (v) { state.client.brand = v.trim() || 'TEPI KATA'; });
    bindTxt('tkClGreet', function (v) { state.client.greeting = v.trim() || 'Selamat datang'; });
    bindTxt('tkClEmptyTitle', function (v) { state.client.emptyTitle = v.trim() || 'Tepi Kata'; });
    bindTxt('tkClEmptyNote', function (v) { state.client.emptyNote = v.trim() || T.DEFAULT_CONFIG.client.emptyNote; });
    bindTxt('tkClMsgs', function (v) {
      var list = v.split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean);
      if (list.length) state.client.loadingMessages = list;
    });

    // Copy Apps Script snippet
    var copyGas = container.querySelector('#tkCopyGas');
    if (copyGas) {
      copyGas.onclick = function () {
        var code = T.getAppsScriptSnippet();
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(code).then(function () { showToast('Snippet Studio.html disalin'); });
        } else {
          var ta = container.querySelector('#tkGasSnippet');
          if (ta) { ta.select(); document.execCommand('copy'); showToast('Snippet Studio.html disalin'); }
        }
      };
    }

    // 10. GitHub Publish & Backup tab
    var tokInp = container.querySelector('#tkGhToken');
    var ownInp = container.querySelector('#tkGhOwner');
    var repInp = container.querySelector('#tkGhRepo');
    var brInp = container.querySelector('#tkGhBranch');
    function persistGhInputs() {
      saveGhCfg({
        token: tokInp ? tokInp.value : undefined,
        owner: ownInp ? ownInp.value : undefined,
        repo: repInp ? repInp.value : undefined,
        branch: brInp ? brInp.value : undefined
      });
      updateDirtyBadge();
    }
    [tokInp, ownInp, repInp, brInp].forEach(function (inp) {
      if (inp) inp.onchange = persistGhInputs;
      if (inp) inp.oninput = persistGhInputs;
    });
    var togBtn = container.querySelector('#tkGhToggle');
    if (togBtn && tokInp) {
      togBtn.onclick = function () {
        var show = tokInp.type === 'password';
        tokInp.type = show ? 'text' : 'password';
        togBtn.textContent = show ? 'Tutup' : 'Lihat';
      };
    }

    var testBtn = container.querySelector('#tkGhTest');
    if (testBtn) {
      testBtn.onclick = function () {
        persistGhInputs();
        var cfg = getGhCfg();
        var msgEl = container.querySelector('#tkGhTestMsg');
        testBtn.disabled = true;
        testBtn.textContent = 'Menguji…';
        ghTestConnection(cfg).then(function (info) {
          if (msgEl) {
            msgEl.className = 'tk-set-msg ' + (info.canPush ? 'ok' : 'err');
            msgEl.textContent = info.canPush
              ? ('✓ Terhubung ke ' + info.fullName + ' (akses tulis aktif, branch default: ' + info.defaultBranch + ').')
              : ('Terhubung ke ' + info.fullName + ', tetapi token hanya punya akses baca. Aktifkan Contents: Read and write.');
          }
        }).catch(function (err) {
          if (msgEl) {
            msgEl.className = 'tk-set-msg err';
            msgEl.textContent = '✕ ' + err.message;
          }
        }).then(function () {
          testBtn.disabled = false;
          testBtn.textContent = 'Tes Koneksi';
        });
      };
    }

    var pubBtn = container.querySelector('#tkGhPublish');
    if (pubBtn) pubBtn.onclick = function () { persistGhInputs(); startPublish(); };

    var prevStudio = container.querySelector('#tkPrevStudio');
    if (prevStudio) {
      prevStudio.onclick = function () {
        T.savePreviewConfig(state);
        if (mountMode === 'drawer') {
          closeDrawer();
          showToast('Pratinjau langsung aktif di tampilan Studio');
        } else {
          window.open('index.html?preview=1', '_blank', 'noopener');
        }
      };
    }
    var prevClient = container.querySelector('#tkPrevClient');
    if (prevClient) {
      prevClient.onclick = function () {
        T.savePreviewConfig(state);
        window.open('../?preview=1&demo=Alya%20%26%20Raka', '_blank', 'noopener');
      };
    }
    var dlBtn = container.querySelector('#tkDownloadJson');
    if (dlBtn) dlBtn.onclick = downloadJson;

    var impInp = container.querySelector('#tkImportJson');
    if (impInp) {
      impInp.onchange = function () {
        var f = impInp.files && impInp.files[0];
        if (!f) return;
        var reader = new FileReader();
        reader.onload = function () {
          try {
            var parsed = JSON.parse(reader.result);
            state = T.mergeConfig(parsed);
            applyLive();
            rerenderBody();
            showToast('config.json berhasil diimpor (pratinjau aktif)');
          } catch (err) {
            showToast('File JSON tidak valid: ' + err.message);
          }
          impInp.value = '';
        };
        reader.readAsText(f);
      };
    }

    var resetBtn = container.querySelector('#tkResetLive');
    if (resetBtn) {
      resetBtn.onclick = function () {
        if (isDirty() && !confirm('Buang perubahan yang belum dipublish dan muat ulang versi live?')) return;
        pendingUploads = {};
        clearDraft();
        T.clearPreviewConfig();
        T.loadConfig({ url: 'config.json', allowPreview: false }).then(function (cfg) {
          state = T.mergeConfig(cfg);
          liveSnapshot = JSON.stringify(state);
          applyLive(true);
          rerenderBody();
          showToast('Dimuat ulang dari versi live');
        });
      };
    }
  }

  function downloadJson() {
    var jsonStr = JSON.stringify(state, null, 2) + '\n';
    var blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'config.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 30000);
    showToast('studio/config.json diunduh');
  }

  function startPublish() {
    if (isPublishing) return;
    var cfg = getGhCfg();
    if (!cfg.token) {
      activeTab = 'publish';
      rerenderAll();
      var tok = document.querySelector('#tkGhToken');
      if (tok) tok.focus();
      showToast('Masukkan GitHub Token dulu, atau gunakan Unduh config.json');
      return;
    }

    isPublishing = true;
    activeTab = 'publish';
    rerenderAll();

    var logEl = document.getElementById('tkGhLog');
    if (logEl) { logEl.style.display = 'block'; logEl.innerHTML = ''; }
    function log(text, cls) {
      if (!logEl) return;
      var line = document.createElement('div');
      if (cls) line.className = cls;
      line.textContent = text;
      logEl.appendChild(line);
      logEl.scrollTop = logEl.scrollHeight;
    }

    var uploads = referencedPendingPaths();
    var chain = Promise.resolve();

    log('Menghubungi GitHub (' + cfg.owner + '/' + cfg.repo + ' · ' + cfg.branch + ')…');

    if (uploads.length) {
      log('Mengunggah ' + uploads.length + ' foto kolase terkompresi ke studio/images/…');
      uploads.forEach(function (relPath, i) {
        chain = chain.then(function () {
          var info = pendingUploads[relPath];
          var repoPath = 'studio/' + relPath.replace(/^studio\//i, '');
          log('[' + (i + 1) + '/' + uploads.length + '] Upload ' + repoPath + ' (' + info.sizeKB + ' KB)…');
          return ghPutFile(cfg, repoPath, info.base64, 'Upload foto latar Studio: ' + repoPath).then(function () {
            delete pendingUploads[relPath];
            log('✓ ' + repoPath + ' berhasil diunggah.', 'ok');
          });
        });
      });
    }

    chain.then(function () {
      log('Menyimpan studio/config.json ke branch ' + cfg.branch + '…');
      var jsonStr = JSON.stringify(state, null, 2) + '\n';
      return ghPutFile(cfg, 'studio/config.json', utf8ToBase64(jsonStr), 'Update pengaturan tampilan Studio via Setting');
    }).then(function () {
      liveSnapshot = JSON.stringify(state);
      clearDraft();
      T.clearPreviewConfig();
      syncPreviewPhotoMap();
      log('✓ studio/config.json berhasil dipublish!', 'ok');
      log('GitHub Pages akan memperbarui tampilan live untuk seluruh tim dalam ~30–60 detik.');
      showToast('Berhasil dipublish ke GitHub!');
    }).catch(function (err) {
      log('✕ ' + (err && err.message ? err.message : 'Gagal menghubungi GitHub.'), 'err');
      log('Tip: Pastikan token punya izin Contents: Read and write untuk ' + cfg.owner + '/' + cfg.repo + ', atau gunakan Unduh config.json.');
      showToast('Publish gagal — lihat log detail');
    }).then(function () {
      isPublishing = false;
      updateDirtyBadge();
      var pubBtn = document.getElementById('tkGhPublish');
      if (pubBtn) {
        pubBtn.disabled = false;
        var rem = referencedPendingPaths().length;
        pubBtn.textContent = 'Simpan & Publish' + (rem ? ' (+' + rem + ' Foto)' : '');
      }
    });
  }

  /* ---------- Drawer Shell (studio/index.html) ---------- */
  function buildTabsNav() {
    var tabs = [
      ['tema', 'Tema'],
      ['foto', 'Foto Latar'],
      ['album', 'Album & Klien'],
      ['publish', 'Publish']
    ];
    return tabs.map(function (t) {
      return '<button type="button" class="tk-set-tab' + (activeTab === t[0] ? ' on' : '') + '" data-tk-tab="' + t[0] + '">' + t[1] + '</button>';
    }).join('');
  }

  function rerenderBody() {
    var body = hostEl && hostEl.querySelector('[data-tk-body]');
    if (!body) return;
    body.innerHTML = renderActiveTabHtml();
    bindTabEvents(body);
    updateDirtyBadge();
    if (mountMode === 'full') renderFullPreview();
  }

  function rerenderAll() {
    if (!hostEl) return;
    var nav = hostEl.querySelector('[data-tk-tabs]');
    if (nav) {
      nav.innerHTML = buildTabsNav();
      Array.prototype.forEach.call(nav.querySelectorAll('[data-tk-tab]'), function (bt) {
        bt.onclick = function () {
          activeTab = bt.getAttribute('data-tk-tab');
          rerenderAll();
        };
      });
    }
    rerenderBody();
  }

  function ensureDrawer() {
    if (drawerRoot) return;
    injectStyles();
    drawerRoot = document.createElement('div');
    drawerRoot.id = 'tkSetOv';
    drawerRoot.className = 'tk-set-ov';
    drawerRoot.setAttribute('aria-hidden', 'true');
    drawerRoot.innerHTML = '<div class="tk-set-panel" role="dialog" aria-modal="true" aria-label="Pengaturan Tepi Kata Studio">' +
      '<div class="tk-set-hd">' +
      '<div class="tk-set-hd-title"><span class="tk-set-hd-eyebrow">Tepi Kata Studio</span><h2>Pengaturan Tampilan</h2></div>' +
      '<div class="tk-set-hd-acts">' +
      '<a class="tk-set-link" href="settings.html" id="tkOpenFullEd">Editor Lengkap ↗</a>' +
      '<button type="button" class="tk-set-close" id="tkSetClose" aria-label="Tutup pengaturan">✕</button>' +
      '</div></div>' +
      '<nav class="tk-set-tabs" data-tk-tabs aria-label="Kategori pengaturan"></nav>' +
      '<div class="tk-set-body" data-tk-body></div>' +
      '<div class="tk-set-foot">' +
      '<div class="tk-set-status"><span class="tk-set-ghdot" data-tk-gh-dot></span><span data-tk-dirty>Sinkron dengan live</span></div>' +
      '<div class="tk-set-row">' +
      '<button type="button" class="tk-set-btn" id="tkFootDl">JSON</button>' +
      '<button type="button" class="tk-set-btn primary" id="tkFootPub">Publish</button>' +
      '</div></div></div>';
    document.body.appendChild(drawerRoot);
    hostEl = drawerRoot;

    drawerRoot.onclick = function (e) { if (e.target === drawerRoot) closeDrawer(); };
    drawerRoot.querySelector('#tkSetClose').onclick = closeDrawer;
    drawerRoot.querySelector('#tkFootDl').onclick = downloadJson;
    drawerRoot.querySelector('#tkFootPub').onclick = function () {
      if (getGhCfg().token) startPublish();
      else { activeTab = 'publish'; rerenderAll(); }
    };
    drawerRoot.querySelector('#tkOpenFullEd').onclick = function () {
      saveDraft();
    };
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && isOpen) closeDrawer();
    });
  }

  function openDrawer(tabName) {
    mountMode = 'drawer';
    ensureDrawer();
    if (global.TepiKataConfig) {
      state = T.mergeConfig(global.TepiKataConfig);
      if (!isDirty()) liveSnapshot = JSON.stringify(state);
    }
    if (tabName) activeTab = tabName;
    rerenderAll();
    isOpen = true;
    drawerRoot.classList.add('open');
    drawerRoot.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeDrawer() {
    if (!drawerRoot) return;
    isOpen = false;
    drawerRoot.classList.remove('open');
    drawerRoot.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  /* ---------- Full Page Mode (studio/settings.html) ---------- */
  function mountFullPage(container) {
    mountMode = 'full';
    injectStyles();
    hostEl = container;

    T.loadConfig({ url: 'config.json', allowPreview: false, silent: true }).then(function (liveCfg) {
      liveSnapshot = JSON.stringify(liveCfg);
      var draft = loadDraftIfAny();
      state = draft ? T.mergeConfig(draft) : T.mergeConfig(liveCfg);

      container.classList.add('tk-set-root');
      container.innerHTML = '<nav class="tk-set-tabs" data-tk-tabs style="margin-bottom:14px;border:1px solid rgba(18,18,18,.1)" aria-label="Kategori pengaturan"></nav>' +
        '<div data-tk-body></div>';

      rerenderAll();
      renderFullPreview();

      var pvBtns = document.querySelectorAll('[data-pv-mode]');
      Array.prototype.forEach.call(pvBtns, function (bt) {
        bt.onclick = function () {
          activePreviewMode = bt.getAttribute('data-pv-mode');
          Array.prototype.forEach.call(pvBtns, function (x) { x.classList.toggle('on', x === bt); });
          renderFullPreview();
        };
      });
    });

    window.addEventListener('beforeunload', function (e) {
      if (isDirty()) { e.preventDefault(); e.returnValue = ''; }
    });
  }

  function syncFromLive(cfg) {
    state = T.mergeConfig(cfg);
    liveSnapshot = JSON.stringify(state);
    updateDirtyBadge();
  }

  global.TepiKataSettings = {
    openDrawer: openDrawer,
    closeDrawer: closeDrawer,
    mountFullPage: mountFullPage,
    syncFromLive: syncFromLive,
    publishNow: startPublish,
    downloadJson: downloadJson,
    openClientPreview: function () {
      T.savePreviewConfig(state);
      window.open('../?preview=1&demo=Alya%20%26%20Raka', '_blank', 'noopener');
    },
    openStudioPreview: function () {
      T.savePreviewConfig(state);
      window.open('index.html?preview=1', '_blank', 'noopener');
    }
  };
})(window);
