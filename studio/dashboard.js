/* Tab Upcoming Event, Tugas Foto, Tugas Video — dari spreadsheet "TEPIKATA - Dashboard Operasional".
 * Dibaca lewat server Studio (Apps Script, Event.gs → action "dashboard"). Hanya baca untuk sekarang.
 * Kolom dicari berdasarkan NAMA judul, jadi aman bila urutan kolom di spreadsheet berubah.
 */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var HARI = { Senin: 'Sen', Selasa: 'Sel', Rabu: 'Rab', Kamis: 'Kam', Jumat: 'Jum', "Jum'at": 'Jum', Sabtu: 'Sab', Minggu: 'Min' };
  var D = null, memuat = null, diambil = '';
  var F = { event: { f: '', q: '' }, foto: { f: '', ed: '', q: '' }, video: { f: '', pj: '', q: '' } };

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

  /* ---------- data ---------- */
  function ambil(paksa) {
    if (D && !paksa) return Promise.resolve(D);
    if (memuat && !paksa) return memuat;
    memuat = fetch(window.APP, { method: 'POST', body: JSON.stringify({ key: kunci(), action: 'dashboard' }) })
      .catch(function () { throw new Error('Tidak bisa terhubung. Periksa koneksi internet.'); })
      .then(function (r) { return r.text(); })
      .then(function (t) {
        var j; try { j = JSON.parse(t); } catch (e) { throw new Error('Server Studio belum diperbarui untuk Dashboard Operasional. Pasang Event.gs terbaru (halaman bantuan, bagian 6).'); }
        if (!j.ok) throw new Error(/Unknown|tidak dikenal/i.test(j.error) ? 'Server Studio belum diperbarui untuk Dashboard Operasional. Pasang Event.gs terbaru (halaman bantuan, bagian 6).' : j.error);
        D = j.data; var d = new Date(); diambil = (d.getHours() < 10 ? '0' : '') + d.getHours() + '.' + (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
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
  function chips(id, label, nilai, aktif, view, key) {
    if (nilai.length < 2) { $(id).innerHTML = ''; return; }
    $(id).innerHTML = '<span class="chiplbl">' + label + '</span>' + ['Semua'].concat(nilai).map(function (n) {
      var v = n === 'Semua' ? '' : n;
      return '<button type="button" data-v="' + esc(v) + '" class="' + (aktif === v ? 'on' : '') + '">' + esc(n) + '</button>';
    }).join('');
    Array.prototype.forEach.call($(id).querySelectorAll('button'), function (bt) { bt.onclick = function () { F[view][key] = bt.getAttribute('data-v'); tampilkan(view); }; });
  }
  function kaki() {
    return '<p class="note foot">Hanya baca · data dari spreadsheet <a href="' + esc(D.url) + '" target="_blank" rel="noopener">' + esc(D.judul) + '</a> · dimuat ' + diambil +
      '<br>Untuk mengubah data, isi langsung di spreadsheet (tab EVENT DATA / TUGAS VIDEO).</p>';
  }
  function bulanLabel(tab) { var b = info(tab, 'Bulan'); return b ? '<span class="tag">' + esc(b) + '</span>' : ''; }
  function tglBox(tgl, hari) {
    var m = String(tgl).match(/(\d{1,2})\s*\/\s*(\d{1,2})/);
    return '<span class="date"><b>' + (m ? +m[1] : esc(tgl || '–')) + '</b><small>' + esc(HARI[hari] || (hari || '').slice(0, 3)) + '</small></span>';
  }
  function linkify(s) { return esc(s).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">buka link</a>'); }

  /* ---------- Upcoming Event ---------- */
  function viewEvent() {
    var t = D.event;
    if (!t.ada) return kosong('evList', 'Tab UPCOMING EVENT tidak ditemukan di spreadsheet.');
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
    $('evList').innerHTML = (h || '<div class="empty">Tidak ada event' + (q || f ? ' yang cocok.' : '.') + '</div>') + kaki();
  }

  /* ---------- Tugas Foto ---------- */
  function ketKelas(k) {
    k = k.toLowerCase();
    return /telat|terlambat|lewat/.test(k) ? 's3' : /tepat/.test(k) ? 's2' : /segera/.test(k) ? 's1' : /belum sesi/.test(k) ? 's0' : 's0';
  }
  function viewFoto() {
    var t = D.foto;
    if (!t.ada) return kosong('foList', 'Tab TUGAS FOTO tidak ditemukan di spreadsheet.');
    $('foBulan').innerHTML = bulanLabel(t);
    var rows = t.baris.filter(function (r) { return isi(g(r, 'Event')) || isi(g(r, 'Sesi')); });
    var st = function (r) { var s = g(r, 'Status foto').toLowerCase(), k = g(r, 'Keterangan').toLowerCase(); return s === 'selesai' ? 'selesai' : /belum sesi/.test(k) ? 'nanti' : s === 'dikerjakan' ? 'proses' : 'antre'; };
    var c = { antre: 0, proses: 0, selesai: 0 }; rows.forEach(function (r) { if (c[st(r)] != null) c[st(r)]++; });
    var telat = info(t, 'Terlambat') || '0';
    ringkas('foSum', [['antre', c.antre, 'Antre'], ['proses', c.proses, 'Dikerjakan · ' + telat + ' terlambat', +telat > 0], ['selesai', c.selesai, 'Selesai']], 'foto');
    var editors = []; rows.forEach(function (r) { var e = g(r, 'Editor foto'); if (isi(e) && editors.indexOf(e) < 0) editors.push(e); });
    chips('foEd', 'Editor', editors.sort(), F.foto.ed, 'foto', 'ed');
    var q = F.foto.q, f = F.foto.f, ed = F.foto.ed;
    var urut = { antre: 1, proses: 0, selesai: 2, nanti: 3 };
    var list = rows.filter(function (r) { return (!f || st(r) === f) && (!ed || g(r, 'Editor foto') === ed) && cocok(q, [g(r, 'Event'), g(r, 'Sesi'), g(r, 'Editor foto'), g(r, 'FG 1')].join(' ')); });
    list = list.map(function (r, i) { return [r, i]; }).sort(function (a, b) { return (urut[st(a[0])] - urut[st(b[0])]) || a[1] - b[1]; }).map(function (x) { return x[0]; });
    var judulGrup = { proses: 'Dikerjakan', antre: 'Antre', selesai: 'Selesai', nanti: 'Belum sesi' }, last = '', h = '';
    list.forEach(function (r) {
      var s = st(r);
      if (s !== last) { last = s; h += '<h3 class="grp">' + judulGrup[s] + '</h3>'; }
      var meta = ['<span class="tag">' + esc(g(r, 'Tanggal sesi')) + '</span>'];
      if (isi(g(r, 'Editor foto'))) meta.push('<span>Editor ' + esc(g(r, 'Editor foto')) + '</span>');
      else if (s !== 'nanti') meta.push('<span class="late">Belum ada editor</span>');
      if (isi(g(r, 'FG 1'))) meta.push('<span>FG ' + esc(g(r, 'FG 1')) + '</span>');
      if (isi(g(r, 'Deadline')) && s !== 'selesai') meta.push('<span>Deadline ' + esc(g(r, 'Deadline')) + '</span>');
      if (isi(g(r, 'Tgl selesai'))) meta.push('<span>Selesai ' + esc(g(r, 'Tgl selesai')) + '</span>');
      var ket = g(r, 'Keterangan');
      h += '<div class="item' + (s === 'selesai' ? ' done' : '') + '"><span class="main"><span class="nm">' + esc(g(r, 'Event')) + ' <span class="sub">· ' + esc(g(r, 'Sesi')) + '</span></span><span class="meta">' + meta.join('') + '</span></span>' +
        (ket ? '<span class="pill ' + ketKelas(ket) + '">' + esc(ket) + '</span>' : '') + '</div>';
    });
    $('foList').innerHTML = (h || '<div class="empty">Tidak ada tugas' + (q || f || ed ? ' yang cocok.' : '.') + '</div>') + kaki();
  }

  /* ---------- Tugas Video ---------- */
  function viewVideo() {
    var t = D.video;
    if (!t.ada) return kosong('viList', 'Tab TUGAS VIDEO tidak ditemukan di spreadsheet.');
    var rows = t.baris.filter(function (r) { return isi(g(r, 'Sesi')); });
    var bulan = []; rows.forEach(function (r) { var b = g(r, 'Bulan'); if (isi(b) && bulan.indexOf(b) < 0) bulan.push(b); });
    $('viBulan').innerHTML = bulan.map(function (b) { return '<span class="tag">' + esc(b) + '</span>'; }).join('');
    var st = function (r) { var s = g(r, 'Status').toLowerCase(); return s === 'selesai' ? 'selesai' : s === 'dikerjakan' ? 'proses' : 'antre'; };
    var c = { antre: 0, proses: 0, selesai: 0 }, telat = 0;
    rows.forEach(function (r) { c[st(r)]++; if (/telat|terlambat|lewat/i.test(g(r, 'Keterangan'))) telat++; });
    ringkas('viSum', [['antre', c.antre, 'Antre / lainnya'], ['proses', c.proses, 'Dikerjakan' + (telat ? ' · ' + telat + ' terlambat' : ''), telat > 0], ['selesai', c.selesai, 'Selesai']], 'video');
    var pj = []; rows.forEach(function (r) { var e = g(r, 'Penanggung jawab'); if (isi(e) && pj.indexOf(e) < 0) pj.push(e); });
    chips('viPj', 'Penanggung jawab', pj.sort(), F.video.pj, 'video', 'pj');
    var q = F.video.q, f = F.video.f, p = F.video.pj;
    var list = rows.filter(function (r) { return (!f || st(r) === f) && (!p || g(r, 'Penanggung jawab') === p) && cocok(q, [g(r, 'Sesi'), g(r, 'Jenis tugas'), g(r, 'Penanggung jawab'), g(r, 'Catatan / link hasil')].join(' ')); });
    var h = list.map(function (r) {
      var meta = [];
      if (isi(g(r, 'Jenis tugas'))) meta.push('<span class="tag">' + esc(g(r, 'Jenis tugas')) + '</span>');
      if (isi(g(r, 'Tanggal sesi'))) meta.push('<span>Sesi ' + esc(g(r, 'Tanggal sesi')) + '</span>');
      if (isi(g(r, 'Penanggung jawab'))) meta.push('<span>PJ ' + esc(g(r, 'Penanggung jawab')) + '</span>');
      else meta.push('<span class="late">Belum ada penanggung jawab</span>');
      if (isi(g(r, 'Deadline')) && st(r) !== 'selesai') meta.push('<span>Deadline ' + esc(g(r, 'Deadline')) + (isi(g(r, 'Sisa hari')) ? ' (sisa ' + esc(g(r, 'Sisa hari')) + ' hari)' : '') + '</span>');
      if (isi(g(r, 'Tanggal selesai'))) meta.push('<span>Selesai ' + esc(g(r, 'Tanggal selesai')) + '</span>');
      var ket = g(r, 'Keterangan') || g(r, 'Status'), cat = g(r, 'Catatan / link hasil');
      return '<div class="item' + (st(r) === 'selesai' ? ' done' : '') + '"><span class="main"><span class="nm">' + esc(g(r, 'Sesi')) + '</span><span class="meta">' + meta.join('') + '</span>' +
        (isi(cat) ? '<span class="cat">' + linkify(cat) + '</span>' : '') + '</span>' + (ket ? '<span class="pill ' + (st(r) === 'selesai' ? 's2' : ketKelas(ket)) + '">' + esc(ket) + '</span>' : '') + '</div>';
    }).join('');
    $('viList').innerHTML = (h || '<div class="empty">Belum ada tugas video' + (q || f || p ? ' yang cocok.' : '.') + '</div>') + kaki();
  }

  function kosong(id, msg) { $(id).innerHTML = '<div class="empty">' + esc(msg) + '</div>' + (D ? kaki() : ''); }
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
    },
    tampil: function (view) { if (D) tampilkan(view); else muat(view); }
  };
})();
