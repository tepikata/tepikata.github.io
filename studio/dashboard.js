/* Tab Upcoming Event, Tugas Foto, Tugas Video — dari spreadsheet "TEPIKATA - Dashboard Operasional".
 * Dibaca lewat server Studio (Apps Script, Event.gs → action "dashboard").
 * Tugas Foto & Tugas Video bisa diubah dari aplikasi (Event.gs → "dbUbah" / "dbTambahVideo"):
 *   foto  → tab EVENT DATA (Editor foto, Status foto, Tgl selesai foto)
 *   video → tab TUGAS VIDEO (Jenis tugas, Sesi, Penanggung jawab, Status, Tanggal selesai, Catatan)
 * Kolom dicari berdasarkan NAMA judul, jadi aman bila urutan kolom di spreadsheet berubah.
 */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var HARI = { Senin: 'Sen', Selasa: 'Sel', Rabu: 'Rab', Kamis: 'Kam', Jumat: 'Jum', "Jum'at": 'Jum', Sabtu: 'Sab', Minggu: 'Min' };
  var PERLU_SERVER = 'Server Studio belum diperbarui untuk Dashboard Operasional. Pasang Event.gs terbaru (halaman bantuan, bagian 6).';
  var D = null, memuat = null, diambil = '';
  var F = { event: { f: '', q: '' }, foto: { f: '', ed: '', q: '' }, video: { f: '', pj: '', q: '' } };
  var LIST = { foto: [], video: [] };   // baris yang sedang tampil (untuk dibuka saat kartu diketuk)
  var aktif = 'event';

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function kunci() { try { return localStorage.getItem('studioKunci') || ''; } catch (e) { return ''; } }
  function g(o, nama) {            // ambil nilai kolom berdasarkan nama (tidak peka huruf besar/kecil)
    if (!o) return '';
    var k = Object.keys(o).find(function (x) { return x.toLowerCase() === nama.toLowerCase(); });
    return k ? o[k] : '';
  }
  function info(tab, label) {
    var x = (tab.info || []).find(function (p) { return p[0].toLowerCase().indexOf(label.toLowerCase()) === 0; });
    return x ? x[1] : '';
  }
  function cocok(q, s) { return !q || s.toLowerCase().indexOf(q.toLowerCase()) >= 0; }
  function isi(v) { return v && !/^[-?—]$/.test(v); }
  function bisaUbah() { return !!(D && D.bisaUbah); }

  /* ---------- tanggal ---------- */
  function hariIniISO() { var d = new Date(Date.now() + 8 * 3600e3); return d.toISOString().slice(0, 10); }   // WITA
  function keISO(s) {             // "17/11" atau "17/11/2026" → "2026-11-17"
    var m = String(s || '').match(/(\d{1,2})\s*\/\s*(\d{1,2})(?:\s*\/\s*(\d{2,4}))?/);
    if (!m) return '';
    var y = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : +hariIniISO().slice(0, 4);
    return y + '-' + (+m[2] < 10 ? '0' : '') + (+m[2]) + '-' + (+m[1] < 10 ? '0' : '') + (+m[1]);
  }
  function keDM(iso) { var m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? m[3] + '/' + m[2] : ''; }

  /* ---------- data ---------- */
  function api(body) {
    body.key = kunci();
    return fetch(window.APP, { method: 'POST', body: JSON.stringify(body) })
      .catch(function () { throw new Error('Tidak bisa terhubung. Periksa koneksi internet.'); })
      .then(function (r) { return r.text(); })
      .then(function (t) {
        var j; try { j = JSON.parse(t); } catch (e) { throw new Error(PERLU_SERVER); }
        if (!j.ok) throw new Error(/Unknown|tidak dikenal/i.test(j.error) ? PERLU_SERVER : j.error);
        return j.data;
      });
  }
  function ambil(paksa) {
    if (D && !paksa) return Promise.resolve(D);
    if (memuat && !paksa) return memuat;
    memuat = api({ action: 'dashboard' }).then(function (data) {
      D = data; var d = new Date(); diambil = (d.getHours() < 10 ? '0' : '') + d.getHours() + '.' + (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
      return D;
    });
    memuat.catch(function () { memuat = null; });
    return memuat;
  }

  /* ---------- bagian umum ---------- */
  function ringkas(id, items, view) {
    $(id).innerHTML = items.map(function (x) {
      return '<button type="button" data-f="' + x[0] + '" class="' + (F[view].f === x[0] ? 'on' : '') + (x[3] ? ' warn' : '') + '"' + (x[0] ? '' : ' disabled') + '><b>' + esc(x[1]) + '</b><span>' + esc(x[2]) + '</span></button>';
    }).join('');
    Array.prototype.forEach.call($(id).children, function (bt) {
      bt.onclick = function () { var f = bt.getAttribute('data-f'); if (!f) return; F[view].f = F[view].f === f ? '' : f; tampilkan(view); };
    });
  }
  function chips(id, label, nilai, aktifNilai, view, key) {
    if (nilai.length < 2) { $(id).innerHTML = ''; return; }
    $(id).innerHTML = '<span class="chiplbl">' + label + '</span>' + ['Semua'].concat(nilai).map(function (n) {
      var v = n === 'Semua' ? '' : n;
      return '<button type="button" data-v="' + esc(v) + '" class="' + (aktifNilai === v ? 'on' : '') + '">' + esc(n) + '</button>';
    }).join('');
    Array.prototype.forEach.call($(id).querySelectorAll('button'), function (bt) { bt.onclick = function () { F[view][key] = bt.getAttribute('data-v'); tampilkan(view); }; });
  }
  function kaki(view) {
    var ubah = bisaUbah() && (view === 'foto' || view === 'video');
    return '<p class="note foot">' + (ubah ? 'Ketuk kartu untuk mengisi · tersimpan langsung ke spreadsheet' : 'Hanya baca') +
      ' · data dari spreadsheet <a href="' + esc(D.url) + '" target="_blank" rel="noopener">' + esc(D.judul) + '</a> · dimuat ' + diambil +
      (view === 'event' ? '<br>Untuk mengubah jadwal, isi langsung di spreadsheet (tab EVENT DATA).' :
        !bisaUbah() ? '<br>Untuk mengubah data, isi langsung di spreadsheet (tab EVENT DATA / TUGAS VIDEO), atau pasang Event.gs terbaru.' : '') + '</p>';
  }
  function bulanLabel(tab) { var b = info(tab, 'Bulan'); return b ? '<span class="tag">' + esc(b) + '</span>' : ''; }
  function tglBox(tgl, hari) {
    var m = String(tgl).match(/(\d{1,2})\s*\/\s*(\d{1,2})/);
    return '<span class="date"><b>' + (m ? +m[1] : esc(tgl || '–')) + '</b><small>' + esc(HARI[hari] || (hari || '').slice(0, 3)) + '</small></span>';
  }
  function linkify(s) { return esc(s).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">buka link</a>'); }
  function kartu(isiHtml, kelas, i) {        // kartu bisa diketuk bila server mendukung perubahan
    return bisaUbah() ? '<button type="button" class="item' + kelas + '" data-i="' + i + '">' + isiHtml + '</button>'
      : '<div class="item' + kelas + '">' + isiHtml + '</div>';
  }

  /* ---------- Upcoming Event ---------- */
  function viewEvent() {
    var t = D.event;
    if (!t.ada) return kosong('evList', 'Tab UPCOMING EVENT tidak ditemukan di spreadsheet.', 'event');
    $('evBulan').innerHTML = bulanLabel(t) + (info(t, 'Sesi berikutnya') ? '<span class="tag">Berikutnya: ' + esc(info(t, 'Sesi berikutnya')) + '</span>' : '');
    var rows = t.baris.filter(function (r) { return isi(g(r, 'Event')) || isi(g(r, 'Sesi')); });
    var st = function (r) { var s = g(r, 'Status').toLowerCase(); return s.indexOf('selesai') >= 0 ? 'lewat' : 'nanti'; };
    var n = { nanti: 0, lewat: 0 }; rows.forEach(function (r) { n[st(r)]++; });
    var tanpa = info(t, 'Sesi tanpa');
    ringkas('evSum', [['nanti', n.nanti, 'Terjadwal'], ['lewat', n.lewat, 'Selesai'], ['', tanpa || '0', 'Sesi tanpa FG 1 / VG', +tanpa > 0]], 'event');
    var q = F.event.q, f = F.event.f;
    var list = rows.filter(function (r) { return (!f || st(r) === f) && cocok(q, [g(r, 'Event'), g(r, 'Sesi'), g(r, 'Lokasi'), g(r, 'FG 1'), g(r, 'FG 2'), g(r, 'VG'), g(r, 'Support'), g(r, 'Catatan')].join(' ')); });
    if (!f && !q) list = list.filter(function (r) { return st(r) === 'nanti'; }).concat(list.filter(function (r) { return st(r) === 'lewat'; }));
    var h = list.map(function (r) {
      var lewat = st(r) === 'lewat', internal = /internal/i.test(g(r, 'Event')), meta = [], tim = [];
      if (isi(g(r, 'Jam'))) meta.push('<span>' + esc(g(r, 'Jam')) + '</span>');
      if (isi(g(r, 'Lokasi'))) meta.push('<span>' + esc(g(r, 'Lokasi')) + '</span>');
      if (isi(g(r, 'Sesi ke'))) meta.push('<span>Sesi ' + esc(g(r, 'Sesi ke')) + '</span>');
      [['FG 1', 'FG'], ['FG 2', 'FG 2'], ['VG', 'VG'], ['Support', 'Support']].forEach(function (k) { if (isi(g(r, k[0]))) tim.push('<span class="tag">' + k[1] + ' ' + esc(g(r, k[0])) + '</span>'); });
      if (isi(g(r, 'Add-on'))) tim.push('<span class="tag">+ ' + esc(g(r, 'Add-on')) + '</span>');
      var pill = lewat ? '<span class="pill s0">Selesai</span>' : '<span class="pill s1">' + esc(g(r, 'Status') || 'Terjadwal') + '</span>';
      var cat = isi(g(r, 'Catatan')) ? '<span class="cat">' + esc(g(r, 'Catatan')) + '</span>' : '';
      return '<div class="item ev' + (lewat ? ' past' : '') + (internal ? ' internal' : '') + '">' + tglBox(g(r, 'Tanggal'), g(r, 'Hari')) +
        '<span class="main"><span class="nm">' + esc(g(r, 'Event').replace(/^\W+\s*/, '')) + ' <span class="sub">· ' + esc(g(r, 'Sesi')) + '</span></span>' +
        (meta.length ? '<span class="meta">' + meta.join('') + '</span>' : '') + (tim.length ? '<span class="meta">' + tim.join('') + '</span>' : (internal ? '' : '<span class="meta"><span class="late">Tim belum diisi</span></span>')) + cat + '</span>' + pill + '</div>';
    }).join('');
    $('evList').innerHTML = (h || '<div class="empty">Tidak ada event' + (q || f ? ' yang cocok.' : '.') + '</div>') + kaki('event');
  }

  /* ---------- Tugas Foto ---------- */
  function ketKelas(k) {
    k = k.toLowerCase();
    return /telat|terlambat|lewat/.test(k) ? 's3' : /tepat/.test(k) ? 's2' : /segera/.test(k) ? 's1' : 's0';
  }
  function stFoto(r) { var s = g(r, 'Status foto').toLowerCase(), k = g(r, 'Keterangan').toLowerCase(); return s === 'selesai' ? 'selesai' : /belum sesi/.test(k) ? 'nanti' : s === 'dikerjakan' ? 'proses' : 'antre'; }
  function viewFoto() {
    var t = D.foto;
    if (!t.ada) return kosong('foList', 'Tab TUGAS FOTO tidak ditemukan di spreadsheet.', 'foto');
    $('foBulan').innerHTML = bulanLabel(t);
    var rows = t.baris.filter(function (r) { return isi(g(r, 'Event')) || isi(g(r, 'Sesi')); });
    var st = stFoto;
    var c = { antre: 0, proses: 0, selesai: 0 }; rows.forEach(function (r) { if (c[st(r)] != null) c[st(r)]++; });
    var telat = info(t, 'Terlambat') || '0';
    ringkas('foSum', [['antre', c.antre, 'Antre'], ['proses', c.proses, 'Dikerjakan · ' + telat + ' terlambat', +telat > 0], ['selesai', c.selesai, 'Selesai']], 'foto');
    var editors = []; rows.forEach(function (r) { var e = g(r, 'Editor foto'); if (isi(e) && editors.indexOf(e) < 0) editors.push(e); });
    chips('foEd', 'Editor', editors.sort(), F.foto.ed, 'foto', 'ed');
    var q = F.foto.q, f = F.foto.f, ed = F.foto.ed;
    var urut = { antre: 1, proses: 0, selesai: 2, nanti: 3 };
    var list = rows.filter(function (r) { return (!f || st(r) === f) && (!ed || g(r, 'Editor foto') === ed) && cocok(q, [g(r, 'Event'), g(r, 'Sesi'), g(r, 'Editor foto'), g(r, 'FG 1')].join(' ')); });
    list = list.map(function (r, i) { return [r, i]; }).sort(function (a, b) { return (urut[st(a[0])] - urut[st(b[0])]) || a[1] - b[1]; }).map(function (x) { return x[0]; });
    LIST.foto = list;
    var judulGrup = { proses: 'Dikerjakan', antre: 'Antre', selesai: 'Selesai', nanti: 'Belum sesi' }, last = '', h = '';
    list.forEach(function (r, i) {
      var s = st(r);
      if (s !== last) { last = s; h += '<h3 class="grp">' + judulGrup[s] + '</h3>'; }
      var meta = ['<span class="tag">' + esc(g(r, 'Tanggal sesi')) + '</span>'];
      if (isi(g(r, 'Editor foto'))) meta.push('<span>Editor ' + esc(g(r, 'Editor foto')) + '</span>');
      else if (s !== 'nanti') meta.push('<span class="late">Belum ada editor</span>');
      if (isi(g(r, 'FG 1'))) meta.push('<span>FG ' + esc(g(r, 'FG 1')) + '</span>');
      if (isi(g(r, 'Deadline')) && s !== 'selesai') meta.push('<span>Deadline ' + esc(g(r, 'Deadline')) + '</span>');
      if (isi(g(r, 'Tgl selesai'))) meta.push('<span>Selesai ' + esc(g(r, 'Tgl selesai')) + '</span>');
      var ket = g(r, 'Keterangan');
      h += kartu('<span class="main"><span class="nm">' + esc(g(r, 'Event')) + ' <span class="sub">· ' + esc(g(r, 'Sesi')) + '</span></span><span class="meta">' + meta.join('') + '</span></span>' +
        (ket ? '<span class="pill ' + ketKelas(ket) + '">' + esc(ket) + '</span>' : ''), s === 'selesai' ? ' done' : '', i);
    });
    $('foList').innerHTML = (h || '<div class="empty">Tidak ada tugas' + (q || f || ed ? ' yang cocok.' : '.') + '</div>') + kaki('foto');
  }

  /* ---------- Tugas Video ---------- */
  function stVideo(r) { var s = g(r, 'Status').toLowerCase(); return s === 'selesai' ? 'selesai' : s === 'dikerjakan' ? 'proses' : 'antre'; }
  function viewVideo() {
    var t = D.video;
    if (!t.ada) return kosong('viList', 'Tab TUGAS VIDEO tidak ditemukan di spreadsheet.', 'video');
    var rows = t.baris.filter(function (r) { return isi(g(r, 'Sesi')); });
    var bulan = []; rows.forEach(function (r) { var b = g(r, 'Bulan'); if (isi(b) && bulan.indexOf(b) < 0) bulan.push(b); });
    $('viBulan').innerHTML = bulan.map(function (b) { return '<span class="tag">' + esc(b) + '</span>'; }).join('');
    var st = stVideo;
    var c = { antre: 0, proses: 0, selesai: 0 }, telat = 0;
    rows.forEach(function (r) { c[st(r)]++; if (/telat|terlambat|lewat/i.test(g(r, 'Keterangan'))) telat++; });
    ringkas('viSum', [['antre', c.antre, 'Antre / lainnya'], ['proses', c.proses, 'Dikerjakan' + (telat ? ' · ' + telat + ' terlambat' : ''), telat > 0], ['selesai', c.selesai, 'Selesai']], 'video');
    var pj = []; rows.forEach(function (r) { var e = g(r, 'Penanggung jawab'); if (isi(e) && pj.indexOf(e) < 0) pj.push(e); });
    chips('viPj', 'Penanggung jawab', pj.sort(), F.video.pj, 'video', 'pj');
    var q = F.video.q, f = F.video.f, p = F.video.pj;
    var list = rows.filter(function (r) { return (!f || st(r) === f) && (!p || g(r, 'Penanggung jawab') === p) && cocok(q, [g(r, 'Sesi'), g(r, 'Jenis tugas'), g(r, 'Penanggung jawab'), g(r, 'Catatan / link hasil')].join(' ')); });
    LIST.video = list;
    var h = bisaUbah() ? '<button type="button" class="item add" data-tambah="1"><span class="plus">＋</span><span class="main"><span class="nm">Tambah tugas video</span><span class="meta">Masuk ke tab TUGAS VIDEO di spreadsheet</span></span></button>' : '';
    h += list.map(function (r, i) {
      var meta = [];
      if (isi(g(r, 'Jenis tugas'))) meta.push('<span class="tag">' + esc(g(r, 'Jenis tugas')) + '</span>');
      if (isi(g(r, 'Tanggal sesi'))) meta.push('<span>Sesi ' + esc(g(r, 'Tanggal sesi')) + '</span>');
      if (isi(g(r, 'Penanggung jawab'))) meta.push('<span>PJ ' + esc(g(r, 'Penanggung jawab')) + '</span>');
      else meta.push('<span class="late">Belum ada penanggung jawab</span>');
      if (isi(g(r, 'Deadline')) && st(r) !== 'selesai') meta.push('<span>Deadline ' + esc(g(r, 'Deadline')) + (isi(g(r, 'Sisa hari')) ? ' (sisa ' + esc(g(r, 'Sisa hari')) + ' hari)' : '') + '</span>');
      if (isi(g(r, 'Tanggal selesai'))) meta.push('<span>Selesai ' + esc(g(r, 'Tanggal selesai')) + '</span>');
      var ket = g(r, 'Keterangan') || g(r, 'Status'), cat = g(r, 'Catatan / link hasil');
      // link di catatan tidak dijadikan <a> bila kartu bisa diketuk (tombol tidak boleh berisi link) — buka lewat form
      return kartu('<span class="main"><span class="nm">' + esc(g(r, 'Sesi')) + '</span><span class="meta">' + meta.join('') + '</span>' +
        (isi(cat) ? '<span class="cat">' + (bisaUbah() ? esc(cat) : linkify(cat)) + '</span>' : '') + '</span>' +
        (ket ? '<span class="pill ' + (st(r) === 'selesai' ? 's2' : ketKelas(ket)) + '">' + esc(ket) + '</span>' : ''), st(r) === 'selesai' ? ' done' : '', i);
    }).join('');
    if (!list.length) h += '<div class="empty">Belum ada tugas video' + (q || f || p ? ' yang cocok.' : '.') + '</div>';
    $('viList').innerHTML = h + kaki('video');
  }

  /* ---------- form isi (lembar bawah) ---------- */
  var tT;
  function toast(m) { var t = $('dbToast'); t.textContent = m; t.classList.add('show'); clearTimeout(tT); tT = setTimeout(function () { t.classList.remove('show'); }, 2800); }
  function bukaSheet(h) { $('dbSheet').innerHTML = '<div class="grab"></div>' + h; $('dbOv').classList.remove('hidden'); document.body.style.overflow = 'hidden'; }
  function tutup() { $('dbOv').classList.add('hidden'); document.body.style.overflow = ''; }
  function gabung() {              // gabungkan beberapa daftar tanpa duplikat & tanpa nilai kosong
    var out = [];
    Array.prototype.forEach.call(arguments, function (a) { (a || []).forEach(function (x) { x = String(x || '').trim(); if (isi(x) && out.indexOf(x) < 0) out.push(x); }); });
    return out;
  }
  function pilih(id, label, nilai, opsi, kosongLabel) {
    opsi = gabung(nilai ? [nilai] : [], opsi);
    return '<label class="f" for="' + id + '">' + label + '</label><select class="inp" id="' + id + '">' +
      '<option value="">' + esc(kosongLabel || '— kosong —') + '</option>' +
      opsi.map(function (o) { return '<option value="' + esc(o) + '"' + (o === nilai ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') + '</select>';
  }
  function tanggal(id, label, iso) {
    return '<label class="f" for="' + id + '">' + label + '</label><div class="inrow"><input class="inp" type="date" id="' + id + '" value="' + esc(iso) + '">' +
      '<button type="button" class="btn" data-today="' + id + '">Hari ini</button><button type="button" class="btn" data-clear="' + id + '">Hapus</button></div>';
  }
  function tombolForm(teks) { return '<div class="row"><button type="button" class="btn grow" id="dbBatal">Batal</button><button type="submit" class="btn primary grow">' + teks + '</button></div>'; }
  function pasangUmum() {
    Array.prototype.forEach.call($('dbSheet').querySelectorAll('[data-today]'), function (bt) { bt.onclick = function () { $(bt.getAttribute('data-today')).value = hariIniISO(); }; });
    Array.prototype.forEach.call($('dbSheet').querySelectorAll('[data-clear]'), function (bt) { bt.onclick = function () { $(bt.getAttribute('data-clear')).value = ''; }; });
    $('dbBatal').onclick = tutup;
  }
  function simpan(body, pesan, view) {
    tutup(); toast('Menyimpan…');
    return api(body).then(function () {
      toast(pesan || 'Tersimpan ke spreadsheet');
      return ambil(true).then(function () { tampilkan(view); });
    }).catch(function (err) { toast(err.message); });
  }

  function bukaFoto(r) {
    var P = D.pilihan || {}, nmEd = [];
    D.foto.baris.forEach(function (x) { nmEd.push(g(x, 'Editor foto')); });
    var awal = { ed: g(r, 'Editor foto'), st: g(r, 'Status foto'), ok: keISO(g(r, 'Tgl selesai')) };
    var stOpsi = gabung(P.stFoto && P.stFoto.length ? P.stFoto : ['Antre', 'Dikerjakan', 'Selesai']);
    var sudah = stFoto(r) === 'selesai';
    bukaSheet('<h2>' + esc(g(r, 'Event')) + ' · ' + esc(g(r, 'Sesi')) + '</h2>' +
      '<p class="note">Sesi ' + esc(g(r, 'Tanggal sesi')) + (isi(g(r, 'FG 1')) ? ' · FG ' + esc(g(r, 'FG 1')) : '') + (isi(g(r, 'Deadline')) ? ' · Deadline ' + esc(g(r, 'Deadline')) : '') + '</p>' +
      (sudah ? '' : '<div class="row"><button type="button" class="btn primary grow" id="dbCepat">✓ Tandai selesai hari ini</button></div>') +
      '<form id="dbForm"><div class="box"><h3>Edit foto</h3>' +
      pilih('dbf_ed', 'Editor foto', awal.ed, gabung(P.edFoto, nmEd.sort()), '— belum ada editor —') +
      pilih('dbf_st', 'Status foto', awal.st, stOpsi, '— belum diisi —') +
      tanggal('dbf_ok', 'Tanggal selesai', awal.ok) +
      '</div>' + tombolForm('Simpan') + '</form>');
    pasangUmum();
    $('dbf_st').onchange = function () { if (/^selesai$/i.test(this.value) && !$('dbf_ok').value) $('dbf_ok').value = hariIniISO(); };
    var kirim = function (ubah) {
      var n = Object.keys(ubah).length;
      if (!n) { tutup(); return; }
      simpan({ action: 'dbUbah', tab: 'foto', kunci: { tgl: g(r, 'Tanggal sesi'), event: g(r, 'Event'), sesi: g(r, 'Sesi') }, fields: ubah },
        ubah.st && /^selesai$/i.test(ubah.st) ? 'Ditandai selesai' + (ubah.ok ? ' ' + keDM(ubah.ok) : '') : 'Tersimpan ke spreadsheet', 'foto');
    };
    if ($('dbCepat')) $('dbCepat').onclick = function () {
      var st = stOpsi.find(function (s) { return /^selesai$/i.test(s); }) || 'Selesai';
      kirim({ st: st, ok: awal.ok || hariIniISO() });
    };
    $('dbForm').onsubmit = function (ev) {
      ev.preventDefault();
      var baru = { ed: $('dbf_ed').value, st: $('dbf_st').value, ok: $('dbf_ok').value }, ubah = {};
      Object.keys(baru).forEach(function (k) { if (baru[k] !== awal[k]) ubah[k] = baru[k]; });
      kirim(ubah);
    };
  }

  function bukaVideo(r) {        // r = null → tugas baru
    var P = D.pilihan || {}, baru = !r, nmPj = [], cat = r ? g(r, 'Catatan / link hasil') : '';
    D.video.baris.forEach(function (x) { nmPj.push(g(x, 'Penanggung jawab')); });
    var awal = r ? { jenis: g(r, 'Jenis tugas'), sesi: g(r, 'Sesi'), pj: g(r, 'Penanggung jawab'), st: g(r, 'Status'), ok: keISO(g(r, 'Tanggal selesai')), cat: cat }
      : { jenis: '', sesi: '', pj: '', st: '', ok: '', cat: '' };
    var stOpsi = gabung(P.stVideo && P.stVideo.length ? P.stVideo : ['Antre', 'Dikerjakan', 'Selesai']);
    var jenisOpsi = gabung(P.jenisVideo && P.jenisVideo.length ? P.jenisVideo : ['Video']);
    var sesiOpsi = gabung(P.sesiVideo);
    var link = (cat.match(/https?:\/\/[^\s<]+/) || [])[0];
    bukaSheet('<h2>' + (baru ? 'Tambah tugas video' : esc(g(r, 'Sesi'))) + '</h2>' +
      (baru ? '<p class="note">Tersimpan sebagai baris baru di tab TUGAS VIDEO.</p>' :
        '<p class="note">' + (isi(g(r, 'Tanggal sesi')) ? 'Sesi ' + esc(g(r, 'Tanggal sesi')) : '') + (isi(g(r, 'Deadline')) ? ' · Deadline ' + esc(g(r, 'Deadline')) : '') +
        (link ? ' · <a href="' + esc(link) + '" target="_blank" rel="noopener">buka link hasil</a>' : '') + '</p>') +
      (!baru && stVideo(r) !== 'selesai' ? '<div class="row"><button type="button" class="btn primary grow" id="dbCepat">✓ Tandai selesai hari ini</button></div>' : '') +
      '<form id="dbForm"><div class="box"><h3>Tugas</h3>' +
      pilih('dbv_jenis', 'Jenis tugas', awal.jenis, jenisOpsi, '— pilih jenis —') +
      '<label class="f" for="dbv_sesi">Sesi</label><input class="inp" id="dbv_sesi" list="dbSesiList" autocomplete="off" placeholder="Ketik nama klien lalu pilih sesinya" value="' + esc(awal.sesi) + '">' +
      '<datalist id="dbSesiList">' + sesiOpsi.slice().reverse().map(function (s) { return '<option value="' + esc(s) + '">'; }).join('') + '</datalist>' +
      pilih('dbv_pj', 'Penanggung jawab', awal.pj, gabung(P.pjVideo, nmPj.sort()), '— belum ada —') +
      pilih('dbv_st', 'Status', awal.st, stOpsi, '— belum diisi —') +
      tanggal('dbv_ok', 'Tanggal selesai', awal.ok) +
      '<label class="f" for="dbv_cat">Catatan / link hasil</label><input class="inp" id="dbv_cat" autocomplete="off" value="' + esc(awal.cat) + '">' +
      '</div>' + tombolForm(baru ? 'Tambahkan' : 'Simpan') + '</form>');
    pasangUmum();
    $('dbv_st').onchange = function () { if (/^selesai$/i.test(this.value) && !$('dbv_ok').value) $('dbv_ok').value = hariIniISO(); };
    var kirim = function (ubah) {
      if (baru) {
        if (!ubah.jenis) { toast('Pilih jenis tugas.'); return; }
        if (!ubah.sesi) { toast('Pilih sesi.'); return; }
        if (sesiOpsi.length && sesiOpsi.indexOf(ubah.sesi) < 0) { toast('Sesi tidak ada di daftar. Pilih dari saran yang muncul.'); return; }
        simpan({ action: 'dbTambahVideo', fields: ubah }, 'Tugas video ditambahkan', 'video');
        return;
      }
      if (!Object.keys(ubah).length) { tutup(); return; }
      if (ubah.sesi != null && sesiOpsi.length && sesiOpsi.indexOf(ubah.sesi) < 0) { toast('Sesi tidak ada di daftar. Pilih dari saran yang muncul.'); return; }
      simpan({ action: 'dbUbah', tab: 'video', row: r._row, sesi: g(r, 'Sesi'), fields: ubah },
        ubah.st && /^selesai$/i.test(ubah.st) ? 'Ditandai selesai' + (ubah.ok ? ' ' + keDM(ubah.ok) : '') : 'Tersimpan ke spreadsheet', 'video');
    };
    if ($('dbCepat')) $('dbCepat').onclick = function () {
      var st = stOpsi.find(function (s) { return /^selesai$/i.test(s); }) || 'Selesai';
      kirim({ st: st, ok: awal.ok || hariIniISO() });
    };
    $('dbForm').onsubmit = function (ev) {
      ev.preventDefault();
      var nilai = { jenis: $('dbv_jenis').value, sesi: $('dbv_sesi').value.replace(/\s+/g, ' ').trim(), pj: $('dbv_pj').value, st: $('dbv_st').value, ok: $('dbv_ok').value, cat: $('dbv_cat').value.trim() }, ubah = {};
      Object.keys(nilai).forEach(function (k) { if (baru ? nilai[k] : nilai[k] !== awal[k]) ubah[k] = nilai[k]; });
      kirim(ubah);
    };
  }

  function klik(view) {
    return function (ev) {
      if (!bisaUbah() || ev.target.closest('a')) return;
      if (view === 'video' && ev.target.closest('[data-tambah]')) { bukaVideo(null); return; }
      var it = ev.target.closest('[data-i]'); if (!it) return;
      var r = LIST[view][+it.getAttribute('data-i')]; if (!r) return;
      if (view === 'video' && !r._row) { toast('Muat ulang dulu (tombol ↻), lalu coba lagi.'); return; }
      (view === 'foto' ? bukaFoto : bukaVideo)(r);
    };
  }

  function kosong(id, msg, view) { $(id).innerHTML = '<div class="empty">' + esc(msg) + '</div>' + (D ? kaki(view) : ''); }
  var VIEW = { event: ['evList', viewEvent], foto: ['foList', viewFoto], video: ['viList', viewVideo] };
  function tampilkan(view) { if (D) VIEW[view][1](); }
  function muat(view, paksa) {
    $(VIEW[view][0]).innerHTML = '<div class="spin"></div>';
    ambil(paksa).then(function () { tampilkan(view); }).catch(function (err) {
      $(VIEW[view][0]).innerHTML = '<div class="empty">' + esc(err.message) + '<div class="row center"><button type="button" class="btn primary" data-ulang="1">Coba lagi</button></div></div>';
      $(VIEW[view][0]).querySelector('[data-ulang]').onclick = function () { muat(view, true); };
    });
  }

  window.DashboardTab = {
    init: function () {
      [['event', 'evQ', 'evRefresh'], ['foto', 'foQ', 'foRefresh'], ['video', 'viQ', 'viRefresh']].forEach(function (x) {
        $(x[1]).oninput = function (e) { F[x[0]].q = e.target.value; tampilkan(x[0]); };
        $(x[2]).onclick = function () { muat(x[0], true); };
      });
      var ov = document.createElement('div'); ov.id = 'dbOv'; ov.className = 'tls ov hidden';
      ov.innerHTML = '<div class="sheet" id="dbSheet" role="dialog" aria-modal="true"></div>';
      ov.onclick = function (e) { if (e.target === ov) tutup(); };
      document.body.appendChild(ov);
      var ts = document.createElement('div'); ts.id = 'dbToast'; ts.className = 'tls toast'; document.body.appendChild(ts);
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('dbOv').classList.contains('hidden')) tutup(); });
      $('foList').addEventListener('click', klik('foto'));
      $('viList').addEventListener('click', klik('video'));
    },
    tampil: function (view) { aktif = view; if (D) tampilkan(view); else muat(view); }
  };
})();
