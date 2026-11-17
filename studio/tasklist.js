/* Tab Tasklist untuk Tepi Kata Studio.
 * Membaca spreadsheet "UPCOMING EVENT" (link CSV publikasi) langsung dari perangkat.
 * Link CSV TIDAK disimpan di kode website (repo publik) — ditempel sekali per perangkat (localStorage).
 * Logika sama dengan robot di repo privat tepikata/tasklist (scripts/sync_tasklist.py).
 */
(function () {
  var BULAN = ['JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI', 'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER'];
  var KOSONG = { '': 1, '-': 1, '?': 1, '—': 1 };
  var MULAI = [2026, 11];                       // bulan pertama yang ditampilkan
  var GITHUB = 'https://github.com/tepikata/tasklist/issues';
  var S = { data: null, bulan: null, jenis: 'jadwal', diambil: null };
  var HARI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  var $ = function (id) { return document.getElementById(id); };

  function norm(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function judul(n) { n = norm(n); return (/[a-z]/.test(n) && /[A-Z]/.test(n)) ? n : n.toLowerCase().replace(/(^|[\s(/&-])(\S)/g, function (m, a, b) { return a + b.toUpperCase(); }); }
  function kosong(v) { return !!KOSONG[norm(v)]; }
  function getLink() { try { return localStorage.getItem('tasklistCsv') || ''; } catch (e) { return ''; } }
  function setLink(v) { try { localStorage.setItem('tasklistCsv', v); } catch (e) { } }

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

  function hariIniWITA() { var d = new Date(Date.now() + 8 * 3600e3); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); }
  function tgl(y, m, d) { return new Date(Date.UTC(y, m - 1, d)); }
  function dm(s, y) { var m = String(s || '').match(/(\d{1,2})\s*\/\s*(\d{1,2})/); return m ? tgl(y, +m[2], +m[1]) : null; }

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
        edV: g('EDITOR VIDEO'), okV: g('TGL SELESAI EDIT VIDEO')
      });
    });
    return out;
  }

  function tugas(b, jenis, today) {
    var list = [];
    b.ev.slice().sort(function (a, z) { return a.day - z.day; }).forEach(function (e) {
      if (!e.ed) return;
      var lewat = tgl(b.y, b.m, e.day) < today;
      if (jenis === 'foto') {
        list.push({ day: e.day, pr: e.pr, ed: kosong(e.edF) ? '' : judul(e.edF), ok: !kosong(e.okF), okTgl: kosong(e.okF) ? '' : e.okF, dl: dm(e.dlF, b.y), lewat: lewat, vg: '' });
      } else if (!kosong(e.vg) || !kosong(e.edV)) {
        list.push({ day: e.day, pr: e.pr, ed: kosong(e.edV) ? '' : judul(e.edV), ok: !kosong(e.okV), okTgl: kosong(e.okV) ? '' : e.okV, dl: null, lewat: lewat, vg: kosong(e.vg) ? '' : judul(e.vg) });
      }
    });
    return list;
  }

  /* ---------- render ---------- */
  function baris(t, today) {
    var meta = '';
    if (t.ok) meta = '<span class="tl-ok">Selesai' + (t.okTgl ? ' ' + esc(t.okTgl) : '') + '</span>';
    else if (t.dl) meta = '<span class="' + (t.dl < today ? 'tl-late' : 'tl-dl') + '">' + (t.dl < today ? 'Lewat deadline ' : 'Deadline ') + t.dl.getUTCDate() + '/' + (t.dl.getUTCMonth() + 1) + '</span>';
    else if (!t.ed && t.vg) meta = '<span class="tl-dl">VG: ' + esc(t.vg) + '</span>';
    return '<li class="' + (t.ok ? 'done' : '') + '"><span class="tl-box" aria-hidden="true">' + (t.ok ? '✓' : '') + '</span>' +
      '<span class="tl-tgl">' + t.day + '</span><span class="tl-main"><span class="tl-pr">' + esc(judul(t.pr)) + '</span>' + meta + '</span></li>';
  }

  function tim(e) {
    var p = [], fg = [e.fg1, e.fg2].filter(function (x) { return !kosong(x); }).map(judul);
    if (fg.length) p.push('FG ' + fg.join(', '));
    if (!kosong(e.vg)) p.push('VG ' + judul(e.vg));
    if (!kosong(e.sup)) p.push('Support ' + judul(e.sup));
    return p.join(' · ');
  }
  function jadwal(b, today) {
    var ev = b.ev.slice().sort(function (a, z) { return a.day - z.day; });
    if (!ev.length) return '<p class="tl-kosong">Belum ada event di bulan ini.</p>';
    var nanti = ev.filter(function (e) { return tgl(b.y, b.m, e.day) >= today; });
    var lalu = ev.filter(function (e) { return tgl(b.y, b.m, e.day) < today; });
    function item(e) {
      var d = tgl(b.y, b.m, e.day), t = tim(e), hariIni = +d === +today;
      return '<li class="tl-ev' + (hariIni ? ' today' : '') + '"><span class="tl-date"><b>' + e.day + '</b><small>' + HARI[d.getUTCDay()] + '</small></span><span class="tl-main">' +
        '<span class="tl-pr">' + esc(judul(e.pr)) + (hariIni ? ' <em class="tl-now">Hari ini</em>' : '') + '</span>' +
        (e.jam && !kosong(e.jam) ? '<span class="tl-dl">' + esc(e.jam) + '</span>' : '') +
        (t ? '<span class="tl-team">' + esc(t) + '</span>' : '<span class="tl-late">Tim belum diisi</span>') + '</span></li>';
    }
    var h = '';
    if (nanti.length) h += '<section class="tl-grp"><h3>Akan datang<span>' + nanti.length + ' event</span></h3><ul>' + nanti.map(item).join('') + '</ul></section>';
    if (lalu.length) h += '<details class="tl-grp"' + (nanti.length ? '' : ' open') + '><summary>Sudah lewat<span>' + lalu.length + '</span></summary><ul>' + lalu.map(item).join('') + '</ul></details>';
    return h;
  }

  function render() {
    var box = $('tlIsi');
    if (!S.data) return;
    var today = hariIniWITA(), ymNow = today.getUTCFullYear() * 100 + today.getUTCMonth() + 1;
    var isJadwal = S.jenis === 'jadwal';
    var keys = Object.keys(S.data).filter(function (k) {
      var b = S.data[k], ym = b.y * 100 + b.m;
      return isJadwal ? ym >= ymNow : (b.ed && ym >= MULAI[0] * 100 + MULAI[1]);
    }).sort();
    Array.prototype.forEach.call($('tlJenis').children, function (bt) { bt.classList.toggle('on', bt.getAttribute('data-j') === S.jenis); });
    if (!keys.length) { $('tlBulan').innerHTML = ''; box.innerHTML = '<p class="tl-kosong">' + (isJadwal ? 'Belum ada event mendatang di spreadsheet.' : 'Belum ada bulan dengan kolom EDITOR FOTO di spreadsheet.') + '</p>'; return; }
    if (!S.bulan || keys.indexOf(S.bulan) < 0) {
      var now = today.getUTCFullYear() + '-' + (today.getUTCMonth() < 9 ? '0' : '') + (today.getUTCMonth() + 1);
      S.bulan = keys.indexOf(now) >= 0 ? now : keys[keys.length - 1];
    }
    $('tlBulan').innerHTML = keys.map(function (k) {
      var b = S.data[k]; return '<button type="button" data-k="' + k + '" class="' + (k === S.bulan ? 'on' : '') + '">' + BULAN[b.m - 1].charAt(0) + BULAN[b.m - 1].slice(1).toLowerCase() + ' ' + b.y + '</button>';
    }).join('');
    Array.prototype.forEach.call($('tlBulan').children, function (bt) { bt.onclick = function () { S.bulan = bt.getAttribute('data-k'); render(); }; });
    if (isJadwal) { box.innerHTML = jadwal(S.data[S.bulan], today) + kaki(); return; }

    var t = tugas(S.data[S.bulan], S.jenis, today);
    var past = t.filter(function (x) { return x.lewat; }), up = t.filter(function (x) { return !x.lewat; });
    var selesai = past.filter(function (x) { return x.ok; }).length;
    var telat = past.filter(function (x) { return !x.ok && x.dl && x.dl < today; }).length;
    var tanpa = past.filter(function (x) { return !x.ed; }).length;
    var h = '<div class="tl-sum"><div><b>' + selesai + '<small>/' + past.length + '</small></b><span>Selesai</span></div>' +
      '<div class="' + (telat ? 'warn' : '') + '"><b>' + telat + '</b><span>Lewat deadline</span></div>' +
      '<div class="' + (tanpa ? 'warn' : '') + '"><b>' + tanpa + '</b><span>Belum ada editor</span></div></div>';
    var eds = {}; past.forEach(function (x) { if (x.ed) (eds[x.ed] = eds[x.ed] || []).push(x); });
    Object.keys(eds).sort(function (a, z) { return a.toLowerCase() < z.toLowerCase() ? -1 : 1; }).forEach(function (ed) {
      var l = eds[ed], ok = l.filter(function (x) { return x.ok; }).length;
      h += '<section class="tl-grp"><h3>' + esc(ed) + '<span>' + ok + '/' + l.length + '</span></h3><div class="tl-bar"><i style="width:' + Math.round(ok / l.length * 100) + '%"></i></div><ul>' +
        l.map(function (x) { return baris(x, today); }).join('') + '</ul></section>';
    });
    var no = past.filter(function (x) { return !x.ed; });
    if (no.length) h += '<section class="tl-grp tl-warn"><h3>Belum ada editor<span>' + no.length + '</span></h3><ul>' + no.map(function (x) { return baris(x, today); }).join('') + '</ul></section>';
    if (up.length) h += '<details class="tl-grp"><summary>Event akan datang<span>' + up.length + '</span></summary><ul>' + up.map(function (x) { return baris(x, today); }).join('') + '</ul></details>';
    if (!t.length) h += '<p class="tl-kosong">Tidak ada tugas ' + (S.jenis === 'foto' ? 'foto' : 'video') + ' di bulan ini.</p>';
    box.innerHTML = h + kaki();
  }
  function kaki() {
    return '<p class="tl-foot">Data dari spreadsheet Upcoming Event' + (S.diambil ? ' · dimuat ' + S.diambil : '') + ' · <a href="' + GITHUB + '" target="_blank" rel="noopener">Tasklist di GitHub</a></p>';
  }

  function muat() {
    var link = getLink();
    $('tlSetup').classList.toggle('hidden', !!link);
    $('tlUtama').classList.toggle('hidden', !link);
    if (!link) return;
    $('tlIsi').innerHTML = '<div class="garis tl-load"><i></i></div>';
    fetch(link, { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); }).then(function (txt) {
      if (/^\s*</.test(txt)) throw new Error('bukan CSV');
      S.data = bacaJadwal(parseCSV(txt));
      var d = new Date(); S.diambil = (d.getHours() < 10 ? '0' : '') + d.getHours() + '.' + (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
      render();
    }).catch(function () {
      $('tlIsi').innerHTML = '<p class="tl-kosong">Spreadsheet tidak bisa dimuat. Periksa koneksi, atau pastikan link CSV masih dipublikasikan.<br><br>' +
        '<button type="button" class="tl-btn" id="tlUlang">Coba lagi</button> <button type="button" class="tl-btn ghost" id="tlGanti2">Ganti link</button><br><br><a href="' + GITHUB + '" target="_blank" rel="noopener">Buka tasklist di GitHub</a></p>';
      $('tlUlang').onclick = muat; $('tlGanti2').onclick = gantiLink;
    });
  }
  function gantiLink() { setLink(''); S.data = null; muat(); }

  window.TasklistTab = {
    init: function () {
      $('tlForm').onsubmit = function (e) {
        e.preventDefault();
        var v = norm($('tlLink').value);
        if (!/^https:\/\/docs\.google\.com\/spreadsheets\/.+output=csv/.test(v)) { $('tlErr').textContent = 'Link tidak dikenali. Gunakan link CSV dari "Publikasikan ke web" (berakhiran output=csv).'; return; }
        setLink(v); $('tlErr').textContent = ''; muat();
      };
      Array.prototype.forEach.call($('tlJenis').children, function (bt) { bt.onclick = function () { S.jenis = bt.getAttribute('data-j'); render(); }; });
      $('tlRefresh').onclick = muat;
      $('tlGanti').onclick = gantiLink;
    },
    tampil: function () { if (!S.data) muat(); }
  };
})();
