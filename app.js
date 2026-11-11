/* Kaizen v1.0 — suivi CrossFit, DarkZone et endurance.
   Les données vivent dans le Google Sheet "Kaizen", lu et écrit via une passerelle Apps Script. */
(function () {
  'use strict';

  var VERSION = '1.0.0';
  var CFG_KEY = 'kaizen.config';
  var DB_NAME = 'kaizen';

  // ---------- Utilitaires ----------
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function num(v) { if (v === '' || v == null) return null; var n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.')); return isFinite(n) ? n : null; }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parseD(s) { var p = String(s).slice(0, 10).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function addDays(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function monday(d) { var x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); var k = (x.getDay() + 6) % 7; return addDays(x, -k); }
  function today() { var d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  var MO = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  var MOL = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  var DOW = ['DIM', 'LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM'];
  var DOWL = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  function fmtDay(s) { var d = parseD(s); return d.getDate() + ' ' + MO[d.getMonth()] + ' ' + d.getFullYear(); }
  function fmtDayShort(s) { var d = parseD(s); return DOWL[d.getDay()].slice(0, 3) + '. ' + d.getDate(); }
  function fmtMonthYear(s) { var d = parseD(s); return MO[d.getMonth()] + ' ' + d.getFullYear(); }
  function fmtTime(sec) { sec = Math.round(sec); var h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60; return h ? h + ':' + pad(m) + ':' + pad(s) : m + ':' + pad(s); }
  function fmtDur(min) { min = Math.round(min); var h = Math.floor(min / 60), m = min % 60; return h ? h + ' h ' + pad(m) : m + ' min'; }
  function fmtNum(n, d) { if (n == null) return '—'; var f = d == null ? (Math.round(n) === n ? 0 : 1) : d; return n.toFixed(f).replace('.', ','); }
  function fmtKg(n) { return fmtNum(Math.round(n * 2) / 2) + ' kg'; }
  function round05(n) { return Math.round(n * 2) / 2; }
  function uid(prefix) { return prefix + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function icon(path) { return '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="' + path + '"/></svg>'; }
  var I = { left: 'M15 6l-6 6 6 6', right: 'M9 6l6 6-6 6', plus: 'M12 5v14M5 12h14', down: 'M6 9l6 6 6-6', up: 'M6 15l6-6 6 6', gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7 7 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z', check: 'M5 12l5 5 9-10', x: 'M6 6l12 12M18 6L6 18' };

  // ---------- Config et stockage ----------
  function getCfg() { try { return JSON.parse(localStorage.getItem(CFG_KEY) || '{}'); } catch (e) { return {}; } }
  function setCfg(c) { try { localStorage.setItem(CFG_KEY, JSON.stringify(c)); } catch (e) {} }

  function idb() {
    return new Promise(function (res, rej) {
      if (!window.indexedDB) return rej(new Error('no idb'));
      var r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = function () { r.result.createObjectStore('kv'); };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
  }
  function cacheGet(k) { return idb().then(function (db) { return new Promise(function (res) { var t = db.transaction('kv').objectStore('kv').get(k); t.onsuccess = function () { res(t.result); }; t.onerror = function () { res(null); }; }); }).catch(function () { return null; }); }
  function cachePut(k, v) { return idb().then(function (db) { return new Promise(function (res) { var tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(v, k); tx.oncomplete = res; tx.onerror = res; }); }).catch(function () {}); }

  // ---------- API (Apps Script) ----------
  function demoUrl() { var m = location.search.match(/[?&]demo=([^&]+)/); return m ? decodeURIComponent(m[1]) : null; }
  function apiGet() {
    var demo = demoUrl();
    if (demo) return fetch(demo).then(function (r) { return r.json(); });
    var c = getCfg();
    if (!c.url || !c.token) return Promise.reject(new Error('config'));
    return fetch(c.url + (c.url.indexOf('?') < 0 ? '?' : '&') + 'action=all&token=' + encodeURIComponent(c.token), { redirect: 'follow' })
      .then(function (r) { return r.json(); })
      .then(function (j) { if (!j.ok) throw new Error(j.erreur || 'Erreur du Sheet'); return j.data; });
  }
  function apiPost(payload) {
    if (demoUrl()) return Promise.resolve({ ok: true, demo: true });
    var c = getCfg();
    if (!c.url || !c.token) return Promise.reject(new Error('Connexion au Sheet non configurée (onglet Moi).'));
    payload.token = c.token;
    return fetch(c.url, { method: 'POST', body: JSON.stringify(payload), redirect: 'follow' })
      .then(function (r) { return r.json(); })
      .then(function (j) { if (!j.ok) throw new Error(j.erreur || 'Écriture refusée'); return j.result; });
  }

  // ---------- État ----------
  var S = {
    raw: null, loading: true, error: null, syncedAt: null,
    tab: 'accueil', period: 'week', wOff: 0, mOff: 0, open: null,
    wodWeek: 0, wodDay: null, prFam: 'all', prLevel: 'RX', prKey: null
  };
  var M = null; // modèle calculé

  // ---------- Classification ----------
  var BENCH = ['fran', 'grace', 'isabel', 'diane', 'elizabeth', 'helen', 'annie', 'karen', 'jackie', 'nancy', 'kelly', 'cindy', 'mary', 'murph', 'dt', 'filthy fifty', 'fight gone bad', 'angie', 'barbara', 'chelsea', 'eva', 'linda', 'amanda', 'jt', 'michael', 'randy', 'nate', 'badger', 'the chief', 'chad', 'loredo', 'kalsu', 'lynne', 'nicole'];
  var RE = {
    lift: /snatch|clean|jerk|squat|deadlift|press|bench|thruster|good morning|hip thrust|barbell/i,
    gym: /pull-?up|chin|muscle-?up|handstand|hspu|toes.?to|t2b|dip|rope climb|double.?under|pistol|l.?sit|ring/i,
    cardio: /\b(row|rower|run|ski|skierg|bike|bikeerg|echo|assault|swim|cal\b|calories|burpee|wall ?ball|box jump|du\b)/i,
    renfo: /dumbbell|\bdb\b|\bkb\b|kettlebell|curl|raise|band|fly|flies|extension|plank|hollow|v-up|sit-up|glute|core|abmat|farmer|carry|lunge|row\b(?!.*cal)/i
  };
  var FAM_LABEL = { haltero: 'Haltéro', gym: 'Gym', cardio: 'Cardio', renfo: 'Renfo / muscu' };
  var FAM_COLOR = { haltero: '#F5A524', gym: '#4C8DF6', cardio: '#E2262D', renfo: '#A1A1AA' };
  var BLOC_LABEL = { metcon: 'Metcon', haltero: 'Haltéro', gym: 'Gym', cardio: 'Cardio', renfo: 'Renfo', autre: 'Autre' };
  var ENDU = { 'Course': 'run', 'Rameur': 'row', 'SkiErg': 'ski', 'Vélo': 'bike', 'Vélo indoor': 'bike', 'Natation': 'swim', 'Randonnée': 'other', 'Paddle': 'other', 'Snowboard': 'other' };
  var MACHINE_LABEL = { run: 'Run', row: 'Row', ski: 'Ski', bike: 'Bike', echo: 'Echo bike', swim: 'Natation', other: 'Autre' };

  // Répartit un bloc entre haltéro, gym, cardio et renfo selon ses mouvements.
  function splitBloc(b) {
    if (b.type_bloc === 'haltero') return { haltero: 1 };
    if (b.type_bloc === 'gym') return { gym: 1 };
    if (b.type_bloc === 'cardio') return { cardio: 1 };
    if (b.type_bloc === 'renfo') return { renfo: 1 };
    var text = (b.description || b.nom || '').split(/ROOKIE VERSION/i)[0];
    var lines = text.split(/\n|,/).filter(function (l) { return /[a-z]/i.test(l) && !/^\s*(every|rest|alterner|l'objectif|si ce|interval|rx\/|\d+\s*rounds?\s*(of)?:?\s*$)/i.test(l); });
    var c = { haltero: 0, gym: 0, cardio: 0, renfo: 0 }, n = 0;
    lines.forEach(function (l) {
      var k = RE.cardio.test(l) ? 'cardio' : RE.gym.test(l) ? 'gym' : RE.lift.test(l) ? 'haltero' : RE.renfo.test(l) ? 'renfo' : null;
      if (k) { c[k]++; n++; }
    });
    if (!n) return { cardio: 1 };
    Object.keys(c).forEach(function (k) { c[k] /= n; });
    return c;
  }

  // Lit "row:90;ski:90" en objet.
  function parseDetail(s) {
    var o = {};
    String(s || '').split(/[;,]/).forEach(function (p) { var m = p.split(':'); var v = num(m[1]); if (m[0] && v) o[m[0].trim().toLowerCase()] = (o[m[0].trim().toLowerCase()] || 0) + v; });
    return o;
  }
  function detailStr(o) { return Object.keys(o).filter(function (k) { return o[k]; }).map(function (k) { return k + ':' + o[k]; }).join(';'); }

  // Estime les calories machine à partir de la description (version choisie).
  function guessMachines(b, level) {
    var txt = b.description || '';
    var parts = txt.split(/ROOKIE VERSION/i);
    var t = level === 'Rookie' && parts[1] ? parts[1] : parts[0];
    var rounds = 1, m = t.match(/x\s*(\d+)\s*rounds?/i) || t.match(/(\d+)\s*rounds?/i);
    if (m) rounds = +m[1];
    var alternate = /altern/i.test(t) && /interval\s*b/i.test(t);
    var cal = {}, km = {};
    var re = /(\d+)(?:\/\d+)?\s*cal\.?\s*(row|ski\s*erg|ski|bike\s*erg|bike|echo|assault)/gi, x;
    while ((x = re.exec(t))) {
      var k = /row/i.test(x[2]) ? 'row' : /ski/i.test(x[2]) ? 'ski' : /echo|assault/i.test(x[2]) ? 'echo' : 'bike';
      cal[k] = (cal[k] || 0) + (+x[1]) * (alternate ? Math.ceil(rounds / 2) : rounds);
    }
    var re2 = /(\d+)\s*m\s*(row|ski|run|bike)/gi;
    while ((x = re2.exec(t))) {
      var k2 = x[2].toLowerCase();
      km[k2] = Math.round(((km[k2] || 0) + (+x[1]) * (alternate ? Math.ceil(rounds / 2) : rounds) / 1000) * 100) / 100;
    }
    return { cal: cal, km: km };
  }

  function estimateDuration(b, scoreSec) {
    if (scoreSec) return Math.max(1, Math.round(scoreSec / 60));
    var t = (b.description || '') + ' ' + (b.nom || '');
    var m = t.match(/every\s*(\d+)\s*['’]?\s*(?:min\w*)?\s*x\s*(\d+)/i);
    if (m) return (+m[1]) * (+m[2]);
    m = t.match(/(?:amrap|emom)\s*(\d+)/i); if (m) return +m[1];
    m = t.match(/every\s*[\d:]+\s*\w*\s*for\s*(\d+)/i); if (m) return +m[1];
    var r = t.match(/(\d+)\s*rounds?/i), rest = t.match(/rest\s*(\d+)(?:['’:](\d+))?/i);
    if (r) { var restMin = rest ? (+rest[1]) + (rest[2] ? (+rest[2]) / 60 : 0) : 1; return Math.round((+r[1]) * (1.5 + restMin)); }
    return num(b.duree_min) || 12;
  }

  // ---------- Modèle ----------
  function build(raw) {
    var reg = raw.reglages || {};
    var seances = (raw.seances || []).map(function (r) {
      var o = Object.assign({}, r);
      o.score_valeur = num(r.score_valeur); o.rang = num(r.rang); o.participants = num(r.participants);
      o.rpe_vise = num(r.rpe_vise); o.rpe_ressenti = num(r.rpe_ressenti); o.duree_min = num(r.duree_min);
      o.date_prog = String(r.date_prog || '').slice(0, 10); o.date_faite = String(r.date_faite || '').slice(0, 10);
      o.done = r.statut === 'fait';
      return o;
    });
    var strava = (raw.strava || []).map(function (r) {
      var o = Object.assign({}, r);
      ['distance_km', 'duree_s', 'duree_totale_s', 'fc_moy', 'fc_max', 'cadence_moy', 'watts_moy', 'calories', 'denivele_m', 'effort_relatif'].forEach(function (k) { o[k] = num(r[k]); });
      o.date = String(r.date || '').slice(0, 10);
      o.endu = ENDU[r.sport] || null;
      return o;
    });
    var cls = (raw.classements || []).map(function (r) { return Object.assign({}, r, { rang: num(r.rang), score_valeur: num(r.score_valeur) }); });
    var clsBy = {};
    cls.forEach(function (r) { (clsBy[r.bloc_id] = clsBy[r.bloc_id] || []).push(r); });
    Object.keys(clsBy).forEach(function (k) { clsBy[k].sort(function (a, b) { return a.rang - b.rang; }); });
    var m = { reg: reg, seances: seances, strava: strava, cls: clsBy, byId: {} };
    seances.forEach(function (s) { m.byId[s.id] = s; });
    m.records = buildRecords(seances, strava);
    return m;
  }

  // ---------- Records ----------
  function liftKey(nom) {
    var m = nom.match(/^(.*?)\s*:\s*(\d+)\s*Rep Max\s*$/i);
    if (m) return { label: m[1].trim(), detail: m[2] + 'RM' };
    m = nom.match(/^(.*?)\s*[-:·]?\s*(\d+)\s*RM\s*$/i);
    if (m && m[1]) return { label: m[1].trim(), detail: m[2] + 'RM' };
    return null;
  }
  function enduKeyFromName(nom) {
    var m = nom.match(/^(row|run|swim|ski\w*|bike\w*)\s+([\d.,]+)\s*(m|km)\s+TT\s*$/i);
    if (!m) return null;
    var sport = /row/i.test(m[1]) ? 'Rameur' : /run/i.test(m[1]) ? 'Course' : /swim/i.test(m[1]) ? 'Natation' : /ski/i.test(m[1]) ? 'SkiErg' : 'Vélo';
    var meters = num(m[2]) * (m[3].toLowerCase() === 'km' ? 1000 : 1);
    return { sport: sport, meters: meters };
  }
  function distLabel(meters) { return meters >= 1000 && meters % 1000 === 0 ? (meters / 1000) + ' km' : meters + ' m'; }

  function buildRecords(seances, strava) {
    var keys = {};
    function add(key, fam, label, detail, dir, unit, att) {
      var k = keys[key] || (keys[key] = { key: key, fam: fam, label: label, detail: detail, dir: dir, unit: unit, att: [] });
      k.att.push(att);
    }
    seances.forEach(function (s) {
      if (!s.done || s.score_valeur == null) return;
      var lvl = s.niveau === 'Rookie' ? 'Rookie' : 'RX';
      var att = { date: s.date_faite || s.date_prog, value: s.score_valeur, display: s.score_affiche, level: lvl, src: s.source, id: s.id };
      var nl = s.nom.toLowerCase().trim();
      var e = enduKeyFromName(s.nom);
      if (e && s.type_score === 'temps') { add('endu|' + e.sport + '|' + e.meters, 'endu', e.sport, distLabel(e.meters), -1, 'temps', att); return; }
      if (BENCH.indexOf(nl) >= 0 && (s.type_score === 'temps' || s.type_score === 'rounds_reps' || s.type_score === 'reps')) {
        add('bench|' + nl, 'bench', s.nom, '', s.type_score === 'temps' ? -1 : 1, s.type_score, att); return;
      }
      var lk = s.type_score === 'charge' ? liftKey(s.nom) : null;
      if (lk) {
        var fam = RE.gym.test(lk.label) && !RE.lift.test(lk.label.replace(/pull-?up/i, '')) ? 'gym' : 'lifts';
        add('lift|' + lk.label.toLowerCase() + '|' + lk.detail, fam, lk.label, lk.detail, 1, 'charge', att); return;
      }
      if (RE.gym.test(s.nom) && /max (set|hold|rep)/i.test(s.nom) && (s.type_score === 'reps' || s.type_score === 'temps')) {
        var label = s.nom.replace(/\s*:\s*.*$/, '');
        var det = /hold/i.test(s.nom) ? 'max tenue' : /\dx/i.test(s.nom) ? 'total séries' : 'max d’affilée';
        add('gym|' + label.toLowerCase() + '|' + det, 'gym', label, det, 1, s.type_score === 'temps' ? 'duree' : 'reps', att);
      }
    });
    var targets = { Rameur: [500, 1000, 2000, 5000, 10000], SkiErg: [500, 1000, 2000], Course: [5000, 10000, 21097] };
    strava.forEach(function (a) {
      var t = targets[a.sport]; if (!t || !a.distance_km || !a.duree_s) return;
      // Les séances fractionnées (5x500 m, fartlek…) ne sont pas des records sur la distance.
      if (/\d\s*x|x\s*\d|×|\/|\brest\b|\brécup|interval|fartlek|\d+r\b/i.test(a.nom)) return;
      if ((a.sport === 'Rameur' || a.sport === 'SkiErg') && !/\d{3,5}\s*m|\bTT\b|test/i.test(a.nom)) return;
      var meters = a.distance_km * 1000;
      t.forEach(function (d) {
        var tol = a.sport === 'Course' ? 0.06 : 0.01;
        if (Math.abs(meters - d) / d <= tol) {
          var sec = a.sport === 'Course' ? a.duree_s * d / meters : a.duree_s;
          add('endu|' + a.sport + '|' + d, 'endu', a.sport, distLabel(d), -1, 'temps', { date: a.date, value: Math.round(sec), display: fmtTime(sec), level: 'RX', src: 'Strava', strava: a.id });
        }
      });
    });
    var list = Object.keys(keys).map(function (k) {
      var r = keys[k];
      r.att.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
      // Dédoublonne BTWB + Strava le même jour pour la même distance.
      var dedup = [];
      r.att.forEach(function (a) { var d = dedup.find(function (x) { return x.date === a.date && x.level === a.level && Math.abs(x.value - a.value) <= (r.unit === 'temps' ? 3 : 0); }); if (d) { if (a.strava) d.strava = a.strava; } else dedup.push(a); });
      r.att = dedup;
      r.byLevel = {};
      ['RX', 'Rookie'].forEach(function (lvl) {
        var att = r.att.filter(function (a) { return a.level === lvl; });
        if (!att.length) return;
        var best = null, prs = [];
        att.forEach(function (a) {
          if (!best || (r.dir > 0 ? a.value > best.value : a.value < best.value)) { if (best) prs.push(a); else prs.push(a); best = a; }
        });
        r.byLevel[lvl] = { att: att, best: best, prs: prs.slice(1) };
      });
      return r;
    });
    return list;
  }
  function recordValue(r, v) {
    if (r.unit === 'temps' || r.unit === 'duree') return r.unit === 'duree' ? Math.round(v) + ' s' : fmtTime(v);
    if (r.unit === 'charge') return fmtKg(v);
    if (r.unit === 'rounds_reps') { var rd = Math.floor(v), rp = Math.round((v - rd) * 1000); return rd + ' rds' + (rp ? ' + ' + rp : ''); }
    return Math.round(v) + (r.unit === 'reps' ? ' reps' : '');
  }
  function recordTitle(r) { return r.label + (r.detail ? ' · ' + r.detail : ''); }
  function prEvents(from, to) {
    var out = [];
    M.records.forEach(function (r) {
      Object.keys(r.byLevel).forEach(function (lvl) {
        r.byLevel[lvl].prs.forEach(function (a) { if (a.date >= from && a.date <= to) out.push({ r: r, a: a, lvl: lvl }); });
      });
    });
    return out.sort(function (x, y) { return x.a.date < y.a.date ? 1 : -1; });
  }

  // ---------- Périodes ----------
  function periodRange() {
    if (S.period === 'week') {
      var a = addDays(monday(today()), 7 * S.wOff);
      return { from: iso(a), to: iso(addDays(a, 6)), a: a, b: addDays(a, 6) };
    }
    var t = today(); var a2 = new Date(t.getFullYear(), t.getMonth() + S.mOff, 1); var b2 = new Date(a2.getFullYear(), a2.getMonth() + 1, 0);
    return { from: iso(a2), to: iso(b2), a: a2, b: b2 };
  }
  function stats(from, to) {
    var warm = num(M.reg.echauffement_min) || 0;
    var done = M.seances.filter(function (s) { return s.done && s.date_faite >= from && s.date_faite <= to; });
    var endu = M.strava.filter(function (a) { return a.endu && a.date >= from && a.date <= to; });
    var cfDays = {}, days = {};
    done.forEach(function (s) { cfDays[s.date_faite] = 1; days[s.date_faite] = 1; });
    endu.forEach(function (a) { days[a.date] = 1; });
    var minutes = 0, split = { haltero: 0, gym: 0, cardio: 0, renfo: 0 };
    done.forEach(function (s) {
      var d = s.duree_min || estimateDuration(s, s.type_score === 'temps' ? s.score_valeur : null);
      minutes += d;
      var sp = splitBloc(s);
      Object.keys(sp).forEach(function (k) { split[k] += sp[k] * d; });
    });
    minutes += Object.keys(cfDays).length * warm;
    endu.forEach(function (a) { var d = (a.duree_s || 0) / 60; minutes += d; split.cardio += d; });
    var km = {}, cal = {};
    endu.forEach(function (a) { if (a.distance_km) km[a.endu] = (km[a.endu] || 0) + a.distance_km; });
    done.forEach(function (s) {
      var k = parseDetail(s.km_detail), c = parseDetail(s.cal_detail);
      Object.keys(k).forEach(function (x) { km[x] = (km[x] || 0) + k[x]; });
      Object.keys(c).forEach(function (x) { cal[x] = (cal[x] || 0) + c[x]; });
    });
    var prog = M.seances.filter(function (s) { return s.source === 'DarkZone' && s.date_prog >= from && s.date_prog <= to; });
    return { done: done, endu: endu, days: days, minutes: minutes, split: split, km: km, cal: cal, prog: prog, progDone: prog.filter(function (s) { return s.done; }).length, prs: prEvents(from, to) };
  }

  // ---------- Rendu commun ----------
  function setNav() { $$('.tabs a').forEach(function (a) { a.setAttribute('aria-current', a.dataset.tab === S.tab || (S.tab === 'ajouter' && a.dataset.tab === 'wod') ? 'page' : 'false'); }); }
  function toast(t) { var el = $('#toast'); el.textContent = t; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(function () { el.hidden = true; }, 2600); }
  function syncLine() {
    if (S.loading) return '<div class="loading">Synchronisation avec le Sheet…</div>';
    if (S.error) return '<div class="loading" style="color:var(--amber)">' + esc(S.error) + '</div>';
    return '';
  }
  function render() {
    setNav();
    var v = $('#view');
    if (!M) {
      if (S.error === 'config' || (!getCfg().url && !demoUrl())) { S.tab = 'moi'; setNav(); v.innerHTML = viewMoi(true); bind(); return; }
      v.innerHTML = '<div class="empty"><b>Chargement de ton carnet…</b><span>Lecture du Google Sheet Kaizen.</span>' + (S.error ? '<span class="amber">' + esc(S.error) + '</span>' : '') + '</div>';
      return;
    }
    var fn = { accueil: viewAccueil, wod: viewWod, ajouter: viewAjouter, pr: viewPr, analyse: viewAnalyse, moi: viewMoi }[S.tab] || viewAccueil;
    v.innerHTML = fn();
    bind();
  }

  // ---------- Accueil ----------
  function viewAccueil() {
    var name = M.reg.nom_affiche || 'Le Yves';
    var initials = name.replace(/^(le|la|les)\s+/i, '').split(/\s+/).map(function (w) { return w[0]; }).join('').slice(0, 2).toUpperCase() || 'K';
    var r = periodRange(), st = stats(r.from, r.to), goal = num(M.reg.objectif_jours) || 5;
    var isWeek = S.period === 'week', isCur = isWeek ? S.wOff === 0 : S.mOff === 0;
    var label = isWeek ? 'Du ' + r.a.getDate() + (r.a.getMonth() !== r.b.getMonth() ? ' ' + MO[r.a.getMonth()] : '') + ' au ' + r.b.getDate() + ' ' + MO[r.b.getMonth()] : MOL[r.a.getMonth()].replace(/^./, function (c) { return c.toUpperCase(); }) + ' ' + r.a.getFullYear();
    var nextDis = isWeek ? S.wOff >= 1 : S.mOff >= 0;
    var nDays = Object.keys(st.days).length;
    var goalP = isWeek ? goal : Math.round(goal * (r.b.getDate()) / 7);
    var h = '';
    h += '<div class="between"><span class="brand">KAIZEN <small>改善</small></span><a class="icon-btn" href="#moi" aria-label="Réglages">' + icon(I.gear) + '</a></div>';
    h += '<header class="row" style="gap:14px;margin-top:-8px"><div class="avatar" aria-hidden="true">' + esc(initials) + '</div><div class="stack" style="gap:2px"><span class="label">Salut</span><h1 class="h1">' + esc(name) + '</h1></div></header>';
    h += syncLine();
    h += '<div class="seg" role="group" aria-label="Période"><button type="button" data-act="period" data-v="week" aria-pressed="' + isWeek + '">Semaine</button><button type="button" data-act="period" data-v="month" aria-pressed="' + !isWeek + '">Mois</button></div>';
    h += '<div class="between" style="margin-top:-6px"><button class="icon-btn" data-act="pprev" aria-label="Période précédente">' + icon(I.left) + '</button><div class="stack" style="gap:2px;align-items:center"><b style="font-size:16px">' + label + '</b>' +
      (isCur ? '<span class="small red" style="font-weight:600">' + (isWeek ? 'Semaine en cours' : 'Mois en cours') + '</span>' : '<button class="chip" style="min-height:30px;font-size:12px" data-act="pnow">' + (isWeek && S.wOff > 0 ? 'À venir · revenir à aujourd’hui' : 'Revenir à aujourd’hui') + '</button>') +
      '</div><button class="icon-btn" data-act="pnext" aria-label="Période suivante"' + (nextDis ? ' disabled' : '') + '>' + icon(I.right) + '</button></div>';

    // Assiduité
    h += '<section class="stack"><div class="between"><h2 class="label">Assiduité</h2><span class="num" style="font-size:30px">' + nDays + '<span style="color:var(--faint)">/' + goalP + ' jours</span></span></div>';
    var t = iso(today());
    if (isWeek) {
      h += '<div class="days">';
      for (var i = 0; i < 7; i++) {
        var d = addDays(r.a, i), ds = iso(d), trained = st.days[ds], isT = ds === t;
        h += '<div class="day' + (trained ? ' trained' : '') + (isT ? ' today' : '') + '" style="cursor:default"><span class="d">' + DOW[d.getDay()] + '</span><span class="n">' + d.getDate() + '</span><span class="small" style="font-size:10px">' + (trained ? '✓' : isT ? 'auj.' : '') + '</span></div>';
      }
      h += '</div>';
    } else {
      h += '<div class="cal" role="img" aria-label="' + nDays + ' jours d’entraînement">';
      var off = (r.a.getDay() + 6) % 7;
      for (var k = 0; k < off; k++) h += '<div class="off"></div>';
      for (var dd = 1; dd <= r.b.getDate(); dd++) {
        var ds2 = iso(new Date(r.a.getFullYear(), r.a.getMonth(), dd));
        h += '<div class="' + (st.days[ds2] ? 't' : ds2 > t ? 'future' : '') + (ds2 === t ? ' today' : '') + '">' + dd + '</div>';
      }
      h += '</div>';
    }
    h += '</section>';

    // Chiffres
    var progTxt = st.prog.length ? Math.round(st.progDone / st.prog.length * 100) + ' % de la prog' : 'blocs faits';
    h += '<section class="grid3" aria-label="Chiffres clés">' +
      '<div class="tile"><span class="num">' + st.done.length + '</span><span class="cap">' + (st.prog.length ? 'blocs · ' + progTxt : 'blocs faits') + '</span></div>' +
      '<div class="tile"><span class="num">' + fmtDur(st.minutes) + '</span><span class="cap">d’entraînement, échauff. inclus</span></div>' +
      '<div class="tile"><span class="num">' + st.prs.length + '</span><span class="cap">PR</span></div></section>';

    // Km / cal
    var kmTot = Object.keys(st.km).reduce(function (s, k) { return s + st.km[k]; }, 0);
    var calTot = Object.keys(st.cal).reduce(function (s, k) { return s + st.cal[k]; }, 0);
    h += '<section class="stack"><div class="grid2">' +
      '<button type="button" class="tile" data-act="open" data-v="km" aria-expanded="' + (S.open === 'km') + '"><span class="between" style="width:100%"><span class="num">' + fmtNum(kmTot, 1) + '<span style="font-size:18px"> km</span></span>' + icon(S.open === 'km' ? I.up : I.down).replace('<svg', '<svg style="width:16px;height:16px;fill:none;stroke:var(--muted);stroke-width:2.5"') + '</span><span class="cap">parcourus</span></button>' +
      '<button type="button" class="tile" data-act="open" data-v="cal" aria-expanded="' + (S.open === 'cal') + '"><span class="between" style="width:100%"><span class="num">' + Math.round(calTot) + '<span style="font-size:18px"> cal</span></span>' + icon(S.open === 'cal' ? I.up : I.down).replace('<svg', '<svg style="width:16px;height:16px;fill:none;stroke:var(--muted);stroke-width:2.5"') + '</span><span class="cap">sur les machines</span></button></div>';
    if (S.open) {
      var src = S.open === 'km' ? st.km : st.cal, keys = Object.keys(src).sort(function (a, b) { return src[b] - src[a]; });
      var max = keys.reduce(function (m, k) { return Math.max(m, src[k]); }, 0);
      h += '<div class="card" style="gap:10px">' + (keys.length ? keys.map(function (k) {
        return '<div class="row"><span style="width:78px">' + esc(MACHINE_LABEL[k] || k) + '</span><div class="bar"><div style="width:' + Math.round(src[k] / max * 100) + '%;background:' + (S.open === 'km' ? 'var(--red)' : 'var(--amber)') + '"></div></div><b style="width:70px;text-align:right">' + (S.open === 'km' ? fmtNum(src[k], 1) + ' km' : Math.round(src[k]) + ' cal') + '</b></div>';
      }).join('') : '<span class="muted small">Rien sur cette période.</span>') +
        '<span class="small muted">' + (S.open === 'km' ? 'Activités Strava et distances saisies dans tes scores' : 'Calories machine saisies avec tes scores (row, ski, bike, echo)') + '</span></div>';
    }
    h += '</section>';

    // Dernier record
    var lastPr = st.prs[0] || prEvents('0000', '9999')[0];
    if (lastPr) {
      h += '<section class="card" style="gap:8px"><h2 class="label">' + (st.prs.length ? 'Record de la période' : 'Dernier record') + '</h2><button class="li" style="padding:0;min-height:0" data-act="openpr" data-v="' + esc(lastPr.r.key) + '" data-l="' + lastPr.lvl + '"><span class="t"><b style="font-size:16px">' + esc(recordTitle(lastPr.r)) + '</b><span>' + fmtDay(lastPr.a.date) + (lastPr.lvl === 'Rookie' ? ' · Rookie' : '') + '</span></span><span class="v red" style="font-size:28px">' + esc(recordValue(lastPr.r, lastPr.a.value)) + '</span></button></section>';
    }

    // Répartition
    var tot = Object.keys(st.split).reduce(function (s, k) { return s + st.split[k]; }, 0);
    if (tot > 0) {
      var fams = ['haltero', 'gym', 'cardio', 'renfo'];
      h += '<section class="stack"><h2 class="label">Répartition</h2><div class="stackbar" role="img" aria-label="Répartition du temps">' + fams.map(function (f) { var p = st.split[f] / tot * 100; return p > 0 ? '<div style="width:' + p + '%;background:' + FAM_COLOR[f] + '"></div>' : ''; }).join('') + '</div>';
      h += '<div class="legend">' + fams.map(function (f) { return '<div><i style="background:' + FAM_COLOR[f] + '"></i><span>' + FAM_LABEL[f] + '</span><b>' + Math.round(st.split[f] / tot * 100) + ' %</b></div>'; }).join('') + '</div></section>';
    }

    // Communauté
    var ranked = st.done.filter(function (s) { return s.rang && s.participants; });
    if (ranked.length) {
      h += '<section class="stack"><h2 class="label">Communauté DarkZone</h2><div class="list">' + ranked.map(function (s) {
        var c = M.cls[s.id] || [], first = c[0], gap = '';
        if (first && first.score_valeur != null && s.score_valeur != null && s.type_score !== 'valide') {
          var diff = s.score_valeur - first.score_valeur;
          gap = diff === 0 ? 'égal au 1er' : (s.type_score === 'temps' ? (diff > 0 ? '+' : '–') + fmtTime(Math.abs(diff)) : (diff > 0 ? '+' : '–') + fmtNum(Math.abs(diff)) + (s.type_score === 'charge' ? ' kg' : '')) + ' sur le 1er';
        }
        return '<a class="li" href="#wod" data-act="gowod" data-v="' + s.date_prog + '"><span class="t"><b>' + esc(s.nom) + '</b><span>' + fmtDayShort(s.date_prog) + ' · ' + esc(s.score_affiche) + (gap ? ' · ' + gap : '') + '</span></span><span class="v">' + s.rang + '<span style="color:var(--faint)">/' + s.participants + '</span></span></a>';
      }).join('') + '</div></section>';
    }
    if (!st.done.length && !st.endu.length) h += '<div class="empty">Aucune séance sur cette période.<a class="btn primary" href="#ajouter">' + icon(I.plus) + 'Ajouter</a></div>';
    return h;
  }

  // ---------- WOD ----------
  function weekStart() { return addDays(monday(today()), 7 * S.wodWeek); }
  function blocksForDay(ds) {
    return M.seances.filter(function (s) { return s.date_prog === ds || (!s.date_prog && s.date_faite === ds); })
      .sort(function (a, b) { return (a.source === 'DarkZone' ? 0 : 1) - (b.source === 'DarkZone' ? 0 : 1) || (a.id < b.id ? -1 : 1); });
  }
  function rmFor(text) {
    var t = text.toLowerCase();
    var map = [['clean and jerk', 'rm_clean_and_jerk'], ['clean & jerk', 'rm_clean_and_jerk'], ['power clean', 'rm_power_clean'], ['power snatch', 'rm_power_snatch'], ['snatch', 'rm_snatch'], ['clean', 'rm_clean'], ['back squat', 'rm_back_squat'], ['front squat', 'rm_front_squat'], ['squat', 'rm_back_squat'], ['deadlift', 'rm_deadlift'], ['bench', 'rm_bench'], ['push press', 'rm_push_press'], ['strict press', 'rm_strict_press'], ['press', 'rm_strict_press']];
    for (var i = 0; i < map.length; i++) if (t.indexOf(map[i][0]) >= 0 && num(M.reg[map[i][1]])) return { key: map[i][1], name: map[i][0], rm: num(M.reg[map[i][1]]) };
    return null;
  }
  function percentCalcs(desc) {
    var out = [], re = /(\d+)\s*%(?:\s*(?:to|à|-)\s*(\d+)\s*%)?[^\n]*?\b(?:du\s+|de\s+|of\s+)?(?:1\s*)?rm\s+([a-z&' ]{3,30})/gi, m;
    while ((m = re.exec(desc))) {
      var rm = rmFor(m[3]); if (!rm) continue;
      var lo = +m[1], hi = m[2] ? +m[2] : null;
      out.push({ txt: (hi ? lo + '–' + hi : lo) + ' % de ton RM ' + rm.name + ' (' + fmtKg(rm.rm) + ')', val: hi ? fmtNum(round05(rm.rm * lo / 100)) + '–' + fmtKg(rm.rm * hi / 100) : fmtKg(rm.rm * lo / 100) });
      var step = desc.slice(m.index).match(/augmenter de\s*(\d+)\s*%/i);
      if (step && !hi) {
        var s = +step[1], seq = [];
        for (var p = lo; p <= 100 && seq.length < 10; p += s) seq.push(fmtNum(round05(rm.rm * p / 100)));
        out.push({ txt: 'Progression +' + s + ' % à chaque passage', val: seq.join(' · ') + ' kg' });
      }
    }
    return out;
  }
  function lastTime(b) {
    var prev = M.seances.filter(function (s) { return s.id !== b.id && s.done && s.nom === b.nom && s.score_affiche && (s.date_faite || s.date_prog) < (b.date_faite || b.date_prog); });
    prev.sort(function (a, c) { return a.date_faite < c.date_faite ? 1 : -1; });
    return prev[0] || null;
  }
  function blockCard(b) {
    var h = '<article class="card">';
    var status = b.done ? (b.date_faite && b.date_faite !== b.date_prog ? '<span class="small amber" style="font-weight:600">fait ' + fmtDayShort(b.date_faite) + '</span>' : '<span class="small ok" style="font-weight:600">fait</span>') : b.statut === 'non fait' ? '<span class="small muted">pas fait</span>' : '<span class="small muted">à faire</span>';
    h += '<div class="between"><div class="row" style="gap:6px;flex-wrap:wrap"><span class="tag ' + esc(b.type_bloc) + '">' + esc(BLOC_LABEL[b.type_bloc] || b.type_bloc) + '</span>' + (b.rpe_vise ? '<span class="tag outline">RPE visé ' + b.rpe_vise + '</span>' : '') + (b.source !== 'DarkZone' ? '<span class="tag outline">' + esc(b.source) + '</span>' : '') + '</div>' + status + '</div>';
    h += '<h3 class="h3">' + esc(b.nom) + '</h3>';
    if (b.description) {
      var long = b.description.split('\n').length > 7;
      h += '<div class="desc' + (long ? ' clamp' : '') + '" id="d-' + esc(b.id) + '">' + esc(b.description) + '</div>' + (long ? '<button class="chip" style="align-self:flex-start;min-height:32px" data-act="expand" data-v="' + esc(b.id) + '">Tout afficher</button>' : '');
      percentCalcs(b.description).forEach(function (c) { h += '<div class="calc"><span style="flex:1">' + esc(c.txt) + '</span><b>' + esc(c.val) + '</b></div>'; });
    }
    if (b.done && b.type_score !== 'valide') {
      h += '<div class="inset"><div class="between"><div class="stack" style="gap:2px"><span class="small muted">Mon score · ' + esc(b.niveau || 'RX') + '</span><span class="num" style="font-size:34px">' + esc(b.score_affiche || '—') + '</span></div>' +
        (b.rang ? '<div class="stack" style="gap:2px;align-items:flex-end"><span class="small muted">Rang</span><span class="num" style="font-size:34px">' + b.rang + (b.participants ? '<span style="color:var(--faint)">/' + b.participants + '</span>' : '') + '</span></div>' : '') + '</div>';
      var extra = [];
      if (b.rpe_ressenti) extra.push(['RPE ressenti', b.rpe_ressenti + (b.rpe_vise ? ' <span class="' + (b.rpe_ressenti > b.rpe_vise ? 'amber' : 'ok') + '">(' + (b.rpe_ressenti - b.rpe_vise >= 0 ? '+' : '') + (b.rpe_ressenti - b.rpe_vise) + ')</span>' : '')]);
      var sa = M.strava.find(function (a) { return a.date === b.date_faite && !a.endu && a.fc_moy; });
      if (sa) extra.push(['FC moy.', sa.fc_moy + (sa.fc_max ? ' / ' + sa.fc_max : '') + ' bpm']);
      if (b.charges) extra.push(['Charges', esc(b.charges)]);
      if (extra.length) h += '<div class="grid3 small muted">' + extra.map(function (e) { return '<div class="stack" style="gap:2px"><span>' + e[0] + '</span><b style="font-size:14px;color:var(--ink)">' + e[1] + '</b></div>'; }).join('') + '</div>';
      if (b.notes) h += '<div class="small muted pre">' + esc(b.notes) + '</div>';
      h += '</div>';
    } else if (b.done) {
      h += '<div class="row ok" style="font-weight:600">' + icon(I.check).replace('<svg', '<svg style="width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:3"') + 'Validé' + (b.rpe_ressenti ? ' · RPE ' + b.rpe_ressenti : '') + '</div>';
    }
    var lt = lastTime(b);
    if (lt) h += '<div class="small muted">La dernière fois : <b style="color:var(--ink)">' + esc(lt.score_affiche) + '</b> le ' + fmtDay(lt.date_faite || lt.date_prog) + (lt.niveau === 'Rookie' ? ' (Rookie)' : '') + '</div>';
    var c = M.cls[b.id];
    h += '<div class="grid2"><button class="btn' + (b.done ? '' : ' primary') + '" data-act="score" data-v="' + esc(b.id) + '">' + (b.done ? 'Modifier' : b.type_score === 'valide' ? 'Valider' : 'Ajouter mon score') + '</button>' +
      (c && c.length ? '<button class="btn soft" data-act="board" data-v="' + esc(b.id) + '">Classement · ' + (b.participants || c.length) + '</button>' : '<button class="btn" data-act="addboard" data-v="' + esc(b.id) + '">Classement</button>') + '</div>';
    return h + '</article>';
  }
  function viewWod() {
    var a = weekStart(), t = iso(today());
    if (!S.wodDay || S.wodDay < iso(a) || S.wodDay > iso(addDays(a, 6))) S.wodDay = S.wodWeek === 0 ? t : iso(a);
    var h = '<header class="between"><h1 class="h1">WOD</h1><a class="btn primary" href="#ajouter">' + icon(I.plus) + 'Ajouter</a></header>';
    h += syncLine();
    h += '<div class="between"><button class="icon-btn" data-act="wprev" aria-label="Semaine précédente">' + icon(I.left) + '</button><b>Semaine du ' + a.getDate() + ' ' + MO[a.getMonth()] + (a.getFullYear() !== today().getFullYear() ? ' ' + a.getFullYear() : '') + '</b><button class="icon-btn" data-act="wnext" aria-label="Semaine suivante">' + icon(I.right) + '</button></div>';
    h += '<div class="days" role="tablist" aria-label="Jours">';
    for (var i = 0; i < 7; i++) {
      var d = addDays(a, i), ds = iso(d), has = blocksForDay(ds).length || M.strava.some(function (x) { return x.date === ds && x.endu; });
      h += '<button type="button" role="tab" class="day' + (has ? ' has' : '') + (ds === t ? ' today' : '') + '" aria-selected="' + (ds === S.wodDay) + '" data-act="wday" data-v="' + ds + '"><span class="d">' + DOW[d.getDay()] + '</span><span class="n">' + d.getDate() + '</span><span class="dot"></span></button>';
    }
    h += '</div>';
    var blocks = blocksForDay(S.wodDay), endu = M.strava.filter(function (x) { return x.date === S.wodDay && x.endu; });
    var dd = parseD(S.wodDay);
    h += '<div class="between"><h2 style="font-size:18px">' + DOWL[dd.getDay()].replace(/^./, function (c) { return c.toUpperCase(); }) + ' ' + dd.getDate() + ' ' + MOL[dd.getMonth()] + '</h2><span class="small muted">' + blocks.length + ' bloc' + (blocks.length > 1 ? 's' : '') + ' · ' + blocks.filter(function (b) { return b.done; }).length + ' fait' + (blocks.filter(function (b) { return b.done; }).length > 1 ? 's' : '') + '</span></div>';
    blocks.forEach(function (b) { h += blockCard(b); });
    endu.forEach(function (x) {
      h += '<article class="card"><div class="between"><span class="tag cardio">' + esc(x.sport) + '</span><span class="small muted">Strava · ' + esc(x.heure || '') + '</span></div><h3 class="h3">' + esc(x.nom) + '</h3><div class="grid3">' +
        stat('Distance', x.distance_km ? fmtNum(x.distance_km, 2) + ' km' : '—') + stat('Durée', x.duree_s ? fmtTime(x.duree_s) : '—') + stat(x.endu === 'row' || x.endu === 'ski' ? 'Allure /500 m' : 'Allure', paceStr(x)) +
        stat('FC moy.', x.fc_moy ? x.fc_moy + ' bpm' : '—') + stat(x.watts_moy ? 'Watts moy.' : 'Cadence', x.watts_moy ? x.watts_moy + ' W' : x.cadence_moy ? (x.endu === 'run' ? x.cadence_moy * 2 : x.cadence_moy) + (x.endu === 'run' ? ' pas/min' : '') : '—') + stat('Calories', x.calories ? x.calories + ' kcal' : '—') + '</div></article>';
    });
    if (!blocks.length && !endu.length) h += '<div class="empty">Rien de prévu ce jour-là.<a class="btn primary" href="#ajouter">' + icon(I.plus) + 'Ajouter un WOD</a><span class="small">Ou envoie les captures de la semaine à Claude.</span></div>';
    return h;
  }
  function stat(l, v) { return '<div class="stack" style="gap:2px"><span class="small muted">' + l + '</span><b style="font-size:15px">' + v + '</b></div>'; }
  function paceStr(x) {
    if (!x.distance_km || !x.duree_s) return '—';
    if (x.endu === 'row' || x.endu === 'ski') return fmtTime(x.duree_s / (x.distance_km * 2));
    if (x.endu === 'run') return fmtTime(x.duree_s / x.distance_km) + '/km';
    return fmtNum(x.distance_km / (x.duree_s / 3600), 1) + ' km/h';
  }

  // ---------- Ajouter / saisie ----------
  var F = null; // formulaire en cours
  function viewAjouter() {
    var mode = (F && F.mode) || 'wod';
    var h = '<header class="row"><a class="icon-btn" href="#wod" aria-label="Retour">' + icon(I.left) + '</a><h1 class="h1" style="font-size:34px">Ajouter</h1></header>';
    h += '<div class="seg" role="group" aria-label="Que veux-tu ajouter ?"><button type="button" data-act="fmode" data-v="wod" aria-pressed="' + (mode === 'wod') + '">Un WOD</button><button type="button" data-act="fmode" data-v="todo" aria-pressed="' + (mode === 'todo') + '">Mon score</button></div>';
    if (mode === 'wod') {
      var d = (F && F.date) || S.wodDay || iso(today());
      h += '<p class="muted" style="margin:0">Pour la prog de la semaine, le plus simple est d’envoyer tes captures Strivee à Claude dans ton projet. Ici, tu ajoutes un bloc à la main.</p>';
      h += '<form class="stack" id="f-wod" style="gap:14px">' +
        '<div class="grid2"><div class="field"><label for="w-date">Jour de la prog</label><input class="input" type="date" id="w-date" value="' + d + '" required></div>' +
        '<div class="field"><label for="w-rpe">RPE visé</label><input class="input" id="w-rpe" inputmode="numeric" placeholder="ex. 7"></div></div>' +
        '<div class="field"><label for="w-nom">Nom du bloc</label><input class="input" id="w-nom" placeholder="ex. Metcon, Haltéro Clean & Jerk, Fran" required></div>' +
        '<div class="grid2"><div class="field"><label for="w-type">Type de bloc</label><select class="input" id="w-type">' + ['metcon', 'haltero', 'gym', 'renfo', 'cardio'].map(function (k) { return '<option value="' + k + '">' + BLOC_LABEL[k] + '</option>'; }).join('') + '</select></div>' +
        '<div class="field"><label for="w-score">Score attendu</label><select class="input" id="w-score"><option value="temps">Temps</option><option value="rounds_reps">Rounds + reps</option><option value="charge">Charge (kg)</option><option value="reps">Reps</option><option value="valide">Validé ou pas</option><option value="distance">Distance (m)</option></select></div></div>' +
        '<div class="field"><label for="w-desc">Contenu du WOD</label><textarea class="input" id="w-desc" placeholder="Colle ici le texte copié depuis Strivee"></textarea></div>' +
        '<button class="btn primary block" type="submit">Ajouter le bloc</button></form>';
    } else {
      var todo = M.seances.filter(function (s) { return !s.done && s.statut !== 'non fait' && s.source === 'DarkZone'; }).sort(function (a, b) { return a.date_prog < b.date_prog ? 1 : -1; }).slice(0, 15);
      h += '<p class="muted" style="margin:0">Choisis le bloc à compléter. Tu peux aussi passer par le bouton « Ajouter mon score » d’un bloc dans l’onglet WOD.</p>';
      h += todo.length ? '<div class="list">' + todo.map(function (b) { return '<button class="li" data-act="score" data-v="' + esc(b.id) + '"><span class="t"><b>' + esc(b.nom) + '</b><span>' + fmtDayShort(b.date_prog) + ' · ' + esc(BLOC_LABEL[b.type_bloc] || '') + '</span></span>' + icon(I.right).replace('<svg', '<svg style="width:16px;height:16px;fill:none;stroke:var(--muted-2);stroke-width:2.5"') + '</button>'; }).join('') + '</div>' : '<div class="empty">Aucun bloc en attente de score.</div>';
    }
    return h;
  }

  function openScore(id) {
    var b = M.byId[id]; if (!b) return;
    var lvl = b.niveau || 'RX';
    var g = guessMachines(b, lvl), cal = parseDetail(b.cal_detail), km = parseDetail(b.km_detail);
    if (!b.done) { cal = g.cal; km = g.km; }
    F = { id: id, level: lvl, rpe: b.rpe_ressenti || null, date: b.date_faite || (iso(today()) < b.date_prog ? b.date_prog : iso(today())), cal: cal, km: km };
    drawScore();
  }
  function scoreInputs(b) {
    var v = b.score_valeur;
    switch (b.type_score) {
      case 'temps': return '<div class="field"><span class="label">Temps</span><div class="row"><input class="input big" id="s-min" aria-label="Minutes" inputmode="numeric" placeholder="min" value="' + (v != null ? Math.floor(v / 60) : '') + '" style="width:96px"><span class="num" style="font-size:30px">:</span><input class="input big" id="s-sec" aria-label="Secondes" inputmode="numeric" placeholder="s" value="' + (v != null ? pad(Math.round(v % 60)) : '') + '" style="width:96px"></div></div>';
      case 'rounds_reps': var rd = v != null ? Math.floor(v) : '', rp = v != null ? Math.round((v - Math.floor(v)) * 1000) : ''; return '<div class="grid2"><div class="field"><label for="s-r">Rounds</label><input class="input big" id="s-r" inputmode="numeric" value="' + rd + '"></div><div class="field"><label for="s-p">Reps en plus</label><input class="input big" id="s-p" inputmode="numeric" value="' + rp + '"></div></div>';
      case 'charge': return '<div class="field"><label for="s-kg">Charge (kg)</label><input class="input big" id="s-kg" inputmode="decimal" value="' + (v != null ? String(v).replace('.', ',') : '') + '"></div>';
      case 'reps': return '<div class="field"><label for="s-reps">Reps</label><input class="input big" id="s-reps" inputmode="numeric" value="' + (v != null ? v : '') + '"></div>';
      case 'distance': return '<div class="field"><label for="s-m">Distance (m)</label><input class="input big" id="s-m" inputmode="numeric" value="' + (v != null ? v : '') + '"></div>';
      case 'valide': return '<p class="muted" style="margin:0">Ce bloc se valide simplement, sans score.</p>';
      default: return '<div class="field"><label for="s-txt">Résultat</label><input class="input" id="s-txt" value="' + esc(b.score_affiche || '') + '"></div>';
    }
  }
  function drawScore() {
    var b = M.byId[F.id];
    var dates = [b.date_prog, iso(addDays(parseD(b.date_prog), 1)), iso(today())].filter(function (x, i, a) { return x && a.indexOf(x) === i; });
    var h = '<div class="between"><div class="stack" style="gap:2px"><span class="small muted">' + fmtDayShort(b.date_prog) + ' · ' + esc(BLOC_LABEL[b.type_bloc] || '') + '</span><b style="font-size:18px">' + esc(b.nom) + '</b></div><button class="icon-btn" data-act="close" aria-label="Fermer">' + icon(I.x) + '</button></div>';
    h += '<div class="field"><span class="label">Fait le</span><div class="chips">' + dates.map(function (d) { return '<button type="button" class="chip" data-act="fdate" data-v="' + d + '" aria-pressed="' + (F.date === d) + '">' + fmtDayShort(d) + (d === b.date_prog ? ' (prog)' : d === iso(today()) ? ' (auj.)' : '') + '</button>'; }).join('') + '<input class="input" type="date" id="s-date" value="' + F.date + '" style="width:auto;min-height:40px" aria-label="Autre jour"></div></div>';
    h += '<div class="field"><span class="label">Version</span><div class="seg"><button type="button" data-act="flvl" data-v="RX" aria-pressed="' + (F.level === 'RX') + '">RX / Inter</button><button type="button" data-act="flvl" data-v="Rookie" aria-pressed="' + (F.level === 'Rookie') + '">Rookie / Scaled</button></div></div>';
    h += scoreInputs(b);
    h += '<div class="field"><div class="between"><span class="label">RPE ressenti</span>' + (b.rpe_vise ? '<span class="small muted">visé : ' + b.rpe_vise + '</span>' : '') + '</div><div class="rpe" role="group" aria-label="RPE">' + [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(function (n) { return '<button type="button" data-act="frpe" data-v="' + n + '" class="' + (n === b.rpe_vise ? 'target' : '') + '" aria-pressed="' + (F.rpe === n) + '">' + n + '</button>'; }).join('') + '</div></div>';
    h += '<div class="field"><label for="s-charges">Charges utilisées</label><input class="input" id="s-charges" value="' + esc(b.charges || '') + '" placeholder="ex. wall balls 9 kg, DB 22,5 kg"></div>';
    h += '<div class="field"><span class="label">Machines (calories / km)</span><div class="grid2">' +
      ['row', 'ski', 'bike', 'echo'].map(function (k) { return '<div class="field"><label for="c-' + k + '" style="font-size:11px">' + MACHINE_LABEL[k] + ' (cal)</label><input class="input" id="c-' + k + '" inputmode="numeric" value="' + (F.cal[k] || '') + '"></div>'; }).join('') +
      ['row', 'ski', 'run', 'bike'].map(function (k) { return '<div class="field"><label for="k-' + k + '" style="font-size:11px">' + MACHINE_LABEL[k] + ' (km)</label><input class="input" id="k-' + k + '" inputmode="decimal" value="' + (F.km[k] ? String(F.km[k]).replace('.', ',') : '') + '"></div>'; }).join('') +
      '</div><span class="small muted">Prérempli à partir du WOD, à corriger si besoin.</span></div>';
    h += '<div class="grid2"><div class="field"><label for="s-rang">Rang (optionnel)</label><input class="input" id="s-rang" inputmode="numeric" value="' + (b.rang || '') + '"></div><div class="field"><label for="s-part">Participants</label><input class="input" id="s-part" inputmode="numeric" value="' + (b.participants || '') + '"></div></div>';
    h += '<div class="field"><label for="s-duree">Durée du bloc (min)</label><input class="input" id="s-duree" inputmode="numeric" value="' + (b.done && b.duree_min ? b.duree_min : estimateDuration(b, b.score_valeur && b.type_score === 'temps' ? b.score_valeur : null)) + '"></div>';
    h += '<div class="field"><label for="s-notes">Notes</label><textarea class="input" id="s-notes" style="min-height:70px" placeholder="Sensations, scaling…">' + esc(b.notes || '') + '</textarea></div>';
    h += '<p class="small amber" id="s-err" hidden></p>';
    h += '<button class="btn primary block" data-act="fsave">' + (b.done ? 'Enregistrer' : 'Enregistrer mon score') + '</button>';
    if (!b.done) h += '<button class="btn block" data-act="fskip" style="min-height:44px;font-size:14px">Marquer « pas fait »</button>';
    openSheet(h);
  }
  function readScore(b) {
    var g = function (id) { var el = $('#' + id); return el ? el.value.trim() : ''; };
    var r = {};
    switch (b.type_score) {
      case 'temps': var mi = num(g('s-min')) || 0, se = num(g('s-sec')) || 0; if (!mi && !se) return null; r.v = mi * 60 + se; r.d = fmtTime(r.v); break;
      case 'rounds_reps': var rd = num(g('s-r')), rp = num(g('s-p')) || 0; if (rd == null) return null; r.v = rd + rp / 1000; r.d = rd + ' rds' + (rp ? ' + ' + rp : ''); break;
      case 'charge': var kg = num(g('s-kg')); if (kg == null) return null; r.v = kg; r.d = fmtKg(kg); break;
      case 'reps': var n = num(g('s-reps')); if (n == null) return null; r.v = n; r.d = n + ' reps'; break;
      case 'distance': var m = num(g('s-m')); if (m == null) return null; r.v = m; r.d = m + ' m'; break;
      case 'valide': r.v = ''; r.d = 'Validé'; break;
      default: var t = g('s-txt'); if (!t) return null; r.v = ''; r.d = t;
    }
    return r;
  }
  function saveScore(skip) {
    var b = M.byId[F.id];
    var row = { id: b.id };
    if (skip) { row.statut = 'non fait'; }
    else {
      var sc = readScore(b);
      if (!sc) { var e = $('#s-err'); e.textContent = 'Renseigne ton score avant d’enregistrer.'; e.hidden = false; return; }
      var cal = {}, km = {};
      ['row', 'ski', 'bike', 'echo'].forEach(function (k) { var v = num(($('#c-' + k) || {}).value); if (v) cal[k] = v; });
      ['row', 'ski', 'run', 'bike'].forEach(function (k) { var v = num(($('#k-' + k) || {}).value); if (v) km[k] = v; });
      var dIn = $('#s-date').value || F.date;
      row = { id: b.id, statut: 'fait', date_faite: dIn, niveau: F.level, score_affiche: sc.d, score_valeur: sc.v, rpe_ressenti: F.rpe || '',
        charges: $('#s-charges').value.trim(), cal_detail: detailStr(cal), km_detail: detailStr(km),
        rang: num($('#s-rang').value) || '', participants: num($('#s-part').value) || '', duree_min: num($('#s-duree').value) || '', notes: $('#s-notes').value.trim() };
      // Pas de rang saisi mais un classement existe : on y insère ton score.
      var board = (M.cls[b.id] || []).filter(function (x) { return x.moi !== 'oui'; });
      if (!row.rang && board.length && sc.v !== '' && b.type_score !== 'valide') {
        var lower = b.type_score === 'temps';
        var better = board.filter(function (x) { return x.score_valeur != null && (lower ? x.score_valeur < sc.v : x.score_valeur > sc.v); }).length;
        row.rang = better + 1; row.participants = board.length + 1;
      } else if (!row.participants && board.length) row.participants = board.length + (row.rang ? 0 : 1);
    }
    var btn = $('[data-act="fsave"]'); if (btn) btn.disabled = true;
    apiPost({ action: 'upsert', sheet: 'Seances', row: row }).then(function () {
      Object.keys(row).forEach(function (k) { var raw = S.raw.seances.find(function (s) { return s.id === b.id; }); if (raw) raw[k] = row[k]; });
      M = build(S.raw); cachePut('data', S.raw); closeSheet();
      var newPr = prEvents(row.date_faite || '9999', row.date_faite || '0000').some(function (p) { return p.a.id === b.id; });
      toast(skip ? 'Bloc marqué pas fait' : newPr ? 'Nouveau PR enregistré' : 'Score enregistré');
      render();
    }).catch(function (err) { if (btn) btn.disabled = false; var e = $('#s-err'); if (e) { e.textContent = err.message; e.hidden = false; } });
  }
  function saveWod(ev) {
    ev.preventDefault();
    var date = $('#w-date').value, nom = $('#w-nom').value.trim();
    if (!date || !nom) { toast('Indique le jour et le nom du bloc'); return; }
    var row = { id: uid('dz-' + date), date_prog: date, date_faite: '', source: 'DarkZone', statut: 'à faire', nom: nom, type_bloc: $('#w-type').value,
      description: $('#w-desc').value.trim(), type_score: $('#w-score').value, score_affiche: '', score_valeur: '', niveau: 'RX', rpe_vise: num($('#w-rpe').value) || '',
      rpe_ressenti: '', charges: '', km_detail: '', cal_detail: '', notes: '', duree_min: '', rang: '', participants: '' };
    row.duree_min = estimateDuration(row, null);
    apiPost({ action: 'upsert', sheet: 'Seances', row: row }).then(function () {
      S.raw.seances.push(row); M = build(S.raw); cachePut('data', S.raw);
      F = null; S.wodDay = date; S.wodWeek = Math.round((monday(parseD(date)) - monday(today())) / (7 * 864e5));
      toast('Bloc ajouté'); location.hash = '#wod';
    }).catch(function (err) { toast(err.message); });
  }

  // Classement (modal)
  function openBoard(id) {
    var b = M.byId[id], c = M.cls[id] || [];
    var h = '<div class="between"><div class="stack" style="gap:2px"><span class="small muted">Classement · ' + fmtDayShort(b.date_prog) + '</span><b style="font-size:18px">' + esc(b.nom) + '</b></div><button class="icon-btn" data-act="close" aria-label="Fermer">' + icon(I.x) + '</button></div>';
    if (c.length) {
      var vals = c.map(function (x) { return x.score_valeur; }).filter(function (v) { return v != null; }).sort(function (a, z) { return a - z; });
      var med = vals.length ? vals[Math.floor((vals.length - 1) / 2)] : null;
      h += '<div class="list">' + c.map(function (x) {
        var me = x.moi === 'oui';
        return '<div class="li" style="cursor:default' + (me ? ';background:var(--red-soft)' : '') + '"><span class="row"><b class="num" style="font-size:20px;width:28px">' + x.rang + '</b><span class="t"><b>' + (me ? 'Toi' : 'Athlète') + '</b><span>' + (x.rx === 'oui' ? 'RX' : 'non RX') + '</span></span></span><span class="v" style="font-size:20px">' + esc(x.score_affiche) + '</span></div>';
      }).join('') + '</div>';
      if (med != null && b.type_score !== 'valide') h += '<p class="small muted" style="margin:0">Médiane : ' + esc(b.type_score === 'temps' ? fmtTime(med) : fmtNum(med) + (b.type_score === 'charge' ? ' kg' : '')) + ' · ' + c.length + ' participants</p>';
    } else h += '<div class="empty">Pas encore de classement pour ce bloc.</div>';
    h += '<p class="small muted" style="margin:0">Pour ajouter ou mettre à jour un classement, envoie la capture Strivee à Claude dans ton projet Kaizen.</p>';
    openSheet(h);
  }

  // ---------- PR ----------
  var FAMS = [['all', 'Tous'], ['lifts', 'Haltéro'], ['gym', 'Gym'], ['endu', 'Endurance'], ['bench', 'Benchmarks']];
  var FAM_TITLE = { lifts: 'Haltéro & force', gym: 'Gym', endu: 'Endurance', bench: 'Benchmarks' };
  var FAM_DOT = { lifts: '#F5A524', gym: '#4C8DF6', endu: '#E2262D', bench: '#A1A1AA' };
  function oldDate(d) { var x = parseD(d); x.setFullYear(x.getFullYear() + 5); return x < today(); }
  function viewPr() {
    if (S.prKey) return viewPrDetail();
    var lvl = S.prLevel;
    var h = '<header class="between"><h1 class="h1">Mes PR</h1><div class="seg" style="width:170px"><button type="button" data-act="prlvl" data-v="RX" aria-pressed="' + (lvl === 'RX') + '">RX</button><button type="button" data-act="prlvl" data-v="Rookie" aria-pressed="' + (lvl === 'Rookie') + '">Rookie</button></div></header>';
    h += '<div class="chips" role="group" aria-label="Famille">' + FAMS.map(function (f) { return '<button type="button" class="chip" data-act="prfam" data-v="' + f[0] + '" aria-pressed="' + (S.prFam === f[0]) + '">' + f[1] + '</button>'; }).join('') + '</div>';
    ['lifts', 'gym', 'endu', 'bench'].forEach(function (fam) {
      if (S.prFam !== 'all' && S.prFam !== fam) return;
      var recs = M.records.filter(function (r) { return r.fam === fam && r.byLevel[lvl]; });
      if (!recs.length) return;
      recs.sort(function (a, b) { return b.byLevel[lvl].att.length - a.byLevel[lvl].att.length || a.label.localeCompare(b.label); });
      if (fam === 'lifts') recs.sort(function (a, b) { return (a.detail === '1RM' ? 0 : 1) - (b.detail === '1RM' ? 0 : 1) || b.byLevel[lvl].att.length - a.byLevel[lvl].att.length; });
      if (S.prFam === 'all') recs = recs.slice(0, fam === 'lifts' ? 12 : 10);
      h += '<section class="stack"><div class="row" style="gap:8px"><i style="width:10px;height:10px;border-radius:3px;background:' + FAM_DOT[fam] + '"></i><h2 class="label">' + FAM_TITLE[fam] + '</h2></div><div class="list">';
      h += recs.map(function (r) {
        var b = r.byLevel[lvl].best, n = r.byLevel[lvl].att.length;
        return '<button class="li" data-act="openpr" data-v="' + esc(r.key) + '" data-l="' + lvl + '"><span class="t"><b>' + esc(recordTitle(r)) + '</b><span>' + fmtMonthYear(b.date) + ' · ' + n + ' essai' + (n > 1 ? 's' : '') + (b.src === 'Strava' || b.strava ? ' · Strava' : '') + '</span></span><span class="row" style="gap:8px">' + (oldDate(b.date) ? '<span class="badge">à retester</span>' : '') + '<span class="v">' + esc(recordValue(r, b.value)) + '</span></span></button>';
      }).join('') + '</div>' + (S.prFam === 'all' ? '<button class="chip" style="align-self:flex-start" data-act="prfam" data-v="' + fam + '">Tout voir</button>' : '') + '</section>';
    });
    return h;
  }
  function lineChart(pts, dir, fmt) {
    if (pts.length < 2) return '';
    var W = 350, H = 160, L = 40, R = 12, T = 12, B = 26;
    var xs = pts.map(function (p) { return parseD(p.date).getTime(); }), ys = pts.map(function (p) { return p.value; });
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs); if (x1 === x0) x1 = x0 + 1;
    var y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys); if (y1 === y0) { y0 -= 1; y1 += 1; }
    var pad2 = (y1 - y0) * 0.12; y0 -= pad2; y1 += pad2;
    var X = function (t) { return L + (t - x0) / (x1 - x0) * (W - L - R); };
    var Y = function (v) { var f = (v - y0) / (y1 - y0); if (dir < 0) f = 1 - f; return H - B - f * (H - T - B); };
    var g = '';
    for (var i = 0; i <= 3; i++) { var v = y0 + (y1 - y0) * i / 3, yy = Y(v); g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + yy.toFixed(1) + '" y2="' + yy.toFixed(1) + '" stroke="#26262C"/><text x="' + (L - 6) + '" y="' + (yy + 4).toFixed(1) + '" text-anchor="end" font-size="10" fill="#8B8B94" font-family="Inter,sans-serif">' + esc(fmt(v)) + '</text>'; }
    var d = pts.map(function (p, i) { return (i ? 'L' : 'M') + X(xs[i]).toFixed(1) + ' ' + Y(p.value).toFixed(1); }).join(' ');
    var dots = pts.map(function (p, i) { var last = i === pts.length - 1; return '<circle cx="' + X(xs[i]).toFixed(1) + '" cy="' + Y(p.value).toFixed(1) + '" r="' + (p.pr ? 5 : 3.5) + '" fill="' + (p.pr ? '#F2555A' : '#17171B') + '" stroke="' + (p.pr ? '#fff' : '#E2262D') + '" stroke-width="2"><title>' + esc(fmtDay(p.date) + ' · ' + fmt(p.value)) + '</title></circle>'; }).join('');
    var y0l = new Date(x0).getFullYear(), y1l = new Date(x1).getFullYear();
    return '<div class="chart"><svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Évolution">' + g + '<path d="' + d + '" fill="none" stroke="#E2262D" stroke-width="2.5" stroke-linejoin="round"/>' + dots +
      '<text x="' + L + '" y="' + (H - 6) + '" font-size="10" fill="#8B8B94" font-family="Inter,sans-serif">' + y0l + '</text><text x="' + (W - R) + '" y="' + (H - 6) + '" text-anchor="end" font-size="10" fill="#8B8B94" font-family="Inter,sans-serif">' + (y1l === y0l ? fmtMonthYear(iso(new Date(x1))) : y1l) + '</text></svg></div>' + (dir < 0 ? '<span class="small muted">Plus haut = plus rapide.</span>' : '');
  }
  function viewPrDetail() {
    var r = M.records.find(function (x) { return x.key === S.prKey; });
    if (!r || !r.byLevel[S.prLevel]) { S.prKey = null; return viewPr(); }
    var L = r.byLevel[S.prLevel], best = L.best;
    var famName = { lifts: 'HALTÉRO', gym: 'GYM', endu: 'ENDURANCE', bench: 'BENCHMARK' }[r.fam];
    var h = '<header class="row"><button class="icon-btn" data-act="prback" aria-label="Retour aux PR">' + icon(I.left) + '</button><span class="label red">' + famName + (r.detail ? ' · ' + esc(r.detail) : '') + (S.prLevel === 'Rookie' ? ' · ROOKIE' : '') + '</span></header>';
    h += '<div class="between" style="align-items:flex-end"><div class="stack" style="gap:4px"><h1 class="h1">' + esc(r.label) + '</h1><span class="muted small">' + fmtDay(best.date) + ' · ' + esc(best.src || '') + (best.strava ? ' + Strava' : '') + '</span></div><span class="num red" style="font-size:46px">' + esc(recordValue(r, best.value)) + '</span></div>';
    var sa = best.strava ? M.strava.find(function (a) { return a.id === best.strava; }) : null;
    if (sa) {
      h += '<section class="grid3" aria-label="Données Strava">' + [['Allure', paceStr(Object.assign({}, sa, { endu: ENDU[sa.sport] }))], ['FC moy.', sa.fc_moy ? sa.fc_moy + ' bpm' : '—'], ['FC max', sa.fc_max ? sa.fc_max + ' bpm' : '—'], [sa.watts_moy ? 'Puissance moy.' : 'Cadence moy.', sa.watts_moy ? sa.watts_moy + ' W' : sa.cadence_moy ? (sa.sport === 'Course' ? sa.cadence_moy * 2 + ' pas/min' : sa.cadence_moy + ' /min') : '—'], ['Calories', sa.calories ? sa.calories + ' kcal' : '—'], ['Effort relatif', sa.effort_relatif || '—']].map(function (x) { return '<div class="tile"><span class="cap">' + x[0] + '</span><b style="font-size:17px">' + x[1] + '</b></div>'; }).join('') + '</section>';
      if (sa.denivele_m) h += '<span class="small muted">Dénivelé : ' + fmtNum(sa.denivele_m) + ' m · ' + esc(sa.nom) + '</span>';
    }
    // Courbe de progression des records
    var running = null, pts = L.att.map(function (a) { var pr = !running || (r.dir > 0 ? a.value > running : a.value < running); if (pr) running = a.value; return { date: a.date, value: a.value, pr: pr }; });
    if (pts.length > 1) h += '<section class="card"><h2 class="label">Progression</h2>' + lineChart(pts, r.dir, function (v) { return recordValue(r, v).replace(' kg', '').replace(' reps', ''); }) + '</section>';
    if (r.unit === 'charge' && r.fam === 'lifts') {
      h += '<section class="card" style="gap:8px"><h2 class="label">Pourcentages de ton ' + esc(r.detail || 'record') + '</h2><div class="pct">' + [50, 60, 70, 75, 80, 85, 90, 95, 100, 105, 110, 65].slice(0, 12).sort(function (a, b) { return a - b; }).map(function (p) { return '<div><small>' + p + ' %</small><b>' + fmtNum(round05(best.value * p / 100)) + '</b></div>'; }).join('') + '</div></section>';
    }
    h += '<section class="stack"><h2 class="label">Historique</h2><div class="list">' + L.att.slice().reverse().map(function (a) {
      var isBest = a === best;
      return '<div class="li" style="cursor:default"><span class="t"><b>' + fmtDay(a.date) + '</b><span>' + esc(a.src || '') + (a.strava ? ' · Strava' : '') + (isBest ? ' · record' : '') + '</span></span><span class="v' + (isBest ? ' red' : '') + '">' + esc(recordValue(r, a.value)) + '</span></div>';
    }).join('') + '</div></section>';
    return h;
  }

  // ---------- Analyse ----------
  function viewAnalyse() {
    var h = '<header><h1 class="h1">Analyse</h1></header>';
    // 1. Progression sur les retests
    var retests = M.records.filter(function (r) { return r.byLevel.RX && r.byLevel.RX.att.length >= 2; }).map(function (r) {
      var L = r.byLevel.RX, first = L.att[0], best = L.best, last = L.att[L.att.length - 1];
      var gain = r.dir > 0 ? (best.value - first.value) / first.value : (first.value - best.value) / first.value;
      return { r: r, first: first, best: best, last: last, gain: gain };
    }).filter(function (x) { return x.gain > 0; }).sort(function (a, b) { return a.last.date < b.last.date ? 1 : -1; }).slice(0, 10);
    h += '<section class="stack"><h2 class="label">Est-ce que je progresse ?</h2><p class="small muted" style="margin:0">Tes records retestés, du premier essai au meilleur (RX).</p><div class="list">' + retests.map(function (x) {
      return '<button class="li" data-act="openpr" data-v="' + esc(x.r.key) + '" data-l="RX"><span class="t"><b>' + esc(recordTitle(x.r)) + '</b><span>' + esc(recordValue(x.r, x.first.value)) + ' (' + parseD(x.first.date).getFullYear() + ') → ' + esc(recordValue(x.r, x.best.value)) + ' (' + parseD(x.best.date).getFullYear() + ')</span></span><span class="v ok" style="font-size:20px">+' + Math.round(x.gain * 100) + ' %</span></button>';
    }).join('') + '</div></section>';
    // 2. Stagnations
    var cut = iso(addDays(today(), -730));
    var stale = M.records.filter(function (r) { return r.byLevel.RX && r.byLevel.RX.att.length >= 3 && r.byLevel.RX.best.date < cut && r.byLevel.RX.att[r.byLevel.RX.att.length - 1].date >= iso(addDays(today(), -1460)); })
      .sort(function (a, b) { return a.byLevel.RX.best.date < b.byLevel.RX.best.date ? -1 : 1; }).slice(0, 6);
    if (stale.length) h += '<section class="stack"><h2 class="label">Sans PR depuis plus de 2 ans</h2><div class="list">' + stale.map(function (r) { var b = r.byLevel.RX.best; return '<button class="li" data-act="openpr" data-v="' + esc(r.key) + '" data-l="RX"><span class="t"><b>' + esc(recordTitle(r)) + '</b><span>record en ' + fmtMonthYear(b.date) + '</span></span><span class="v">' + esc(recordValue(r, b.value)) + '</span></button>'; }).join('') + '</div></section>';
    // 3. Régularité 12 mois
    var months = [], t = today();
    for (var i = 11; i >= 0; i--) {
      var a = new Date(t.getFullYear(), t.getMonth() - i, 1), b = new Date(a.getFullYear(), a.getMonth() + 1, 0);
      var st = stats(iso(a), iso(b)); months.push({ m: a.getMonth(), days: Object.keys(st.days).length, min: st.minutes });
    }
    var max = Math.max.apply(null, months.map(function (x) { return x.days; }).concat([1]));
    h += '<section class="card"><h2 class="label">Jours d’entraînement par mois</h2><div style="display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:4px;align-items:end;height:120px" role="img" aria-label="Jours d’entraînement sur 12 mois">' +
      months.map(function (x) { return '<div style="display:flex;flex-direction:column;align-items:center;gap:4px;height:100%;justify-content:flex-end"><span style="font-size:10px;color:var(--muted)">' + (x.days || '') + '</span><div style="width:100%;height:' + Math.max(2, x.days / max * 80) + 'px;background:' + (x.days ? 'var(--red)' : 'var(--line)') + ';border-radius:4px 4px 0 0"></div></div>'; }).join('') +
      '</div><div style="display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:4px;text-align:center;font-size:10px;color:var(--muted)">' + months.map(function (x) { return '<span>' + MO[x.m].slice(0, 3).replace('.', '') + '</span>'; }).join('') + '</div></section>';
    // 4. Communauté
    var ranked = M.seances.filter(function (s) { return s.done && s.rang && s.participants; }).sort(function (a, b) { return a.date_prog < b.date_prog ? 1 : -1; }).slice(0, 12);
    h += '<section class="stack"><h2 class="label">Où je me situe dans DarkZone</h2>';
    if (ranked.length) {
      var byType = {};
      ranked.forEach(function (s) { var p = 1 - (s.rang - 1) / Math.max(1, s.participants - 1); (byType[s.type_bloc] = byType[s.type_bloc] || []).push(p); });
      h += '<div class="card" style="gap:10px"><span class="small muted">Ta position moyenne par type de bloc (100 % = premier)</span>' + Object.keys(byType).map(function (k) { var arr = byType[k], avg = arr.reduce(function (s, v) { return s + v; }, 0) / arr.length; return '<div class="row"><span style="width:80px">' + esc(BLOC_LABEL[k] || k) + '</span><div class="bar"><div style="width:' + Math.round(avg * 100) + '%;background:var(--red)"></div></div><b style="white-space:nowrap;text-align:right">' + Math.round(avg * 100) + ' % · ' + arr.length + ' bloc' + (arr.length > 1 ? 's' : '') + '</b></div>'; }).join('') + '</div>';
      h += '<div class="list">' + ranked.map(function (s) { return '<div class="li" style="cursor:default"><span class="t"><b>' + esc(s.nom) + '</b><span>' + fmtDay(s.date_prog) + ' · ' + esc(s.score_affiche) + '</span></span><span class="v">' + s.rang + '<span style="color:var(--faint)">/' + s.participants + '</span></span></div>'; }).join('') + '</div>';
    } else h += '<div class="empty">Tes classements DarkZone apparaîtront ici dès que tu auras envoyé les captures.</div>';
    h += '</section>';
    return h;
  }

  // ---------- Moi ----------
  var RM_KEYS = [['rm_back_squat', 'Back squat'], ['rm_front_squat', 'Front squat'], ['rm_deadlift', 'Deadlift'], ['rm_bench', 'Bench press'], ['rm_strict_press', 'Strict press'], ['rm_push_press', 'Push press'], ['rm_clean_and_jerk', 'Clean & jerk'], ['rm_clean', 'Squat clean'], ['rm_power_clean', 'Power clean'], ['rm_snatch', 'Squat snatch'], ['rm_power_snatch', 'Power snatch']];
  function viewMoi(first) {
    var c = getCfg(), reg = (M && M.reg) || {};
    var h = '<header><h1 class="h1">Moi</h1></header>';
    if (first) h += '<div class="card"><b>Bienvenue dans Kaizen</b><span class="muted">Pour commencer, colle l’adresse de ta passerelle Apps Script et ton code secret. Les étapes sont dans le tuto d’installation.</span></div>';
    h += '<form class="card" id="f-cfg"><h2 class="label">Connexion au Google Sheet</h2>' +
      '<div class="field"><label for="cfg-url">Adresse de l’application Web Apps Script</label><input class="input" id="cfg-url" value="' + esc(c.url || '') + '" placeholder="https://script.google.com/macros/s/…/exec" autocomplete="off"></div>' +
      '<div class="field"><label for="cfg-token">Code secret</label><input class="input" id="cfg-token" value="' + esc(c.token || '') + '" autocomplete="off"></div>' +
      '<button class="btn primary" type="submit">Enregistrer et synchroniser</button>' + (S.syncedAt ? '<span class="small muted">Dernière synchro : ' + S.syncedAt.toLocaleString('fr-FR') + '</span>' : '') + '</form>';
    if (M) {
      h += '<form class="card" id="f-reg"><h2 class="label">Profil</h2>' +
        '<div class="field"><label for="r-nom">Nom affiché</label><input class="input" id="r-nom" value="' + esc(reg.nom_affiche || '') + '"></div>' +
        '<div class="grid2"><div class="field"><label for="r-obj">Objectif jours / semaine</label><input class="input" id="r-obj" inputmode="numeric" value="' + esc(reg.objectif_jours || '') + '"></div>' +
        '<div class="field"><label for="r-warm">Échauffement (min)</label><input class="input" id="r-warm" inputmode="numeric" value="' + esc(reg.echauffement_min || '') + '"></div></div>' +
        '<h2 class="label" style="margin-top:6px">RM de référence (kg)</h2><div class="grid2">' + RM_KEYS.map(function (k) { return '<div class="field"><label for="r-' + k[0] + '" style="font-size:11px">' + k[1] + '</label><input class="input" id="r-' + k[0] + '" inputmode="decimal" value="' + esc(reg[k[0]] != null ? String(reg[k[0]]).replace('.', ',') : '') + '"></div>'; }).join('') + '</div>' +
        '<span class="small muted">Utilisés pour calculer les charges des WODs (ex. 60 % RM bench).</span><button class="btn primary" type="submit">Enregistrer le profil</button></form>';
      h += '<div class="card"><h2 class="label">Données</h2><span class="muted small">' + M.seances.length + ' blocs · ' + M.strava.length + ' activités Strava · ' + Object.keys(M.cls).length + ' classements</span><button class="btn" data-act="refresh">Actualiser depuis le Sheet</button></div>';
    }
    h += '<p class="small muted" style="text-align:center;margin:0">Kaizen v' + VERSION + '</p>';
    return h;
  }
  function saveCfg(ev) {
    ev.preventDefault();
    setCfg({ url: $('#cfg-url').value.trim(), token: $('#cfg-token').value.trim() });
    toast('Connexion enregistrée'); load(true);
  }
  function saveReg(ev) {
    ev.preventDefault();
    var changes = [['nom_affiche', $('#r-nom').value.trim()], ['objectif_jours', num($('#r-obj').value)], ['echauffement_min', num($('#r-warm').value)]];
    RM_KEYS.forEach(function (k) { changes.push([k[0], num($('#r-' + k[0]).value)]); });
    changes = changes.filter(function (c) { return c[1] !== null && c[1] !== '' && String(M.reg[c[0]]) !== String(c[1]); });
    if (!changes.length) { toast('Rien à modifier'); return; }
    var p = Promise.resolve();
    changes.forEach(function (c) { p = p.then(function () { return apiPost({ action: 'reglage', cle: c[0], valeur: c[1] }); }); });
    p.then(function () { changes.forEach(function (c) { S.raw.reglages[c[0]] = c[1]; }); M = build(S.raw); cachePut('data', S.raw); toast('Profil enregistré'); render(); })
      .catch(function (e) { toast(e.message); });
  }

  // ---------- Modal ----------
  function openSheet(html) { var el = $('#sheet'); el.innerHTML = '<div class="panel" role="dialog" aria-modal="true">' + html + '</div>'; el.hidden = false; bindSheet(); }
  function closeSheet() { var el = $('#sheet'); el.hidden = true; el.innerHTML = ''; }
  function bindSheet() {
    var el = $('#sheet');
    el.onclick = function (e) { if (e.target === el) closeSheet(); };
    $$('[data-act]', el).forEach(function (b) { b.onclick = function (e) { act(b, e); }; });
    var sd = $('#s-date'); if (sd) sd.onchange = function () { F.date = sd.value; };
  }

  // ---------- Événements ----------
  function bind() {
    $$('#view [data-act]').forEach(function (b) { b.onclick = function (e) { act(b, e); }; });
    var fw = $('#f-wod'); if (fw) fw.onsubmit = saveWod;
    var fc = $('#f-cfg'); if (fc) fc.onsubmit = saveCfg;
    var fr = $('#f-reg'); if (fr) fr.onsubmit = saveReg;
  }
  function keepScroll(fn) { var y = window.scrollY; fn(); window.scrollTo(0, y); }
  function act(el, e) {
    var a = el.dataset.act, v = el.dataset.v;
    switch (a) {
      case 'period': S.period = v; S.open = null; render(); break;
      case 'pprev': if (S.period === 'week') S.wOff--; else S.mOff--; render(); break;
      case 'pnext': if (S.period === 'week') S.wOff++; else S.mOff++; render(); break;
      case 'pnow': S.wOff = 0; S.mOff = 0; render(); break;
      case 'open': S.open = S.open === v ? null : v; keepScroll(render); break;
      case 'gowod': e.preventDefault(); S.wodDay = v; S.wodWeek = Math.round((monday(parseD(v)) - monday(today())) / (7 * 864e5)); location.hash = '#wod'; break;
      case 'openpr': S.prKey = v; S.prLevel = el.dataset.l || 'RX'; if (location.hash !== '#pr') location.hash = '#pr'; else { render(); window.scrollTo(0, 0); } break;
      case 'prback': S.prKey = null; render(); break;
      case 'prlvl': S.prLevel = v; render(); break;
      case 'prfam': S.prFam = v; render(); window.scrollTo(0, 0); break;
      case 'wprev': S.wodWeek--; S.wodDay = null; render(); break;
      case 'wnext': S.wodWeek++; S.wodDay = null; render(); break;
      case 'wday': S.wodDay = v; keepScroll(render); break;
      case 'expand': var d = $('#d-' + CSS.escape(v)); if (d) d.classList.remove('clamp'); el.remove(); break;
      case 'score': openScore(v); break;
      case 'board': openBoard(v); break;
      case 'addboard': openBoard(v); break;
      case 'close': closeSheet(); break;
      case 'fmode': F = { mode: v }; render(); break;
      case 'fdate': F.date = v; $('#s-date').value = v; $$('[data-act="fdate"]').forEach(function (x) { x.setAttribute('aria-pressed', x.dataset.v === v); }); break;
      case 'flvl': F.level = v; $$('[data-act="flvl"]').forEach(function (x) { x.setAttribute('aria-pressed', x.dataset.v === v); }); break;
      case 'frpe': F.rpe = +v; $$('[data-act="frpe"]').forEach(function (x) { x.setAttribute('aria-pressed', x.dataset.v === v); }); break;
      case 'fsave': saveScore(false); break;
      case 'fskip': saveScore(true); break;
      case 'refresh': load(true); break;
    }
  }
  function route() {
    var t = (location.hash || '#accueil').slice(1) || 'accueil';
    if (['accueil', 'wod', 'ajouter', 'pr', 'analyse', 'moi'].indexOf(t) < 0) t = 'accueil';
    if (t !== 'pr' && S.tab === 'pr') S.prKey = null;
    if (t === 'ajouter' && !F) F = { mode: 'wod' };
    S.tab = t; closeSheet(); render(); window.scrollTo(0, 0);
  }

  // ---------- Chargement ----------
  function load(force) {
    S.loading = true; S.error = null; if (M) render();
    return apiGet().then(function (data) {
      S.raw = data; M = build(data); S.loading = false; S.syncedAt = new Date();
      cachePut('data', data); render();
      if (force) toast('Données à jour');
    }).catch(function (err) {
      S.loading = false;
      S.error = err.message === 'config' ? 'config' : 'Synchro impossible : ' + err.message + '. Affichage des dernières données connues.';
      render();
    });
  }
  window.addEventListener('hashchange', route);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('#sheet').hidden) closeSheet(); });
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(function () {});

  var start = (location.hash || '#accueil').slice(1);
  S.tab = start || 'accueil';
  if (demoUrl()) { load(false); }
  else cacheGet('data').then(function (cached) {
    if (cached) { S.raw = cached; M = build(cached); }
    render();
    if (getCfg().url) load(false); else { S.loading = false; S.error = 'config'; render(); }
  });
})();
