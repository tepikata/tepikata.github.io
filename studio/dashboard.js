/* Tab Upcoming Event, Tugas Foto, Tugas Video — dari spreadsheet "TEPIKATA - Dashboard Operasional".
 * Dibaca lewat server Studio (Apps Script, Event.gs → action "dashboard").
 * Upcoming, Tugas Foto & Tugas Video bisa diubah dari aplikasi (Event.gs → "dbUbah" / "dbTambahVideo"):
 *   event → tab EVENT DATA (Jam, Lokasi, Add-on, FG 1, FG 2, VG, Support, Status, Catatan)
 *   foto  → tab EVENT DATA (Editor foto, Status foto, Tgl selesai foto)
 *   video → tab TUGAS VIDEO (Jenis tugas, Sesi, Penanggung jawab, Status, Tanggal selesai, Catatan)
 * Kolom dicari berdasarkan NAMA judul, jadi aman bila urutan kolom di spreadsheet berubah.
 * Tampilan (kepala plum, judul Bodoni, kartu putih bertile emas) mengikuti tab Data Klien — lihat TEMA di bawah.
 */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var HARI = { Senin: 'Sen', Selasa: 'Sel', Rabu: 'Rab', Kamis: 'Kam', Jumat: 'Jum', "Jum'at": 'Jum', Sabtu: 'Sab', Minggu: 'Min' };
  var PERLU_SERVER = 'Server Studio belum diperbarui untuk Dashboard Operasional. Pasang Event.gs terbaru (halaman bantuan, bagian 6).';
  var D = null, memuat = null, diambil = '';
  var F = { event: { f: '', q: '' }, foto: { f: '', ed: '', q: '' }, video: { f: '', pj: '', q: '' } };
  var LIST = { event: [], foto: [], video: [] };   // baris yang sedang tampil (untuk dibuka saat kartu diketuk)
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
  function bisaEvent() { return !!(D && D.pilihan && D.pilihan.stEvent); }   // Event.gs yang mendukung ubah event
  function inisial(nama) {
    var w = String(nama || '').replace(/^\W+/, '').split(/[\s&+,/]+/).filter(function (x) { return /^[A-Za-z\u00C0-\u024F]/.test(x) && !/^(dan|and|x)$/i.test(x); });
    return ((w[0] || '?').charAt(0) + (w.length > 1 ? w[w.length - 1].charAt(0) : '')).toUpperCase();
  }
  function klienDariSesi(label) { var p = String(label || '').split('·'); return (p.length > 1 ? p[1] : p[0]).trim(); }
  function internal(r) { return /internal/i.test(g(r, 'Event')); }
  // Kartu tanpa _src (mis. agenda Internal dari tab AGENDA) tidak ada di EVENT DATA → hanya baca.
  /* tanda merah: kolom wajib yang masih kosong (mengikuti warna merah di tab EVENT DATA) */
  function kurangEvent(r) {        // → daftar kolom kosong; kosong = aman
    if (internal(r) || g(r, 'Status').toLowerCase().indexOf('selesai') >= 0) return [];
    return ['FG 1', 'VG'].filter(function (k) { return !isi(g(r, k)); });
  }
  function kurangFoto(r) { return stFoto(r) !== 'selesai' && !isi(g(r, 'Editor foto')); }
  function kurangVideo(r) { return stVideo(r) !== 'selesai' && !isi(g(r, 'Penanggung jawab')); }
  function grup(judul, n, satuan) { return '<h3 class="grp">' + esc(judul) + ' <small>' + n + ' ' + satuan + '</small></h3>'; }

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
      return '<button type="button" data-f="' + x[0] + '" class="' + (x[0] && F[view].f === x[0] ? 'on' : '') + (x[3] ? ' warn' : '') + '"' + (x[0] ? '' : ' disabled') + '><b>' + esc(x[1]) + '</b><span>' + esc(x[2]) + '</span></button>';
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
    var ubah = bisaUbah() && (view !== 'event' || bisaEvent());
    return '<p class="note foot">' + (ubah ? 'Ketuk kartu untuk mengisi · tersimpan langsung ke spreadsheet' : 'Hanya baca') +
      ' · data dari spreadsheet <a href="' + esc(D.url) + '" target="_blank" rel="noopener">' + esc(D.judul) + '</a> · dimuat ' + diambil +
      (ubah ? '' : '<br>Untuk mengubah data, isi langsung di spreadsheet, atau pasang Event.gs terbaru.') + '</p>';
  }
  function bulanLabel(tab) { var b = info(tab, 'Bulan'); return b ? '<span class="tag">' + esc(b) + '</span>' : ''; }
  function tglBox(tgl, hari) {
    var m = String(tgl).match(/(\d{1,2})\s*\/\s*(\d{1,2})/);
    return '<span class="date"><b>' + (m ? +m[1] : esc(tgl || '–')) + '</b><small>' + esc(HARI[hari] || (hari || '').slice(0, 3)) + '</small></span>';
  }
  function linkify(s) { return esc(s).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">buka link</a>'); }
  function kartu(isiHtml, kelas, i, boleh) {        // kartu bisa diketuk bila server mendukung perubahan
    return (boleh == null ? bisaUbah() : boleh) ? '<button type="button" class="item' + kelas + '" data-i="' + i + '">' + isiHtml + '</button>'
      : '<div class="item' + kelas + '">' + isiHtml + '</div>';
  }

  /* ---------- kepala (hero) ala Data Klien ---------- */
  function judulBulan(b) { var m = String(b || '').match(/^(.*?)\s*(\d{4})$/); return m ? esc(m[1]) + ' <em>' + m[2] + '</em>' : esc(b || ''); }
  function hero(view, eyebrow, judulHtml, lead, prog) {
    var el = document.querySelector('#' + view + 'Hero .dk-teks'); if (!el) return;
    var h = '<span class="dk-eyebrow">' + esc(eyebrow) + '</span><h1>' + (judulHtml || '&nbsp;') + '</h1>' + (lead ? '<p class="dk-lead">' + lead + '</p>' : '');
    if (prog && prog.total) {
      var pct = Math.round(100 * prog.selesai / prog.total);
      h += '<div class="dk-prog"><span>' + esc(prog.label) + '</span><b>' + pct + '<small>% selesai</small></b></div><div class="dk-bar">' +
        prog.bagian.map(function (x) { return x[0] ? '<i class="' + x[1] + '" style="flex-grow:' + x[0] + '"></i>' : ''; }).join('') + '</div>';
    }
    el.innerHTML = h;
  }

  /* ---------- Upcoming Event ---------- */
  function viewEvent() {
    var t = D.event;
    if (!t.ada) return kosong('evList', 'Tab UPCOMING EVENT tidak ditemukan di spreadsheet.', 'event');
    $('evBulan').innerHTML = bulanLabel(t) + (info(t, 'Sesi berikutnya') ? '<span class="tag">Berikutnya: ' + esc(info(t, 'Sesi berikutnya')) + '</span>' : '');
    var rows = t.baris.filter(function (r) { return isi(g(r, 'Event')) || isi(g(r, 'Sesi')); });
    var st = function (r) { var s = g(r, 'Status').toLowerCase(); return s.indexOf('selesai') >= 0 ? 'lewat' : 'nanti'; };
    var n = { nanti: 0, lewat: 0 }; rows.forEach(function (r) { n[st(r)]++; });
    var tanpa = rows.filter(function (r) { return kurangEvent(r).length; }).length, jmlEvent = info(t, 'Jumlah event');
    hero('ev', 'Upcoming event', judulBulan(info(t, 'Bulan')),
      '<b>' + rows.length + ' sesi</b> bulan ini' + (jmlEvent ? ' dari ' + esc(jmlEvent) + ' event' : '') + '. ' + n.nanti + ' masih terjadwal, ' + n.lewat + ' sudah selesai' +
      (tanpa > 0 ? ', <b class="dk-merah">' + tanpa + ' sesi belum ada FG 1 / VG</b>.' : '.'),
      { label: 'Progres jadwal', selesai: n.lewat, total: rows.length, bagian: [[n.lewat, 'b2'], [n.nanti, 'b0']] });
    ringkas('evSum', [['nanti', n.nanti, 'Terjadwal'], ['lewat', n.lewat, 'Selesai'], [tanpa ? 'kosong' : '', tanpa, 'Sesi tanpa FG 1 / VG', tanpa > 0]], 'event');
    if (F.event.f === 'kosong' && !tanpa) F.event.f = '';
    var q = F.event.q, f = F.event.f;
    f = F.event.f;
    var list = rows.filter(function (r) { return (!f || (f === 'kosong' ? kurangEvent(r).length > 0 : st(r) === f)) && cocok(q, [g(r, 'Event'), g(r, 'Sesi'), g(r, 'Lokasi'), g(r, 'FG 1'), g(r, 'FG 2'), g(r, 'VG'), g(r, 'Support'), g(r, 'Catatan')].join(' ')); });
    list = list.filter(function (r) { return st(r) === 'nanti'; }).concat(list.filter(function (r) { return st(r) === 'lewat'; }));
    LIST.event = list;
    var jml = { nanti: 0, lewat: 0 }; list.forEach(function (r) { jml[st(r)]++; });
    var last = '', boleh = bisaUbah() && bisaEvent();
    var h = list.map(function (r, i) {
      var s = st(r), kepala = '';
      if (s !== last) { last = s; kepala = grup(s === 'nanti' ? 'Akan datang' : 'Sudah selesai', jml[s], 'sesi'); }
      var lewat = st(r) === 'lewat', intern = internal(r), meta = [], tim = [], kurang = kurangEvent(r);
      if (isi(g(r, 'Jam'))) meta.push('<span>' + esc(g(r, 'Jam')) + '</span>');
      if (isi(g(r, 'Lokasi'))) meta.push('<span>' + esc(g(r, 'Lokasi')) + '</span>');
      if (isi(g(r, 'Sesi ke'))) meta.push('<span>Sesi ' + esc(g(r, 'Sesi ke')) + '</span>');
      [['FG 1', 'FG'], ['FG 2', 'FG 2'], ['VG', 'VG'], ['Support', 'Support']].forEach(function (k) {
        if (isi(g(r, k[0]))) tim.push('<span class="tag">' + k[1] + ' ' + esc(g(r, k[0])) + '</span>');
        else if (kurang.indexOf(k[0]) >= 0) tim.push('<span class="tag merah">' + k[0] + ' kosong</span>');
      });
      if (isi(g(r, 'Add-on'))) tim.push('<span class="tag">+ ' + esc(g(r, 'Add-on')) + '</span>');
      var pill = lewat ? '<span class="pill s0">Selesai</span>' : '<span class="pill s1">' + esc(g(r, 'Status') || 'Terjadwal') + '</span>';
      var cat = isi(g(r, 'Catatan')) ? '<span class="cat">' + esc(g(r, 'Catatan')) + '</span>' : '';
      return kepala + kartu(tglBox(g(r, 'Tanggal'), g(r, 'Hari')) +
        '<span class="main"><span class="nm">' + esc(g(r, 'Event').replace(/^\W+\s*/, '')) + ' <span class="sub">· ' + esc(g(r, 'Sesi')) + '</span></span>' +
        (meta.length ? '<span class="meta">' + meta.join('') + '</span>' : '') + (tim.length ? '<span class="meta">' + tim.join('') + '</span>' : '') + cat + '</span>' + pill,
        ' ev' + (lewat ? ' past' : '') + (intern ? ' internal' : '') + (kurang.length ? ' merah' : ''), i, boleh && (!D.cekBaris || !!r._src));
    }).join('');
    $('evList').innerHTML = (f === 'kosong' ? '<p class="dk-saring">Hanya sesi yang FG 1 / VG-nya masih kosong · <button type="button" class="linkbtn" data-semua="event">tampilkan semua</button></p>' : '') +
      (h || '<div class="empty">Tidak ada event' + (q || f ? ' yang cocok.' : '.') + '</div>') + kaki('event');
  }

  /* ---------- Tugas Foto ---------- */
  function ketKelas(k) {
    k = k.toLowerCase();
    return /telat|terlambat|lewat/.test(k) ? 's3' : /tepat/.test(k) ? 's2' : /segera/.test(k) ? 's1' : 's0';
  }
  function stFoto(r) { var s = g(r, 'Status foto').toLowerCase(), k = g(r, 'Keterangan').toLowerCase(); return s === 'selesai' ? 'selesai' : /belum sesi/.test(k) ? 'nanti' : s === 'dikerjakan' ? 'proses' : 'antre'; }
  /* Klien di Upcoming yang belum ada di tab TUGAS FOTO ikut ditampilkan, supaya editor tinggal mengisi nama.
     Kartu ini memakai baris EVENT DATA yang sama (_src), jadi tersimpan lewat "dbUbah" seperti kartu lain. */
  function kunciSesi(tgl, ev, sesi) {
    var m = String(tgl || '').match(/(\d{1,2})\s*\/\s*(\d{1,2})/);
    return (m ? +m[1] + '/' + +m[2] : '') + '|' + String(ev || '').replace(/^\W+\s*/, '').trim().toLowerCase() + '|' + String(sesi || '').trim().toLowerCase();
  }
  function dariUpcoming(rows) {
    if (!D.event || !D.event.ada) return rows;
    var ada = {};
    rows.forEach(function (r) { ada[kunciSesi(g(r, 'Tanggal sesi'), g(r, 'Event'), g(r, 'Sesi'))] = 1; });
    var tambah = [];
    D.event.baris.forEach(function (e) {
      if (!(isi(g(e, 'Event')) || isi(g(e, 'Sesi'))) || /internal/i.test(g(e, 'Event')) || /batal/i.test(g(e, 'Status'))) return;
      var k = kunciSesi(g(e, 'Tanggal'), g(e, 'Event'), g(e, 'Sesi'));
      if (ada[k]) return; ada[k] = 1;
      var lewat = /selesai/i.test(g(e, 'Status'));
      tambah.push({ 'Tanggal sesi': g(e, 'Tanggal'), 'Sesi': g(e, 'Sesi'), 'Event': g(e, 'Event'), 'FG 1': g(e, 'FG 1'),
        'Editor foto': g(e, 'Editor foto'), 'Status foto': g(e, 'Status foto'), 'Keterangan': lewat ? '' : 'Belum sesi', _src: e._src, _upcoming: 1 });
    });
    return rows.concat(tambah);
  }
  function viewFoto() {
    var t = D.foto;
    if (!t.ada) return kosong('foList', 'Tab TUGAS FOTO tidak ditemukan di spreadsheet.', 'foto');
    $('foBulan').innerHTML = bulanLabel(t);
    var rows = dariUpcoming(t.baris.filter(function (r) { return isi(g(r, 'Event')) || isi(g(r, 'Sesi')); }));
    var st = stFoto;
    var c = { antre: 0, proses: 0, selesai: 0 }; rows.forEach(function (r) { if (c[st(r)] != null) c[st(r)]++; });
    var telat = info(t, 'Terlambat') || '0', nanti = rows.length - c.antre - c.proses - c.selesai, tanpaEd = rows.filter(kurangFoto).length;
    hero('fo', 'Tugas edit foto', judulBulan(info(t, 'Bulan')),
      '<b>' + rows.length + ' tugas edit</b> bulan ini. ' + c.antre + ' antre, ' + c.proses + ' dikerjakan, ' + c.selesai + ' selesai' +
      (nanti > 0 ? ', ' + nanti + ' belum sesi' : '') + (+telat > 0 ? ' · <b>' + esc(telat) + ' terlambat</b>' : '') +
      (tanpaEd ? ' · <b class="dk-merah">' + tanpaEd + ' belum ada editor</b>.' : '.'),
      { label: 'Progres edit foto', selesai: c.selesai, total: rows.length, bagian: [[c.selesai, 'b2'], [c.proses, 'b1'], [c.antre + nanti, 'b0']] });
    ringkas('foSum', [['antre', c.antre, 'Antre'], ['proses', c.proses, 'Dikerjakan · ' + telat + ' terlambat', +telat > 0], ['selesai', c.selesai, 'Selesai']], 'foto');
    var editors = []; rows.forEach(function (r) { var e = g(r, 'Editor foto'); if (isi(e) && editors.indexOf(e) < 0) editors.push(e); });
    chips('foEd', 'Editor', editors.sort(), F.foto.ed, 'foto', 'ed');
    var q = F.foto.q, f = F.foto.f, ed = F.foto.ed;
    var urut = { antre: 1, proses: 0, selesai: 2, nanti: 3 };
    var list = rows.filter(function (r) { return (!f || st(r) === f) && (!ed || g(r, 'Editor foto') === ed) && cocok(q, [g(r, 'Event'), g(r, 'Sesi'), g(r, 'Editor foto'), g(r, 'FG 1')].join(' ')); });
    list = list.map(function (r, i) { return [r, i]; }).sort(function (a, b) { return (urut[st(a[0])] - urut[st(b[0])]) || a[1] - b[1]; }).map(function (x) { return x[0]; });
    LIST.foto = list;
    var judulGrup = { proses: 'Dikerjakan', antre: 'Antre', selesai: 'Selesai', nanti: 'Belum sesi' }, last = '', h = '';
    var jml = {}; list.forEach(function (r) { jml[st(r)] = (jml[st(r)] || 0) + 1; });
    list.forEach(function (r, i) {
      var s = st(r);
      if (s !== last) { last = s; h += grup(judulGrup[s], jml[s], 'tugas'); }
      var meta = ['<span class="tag">' + esc(g(r, 'Tanggal sesi')) + '</span>'];
      if (isi(g(r, 'Editor foto'))) meta.push('<span>Editor ' + esc(g(r, 'Editor foto')) + '</span>');
      else if (kurangFoto(r)) meta.push('<span class="tag merah">Editor foto kosong</span>');
      if (isi(g(r, 'FG 1'))) meta.push('<span>FG ' + esc(g(r, 'FG 1')) + '</span>');
      if (isi(g(r, 'Deadline')) && s !== 'selesai') meta.push('<span>Deadline ' + esc(g(r, 'Deadline')) + '</span>');
      if (isi(g(r, 'Tgl selesai'))) meta.push('<span>Selesai ' + esc(g(r, 'Tgl selesai')) + '</span>');
      var ket = g(r, 'Keterangan');
      h += kartu('<span class="dk-av">' + esc(inisial(g(r, 'Event'))) + '</span><span class="main"><span class="nm">' + esc(g(r, 'Event')) + ' <span class="sub">· ' + esc(g(r, 'Sesi')) + '</span></span><span class="meta">' + meta.join('') + '</span></span>' +
        (ket ? '<span class="pill ' + ketKelas(ket) + '">' + esc(ket) + '</span>' : ''), (s === 'selesai' ? ' done' : '') + (kurangFoto(r) ? ' merah' : ''), i, bisaUbah() && (!D.cekBaris || !!r._src));
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
    var tanpaPj = rows.filter(kurangVideo).length;
    hero('vi', 'Tugas edit video', bulan.length === 1 ? judulBulan(bulan[0]) : 'Tugas <em>video</em>',
      '<b>' + rows.length + ' tugas video</b>' + (bulan.length > 1 ? ' (' + esc(bulan.join(', ')) + ')' : bulan.length ? ' bulan ini' : '') + '. ' +
      c.antre + ' antre, ' + c.proses + ' dikerjakan, ' + c.selesai + ' selesai' + (telat ? ' · <b>' + telat + ' terlambat</b>' : '') +
      (tanpaPj ? ' · <b class="dk-merah">' + tanpaPj + ' belum ada penanggung jawab</b>.' : '.'),
      { label: 'Progres edit video', selesai: c.selesai, total: rows.length, bagian: [[c.selesai, 'b2'], [c.proses, 'b1'], [c.antre, 'b0']] });
    ringkas('viSum', [['antre', c.antre, 'Antre / lainnya'], ['proses', c.proses, 'Dikerjakan' + (telat ? ' · ' + telat + ' terlambat' : ''), telat > 0], ['selesai', c.selesai, 'Selesai']], 'video');
    var pj = []; rows.forEach(function (r) { var e = g(r, 'Penanggung jawab'); if (isi(e) && pj.indexOf(e) < 0) pj.push(e); });
    chips('viPj', 'Penanggung jawab', pj.sort(), F.video.pj, 'video', 'pj');
    var q = F.video.q, f = F.video.f, p = F.video.pj;
    var list = rows.filter(function (r) { return (!f || st(r) === f) && (!p || g(r, 'Penanggung jawab') === p) && cocok(q, [g(r, 'Sesi'), g(r, 'Jenis tugas'), g(r, 'Penanggung jawab'), g(r, 'Catatan / link hasil')].join(' ')); });
    var urutV = { proses: 0, antre: 1, selesai: 2 };
    list = list.map(function (r, i) { return [r, i]; }).sort(function (a, b) { return (urutV[st(a[0])] - urutV[st(b[0])]) || a[1] - b[1]; }).map(function (x) { return x[0]; });
    LIST.video = list;
    var jml = {}, lastV = '', judulV = { proses: 'Dikerjakan', antre: 'Antre / lainnya', selesai: 'Selesai' };
    list.forEach(function (r) { jml[st(r)] = (jml[st(r)] || 0) + 1; });
    var h = bisaUbah() ? '<button type="button" class="item add" data-tambah="1"><span class="plus">＋</span><span class="main"><span class="nm">Tambah tugas video</span><span class="meta">Masuk ke tab TUGAS VIDEO di spreadsheet</span></span></button>' : '';
    h += list.map(function (r, i) {
      var meta = [], kepala = '';
      if (st(r) !== lastV) { lastV = st(r); kepala = grup(judulV[lastV], jml[lastV], 'tugas'); }
      if (isi(g(r, 'Jenis tugas'))) meta.push('<span class="tag">' + esc(g(r, 'Jenis tugas')) + '</span>');
      if (isi(g(r, 'Tanggal sesi'))) meta.push('<span>Sesi ' + esc(g(r, 'Tanggal sesi')) + '</span>');
      if (isi(g(r, 'Penanggung jawab'))) meta.push('<span>PJ ' + esc(g(r, 'Penanggung jawab')) + '</span>');
      else if (kurangVideo(r)) meta.push('<span class="tag merah">Penanggung jawab kosong</span>');
      if (isi(g(r, 'Deadline')) && st(r) !== 'selesai') meta.push('<span>Deadline ' + esc(g(r, 'Deadline')) + (isi(g(r, 'Sisa hari')) ? ' (sisa ' + esc(g(r, 'Sisa hari')) + ' hari)' : '') + '</span>');
      if (isi(g(r, 'Tanggal selesai'))) meta.push('<span>Selesai ' + esc(g(r, 'Tanggal selesai')) + '</span>');
      var ket = g(r, 'Keterangan') || g(r, 'Status'), cat = g(r, 'Catatan / link hasil');
      // link di catatan tidak dijadikan <a> bila kartu bisa diketuk (tombol tidak boleh berisi link) — buka lewat form
      return kepala + kartu('<span class="dk-av">' + esc(inisial(klienDariSesi(g(r, 'Sesi')))) + '</span><span class="main"><span class="nm">' + esc(g(r, 'Sesi')) + '</span><span class="meta">' + meta.join('') + '</span>' +
        (isi(cat) ? '<span class="cat">' + (bisaUbah() ? esc(cat) : linkify(cat)) + '</span>' : '') + '</span>' +
        (ket ? '<span class="pill ' + (st(r) === 'selesai' ? 's2' : ketKelas(ket)) + '">' + esc(ket) + '</span>' : ''), (st(r) === 'selesai' ? ' done' : '') + (kurangVideo(r) ? ' merah' : ''), i);
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
  // kolom wajib: label diberi tanda, kotak merah selama masih kosong
  function wajib(ids) {
    ids.forEach(function (id) {
      var el = $(id); if (!el) return;
      var lb = $('dbSheet').querySelector('label[for="' + id + '"]');
      if (lb && !lb.querySelector('.wjb')) lb.insertAdjacentHTML('beforeend', ' <span class="wjb">wajib</span>');
      var cek = function () { var k = !String(el.value || '').trim(); el.classList.toggle('kosong', k); if (lb) lb.classList.toggle('kosong', k); };
      el.addEventListener('change', cek); el.addEventListener('input', cek); cek();
    });
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
    wajib(['dbf_ed']);
    $('dbf_st').onchange = function () { if (/^selesai$/i.test(this.value) && !$('dbf_ok').value) $('dbf_ok').value = hariIniISO(); };
    var kirim = function (ubah) {
      var n = Object.keys(ubah).length;
      if (!n) { tutup(); return; }
      simpan({ action: 'dbUbah', tab: 'foto', row: r._src || '', kunci: { tgl: g(r, 'Tanggal sesi'), event: g(r, 'Event'), sesi: g(r, 'Sesi') }, fields: ubah },
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
    wajib(baru ? ['dbv_jenis', 'dbv_sesi', 'dbv_pj'] : ['dbv_pj']);
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

  function teks(id, label, nilai, ph) {
    return '<label class="f" for="' + id + '">' + label + '</label><input class="inp" id="' + id + '" autocomplete="off"' + (ph ? ' placeholder="' + esc(ph) + '"' : '') + ' value="' + esc(nilai) + '">';
  }
  function bukaEvent(r) {
    var P = D.pilihan || {}, nm = [];
    D.event.baris.forEach(function (x) { ['FG 1', 'FG 2', 'VG', 'Support'].forEach(function (k) { nm.push(g(x, k)); }); });
    var tim = gabung(P.tim && P.tim.length ? P.tim : nm.sort());
    var F_ = [['jam', 'Jam'], ['lok', 'Lokasi'], ['addon', 'Add-on'], ['fg1', 'FG 1'], ['fg2', 'FG 2'], ['vg', 'VG'], ['sup', 'Support'], ['st', 'Status'], ['cat', 'Catatan']];
    var awal = {}; F_.forEach(function (x) { awal[x[0]] = g(r, x[1]); });
    var timSel = function (k, label) { return pilih('dbe_' + k, label, awal[k], tim, '— kosong —'); };
    var hari = g(r, 'Hari');
    bukaSheet('<h2>' + esc(g(r, 'Event').replace(/^\W+\s*/, '')) + ' · ' + esc(g(r, 'Sesi')) + '</h2>' +
      '<p class="note">' + esc(hari ? hari + ', ' : '') + esc(g(r, 'Tanggal')) + (isi(g(r, 'Sesi ke')) ? ' · Sesi ' + esc(g(r, 'Sesi ke')) : '') + '</p>' +
      '<form id="dbForm"><div class="box"><h3>Waktu & tempat</h3>' +
      teks('dbe_jam', 'Jam', awal.jam, 'mis. 08.00') + teks('dbe_lok', 'Lokasi', awal.lok, 'mis. Gedung Balla Lompoa') +
      (P.addon && P.addon.length ? pilih('dbe_addon', 'Add-on', awal.addon, P.addon, '— tidak ada —') : teks('dbe_addon', 'Add-on', awal.addon, 'mis. Mini Studio')) +
      '</div><div class="box"><h3>Tim</h3><div class="kb-2"><div>' + timSel('fg1', 'FG 1') + '</div><div>' + timSel('fg2', 'FG 2') + '</div></div>' +
      '<div class="kb-2"><div>' + timSel('vg', 'VG') + '</div><div>' + timSel('sup', 'Support') + '</div></div></div>' +
      '<div class="box"><h3>Status & catatan</h3>' + pilih('dbe_st', 'Status', awal.st, gabung(P.stEvent && P.stEvent.length ? P.stEvent : ['Terjadwal', 'Selesai']), '— belum diisi —') +
      teks('dbe_cat', 'Catatan', awal.cat) + '</div>' + tombolForm('Simpan') + '</form>');
    pasangUmum();
    if (!internal(r) && g(r, 'Status').toLowerCase().indexOf('selesai') < 0) wajib(['dbe_fg1', 'dbe_vg']);
    $('dbForm').onsubmit = function (ev) {
      ev.preventDefault();
      var ubah = {};
      F_.forEach(function (x) { var v = $('dbe_' + x[0]).value.replace(/\s+/g, ' ').trim(); if (v !== awal[x[0]]) ubah[x[0]] = v; });
      if (!Object.keys(ubah).length) { tutup(); return; }
      simpan({ action: 'dbUbah', tab: 'event', row: r._src || '', kunci: { tgl: g(r, 'Tanggal'), event: g(r, 'Event'), sesi: g(r, 'Sesi') }, fields: ubah }, 'Jadwal tersimpan ke spreadsheet', 'event');
    };
  }

  function klik(view) {
    return function (ev) {
      var semua = ev.target.closest('[data-semua]');
      if (semua) { F[view].f = ''; tampilkan(view); return; }
      if (!bisaUbah() || ev.target.closest('a') || (view === 'event' && !bisaEvent())) return;
      if (view === 'video' && ev.target.closest('[data-tambah]')) { bukaVideo(null); return; }
      var it = ev.target.closest('[data-i]'); if (!it) return;
      var r = LIST[view][+it.getAttribute('data-i')]; if (!r) return;
      if (view === 'video' && !r._row) { toast('Muat ulang dulu (tombol ↻), lalu coba lagi.'); return; }
      ({ event: bukaEvent, foto: bukaFoto, video: bukaVideo })[view](r);
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

  /* ---------- TEMA: tampilan semua tab disamakan dengan tab Data Klien (Studio.html) ---------- */
  var TEMA = [
    '.tls.dk{--bg:#F1EEEA;--card:#fff;--ink:#1D1A1B;--muted:#77706B;--line:#E7E1DA;--soft:#F3EEE8;--aksen:#B08A57;--plum:#4B2A3A;--plum-tua:#2E1A24;--emas-muda:#D9C2A0;--kabut:#C9B8BF;background:var(--bg);font-family:"Plus Jakarta Sans",system-ui,sans-serif}',
    '.tls.dk header{background:var(--plum-tua);border-bottom:0;-webkit-backdrop-filter:none;backdrop-filter:none;color:#F3EAE4;transition:box-shadow .2s}',
    '.tls.dk header.gulir{box-shadow:0 1px 0 rgba(255,255,255,.06),0 8px 24px rgba(46,26,36,.25)}',
    '.tls.dk .logo{height:24px;filter:brightness(0) invert(.9) sepia(.35) saturate(1.4)}',
    '.tls.dk .hd small{color:var(--emas-muda);letter-spacing:.02em;text-transform:none;font-size:12px;margin-top:4px}',
    '.tls.dk .icon-btn{background:transparent;border-color:rgba(243,234,228,.22);color:#F3EAE4}',
    '.dk-hero{position:relative;overflow:hidden;background:var(--plum-tua);color:#F3EAE4;padding:24px 0 44px}',
    '.dk-hero::before{content:"";position:absolute;inset:0;pointer-events:none;background:radial-gradient(90% 70% at 92% 0%,rgba(176,138,87,.26),transparent 62%),radial-gradient(70% 60% at 0% 100%,rgba(107,66,84,.55),transparent 70%)}',
    '.dk-hero::after{content:"";position:absolute;right:-140px;top:-170px;width:440px;height:440px;border-radius:50%;pointer-events:none;border:1px solid rgba(217,194,160,.16);box-shadow:0 0 0 60px rgba(217,194,160,.035),0 0 0 120px rgba(217,194,160,.02)}',
    '.dk-hero .wrap{position:relative;z-index:1}',
    '.dk-eyebrow{display:inline-flex;align-items:center;gap:10px;font:600 11.5px/1 "Plus Jakarta Sans",sans-serif;letter-spacing:.22em;text-transform:uppercase;color:var(--emas-muda)}',
    '.dk-eyebrow::before{content:"";width:28px;height:1px;background:currentColor;opacity:.8}',
    '.dk-hero h1{font:400 clamp(46px,12vw,88px)/.95 "Bodoni Moda",Georgia,serif;letter-spacing:-.015em;color:#F7EFEA;margin:14px 0 0;text-shadow:0 6px 34px rgba(0,0,0,.4)}',
    '.dk-hero h1 em{font-style:italic;color:var(--emas-muda)}',
    '.dk-lead{margin:14px 0 0!important;color:#E6DADF!important;font-size:16px!important;line-height:1.55;max-width:48ch!important}',
    '.dk-lead b{color:#fff;font-weight:600}',
    '.dk-prog{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;margin:24px 0 10px;color:var(--kabut);font-size:11.5px;font-weight:600;letter-spacing:.16em;text-transform:uppercase}',
    '.dk-prog b{font:400 32px/1 "Bodoni Moda",serif;letter-spacing:0;color:#F7EFEA;text-transform:none}',
    '.dk-prog b small{font:500 13px/1 "Plus Jakarta Sans",sans-serif;color:var(--kabut);margin-left:4px}',
    '.dk-bar{display:flex;height:10px;border-radius:999px;overflow:hidden;background:rgba(255,255,255,.1);box-shadow:inset 0 1px 3px rgba(0,0,0,.35)}',
    '.dk-bar i{display:block}.dk-bar .b0{background:rgba(255,255,255,.2)}.dk-bar .b1{background:linear-gradient(90deg,#C9A574,#E2C79A)}.dk-bar .b2{background:linear-gradient(90deg,#5E9C74,#86BD95)}',
    '.tls.dk .dk-hero .sum{gap:10px;margin:18px 0 0}',
    '.tls.dk .dk-hero .sum button{background:rgba(46,26,36,.55);border:1px solid rgba(243,234,228,.18);border-radius:18px;padding:14px 14px 12px;color:#F3EAE4;-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);box-shadow:0 8px 22px rgba(0,0,0,.18);transition:border-color .2s,box-shadow .2s,transform .2s}',
    '.tls.dk .dk-hero .sum button b{font:400 40px/1 "Bodoni Moda",serif;color:#F7EFEA;margin-bottom:10px}',
    '.tls.dk .dk-hero .sum button span{display:flex;align-items:center;gap:7px;color:#E6DADF;font-size:12.5px;line-height:1.3}',
    '.tls.dk .dk-hero .sum button span::before{content:"";flex:0 0 6px;height:6px;border-radius:50%;background:var(--dot,#B9A7AE)}',
    '.tls.dk .sum [data-f=selesai],.tls.dk .sum [data-f=lewat]{--dot:#86BD95}.tls.dk .sum [data-f=proses],.tls.dk .sum [data-f=nanti]{--dot:#E2C79A}',
    '.tls.dk .dk-hero .sum button.warn{--dot:#F0A08F}.tls.dk .dk-hero .sum button.warn b{color:#F6B9AB}',
    '.tls.dk .dk-hero .sum button.on{border-color:var(--emas-muda);box-shadow:0 0 0 3px rgba(217,194,160,.25),0 10px 26px rgba(0,0,0,.3);transform:translateY(-2px)}',
    '.tls.dk .dk-hero .sum button:disabled{opacity:1}',
    '.tls.dk .dk-hero .chips{margin:18px -16px 0;padding:2px 16px 4px}',
    '.tls.dk .dk-hero .chips .chiplbl{color:var(--kabut);letter-spacing:.14em;text-transform:uppercase;font-size:11px;font-weight:600}',
    '.tls.dk .dk-hero .chips button{border:1px solid rgba(243,234,228,.24);background:rgba(46,26,36,.62);color:#EFE4DD;font-weight:500;-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px)}',
    '.tls.dk .dk-hero .chips button.on{background:var(--emas-muda);border-color:rgba(255,255,255,.35);color:var(--plum-tua);font-weight:600}',
    '.tls.dk main.wrap{position:relative}',
    '.tls.dk .dk-hero + main{position:relative;z-index:2;margin-top:-26px}.tls.dk .dk-hero + main .search{margin-top:0}',
    '.tls.dk .search{position:relative;z-index:2;margin:-26px 0 18px;border:0;border-radius:16px;padding:14px 16px 14px 46px;font-size:15px;background:#fff url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%2377706B%27 stroke-width=%272%27 stroke-linecap=%27round%27%3E%3Ccircle cx=%2711%27 cy=%2711%27 r=%276.5%27/%3E%3Cpath d=%27M16 16l4.5 4.5%27/%3E%3C/svg%3E") no-repeat 16px 50%/18px;box-shadow:0 10px 30px rgba(46,26,36,.12)}',
    '.tls.dk .list{gap:12px;padding-bottom:36px}',
    '.tls.dk .grp{align-self:flex-start;display:inline-flex;align-items:baseline;gap:8px;margin:14px 0 0;padding:6px 16px 7px;border-radius:999px;background:rgba(251,250,248,.9);box-shadow:0 1px 2px rgba(46,26,36,.06);font:400 23px/1.1 "Bodoni Moda",Georgia,serif;letter-spacing:0;text-transform:none;color:var(--ink)}',
    '.tls.dk .grp small{font:500 12.5px/1 "Plus Jakarta Sans",sans-serif;color:var(--plum)}',
    '.tls.dk .item{border:0;border-radius:18px;background:var(--card);padding:14px 16px;gap:14px;box-shadow:0 1px 2px rgba(46,26,36,.05),0 8px 24px rgba(46,26,36,.06)}',
    '.tls.dk button.item{transition:transform .15s,box-shadow .2s}',
    '@media (hover:hover){.tls.dk button.item:hover{box-shadow:0 1px 2px rgba(46,26,36,.06),0 12px 30px rgba(46,26,36,.12)}}',
    '.tls.dk .item .nm{font-size:16px;font-weight:600}',
    '.tls.dk .item .meta{font-size:12.5px;gap:6px 8px}',
    '.tls.dk .tag{background:#F5EEF1;color:var(--plum);font-weight:600}',
    '.tls.dk .item .cat{background:var(--soft)}',
    '.tls.dk .date,.dk-av{flex:0 0 52px;height:52px;border-radius:12px;background:linear-gradient(145deg,#C9A574,#94703F);color:#fff;display:grid;place-items:center;font:400 21px/1 "Bodoni Moda",Georgia,serif;letter-spacing:.02em;box-shadow:inset 0 1px 0 rgba(255,255,255,.28),0 4px 12px rgba(148,112,63,.25)}',
    '.tls.dk .date{display:flex;flex-direction:column;gap:3px;padding:0}',
    '.tls.dk .date b{font:400 23px/1 "Bodoni Moda",Georgia,serif;color:#fff}',
    '.tls.dk .date small{font:600 9.5px/1 "Plus Jakarta Sans",sans-serif;letter-spacing:.14em;color:rgba(255,255,255,.85)}',
    '.tls.dk .item.past,.tls.dk .item.done{opacity:1}',
    '.tls.dk .item.past .date,.tls.dk .item.done .dk-av{background:linear-gradient(145deg,#CFC7BF,#A39A91);box-shadow:none}',
    '.tls.dk .item.past .nm,.tls.dk .item.done .nm{color:var(--muted)}',
    '.tls.dk .item.internal{background:#fff}',
    '.tls.dk .item.internal .date{background:linear-gradient(145deg,#7A5266,#4B2A3A)}',
    '.tls.dk .item.add{background:rgba(251,250,248,.7);border:1.5px dashed #D8CFC5;box-shadow:none}',
    '.tls.dk .item .plus{flex:0 0 52px;height:52px;border-radius:12px;background:var(--plum);color:#fff}',
    '.tls.dk .pill.s0{background:#EFEAE4;color:#6F675E}',
    '.tls.dk .foot{color:var(--muted)}',
    '.tls.dk .box{border:0;border-radius:18px;box-shadow:0 1px 2px rgba(46,26,36,.05),0 8px 24px rgba(46,26,36,.06)}',
    '.tls .btn.primary{background:var(--plum,#4B2A3A);border-color:var(--plum,#4B2A3A)}',
    '.tls.dk-ov{--plum:#4B2A3A;--bg:#F1EEEA;--aksen:#B08A57}',
    '.tls.dk-ov .sheet h2{font:400 28px/1.12 "Bodoni Moda",Georgia,serif;letter-spacing:-.01em}',
    '.tls.dk-ov .box{border:0;border-radius:16px;box-shadow:0 1px 2px rgba(46,26,36,.05),0 6px 18px rgba(46,26,36,.05)}',
    '.tls.dk-ov select.inp{appearance:none;-webkit-appearance:none;background:#fff url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%2377706B%27 stroke-width=%272%27 stroke-linecap=%27round%27%3E%3Cpath d=%27M7 10l5 5 5-5%27/%3E%3C/svg%3E") no-repeat right 12px center/16px;padding-right:36px}',
    '.tls.dk .item.merah{background:#FFF7F5;box-shadow:inset 4px 0 0 #C9473A,0 1px 2px rgba(46,26,36,.05),0 8px 24px rgba(46,26,36,.06)}',
    '.tls.dk-ov .wjb{background:#EFEAE4;color:#6F675E}',
    '.tls.dk .tag.merah,.tls.dk-ov label.f.kosong .wjb{background:#F9E0DA;color:#B3352A}',
    '.dk-merah{color:#F6B9AB!important}',
    '.tls.dk .dk-hero .sum [data-f=kosong]{cursor:pointer}',
    '.tls.dk .dk-hero .sum [data-f=kosong]::after{content:"Ketuk untuk melihat";display:block;margin-top:6px;font-size:11px;color:#F6B9AB;letter-spacing:.02em}',
    '.tls.dk .dk-hero .sum [data-f=kosong].on::after{content:"Ketuk lagi untuk semua"}',
    '.tls.dk .dk-saring{margin:2px 2px 0;font-size:13px;color:#B3352A}',
    '.tls.dk-ov .wjb{font-size:10.5px;font-weight:600;border-radius:999px;padding:1px 7px;margin-left:4px;letter-spacing:.02em}',
    '.tls.dk-ov label.f.kosong{color:#B3352A}',
    '.tls.dk-ov .inp.kosong{border-color:#C9473A;background-color:#FFF4F1;box-shadow:0 0 0 3px rgba(201,71,58,.12)}',
    '.tls.dk{isolation:isolate}',
    '.dk-latar{position:fixed;inset:0;z-index:-1;pointer-events:none;overflow:hidden;background:var(--bg)}',
    '.dk-latar figure{position:absolute;margin:0;transform:rotate(var(--r));box-shadow:0 10px 26px rgba(46,26,36,.22);opacity:0;transition:opacity 1.2s ease;transition-delay:var(--d)}',
    '.dk-latar figure.ok{opacity:1}',
    '.dk-latar figure.cetak{background:#F6F0E7;padding:6px 6px 22px;border-radius:2px}',
    '.dk-latar figure.pita::before{content:"";position:absolute;left:50%;top:-9px;width:54px;height:18px;margin-left:-27px;background:rgba(233,220,196,.82);transform:rotate(-3deg);box-shadow:0 1px 2px rgba(0,0,0,.08)}',
    '.dk-latar img{display:block;width:100%;height:100%;object-fit:cover;filter:sepia(.18) saturate(.9) contrast(.96)}',
    '.dk-latar::after{content:"";position:absolute;inset:0;z-index:20;background:radial-gradient(120% 90% at 50% 40%,rgba(243,239,233,.58),rgba(243,239,233,.7))}',
    '.dk-arsip{position:absolute;inset:0;z-index:0;pointer-events:none;overflow:hidden;opacity:0;transition:opacity 1.4s ease}',
    '.dk-arsip.ada{opacity:1}',
    '.dk-arsip figure{position:absolute;margin:0;width:clamp(120px,calc(var(--w) * 1%),230px);aspect-ratio:3/2;background:#EFE6DA;padding:5px 5px 14px;border-radius:2px;box-shadow:0 14px 30px rgba(0,0,0,.4);transform:rotate(var(--r))}',
    '.dk-arsip img{display:block;width:100%;height:100%;object-fit:cover;filter:sepia(.4) saturate(.7) contrast(.92) brightness(.92)}',
    '.dk-arsip::after{content:"";position:absolute;inset:0;z-index:1;background:linear-gradient(0deg,rgba(46,26,36,.95) 0%,rgba(46,26,36,0) 34%),linear-gradient(90deg,rgba(46,26,36,.97) 0%,rgba(46,26,36,.9) 38%,rgba(46,26,36,.6) 68%,rgba(46,26,36,.42) 100%)}',
    '@media (max-width:640px){.dk-arsip::after{background:linear-gradient(0deg,rgba(46,26,36,.96) 0%,rgba(46,26,36,.2) 40%),linear-gradient(180deg,rgba(46,26,36,.72),rgba(46,26,36,.8))}}',
    '@media (prefers-reduced-motion:reduce){.dk-latar figure,.dk-arsip{transition:none}}',
    '@media (max-width:420px){.tls.dk .dk-hero .sum button{padding:12px 11px 11px;border-radius:15px}.tls.dk .dk-hero .sum button b{font-size:34px}}'
  ].join('\n');
  var HERO = { evView: ['ev', ['evSum'], 'evBulan'], foView: ['fo', ['foSum', 'foEd'], 'foBulan'], viView: ['vi', ['viSum', 'viPj'], 'viBulan'], kbView: ['kb', [], ''] };
  /* ---------- latar kolase foto (sama dengan tab Data Klien; foto dari studioArsip di Kode.gs) ---------- */
  var ARSIP = null;
  var SLOT = {   // posisi cetakan foto di kepala (persen) — layar lebar / sempit
    lebar: [[34, -6, 17], [52, 4, 18], [71, -8, 17], [88, 4, 16], [40, 36, 16], [58, 42, 17], [77, 34, 18], [32, 70, 15], [66, 74, 16]],
    sempit: [[-8, -4, 40], [30, -8, 40], [68, 0, 40], [8, 26, 38], [46, 30, 40], [84, 28, 36], [-6, 58, 40], [34, 62, 38], [72, 60, 40]]
  };
  function thumb(id, w) { return 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(id) + '&sz=w' + w; }
  function gambar(f, id, w, ok) {
    var im = new Image(); im.alt = ''; im.decoding = 'async'; im.referrerPolicy = 'no-referrer';
    im.onload = function () { f.classList.add('ok'); if (ok) ok(); }; im.onerror = function () { f.remove(); };
    im.src = thumb(id, w); f.appendChild(im);
  }
  function latarHalaman(box) {      // cetakan foto berserakan di belakang daftar
    var W = innerWidth, H = innerHeight, kolom = W < 640 ? 3 : 5, sel = W / kolom, tinggiSel = sel * 0.78;
    var baris = Math.ceil(H / tinggiSel) + 1, rnd = function (a, b) { return a + Math.random() * (b - a); }, RASIO = [3 / 2, 4 / 5, 1, 3 / 2, 4 / 5], n = 0;
    box.innerHTML = '';
    for (var r = 0; r < baris; r++) for (var c = 0; c < kolom; c++) {
      var lebar = sel * rnd(.78, 1.12), rasio = RASIO[Math.floor(Math.random() * RASIO.length)], cetak = Math.random() < .6;
      var tinggi = lebar / rasio + (cetak ? 16 : 0), x = (c + .5 + rnd(-.28, .28)) * sel - lebar / 2, y = (r + .5 + rnd(-.3, .3)) * tinggiSel - tinggi / 2;
      var f = document.createElement('figure');
      f.className = (cetak ? 'cetak' : '') + (Math.random() < .22 ? ' pita' : '');
      f.style.cssText = 'left:' + x.toFixed(0) + 'px;top:' + y.toFixed(0) + 'px;width:' + lebar.toFixed(0) + 'px;height:' + tinggi.toFixed(0) + 'px;--r:' + rnd(-9, 9).toFixed(1) +
        'deg;z-index:' + Math.floor(rnd(1, 9)) + ';--d:' + (n * 40) + 'ms';
      gambar(f, ARSIP[n % ARSIP.length], 400); box.appendChild(f); n++;
    }
  }
  function latarKepala(box) {       // cetakan foto di belakang judul bulan
    var slot = innerWidth < 640 ? SLOT.sempit : SLOT.lebar, siap = 0;
    box.innerHTML = '';
    ARSIP.slice(0, slot.length).forEach(function (id, i) {
      var f = document.createElement('figure'), p = slot[i];
      f.style.cssText = 'left:' + p[0] + '%;top:' + p[1] + '%;--w:' + p[2] + ';--r:' + (Math.random() * 14 - 7).toFixed(1) + 'deg';
      gambar(f, id, 480, function () { if (++siap === 2) box.classList.add('ada'); });
      box.appendChild(f);
    });
  }
  function muatArsip() {
    api({ action: 'arsip', jumlah: 30 }).then(function (ids) {
      if (!ids || !ids.length) return;
      ARSIP = ids;
      Object.keys(HERO).forEach(function (id) {
        var v = $(id); if (!v || !v.classList.contains('dk')) return;
        latarHalaman(v.querySelector('.dk-latar')); latarKepala(v.querySelector('.dk-arsip'));
      });
    }).catch(function () { });   // server lama / tanpa foto: latar polos
  }

  function pasangTema() {
    if (!$('dkTema')) { var st = document.createElement('style'); st.id = 'dkTema'; st.textContent = TEMA; document.head.appendChild(st); }
    Object.keys(HERO).forEach(function (id) {
      var v = $(id), x = HERO[id]; if (!v || v.classList.contains('dk')) return;
      var hdr = v.querySelector('header'); if (!hdr) return;
      v.classList.add('dk');
      var sec = document.createElement('section'); sec.className = 'dk-hero'; sec.id = x[0] + 'Hero';
      sec.innerHTML = '<div class="dk-arsip" aria-hidden="true"></div><div class="wrap"><div class="dk-teks"></div><div class="dk-slot"></div></div>';
      hdr.parentNode.insertBefore(sec, hdr.nextSibling);
      var lt = document.createElement('div'); lt.className = 'dk-latar'; lt.setAttribute('aria-hidden', 'true'); v.insertBefore(lt, v.firstChild);
      x[1].forEach(function (k) { if ($(k)) sec.querySelector('.dk-slot').appendChild($(k)); });
      if (x[2] && $(x[2])) $(x[2]).classList.add('hidden');
      v.addEventListener('scroll', function () { hdr.classList.toggle('gulir', v.scrollTop > 8); }, { passive: true });
    });
    if (kunci()) muatArsip();
    hero('kb', 'Klien baru', 'Klien <em>baru</em>', 'Isi nama klien dan setiap sesinya. Tiap sesi menjadi satu baris jadwal.');
  }

  window.DashboardTab = {
    init: function () {
      [['event', 'evQ', 'evRefresh'], ['foto', 'foQ', 'foRefresh'], ['video', 'viQ', 'viRefresh']].forEach(function (x) {
        $(x[1]).oninput = function (e) { F[x[0]].q = e.target.value; tampilkan(x[0]); };
        $(x[2]).onclick = function () { muat(x[0], true); };
      });
      pasangTema();
      var ov = document.createElement('div'); ov.id = 'dbOv'; ov.className = 'tls ov dk-ov hidden';
      ov.innerHTML = '<div class="sheet" id="dbSheet" role="dialog" aria-modal="true"></div>';
      ov.onclick = function (e) { if (e.target === ov) tutup(); };
      document.body.appendChild(ov);
      var ts = document.createElement('div'); ts.id = 'dbToast'; ts.className = 'tls toast'; document.body.appendChild(ts);
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('dbOv').classList.contains('hidden')) tutup(); });
      $('evList').addEventListener('click', klik('event'));
      $('foList').addEventListener('click', klik('foto'));
      $('viList').addEventListener('click', klik('video'));
    },
    tampil: function (view) { aktif = view; if (D) tampilkan(view); else muat(view); }
  };
})();
