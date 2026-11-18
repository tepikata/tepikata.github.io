/* Draf Album Tepi Kata — dipakai di aplikasi Studio (menyusun) dan di link klien (melihat & menyetujui).
 * Server: Apps Script Album.gs (action album*). Foto tampil dari thumbnail Google Drive.
 * Satu halaman = satu tata letak (1–6 foto). Posisi foto: x,y (titik fokus %) dan z (zoom ≥ 1).
 * Ukuran & jarak dalam cm, jadi tampilan di layar dan JPG cetak memakai rumus yang sama.
 */
(function () {
  'use strict';
  var LAY = {
    '1':  { n: 1, C: 1, R: 1, s: [[0, 0, 1, 1]], t: '1 foto' },
    '1f': { n: 1, C: 1, R: 1, s: [[0, 0, 1, 1]], penuh: 1, t: '1 foto penuh' },
    '2v': { n: 2, C: 2, R: 1, s: [[0, 0, 1, 1], [1, 0, 1, 1]], t: '2 kolom' },
    '2h': { n: 2, C: 1, R: 2, s: [[0, 0, 1, 1], [0, 1, 1, 1]], t: '2 baris' },
    '3a': { n: 3, C: 2, R: 2, s: [[0, 0, 1, 2], [1, 0, 1, 1], [1, 1, 1, 1]], t: 'Besar kiri' },
    '3b': { n: 3, C: 2, R: 2, s: [[0, 0, 2, 1], [0, 1, 1, 1], [1, 1, 1, 1]], t: 'Besar atas' },
    '3c': { n: 3, C: 3, R: 1, s: [[0, 0, 1, 1], [1, 0, 1, 1], [2, 0, 1, 1]], t: '3 kolom' },
    '4':  { n: 4, C: 2, R: 2, s: [[0, 0, 1, 1], [1, 0, 1, 1], [0, 1, 1, 1], [1, 1, 1, 1]], t: 'Kotak 2×2' },
    '4b': { n: 4, C: 3, R: 2, s: [[0, 0, 3, 1], [0, 1, 1, 1], [1, 1, 1, 1], [2, 1, 1, 1]], t: 'Besar + 3' },
    '5':  { n: 5, C: 6, R: 2, s: [[0, 0, 3, 1], [3, 0, 3, 1], [0, 1, 2, 1], [2, 1, 2, 1], [4, 1, 2, 1]], t: '2 + 3' },
    '6':  { n: 6, C: 3, R: 2, s: [[0, 0, 1, 1], [1, 0, 1, 1], [2, 0, 1, 1], [0, 1, 1, 1], [1, 1, 1, 1], [2, 1, 1, 1]], t: 'Kotak 3×2' },
  };
  var BAWAAN = { 1: '1', 2: '2v', 3: '3a', 4: '4', 5: '5', 6: '6' };
  var UKURAN = [['25×30 cm (potret)', 25, 30], ['30×25 cm (lanskap)', 30, 25], ['30×30 cm', 30, 30], ['25×25 cm', 25, 25], ['20×20 cm', 20, 20], ['30×20 cm (lanskap)', 30, 20], ['40×30 cm', 40, 30], ['60×30 cm (bentang)', 60, 30]];
  var LATAR = [['#ffffff', 'Putih'], ['#f4efe8', 'Krem'], ['#1f1c19', 'Hitam']];
  var ST = { DRAF: 'DRAF', DIKIRIM: 'DIKIRIM KE KLIEN', REVISI: 'KLIEN MINTA REVISI', SETUJU: 'DISETUJUI KLIEN' };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function thumb(id, w) { return 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(id) + '&sz=w' + w; }
  function salin(o) { return JSON.parse(JSON.stringify(o)); }
  function el(html) { var d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstChild; }

  /* ---------- geometri: kotak foto (cm) ---------- */
  function kotak(d, hal) {
    var L = LAY[hal.lay] || LAY[BAWAAN[hal.foto.length]] || LAY['1'];
    var W = d.ukuran.w, H = d.ukuran.h, m = L.penuh ? 0 : d.margin, g = L.penuh ? 0 : d.jarak;
    var cw = (W - 2 * m - (L.C - 1) * g) / L.C, rh = (H - 2 * m - (L.R - 1) * g) / L.R;
    return L.s.map(function (s) {
      return { x: m + s[0] * (cw + g), y: m + s[1] * (rh + g), w: s[2] * cw + (s[2] - 1) * g, h: s[3] * rh + (s[3] - 1) * g };
    });
  }
  function laySah(hal) { var L = LAY[hal.lay]; if (!L || L.n !== hal.foto.length) hal.lay = BAWAAN[hal.foto.length] || '1'; }

  /* ---------- tampilan satu halaman (DOM) ---------- */
  function halamanEl(d, hal, opsi) {
    opsi = opsi || {};
    laySah(hal);
    var W = d.ukuran.w, H = d.ukuran.h, kk = kotak(d, hal);
    var p = document.createElement('div');
    p.className = 'alb-hal';
    p.style.aspectRatio = W + ' / ' + H;
    p.style.background = d.latar || '#fff';
    hal.foto.forEach(function (f, i) {
      var k = kk[i]; if (!k) return;
      var s = document.createElement('div');
      s.className = 'alb-slot';
      s.dataset.i = i;
      s.style.left = (k.x / W * 100) + '%'; s.style.top = (k.y / H * 100) + '%';
      s.style.width = (k.w / W * 100) + '%'; s.style.height = (k.h / H * 100) + '%';
      var img = document.createElement('img');
      img.alt = ''; img.draggable = false; img.loading = opsi.lazy === false ? 'eager' : 'lazy'; img.decoding = 'async';
      img.src = thumb(f.id, opsi.res || 1000);
      gayaFoto(img, f);
      s.appendChild(img);
      p.appendChild(s);
    });
    return p;
  }
  function gayaFoto(img, f) {
    var x = f.x == null ? 50 : f.x, y = f.y == null ? 50 : f.y, z = f.z || 1;
    img.style.objectPosition = x + '% ' + y + '%';
    img.style.transformOrigin = x + '% ' + y + '%';
    img.style.transform = z > 1 ? 'scale(' + z + ')' : '';
  }

  /* ---------- susun otomatis ---------- */
  function orientasi(dim, id) { var o = dim[id]; return !o ? 'l' : (o.h > o.w * 1.05 ? 'p' : 'l'); }
  // Album standar: 10 lembar = 20 halaman, maks. 6 foto per halaman (20 × 6 = 120 = batas pilihan album)
  var JML_HAL = 20, MAKS_FOTO = 6;
  // Bagi n foto ke p halaman: rata, tapi halaman pertama tiap sesi dibuat 1 foto (pembuka) bila muat
  function bagiRata(n, p) {
    var c = [], i;
    for (i = 0; i < p; i++) c.push(Math.floor(n / p) + (i < n % p ? 1 : 0));
    if (p >= 2 && c[0] > 1) {
      var lebih = c[0] - 1, muat = 0;
      for (i = 1; i < p; i++) muat += MAKS_FOTO - c[i];
      if (muat >= lebih) {
        c[0] = 1;
        for (i = 1; lebih > 0; i = i % (p - 1) + 1) if (c[i] < MAKS_FOTO) { c[i]++; lebih--; }
      }
    }
    return c;
  }
  // Bagi p halaman ke beberapa sesi sebanding jumlah fotonya (sisa terbesar), tiap sesi min. 1 halaman
  function bagiHalaman(jml, p) {
    var tot = jml.reduce(function (a, b) { return a + b; }, 0);
    var h = jml.map(function (n) { return Math.max(1, Math.ceil(n / MAKS_FOTO), Math.floor(n / tot * p)); });
    var sisa = function () { return p - h.reduce(function (a, b) { return a + b; }, 0); };
    var urut = jml.map(function (n, i) { return i; }).sort(function (a, b) { return (jml[b] / tot * p - h[b]) - (jml[a] / tot * p - h[a]); });
    for (var k = 0; sisa() > 0 && k < 1000; k++) { var i = urut[k % urut.length]; if (h[i] < jml[i]) h[i]++; }
    // kelebihan halaman (karena minimum per sesi): kurangi dari sesi yang paling longgar
    for (k = 0; sisa() < 0 && k < 1000; k++) {
      var j = -1;
      h.forEach(function (x, i) { if (x > Math.max(1, Math.ceil(jml[i] / MAKS_FOTO)) && (j < 0 || jml[i] / x < jml[j] / h[j])) j = i; });
      if (j < 0) break; h[j]--;
    }
    return h;
  }
  function pilihLay(o) {
    var n = o.length, semua = function (x) { return o.every(function (y) { return y === x; }); };
    if (n === 1) return o[0] === 'l' ? '1f' : '1';
    if (n === 2) return semua('l') ? '2h' : '2v';
    if (n === 3) return o[0] === 'p' ? '3a' : (o[1] === 'p' && o[2] === 'p' ? '3b' : '3c');
    if (n === 4) return semua('p') ? '4' : '4b';
    return n === 5 ? '5' : '6';
  }
  function susunOtomatis(foto, dim) {
    var hal = [], grup = [], last = null;
    if (!foto.length) return hal;
    foto.forEach(function (f) { if (f.g !== last) { grup.push([]); last = f.g; } grup[grup.length - 1].push(f); });
    var p = Math.max(Math.min(JML_HAL, foto.length), Math.ceil(foto.length / MAKS_FOTO));
    // Sesi terlalu banyak untuk 20 halaman: susun sebagai satu urutan
    // Sesi tidak muat dibagi rapi ke 20 halaman (terlalu banyak / maks. 6 foto per halaman): susun sebagai satu urutan
    var minHal = grup.reduce(function (a, q) { return a + Math.max(1, Math.ceil(q.length / MAKS_FOTO)); }, 0);
    if (minHal > p) grup = [foto.slice()];
    var hp = bagiHalaman(grup.map(function (q) { return q.length; }), p);
    grup.forEach(function (q, gi) {
      q = q.slice();
      bagiRata(q.length, hp[gi]).forEach(function (n) {
        if (!n) return;
        var isi = q.splice(0, n);
        hal.push({ lay: pilihLay(isi.map(function (f) { return orientasi(dim, f.id); })), sesi: isi[0].g,
          foto: isi.map(function (f) { return { id: f.id, x: 50, y: 50, z: 1 }; }) });
      });
    });
    return hal;
  }
  function drafBaru(foto, dim) {
    // Bawaan: lanskap 30×25 cm
    return { v: 1, ukuran: { w: 30, h: 25 }, margin: 1.2, jarak: 0.5, latar: '#ffffff', halaman: susunOtomatis(foto, dim) };
  }
  function muatDimensi(ids, selesai) {
    var dim = {}, sisa = ids.length;
    if (!sisa) return selesai(dim);
    ids.forEach(function (id) {
      var im = new Image();
      im.onload = function () { dim[id] = { w: im.naturalWidth, h: im.naturalHeight }; if (--sisa === 0) selesai(dim); };
      im.onerror = function () { if (--sisa === 0) selesai(dim); };
      im.src = thumb(id, 400);
    });
  }

  /* ---------- server ---------- */
  var APP = '';
  function api(body) {
    return fetch(APP, { method: 'POST', body: JSON.stringify(body) })
      .catch(function () { throw new Error('Tidak bisa terhubung. Periksa koneksi internet.'); })
      .then(function (r) { return r.text(); })
      .then(function (t) {
        var j; try { j = JSON.parse(t); } catch (e) { throw new Error('Server belum mendukung Draf Album. Pasang Album.gs (halaman bantuan, bagian 7).'); }
        if (!j.ok) throw new Error(/tidak dikenal|Unknown/i.test(j.error) ? 'Server belum mendukung Draf Album. Pasang Album.gs (halaman bantuan, bagian 7).' : j.error);
        return j.data;
      });
  }

  /* ---------- JPG cetak ---------- */
  var JSZIP = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
  function muatSkrip(src) {
    return new Promise(function (ok, gagal) {
      if (window.JSZip) return ok();
      var s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = function () { gagal(new Error('Gagal memuat pembuat ZIP.')); }; document.head.appendChild(s);
    });
  }
  function pxCetak(d) {
    var dpi = 300, W = d.ukuran.w / 2.54, H = d.ukuran.h / 2.54;
    while (W * dpi * H * dpi > 16e6 && dpi > 150) dpi -= 10;   // batas kanvas browser (terutama iPhone)
    return { dpi: dpi, w: Math.round(W * dpi), h: Math.round(H * dpi) };
  }
  function setDpi(buf, dpi) {      // tulis resolusi (dpi) ke header JFIF supaya percetakan membaca ukuran cm yang benar
    var b = new Uint8Array(buf);
    if (b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF && b[3] === 0xE0 && b[6] === 0x4A && b[7] === 0x46) {
      b[13] = 1; b[14] = dpi >> 8; b[15] = dpi & 255; b[16] = dpi >> 8; b[17] = dpi & 255;
    }
    return b;
  }
  function gambarHalaman(d, hal, img, px) {
    var c = document.createElement('canvas'); c.width = px.w; c.height = px.h;
    var x = c.getContext('2d'), sk = px.w / d.ukuran.w;
    x.fillStyle = d.latar || '#fff'; x.fillRect(0, 0, c.width, c.height);
    x.imageSmoothingQuality = 'high';
    kotak(d, hal).forEach(function (k, i) {
      var f = hal.foto[i], im = img[f.id]; if (!im) return;
      var sx = Math.round(k.x * sk), sy = Math.round(k.y * sk), sw = Math.round((k.x + k.w) * sk) - sx, sh = Math.round((k.y + k.h) * sk) - sy;
      var fx = (f.x == null ? 50 : f.x) / 100, fy = (f.y == null ? 50 : f.y) / 100, z = f.z || 1;
      var s0 = Math.max(sw / im.width, sh / im.height), dw0 = im.width * s0, dh0 = im.height * s0;
      var ox = (sw - dw0) * fx, oy = (sh - dh0) * fy, px0 = sw * fx, py0 = sh * fy;   // sama dengan object-position + scale(z) di layar
      var dw = dw0 * z, dh = dh0 * z, dx = px0 + (ox - px0) * z, dy = py0 + (oy - py0) * z;
      x.save(); x.beginPath(); x.rect(sx, sy, sw, sh); x.clip();
      x.drawImage(im, sx + dx, sy + dy, dw, dh);
      x.restore();
    });
    return new Promise(function (ok) { c.toBlob(function (b) { ok(b); }, 'image/jpeg', 0.92); });
  }
  function ambilGambar(d, hal, px, kunci) {
    var sk = px.w / d.ukuran.w, kk = kotak(d, hal);
    var minta = hal.foto.map(function (f, i) { var k = kk[i]; return { id: f.id, sz: Math.min(4000, Math.ceil(Math.max(k.w, k.h) * sk * (f.z || 1) * 1.15)) }; });
    return api({ key: kunci, action: 'albumGambar', foto: minta }).then(function (res) {
      var img = {};
      return Promise.all(res.map(function (r) {
        if (!r.data) throw new Error('Foto ' + r.id + ' tidak bisa diambil (' + (r.error || '') + ').');
        return new Promise(function (ok, gagal) { var im = new Image(); im.onload = function () { img[r.id] = im; ok(); }; im.onerror = function () { gagal(new Error('Foto ' + r.id + ' rusak.')); }; im.src = r.data; });
      })).then(function () { return img; });
    });
  }
  function unduhJPG(d, nama, kunci, kabar) {
    var px = pxCetak(d), zip;
    return muatSkrip(JSZIP).then(function () {
      zip = new window.JSZip();
      var i = 0;
      function satu() {
        if (i >= d.halaman.length) return;
        var hal = d.halaman[i];
        kabar('Membuat JPG halaman ' + (i + 1) + ' dari ' + d.halaman.length + '…', i / d.halaman.length);
        return ambilGambar(d, hal, px, kunci).then(function (img) { return gambarHalaman(d, hal, img, px); })
          .then(function (b) { return b.arrayBuffer(); })
          .then(function (buf) { zip.file('Halaman-' + ('0' + (i + 1)).slice(-2) + '.jpg', setDpi(buf, px.dpi)); i++; return satu(); });
      }
      return satu();
    }).then(function () {
      kabar('Menyiapkan file ZIP…', 1);
      zip.file('BACA-SAYA.txt', 'Album ' + nama + '\r\n' + d.halaman.length + ' halaman, ukuran ' + d.ukuran.w + ' x ' + d.ukuran.h + ' cm, ' + px.dpi + ' dpi (' + px.w + ' x ' + px.h + ' piksel).\r\nDibuat dari aplikasi Studio Tepi Kata.\r\n');
      return zip.generateAsync({ type: 'blob' });
    }).then(function (blob) {
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'Album ' + String(nama).replace(/[\\/:*?"<>|]/g, '') + ' (' + d.ukuran.w + 'x' + d.ukuran.h + 'cm).zip';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 60000);
      return px;
    });
  }

  /* ---------- gaya ---------- */
  function pasangGaya() {
    if (document.getElementById('albGaya')) return;
    var s = document.createElement('style'); s.id = 'albGaya';
    s.textContent = [
      '.alb{--a-ink:#1f1c19;--a-muted:#6f675e;--a-line:#e4ded5;--a-card:#fff;--a-soft:#f1ece5;--a-aksen:#b08a57;--a-merah:#b3261e;--a-hijau:#1e7a3c}',
      '.alb *{box-sizing:border-box}',
      '.alb-hal{position:relative;width:100%;overflow:hidden;box-shadow:0 1px 2px rgba(0,0,0,.08),0 8px 24px rgba(0,0,0,.08);border-radius:2px;user-select:none;-webkit-user-select:none}',
      '.alb-slot{position:absolute;overflow:hidden;background:#e9e4dd}',
      '.alb-slot img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;pointer-events:none}',
      '.alb-ed .alb-slot{cursor:pointer}',
      '.alb-ed .alb-slot.pil{outline:3px solid var(--a-aksen);outline-offset:-3px;z-index:2;cursor:grab;touch-action:none}',
      '.alb-ed .alb-slot.tukar{outline:3px dashed var(--a-aksen);outline-offset:-3px}',
      '.alb-ed.mode-tukar .alb-slot:not(.pil):hover{outline:3px dashed var(--a-aksen);outline-offset:-3px}',
      '.alb-kartu{background:var(--a-card);border:1px solid var(--a-line);border-radius:16px;padding:12px;margin:0 0 14px}',
      '.alb-kartu.fokus{border-color:var(--a-aksen);box-shadow:0 0 0 1px var(--a-aksen)}',
      '.alb-kep{display:flex;align-items:center;gap:8px;margin:0 0 10px;flex-wrap:wrap}',
      '.alb-kep b{font-size:14px}.alb-kep small{color:var(--a-muted);font-size:12px}',
      '.alb-kep .sp{flex:1}',
      '.alb .alb-ib{border:1px solid var(--a-line);background:var(--a-card);border-radius:10px;min-width:36px;height:36px;padding:0 10px;font-family:inherit;font-size:13px;font-weight:600;line-height:1;color:var(--a-ink);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:4px}',
      '.alb .alb-ib:disabled{opacity:.4;cursor:default}',
      '.alb .alb-ib.on{background:var(--a-ink);color:#fff;border-color:var(--a-ink)}',
      '.alb .alb-ib.bahaya{color:var(--a-merah)}',
      '.alb .alb-lays{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;margin:10px 0 0;padding-bottom:2px}',
      '.alb .alb-lays::-webkit-scrollbar{display:none}',
      '.alb .alb-lay{flex:0 0 auto;width:46px;height:46px;border:1px solid var(--a-line);border-radius:10px;background:var(--a-card);padding:6px;cursor:pointer}',
      '.alb .alb-lay.on{border-color:var(--a-ink);box-shadow:0 0 0 1px var(--a-ink)}',
      '.alb .alb-lay i{display:block;position:relative;width:100%;height:100%}',
      '.alb .alb-lay i span{position:absolute;background:#cfc6bc;border-radius:2px}',
      '.alb .alb-lay.on i span{background:var(--a-ink)}',
      '.alb-alat{display:flex;gap:6px;flex-wrap:wrap;margin:10px 0 0;padding:8px;border-radius:12px;background:var(--a-soft)}',
      '.alb-alat .ket{flex:1 1 100%;font-size:12px;color:var(--a-muted)}',
      '.alb-baki{display:grid;grid-template-columns:repeat(auto-fill,minmax(64px,1fr));gap:6px}',
      '.alb .alb-baki button{aspect-ratio:1;border:0;padding:0;border-radius:8px;overflow:hidden;background:#e9e4dd;cursor:pointer;position:relative}',
      '.alb .alb-baki img{width:100%;height:100%;object-fit:cover;display:block}',
      '.alb-pill{font-size:12px;font-weight:600;border-radius:999px;padding:3px 10px;white-space:nowrap;background:#ece7e0;color:var(--a-muted)}',
      '.alb-pill.dikirim{background:#fdf1dc;color:#8a5a12}.alb-pill.revisi{background:#fbe3e1;color:var(--a-merah)}.alb-pill.setuju{background:#e1f3e6;color:var(--a-hijau)}',
      '.alb-bar{position:sticky;bottom:calc(var(--tab,0px) + 8px);z-index:6;display:flex;gap:8px;flex-wrap:wrap;background:rgba(255,255,255,.92);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);border:1px solid var(--a-line);border-radius:16px;padding:8px;margin:8px 0 12px;box-shadow:0 6px 20px rgba(0,0,0,.08)}',
      '.alb .alb-bar .alb-ib{height:42px;flex:1 1 auto}',
      '.alb .alb-bar .alb-ib.utama{background:var(--a-ink);color:#fff;border-color:var(--a-ink)}',
      '.alb-catatan{white-space:pre-wrap;background:#fbe3e1;color:#5f1510;border-radius:12px;padding:10px 12px;font-size:13px;margin:0 0 12px}',
      '.alb-catatan.ok{background:#e1f3e6;color:#174d27}',
      '.alb-set{display:grid;grid-template-columns:1fr 1fr;gap:8px 10px;margin:8px 0 0}',
      '.alb-set label{font-size:12px;color:var(--a-muted);display:flex;flex-direction:column;gap:4px}',
      '.alb-set select,.alb-set input{border:1px solid var(--a-line);border-radius:10px;padding:8px 10px;font:inherit;background:#fff;color:var(--a-ink);min-height:40px}',
      '.alb-prog{height:4px;border-radius:4px;background:var(--a-line);overflow:hidden;margin-top:6px}.alb-prog i{display:block;height:100%;background:var(--a-aksen);width:0;transition:width .3s}',
      '.alb .alb-daftar button{display:flex;align-items:center;gap:12px;width:100%;text-align:left;border:1px solid var(--a-line);background:var(--a-card);border-radius:14px;padding:12px 14px;margin:0 0 8px;cursor:pointer;font:inherit;color:inherit}',
      '.alb-daftar .nm{font-weight:600}.alb-daftar .mt{font-size:13px;color:var(--a-muted)}',
      '.alb-daftar .main{flex:1;min-width:0;display:flex;flex-direction:column}',
      '.alb-kosong{text-align:center;color:var(--a-muted);padding:36px 8px}',
      '.alb button:focus-visible,.alb select:focus-visible,.alb input:focus-visible,.alb textarea:focus-visible{outline:2px solid var(--a-aksen);outline-offset:2px}',
      /* tampilan klien */
      '.alb-kl{position:fixed;inset:44px 0 0;overflow:auto;background:#F1EEEA;color:#2E1A24;font:15px/1.55 "Plus Jakarta Sans",system-ui,sans-serif;-webkit-overflow-scrolling:touch}',
      '.alb-kl.mode-tab{inset:0;z-index:2147483000}',
      '.alb-kl[hidden]{display:none!important}',
      '.alb-kl .khd{position:sticky;top:0;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 16px;background:#2E1A24;color:#D9C9BE;font-size:13px}',
      '.alb.alb-kl .khd .kembali{border:0;background:#F8F0E9;color:#2E1A24;border-radius:999px;padding:8px 14px;font-family:inherit;font-size:14px;font-weight:600;cursor:pointer;min-height:40px}',
      '.alb-kl .wrap{max-width:760px;margin:0 auto;padding:22px 16px calc(120px + env(safe-area-inset-bottom,0px))}',
      '.alb-kl h2{font:400 clamp(32px,7vw,52px)/1 "Bodoni Moda",Georgia,serif;margin:6px 0 8px}',
      '.alb-kl .eyebrow{font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:#8a6a4a}',
      '.alb-kl .lead{color:#6b5560;margin:0 0 18px}',
      '.alb-kl .nohal{display:flex;justify-content:space-between;align-items:center;margin:18px 2px 8px;font-size:13px;color:#6b5560}',
      '.alb-kl textarea{width:100%;border:1px solid #d9c9be;border-radius:12px;padding:10px 12px;font:inherit;min-height:64px;margin-top:8px;background:#fff;color:#2E1A24}',
      '.alb-kl .kbar{position:fixed;left:0;right:0;bottom:0;z-index:3;padding:12px 16px calc(12px + env(safe-area-inset-bottom,0px));background:rgba(241,238,234,.94);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);border-top:1px solid #e1d6cc}',
      '.alb-kl .kbar .in{max-width:760px;margin:0 auto;display:flex;gap:10px}',
      '.alb.alb-kl .kbar button{flex:1;min-height:48px;border-radius:14px;border:1px solid #2E1A24;background:transparent;color:#2E1A24;font-family:inherit;font-size:15px;font-weight:600;cursor:pointer}',
      '.alb.alb-kl .kbar button.utama{background:#2E1A24;color:#F8F0E9}',
      '.alb.alb-kl .kbar button:disabled{opacity:.5}',
      '.alb.alb-kl .ctt{font-family:inherit;font-size:13px;font-weight:600;border:1px solid #d9c9be;background:#fff;border-radius:999px;padding:6px 12px;color:#2E1A24;cursor:pointer}',
      '.alb-kl .info{border-radius:14px;padding:12px 14px;margin:0 0 16px;font-size:14px;background:#fff;border:1px solid #e1d6cc}',
      '.alb-kl .err{color:#b3261e;font-size:13px;min-height:1em;margin:6px 0 0}',
      'body.ada-album>iframe{top:44px;height:calc(100% - 44px)}',
      '.alb-tab{position:fixed;top:0;left:0;right:0;height:44px;z-index:5;display:flex;justify-content:center;gap:4px;padding:6px 8px;background:#2E1A24}',
      '.alb.alb-tab button{flex:0 1 180px;border:0;border-radius:10px;background:transparent;color:#D9C9BE;font:600 14px "Plus Jakarta Sans",system-ui,sans-serif;cursor:pointer}',
      '.alb.alb-tab button.on{background:#F8F0E9;color:#2E1A24}',
      '.alb.alb-tab button .dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:#B08A57;margin-left:6px;vertical-align:middle}',
    ].join('\n');
    document.head.appendChild(s);
  }
  function ikonLay(id) {
    var L = LAY[id], gC = 1 / L.C, gR = 1 / L.R;
    return '<i' + (L.penuh ? '' : ' style="margin:4px;width:calc(100% - 8px);height:calc(100% - 8px)"') + '>' + L.s.map(function (s) {
      return '<span style="left:calc(' + s[0] * gC * 100 + '% + 1px);top:calc(' + s[1] * gR * 100 + '% + 1px);width:calc(' + s[2] * gC * 100 + '% - 2px);height:calc(' + s[3] * gR * 100 + '% - 2px)"></span>';
    }).join('') + '</i>';
  }
  function pillStatus(s) {
    var c = s === ST.DIKIRIM ? 'dikirim' : s === ST.REVISI ? 'revisi' : s === ST.SETUJU ? 'setuju' : '';
    var t = s === ST.DIKIRIM ? 'Menunggu klien' : s === ST.REVISI ? 'Klien minta revisi' : s === ST.SETUJU ? 'Disetujui klien' : s ? 'Draf' : 'Belum dibuat';
    return '<span class="alb-pill ' + c + '">' + t + '</span>';
  }

  /* ======================= STUDIO ======================= */
  function Studio(root, kunci, toast) {
    var X = { daftar: null, k: null, d: null, foto: [], meta: {}, dasar: '', ubah: false, pil: null, tukar: false, fokus: -1, dim: {} };
    root.classList.add('alb');
    toast = toast || function (m) { alert(m); };
    function adaUbah(v) { X.ubah = v; var b = root.querySelector('[data-a=simpan]'); if (b) b.textContent = v ? 'Simpan •' : 'Tersimpan'; }
    window.addEventListener('beforeunload', function (e) { if (X.ubah) { e.preventDefault(); e.returnValue = ''; } });

    function daftar(paksa) {
      if (X.ubah && !confirm('Perubahan draf belum disimpan. Tinggalkan?')) return;
      X.k = null; X.d = null; adaUbah(false);
      if (X.daftar && !paksa) return gambarDaftar();
      root.innerHTML = '<div class="spin"></div>';
      api({ key: kunci, action: 'albumDaftar' }).then(function (d) { X.daftar = d; gambarDaftar(); })
        .catch(function (e) { root.innerHTML = '<div class="alb-kosong">' + esc(e.message) + '<p><button class="alb-ib" data-ulang>Coba lagi</button></p></div>'; root.querySelector('[data-ulang]').onclick = function () { daftar(true); }; });
    }
    function gambarDaftar() {
      var q = (X.q || '').toLowerCase();
      var siap = X.daftar.filter(function (k) { return k.statusPilih === 'SELESAI' || k.draf; });
      var nunggu = X.daftar.length - siap.length;
      var l = siap.filter(function (k) { return !q || (k.nama + ' ' + k.bulan).toLowerCase().indexOf(q) >= 0; });
      root.innerHTML = '<p class="note" style="margin:4px 0 12px">Klien muncul di sini setelah mengirim pilihan foto album (maks. 120 foto). Halaman album disusun otomatis dari pilihannya. Atur sesukanya, kirim ke klien untuk disetujui, lalu unduh JPG untuk percetakan.</p>' +
        '<input class="search" type="search" placeholder="Cari klien…" value="' + esc(X.q || '') + '" data-q>' +
        '<div class="alb-daftar">' + (l.map(function (k, i) {
          var dr = k.draf;
          return '<button type="button" data-i="' + X.daftar.indexOf(k) + '"><span class="main"><span class="nm">' + esc(k.nama) + '</span><span class="mt">' + esc(k.bulan) + ' · ' + k.jumlah + ' foto album' +
            (k.statusPilih === 'SELESAI' ? '' : ' (pilihan dibuka lagi)') + (dr && dr.hal ? ' · ' + dr.hal + ' halaman · ' + esc(dr.waktu) : '') + '</span></span>' + pillStatus(dr && dr.status) + '</button>';
        }).join('') || '<div class="alb-kosong">' + (q ? 'Tidak ada klien yang cocok.' : 'Belum ada klien yang selesai memilih foto album.') + '</div>') + '</div>' +
        (nunggu ? '<p class="note" style="text-align:center;margin:8px 0 0">' + nunggu + ' klien lain masih memilih foto album. Mereka muncul di sini setelah mengirim pilihannya.</p>' : '');
      var inp = root.querySelector('[data-q]');
      inp.oninput = function () { X.q = inp.value; var pos = inp.selectionStart; gambarDaftar(); var n = root.querySelector('[data-q]'); n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) { } };
      Array.prototype.forEach.call(root.querySelectorAll('.alb .alb-daftar button[data-i]'), function (b) { b.onclick = function () { buka(X.daftar[+b.dataset.i].kode); }; });
    }

    function buka(kode) {
      root.innerHTML = '<div class="spin"></div>';
      api({ key: kunci, action: 'albumAmbil', kode: kode }).then(function (r) {
        X.k = r; X.foto = r.foto; X.meta = {}; r.foto.forEach(function (f) { X.meta[f.id] = f; });
        X.status = r.simpanan ? r.simpanan.status : ''; X.catatan = r.simpanan ? r.simpanan.catatan : ''; X.dasar = r.simpanan ? r.simpanan.waktu : '';
        X.pil = null; X.tukar = false; X.fokus = -1;
        if (r.simpanan && r.simpanan.draf) { X.d = r.simpanan.draf; bersihkan(); adaUbah(false); editor(); return; }
        if (!r.foto.length) { root.innerHTML = '<div class="alb-kosong">' + esc(r.nama) + ' belum memilih foto album.<p><button class="alb-ib" data-kembali>← Daftar</button></p></div>'; root.querySelector('[data-kembali]').onclick = function () { daftar(); }; return; }
        root.innerHTML = '<div class="alb-kosong">Menyusun ' + r.foto.length + ' foto menjadi halaman album…</div>';
        muatDimensi(r.foto.map(function (f) { return f.id; }), function (dim) { X.dim = dim; X.d = drafBaru(r.foto, dim); adaUbah(true); editor(); });
      }).catch(function (e) { toast(e.message); daftar(); });
    }
    function bersihkan() {   // foto yang tidak lagi dipilih klien dikeluarkan dari halaman
      var ok = {}; X.foto.forEach(function (f) { ok[f.id] = 1; });
      X.d.halaman.forEach(function (h) { h.foto = h.foto.filter(function (f) { return ok[f.id]; }); });
      X.d.halaman = X.d.halaman.filter(function (h) { return h.foto.length; });
      X.d.halaman.forEach(laySah);
    }
    function dipakai() { var u = {}; X.d.halaman.forEach(function (h) { h.foto.forEach(function (f) { u[f.id] = 1; }); }); return u; }

    function editor() {
      var d = X.d, u = dipakai(), sisa = X.foto.filter(function (f) { return !u[f.id]; });
      var uk = UKURAN.findIndex(function (x) { return x[1] === d.ukuran.w && x[2] === d.ukuran.h; });
      var catKls = X.status === ST.SETUJU ? ' ok' : '';
      var h = '<div class="alb-kep"><button type="button" class="alb-ib" data-a="kembali">← Daftar</button><span class="sp"></span>' + pillStatus(X.status || (X.dasar ? ST.DRAF : '')) + '</div>' +
        '<h2 style="font:600 26px/1.15 \'Cormorant Garamond\',Georgia,serif;margin:0 0 4px">' + esc(X.k.nama) + '</h2>' +
        '<p class="note" style="margin:0 0 12px">' + d.halaman.length + ' halaman · ' + X.foto.length + ' foto pilihan' + (sisa.length ? ' · <b style="color:var(--a-merah)">' + sisa.length + ' belum dipakai</b>' : '') + (X.k.terkunci ? '' : ' · klien masih bisa mengubah pilihan') + '</p>' +
        (X.catatan ? '<div class="alb-catatan' + catKls + '">' + esc(X.catatan) + '</div>' : '') +
        '<details class="alb-kartu"><summary style="cursor:pointer;font-weight:600">Ukuran & tampilan halaman</summary><div class="alb-set">' +
        '<label>Ukuran halaman<select data-s="uk">' + UKURAN.map(function (x, i) { return '<option value="' + i + '"' + (i === uk ? ' selected' : '') + '>' + x[0] + '</option>'; }).join('') + (uk < 0 ? '<option selected>' + d.ukuran.w + '×' + d.ukuran.h + ' cm</option>' : '') + '</select></label>' +
        '<label>Latar<select data-s="latar">' + LATAR.map(function (x) { return '<option value="' + x[0] + '"' + (x[0] === d.latar ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select></label>' +
        '<label>Tepi halaman (cm)<input type="number" step="0.1" min="0" max="5" data-s="margin" value="' + d.margin + '"></label>' +
        '<label>Jarak antar foto (cm)<input type="number" step="0.1" min="0" max="3" data-s="jarak" value="' + d.jarak + '"></label>' +
        '</div><p class="note" style="margin:10px 0 0">JPG dibuat ' + pxCetak(d).dpi + ' dpi (' + pxCetak(d).w + '×' + pxCetak(d).h + ' piksel per halaman).</p>' +
        '<p style="margin:10px 0 0"><button type="button" class="alb-ib bahaya" data-a="ulang">Susun ulang otomatis</button></p></details>' +
        '<div class="alb-ed' + (X.tukar ? ' mode-tukar' : '') + '" data-ed></div>' +
        '<div class="alb-kartu"><div class="alb-kep"><b>Foto belum dipakai</b><small>' + sisa.length + '</small><span class="sp"></span></div>' +
        (sisa.length ? '<p class="note" style="margin:0 0 8px">Ketuk foto di halaman lalu ketuk foto di sini untuk mengganti; atau ketuk halaman dulu untuk menambahkannya. Tanpa pilihan, foto dibuat jadi halaman baru di akhir.</p><div class="alb-baki">' +
          sisa.map(function (f) { return '<button type="button" data-baki="' + esc(f.id) + '" title="' + esc(f.n + ' · ' + f.g) + '"><img loading="lazy" src="' + thumb(f.id, 200) + '" alt="' + esc(f.n) + '"></button>'; }).join('') + '</div>' : '<p class="note" style="margin:0">Semua foto pilihan sudah masuk halaman.</p>') + '</div>' +
        '<div class="alb-bar"><button type="button" class="alb-ib" data-a="simpan">' + (X.ubah ? 'Simpan •' : 'Tersimpan') + '</button>' +
        '<button type="button" class="alb-ib" data-a="kirim">Kirim ke klien</button>' +
        '<button type="button" class="alb-ib utama" data-a="jpg">Unduh JPG</button><div data-prog style="flex:1 1 100%;display:none"><small data-pt></small><div class="alb-prog"><i></i></div></div></div>';
      root.innerHTML = h;
      gambarHalaman_();
      pasangAksi();
    }
    function gambarHalaman_() {
      var box = root.querySelector('[data-ed]'), d = X.d;
      box.innerHTML = '';
      d.halaman.forEach(function (hal, i) {
        laySah(hal);
        var kartu = el('<div class="alb-kartu' + (X.fokus === i ? ' fokus' : '') + '" data-h="' + i + '"><div class="alb-kep"><b>Halaman ' + (i + 1) + '</b><small>' + esc(hal.sesi || (X.meta[hal.foto[0] && hal.foto[0].id] || {}).g || '') + '</small><span class="sp"></span>' +
          '<button type="button" class="alb-ib" data-hx="naik" aria-label="Pindah ke atas"' + (i ? '' : ' disabled') + '>↑</button>' +
          '<button type="button" class="alb-ib" data-hx="turun" aria-label="Pindah ke bawah"' + (i < d.halaman.length - 1 ? '' : ' disabled') + '>↓</button>' +
          '<button type="button" class="alb-ib bahaya" data-hx="hapus" aria-label="Hapus halaman">✕</button></div></div>');
        var p = halamanEl(d, hal, { res: 900 });
        kartu.appendChild(p);
        var lays = Object.keys(LAY).filter(function (k) { return LAY[k].n === hal.foto.length; });
        if (lays.length > 1) kartu.appendChild(el('<div class="alb-lays" role="group" aria-label="Tata letak">' + lays.map(function (k) { return '<button type="button" class="alb-lay' + (k === hal.lay ? ' on' : '') + '" data-lay="' + k + '" title="' + LAY[k].t + '" aria-label="' + LAY[k].t + '">' + ikonLay(k) + '</button>'; }).join('') + '</div>'));
        if (X.pil && X.pil[0] === i) {
          var f = hal.foto[X.pil[1]], m = X.meta[f.id] || {};
          kartu.appendChild(el('<div class="alb-alat"><span class="ket">' + esc(m.n || 'Foto') + (X.tukar ? ' · ketuk foto lain (di halaman mana saja) untuk menukar' : ' · geser foto untuk mengatur posisi') + '</span>' +
            '<button type="button" class="alb-ib' + (X.tukar ? ' on' : '') + '" data-f="tukar">⇄ Tukar</button>' +
            '<button type="button" class="alb-ib" data-f="kecil" aria-label="Perkecil"' + ((f.z || 1) <= 1 ? ' disabled' : '') + '>−</button>' +
            '<button type="button" class="alb-ib" data-f="besar" aria-label="Perbesar"' + ((f.z || 1) >= 3 ? ' disabled' : '') + '>＋</button>' +
            '<button type="button" class="alb-ib" data-f="tengah">Tengah</button>' +
            '<button type="button" class="alb-ib bahaya" data-f="keluar">Keluarkan</button>' +
            '<button type="button" class="alb-ib" data-f="selesai">Selesai</button></div>'));
          var slot = p.querySelector('.alb-slot[data-i="' + X.pil[1] + '"]'); if (slot) { slot.classList.add('pil'); geser(slot, f); }
        }
        box.appendChild(kartu);
      });
      if (!d.halaman.length) box.innerHTML = '<div class="alb-kosong">Belum ada halaman. Ketuk foto di bawah untuk membuat halaman.</div>';
    }
    function geser(slot, f) {
      var img = slot.querySelector('img'), awal = null;
      slot.onpointerdown = function (e) {
        if (X.tukar) return;
        awal = { x: e.clientX, y: e.clientY, fx: f.x == null ? 50 : f.x, fy: f.y == null ? 50 : f.y };
        try { slot.setPointerCapture(e.pointerId); } catch (er) { }
        e.preventDefault();
      };
      slot.onpointermove = function (e) {
        if (!awal || !img.naturalWidth) return;
        var r = slot.getBoundingClientRect(), z = f.z || 1;
        var s = Math.max(r.width / img.naturalWidth, r.height / img.naturalHeight);
        var lebih = { x: img.naturalWidth * s * z - r.width, y: img.naturalHeight * s * z - r.height };
        if (lebih.x > 1) f.x = Math.max(0, Math.min(100, awal.fx - (e.clientX - awal.x) / lebih.x * 100));
        if (lebih.y > 1) f.y = Math.max(0, Math.min(100, awal.fy - (e.clientY - awal.y) / lebih.y * 100));
        gayaFoto(img, f);
      };
      slot.onpointerup = slot.onpointercancel = function () { if (awal) { awal = null; adaUbah(true); } };
    }
    function pasangAksi() {
      var d = X.d;
      root.onclick = function (e) {
        var t = e.target.closest('button, .alb-slot, .alb-kartu[data-h]');
        if (!t || !root.contains(t)) return;
        var kartu = e.target.closest('.alb-kartu[data-h]'), hi = kartu ? +kartu.dataset.h : -1;
        if (t.dataset.a === 'kembali') return daftar();
        if (t.dataset.a === 'simpan') return simpan(false);
        if (t.dataset.a === 'kirim') return simpan(true);
        if (t.dataset.a === 'jpg') return jpg();
        if (t.dataset.a === 'ulang') {
          if (!confirm('Susun ulang semua halaman secara otomatis? Susunan sekarang akan diganti.')) return;
          muatDimensi(X.foto.map(function (f) { return f.id; }), function (dim) { var baru = drafBaru(X.foto, dim); baru.ukuran = d.ukuran; baru.margin = d.margin; baru.jarak = d.jarak; baru.latar = d.latar; X.d = baru; X.pil = null; adaUbah(true); editor(); });
          return;
        }
        if (t.dataset.baki) return dariBaki(t.dataset.baki);
        if (t.dataset.hx) {
          var a = d.halaman;
          if (t.dataset.hx === 'naik' && hi > 0) { a.splice(hi - 1, 0, a.splice(hi, 1)[0]); X.fokus = hi - 1; }
          else if (t.dataset.hx === 'turun' && hi < a.length - 1) { a.splice(hi + 1, 0, a.splice(hi, 1)[0]); X.fokus = hi + 1; }
          else if (t.dataset.hx === 'hapus') { if (!confirm('Hapus halaman ' + (hi + 1) + '? Fotonya kembali ke "Foto belum dipakai".')) return; a.splice(hi, 1); X.fokus = -1; }
          X.pil = null; adaUbah(true); return editor();
        }
        if (t.dataset.lay) { d.halaman[hi].lay = t.dataset.lay; adaUbah(true); return gambarHalaman_(); }
        if (t.dataset.f) {
          var f = d.halaman[X.pil[0]].foto[X.pil[1]];
          if (t.dataset.f === 'tukar') { X.tukar = !X.tukar; root.querySelector('[data-ed]').classList.toggle('mode-tukar', X.tukar); return gambarHalaman_(); }
          if (t.dataset.f === 'besar') f.z = Math.min(3, Math.round(((f.z || 1) + 0.15) * 100) / 100);
          if (t.dataset.f === 'kecil') f.z = Math.max(1, Math.round(((f.z || 1) - 0.15) * 100) / 100);
          if (t.dataset.f === 'tengah') { f.x = 50; f.y = 50; f.z = 1; }
          if (t.dataset.f === 'keluar') { var h = d.halaman[X.pil[0]]; h.foto.splice(X.pil[1], 1); if (!h.foto.length) d.halaman.splice(X.pil[0], 1); X.pil = null; X.tukar = false; adaUbah(true); return editor(); }
          if (t.dataset.f === 'selesai') { X.pil = null; X.tukar = false; return gambarHalaman_(); }
          adaUbah(true); return gambarHalaman_();
        }
        if (t.classList.contains('alb-slot')) {
          var si = +t.dataset.i;
          if (X.pil && X.tukar && !(X.pil[0] === hi && X.pil[1] === si)) {
            var A = d.halaman[X.pil[0]].foto, B = d.halaman[hi].foto, tmp = A[X.pil[1]];
            A[X.pil[1]] = B[si]; B[si] = tmp; X.pil = [hi, si]; X.tukar = false; adaUbah(true); return gambarHalaman_();
          }
          if (X.pil && X.pil[0] === hi && X.pil[1] === si) return;
          X.pil = [hi, si]; X.tukar = false; X.fokus = hi; return gambarHalaman_();
        }
        if (kartu && t === kartu) { X.fokus = X.fokus === hi ? -1 : hi; X.pil = null; X.tukar = false; return gambarHalaman_(); }
      };
      Array.prototype.forEach.call(root.querySelectorAll('[data-s]'), function (inp) {
        inp.onchange = function () {
          var s = inp.dataset.s;
          if (s === 'uk') { var u = UKURAN[+inp.value]; if (u) d.ukuran = { w: u[1], h: u[2] }; }
          if (s === 'latar') d.latar = inp.value;
          if (s === 'margin' || s === 'jarak') { var v = parseFloat(inp.value); if (!isNaN(v)) d[s] = Math.max(0, Math.min(s === 'margin' ? 5 : 3, v)); }
          adaUbah(true); editor(); var det = root.querySelector('details'); if (det) det.open = true;
        };
      });
    }
    function dariBaki(id) {
      var d = X.d, f = { id: id, x: 50, y: 50, z: 1 };
      if (X.pil) { var h = d.halaman[X.pil[0]]; h.foto[X.pil[1]] = f; X.tukar = false; }
      else if (X.fokus >= 0 && d.halaman[X.fokus]) {
        var hf = d.halaman[X.fokus];
        if (hf.foto.length >= 6) return toast('Halaman ini sudah berisi 6 foto (maksimal).');
        hf.foto.push(f); hf.lay = BAWAAN[hf.foto.length];
      } else { d.halaman.push({ lay: '1', sesi: (X.meta[id] || {}).g || '', foto: [f] }); X.fokus = d.halaman.length - 1; toast('Halaman baru dibuat di akhir'); }
      adaUbah(true); editor();
    }
    function simpan(kirim) {
      var d = X.d;
      if (kirim) {
        var sisa = X.foto.length - Object.keys(dipakai()).length;
        if (!confirm('Kirim draf ' + d.halaman.length + ' halaman ke ' + X.k.nama + '?' + (sisa ? '\n\nMasih ada ' + sisa + ' foto pilihan yang belum dipakai.' : '') + '\n\nKlien akan melihat tab "Draf Album" di link galerinya.')) return;
      }
      var bt = root.querySelector('[data-a=' + (kirim ? 'kirim' : 'simpan') + ']'); bt.disabled = true; bt.textContent = 'Menyimpan…';
      var data = salin(d); data.halaman.forEach(function (h) { h.foto.forEach(function (f) { f.x = Math.round((f.x == null ? 50 : f.x) * 10) / 10; f.y = Math.round((f.y == null ? 50 : f.y) * 10) / 10; f.z = f.z || 1; }); });
      api({ key: kunci, action: 'albumSimpan', kode: X.k.kode, draf: data, kirim: !!kirim, dasar: X.dasar })
        .then(function (r) {
          X.dasar = r.waktu; X.status = r.status; X.catatan = r.catatan; adaUbah(false);
          var it = X.daftar && X.daftar.find(function (k) { return k.kode === X.k.kode; });
          if (it) it.draf = { status: r.status, hal: d.halaman.length, waktu: r.waktu, catatan: r.catatan };
          toast(kirim ? 'Draf dikirim. Klien bisa melihatnya di link galeri.' : 'Draf tersimpan'); editor();
        })
        .catch(function (e) { toast(e.message); bt.disabled = false; bt.textContent = kirim ? 'Kirim ke klien' : 'Simpan •'; });
    }
    function jpg() {
      var bar = root.querySelector('[data-prog]'), pt = root.querySelector('[data-pt]'), pi = root.querySelector('.alb-prog i');
      var tombol = root.querySelectorAll('.alb .alb-bar .alb-ib');
      if (!X.d.halaman.length) return toast('Belum ada halaman.');
      Array.prototype.forEach.call(tombol, function (b) { b.disabled = true; });
      bar.style.display = '';
      unduhJPG(X.d, X.k.nama, kunci, function (t, p) { pt.textContent = t; pi.style.width = Math.round(p * 100) + '%'; })
        .then(function (px) { pt.textContent = 'Selesai: ' + X.d.halaman.length + ' JPG (' + px.w + '×' + px.h + ' piksel, ' + px.dpi + ' dpi) dalam satu file ZIP.'; toast('File ZIP album diunduh'); })
        .catch(function (e) { pt.textContent = 'Gagal: ' + e.message; toast(e.message); })
        .then(function () { Array.prototype.forEach.call(tombol, function (b) { b.disabled = false; }); });
    }
    return { tampil: function () { if (!X.k) daftar(); }, muatUlang: function () { if (X.k) { if (!X.ubah || confirm('Buang perubahan yang belum disimpan?')) { adaUbah(false); buka(X.k.kode); } } else daftar(true); } };
  }

  /* ======================= KLIEN ======================= */
  /* Tab "5 · Album" disisipkan ke deretan tab galeri klien (Index.html), di samping tab Video.
     Muncul setelah klien mengirim pilihan album. Sebelum studio mengirim draf: susunan awal otomatis (hanya lihat).
     Setelah studio mengirim draf: klien bisa memberi catatan per halaman, lalu Setujui / Minta revisi. */
  function Klien(k, opsi) {
    var D = null, box = null, tabEl = null;
    api({ action: 'albumKlien', k: k }).then(function (r) {
      if (!r || !r.ada) return;
      D = r;
      if (r.otomatis) {
        if (!r.foto || !r.foto.length) return;
        muatDimensi(r.foto.map(function (f) { return f.id; }), function (dim) { D.draf = drafBaru(r.foto, dim); siap(); });
      } else siap();
    }).catch(function () { });
    function siap() { pasangGaya(); tungguTab(0); }

    /* cari deretan tab galeri: elemen yang memuat teks "Pilih untuk Album" + saudara "Video"/"Kenangan" */
    // teks per elemen anak dipisah spasi: <span>4</span><span>Video</span> → "4 Video", bukan "4Video"
    function teksEl(e) {
      var w = document.createTreeWalker(e, NodeFilter.SHOW_TEXT), n, a = [];
      while ((n = w.nextNode())) if (n.nodeValue.trim()) a.push(n.nodeValue.trim());
      return a.join(' ');
    }
    function tampil(e) { return !e.classList.contains('hidden') && !e.hidden && e.offsetParent !== null; }
    function cariTab(akhir) {
      var semua = document.querySelectorAll('button, a, [role=tab], li');
      var vid = null, ken = null, alb = null;
      Array.prototype.forEach.call(semua, function (e) {
        if (e.closest('.alb') || e.hasAttribute('data-alb-tab')) return;
        var t = teksEl(e);
        if (t.length > 60) return;
        if (!vid && /^\d?\s*Video\b/i.test(t)) vid = e;
        if (!ken && /Kenangan/i.test(t)) ken = e;
        if (!alb && /Pilih untuk Album/i.test(t)) alb = e;
      });
      // tunggu sampai tab yang terlihat paling kanan (Video/Kenangan) sudah tampil; setelah batas waktu pakai yang tampil
      var acuan = null, nomor = '';
      if (vid && tampil(vid)) { acuan = vid; nomor = '5'; }
      else if (akhir && ken && tampil(ken)) { acuan = ken; nomor = '4'; }
      else if (akhir && alb && tampil(alb)) { acuan = alb; nomor = '3'; }
      if (!acuan || !acuan.parentNode) return null;
      return { acuan: acuan, induk: acuan.parentNode, nomor: nomor };
    }
    function tungguTab(n) {
      var t = cariTab(n >= 30);                  // ±15 detik menunggu tab Video; setelah itu boleh tab lain
      if (t) return pasangTab(t);
      if (n > 120) return;                       // ±60 detik: galeri besar butuh waktu dimuat
      setTimeout(function () { tungguTab(n + 1); }, 500);
    }
    function pasangTab(t) {
      if (document.querySelector('[data-alb-tab]')) return;
      tabEl = t.acuan.cloneNode(true);
      tabEl.setAttribute('data-alb-tab', '1');
      tabEl.removeAttribute('id'); tabEl.removeAttribute('aria-selected'); tabEl.removeAttribute('aria-current');
      Array.prototype.forEach.call(tabEl.querySelectorAll('[id]'), function (x) { x.removeAttribute('id'); });
      // ganti teks: nomor → 5, judul → Album, keterangan → jumlah halaman
      var w = document.createTreeWalker(tabEl, NodeFilter.SHOW_TEXT), node, teks = [];
      while ((node = w.nextNode())) if (node.nodeValue.trim()) teks.push(node);
      var judulKe = -1;
      teks.forEach(function (n, i) {
        var v = n.nodeValue.trim();
        if (/^\d+$/.test(v) && judulKe < 0) n.nodeValue = n.nodeValue.replace(v, t.nomor);
        else if (judulKe < 0) { n.nodeValue = n.nodeValue.replace(v, 'Album'); judulKe = i; }
        else n.nodeValue = n.nodeValue.replace(v, keteranganTab());
      });
      if (teks.length && judulKe === teks.length - 1) teks[judulKe].parentNode.appendChild(document.createTextNode(''));
      // hapus kelas "aktif" bila tab acuan kebetulan sedang aktif
      ['on', 'active', 'aktif', 'sel', 'selected', 'is-active', 'current', 'hidden'].forEach(function (c) { tabEl.classList.remove(c); });
      tabEl.hidden = false;
      tabEl.removeAttribute('data-t');           // jangan ikut ditangani skrip tab galeri
      if (tabEl.tagName === 'A') tabEl.removeAttribute('href');
      tabEl.onclick = function (e) { e.preventDefault(); e.stopPropagation(); buka(); };
      t.acuan.parentNode.insertBefore(tabEl, t.acuan.nextSibling);
      if (/[#&]album\b/.test(location.hash)) buka();
    }
    function keteranganTab() {
      if (D.otomatis) return D.draf.halaman.length + ' halaman · draf awal';
      if (D.status === ST.SETUJU) return '✓ Disetujui';
      if (D.status === ST.REVISI) return 'Revisi dikirim';
      return 'Menunggu persetujuan';
    }
    function buka() {
      if (!box) gambar();
      box.hidden = false; document.documentElement.style.overflow = 'hidden';
      box.scrollTop = 0; var b = box.querySelector('[data-tutup]'); if (b) b.focus();
    }
    function tutup() { if (box) box.hidden = true; document.documentElement.style.overflow = ''; if (tabEl) tabEl.focus(); }
    function gambar() {
      var d = D.draf, setuju = D.status === ST.SETUJU, revisi = D.status === ST.REVISI, lihat = D.otomatis || setuju || revisi;
      if (!box) {
        box = el('<section class="alb-kl alb mode-tab" role="dialog" aria-modal="true" aria-label="Album"></section>');
        document.body.appendChild(box);
        box.addEventListener('keydown', function (e) { if (e.key === 'Escape') tutup(); });
      }
      var info = D.otomatis ? '<div class="info">Ini <b>susunan awal otomatis</b> dari ' + D.foto.length + ' foto pilihan album Anda. Studio akan merapikannya, lalu mengirim versi final ke tab ini untuk Anda setujui.</div>' :
        setuju ? '<div class="info" style="border-color:#bfe3c9;background:#eef8f1">✓ Anda sudah menyetujui album ini. Studio akan mengirimnya ke percetakan.</div>' :
        revisi ? '<div class="info" style="border-color:#f1c9c5;background:#fdf1f0">Permintaan revisi Anda sudah terkirim. Studio akan memperbarui draf ini, lalu Anda bisa melihatnya lagi di sini.</div>' : '';
      box.innerHTML = '<div class="khd"><button type="button" class="kembali" data-tutup>← Kembali ke galeri</button><span>Album · ' + d.ukuran.w + '×' + d.ukuran.h + ' cm</span></div>' +
        '<div class="wrap"><div class="eyebrow">' + (D.otomatis ? 'Draf awal album' : 'Draf album') + '</div><h2>' + esc(D.nama) + '</h2>' +
        '<p class="lead">' + d.halaman.length + ' halaman. ' + (lihat ? 'Gulir untuk melihat setiap halaman.' : 'Lihat setiap halaman. Jika ada yang ingin diubah, ketuk <b>Catatan</b> di halaman itu, lalu kirim <b>Minta revisi</b>. Jika sudah pas, tekan <b>Setujui album</b>.') + '</p>' + info +
        '<div data-hal></div></div>' +
        (lihat ? '' : '<div class="kbar"><div class="in"><button type="button" data-k="revisi">Minta revisi</button><button type="button" class="utama" data-k="setuju">Setujui album</button></div><div class="err" data-err style="text-align:center"></div></div>');
      var wrap = box.querySelector('[data-hal]');
      d.halaman.forEach(function (hal, i) {
        wrap.appendChild(el('<div class="nohal"><span>Halaman ' + (i + 1) + ' dari ' + d.halaman.length + '</span>' + (lihat ? '' : '<button type="button" class="ctt" data-c="' + i + '">Catatan</button>') + '</div>'));
        wrap.appendChild(halamanEl(d, hal, { res: 1200 }));
        if (!lihat) wrap.appendChild(el('<div data-ct="' + i + '" hidden><textarea aria-label="Catatan halaman ' + (i + 1) + '" placeholder="Contoh: ganti foto kanan atas, atau pindahkan ke halaman awal"></textarea></div>'));
      });
      box.onclick = function (e) {
        var b = e.target.closest('button'); if (!b) return;
        if (b.hasAttribute('data-tutup')) return tutup();
        if (b.dataset.c != null) { var c = box.querySelector('[data-ct="' + b.dataset.c + '"]'); c.hidden = !c.hidden; if (!c.hidden) c.querySelector('textarea').focus(); return; }
        if (b.dataset.k) kirim(b.dataset.k);
      };
    }
    function kirim(kep) {
      var cat = [];
      Array.prototype.forEach.call(box.querySelectorAll('[data-ct]'), function (c) { var v = c.querySelector('textarea').value.trim(); if (v) cat.push('Halaman ' + (+c.dataset.ct + 1) + ': ' + v); });
      var err = box.querySelector('[data-err]');
      if (kep === 'revisi' && !cat.length) {
        err.textContent = 'Ketuk "Catatan" di halaman yang ingin diubah dan tulis permintaan Anda.';
        var t = box.querySelector('[data-c]'); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      if (kep === 'setuju' && !confirm('Setujui album ini? Setelah disetujui, album akan diproses ke percetakan.' + (cat.length ? '\n\nCatatan Anda tetap dikirim ke studio.' : ''))) return;
      var bs = box.querySelectorAll('.kbar button'); Array.prototype.forEach.call(bs, function (x) { x.disabled = true; });
      err.textContent = 'Mengirim…';
      api({ action: 'albumKlienKirim', k: k, keputusan: kep, catatan: cat.join('\n') })
        .then(function (r) {
          D.status = r.status; D.catatan = r.catatan; gambar(); box.scrollTop = 0;
          if (tabEl) { var w = document.createTreeWalker(tabEl, NodeFilter.SHOW_TEXT), n, x = []; while ((n = w.nextNode())) if (n.nodeValue.trim()) x.push(n); if (x.length > 2) x[x.length - 1].nodeValue = keteranganTab(); }
        })
        .catch(function (e) { err.textContent = e.message; Array.prototype.forEach.call(bs, function (x) { x.disabled = false; }); });
    }
  }

  window.AlbumTepi = {
    LAY: LAY, kotak: kotak, susunOtomatis: susunOtomatis, pxCetak: pxCetak, gambarHalaman: gambarHalaman,
    studio: function (root, opsi) { APP = opsi.app; pasangGaya(); return Studio(root, opsi.kunci, opsi.toast); },
    klien: function (opsi) { APP = opsi.app; if (opsi.k) Klien(opsi.k, opsi); },
  };
})();
