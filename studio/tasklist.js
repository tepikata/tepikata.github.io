/* Tab "Upcoming Event" untuk Tepi Kata Studio — tampilan mengikuti tab Data Klien.
 * Sumber data:
 *  1) Server Studio (Apps Script, file Event.gs) — bisa baca & tulis spreadsheet jadwal.
 *  2) Bila server belum siap: link CSV publikasi (ditempel sekali per perangkat) — mode baca saja.
 * Link CSV TIDAK disimpan di kode website (repo publik).
 */
(function () {
  var BULAN = ['JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI', 'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER'];
  var BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  var HARI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  var KOSONG = { '': 1, '-': 1, '?': 1, '—': 1 };
  var MULAI = [2026, 11];                       // bulan pertama untuk tasklist edit
  var GITHUB = 'https://github.com/tepikata/tasklist/issues';
  var S = { data: null, bulan: null, jenis: 'jadwal', filter: '', q: '', diambil: null, edit: false, nama: [], idx: {} };
  var $ = function (id) { return document.getElementById(id); };

  function norm(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function judul(n) { n = norm(n); return (/[a-z]/.test(n) && /[A-Z]/.test(n)) ? n : n.toLowerCase().replace(/(^|[\s(/&-])(\S)/g, function (m, a, b) { return a + b.toUpperCase(); }); }
  function kosong(v) { return !!KOSONG[norm(v)]; }
  function getLink() { try { return localStorage.getItem('tasklistCsv') || ''; } catch (e) { return ''; } }
  function setLink(v) { try { localStorage.setItem('tasklistCsv', v); } catch (e) { } }
  function kunci() { try { return localStorage.getItem('studioKunci') || ''; } catch (e) { return ''; } }

  /* ---------- tanggal ---------- */
  function hariIniWITA() { var d = new Date(Date.now() + 8 * 3600e3); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); }
  function tgl(y, m, d) { return new Date(Date.UTC(y, m - 1, d)); }
  function dm(s, y) { var m = String(s || '').match(/(\d{1,2})\s*\/\s*(\d{1,2})/); return m ? tgl(y, +m[2], +m[1]) : null; }
  function hariIniDM() { var d = hariIniWITA(); return (d.getUTCDate() < 10 ? '0' : '') + d.getUTCDate() + '/' + (d.getUTCMonth() < 9 ? '0' : '') + (d.getUTCMonth() + 1); }
  function namaBulan(b) { return BULAN[b.m - 1].charAt(0) + BULAN[b.m - 1].slice(1).toLowerCase() + ' ' + b.y; }

  /* ---------- CSV ---------- */
  function parseCSV(t) {
    var rows = [], row = [], f = '', q = false;
    for (var i = 0; i < t.length; i++) {
      var c = t[i];
      if (q) { if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
      else if (c === '"') q = true;
      else if (c === ',') { row.push(f); f = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; }
      else f += c;
    }
    if (f !== '' || row.length) { row.push(f); rows.push(row); }
    return rows;
  }
  function bacaJadwal(rows) {
    var thn = new Date().getFullYear();
    rows.slice(0, 3).forEach(function (r) { var m = r.join(' ').toUpperCase().match(/UPCOMING EVENT (20\d\d)/); if (m) thn = +m[1]; });
    var out = {}, cur = null, lastMon = 0;
    rows.forEach(function (r) {
      var c = r.map(norm), u = c.map(function (x) { return x.toUpperCase(); });
      if (u.indexOf('PROSESI') >= 0) {
        var mon = 0, yr = thn, explicit = false;
        for (var i = 0; i < 3 && !mon; i++) {
          BULAN.forEach(function (b, k) { if (!mon && u[i] && u[i].indexOf(b) === 0) mon = k + 1; });
          var y = (u[i] || '').match(/20\d\d/); if (mon && y) { yr = +y[0]; explicit = true; }
        }
        if (!mon) { cur = null; return; }
        if (!explicit && mon < lastMon) yr = thn + 1;
        if (explicit) thn = yr;
        lastMon = mon;
        var col = {}; u.forEach(function (n, k) { if (n && !(n in col)) col[n] = k; });
        var jam = null; u.forEach(function (n, k) { if (jam == null && k > 1 && /^JAM/.test(n)) jam = k; });
        cur = { y: yr, m: mon, col: col, ed: ('EDITOR FOTO' in col), jam: jam };
        return;
      }
      if (!cur) return;
      var g = function (n) { var k = cur.col[n]; return k == null ? '' : (c[k] || ''); };
      var day = parseInt(c[1], 10), pr = g('PROSESI');
      if (!day || !pr || /WEEKLY|BRIEF/i.test(pr)) return;
      var key = cur.y + '-' + (cur.m < 10 ? '0' : '') + cur.m;
      var bln = out[key] = out[key] || { y: cur.y, m: cur.m, ed: false, ev: [] };
      bln.ed = bln.ed || cur.ed;
      bln.ev.push({
        day: day, pr: pr, vg: g('VG'), fg1: g('FG 1'), fg2: g('FG 2'), sup: g('SUPPORT'), jam: cur.jam == null ? '' : (c[cur.jam] || ''),
        ed: cur.ed, edF: g('EDITOR FOTO'), dlF: g('DEADLINE EDIT FOTO'), okF: g('TGL SELESAI EDIT FOTO'),
        edV: g('EDITOR VIDEO'), okV: g('TGL SELESAI EDIT VIDEO'), ket: g('KETERANGAN LAIN')
      });
    });
    return out;
  }

  /* ---------- server Studio ---------- */
  function api(body) {
    body.key = kunci();
    return fetch(window.APP, { method: 'POST', body: JSON.stringify(body) })
      .catch(function () { throw new Error('tidak_tersedia'); })
      .then(function (r) { return r.text(); })
      .then(function (t) { var j; try { j = JSON.parse(t); } catch (e) { throw new Error('tidak_tersedia'); } if (!j.ok) throw new Error(j.error || 'Gagal'); return j.data; });
  }
  function dariApi(d) {
    var out = {}; S.idx = {};
    d.bulan.forEach(function (b) {
      var key = b.y + '-' + (b.m < 10 ? '0' : '') + b.m;
      var bl = out[key] = { y: b.y, m: b.m, ed: b.ed, ev: b.ev.filter(function (e) { return !/WEEKLY|BRIEF/i.test(e.pr); }) };
      bl.ev.forEach(function (e) { e.ed = b.ed; S.idx[e.row] = { e: e, b: bl }; });
    });
    S.nama = d.nama || [];
    return out;
  }

  /* ---------- model ---------- */
  function tim(e) {
    var p = [], fg = [e.fg1, e.fg2].filter(function (x) { return !kosong(x); }).map(judul);
    if (fg.length) p.push('FG ' + fg.join(', '));
    if (!kosong(e.vg)) p.push('VG ' + judul(e.vg));
    if (!kosong(e.sup)) p.push('Support ' + judul(e.sup));
    return p;
  }
  function tugas(b, jenis, today) {
    var list = [];
    b.ev.forEach(function (e) {
      if (!e.ed) return;
      var lewat = tgl(b.y, b.m, e.day) < today, foto = jenis === 'foto';
      if (!foto && kosong(e.vg) && kosong(e.edV)) return;
      var ed = foto ? e.edF : e.edV, ok = foto ? e.okF : e.okV;
      var t = { e: e, row: e.row, j: jenis, day: e.day, pr: e.pr, ed: kosong(ed) ? '' : judul(ed), ok: !kosong(ok), okTgl: kosong(ok) ? '' : ok,
        dl: foto ? dm(e.dlF, b.y) : null, lewat: lewat, vg: kosong(e.vg) ? '' : judul(e.vg) };
      t.st = t.ok ? 'selesai' : !lewat ? 'nanti' : !t.ed ? 'tanpa' : 'proses';
      t.telat = !t.ok && t.dl && t.dl < today;
      list.push(t);
    });
    return list.sort(function (a, z) { return a.day - z.day; });
  }

  /* ---------- render ---------- */
  function cocok(text) { return !S.q || text.toLowerCase().indexOf(S.q.toLowerCase()) >= 0; }

  function render() {
    if (!S.data) return;
    if ($('tlNama')) $('tlNama').innerHTML = S.nama.map(function (n) { return '<option value="' + esc(n) + '">'; }).join('');
    var today = hariIniWITA(), ymNow = today.getUTCFullYear() * 100 + today.getUTCMonth() + 1, isJ = S.jenis === 'jadwal';
    var keys = Object.keys(S.data).filter(function (k) {
      var b = S.data[k], ym = b.y * 100 + b.m;
      return isJ ? ym >= ymNow : (b.ed && ym >= MULAI[0] * 100 + MULAI[1]);
    }).sort();
    Array.prototype.forEach.call($('tlJenis').children, function (bt) { bt.classList.toggle('on', bt.getAttribute('data-j') === S.jenis); });
    if (!keys.length) {
      $('tlBulan').innerHTML = ''; $('tlSum').innerHTML = '';
      $('tlList').innerHTML = '<div class="empty">' + (isJ ? 'Belum ada event mendatang di spreadsheet.' : 'Belum ada bulan dengan kolom EDITOR FOTO di spreadsheet.') + '</div>' + kaki();
      return;
    }
    if (!S.bulan || keys.indexOf(S.bulan) < 0) {
      var now = today.getUTCFullYear() + '-' + (today.getUTCMonth() < 9 ? '0' : '') + (today.getUTCMonth() + 1);
      S.bulan = keys.indexOf(now) >= 0 ? now : keys[0];
    }
    $('tlBulan').innerHTML = keys.map(function (k) {
      var b = S.data[k], n = isJ ? b.ev.length : tugas(b, S.jenis, today).length;
      return '<button type="button" data-k="' + k + '" class="' + (k === S.bulan ? 'on' : '') + '">' + namaBulan(b) + '<span>' + n + '</span></button>';
    }).join('');
    Array.prototype.forEach.call($('tlBulan').children, function (bt) { bt.onclick = function () { S.bulan = bt.getAttribute('data-k'); S.filter = ''; render(); }; });
    (isJ ? renderJadwal : renderTugas)(S.data[S.bulan], today);
  }

  function ringkas(items) {      // items: [[filterKey, angka, label, peringatan]]
    $('tlSum').innerHTML = items.map(function (x) {
      return '<button type="button" data-f="' + x[0] + '" class="' + (S.filter === x[0] ? 'on' : '') + (x[3] ? ' warn' : '') + '"><b>' + x[1] + '</b><span>' + x[2] + '</span></button>';
    }).join('');
    Array.prototype.forEach.call($('tlSum').children, function (bt) { bt.onclick = function () { var f = bt.getAttribute('data-f'); S.filter = S.filter === f ? '' : f; render(); }; });
  }

  function renderJadwal(b, today) {
    var ev = b.ev.slice().sort(function (a, z) { return a.day - z.day; });
    var st = function (e) { var d = tgl(b.y, b.m, e.day); return +d === +today ? 'hari' : d > today ? 'nanti' : 'lewat'; };
    var n = { nanti: 0, hari: 0, lewat: 0 }; ev.forEach(function (e) { n[st(e)]++; });
    ringkas([['nanti', n.nanti, 'Akan datang'], ['hari', n.hari, 'Hari ini'], ['lewat', n.lewat, 'Sudah lewat']]);
    var rows = ev.filter(function (e) {
      return (!S.filter || st(e) === S.filter) && cocok(e.pr + ' ' + tim(e).join(' ') + ' ' + e.jam);
    });
    if (!S.filter && !S.q) rows = rows.filter(function (e) { return st(e) !== 'lewat'; }).concat(rows.filter(function (e) { return st(e) === 'lewat'; }));
    var h = S.edit ? '<button type="button" class="item add" id="tlTambah"><span class="plus">＋</span><span class="main"><span class="nm">Tambah event</span><span class="meta">Masuk ke ' + namaBulan(b) + ' di spreadsheet</span></span></button>' : '';
    h += rows.map(function (e) {
      var d = tgl(b.y, b.m, e.day), s = st(e), t = tim(e);
      var pill = s === 'hari' ? '<span class="pill s1">Hari ini</span>' : s === 'lewat' ? '<span class="pill s2">Selesai</span>' : (t.length ? '' : '<span class="pill s0">Tim belum diisi</span>');
      var meta = [];
      if (!kosong(e.jam)) meta.push('<span>' + esc(e.jam) + '</span>');
      t.forEach(function (x) { meta.push('<span class="tag">' + esc(x) + '</span>'); });
      return '<' + (S.edit ? 'button type="button"' : 'div') + ' class="item ev' + (s === 'lewat' ? ' past' : '') + (s === 'hari' ? ' today' : '') + '" data-row="' + (e.row || '') + '">' +
        '<span class="date"><b>' + e.day + '</b><small>' + HARI[d.getUTCDay()] + '</small></span>' +
        '<span class="main"><span class="nm">' + esc(judul(e.pr)) + '</span>' + (meta.length ? '<span class="meta">' + meta.join('') + '</span>' : '') + '</span>' + pill +
        '</' + (S.edit ? 'button' : 'div') + '>';
    }).join('');
    if (!rows.length) h += '<div class="empty">Tidak ada event' + (S.q ? ' yang cocok.' : '.') + '</div>';
    $('tlList').innerHTML = h + kaki();
  }

  function renderTugas(b, today) {
    var t = tugas(b, S.jenis, today);
    var c = { tanpa: 0, proses: 0, selesai: 0 }, telat = 0;
    t.forEach(function (x) { if (c[x.st] != null) c[x.st]++; if (x.telat) telat++; });
    ringkas([['tanpa', c.tanpa, 'Belum ada editor', c.tanpa > 0], ['proses', c.proses, telat ? 'Dikerjakan · ' + telat + ' telat' : 'Dikerjakan', telat > 0], ['selesai', c.selesai, 'Selesai']]);
    var rows = t.filter(function (x) { return (!S.filter || x.st === S.filter) && cocok(x.pr + ' ' + x.ed + ' ' + x.vg); });
    var urut = { tanpa: 0, proses: 1, selesai: 2, nanti: 3 };
    rows.sort(function (a, z) { return (urut[a.st] - urut[z.st]) || ((z.telat ? 1 : 0) - (a.telat ? 1 : 0)) || a.day - z.day; });
    var judulGrup = { tanpa: 'Belum ada editor', proses: 'Dikerjakan', selesai: 'Selesai', nanti: 'Event akan datang' };
    var h = '', last = '';
    rows.forEach(function (x) {
      if (x.st !== last) { last = x.st; h += '<h3 class="grp">' + judulGrup[x.st] + '</h3>'; }
      var pill = x.ok ? '<span class="pill s2">Selesai' + (x.okTgl ? ' ' + esc(x.okTgl) : '') + '</span>'
        : x.telat ? '<span class="pill s3">Lewat deadline</span>'
        : x.st === 'tanpa' ? '<span class="pill s0">Belum ada editor</span>'
        : x.st === 'proses' ? '<span class="pill s1">Dikerjakan</span>' : '<span class="pill s0">Akan datang</span>';
      var meta = ['<span class="tag">' + x.day + ' ' + BLN[b.m - 1] + '</span>'];
      if (x.ed) meta.push('<span>' + (S.jenis === 'foto' ? '📷 ' : '🎬 ') + esc(x.ed) + '</span>');
      else if (x.vg && S.jenis === 'video') meta.push('<span>VG ' + esc(x.vg) + '</span>');
      if (x.dl && !x.ok) meta.push('<span' + (x.telat ? ' class="late"' : '') + '>Deadline ' + x.dl.getUTCDate() + ' ' + BLN[x.dl.getUTCMonth()] + '</span>');
      var cek = S.edit ? '<span class="cek' + (x.ok ? ' on' : '') + '" data-cek="1" role="checkbox" aria-checked="' + x.ok + '" aria-label="Tandai selesai">' + (x.ok ? '✓' : '') + '</span>' : '';
      h += '<' + (S.edit ? 'button type="button"' : 'div') + ' class="item' + (x.ok ? ' done' : '') + '" data-row="' + (x.row || '') + '" data-j="' + x.j + '">' + cek +
        '<span class="main"><span class="nm">' + esc(judul(x.pr)) + '</span><span class="meta">' + meta.join('') + '</span></span>' + pill +
        '</' + (S.edit ? 'button' : 'div') + '>';
    });
    if (!rows.length) h += '<div class="empty">Tidak ada tugas' + (S.q || S.filter ? ' yang cocok.' : ' di bulan ini.') + '</div>';
    $('tlList').innerHTML = h + kaki();
  }

  function kaki() {
    return '<p class="note foot">' + (S.edit ? 'Ketuk kartu untuk mengisi · tersimpan langsung ke spreadsheet' : 'Mode baca saja') +
      (S.diambil ? ' · dimuat ' + S.diambil : '') + '<br><a href="' + GITHUB + '" target="_blank" rel="noopener">Tasklist di GitHub</a>' +
      (S.edit ? '' : ' · <button type="button" class="linkbtn" id="tlGanti">Ganti link spreadsheet</button>') + '</p>';
  }

  /* ---------- muat ---------- */
  function memuat() { $('tlList').innerHTML = '<div class="spin"></div>'; }
  function muat() {
    memuat();
    if (window.APP && kunci()) {
      $('tlSetup').classList.add('hidden'); $('tlUtama').classList.remove('hidden');
      api({ action: 'data' }).then(function (d) { S.data = dariApi(d); S.edit = true; S.diambil = d.waktu; render(); kbStatus(); })
        .catch(function (err) { if (err.message !== 'tidak_tersedia') { gagal(err.message, muat); return; } muatCsv(); });
      return;
    }
    muatCsv();
  }
  function gagal(msg, ulang) {
    $('tlList').innerHTML = '<div class="empty">' + esc(msg) + '<div class="row center"><button type="button" class="btn primary" id="tlUlang">Coba lagi</button>' +
      (ulang === muatCsv ? '<button type="button" class="btn" id="tlGanti2">Ganti link</button>' : '') + '</div><a href="' + GITHUB + '" target="_blank" rel="noopener">Buka tasklist di GitHub</a></div>';
    $('tlUlang').onclick = ulang; if ($('tlGanti2')) $('tlGanti2').onclick = gantiLink;
  }
  function muatCsv() {
    S.edit = false;
    var link = getLink();
    $('tlSetup').classList.toggle('hidden', !!link);
    $('tlUtama').classList.toggle('hidden', !link);
    if (!link) return;
    memuat();
    fetch(link, { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); }).then(function (txt) {
      if (/^\s*</.test(txt)) throw new Error('bukan CSV');
      S.data = bacaJadwal(parseCSV(txt)); kbStatus();
      var d = new Date(); S.diambil = (d.getHours() < 10 ? '0' : '') + d.getHours() + '.' + (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
      render();
    }).catch(function () { gagal('Spreadsheet tidak bisa dimuat. Periksa koneksi, atau pastikan link CSV masih dipublikasikan.', muatCsv); });
  }
  function gantiLink() { setLink(''); S.data = null; muatCsv(); }

  /* ---------- isi dari aplikasi ---------- */
  var tT; function toast(m) { var t = $('tlToast'); t.textContent = m; t.classList.add('show'); clearTimeout(tT); tT = setTimeout(function () { t.classList.remove('show'); }, 2600); }
  function simpan(e, fields, pesan) {
    var lama = {}; Object.keys(fields).forEach(function (k) { lama[k] = e[k]; e[k] = fields[k]; });
    render(); toast('Menyimpan…');
    return api({ action: 'ubah', row: e.row, pr: e.pr, fields: fields }).then(function () { toast(pesan || 'Tersimpan ke spreadsheet'); })
      .catch(function (err) { Object.keys(lama).forEach(function (k) { e[k] = lama[k]; }); render(); toast(err.message); });
  }
  var FORM = [
    ['Jadwal & tim', [['jam', 'Jam / tempat'], ['fg1', 'FG 1', 1], ['fg2', 'FG 2', 1], ['vg', 'VG', 1], ['sup', 'Support', 1]]],
    ['Edit foto', [['edF', 'Editor foto', 1], ['dlF', 'Deadline edit foto (tgl/bln)'], ['okF', 'Tgl selesai edit foto (tgl/bln)']]],
    ['Edit video', [['edV', 'Editor video', 1], ['okV', 'Tgl selesai edit video (tgl/bln)']]],
    ['Lainnya', [['ket', 'Keterangan']]]
  ];
  function bukaSheet(h) { $('tlSheet').innerHTML = '<div class="grab"></div>' + h; $('tlOv').classList.remove('hidden'); document.body.style.overflow = 'hidden'; }
  function tutup() { $('tlOv').classList.add('hidden'); document.body.style.overflow = ''; }
  function bukaEditor(row) {
    var r = S.idx[row]; if (!r) return;
    var e = r.e, b = r.b, d = tgl(b.y, b.m, e.day), urutan = S.jenis === 'video' ? [2, 0, 1, 3] : S.jenis === 'foto' ? [1, 0, 2, 3] : [0, 1, 2, 3];
    var h = '<h2>' + esc(judul(e.pr)) + '</h2><p class="note">' + HARI[d.getUTCDay()] + ', ' + e.day + ' ' + namaBulan(b) + '</p><form id="tlEd">';
    urutan.forEach(function (gi) {
      var g = FORM[gi];
      h += '<div class="box"><h3>' + g[0] + '</h3>';
      g[1].forEach(function (f) {
        var id = 'tlf_' + f[0], btn = /^ok/.test(f[0]) ? '<button type="button" class="btn" data-today="' + id + '">Hari ini</button>' : '';
        h += '<label class="f" for="' + id + '">' + f[1] + '</label><div class="inrow"><input class="inp" id="' + id + '" name="' + f[0] + '" value="' + esc(e[f[0]] || '') + '"' + (f[2] ? ' list="tlNama"' : '') + ' autocomplete="off">' + btn + '</div>';
      });
      h += '</div>';
    });
    h += '<div class="row"><button type="button" class="btn grow" id="tlBatal">Batal</button><button type="submit" class="btn primary grow">Simpan</button></div></form>';
    bukaSheet(h);
    Array.prototype.forEach.call($('tlSheet').querySelectorAll('[data-today]'), function (bt) { bt.onclick = function () { $(bt.getAttribute('data-today')).value = hariIniDM(); }; });
    $('tlBatal').onclick = tutup;
    $('tlEd').onsubmit = function (ev) {
      ev.preventDefault();
      var ubah = {}, n = 0;
      Array.prototype.forEach.call($('tlEd').querySelectorAll('input'), function (i) { var v = norm(i.value); if (v !== norm(e[i.name])) { ubah[i.name] = v; n++; } });
      tutup(); if (n) simpan(e, ubah);
    };
  }
  function bukaTambah() {
    var b = S.data[S.bulan];
    bukaSheet('<h2>Tambah event</h2><p class="note">' + namaBulan(b) + '</p><form id="tlAdd"><div class="box">' +
      '<label class="f" for="tla_day">Tanggal</label><input class="inp" id="tla_day" type="number" min="1" max="31" inputmode="numeric" required>' +
      '<label class="f" for="tla_pr">Prosesi (contoh: Akad Resepsi Nama &amp; Nama)</label><input class="inp" id="tla_pr" required autocomplete="off">' +
      '<label class="f" for="tla_jam">Jam / tempat</label><input class="inp" id="tla_jam" autocomplete="off"></div>' +
      '<div class="row"><button type="button" class="btn grow" id="tlBatal">Batal</button><button type="submit" class="btn primary grow">Tambahkan</button></div></form>');
    $('tlBatal').onclick = tutup;
    $('tlAdd').onsubmit = function (ev) {
      ev.preventDefault();
      var q = { action: 'tambah', y: b.y, m: b.m, day: $('tla_day').value, pr: norm($('tla_pr').value), jam: norm($('tla_jam').value) };
      tutup(); toast('Menambahkan…');
      api(q).then(function () { toast('Event ditambahkan ke spreadsheet'); muat(); }).catch(function (err) { toast(err.message); });
    };
  }
  function klik(ev) {
    if (ev.target.id === 'tlGanti') { gantiLink(); return; }
    if (!S.edit) return;
    if (ev.target.closest('#tlTambah')) { bukaTambah(); return; }
    var it = ev.target.closest('[data-row]'); if (!it || !it.getAttribute('data-row')) return;
    var row = +it.getAttribute('data-row'), j = it.getAttribute('data-j');
    if (j && ev.target.closest('[data-cek]')) {
      var e = S.idx[row].e, k = j === 'foto' ? 'okF' : 'okV', f = {};
      f[k] = kosong(e[k]) ? hariIniDM() : '';
      simpan(e, f, f[k] ? 'Ditandai selesai ' + f[k] : 'Tanda selesai dihapus');
      return;
    }
    bukaEditor(row);
  }

  /* ---------- tab Klien Baru ---------- */
  var JENIS = ['Lamaran', 'Mappettuada', 'Pengajian', 'Siraman', 'Mappacci', 'Siraman Mappacci', 'Akad', 'Resepsi', 'Akad Resepsi', 'Mapparola', 'Pemberkatan', 'Pemberkatan Resepsi', 'Prewed', 'Wedding', 'Event'];
  var kbN = 0;
  function kbSesi(isi) {
    isi = isi || {}; kbN++;
    var id = 'kb' + kbN, el = document.createElement('div');
    el.className = 'box kb-sesi'; el.setAttribute('data-sesi', id);
    var f = function (k, label, tipe, list, ph) {
      return '<label class="f" for="' + id + k + '">' + label + '</label><input class="inp" id="' + id + k + '" data-k="' + k + '" type="' + (tipe || 'text') + '"' +
        (list ? ' list="' + list + '"' : '') + (ph ? ' placeholder="' + ph + '"' : '') + ' autocomplete="off" value="' + esc(isi[k] || '') + '">';
    };
    el.innerHTML = '<div class="kb-hd"><h3>Sesi</h3><button type="button" class="linkbtn" data-hapus="1">Hapus</button></div>' +
      f('jenis', 'Prosesi', 'text', 'kbJenis', 'Pilih atau ketik, mis. Akad Resepsi') +
      '<div class="kb-2">' + '<div>' + f('tgl', 'Tanggal', 'date') + '</div><div>' + f('jam', 'Jam / tempat', 'text', '', 'mis. 08.00 / Gedung') + '</div></div>' +
      '<div class="kb-2"><div>' + f('fg1', 'FG 1', 'text', 'tlNama') + '</div><div>' + f('fg2', 'FG 2', 'text', 'tlNama') + '</div></div>' +
      '<div class="kb-2"><div>' + f('vg', 'VG', 'text', 'tlNama') + '</div><div>' + f('sup', 'Support', 'text', 'tlNama') + '</div></div>';
    $('kbDaftar').appendChild(el);
    kbNomor();
  }
  function kbNomor() {
    var all = $('kbDaftar').querySelectorAll('[data-sesi]');
    Array.prototype.forEach.call(all, function (el, i) { el.querySelector('h3').textContent = 'Sesi ' + (i + 1); el.querySelector('[data-hapus]').classList.toggle('hidden', all.length < 2); });
  }
  var KB_DITUNDA = true; // spreadsheet jadwal pindah ke Dashboard Operasional — penyimpanan menunggu penyesuaian tab EVENT DATA
  function kbStatus() {
    if (!$('kbInfo')) return;
    if (KB_DITUNDA) { $('kbInfo').classList.remove('hidden'); $('kbKirim').disabled = true; return; }
    $('kbInfo').classList.toggle('hidden', !!S.edit || !S.data);
    $('kbKirim').disabled = !S.edit;
  }
  function kbReset() { $('kbForm').reset(); $('kbDaftar').innerHTML = ''; kbSesi(); }
  function kbKirim(ev) {
    ev.preventDefault();
    var nama = norm($('kbNama').value), sesi = [], salah = '';
    Array.prototype.forEach.call($('kbDaftar').querySelectorAll('[data-sesi]'), function (el, i) {
      var x = {}; Array.prototype.forEach.call(el.querySelectorAll('[data-k]'), function (inp) { x[inp.getAttribute('data-k')] = norm(inp.value); });
      if (!x.jenis && !salah) salah = 'Isi prosesi untuk sesi ' + (i + 1) + '.';
      if (!x.tgl && !salah) salah = 'Isi tanggal untuk sesi ' + (i + 1) + '.';
      sesi.push(x);
    });
    if (!nama) salah = 'Isi nama klien.';
    if (salah) { toast(salah); return; }
    var bt = $('kbKirim'); bt.disabled = true; bt.textContent = 'Menyimpan…';
    api({ action: 'tambahKlien', nama: nama, sesi: sesi, ket: norm($('kbKet').value) }).then(function (r) {
      bt.disabled = false; bt.textContent = 'Simpan ke jadwal';
      toast(nama + ' ditambahkan (' + sesi.length + ' sesi)');
      kbReset();
      S.bulan = r.bulan; S.jenis = 'jadwal'; S.filter = ''; S.data = null;
      if (window.pilihTab) window.pilihTab('event'); else muat();
    }).catch(function (err) {
      bt.disabled = false; bt.textContent = 'Simpan ke jadwal';
      toast(err.message === 'tidak_tersedia' ? 'Belum aktif: pasang Event.gs dulu (halaman bantuan bagian 6).' : err.message);
    });
  }
  window.KlienBaru = {
    init: function () {
      var dl = document.createElement('datalist'); dl.id = 'kbJenis';
      dl.innerHTML = JENIS.map(function (j) { return '<option value="' + j + '">'; }).join(''); document.body.appendChild(dl);
      $('kbTambahSesi').onclick = function () { kbSesi(); };
      $('kbDaftar').addEventListener('click', function (e) { if (e.target.closest('[data-hapus]')) { e.target.closest('[data-sesi]').remove(); kbNomor(); } });
      $('kbForm').onsubmit = kbKirim;
      kbSesi();
    },
    tampil: function () { if (!KB_DITUNDA && !S.data) muat(); kbStatus(); }
  };

  window.TasklistTab = {
    init: function () {
      $('tlForm').onsubmit = function (e) {
        e.preventDefault();
        var v = norm($('tlLink').value);
        if (!/^https:\/\/docs\.google\.com\/spreadsheets\/.+output=csv/.test(v)) { $('tlErr').textContent = 'Link tidak dikenali. Gunakan link CSV dari "Publikasikan ke web" (berakhiran output=csv).'; return; }
        setLink(v); $('tlErr').textContent = ''; muatCsv();
      };
      Array.prototype.forEach.call($('tlJenis').children, function (bt) { bt.onclick = function () { S.jenis = bt.getAttribute('data-j'); S.filter = ''; render(); }; });
      $('tlRefresh').onclick = muat;
      $('tlQ').oninput = function (e) { S.q = e.target.value; render(); };
      var ov = document.createElement('div'); ov.id = 'tlOv'; ov.className = 'tls ov hidden';
      ov.innerHTML = '<div class="sheet" id="tlSheet" role="dialog" aria-modal="true"></div>';
      ov.onclick = function (e) { if (e.target === ov) tutup(); };
      document.body.appendChild(ov);
      var dl = document.createElement('datalist'); dl.id = 'tlNama'; document.body.appendChild(dl);
      var ts = document.createElement('div'); ts.id = 'tlToast'; ts.className = 'tls toast'; document.body.appendChild(ts);
      $('tlList').addEventListener('click', klik);
    },
    tampil: function () { if (!S.data) muat(); }
  };
})();
