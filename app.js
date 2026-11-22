/* Kaizen v2.0 — suivi CrossFit, DarkZone et endurance.
   Les données vivent dans le Google Sheet "Kaizen", lu et écrit via une passerelle Apps Script.
   Rien de personnel n'est stocké dans ce dépôt : l'adresse de la passerelle, le code secret et la photo restent sur le téléphone. */
(function () {
  'use strict';

  var VERSION = '2.4.3';
  var CFG_KEY = 'kaizen.config';
  var UI_KEY = 'kaizen.ui';
  var PHOTO_KEY = 'kaizen.photo';
  var DB_NAME = 'kaizen';
  var MV = window.KaizenMoves;

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
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function fmtDay(s) { var d = parseD(s); return d.getDate() + ' ' + MO[d.getMonth()] + ' ' + d.getFullYear(); }
  function fmtDayShort(s) { var d = parseD(s); return DOWL[d.getDay()].slice(0, 3) + '. ' + d.getDate(); }
  function fmtDayMid(s) { var d = parseD(s); return DOWL[d.getDay()].slice(0, 3) + '. ' + d.getDate() + ' ' + MO[d.getMonth()]; }
  function fmtMonthYear(s) { var d = parseD(s); return MO[d.getMonth()] + ' ' + d.getFullYear(); }
  function fmtTime(sec) { sec = Math.round(sec); var h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60; return h ? h + ':' + pad(m) + ':' + pad(s) : m + ':' + pad(s); }
  function fmtDur(min) { min = Math.round(min); var h = Math.floor(min / 60), m = min % 60; return h ? h + ' h ' + pad(m) : m + ' min'; }
  function fmtNum(n, d) { if (n == null) return '—'; var f = d == null ? (Math.round(n) === n ? 0 : 1) : d; return n.toFixed(f).replace('.', ','); }
  function fmtInt(n) { return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
  function fmtKg(n) { return fmtNum(Math.round(n * 2) / 2) + ' kg'; }
  function fmtTonnage(kg) { return kg >= 1000 ? fmtNum(kg / 1000, kg >= 100000 ? 0 : 1) + ' t' : fmtInt(kg) + ' kg'; }
  function round05(n) { return Math.round(n * 2) / 2; }
  function uid(prefix) { return prefix + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function parseTimeStr(t) { var p = String(t).trim().split(':').map(Number); if (p.some(isNaN)) return null; return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p.length === 2 ? p[0] * 60 + p[1] : p[0]; }
  function normName(n) { return String(n || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim(); }
  function titleName(n) { return String(n || '').toLowerCase().replace(/(^|[\s-])(\S)/g, function (m, a, b) { return a + b.toUpperCase(); }); }
  function icon(path) { return '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="' + path + '"/></svg>'; }
  function chev(open) { return '<svg class="chev" aria-hidden="true" viewBox="0 0 24 24"><path d="' + (open ? I.up : I.down) + '"/></svg>'; }
  var I = { left: 'M15 6l-6 6 6 6', right: 'M9 6l6 6-6 6', plus: 'M12 5v14M5 12h14', down: 'M6 9l6 6 6-6', up: 'M6 15l6-6 6 6', gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7 7 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z', check: 'M5 12l5 5 9-10', x: 'M6 6l12 12M18 6L6 18', trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13', sync: 'M20 11a8 8 0 0 0-14.6-4.5M4 4v4h4M4 13a8 8 0 0 0 14.6 4.5M20 20v-4h-4' };

  // ---------- Config et stockage ----------
  function getCfg() { try { return JSON.parse(localStorage.getItem(CFG_KEY) || '{}'); } catch (e) { return {}; } }
  function setCfg(c) { try { localStorage.setItem(CFG_KEY, JSON.stringify(c)); } catch (e) {} }
  function getUi() { try { return JSON.parse(localStorage.getItem(UI_KEY) || '{}'); } catch (e) { return {}; } }
  function setUi(k, v) { try { var u = getUi(); u[k] = v; localStorage.setItem(UI_KEY, JSON.stringify(u)); } catch (e) {} }
  function getPhoto() { try { return localStorage.getItem(PHOTO_KEY); } catch (e) { return null; } }

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
  var ui0 = getUi();
  var S = {
    raw: null, loading: true, error: null, syncedAt: null,
    tab: 'accueil', period: 'week', wOff: 0, mOff: 0, open: null, openAll: {},
    wodWeek: 0, wodDay: null, ver: {}, prLevel: 'RX', prKey: null,
    prOpen: ui0.prOpen || { lifts: true, gym: false, endu: false, wod: true }, wodTab: ui0.wodTab || 'girls',
    boardFilter: 'all'
  };
  var M = null; // modèle calculé

  // ---------- Classification ----------
  var GIRLS = ['amanda', 'angie', 'annie', 'barbara', 'candy', 'chelsea', 'cindy', 'diane', 'elizabeth', 'eva', 'fran', 'grace', 'gwen', 'helen', 'hope', 'isabel', 'jackie', 'karen', 'kelly', 'linda', 'lynne', 'maggie', 'mary', 'nancy', 'nicole', 'fight gone bad', 'filthy fifty'];
  var HEROES = ['dt', 'murph', 'jt', 'michael', 'randy', 'nate', 'badger', 'chad', 'loredo', 'kalsu', 'josh', 'jason', 'daniel', 'griff', 'luce', 'manion', 'whitten', 'the seven', 'zimmerman', 'holleyman', 'mcghee', 'ryan', 'tommy v', 'wittman', 'jerry', 'glen', 'bull', 'roy', 'danny', 'hansen', 'nutts', 'the chief'];
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
  var VERSIONS = ['RX', 'Inter', 'Rookie'];
  var SCORE_TYPES = { temps: 'Temps', temps_tours: 'Temps / tour', reps: 'Reps', valide: 'Completed', charge: 'Charge', rounds_reps: 'Rounds + reps', distance: 'Distance' };
  function isTime(t) { return t === 'temps' || t === 'temps_tours'; }
  function lvlBucket(n) { return n === 'RX' || !n ? 'RX' : 'Rookie'; }

  function splitBloc(b) {
    if (b.type_bloc === 'haltero') return { haltero: 1 };
    if (b.type_bloc === 'gym') return { gym: 1 };
    if (b.type_bloc === 'cardio') return { cardio: 1 };
    if (b.type_bloc === 'renfo') return { renfo: 1 };
    var text = b.description ? MV.section(b.description, 'RX') : (b.nom || '');
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

  function parseDetail(s) {
    var o = {};
    String(s || '').split(/[;,]/).forEach(function (p) { var m = p.split(':'); var v = num(m[1]); if (m[0] && v) o[m[0].trim().toLowerCase()] = (o[m[0].trim().toLowerCase()] || 0) + v; });
    return o;
  }
  function detailStr(o) { return Object.keys(o).filter(function (k) { return o[k]; }).map(function (k) { return k + ':' + o[k]; }).join(';'); }

  function estimateDuration(b, scoreSec) {
    if (scoreSec) return Math.max(1, Math.round(scoreSec / 60));
    if (num(b.duree_min)) return num(b.duree_min);
    var t = (b.description || '') + ' ' + (b.nom || '');
    var m = t.match(/every\s*(\d+)\s*['’]?\s*(?:min\w*)?\s*[x×]\s*(\d+)/i);
    if (m) return (+m[1]) * (+m[2]);
    m = t.match(/(?:amrap|emom)\s*(\d+)/i); if (m) return +m[1];
    m = t.match(/every\s*[\d:]+\s*\w*\s*for\s*(\d+)/i); if (m) return +m[1];
    var r = t.match(/(\d+)\s*rounds?/i), rest = t.match(/rest\s*(\d+)\s*(''|"|s\b|['’:](\d+)?)?/i);
    if (r) {
      // « Rest 30'' » = 30 secondes, « Rest 1'30 » = 1 min 30.
      var restMin = !rest ? 1 : (rest[2] === "''" || rest[2] === '"' || /^s/i.test(rest[2] || '')) ? (+rest[1]) / 60 : (+rest[1]) + (rest[3] ? (+rest[3]) / 60 : 0);
      return Math.max(1, Math.round((+r[1]) * (1.5 + restMin)));
    }
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
      o.tours = r.score_tours ? String(r.score_tours).split(';').map(num) : null;
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
    var movBy = {};
    (raw.mouvements || []).forEach(function (r) {
      (movBy[r.bloc_id] = movBy[r.bloc_id] || []).push({ ordre: num(r.ordre) || 0, name: String(r.mouvement || ''), key: MV.canon(r.mouvement), reps: num(r.reps), load: num(r.charge_kg), nbDb: num(r.nb_db), unit: r.unite || 'reps', presc: num(r.charge_prog), machine: MV.machineOf(MV.canon(r.mouvement)),
        perRounds: r.reps_rounds ? String(r.reps_rounds).split(';').map(num) : null,
        perLoads: r.charges_rounds ? String(r.charges_rounds).split(';').map(num) : null });
    });
    Object.keys(movBy).forEach(function (k) { movBy[k].sort(function (a, b) { return a.ordre - b.ordre; }); });
    var sexOf = {};
    (raw.athletes || []).forEach(function (a) { if (a.nom) sexOf[normName(a.nom)] = String(a.sexe || '').toUpperCase().charAt(0); });
    var goals = [];
    try { goals = JSON.parse(reg.objectifs || '[]') || []; } catch (e) { goals = []; }
    // v2.4 : forme (Athlytic) et séances de la montre
    var forme = {};
    (raw.forme || []).forEach(function (r) {
      var d = String(r.date || '').slice(0, 10); if (!/^\d{4}-\d\d-\d\d$/.test(d)) return;
      forme[d] = { date: d, recovery: num(r.recovery), vfc: num(r.vfc_ms), fc: num(r.fc_repos), sleep: num(r.sommeil_min), deep: num(r.profond_min), rem: num(r.rem_min), core: num(r.core_min), awake: num(r.eveil_min), sq: num(r.qualite_sommeil), sgoal: num(r.objectif_sommeil_min), ex: num(r.exertion), exMin: num(r.exertion_min), exMax: num(r.exertion_max), trimp: num(r.trimp), l7: num(r.charge_7j), l42: num(r.charge_6sem), ratio: num(r.ratio_charge), rating: String(r.statut_charge || '') };
      if (forme[d].recovery != null) forme[d].recovery = Math.round(forme[d].recovery);
    });
    var montre = (raw.montre || []).map(function (r) {
      var dur = num(r.duree_min);
      return { id: String(r.id || ''), date: String(r.date || '').slice(0, 10), heure: String(r.heure || '').slice(0, 5), type: String(r.type || ''), dur: dur != null ? Math.round(dur) : null, effort: num(r.effort), kcal: num(r.kcal) != null ? Math.round(num(r.kcal)) : null, km: num(r.distance_km) };
    }).filter(function (w) { return /^\d{4}-\d\d-\d\d$/.test(w.date); }).sort(function (a, b) { return (a.date + a.heure) < (b.date + b.heure) ? -1 : 1; });
    var montreBy = {};
    montre.forEach(function (w) { (montreBy[w.date] = montreBy[w.date] || []).push(w); });
    var m = { reg: reg, seances: seances, strava: strava, cls: clsBy, mov: movBy, sexOf: sexOf, goals: goals, byId: {}, gateway: raw.version_passerelle || (raw.mouvements ? 2 : 1), movCache: {}, forme: forme, montre: montre, montreBy: montreBy };
    seances.forEach(function (s) { m.byId[s.id] = s; });
    M = m;
    m.records = buildRecords(seances, strava);
    return m;
  }

  // Mouvements d'un bloc fait : saisis (onglet Mouvements) ou lus dans le texte du WOD.
  function movesOf(s, version) {
    if (!version && M.mov[s.id]) return M.mov[s.id];
    var v = version || s.niveau || 'RX';
    var k = s.id + '|' + v + '|' + s.score_valeur + '|' + s.type_score;
    if (!M.movCache[k]) M.movCache[k] = MV.parse(s.description, { reg: M.reg, sex: M.reg.sexe || 'H', version: v, score: s.score_valeur, scoreType: s.type_score });
    return M.movCache[k];
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
  // Les WODs de l'Open : un temps (fini) bat toujours un score en reps (time cap).
  function openValue(s) {
    var t = String(s.score_affiche || '');
    if (/^\d+:\d{2}(:\d{2})?$/.test(t.trim())) return 1e7 - parseTimeStr(t);
    var kg = t.match(/([\d.,]+)\s*kg/i); if (kg) return num(kg[1]);
    var r = t.match(/(\d+)\s*rds?(?:\s*\+\s*(\d+))?/i); if (r) return (+r[1]) * 1000 + (+(r[2] || 0));
    var reps = t.match(/(\d+)\s*reps?/i); if (reps) return +reps[1];
    return s.score_valeur;
  }

  function buildRecords(seances, strava) {
    var keys = {};
    function add(key, fam, label, detail, dir, unit, att, sub) {
      var k = keys[key] || (keys[key] = { key: key, fam: fam, sub: sub || null, label: label, detail: detail, dir: dir, unit: unit, att: [] });
      k.att.push(att);
    }
    seances.forEach(function (s) {
      if (!s.done || (s.score_valeur == null && !s.score_affiche)) return;
      var lvl = lvlBucket(s.niveau);
      var att = { date: s.date_faite || s.date_prog, value: s.score_valeur, display: s.score_affiche, level: lvl, niveau: s.niveau, src: s.source, id: s.id };
      var nl = s.nom.toLowerCase().trim();
      var op = s.nom.match(/^([\d.A-Z\s\/]+?)\s*(?:Rx'd)?\s*-\s*CrossFit Games Open/i);
      if (op) { var ol = op[1].replace(/\s+/g, ' ').trim(); att.value = openValue(s); if (att.value == null) return; add('open|' + ol, 'wod', 'Open ' + ol, '', 1, 'open', att, 'open'); return; }
      if (s.score_valeur == null) return;
      var e = enduKeyFromName(s.nom);
      if (e && s.type_score === 'temps') { add('endu|' + e.sport + '|' + e.meters, 'endu', e.sport, distLabel(e.meters), -1, 'temps', att); return; }
      var gi = GIRLS.indexOf(nl) >= 0, he = HEROES.indexOf(nl) >= 0;
      if ((gi || he) && (s.type_score === 'temps' || s.type_score === 'rounds_reps' || s.type_score === 'reps')) {
        add('bench|' + nl, 'wod', s.nom, '', s.type_score === 'temps' ? -1 : 1, s.type_score, att, gi ? 'girls' : 'heroes'); return;
      }
      var lk = s.type_score === 'charge' ? liftKey(s.nom) : null;
      // Prog DarkZone « jusqu'à votre 1RM du jour » : le record porte sur le dernier mouvement du bloc.
      if (!lk && s.type_score === 'charge' && /1\s*RM du jour|max du jour|heavy single/i.test(s.description || '')) {
        var mvs = MV.parse(s.description, { reg: M.reg, version: s.niveau, score: s.score_valeur, scoreType: 'charge' });
        var last = mvs[mvs.length - 1];
        if (last) lk = { label: titleName(last.name), detail: '1RM' };
      }
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
    var out = Object.keys(keys).map(function (k) {
      var r = keys[k];
      r.att.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
      var dedup = [];
      r.att.forEach(function (a) { var d = dedup.find(function (x) { return x.date === a.date && x.level === a.level && Math.abs(x.value - a.value) <= (r.unit === 'temps' ? 3 : 0); }); if (d) { if (a.strava) d.strava = a.strava; } else dedup.push(a); });
      r.att = dedup;
      r.byLevel = {};
      ['RX', 'Rookie'].forEach(function (lvl) {
        var att = r.att.filter(function (a) { return a.level === lvl; });
        if (!att.length) return;
        var best = null, prs = [], ties = [];
        att.forEach(function (a) {
          if (!best) { best = a; return; }
          if (r.dir > 0 ? a.value > best.value : a.value < best.value) { a.prev = best; prs.push(a); best = a; }
          else if (a.value === best.value) { a.prev = best; ties.push(a); }
        });
        r.byLevel[lvl] = { att: att, best: best, prs: prs, ties: ties };
      });
      return r;
    });
    // Premier score d'un record (ex. premier 1RM en hang squat clean) : c'est un PR.
    // Chaque record reste à part : un 1RM ne se compare jamais à un 2RM.
    out.forEach(function (r) {
      Object.keys(r.byLevel).forEach(function (lvl) {
        var L = r.byLevel[lvl], first = L.att[0];
        if (first && L.prs.indexOf(first) < 0) { first.isFirst = true; L.prs.unshift(first); }
      });
    });
    return out;
  }
  function recordValue(r, v, a) {
    if (r.unit === 'open') { var x = a || (r.byLevel.RX && r.byLevel.RX.att.concat(r.byLevel.Rookie ? r.byLevel.Rookie.att : []).find(function (y) { return y.value === v; })); return x ? String(x.display || '').replace(/^(\d+)\s*reps$/, '$1 reps') : fmtNum(v); }
    if (r.unit === 'temps' || r.unit === 'duree') return r.unit === 'duree' ? Math.round(v) + ' s' : fmtTime(v);
    if (r.unit === 'charge') return fmtKg(v);
    if (r.unit === 'rounds_reps') { var rd = Math.floor(v), rp = Math.round((v - rd) * 1000); return rd + ' rds' + (rp ? ' + ' + rp : ''); }
    return Math.round(v) + (r.unit === 'reps' ? ' reps' : '');
  }
  function recordTitle(r) { return r.label + (r.detail ? ' · ' + r.detail : ''); }
  // PR et PR égalés entre deux dates (incluses), les plus récents d'abord.
  function prEvents(from, to, lvlOnly) {
    var out = [];
    M.records.forEach(function (r) {
      Object.keys(r.byLevel).forEach(function (lvl) {
        if (lvlOnly && lvl !== lvlOnly) return;
        r.byLevel[lvl].prs.forEach(function (a) { if (a.date >= from && a.date <= to) out.push({ r: r, a: a, lvl: lvl, tie: false }); });
        r.byLevel[lvl].ties.forEach(function (a) { if (a.date >= from && a.date <= to && a === r.byLevel[lvl].att.filter(function (x) { return x.value === a.value; }).slice(-1)[0]) out.push({ r: r, a: a, lvl: lvl, tie: true }); });
      });
    });
    return out.sort(function (x, y) { return x.a.date < y.a.date ? 1 : x.a.date > y.a.date ? -1 : (x.tie ? 1 : 0) - (y.tie ? 1 : 0); });
  }

  // ---------- Périodes et statistiques ----------
  function periodRange() {
    if (S.period === 'week') {
      var a = addDays(monday(today()), 7 * S.wOff);
      return { from: iso(a), to: iso(addDays(a, 6)), a: a, b: addDays(a, 6) };
    }
    var t = today(); var a2 = new Date(t.getFullYear(), t.getMonth() + S.mOff, 1); var b2 = new Date(a2.getFullYear(), a2.getMonth() + 1, 0);
    return { from: iso(a2), to: iso(b2), a: a2, b: b2 };
  }
  function stats(from, to, light) {
    var warm = num(M.reg.echauffement_min) || 0;
    var done = M.seances.filter(function (s) { return s.done && s.date_faite >= from && s.date_faite <= to; });
    var endu = M.strava.filter(function (a) { return a.endu && a.date >= from && a.date <= to; });
    var cfDays = {}, days = {};
    done.forEach(function (s) { cfDays[s.date_faite] = 1; days[s.date_faite] = 1; });
    endu.forEach(function (a) { days[a.date] = 1; });
    var wEndu = freeEndu(from, to);
    wEndu.forEach(function (w) { days[w.date] = 1; });
    var res = { done: done, endu: endu, days: days, wEndu: wEndu };
    if (light) return res;
    // Durée : la montre fait foi les jours où elle a enregistré la séance, sinon estimation + échauffement.
    var minutes = 0, split = { haltero: 0, gym: 0, cardio: 0, renfo: 0 }, byDay = {}, watchDays = 0;
    done.forEach(function (s) {
      var d = s.duree_min || estimateDuration(s, s.type_score === 'temps' ? s.score_valeur : s.type_score === 'temps_tours' && s.tours ? s.tours.reduce(function (a, x) { return a + (x || 0); }, 0) : null);
      (byDay[s.date_faite] = byDay[s.date_faite] || []).push({ s: s, d: d });
    });
    function tot(a) { return a.reduce(function (x, it) { return x + it.d; }, 0); }
    Object.keys(byDay).forEach(function (ds) {
      var items = byDay[ds], ws = cfWatch(ds), est = tot(items) || 1;
      if (ws.length) {
        watchDays++;
        var wc = 0, wf = 0;
        ws.forEach(function (w) { if (wKind(w) === 'force') wf += w.dur || 0; else wc += w.dur || 0; });
        var dcb = dayBlocks(ds).cond, cond = items.filter(function (it) { return dcb.indexOf(it.s) >= 0; }), oth = items.filter(function (it) { return dcb.indexOf(it.s) < 0; });
        if (wc && wf && cond.length && oth.length) {
          var kc = wc / (tot(cond) || 1), kf = wf / (tot(oth) || 1);
          items.forEach(function (it) { it.d = it.d * (dcb.indexOf(it.s) >= 0 ? kc : kf); });
        } else { var k = (wc + wf) / est; items.forEach(function (it) { it.d = it.d * k; }); }
      } else minutes += warm;
      items.forEach(function (it) {
        minutes += it.d;
        var sp = splitBloc(it.s);
        Object.keys(sp).forEach(function (x) { split[x] += sp[x] * it.d; });
      });
    });
    endu.forEach(function (a) { var d = (a.duree_s || 0) / 60; minutes += d; split.cardio += d; });
    wEndu.forEach(function (w) { minutes += w.dur || 0; split.cardio += w.dur || 0; });
    res.watchDays = watchDays; res.cfDayCount = Object.keys(byDay).length;
    var km = {}, cal = {}, reps = {}, kg = {}, names = {};
    endu.forEach(function (a) { if (a.distance_km) km[a.endu] = (km[a.endu] || 0) + a.distance_km; });
    wEndu.forEach(function (w) { var e = WT_ENDU[w.type]; if (w.km && e) km[e] = (km[e] || 0) + w.km; });
    done.forEach(function (s) {
      var mv = movesOf(s);
      var k = parseDetail(s.km_detail), c = parseDetail(s.cal_detail);
      var hasK = Object.keys(k).length, hasC = Object.keys(c).length;
      mv.forEach(function (m) {
        if (!m.reps) return;
        if (m.unit === 'reps') {
          reps[m.key] = (reps[m.key] || 0) + m.reps; names[m.key] = m.name;
          var t = MV.kgOf(m); if (t) kg[m.key] = (kg[m.key] || 0) + t;
        } else if (m.unit === 'cal' && m.machine && !hasC) c[m.machine] = (c[m.machine] || 0) + m.reps;
        else if (m.unit === 'm' && m.machine && !hasK) k[m.machine] = (k[m.machine] || 0) + m.reps / 1000;
      });
      Object.keys(k).forEach(function (x) { km[x] = (km[x] || 0) + k[x]; });
      Object.keys(c).forEach(function (x) { cal[x] = (cal[x] || 0) + c[x]; });
    });
    var prog = M.seances.filter(function (s) { return s.source === 'DarkZone' && s.date_prog >= from && s.date_prog <= to; });
    return Object.assign(res, { minutes: minutes, split: split, km: km, cal: cal, reps: reps, kg: kg, names: names, prog: prog, progDone: prog.filter(function (s) { return s.done; }).length, prs: prEvents(from, to) });
  }
  function sum(o) { return Object.keys(o).reduce(function (s, k) { return s + o[k]; }, 0); }
  function sortedKeys(o) { return Object.keys(o).sort(function (a, b) { return o[b] - o[a]; }); }

  // ---------- Rendu commun ----------
  function setNav() { $$('.tabs a').forEach(function (a) { a.setAttribute('aria-current', a.dataset.tab === S.tab || (S.tab === 'ajouter' && a.dataset.tab === 'wod') || (S.tab === 'forme' && a.dataset.tab === 'accueil') ? 'page' : 'false'); }); }
  function toast(t) { var el = $('#toast'); el.textContent = t; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(function () { el.hidden = true; }, 2800); }
  function syncBtn() {
    if (!getCfg().url && !demoUrl()) return '';
    var at = S.syncedAt ? (iso(S.syncedAt) === iso(today()) ? pad(S.syncedAt.getHours()) + ':' + pad(S.syncedAt.getMinutes()) : S.syncedAt.getDate() + ' ' + MO[S.syncedAt.getMonth()]) : '';
    return '<button class="sync-btn' + (S.loading ? ' spin' : '') + '" data-act="refresh" aria-label="Mettre à jour depuis le Sheet"' + (S.loading ? ' disabled' : '') + '>' + icon(I.sync) + '<span>' + (S.loading ? 'Synchro…' : at ? 'Maj ' + at : 'Mettre à jour') + '</span></button>';
  }
  function syncLine() {
    if (S.loading) return '<div class="loading">Synchronisation avec le Sheet…</div>';
    if (S.error) return '<div class="loading" style="color:var(--amber)">' + esc(S.error) + '</div>';
    if (M && M.gateway < 2 && !demoUrl()) return '<div class="notice">Ta passerelle Apps Script est encore en v1 : remplace Code.gs par la version 2 (étape 1 du tuto) pour enregistrer les reps, les charges et les noms des classements.</div>';
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
    var fn = { accueil: viewAccueil, wod: viewWod, ajouter: viewAjouter, pr: viewPr, analyse: viewAnalyse, moi: viewMoi, forme: viewForme }[S.tab] || viewAccueil;
    v.innerHTML = fn();
    bind();
  }
  function avatarHtml(size) {
    var name = M ? (M.reg.nom_affiche || 'Le Yves') : 'Kaizen';
    var initials = name.split(/[\s-]+/).filter(Boolean).map(function (w) { return w[0]; }).join('').slice(0, 2).toUpperCase() || 'K';
    var ph = getPhoto();
    var st = size ? ' style="width:' + size + 'px;height:' + size + 'px;font-size:' + Math.round(size * 0.38) + 'px"' : '';
    return ph ? '<div class="avatar photo"' + st + ' aria-hidden="true"><img src="' + ph + '" alt=""></div>' : '<div class="avatar"' + st + ' aria-hidden="true">' + esc(initials) + '</div>';
  }
  function barRows(src, keys, labelOf, valOf, color) {
    var max = keys.reduce(function (m, k) { return Math.max(m, src[k]); }, 0) || 1;
    return keys.map(function (k) {
      return '<div class="row"><span class="bl">' + esc(labelOf(k)) + '</span><div class="bar"><div style="width:' + Math.max(2, Math.round(src[k] / max * 100)) + '%;background:' + color + '"></div></div><b class="bv">' + valOf(src[k]) + '</b></div>';
    }).join('');
  }

  // ---------- Accueil ----------
  function viewAccueil() {
    var name = M.reg.nom_affiche || 'Le Yves';
    var r = periodRange(), st = stats(r.from, r.to), goal = num(M.reg.objectif_jours) || 5;
    var isWeek = S.period === 'week', isCur = isWeek ? S.wOff === 0 : S.mOff === 0;
    var label = isWeek ? 'Du ' + r.a.getDate() + (r.a.getMonth() !== r.b.getMonth() ? ' ' + MO[r.a.getMonth()] : '') + ' au ' + r.b.getDate() + ' ' + MO[r.b.getMonth()] : cap(MOL[r.a.getMonth()]) + ' ' + r.a.getFullYear();
    var nextDis = isWeek ? S.wOff >= 1 : S.mOff >= 0;
    var nDays = Object.keys(st.days).length, t = iso(today());
    var goalP = isWeek ? goal : Math.round(goal * r.b.getDate() / 7);
    var word = isWeek ? 'semaine' : 'mois', ce = isWeek ? 'cette semaine' : 'ce mois-ci';
    var h = '';
    h += '<div class="between"><span class="row" style="gap:10px;align-items:center"><span class="brand">KAIZEN <small>改善</small></span><span class="ver">v' + VERSION + '</span></span><a class="icon-btn" href="#moi" aria-label="Réglages">' + icon(I.gear) + '</a></div>';
    h += '<header class="row" style="gap:14px;margin-top:-8px;align-items:center">' + avatarHtml() + '<div class="stack" style="gap:2px"><span class="label">Salut</span><h1 class="h1">' + esc(name) + '</h1></div>' + syncBtn() + '</header>';
    h += syncLine();
    h += formeButton();
    h += '<div class="seg" role="group" aria-label="Période"><button type="button" data-act="period" data-v="week" aria-pressed="' + isWeek + '">Semaine</button><button type="button" data-act="period" data-v="month" aria-pressed="' + !isWeek + '">Mois</button></div>';
    h += '<div class="between" style="margin-top:-6px"><button class="icon-btn" data-act="pprev" aria-label="Période précédente">' + icon(I.left) + '</button><div class="stack" style="gap:2px;align-items:center"><b style="font-size:16px">' + label + '</b>' +
      (isCur ? '<span class="small red" style="font-weight:600">' + (isWeek ? 'Semaine en cours' : 'Mois en cours') + '</span>' : '<button class="chip" style="min-height:30px;font-size:12px" data-act="pnow">' + (isWeek && S.wOff > 0 ? 'À venir · revenir à aujourd’hui' : 'Revenir à aujourd’hui') + '</button>') +
      '</div><button class="icon-btn" data-act="pnext" aria-label="Période suivante"' + (nextDis ? ' disabled' : '') + '>' + icon(I.right) + '</button></div>';

    // Assiduité
    h += '<section class="stack"><div class="between"><h2 class="label">Assiduité</h2><span class="num" style="font-size:30px">' + nDays + '<span style="color:var(--faint)">/' + goalP + ' jours</span></span></div>';
    if (isWeek) {
      h += '<div class="days">';
      for (var i = 0; i < 7; i++) {
        var d = addDays(r.a, i), ds = iso(d), trained = st.days[ds], isT = ds === t;
        h += '<button type="button" class="day' + (trained ? ' trained' : '') + (isT ? ' today' : '') + '" data-act="gowod" data-v="' + ds + '" aria-label="Voir le ' + DOWL[d.getDay()] + ' ' + d.getDate() + ' dans WOD"><span class="d">' + DOW[d.getDay()] + '</span><span class="n">' + d.getDate() + '</span><span class="small" style="font-size:10px">' + (trained ? '✓' : isT ? 'auj.' : '') + '</span>' + dayDot(ds) + '</button>';
      }
      h += '</div>';
    } else {
      h += '<div class="cal" aria-label="' + nDays + ' jours d’entraînement">';
      var off = (r.a.getDay() + 6) % 7;
      for (var k = 0; k < off; k++) h += '<div class="off"></div>';
      for (var dd = 1; dd <= r.b.getDate(); dd++) {
        var ds2 = iso(new Date(r.a.getFullYear(), r.a.getMonth(), dd));
        h += '<button type="button" class="' + (st.days[ds2] ? 't' : ds2 > t ? 'future' : '') + (ds2 === t ? ' today' : '') + '" data-act="gowod" data-v="' + ds2 + '" aria-label="Voir le ' + dd + ' dans WOD">' + dd + '</button>';
      }
      h += '</div>';
    }
    h += '</section>';

    // Chiffres clés
    var progTxt = st.prog.length ? 'sur ' + st.prog.length + ' prévus · ' + Math.round(st.progDone / st.prog.length * 100) + ' %' : 'blocs faits';
    var nPr = st.prs.filter(function (p) { return !p.tie; }).length, nTie = st.prs.length - nPr;
    h += '<section class="grid3" aria-label="Chiffres clés">' +
      '<div class="tile"><span class="num">' + st.done.length + '</span><span class="cap">' + (st.prog.length ? 'blocs faits ' + progTxt : 'blocs faits') + '</span></div>' +
      '<div class="tile"><span class="num">' + fmtDur(st.minutes) + '</span><span class="cap">' + (!st.watchDays ? 'd’entraînement, échauff. inclus' : st.watchDays >= st.cfDayCount ? 'd’entraînement, mesuré par ta montre' : 'd’entraînement · montre ' + st.watchDays + ' j sur ' + st.cfDayCount + ', reste estimé') + '</span></div>' +
      '<div class="tile"><span class="num">' + nPr + '</span><span class="cap">PR ' + ce + (nTie ? ' · ' + nTie + ' égalé' + (nTie > 1 ? 's' : '') : '') + '</span></div></section>';

    // Ce que tu fais vraiment (mois)
    if (!isWeek && st.prog.length) {
      var byT = {};
      st.prog.forEach(function (s) { var x = byT[s.type_bloc] = byT[s.type_bloc] || [0, 0]; x[1]++; if (s.done) x[0]++; });
      h += '<section class="card" style="gap:10px"><h2 class="label">Ce que tu fais vraiment</h2>' + sortedKeys(Object.keys(byT).reduce(function (o, k) { o[k] = byT[k][1]; return o; }, {})).map(function (k) {
        var p = Math.round(byT[k][0] / byT[k][1] * 100);
        return '<div class="row"><span class="bl">' + esc(BLOC_LABEL[k] || k) + '</span><div class="bar"><div style="width:' + Math.max(2, p) + '%;background:var(--red)"></div></div><b class="bv">' + p + ' %</b></div>';
      }).join('') + '<span class="small muted">Part des blocs DarkZone faits, par type</span></section>';
    }

    // Volume
    h += '<h2 class="label" style="margin-bottom:-8px">Volume ' + (isWeek ? 'de la semaine' : 'du mois') + '</h2>';
    var repsTot = sum(st.reps), kgTot = sum(st.kg), kmTot = sum(st.km), calTot = sum(st.cal);
    var top = sortedKeys(st.reps).slice(0, 3);
    if (top.length) {
      h += '<section class="podium" aria-label="Top 3 mouvements en reps">' + top.map(function (k, i) {
        return '<div class="pod p' + (i + 1) + '"><span class="place">' + (i + 1) + '</span><span class="num">' + fmtInt(st.reps[k]) + '</span><span class="cap">' + esc(st.names[k] || k) + '</span></div>';
      }).join('') + '</section>';
    }
    function tile(key, big, unit, capTxt) {
      var o = S.open === key;
      return '<button type="button" class="tile" data-act="open" data-v="' + key + '" aria-expanded="' + o + '"><span class="between" style="width:100%"><span class="num">' + big + '<span style="font-size:18px"> ' + unit + '</span></span>' + chev(o) + '</span><span class="cap">' + capTxt + '</span></button>';
    }
    var kgBig = kgTot >= 1000 ? fmtNum(kgTot / 1000, 1) : fmtInt(kgTot), kgUnit = kgTot >= 1000 ? 't' : 'kg';
    h += '<section class="stack"><div class="grid2">' + tile('reps', fmtInt(repsTot), 'reps', 'répétitions') + tile('kg', kgBig, kgUnit, 'soulevés') + '</div>';
    if (S.open === 'reps' || S.open === 'kg') {
      var src = S.open === 'reps' ? st.reps : st.kg, ks = sortedKeys(src), all = S.openAll[S.open], shown = all ? ks : ks.slice(0, 10);
      h += '<div class="card" style="gap:10px">' + (ks.length ? barRows(src, shown, function (k) { return st.names[k] || k; }, S.open === 'reps' ? fmtInt : fmtTonnage, S.open === 'reps' ? 'var(--blue)' : 'var(--amber)') : '<span class="muted small">Rien sur cette période.</span>') +
        (ks.length > 10 ? '<button class="chip" style="align-self:flex-start;min-height:32px" data-act="openall" data-v="' + S.open + '">' + (all ? 'Réduire' : 'Voir les ' + ks.length + ' mouvements') + '</button>' : '') +
        '<span class="small muted">' + (S.open === 'reps' ? 'Calculé à partir des WODs faits (reps × rounds, selon ta version) ou des reps que tu saisis. Les calories et les distances restent dans leurs tuiles.' : 'Charge × reps pour chaque mouvement lesté, × 2 avec deux haltères. Le poids du corps n’est pas compté.') + '</span></div>';
    }
    h += '<div class="grid2">' + tile('km', fmtNum(kmTot, 1), 'km', 'parcourus') + tile('cal', fmtInt(calTot), 'cal', 'sur les machines') + '</div>';
    if (S.open === 'km' || S.open === 'cal') {
      var src2 = S.open === 'km' ? st.km : st.cal, ks2 = sortedKeys(src2);
      h += '<div class="card" style="gap:10px">' + (ks2.length ? barRows(src2, ks2, function (k) { return MACHINE_LABEL[k] || k; }, S.open === 'km' ? function (v) { return fmtNum(v, 1) + ' km'; } : function (v) { return fmtInt(v) + ' cal'; }, S.open === 'km' ? 'var(--red)' : 'var(--amber)') : '<span class="muted small">Rien sur cette période.</span>') +
        '<span class="small muted">' + (S.open === 'km' ? 'Run et bike depuis Strava · row et ski depuis les WODs et Strava' : 'Calories faites sur les machines dans les WODs (row, ski, bike, echo)') + '</span></div>';
    }
    h += '</section>';

    // PR de la période
    h += '<section class="card" style="gap:10px"><div class="between"><h2 class="label">PR ' + (isWeek ? 'de la semaine' : 'du mois') + '</h2><a class="small" href="#pr" style="font-weight:600">Tous mes PR</a></div>';
    if (st.prs.length) {
      h += '<div class="stack" style="gap:2px">' + st.prs.slice(0, 6).map(function (p) {
        return '<button class="li" style="padding:6px 0;min-height:0" data-act="openpr" data-v="' + esc(p.r.key) + '" data-l="' + p.lvl + '"><span class="t"><b>' + esc(recordTitle(p.r)) + '</b><span>' + fmtDayMid(p.a.date) + (p.tie ? ' · égalé' : p.a.isFirst ? ' · premier ' + esc(p.r.detail || 'score') : p.a.prev ? ' · avant ' + esc(recordValue(p.r, p.a.prev.value, p.a.prev)) : '') + (p.lvl === 'Rookie' ? ' · ' + esc(p.a.niveau || 'Rookie') : '') + '</span></span><span class="v red" style="font-size:24px">' + esc(recordValue(p.r, p.a.value, p.a)) + '</span></button>';
      }).join('') + '</div>';
    } else {
      var left = isCur ? (isWeek ? 6 - ((today().getDay() + 6) % 7) : r.b.getDate() - today().getDate()) : 0;
      h += '<span class="muted">Pas encore de PR ' + ce + '.' + (left > 0 ? ' Il reste ' + left + ' jour' + (left > 1 ? 's' : '') + (isWeek ? ' dans la semaine.' : ' dans le mois.') : '') + '</span>';
    }
    h += '</section>';

    // Répartition
    var tot = sum(st.split);
    if (tot > 0) {
      var fams = ['haltero', 'gym', 'cardio', 'renfo'];
      h += '<section class="stack"><h2 class="label">Répartition</h2><div class="stackbar" role="img" aria-label="Répartition du temps">' + fams.map(function (f) { var p = st.split[f] / tot * 100; return p > 0 ? '<div style="width:' + p + '%;background:' + FAM_COLOR[f] + '"></div>' : ''; }).join('') + '</div>';
      h += '<div class="legend">' + fams.map(function (f) { return '<div><i style="background:' + FAM_COLOR[f] + '"></i><span>' + FAM_LABEL[f] + '</span><b>' + Math.round(st.split[f] / tot * 100) + ' %</b></div>'; }).join('') + '</div></section>';
    }

    // Communauté
    var ranked = st.done.filter(function (s) { return s.rang && s.participants; });
    if (ranked.length) {
      h += '<section class="stack"><h2 class="label">Communauté DarkZone</h2><div class="list">' + ranked.map(function (s) {
        var g = gapToFirst(s);
        return '<button class="li" data-act="board" data-v="' + esc(s.id) + '"><span class="t"><b>' + esc(s.nom) + '</b><span>' + fmtDayShort(s.date_prog) + ' · ' + esc(s.score_affiche) + (g ? ' · ' + g : '') + '</span></span><span class="v">' + s.rang + '<span style="color:var(--faint)">/' + s.participants + '</span></span></button>';
      }).join('') + '</div></section>';
    }
    if (!st.done.length && !st.endu.length) h += '<div class="empty">Aucune séance sur cette période.<a class="btn primary" href="#ajouter">' + icon(I.plus) + 'Ajouter</a></div>';
    return h;
  }
  function gapToFirst(s) {
    var c = (M.cls[s.id] || []).filter(function (x) { return x.moi !== 'oui' && x.score_valeur != null; });
    if (!c.length || s.score_valeur == null || s.type_score === 'valide') return '';
    var lower = isTime(s.type_score);
    var best = c.reduce(function (b, x) { return b == null || (lower ? x.score_valeur < b : x.score_valeur > b) ? x.score_valeur : b; }, null);
    var diff = s.score_valeur - best;
    if ((lower && diff <= 0) || (!lower && diff >= 0)) return '1er';
    return (diff > 0 ? '+' : '–') + (lower ? fmtTime(Math.abs(diff)) : fmtNum(Math.abs(diff)) + (s.type_score === 'charge' ? ' kg' : '')) + ' sur le 1er';
  }

  // ---------- WOD ----------
  function weekStart() { return addDays(monday(today()), 7 * S.wodWeek); }
  function blocksForDay(ds) {
    return M.seances.filter(function (s) { return s.date_prog === ds || (!s.date_prog && s.date_faite === ds); })
      .sort(function (a, b) { return (a.source === 'DarkZone' ? 0 : 1) - (b.source === 'DarkZone' ? 0 : 1) || (a.id < b.id ? -1 : 1); });
  }
  function percentCalcs(desc) {
    var out = [], re = /(\d+)\s*%(?:\s*(?:to|à|-)\s*(\d+)\s*%)?[^\n]*?\b(?:du\s+|de\s+|of\s+)?(?:1\s*)?rm\s+([a-z&' ]{3,30})/gi, m;
    while ((m = re.exec(desc))) {
      var rm = MV.rmFor(m[3], M.reg); if (!rm) continue;
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
    var prev = M.seances.filter(function (s) { return s.id !== b.id && s.done && s.nom === b.nom && s.score_affiche && (s.date_faite || s.date_prog) < (b.date_faite || b.date_prog || '9999'); });
    prev.sort(function (a, c) { return a.date_faite < c.date_faite ? 1 : -1; });
    return prev[0] || null;
  }
  function hasVersions(b) { return MV.hasVersions(b.description); }
  function versionText(b, v) { return MV.section(b.description, v).trim(); }
  function blockCard(b) {
    var h = '<article class="card">';
    var status = b.done ? (b.date_faite && b.date_faite !== b.date_prog ? '<span class="small amber" style="font-weight:600">fait ' + fmtDayShort(b.date_faite) + (b.date_faite.slice(0, 7) !== b.date_prog.slice(0, 7) ? ' ' + MO[parseD(b.date_faite).getMonth()] : '') + '</span>' : '<span class="small ok" style="font-weight:600">fait</span>') : b.statut === 'non fait' ? '<span class="small muted">pas fait</span>' : '<span class="small muted">à faire</span>';
    h += '<div class="between"><div class="row" style="gap:6px;flex-wrap:wrap"><span class="tag ' + esc(b.type_bloc) + '">' + esc(BLOC_LABEL[b.type_bloc] || b.type_bloc) + '</span>' + (b.rpe_vise ? '<span class="tag outline">RPE visé ' + b.rpe_vise + '</span>' : '') + (b.source !== 'DarkZone' ? '<span class="tag outline">' + esc(b.source) + '</span>' : '') + '</div>' + status + '</div>';
    h += '<h3 class="h3">' + esc(b.nom) + '</h3>';
    if (b.description) {
      var txt = b.description, v = null;
      if (hasVersions(b)) {
        v = S.ver[b.id] || (b.done ? b.niveau : null) || M.reg.version_defaut || 'RX';
        txt = versionText(b, v);
        h += '<div class="seg" role="group" aria-label="Version">' + VERSIONS.map(function (x) { return '<button type="button" data-act="bver" data-id="' + esc(b.id) + '" data-v="' + x + '" aria-pressed="' + (v === x) + '">' + x + '</button>'; }).join('') + '</div>';
        if (v !== 'Rookie' && /RX\s*\/\s*INTER\s*VERSION/i.test(b.description)) h += '<span class="small muted" style="margin-top:-4px">DarkZone publie une version commune RX/Inter : tu précises ta catégorie au moment du score.</span>';
      }
      var long = txt.split('\n').length > 8;
      h += '<div class="desc' + (long ? ' clamp' : '') + '" id="d-' + esc(b.id) + '">' + esc(txt) + '</div>' + (long ? '<button class="chip" style="align-self:flex-start;min-height:32px" data-act="expand" data-v="' + esc(b.id) + '">Tout afficher</button>' : '');
      percentCalcs(txt).forEach(function (c) { h += '<div class="calc"><span style="flex:1">' + esc(c.txt) + '</span><b>' + esc(c.val) + '</b></div>'; });
    }
    if (b.done && b.type_score !== 'valide') {
      h += '<div class="inset"><div class="between"><div class="stack" style="gap:2px"><span class="small muted">Mon score · ' + esc(b.niveau || 'RX') + ' · ' + esc((SCORE_TYPES[b.type_score] || '').toLowerCase()) + '</span><span class="num" style="font-size:34px">' + esc(b.score_affiche || '—') + '</span></div>' +
        (b.rang ? '<div class="stack" style="gap:2px;align-items:flex-end"><span class="small muted">Rang</span><span class="num" style="font-size:34px">' + b.rang + (b.participants ? '<span style="color:var(--faint)">/' + b.participants + '</span>' : '') + '</span></div>' : '') + '</div>';
      var extra = [];
      if (b.rpe_ressenti) extra.push(['RPE ressenti', b.rpe_ressenti + (b.rpe_vise ? ' <span class="' + (b.rpe_ressenti > b.rpe_vise ? 'amber' : 'ok') + '">(' + (b.rpe_ressenti - b.rpe_vise >= 0 ? '+' : '') + (b.rpe_ressenti - b.rpe_vise) + ')</span>' : '')]);
      var sa = M.strava.find(function (a) { return a.date === b.date_faite && !a.endu && a.fc_moy; });
      if (sa) extra.push(['FC moy / max', sa.fc_moy + (sa.fc_max ? ' / ' + sa.fc_max : '')]);
      var g = gapToFirst(b); if (g) extra.push(['Écart au 1er', esc(g.replace(' sur le 1er', ''))]);
      if (extra.length) h += '<div class="grid3 small muted">' + extra.map(function (e) { return '<div class="stack" style="gap:2px"><span>' + e[0] + '</span><b style="font-size:14px;color:var(--ink)">' + e[1] + '</b></div>'; }).join('') + '</div>';
      if (b.type_score === 'temps_tours' && b.tours && b.tours.length) {
        var tk = b.tours.filter(function (x) { return x != null; });
        h += '<div class="small muted">Tours : <b style="color:var(--ink)">' + b.tours.map(function (x) { return x != null ? fmtTime(x) : '–'; }).join(' · ') + '</b>' + (tk.length > 1 ? ' · moyenne ' + fmtTime(tk.reduce(function (x, y) { return x + y; }, 0) / tk.length) + ' · écart ' + fmtTime(Math.max.apply(null, tk) - Math.min.apply(null, tk)) : '') + '</div>';
      }
      if (b.notes) h += '<div class="small muted pre">' + esc(b.notes) + '</div>';
      h += watchBlock(b) + '</div>';
    } else if (b.done) {
      h += '<div class="row ok" style="font-weight:600">' + icon(I.check).replace('<svg', '<svg style="width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:3"') + 'Validé' + (b.niveau && b.niveau !== 'RX' ? ' · ' + esc(b.niveau) : '') + (b.rpe_ressenti ? ' · RPE ' + b.rpe_ressenti : '') + '</div>';
      var wb = watchBlock(b); if (wb) h += '<div class="inset">' + wb + '</div>';
    }
    var lt = lastTime(b);
    if (lt) h += '<div class="small muted">La dernière fois : <b style="color:var(--ink)">' + esc(lt.score_affiche) + '</b> le ' + fmtDay(lt.date_faite || lt.date_prog) + (lt.niveau && lt.niveau !== 'RX' ? ' (' + esc(lt.niveau) + ')' : '') + '</div>';
    var c = M.cls[b.id];
    h += '<div class="grid2"><button class="btn' + (b.done ? '' : ' primary') + '" data-act="score" data-v="' + esc(b.id) + '">' + (b.done ? 'Modifier' : b.type_score === 'valide' ? 'Valider' : 'Ajouter mon score') + '</button>' +
      '<button class="btn' + (c && c.length ? ' soft' : '') + '" data-act="board" data-v="' + esc(b.id) + '">Classement' + (c && c.length ? ' · ' + boardRows(b).length : '') + '</button></div>';
    return h + '</article>';
  }
  function viewWod() {
    var a = weekStart(), t = iso(today());
    if (!S.wodDay || S.wodDay < iso(a) || S.wodDay > iso(addDays(a, 6))) S.wodDay = S.wodWeek === 0 ? t : iso(a);
    var e = addDays(a, 6);
    var h = '<header class="between"><h1 class="h1">WOD</h1><a class="btn primary" href="#ajouter">' + icon(I.plus) + 'Ajouter</a></header>';
    h += syncLine();
    h += '<div class="between"><button class="icon-btn" data-act="wprev" aria-label="Semaine précédente">' + icon(I.left) + '</button><b>Semaine du ' + a.getDate() + (a.getMonth() !== e.getMonth() ? ' ' + MO[a.getMonth()] : '') + ' au ' + e.getDate() + ' ' + MO[e.getMonth()] + (a.getFullYear() !== today().getFullYear() ? ' ' + a.getFullYear() : '') + '</b><button class="icon-btn" data-act="wnext" aria-label="Semaine suivante">' + icon(I.right) + '</button></div>';
    h += '<div class="days" role="tablist" aria-label="Jours">';
    for (var i = 0; i < 7; i++) {
      var d = addDays(a, i), ds = iso(d), has = blocksForDay(ds).length || M.strava.some(function (x) { return x.date === ds && x.endu; }) || freeWatch(ds).length;
      h += '<button type="button" role="tab" class="day' + (has ? ' has' : '') + (ds === t ? ' today' : '') + '" aria-selected="' + (ds === S.wodDay) + '" data-act="wday" data-v="' + ds + '"><span class="d">' + DOW[d.getDay()] + '</span><span class="n">' + d.getDate() + '</span><span class="dot"></span></button>';
    }
    h += '</div>';
    var blocks = blocksForDay(S.wodDay), endu = M.strava.filter(function (x) { return x.date === S.wodDay && x.endu; });
    var dd = parseD(S.wodDay), nd = blocks.filter(function (b) { return b.done; }).length;
    h += '<div class="between"><h2 style="font-size:18px">' + cap(DOWL[dd.getDay()]) + ' ' + dd.getDate() + ' ' + MOL[dd.getMonth()] + '</h2><span class="small muted">' + blocks.length + ' bloc' + (blocks.length > 1 ? 's' : '') + ' · ' + nd + ' fait' + (nd > 1 ? 's' : '') + '</span></div>';
    blocks.forEach(function (b) { h += blockCard(b); });
    endu.forEach(function (x) {
      h += '<article class="card"><div class="between"><span class="tag cardio">' + esc(x.sport) + '</span><span class="small muted">Strava · ' + esc(x.heure || '') + '</span></div><h3 class="h3">' + esc(x.nom) + '</h3><div class="grid3">' +
        stat('Distance', x.distance_km ? fmtNum(x.distance_km, 2) + ' km' : '—') + stat('Durée', x.duree_s ? fmtTime(x.duree_s) : '—') + stat(x.endu === 'row' || x.endu === 'ski' ? 'Allure /500 m' : 'Allure', paceStr(x)) +
        stat('FC moy.', x.fc_moy ? x.fc_moy + ' bpm' : '—') + stat(x.watts_moy ? 'Watts moy.' : 'Cadence', x.watts_moy ? x.watts_moy + ' W' : x.cadence_moy ? (x.endu === 'run' ? x.cadence_moy * 2 : x.cadence_moy) + (x.endu === 'run' ? ' pas/min' : '') : '—') + stat('Calories', x.calories ? x.calories + ' kcal' : '—') + '</div></article>';
    });
    var fw = freeWatch(S.wodDay);
    fw.forEach(function (w) { h += watchCard(w); });
    if (!blocks.length && !endu.length && !fw.length) h += '<div class="empty">Rien de prévu ce jour-là.<a class="btn primary" href="#ajouter">' + icon(I.plus) + 'Ajouter un WOD</a><span class="small">Ou envoie les captures de la semaine à Claude.</span></div>';
    return h;
  }
  function stat(l, v) { return '<div class="stack" style="gap:2px"><span class="small muted">' + l + '</span><b style="font-size:15px">' + v + '</b></div>'; }
  function paceStr(x) {
    if (!x.distance_km || !x.duree_s) return '—';
    if (x.endu === 'row' || x.endu === 'ski') return fmtTime(x.duree_s / (x.distance_km * 2));
    if (x.endu === 'run') return fmtTime(x.duree_s / x.distance_km) + '/km';
    return fmtNum(x.distance_km / (x.duree_s / 3600), 1) + ' km/h';
  }

  // ---------- Ajouter ----------
  var F = null; // formulaire en cours
  function viewAjouter() {
    var mode = (F && F.mode) || 'wod';
    var h = '<header class="row"><a class="icon-btn" href="#wod" aria-label="Retour">' + icon(I.left) + '</a><h1 class="h1" style="font-size:34px">Ajouter</h1></header>';
    h += '<div class="seg" role="group" aria-label="Que veux-tu ajouter ?"><button type="button" data-act="fmode" data-v="wod" aria-pressed="' + (mode === 'wod') + '">La prog (WOD)</button><button type="button" data-act="fmode" data-v="todo" aria-pressed="' + (mode === 'todo') + '">Mon score</button></div>';
    if (mode === 'wod') {
      var d = (F && F.date) || S.wodDay || iso(today());
      h += '<div class="card" style="gap:6px"><b>Le plus simple : les captures</b><span class="muted small">Le dimanche pour toute la semaine, ou le jour même : envoie tes captures Strivee (blocs et classements) à Claude dans ton projet Kaizen. Il lit le contenu et remplit le Sheet ; tu n’as plus qu’à actualiser.</span></div>';
      h += '<form class="stack" id="f-wod" style="gap:14px"><h2 class="label">Ou saisir un WOD à la main</h2>' +
        '<div class="grid2"><div class="field"><label for="w-date">Jour de la prog</label><input class="input" type="date" id="w-date" value="' + d + '" required></div>' +
        '<div class="field"><label for="w-rpe">RPE visé</label><input class="input" id="w-rpe" inputmode="numeric" placeholder="ex. 7"></div></div>' +
        '<div class="field"><label for="w-nom">Nom du bloc</label><input class="input" id="w-nom" placeholder="ex. Metcon, Haltéro Clean & Jerk, Fran" required></div>' +
        '<div class="grid2"><div class="field"><label for="w-type">Type de bloc</label><select class="input" id="w-type">' + ['metcon', 'haltero', 'gym', 'renfo', 'cardio'].map(function (k) { return '<option value="' + k + '">' + BLOC_LABEL[k] + '</option>'; }).join('') + '</select></div>' +
        '<div class="field"><label for="w-score">Score attendu</label><select class="input" id="w-score"><option value="temps">Temps</option><option value="reps">Reps</option><option value="valide">Completed</option><option value="rounds_reps">Rounds + reps</option><option value="charge">Charge (kg)</option><option value="distance">Distance (m)</option></select></div></div>' +
        '<div class="field"><label for="w-desc">Contenu du WOD</label><textarea class="input" id="w-desc" placeholder="Colle ici le texte copié depuis Strivee (avec RX/INTER VERSION et ROOKIE VERSION si besoin)"></textarea></div>' +
        '<div id="w-preview"></div>' +
        '<button class="btn primary block" type="submit">Ajouter le bloc</button></form>';
    } else {
      var todo = M.seances.filter(function (s) { return !s.done && s.statut !== 'non fait' && s.source === 'DarkZone'; }).sort(function (a, b) { return a.date_prog < b.date_prog ? 1 : -1; }).slice(0, 20);
      h += '<p class="muted" style="margin:0">Choisis le bloc à compléter, même une prog d’une semaine passée. Tu peux aussi passer par « Ajouter mon score » dans l’onglet WOD.</p>';
      h += todo.length ? '<div class="list">' + todo.map(function (b) { return '<button class="li" data-act="score" data-v="' + esc(b.id) + '"><span class="t"><b>' + esc(b.nom) + '</b><span>' + fmtDayMid(b.date_prog) + ' · ' + esc(BLOC_LABEL[b.type_bloc] || '') + '</span></span>' + icon(I.right).replace('<svg', '<svg style="width:16px;height:16px;fill:none;stroke:var(--muted-2);stroke-width:2.5"') + '</button>'; }).join('') + '</div>' : '<div class="empty">Aucun bloc en attente de score.</div>';
    }
    return h;
  }
  // Aperçu « ce que je compte » sous le texte collé.
  function previewMoves(desc, type) {
    if (!desc.trim()) return '';
    var sc = MV.hasVersions(desc) ? ['RX', 'Inter', 'Rookie'] : ['RX'], seen = {}, vers = sc.filter(function (v) { var t = MV.section(desc, v); if (seen[t]) return false; seen[t] = 1; return true; });
    return vers.map(function (v) {
      var mv = MV.parse(desc, { reg: M.reg, sex: M.reg.sexe || 'H', version: v, scoreType: type });
      if (!mv.length) return '';
      return '<div class="card" style="gap:6px"><h2 class="label">Ce que je compte' + (vers.length > 1 ? ' · ' + v : '') + '</h2>' + mv.map(function (m) {
        return '<div class="between small"><span>' + esc(m.name) + (m.hint ? ' <span class="' + (m.range || m.max ? 'amber' : 'muted') + '">· ' + esc(m.hint) + '</span>' : '') + '</span><b>' + (m.reps != null ? fmtInt(m.reps) + ' ' + (m.unit === 'reps' ? 'reps' : m.unit) : '?') + (m.load ? ' · ' + fmtKg(m.load) + (m.nbDb === 2 ? ' ×2' : '') : '') + '</b></div>';
      }).join('') + '</div>';
    }).join('') + '<span class="small muted">« 6/6 » avec le même chiffre = par côté. « 9/6 kg » ou « 30/20 cal » = homme / femme. Les lignes incertaines sont en orange : tu les complètes avec ton score.</span>';
  }

  // ---------- Saisie du score ----------
  // Faut-il une charge par round ? Oui pour l'haltéro, les blocs notés en charge et tout mouvement lesté.
  function needsLoad(m, b) {
    if (m.unit !== 'reps') return false;
    if (m.load != null || m.presc != null || /\b(db|kb)\b/i.test(m.key || m.name || '')) return true;
    if (b && (b.type_bloc === 'haltero' || b.type_score === 'charge')) return true;
    return RE.lift.test(m.name || '') && !RE.gym.test(m.name || '');
  }
  function cloneMoves(list, b) {
    return list.map(function (m) {
      var pr = m.perRounds ? m.perRounds.slice() : m.rounds ? Array.apply(null, Array(m.rounds)).map(function () { return m.perRound; }) : null;
      var pl = m.perLoads && pr ? m.perLoads.slice(0, pr.length) : pr && needsLoad(m, b) ? pr.map(function () { return m.load != null ? m.load : null; }) : null;
      if (pl) while (pl.length < pr.length) pl.push(m.load != null ? m.load : null);
      return { perLoads: pl, name: m.name, key: m.key, reps: m.reps, load: m.load, presc: m.presc != null ? m.presc : m.load, nbDb: m.nbDb, unit: m.unit, machine: m.machine, hint: m.hint || '', range: m.range, max: m.max,
        rounds: pr ? pr.length : null, perRound: m.perRound, timed: !!(m.timed || m.unit === 's'), secRound: m.secRound != null ? m.secRound : (m.unit === 's' ? m.perRound : null), perRounds: pr, options: m.options || null, choice: m.choice != null ? m.choice : null };
    });
  }
  // Mouvements déjà saisis : on leur rend les options « au choix » de la prog.
  function withOptions(saved, parsed) {
    return saved.map(function (m) {
      var p = parsed.find(function (x) { return x.options && x.options.some(function (o) { return o.key === m.key; }); });
      if (!p) return m;
      return Object.assign({}, m, { options: p.options, choice: p.options.findIndex(function (o) { return o.key === m.key; }), hint: m.hint || 'au choix' });
    });
  }
  function openScore(id) {
    var b = M.byId[id]; if (!b) return;
    var lvl = b.done ? (b.niveau || 'RX') : (S.ver[id] || M.reg.version_defaut || 'RX');
    var parsed = MV.parse(b.description, { reg: M.reg, sex: M.reg.sexe || 'H', version: lvl, score: b.score_valeur, scoreType: b.type_score });
    var mv = b.done && M.mov[id] ? withOptions(M.mov[id], parsed) : parsed;
    // Bloc au temps (30'' de travail) : on garde l'info pour pouvoir basculer secondes / reps.
    if (b.done && M.mov[id]) mv = mv.map(function (m) { var p = parsed.find(function (x) { return x.key === m.key && x.unit === 's'; }); return p && m.unit !== 's' ? Object.assign({}, m, { timed: true, secRound: p.perRound }) : m; });
    var t = iso(today());
    F = { id: id, level: lvl, kind: b.type_score || 'temps', rpe: b.rpe_ressenti || null, date: b.date_faite || (t < b.date_prog ? b.date_prog : t), moves: cloneMoves(mv, b), edited: !!(b.done && M.mov[id]), vals: {} };
    drawScore();
  }
  // Nombre de tours d'un bloc : « Every 5' x 5 Rounds », « 4 Rounds », ou rounds des mouvements.
  function blockRounds(b) {
    var t = String(b.description || ''), m = t.match(/every\s*[\d:'’]+\s*(?:min\w*)?\s*[x×]\s*(\d+)/i) || t.match(/(?:^|\n)\s*(\d+)\s*(?:rounds?|sets?|tours?)\b/i) || t.match(/emom\s*(\d+)/i);
    var n = m ? +m[1] : 0;
    (F && F.moves || []).forEach(function (mv) { if (mv.rounds && mv.rounds > n) n = mv.rounds; });
    return n > 30 ? 0 : n;
  }
  function scoreInputs(b) {
    var same = F.kind === b.type_score, v = same ? b.score_valeur : null, V = F.vals;
    function val(k, d) { return V[k] != null ? V[k] : d; }
    switch (F.kind) {
      case 'temps_tours':
        var nT = F.tours || 0, prev = same && b.tours ? b.tours : [];
        return '<div class="field"><span class="label">Temps par tour</span><div class="tt-list">' + Array.apply(null, Array(nT)).map(function (x, i) {
          var pv = prev[i];
          return '<div class="tt"><span class="rn">' + (i + 1) + '</span><input class="input" id="s-tm-' + i + '" inputmode="numeric" placeholder="min" aria-label="Tour ' + (i + 1) + ' minutes" value="' + esc(val('s-tm-' + i, pv != null ? Math.floor(pv / 60) : '')) + '"><span class="muted">:</span><input class="input" id="s-ts-' + i + '" inputmode="numeric" placeholder="s" aria-label="Tour ' + (i + 1) + ' secondes" value="' + esc(val('s-ts-' + i, pv != null ? pad(Math.round(pv % 60)) : '')) + '"></div>';
        }).join('') + '</div><div class="row" style="gap:8px"><button type="button" class="chip mini" data-act="ftours" data-v="-1">– tour</button><button type="button" class="chip mini" data-act="ftours" data-v="1">+ tour</button></div><span class="small muted">Comme sur Strivee : minutes et secondes de chaque tour. Le score du bloc est le total de tes tours, comme sur Strivee. L’app affiche aussi ta moyenne et ton écart entre le tour le plus rapide et le plus lent.</span></div>';
      case 'temps': return '<div class="field"><span class="label">Temps</span><div class="row"><input class="input big" id="s-min" aria-label="Minutes" inputmode="numeric" placeholder="min" value="' + esc(val('s-min', v != null ? Math.floor(v / 60) : '')) + '" style="width:96px"><span class="num" style="font-size:30px">:</span><input class="input big" id="s-sec" aria-label="Secondes" inputmode="numeric" placeholder="s" value="' + esc(val('s-sec', v != null ? pad(Math.round(v % 60)) : '')) + '" style="width:96px"></div></div>';
      case 'rounds_reps': return '<div class="grid2"><div class="field"><label for="s-r">Rounds</label><input class="input big" id="s-r" inputmode="numeric" value="' + esc(val('s-r', v != null ? Math.floor(v) : '')) + '"></div><div class="field"><label for="s-p">Reps en plus</label><input class="input big" id="s-p" inputmode="numeric" value="' + esc(val('s-p', v != null ? Math.round((v - Math.floor(v)) * 1000) : '')) + '"></div></div>';
      case 'charge':
        var hv = heaviest();
        if (hv != null || V['s-kg'] == null) return '<div class="field"><span class="label">Charge (kg)</span><div class="row" style="gap:10px;align-items:baseline"><span class="num" id="s-kg-auto" style="font-size:40px">' + (hv != null ? esc(fmtNum(hv)) : '–') + '</span><span class="muted">kg</span></div><span class="small muted">Calculée : ta charge la plus lourde du bloc, d’après les charges par round ci-dessous.</span></div>';
        return '<div class="field"><label for="s-kg">Charge (kg)</label><input class="input big" id="s-kg" inputmode="decimal" value="' + esc(val('s-kg', v != null ? String(v).replace('.', ',') : '')) + '"></div>';
      case 'reps': return '<div class="field"><label for="s-reps">Total de reps</label><input class="input big" id="s-reps" inputmode="numeric" value="' + esc(val('s-reps', v != null ? v : '')) + '"></div>';
      case 'distance': return '<div class="field"><label for="s-m">Distance (m)</label><input class="input big" id="s-m" inputmode="numeric" value="' + esc(val('s-m', v != null ? v : '')) + '"></div>';
      default: return '<div class="row ok" style="font-weight:600">' + icon(I.check).replace('<svg', '<svg style="width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:3"') + 'Bloc validé (completed)</div>';
    }
  }
  // Charge la plus lourde saisie dans le bloc (barre ou haltère, pas les machines).
  function heaviest() {
    var mx = null;
    F.moves.forEach(function (m) {
      if (m.unit !== 'reps') return;
      (m.perLoads || []).concat([m.perLoads ? null : m.load]).forEach(function (l, k) {
        if (l == null) return;
        if (m.perLoads && m.perRounds && k < m.perRounds.length && !m.perRounds[k]) return;
        if (mx == null || l > mx) mx = l;
      });
    });
    return mx;
  }
  function refreshCharge() { var el = $('#s-kg-auto'); if (el) { var h = heaviest(); el.textContent = h != null ? fmtNum(h) : '–'; } }
  function movesTable() {
    var h = '<div class="field"><div class="between"><span class="label">Reps et charges par mouvement</span>' + (F.moves.some(function (m) { return m.range || m.max; }) ? '<span class="small amber">à compléter</span>' : '') + '</div>';
    if (!F.moves.length) h += '<span class="small muted">Aucun mouvement reconnu dans ce bloc. Ajoute-les si tu veux qu’ils comptent dans tes reps et tes kg.</span>';
    else h += '<div class="mv-head small muted"><span>Mouvement</span><span>Reps</span><span>Charge kg</span></div>';
    h += '<div class="mv-list">' + F.moves.map(function (m, i) {
      var isDb = /\b(db|kb)\b/i.test(m.key || m.name || '');
      var changed = m.presc != null && m.load != null && m.load !== m.presc;
      var unitLbl = m.unit === 'cal' ? 'cal' : m.unit === 'm' ? 'm' : m.unit === 's' ? 's' : '';
      var opts = m.options && m.options.length > 1 ? '<div class="mv-opts seg" role="group" aria-label="Mouvement au choix">' + m.options.map(function (o, j) { return '<button type="button" data-act="fopt" data-i="' + i + '" data-v="' + j + '" aria-pressed="' + (m.choice === j) + '">' + (o.perRound != null ? o.perRound + ' ' : '') + esc(o.name) + '</button>'; }).join('') + '</div>' : '';
      var rounds = m.perRounds && m.perLoads ? '<div class="mv-rounds lr"><span class="small muted">Par round · reps × charge</span>' + m.perRounds.map(function (v, k) {
          var l = m.perLoads[k];
          return '<div class="mv-rl"><span class="rn">R' + (k + 1) + '</span><input class="input" data-mi="' + i + '" data-f="pr" data-r="' + k + '" inputmode="numeric" value="' + (v != null ? v : '') + '" aria-label="' + esc(m.name) + ' reps round ' + (k + 1) + '"><span class="muted">×</span><input class="input" data-mi="' + i + '" data-f="pl" data-r="' + k + '" inputmode="decimal" value="' + (l != null ? String(l).replace('.', ',') : '') + '" placeholder="kg" aria-label="' + esc(m.name) + ' charge round ' + (k + 1) + '"><span class="small muted">kg</span></div>';
        }).join('') + '</div>'
        : m.perRounds ? '<div class="mv-rounds"><span class="small muted">Par round</span>' + m.perRounds.map(function (v, k) { return '<label class="mv-r"><span>R' + (k + 1) + '</span><input class="input" data-mi="' + i + '" data-f="pr" data-r="' + k + '" inputmode="numeric" value="' + (v != null ? v : '') + '" aria-label="' + esc(m.name) + ' round ' + (k + 1) + '"></label>'; }).join('') + '</div>' : '';
      var repsCell = m.perRounds ? '<div class="mv-in mv-tot"><b id="mvt-' + i + '">' + (m.reps != null ? m.reps : '–') + '</b>' + (unitLbl ? '<span class="small muted">' + unitLbl + '</span>' : '<span class="small muted">total</span>') + '</div>'
        : '<div class="mv-in"><input class="input" data-mi="' + i + '" data-f="reps" inputmode="numeric" value="' + (m.reps != null ? m.reps : '') + '" aria-label="Reps ' + esc(m.name) + '"' + (unitLbl ? ' placeholder="' + unitLbl + '"' : '') + '>' + (unitLbl ? '<span class="small muted">' + unitLbl + '</span>' : '') + '</div>';
      var loadCell = m.unit === 'reps' ? '<input class="input" data-mi="' + i + '" data-f="load" inputmode="decimal" value="' + (m.load != null ? String(m.load).replace('.', ',') : '') + '" placeholder="' + (m.perLoads ? 'tous' : '—') + '" aria-label="Charge ' + esc(m.name) + (m.perLoads ? ' pour tous les rounds' : '') + '">' : m.machine ? '<span class="small muted" style="padding-left:6px">machine</span>' : '<span class="small muted" style="padding-left:6px">—</span>';
      return '<div class="mv">' +
        '<div class="mv-name">' + (m.isNew ? '<input class="input" data-mi="' + i + '" data-f="name" value="' + esc(m.name) + '" placeholder="ex. Wall ball" aria-label="Nom du mouvement">' : '<b>' + esc(m.name) + '</b>') +
        (m.hint ? '<span class="small ' + (m.range || m.max ? 'amber' : 'muted') + '">' + esc(m.hint) + '</span>' : '') + (changed ? '<span class="small amber">charge modifiée · prog ' + fmtKg(m.presc) + '</span>' : '') + '</div>' +
        repsCell + '<div class="mv-in">' + loadCell + '</div>' + opts + rounds +
        (m.timed ? '<div class="mv-db seg" role="group" aria-label="Compter en secondes ou en reps"><button type="button" data-act="funit" data-i="' + i + '" data-v="s" aria-pressed="' + (m.unit === 's') + '">Secondes</button><button type="button" data-act="funit" data-i="' + i + '" data-v="reps" aria-pressed="' + (m.unit === 'reps') + '">Reps</button></div>' : '') +
        (isDb && m.unit === 'reps' ? '<div class="mv-db seg" role="group" aria-label="Nombre d’haltères"><button type="button" data-act="fdb" data-i="' + i + '" data-v="1" aria-pressed="' + ((m.nbDb || 1) === 1) + '">1 DB</button><button type="button" data-act="fdb" data-i="' + i + '" data-v="2" aria-pressed="' + (m.nbDb === 2) + '">2 DB</button></div>' : '') +
        '<button type="button" class="mv-del" data-act="fmdel" data-i="' + i + '" aria-label="Retirer ' + esc(m.name || 'ce mouvement') + '">' + icon(I.x) + '</button>' +
        '</div>';
    }).join('') + '</div>';
    h += '<button type="button" class="chip" style="align-self:flex-start" data-act="fmadd">+ Mouvement</button>';
    h += '<span class="small muted">Prérempli avec la prog de ta version (reps par round, charge homme ou femme selon ton profil). Tape ce que tu as fait à chaque round : le total se calcule tout seul. Change une charge ou des reps si tu as fait autre chose, par exemple une charge entre RX et Inter. Ces chiffres alimentent les reps, les kg, les km et les calories de l’accueil.</span></div>';
    return h;
  }
  function drawScore() {
    var b = M.byId[F.id];
    var t = iso(today());
    var dates = [b.date_prog, iso(addDays(parseD(b.date_prog), 1)), t].filter(function (x, i, a) { return x && a.indexOf(x) === i && x <= t; });
    if (!dates.length) dates = [t];
    var h = '<div class="between"><div class="stack" style="gap:2px"><span class="small muted">Prog du ' + fmtDayMid(b.date_prog) + ' · ' + esc(BLOC_LABEL[b.type_bloc] || '') + '</span><b style="font-size:18px">' + esc(b.nom) + '</b></div><button class="icon-btn" data-act="close" aria-label="Fermer">' + icon(I.x) + '</button></div>';
    h += '<div class="field"><span class="label">Fait le</span><div class="chips">' + dates.map(function (d) { return '<button type="button" class="chip" data-act="fdate" data-v="' + d + '" aria-pressed="' + (F.date === d) + '">' + fmtDayShort(d) + (d === b.date_prog ? ' (prog)' : d === t ? ' (auj.)' : '') + '</button>'; }).join('') + '</div>' +
      '<div class="row"><label for="s-date" class="small muted" style="white-space:nowrap">Ou n’importe quelle date</label><input class="input" type="date" id="s-date" value="' + F.date + '" style="min-height:40px"></div>' +
      '<span class="small muted">Le score reste rattaché au jour de la prog pour le classement, et compte dans ta semaine à la date où tu l’as fait.</span></div>';
    h += '<div class="field"><span class="label">Version</span><div class="seg">' + VERSIONS.map(function (v) { return '<button type="button" data-act="flvl" data-v="' + v + '" aria-pressed="' + (F.level === v) + '">' + v + '</button>'; }).join('') + '</div></div>';
    var kinds = ['temps', 'reps', 'valide']; if (kinds.indexOf(b.type_score) < 0 && b.type_score) kinds.push(b.type_score);
    if (blockRounds(b) > 1 && kinds.indexOf('temps_tours') < 0) kinds.push('temps_tours');
    if (!F.tours) F.tours = (b.tours && b.tours.length) || blockRounds(b) || 5;
    if (/amrap/i.test(MV.section(b.description, F.level)) && kinds.indexOf('rounds_reps') < 0) kinds.push('rounds_reps');
    if (kinds.indexOf(F.kind) < 0) kinds.push(F.kind);
    h += '<div class="field"><span class="label">Type de score</span><div class="seg">' + kinds.map(function (k) { return '<button type="button" data-act="fkind" data-v="' + k + '" aria-pressed="' + (F.kind === k) + '">' + SCORE_TYPES[k] + '</button>'; }).join('') + '</div>' +
      (b.type_score ? '<span class="small muted">Prérempli selon le score prévu pour ce bloc (' + esc((SCORE_TYPES[b.type_score] || '').toLowerCase()) + '). Tu peux le changer.</span>' : '') + '</div>';
    h += scoreInputs(b);
    h += movesTable();
    h += '<div class="field"><div class="between"><span class="label">RPE ressenti</span>' + (b.rpe_vise ? '<span class="small muted">visé : ' + b.rpe_vise + '</span>' : '') + '</div><div class="rpe" role="group" aria-label="RPE">' + [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(function (n) { return '<button type="button" data-act="frpe" data-v="' + n + '" class="' + (n === b.rpe_vise ? 'target' : '') + '" aria-pressed="' + (F.rpe === n) + '">' + n + '</button>'; }).join('') + '</div></div>';
    var V = F.vals;
    h += '<div class="grid2"><div class="field"><label for="s-rang">Rang (optionnel)</label><input class="input" id="s-rang" inputmode="numeric" value="' + esc(V['s-rang'] != null ? V['s-rang'] : (b.rang || '')) + '"></div><div class="field"><label for="s-part">Participants</label><input class="input" id="s-part" inputmode="numeric" value="' + esc(V['s-part'] != null ? V['s-part'] : (b.participants || '')) + '"></div></div>';
    h += '<div class="field"><label for="s-duree">Durée du bloc (min)</label><input class="input" id="s-duree" inputmode="numeric" value="' + esc(V['s-duree'] != null ? V['s-duree'] : (b.done && b.duree_min ? b.duree_min : estimateDuration(b, b.score_valeur && b.type_score === 'temps' ? b.score_valeur : null))) + '"></div>';
    h += '<div class="field"><label for="s-notes">Notes</label><textarea class="input" id="s-notes" style="min-height:70px" placeholder="Sensations, scaling…">' + esc(V['s-notes'] != null ? V['s-notes'] : (b.notes || '')) + '</textarea></div>';
    h += '<div class="card" style="gap:4px;padding:12px 14px"><b class="small">Classement</b><span class="small muted">Envoie la capture du classement Strivee à Claude, maintenant ou plus tard : ton rang se met à jour.</span></div>';
    h += '<p class="small amber" id="s-err" hidden></p>';
    h += '<button class="btn primary block" data-act="fsave">' + (b.done ? 'Enregistrer' : 'Enregistrer mon score') + '</button>';
    if (!b.done) h += '<button class="btn block" data-act="fskip" style="min-height:44px;font-size:14px">Marquer « pas fait »</button>';
    var panel = $('#sheet .panel'), y = panel ? panel.scrollTop : 0;
    openSheet(h);
    if (panel) { var p2 = $('#sheet .panel'); if (p2) p2.scrollTop = y; }
  }
  // Recopie les champs du formulaire dans F avant un nouveau rendu.
  function captureScore() {
    for (var ti = 0; ti < (F.tours || 0); ti++) ['s-tm-', 's-ts-'].forEach(function (pfx) { var el = $('#' + pfx + ti); if (el) F.vals[pfx + ti] = el.value; });
    ['s-min', 's-sec', 's-r', 's-p', 's-kg', 's-reps', 's-m', 's-rang', 's-part', 's-duree', 's-notes'].forEach(function (id) { var el = $('#' + id); if (el) F.vals[id] = el.value; });
    var sd = $('#s-date'); if (sd && sd.value) F.date = sd.value;
  }
  function readScore() {
    var g = function (id) { var el = $('#' + id); return el ? el.value.trim() : ''; };
    var r = {};
    switch (F.kind) {
      case 'temps_tours':
        var ts = [];
        for (var i = 0; i < F.tours; i++) { var a1 = g('s-tm-' + i), a2 = g('s-ts-' + i); ts.push(a1 === '' && a2 === '' ? null : (num(a1) || 0) * 60 + (num(a2) || 0)); }
        var ok = ts.filter(function (x) { return x != null; });
        if (!ok.length) return null;
        r.v = Math.round(ok.reduce(function (s2, x) { return s2 + x; }, 0)); r.d = fmtTime(r.v); r.tours = ts; break;
      case 'temps': var mi = num(g('s-min')) || 0, se = num(g('s-sec')) || 0; if (!mi && !se) return null; r.v = mi * 60 + se; r.d = fmtTime(r.v); break;
      case 'rounds_reps': var rd = num(g('s-r')), rp = num(g('s-p')) || 0; if (rd == null) return null; r.v = rd + rp / 1000; r.d = rd + ' rds' + (rp ? ' + ' + rp : ''); break;
      case 'charge': var kg = num(g('s-kg')); if (kg == null) kg = heaviest(); if (kg == null) return null; r.v = kg; r.d = fmtKg(kg); break;
      case 'reps':
        var n = num(g('s-reps'));
        if (n == null) { var tot = F.moves.reduce(function (s, m) { return s + (m.unit === 'reps' && m.reps ? m.reps : 0); }, 0); if (!tot) return null; n = tot; }
        r.v = n; r.d = n + ' reps'; break;
      case 'distance': var m = num(g('s-m')); if (m == null) return null; r.v = m; r.d = m + ' m'; break;
      default: r.v = ''; r.d = 'Validé';
    }
    return r;
  }
  function saveScore(skip) {
    var b = M.byId[F.id];
    var row = { id: b.id }, moves = null;
    if (skip) { row.statut = 'non fait'; }
    else {
      captureScore();
      var sc = readScore();
      if (!sc) { var e = $('#s-err'); e.textContent = 'Renseigne ton score avant d’enregistrer.'; e.hidden = false; e.scrollIntoView({ block: 'center' }); return; }
      // AMRAP : sans retouche, les reps de la prog (1 round) sont multipliées par tes rounds.
      if (F.kind === 'rounds_reps' && !F.edited && sc.v) F.moves = cloneMoves(MV.parse(b.description, { reg: M.reg, sex: M.reg.sexe || 'H', version: F.level, score: sc.v, scoreType: 'rounds_reps' }), b);
      moves = F.moves.filter(function (m) { return m.name && m.name.trim(); });
      var cal = {}, km = {};
      moves.forEach(function (m) {
        var mach = m.machine || MV.machineOf(MV.canon(m.name));
        if (m.unit === 'cal' && mach && m.reps) cal[mach] = (cal[mach] || 0) + m.reps;
        if (m.unit === 'm' && mach && m.reps) km[mach] = Math.round(((km[mach] || 0) + m.reps / 1000) * 100) / 100;
      });
      row = { id: b.id, statut: 'fait', date_faite: F.date, niveau: F.level, type_score: F.kind, score_affiche: sc.d, score_valeur: sc.v, score_tours: sc.tours ? sc.tours.map(function (x) { return x == null ? '' : x; }).join(';') : '', rpe_ressenti: F.rpe || '',
        cal_detail: detailStr(cal), km_detail: detailStr(km),
        rang: num(F.vals['s-rang']) || '', participants: num(F.vals['s-part']) || '', duree_min: num(F.vals['s-duree']) || '', notes: (F.vals['s-notes'] || '').trim() };
      // Pas de rang saisi mais un classement existe : on y insère ton score.
      var board = (M.cls[b.id] || []).filter(function (x) { return x.moi !== 'oui'; });
      if (!row.rang && board.length && sc.v !== '' && F.kind !== 'valide') {
        var lower = isTime(F.kind);
        var better = board.filter(function (x) { return x.score_valeur != null && (lower ? x.score_valeur < sc.v : x.score_valeur > sc.v); }).length;
        row.rang = better + 1; row.participants = board.length + 1;
      } else if (!row.participants && board.length) row.participants = board.length + (row.rang ? 0 : 1);
    }
    var btn = $('[data-act="fsave"]'); if (btn) btn.disabled = true;
    var mvRows = moves ? moves.map(function (m, i) { return { ordre: i + 1, mouvement: m.name.trim(), reps: m.reps != null ? m.reps : '', charge_kg: m.unit === 'reps' ? (m.perLoads && m.perLoads.some(function (x) { return x != null; }) ? Math.max.apply(null, m.perLoads.filter(function (x) { return x != null; })) : m.load != null ? m.load : '') : '', nb_db: m.nbDb || '', unite: m.unit || 'reps', charge_prog: m.presc != null ? m.presc : '', reps_rounds: m.perRounds ? m.perRounds.map(function (v) { return v == null ? '' : v; }).join(';') : '', charges_rounds: m.perLoads ? m.perLoads.map(function (v) { return v == null ? '' : v; }).join(';') : '' }; }) : null;
    var warnGw = false;
    apiPost({ action: 'upsert', sheet: 'Seances', row: row }).then(function () {
      if (!mvRows) return;
      if (M.gateway < 2 && !demoUrl()) { warnGw = true; return; }
      return apiPost({ action: 'mouvements', bloc_id: b.id, rows: mvRows }).catch(function (err) { if (/inconnue/i.test(err.message)) warnGw = true; else throw err; });
    }).then(function () {
      var raw = S.raw.seances.find(function (s) { return s.id === b.id; }); if (raw) Object.keys(row).forEach(function (k) { raw[k] = row[k]; });
      if (mvRows && !warnGw) { S.raw.mouvements = (S.raw.mouvements || []).filter(function (x) { return x.bloc_id !== b.id; }).concat(mvRows.map(function (x) { return Object.assign({ bloc_id: b.id }, x); })); }
      M = build(S.raw); cachePut('data', S.raw); closeSheet();
      var newPr = !skip && prEvents(row.date_faite, row.date_faite).some(function (p) { return p.a.id === b.id; });
      toast(skip ? 'Bloc marqué pas fait' : warnGw ? 'Score enregistré · mets à jour Code.gs pour garder les reps' : newPr ? 'Nouveau PR enregistré' : 'Score enregistré');
      if (newPr) autoRm();
      render();
    }).catch(function (err) { if (btn) btn.disabled = false; var e = $('#s-err'); if (e) { e.textContent = err.message; e.hidden = false; } });
  }
  function saveWod(ev) {
    ev.preventDefault();
    var date = $('#w-date').value, nom = $('#w-nom').value.trim();
    if (!date || !nom) { toast('Indique le jour et le nom du bloc'); return; }
    var row = { id: uid('dz-' + date), date_prog: date, date_faite: '', source: 'DarkZone', statut: 'à faire', nom: nom, type_bloc: $('#w-type').value,
      description: $('#w-desc').value.trim(), type_score: $('#w-score').value, score_affiche: '', score_valeur: '', niveau: M.reg.version_defaut || 'RX', rpe_vise: num($('#w-rpe').value) || '',
      rpe_ressenti: '', charges: '', km_detail: '', cal_detail: '', notes: '', duree_min: '', rang: '', participants: '' };
    row.duree_min = estimateDuration(row, null);
    apiPost({ action: 'upsert', sheet: 'Seances', row: row }).then(function () {
      S.raw.seances.push(row); M = build(S.raw); cachePut('data', S.raw);
      F = null; S.wodDay = date; S.wodWeek = Math.round((monday(parseD(date)) - monday(today())) / (7 * 864e5));
      toast('Bloc ajouté'); location.hash = '#wod';
    }).catch(function (err) { toast(err.message); });
  }

  // ---------- Classement ----------
  function sexOfName(n, me) { if (me) return String(M.reg.sexe || 'H').toUpperCase(); return M.sexOf[normName(n)] || ''; }
  function boardRows(b) {
    var c = M.cls[b.id] || [], hasMe = c.some(function (x) { return x.moi === 'oui'; });
    var rows = c.map(function (x) { var me = x.moi === 'oui'; return { name: x.nom ? titleName(x.nom) : (me ? 'Toi' : 'Athlète ' + x.rang), raw: x.nom || '', v: x.score_valeur, d: x.score_affiche, rx: x.rx === 'oui', me: me, rang0: x.rang, sex: sexOfName(x.nom, me) }; });
    if (!hasMe && b.done && b.score_affiche) rows.push({ name: 'Toi', raw: '', v: b.score_valeur, d: b.score_affiche, rx: (b.niveau || 'RX') === 'RX', me: true, rang0: b.rang || 999, sex: sexOfName('', true) });
    return rows;
  }
  function rankRows(b, rows) {
    var kind = b.type_score, lower = isTime(kind);
    var sorted = rows.slice().sort(function (x, y) {
      if (kind === 'valide' || x.v == null || y.v == null) return (x.v == null) - (y.v == null) || x.rang0 - y.rang0;
      return (lower ? x.v - y.v : y.v - x.v) || x.rang0 - y.rang0;
    });
    // Égalités : on garde le départage de Strivee (rang d'origine), sauf rang identique.
    var rank = 0, prev = {};
    sorted.forEach(function (r, i) { if (kind === 'valide' || r.v == null || r.v !== prev.v || r.rang0 !== prev.rang0) rank = i + 1; r.rank = rank; prev = r; });
    return sorted;
  }
  function openBoard(id) {
    var b = M.byId[id];
    var all = boardRows(b), f = S.boardFilter;
    var rows = rankRows(b, all.filter(function (r) { return f === 'all' || (f === 'RX' ? r.rx : r.sex === f); }));
    var me = rows.find(function (r) { return r.me; });
    var fmtV = function (v) { return isTime(b.type_score) ? fmtTime(v) : b.type_score === 'charge' ? fmtKg(v) : fmtNum(v) + (b.type_score === 'reps' ? ' reps' : ''); };
    var vals = rows.map(function (r) { return r.v; }).filter(function (v) { return v != null; }).sort(function (a, z) { return a - z; });
    var med = vals.length ? (vals.length % 2 ? vals[(vals.length - 1) / 2] : (vals[vals.length / 2 - 1] + vals[vals.length / 2]) / 2) : null;
    var gap = '–';
    if (me && rows.length && me.v != null && rows[0].v != null && b.type_score !== 'valide') {
      var d = Math.abs(rows[0].v - me.v);
      gap = d === 0 ? '1er' : '–' + (isTime(b.type_score) ? fmtTime(d) : fmtNum(d) + (b.type_score === 'charge' ? ' kg' : ''));
      if (isTime(b.type_score) && d) gap = '+' + fmtTime(d);
    }
    var h = '<div class="between"><div class="stack" style="gap:2px;min-width:0"><span class="small red" style="font-weight:700;letter-spacing:.08em">CLASSEMENT · ' + esc(fmtDayMid(b.date_prog).toUpperCase()) + '</span><b class="h3" style="font-size:26px">' + esc(b.nom) + '</b></div><button class="icon-btn" data-act="close" aria-label="Fermer">' + icon(I.x) + '</button></div>';
    if (all.length) {
      h += '<div class="seg" role="group" aria-label="Filtre du classement">' + [['all', 'Tout'], ['H', 'Hommes'], ['F', 'Femmes'], ['RX', 'RX']].map(function (c) { return '<button type="button" data-act="bfilter" data-id="' + esc(id) + '" data-v="' + c[0] + '" aria-pressed="' + (f === c[0]) + '">' + c[1] + '</button>'; }).join('') + '</div>';
      h += '<div class="grid3"><div class="tile"><span class="cap">Mon rang</span><span class="num">' + (me ? me.rank : '–') + '<span style="color:var(--faint)">/' + rows.length + '</span></span></div><div class="tile"><span class="cap">Écart au 1er</span><span class="num" style="font-size:22px">' + esc(gap) + '</span></div><div class="tile"><span class="cap">Médiane</span><span class="num" style="font-size:22px;white-space:nowrap">' + (med != null && b.type_score !== 'valide' ? esc(fmtV(med)) : '–') + '</span></div></div>';
      h += '<div class="list">' + (rows.length ? rows.map(function (r) {
        var sexTxt = r.sex === 'H' ? 'Homme' : r.sex === 'F' ? 'Femme' : '';
        return '<div class="li board' + (r.me ? ' me' : '') + '"><span class="num rk">' + r.rank + '</span><span class="t" style="flex:1"><b' + (r.me ? ' class="red"' : '') + '>' + esc(r.name) + (r.me && r.name !== 'Toi' ? ' (toi)' : '') + '</b><span class="row" style="gap:6px"><span class="tag ' + (r.rx ? 'rx' : 'outline') + '">' + (r.rx ? 'RX' : 'Non RX') + '</span>' + (sexTxt ? '<span>' + sexTxt + '</span>' : r.raw ? '<span class="amber">Sexe ?</span><button class="chip mini" data-act="bsex" data-id="' + esc(id) + '" data-n="' + esc(r.raw) + '" data-v="H">H</button><button class="chip mini" data-act="bsex" data-id="' + esc(id) + '" data-n="' + esc(r.raw) + '" data-v="F">F</button>' : '') + '</span></span><span class="v" style="font-size:20px">' + esc(r.d || '') + '</span></div>';
      }).join('') : '<div class="li muted">Personne dans ce filtre.</div>') + '</div>';
    } else h += '<div class="empty">Pas encore de classement pour ce bloc.</div>';
    h += '<p class="small muted" style="margin:0">Noms lus sur tes captures Strivee, gardés uniquement dans ton Google Sheet. Le rang se recalcule à chaque filtre. Le sexe est déduit du prénom ; seuls les prénoms ambigus te sont demandés. Pour ajouter ou mettre à jour un classement, envoie la capture à Claude dans ton projet Kaizen.</p>';
    var panel = $('#sheet .panel'), y = panel && !$('#sheet').hidden ? panel.scrollTop : 0;
    openSheet(h);
    var p2 = $('#sheet .panel'); if (p2) p2.scrollTop = y;
  }
  function setSex(id, nom, sexe) {
    apiPost({ action: 'athlete', nom: nom, sexe: sexe }).then(function () {
      S.raw.athletes = (S.raw.athletes || []).filter(function (a) { return normName(a.nom) !== normName(nom); }).concat([{ nom: nom, sexe: sexe }]);
      M = build(S.raw); cachePut('data', S.raw); openBoard(id);
    }).catch(function (e) { toast(/inconnue/i.test(e.message) ? 'Mets à jour Code.gs (tuto v2) pour enregistrer le sexe' : e.message); });
  }

  // ---------- PR ----------
  var FAM_TITLE = { lifts: 'Haltéro & force', gym: 'Gym', endu: 'Endurance', wod: 'WOD' };
  var FAM_DOT = { lifts: '#F5A524', gym: '#4C8DF6', endu: '#E2262D', wod: '#A1A1AA' };
  var WOD_TABS = [['girls', 'Girls'], ['heroes', 'Heroes'], ['open', 'Open']];
  function oldDate(d, years) { var x = parseD(d); x.setFullYear(x.getFullYear() + (years || 5)); return x < today(); }
  function recsOf(fam, lvl, sub) {
    var recs = M.records.filter(function (r) { return r.fam === fam && r.byLevel[lvl] && (!sub || r.sub === sub); });
    if (fam === 'wod' && sub === 'open') return recs.sort(function (a, b) { var x = a.label.match(/\d+\.\d/g).pop(), y = b.label.match(/\d+\.\d/g).pop(); return x < y ? 1 : x > y ? -1 : a.label < b.label ? 1 : -1; });
    recs.sort(function (a, b) { return b.byLevel[lvl].att.length - a.byLevel[lvl].att.length || a.label.localeCompare(b.label); });
    if (fam === 'lifts') recs.sort(function (a, b) { return (a.detail === '1RM' ? 0 : 1) - (b.detail === '1RM' ? 0 : 1) || b.byLevel[lvl].att.length - a.byLevel[lvl].att.length; });
    return recs;
  }
  function prRow(r, lvl) {
    var L = r.byLevel[lvl], b = L.best, n = L.att.length, first = L.att[0];
    var hist = n > 1 && first !== b && first.value !== b.value ? ' · ' + esc(recordValue(r, first.value, first)) + ' en ' + parseD(first.date).getFullYear() : '';
    return '<button class="li" data-act="openpr" data-v="' + esc(r.key) + '" data-l="' + lvl + '"><span class="t"><b>' + esc(recordTitle(r)) + '</b><span>' + fmtMonthYear(b.date) + ' · ' + n + ' essai' + (n > 1 ? 's' : '') + hist + (b.src === 'Strava' || b.strava ? ' · Strava' : '') + '</span></span><span class="row" style="gap:8px">' + (oldDate(b.date) && r.sub !== 'open' && r.fam !== 'endu' ? '<span class="badge">à retester</span>' : '') + '<span class="v">' + esc(recordValue(r, b.value, b)) + '</span></span></button>';
  }
  function viewPr() {
    if (S.prKey) return viewPrDetail();
    var lvl = S.prLevel;
    var h = '<header class="between"><h1 class="h1">Mes PR</h1><div class="seg" style="width:180px"><button type="button" data-act="prlvl" data-v="RX" aria-pressed="' + (lvl === 'RX') + '">RX</button><button type="button" data-act="prlvl" data-v="Rookie" aria-pressed="' + (lvl === 'Rookie') + '">Scaled</button></div></header>';
    if (lvl === 'Rookie') h += '<span class="small muted" style="margin-top:-10px">Scaled regroupe tes scores Inter et Rookie.</span>';
    var ev = prEvents('0000', '9999', lvl);
    if (ev.length) {
      var p = ev[0], prev = ev.find(function (x) { return x.r !== p.r && !x.tie; });
      h += '<section class="card" style="gap:8px"><h2 class="label">Dernier PR</h2><button class="li" style="padding:0;min-height:0" data-act="openpr" data-v="' + esc(p.r.key) + '" data-l="' + p.lvl + '"><span class="t"><b style="font-size:17px">' + esc(recordTitle(p.r)) + '</b><span>' + fmtDayMid(p.a.date) + ' · ' + esc(p.a.src || '') + (p.tie && p.a.prev ? ' · égale ' + fmtMonthYear(p.a.prev.date) : p.a.isFirst ? ' · premier ' + esc(p.r.detail || 'score') : p.a.prev ? ' · avant ' + esc(recordValue(p.r, p.a.prev.value, p.a.prev)) : '') + '</span></span><span class="v red" style="font-size:30px">' + esc(recordValue(p.r, p.a.value, p.a)) + '</span></button>' +
        (prev ? '<span class="small muted">Précédent PR : ' + esc(recordTitle(prev.r)) + ' ' + esc(recordValue(prev.r, prev.a.value, prev.a)) + ', ' + fmtMonthYear(prev.a.date) + '</span>' : '') + '</section>';
    }
    h += '<div class="grid2"><button class="btn" data-act="prall" data-v="1">Tout déplier</button><button class="btn" data-act="prall" data-v="0">Tout replier</button></div>';
    ['lifts', 'gym', 'endu', 'wod'].forEach(function (fam) {
      var recs = recsOf(fam, lvl);
      if (!recs.length) return;
      var open = !!S.prOpen[fam];
      var lastD = recs.reduce(function (m, r) { var d = r.byLevel[lvl].best.date; return d > m ? d : m; }, '');
      h += '<section class="acc' + (open ? ' open' : '') + '"><button class="acc-h" data-act="prsec" data-v="' + fam + '" aria-expanded="' + open + '"><i style="background:' + FAM_DOT[fam] + '"></i><span class="t"><b>' + FAM_TITLE[fam] + '</b><span>' + recs.length + ' record' + (recs.length > 1 ? 's' : '') + ' · dernier PR en ' + fmtMonthYear(lastD) + '</span></span>' + chev(open) + '</button>';
      if (open) {
        if (fam === 'wod') {
          var tab = S.wodTab;
          h += '<div class="seg" role="tablist" style="margin:0 12px">' + WOD_TABS.map(function (t) { var n = recsOf('wod', lvl, t[0]).length; return '<button type="button" role="tab" data-act="wodtab" data-v="' + t[0] + '" aria-pressed="' + (tab === t[0]) + '">' + t[1] + ' · ' + n + '</button>'; }).join('') + '</div>';
          var sub = recsOf('wod', lvl, tab);
          h += sub.length ? '<div class="list flat">' + sub.map(function (r) { return prRow(r, lvl); }).join('') + '</div>' : '<p class="small muted" style="margin:0 16px 14px">Aucun score dans cette catégorie.</p>';
        } else {
          var all = S.openAll['pr-' + fam], shown = all ? recs : recs.slice(0, 15);
          h += '<div class="list flat">' + shown.map(function (r) { return prRow(r, lvl); }).join('') + '</div>' + (recs.length > 15 ? '<button class="chip" style="margin:0 16px 14px;align-self:flex-start" data-act="openall" data-v="pr-' + fam + '">' + (all ? 'Réduire' : 'Tout voir (' + recs.length + ')') + '</button>' : '');
        }
      }
      h += '</section>';
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
    var dots = pts.map(function (p, i) { return '<circle cx="' + X(xs[i]).toFixed(1) + '" cy="' + Y(p.value).toFixed(1) + '" r="' + (p.pr ? 5 : 3.5) + '" fill="' + (p.pr ? '#F2555A' : '#17171B') + '" stroke="' + (p.pr ? '#fff' : '#E2262D') + '" stroke-width="2"><title>' + esc(fmtDay(p.date) + ' · ' + (p.label || fmt(p.value))) + '</title></circle>'; }).join('');
    var y0l = new Date(x0).getFullYear(), y1l = new Date(x1).getFullYear();
    return '<div class="chart"><svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Évolution">' + g + '<path d="' + d + '" fill="none" stroke="#E2262D" stroke-width="2.5" stroke-linejoin="round"/>' + dots +
      '<text x="' + L + '" y="' + (H - 6) + '" font-size="10" fill="#8B8B94" font-family="Inter,sans-serif">' + y0l + '</text><text x="' + (W - R) + '" y="' + (H - 6) + '" text-anchor="end" font-size="10" fill="#8B8B94" font-family="Inter,sans-serif">' + (y1l === y0l ? fmtMonthYear(iso(new Date(x1))) : y1l) + '</text></svg></div>' + (dir < 0 ? '<span class="small muted">Plus haut = plus rapide.</span>' : '');
  }
  function splitsTable(sa) {
    // Splits estimés à partir de l'allure moyenne (le fichier détaillé n'est pas encore lu).
    if (!sa.distance_km || !sa.duree_s) return '';
    var row = sa.sport === 'Rameur' || sa.sport === 'SkiErg', step = row ? 0.5 : 1, n = Math.floor(sa.distance_km / step + 1e-6);
    if (n < 2 || n > 25) return '';
    var per = sa.duree_s / (sa.distance_km / step);
    return '<section class="card" style="gap:6px"><h2 class="label">Splits moyens · ' + (row ? '500 m' : 'km') + '</h2><div class="pct" style="grid-template-columns:repeat(' + Math.min(n, 5) + ',minmax(0,1fr))">' + Array.apply(null, Array(n)).map(function (x, i) { return '<div><small>' + (row ? (i + 1) * 500 + ' m' : (i + 1) + ' km') + '</small><b>' + fmtTime(per) + '</b></div>'; }).join('') + '</div><span class="small muted">Allure moyenne de l’activité Strava. Les splits réels arriveront avec la synchro Strava (v2.1).</span></section>';
  }
  function viewPrDetail() {
    var r = M.records.find(function (x) { return x.key === S.prKey; });
    if (!r || !r.byLevel[S.prLevel]) { S.prKey = null; return viewPr(); }
    var L = r.byLevel[S.prLevel], best = L.best;
    var famName = { lifts: 'HALTÉRO', gym: 'GYM', endu: 'ENDURANCE', wod: r.sub === 'open' ? 'OPEN' : r.sub === 'heroes' ? 'HERO WOD' : 'GIRL WOD' }[r.fam];
    var h = '<header class="row"><button class="icon-btn" data-act="prback" aria-label="Retour aux PR">' + icon(I.left) + '</button><span class="label red">' + famName + (r.detail ? ' · ' + esc(r.detail) : '') + (S.prLevel === 'Rookie' ? ' · SCALED' : '') + '</span></header>';
    h += '<div class="between" style="align-items:flex-end"><div class="stack" style="gap:4px;min-width:0"><h1 class="h1">' + esc(r.label) + '</h1><span class="muted small">' + fmtDay(best.date) + ' · ' + esc(best.src || '') + (best.strava ? ' + Strava' : '') + (best.niveau && best.niveau !== 'RX' ? ' · ' + esc(best.niveau) : '') + '</span></div><span class="num red" style="font-size:46px;white-space:nowrap">' + esc(recordValue(r, best.value, best)) + '</span></div>';
    var sa = best.strava ? M.strava.find(function (a) { return a.id === best.strava; }) : null;
    if (!sa && r.fam === 'endu') sa = M.strava.find(function (a) { return a.date === best.date && ENDU[a.sport] && a.sport === r.label; });
    if (sa) {
      h += '<section class="grid3" aria-label="Données Strava">' + [['Allure', paceStr(Object.assign({}, sa, { endu: ENDU[sa.sport] }))], ['FC moy.', sa.fc_moy ? sa.fc_moy + ' bpm' : '—'], ['FC max', sa.fc_max ? sa.fc_max + ' bpm' : '—'], ['Cadence moy.', sa.cadence_moy ? (sa.sport === 'Course' ? sa.cadence_moy * 2 + ' pas/min' : sa.cadence_moy + ' /min') : '—'], ['Puissance moy.', sa.watts_moy ? sa.watts_moy + ' W' : '—'], ['Calories', sa.calories ? sa.calories + ' kcal' : '—']].map(function (x) { return '<div class="tile"><span class="cap">' + x[0] + '</span><b style="font-size:17px">' + x[1] + '</b></div>'; }).join('') + '</section>';
      h += '<span class="small muted">' + esc(sa.nom) + (sa.denivele_m ? ' · dénivelé ' + fmtNum(sa.denivele_m) + ' m' : '') + (sa.effort_relatif ? ' · effort relatif ' + sa.effort_relatif : '') + '</span>';
      h += splitsTable(sa);
    }
    var running = null, pts = L.att.map(function (a) { var pr = running == null || (r.dir > 0 ? a.value > running : a.value < running); if (pr) running = a.value; return { date: a.date, value: a.value, pr: pr, label: recordValue(r, a.value, a) }; });
    if (pts.length > 1) h += '<section class="card"><h2 class="label">Progression</h2>' + lineChart(pts, r.dir, function (v) { return r.unit === 'open' ? '' : recordValue(r, v).replace(' kg', '').replace(' reps', ''); }) + '</section>';
    if (r.unit === 'charge' && r.fam === 'lifts') {
      h += '<section class="card" style="gap:8px"><h2 class="label">Pourcentages de ton ' + esc(r.detail || 'record') + '</h2><div class="pct">' + [50, 60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110].map(function (p) { return '<div><small>' + p + ' %</small><b>' + fmtNum(round05(best.value * p / 100)) + '</b></div>'; }).join('') + '</div></section>';
    }
    h += '<section class="stack"><h2 class="label">Historique</h2><div class="list">' + L.att.slice().reverse().map(function (a) {
      var isBest = a === best;
      return '<div class="li" style="cursor:default"><span class="t"><b>' + fmtDay(a.date) + '</b><span>' + esc(a.src || '') + (a.strava ? ' · Strava' : '') + (a.niveau && a.niveau !== 'RX' ? ' · ' + esc(a.niveau) : '') + (isBest ? ' · record' : '') + '</span></span><span class="v' + (isBest ? ' red' : '') + '">' + esc(recordValue(r, a.value, a)) + '</span></div>';
    }).join('') + '</div></section>';
    return h;
  }

  // ---------- Analyse ----------
  function gainOf(r, a, b) {
    if (r.unit === 'open') {
      if (a.value > 1e6 && b.value > 1e6) { var sa = 1e7 - a.value, sb = 1e7 - b.value; return (sa - sb) / sa; }
      if (a.value < 1e6 && b.value < 1e6) return (b.value - a.value) / a.value;
      return null;
    }
    return r.dir > 0 ? (b.value - a.value) / a.value : (a.value - b.value) / a.value;
  }
  function viewAnalyse() {
    var h = '<header class="stack" style="gap:4px"><h1 class="h1">Analyse</h1><span class="muted small">Est-ce que je progresse, et où je me situe dans DarkZone</span></header>';
    // Chiffres
    var allDays = {}, perYear = {};
    M.seances.forEach(function (s) { if (s.done && s.date_faite) allDays[s.date_faite] = 1; });
    M.strava.forEach(function (a) { if (a.endu && a.date) allDays[a.date] = 1; });
    Object.keys(allDays).forEach(function (d) { var y = d.slice(0, 4); perYear[y] = (perYear[y] || 0) + 1; });
    var years = Object.keys(perYear).sort(), bestY = years.reduce(function (b, y) { return !b || perYear[y] > perYear[b] ? y : b; }, null);
    var lastRanked = M.seances.filter(function (s) { return s.done && s.rang && s.participants && s.source === 'DarkZone'; }).sort(function (a, b) { return a.date_prog < b.date_prog ? 1 : -1; })[0];
    h += '<section class="grid3"><div class="tile"><span class="num">' + fmtInt(Object.keys(allDays).length) + '</span><span class="cap">jours d’entraînement depuis ' + (years[0] || '—') + '</span></div><div class="tile"><span class="num">' + (bestY ? perYear[bestY] : '—') + '</span><span class="cap">jours en ' + (bestY || '—') + ', ton record</span></div><div class="tile"><span class="num">' + (lastRanked ? lastRanked.rang + '<span style="color:var(--faint)">/' + lastRanked.participants + '</span>' : '—') + '</span><span class="cap">dernier rang DarkZone' + (lastRanked ? ' (' + fmtDayShort(lastRanked.date_prog) + ')' : '') + '</span></div></section>';
    // Progression
    var retests = M.records.filter(function (r) { return r.byLevel.RX && r.byLevel.RX.att.length >= 2; }).map(function (r) {
      var L = r.byLevel.RX, first = L.att[0], best = L.best;
      return { r: r, first: first, best: best, gain: gainOf(r, first, best) };
    }).filter(function (x) { return x.gain != null && x.gain > 0.001; }).sort(function (a, b) { return b.gain - a.gain; }).slice(0, 8);
    h += '<section class="stack"><h2 class="label">Ma progression</h2><p class="small muted" style="margin:0">WODs et lifts retestés : premier essai → meilleur, en RX</p><div class="list">' + retests.map(function (x) {
      return '<button class="li" data-act="openpr" data-v="' + esc(x.r.key) + '" data-l="RX"><span class="t"><b>' + esc(recordTitle(x.r)) + '</b><span>' + esc(recordValue(x.r, x.first.value, x.first)) + ' (' + parseD(x.first.date).getFullYear() + ') → ' + esc(recordValue(x.r, x.best.value, x.best)) + ' (' + parseD(x.best.date).getFullYear() + ')</span></span><span class="v ok" style="font-size:20px">+' + Math.round(x.gain * 100) + ' %</span></button>';
    }).join('') + '</div></section>';
    // À retester
    var stale = M.records.filter(function (r) { return r.byLevel.RX && r.fam !== 'endu' && r.sub !== 'open' && oldDate(r.byLevel.RX.best.date, 5); })
      .sort(function (a, b) { return b.byLevel.RX.att.length - a.byLevel.RX.att.length; }).slice(0, 6);
    if (stale.length) h += '<section class="stack"><h2 class="label">À retester</h2><p class="small muted" style="margin:0">Records de plus de 5 ans</p><div class="list">' + stale.map(function (r) { var b = r.byLevel.RX.best; return '<button class="li" data-act="openpr" data-v="' + esc(r.key) + '" data-l="RX"><span class="t"><b>' + esc(recordTitle(r)) + '</b><span>record en ' + fmtMonthYear(b.date) + '</span></span><span class="row" style="gap:8px"><span class="badge">à retester</span><span class="v">' + esc(recordValue(r, b.value, b)) + '</span></span></button>'; }).join('') + '</div></section>';
    // Jours par mois
    var months = [], t = today();
    for (var i = 11; i >= 0; i--) {
      var a = new Date(t.getFullYear(), t.getMonth() - i, 1), b = new Date(a.getFullYear(), a.getMonth() + 1, 0);
      var st = stats(iso(a), iso(b), true); months.push({ m: a.getMonth(), days: Object.keys(st.days).length, cf: st.done.length });
    }
    var max = Math.max.apply(null, months.map(function (x) { return x.days; }).concat([1]));
    h += '<section class="card"><h2 class="label">Jours d’entraînement par mois</h2><div style="display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:4px;align-items:end;height:120px" role="img" aria-label="Jours d’entraînement sur 12 mois">' +
      months.map(function (x) { return '<div style="display:flex;flex-direction:column;align-items:center;gap:4px;height:100%;justify-content:flex-end"><span style="font-size:10px;color:var(--muted)">' + (x.days || '') + '</span><div style="width:100%;height:' + Math.max(2, x.days / max * 80) + 'px;background:' + (x.days ? 'var(--red)' : 'var(--line)') + ';border-radius:4px 4px 0 0"></div></div>'; }).join('') +
      '</div><div style="display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:4px;text-align:center;font-size:10px;color:var(--muted)">' + months.map(function (x) { return '<span>' + MO[x.m].slice(0, 4).replace('.', '') + '</span>'; }).join('') + '</div>';
    var lastBtwb = M.seances.filter(function (s) { return s.source === 'BTWB' && s.done; }).reduce(function (m, s) { return s.date_faite > m ? s.date_faite : m; }, '');
    var firstDz = M.seances.filter(function (s) { return s.source === 'DarkZone'; }).reduce(function (m, s) { return !m || s.date_prog < m ? s.date_prog : m; }, '');
    if (lastBtwb && firstDz && (parseD(firstDz) - parseD(lastBtwb)) / 864e5 > 40) h += '<span class="small muted">De ' + MOL[parseD(lastBtwb).getMonth()] + ' à ' + MOL[parseD(firstDz).getMonth()] + ', tes séances DarkZone ne sont pas encore importées : l’export Strivee arrive d’ici le 12 décembre.</span>';
    h += '</section>';
    // Allure de course
    var runs = {};
    M.strava.forEach(function (x) { if (x.sport === 'Course' && x.distance_km > 3 && x.duree_s) { var y = x.date.slice(0, 4); (runs[y] = runs[y] || []).push(x.duree_s / x.distance_km); } });
    var ry = Object.keys(runs).filter(function (y) { return runs[y].length >= 3; }).sort().slice(-5);
    if (ry.length) {
      var med = {}; ry.forEach(function (y) { var a = runs[y].slice().sort(function (p, q) { return p - q; }); med[y] = a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2; });
      var fastest = Math.min.apply(null, ry.map(function (y) { return med[y]; }));
      h += '<section class="card" style="gap:10px"><h2 class="label">Endurance · allure de course</h2>' + ry.map(function (y) { return '<div class="row"><span class="bl" style="width:44px">' + y + '</span><div class="bar"><div style="width:' + Math.round(fastest / med[y] * 100) + '%;background:var(--red)"></div></div><b class="bv">' + fmtTime(med[y]) + '/km</b></div>'; }).join('') + '<span class="small muted">Allure médiane de tes sorties de plus de 3 km sur Strava. Barre plus longue = plus rapide.</span></section>';
    }
    h += analyseForme();
    // DarkZone
    var ranked = M.seances.filter(function (s) { return s.done && s.rang && s.participants; }).sort(function (a, b) { return a.date_prog < b.date_prog ? 1 : -1; }).slice(0, 12);
    h += '<section class="stack"><h2 class="label">Où je me situe dans DarkZone</h2>';
    if (ranked.length) {
      var byType = {};
      ranked.forEach(function (s) { var p = 1 - (s.rang - 1) / Math.max(1, s.participants - 1); (byType[s.type_bloc] = byType[s.type_bloc] || []).push(p); });
      h += '<div class="card" style="gap:10px"><span class="small muted">Ta position moyenne par type de bloc (100 % = premier)</span>' + Object.keys(byType).map(function (k) { var arr = byType[k], avg = arr.reduce(function (s, v) { return s + v; }, 0) / arr.length; return '<div class="row"><span class="bl">' + esc(BLOC_LABEL[k] || k) + '</span><div class="bar"><div style="width:' + Math.max(2, Math.round(avg * 100)) + '%;background:var(--red)"></div></div><b class="bv" style="width:auto">' + Math.round(avg * 100) + ' % · ' + arr.length + '</b></div>'; }).join('') + '</div>';
      h += '<div class="list">' + ranked.map(function (s) { return '<button class="li" data-act="board" data-v="' + esc(s.id) + '"><span class="t"><b>' + esc(s.nom) + '</b><span>' + fmtDay(s.date_prog) + ' · ' + esc(s.score_affiche) + '</span></span><span class="v">' + s.rang + '<span style="color:var(--faint)">/' + s.participants + '</span></span></button>'; }).join('') + '</div>';
      h += '<span class="small muted">Se remplit avec tes captures de classement. Ouvre un bloc pour filtrer par catégorie et par sexe.</span>';
    } else h += '<div class="empty">Tes classements DarkZone apparaîtront ici dès que tu auras envoyé les captures.</div>';
    h += '</section>';
    return h;
  }

  // ---------- Moi ----------
  var RM_KEYS = [['rm_back_squat', 'Back squat', ['back squat']], ['rm_front_squat', 'Front squat', ['front squat']], ['rm_deadlift', 'Deadlift', ['deadlift']], ['rm_bench', 'Bench press', ['bench press']], ['rm_strict_press', 'Strict press', ['strict press', 'shoulder press']], ['rm_push_press', 'Push press', ['push press']], ['rm_clean_and_jerk', 'Clean & jerk', ['clean & jerk', 'squat clean & jerk', 'power clean & jerk']], ['rm_clean', 'Squat clean', ['squat clean', 'clean']], ['rm_power_clean', 'Power clean', ['power clean']], ['rm_snatch', 'Squat snatch', ['squat snatch', 'snatch']], ['rm_power_snatch', 'Power snatch', ['power snatch']]];
  function bestLift(labels) {
    var best = null;
    labels.forEach(function (l) { var r = M.records.find(function (x) { return x.key === 'lift|' + l + '|1RM'; }); if (r && r.byLevel.RX && (!best || r.byLevel.RX.best.value > best.value)) best = r.byLevel.RX.best; });
    return best;
  }
  // Monte un RM de référence quand un nouveau 1RM le dépasse (jamais à la baisse).
  function autoRm() {
    var ups = [];
    RM_KEYS.forEach(function (k) { var b = bestLift(k[2]), cur = num(M.reg[k[0]]); if (b && (cur == null || b.value > cur)) ups.push([k[0], b.value, k[1]]); });
    if (!ups.length) return;
    var p = Promise.resolve();
    ups.forEach(function (u) { p = p.then(function () { return apiPost({ action: 'reglage', cle: u[0], valeur: u[1] }); }); });
    p.then(function () { ups.forEach(function (u) { S.raw.reglages[u[0]] = u[1]; M.reg[u[0]] = u[1]; }); cachePut('data', S.raw); toast('RM mis à jour : ' + ups.map(function (u) { return u[2] + ' ' + fmtKg(u[1]); }).join(', ')); if (S.tab === 'moi') render(); }).catch(function () {});
  }
  function goalState(g) {
    var r = M.records.find(function (x) { return x.key === g.cle; }) || M.records.filter(function (x) { return x.key.indexOf(g.cle) >= 0 && x.byLevel.RX; }).sort(function (a, b) { return b.byLevel.RX.att.length - a.byLevel.RX.att.length; })[0];
    if (!r || !r.byLevel.RX) return { r: r, cur: null, p: 0 };
    var cur = r.byLevel.RX.best.value, cible = num(g.cible);
    var p = cible ? (r.dir > 0 ? cur / cible : cible / cur) : 0;
    return { r: r, cur: cur, p: Math.max(0, Math.min(1, p)) };
  }
  function viewMoi(first) {
    var c = getCfg(), reg = (M && M.reg) || {};
    var h = '<header class="row" style="gap:14px">' + avatarHtml(64) + '<div class="stack" style="gap:6px"><h1 class="h1">Moi</h1><label class="chip" style="display:inline-flex;align-items:center;min-height:34px;font-size:12px;cursor:pointer">Changer la photo<input type="file" id="m-photo" accept="image/*" hidden></label></div></header>';
    if (first) h += '<div class="card"><b>Bienvenue dans Kaizen</b><span class="muted">Pour commencer, colle l’adresse de ta passerelle Apps Script et ton code secret. Les étapes sont dans le tuto d’installation.</span></div>';
    if (M) {
      var sexe = String(reg.sexe || 'H').toUpperCase(), ver = reg.version_defaut || 'RX';
      h += '<form class="card" id="f-reg"><h2 class="label">Profil</h2>' +
        '<div class="field"><label for="r-nom">Nom affiché sur l’accueil</label><input class="input" id="r-nom" value="' + esc(reg.nom_affiche || '') + '"></div>' +
        '<div class="grid2"><div class="field"><label for="r-obj">Objectif jours / semaine</label><input class="input" id="r-obj" inputmode="numeric" value="' + esc(reg.objectif_jours || '') + '"></div>' +
        '<div class="field"><label for="r-warm">Échauffement (min)</label><input class="input" id="r-warm" inputmode="numeric" value="' + esc(reg.echauffement_min || '') + '"></div></div>' +
        '<div class="field"><span class="label">Sexe (classements)</span><div class="seg"><button type="button" data-act="mset" data-k="sexe" data-v="H" aria-pressed="' + (sexe === 'H') + '">Homme</button><button type="button" data-act="mset" data-k="sexe" data-v="F" aria-pressed="' + (sexe === 'F') + '">Femme</button></div></div>' +
        '<div class="field"><span class="label">Version par défaut</span><div class="seg">' + VERSIONS.map(function (v) { return '<button type="button" data-act="mset" data-k="version_defaut" data-v="' + v + '" aria-pressed="' + (ver === v) + '">' + v + '</button>'; }).join('') + '</div></div>' +
        '<button class="btn primary" type="submit">Enregistrer le profil</button></form>';
      // Objectifs
      h += '<section class="card"><div class="between"><h2 class="label">Mes objectifs</h2><button class="chip" style="min-height:34px" data-act="goaladd">' + (S.goalForm ? 'Annuler' : '+ Ajouter') + '</button></div>';
      if (S.goalForm) {
        var opts = M.records.filter(function (r) { return r.byLevel.RX; }).sort(function (a, b) { return b.byLevel.RX.att.length - a.byLevel.RX.att.length; }).slice(0, 80).sort(function (a, b) { return recordTitle(a).localeCompare(recordTitle(b)); });
        h += '<form class="stack" id="f-goal" style="gap:10px"><div class="field"><label for="g-rec">Record suivi</label><select class="input" id="g-rec">' + opts.map(function (r) { return '<option value="' + esc(r.key) + '">' + esc(recordTitle(r)) + ' · ' + esc(recordValue(r, r.byLevel.RX.best.value, r.byLevel.RX.best)) + '</option>'; }).join('') + '</select></div>' +
          '<div class="grid2"><div class="field"><label for="g-cible">Cible</label><input class="input" id="g-cible" placeholder="ex. 150 ou 3:15"></div><div class="field"><label for="g-label">Intitulé</label><input class="input" id="g-label" placeholder="ex. Back squat 150 kg"></div></div>' +
          '<button class="btn primary" type="submit">Ajouter l’objectif</button></form>';
      }
      h += M.goals.length ? M.goals.map(function (g, i) {
        var s = goalState(g);
        return '<div class="stack" style="gap:6px"><div class="between"><b>' + esc(g.label) + '</b><span class="row" style="gap:6px"><span class="small muted">' + (s.cur != null ? esc(recordValue(s.r, s.cur)) + ' aujourd’hui' : 'pas encore de score') + '</span><button class="icon-btn" style="width:32px;height:32px" data-act="goaldel" data-v="' + i + '" aria-label="Supprimer l’objectif ' + esc(g.label) + '">' + icon(I.trash) + '</button></span></div><div class="bar" style="flex:none"><div style="width:' + Math.round(s.p * 100) + '%;background:' + (s.p >= 1 ? 'var(--green)' : 'var(--red)') + '"></div></div></div>';
      }).join('') : '<span class="small muted">Ajoute un objectif lié à un de tes records : la barre avance à chaque PR.</span>';
      h += '</section>';
      // RM
      h += '<form class="card" id="f-rm"><h2 class="label">RM de référence (kg)</h2><div class="grid2">' + RM_KEYS.map(function (k) { return '<div class="field"><label for="r-' + k[0] + '" style="font-size:11px">' + k[1] + '</label><input class="input" id="r-' + k[0] + '" inputmode="decimal" value="' + esc(reg[k[0]] != null ? String(reg[k[0]]).replace('.', ',') : '') + '"></div>'; }).join('') + '</div>' +
        '<span class="small muted">Mis à jour automatiquement à chaque nouveau PR en 1RM. Sert à calculer les charges des WODs (ex. 60 % RM bench = ' + fmtKg(round05((num(reg.rm_bench) || 95) * 0.6)) + ').</span><button class="btn primary" type="submit">Enregistrer les RM</button></form>';
    }
    // Connexions
    h += '<section class="card"><h2 class="label">Connexions</h2>' +
      '<div class="between"><span class="t stack" style="gap:2px"><b>Google Sheet Kaizen</b><span class="small muted">' + (S.syncedAt ? 'Synchronisé ' + (iso(S.syncedAt) === iso(today()) ? 'aujourd’hui à ' + pad(S.syncedAt.getHours()) + ':' + pad(S.syncedAt.getMinutes()) : 'le ' + S.syncedAt.toLocaleDateString('fr-FR')) : c.url ? 'Pas encore synchronisé' : 'À configurer') + (M && M.gateway < 2 && !demoUrl() ? ' · passerelle v1' : '') + '</span></span><span class="tag ' + (S.syncedAt ? 'ok-tag' : 'outline') + '">' + (S.syncedAt ? 'Connecté' : 'Hors ligne') + '</span></div>' +
      '<div class="between"><span class="t stack" style="gap:2px"><b>Strava</b><span class="small muted">Synchro automatique des runs, row, ski et bike</span></span><span class="tag outline">v2.1</span></div>' +
      (M ? '<button class="btn" data-act="refresh">Actualiser depuis le Sheet</button>' : '') +
      '<details' + (first || !c.url ? ' open' : '') + '><summary class="small" style="cursor:pointer;font-weight:600">Adresse de la passerelle et code secret</summary><form class="stack" id="f-cfg" style="margin-top:10px">' +
      '<div class="field"><label for="cfg-url">Adresse de l’application Web Apps Script</label><input class="input" id="cfg-url" value="' + esc(c.url || '') + '" placeholder="https://script.google.com/macros/s/…/exec" autocomplete="off"></div>' +
      '<div class="field"><label for="cfg-token">Code secret</label><input class="input" id="cfg-token" value="' + esc(c.token || '') + '" autocomplete="off"></div>' +
      '<button class="btn primary" type="submit">Enregistrer et synchroniser</button></form></details>' +
      '<span class="small muted">L’adresse de la passerelle, le code secret et ta photo restent sur ce téléphone.</span></section>';
    if (M) h += moiAthlytic();
    if (M) {
      var first0 = M.seances.reduce(function (m, s) { return s.source === 'BTWB' && s.date_faite && (!m || s.date_faite < m) ? s.date_faite : m; }, ''), lastB = M.seances.reduce(function (m, s) { return s.source === 'BTWB' && s.date_faite > m ? s.date_faite : m; }, '');
      var sFirst = M.strava.reduce(function (m, a) { return !m || a.date < m ? a.date : m; }, ''), sLast = M.strava.reduce(function (m, a) { return a.date > m ? a.date : m; }, '');
      var dz = M.seances.filter(function (s) { return s.source === 'DarkZone'; }).reduce(function (m, s) { return !m || s.date_prog < m ? s.date_prog : m; }, '');
      h += '<section class="card"><h2 class="label">Mes données</h2><div class="grid3"><div class="tile"><span class="num">' + fmtInt(M.seances.length) + '</span><span class="cap">blocs</span></div><div class="tile"><span class="num">' + fmtInt(M.strava.length) + '</span><span class="cap">activités Strava</span></div><div class="tile"><span class="num">' + Object.keys(M.cls).length + '</span><span class="cap">classements</span></div></div>' +
        '<span class="small muted">Sources : ' + (first0 ? 'BTWB ' + first0.slice(0, 4) + '–' + lastB.slice(0, 4) + ', ' : '') + (sFirst ? 'Strava ' + sFirst.slice(0, 4) + '–' + sLast.slice(0, 4) + ', ' : '') + (dz ? 'DarkZone depuis ' + fmtMonthYear(dz) + '.' : '') + ' Export Strivee attendu avant le 12 déc.</span></section>';
    }
    h += '<p class="small muted" style="text-align:center;margin:0">Kaizen v' + VERSION + '</p>';
    return h;
  }
  function saveCfg(ev) {
    ev.preventDefault();
    setCfg({ url: $('#cfg-url').value.trim(), token: $('#cfg-token').value.trim() });
    toast('Connexion enregistrée'); load(true);
  }
  function saveReglages(changes, msg) {
    changes = changes.filter(function (c) { return c[1] !== null && c[1] !== '' && String(M.reg[c[0]]) !== String(c[1]); });
    if (!changes.length) { toast('Rien à modifier'); return Promise.resolve(); }
    var p = Promise.resolve();
    changes.forEach(function (c) { p = p.then(function () { return apiPost({ action: 'reglage', cle: c[0], valeur: c[1] }); }); });
    return p.then(function () { changes.forEach(function (c) { S.raw.reglages[c[0]] = c[1]; }); M = build(S.raw); cachePut('data', S.raw); toast(msg); render(); })
      .catch(function (e) { toast(e.message); });
  }
  function saveReg(ev) {
    ev.preventDefault();
    saveReglages([['nom_affiche', $('#r-nom').value.trim()], ['objectif_jours', num($('#r-obj').value)], ['echauffement_min', num($('#r-warm').value)]], 'Profil enregistré');
  }
  function saveRm(ev) {
    ev.preventDefault();
    saveReglages(RM_KEYS.map(function (k) { return [k[0], num($('#r-' + k[0]).value)]; }), 'RM enregistrés');
  }
  function saveGoals(list, msg) {
    var v = JSON.stringify(list);
    apiPost({ action: 'reglage', cle: 'objectifs', valeur: v }).then(function () { S.raw.reglages.objectifs = v; M = build(S.raw); cachePut('data', S.raw); S.goalForm = false; toast(msg); render(); }).catch(function (e) { toast(e.message); });
  }
  function addGoal(ev) {
    ev.preventDefault();
    var key = $('#g-rec').value, r = M.records.find(function (x) { return x.key === key; }), raw = $('#g-cible').value.trim();
    if (!r || !raw) { toast('Choisis un record et une cible'); return; }
    var cible = r.unit === 'temps' || /:/.test(raw) ? parseTimeStr(raw) : num(raw);
    if (cible == null) { toast('Cible illisible'); return; }
    var label = $('#g-label').value.trim() || (recordTitle(r) + ' : ' + (r.unit === 'temps' ? (r.dir < 0 ? 'sous ' : '') + fmtTime(cible) : recordValue(r, cible)));
    saveGoals(M.goals.concat([{ label: label, cle: key, cible: cible }]), 'Objectif ajouté');
  }
  function setPhoto(file) {
    if (!file) return;
    var rd = new FileReader();
    rd.onload = function () {
      var img = new Image();
      img.onload = function () {
        var s = 256, cv = document.createElement('canvas'), k = Math.max(s / img.width, s / img.height);
        cv.width = s; cv.height = s;
        var ctx = cv.getContext('2d'); ctx.drawImage(img, (s - img.width * k) / 2, (s - img.height * k) / 2, img.width * k, img.height * k);
        try { localStorage.setItem(PHOTO_KEY, cv.toDataURL('image/jpeg', 0.85)); toast('Photo enregistrée sur ce téléphone'); } catch (e) { toast('Photo trop lourde'); }
        render();
      };
      img.src = rd.result;
    };
    rd.readAsDataURL(file);
  }

  // ---------- v2.4 : forme (Athlytic) et séances de la montre ----------
  var WT_LABEL = { 'Functional Strength Training': 'Force fonctionnelle', 'Traditional Strength Training': 'Musculation', 'Cross Training': 'Cross training', 'High Intensity Interval Training': 'HIIT', 'Mixed Cardio': 'Cardio mixte', 'Core Training': 'Gainage', 'Rowing': 'Rameur', 'Running': 'Course', 'Cycling': 'Vélo', 'Hiking': 'Randonnée', 'Walking': 'Marche' };
  var WT_ENDU = { 'Running': 'run', 'Cycling': 'bike', 'Hiking': 'other', 'Walking': 'other' };
  function wLabel(t) { return WT_LABEL[t] || t || 'Séance'; }
  // force = bloc de force ; cond = metcon / cardio ; endu = sortie (run, vélo…)
  function wKind(w) {
    if (WT_ENDU[w.type]) return 'endu';
    return /cross|hiit|interval|cardio|rowing/i.test(w.type) ? 'cond' : 'force';
  }
  function stravaTwin(w) {
    return M.strava.some(function (a) {
      if (!a.endu || a.date !== w.date || !a.duree_s || !w.dur) return false;
      var d = a.duree_s / 60; return Math.abs(d - w.dur) <= Math.max(5, w.dur * 0.25);
    });
  }
  // Séances montre qui couvrent les blocs CrossFit faits ce jour-là.
  function cfWatch(ds) {
    var list = (M.montreBy[ds] || []).filter(function (w) { return w.type !== 'Walking'; });
    if (!list.length || !M.seances.some(function (s) { return s.done && s.date_faite === ds; })) return [];
    var hasCardio = M.seances.some(function (s) { return s.done && s.date_faite === ds && (s.type_bloc === 'cardio' || s.type_bloc === 'metcon'); });
    return list.filter(function (w) { var k = wKind(w); return k !== 'endu' || (hasCardio && !stravaTwin(w)); });
  }
  // Sorties de la montre absentes de Strava (pour ne pas compter deux fois).
  function freeEndu(from, to) {
    return M.montre.filter(function (w) {
      if (w.date < from || w.date > to || w.type === 'Walking' || wKind(w) !== 'endu' || stravaTwin(w)) return false;
      return cfWatch(w.date).indexOf(w) < 0;
    });
  }
  // Blocs « cardio » d'un jour : metcon et cardio ; à défaut, les blocs gym/renfo chronométrés ou en reps (ex. push endurance).
  function dayBlocks(ds) {
    var all = M.seances.filter(function (s) { return s.done && s.date_faite === ds && s.source !== 'PR'; });
    var cond = all.filter(function (s) { return s.type_bloc === 'metcon' || s.type_bloc === 'cardio'; });
    if (!cond.length) cond = all.filter(function (s) { return (s.type_bloc === 'gym' || s.type_bloc === 'renfo') && (s.type_score === 'temps' || s.type_score === 'reps' || s.type_score === 'rounds_reps'); });
    return { all: all, cond: cond };
  }
  // Séances de la montre d'un jour qui ne sont ni rattachées à un bloc, ni déjà dans Strava (ex. un run du dimanche).
  function freeWatch(ds) {
    var cf = cfWatch(ds);
    return (M.montreBy[ds] || []).filter(function (w) { return w.type !== 'Walking' && cf.indexOf(w) < 0 && !stravaTwin(w); });
  }
  function watchCard(w) {
    var e = WT_ENDU[w.type], pace = '—';
    if (w.km && w.dur) {
      if (e === 'run' || e === 'other') pace = fmtTime(w.dur * 60 / w.km) + '/km';
      else if (w.type === 'Rowing') pace = fmtTime(w.dur * 60 / (w.km * 2)) + '/500 m';
      else pace = fmtNum(w.km / (w.dur / 60), 1) + ' km/h';
    }
    var f = formeOn(w.date);
    return '<article class="card"><div class="between"><span class="tag cardio">' + esc(wLabel(w.type)) + '</span><span class="small muted">Montre · ' + esc(w.heure || '') + '</span></div><h3 class="h3">' + esc(wLabel(w.type)) + (w.km ? ' ' + fmtNum(w.km, 1) + ' km' : '') + '</h3><div class="grid3">' +
      stat('Distance', w.km ? fmtNum(w.km, 2) + ' km' : '—') + stat('Durée', w.dur != null ? fmtTime(w.dur * 60) : '—') + stat(w.type === 'Rowing' ? 'Allure /500 m' : 'Allure', pace) +
      stat('Effort', w.effort != null ? fmtNum(w.effort, 1) + ' / 10' : 'en calcul') + stat('Calories', w.kcal != null ? w.kcal + ' kcal' : '—') + stat('FC moy.', '—') + '</div>' +
      (f ? '<button class="linkish small" data-act="openforme" data-v="' + f.date + '">Forme ce jour-là : recovery <b style="color:' + recColor(f.recovery) + '">' + (f.recovery != null ? f.recovery + ' %' : '–') + '</b>' + (f.sleep != null ? ' · nuit ' + fmtSleep(f.sleep) : '') + '</button>' : '') +
      '<span class="small muted">FC et zones : pas dans l’export Athlytic.</span></article>';
  }
  function blockWatch(b) {
    if (!b.done || !b.date_faite || b.source === 'PR') return null;
    var ws = cfWatch(b.date_faite);
    if (!ws.length) return null;
    var db = dayBlocks(b.date_faite), cond = db.cond.indexOf(b) >= 0;
    var mine = ws.filter(function (w) { var k = wKind(w); return cond ? k !== 'force' : k === 'force'; });
    var group = cond ? db.cond : db.all.filter(function (s) { return db.cond.indexOf(s) < 0; });
    if (!mine.length) { mine = ws; group = db.all; }
    return { list: mine, shared: group.length };
  }
  function recColor(v) { return v == null ? 'transparent' : v >= 67 ? 'var(--green)' : v >= 34 ? 'var(--amber)' : 'var(--red-ink)'; }
  function recLabel(v) { return v >= 67 ? ['Bonne récup', 'ok', 'var(--green-soft)'] : v >= 34 ? ['Récup moyenne', 'amber', 'var(--amber-soft)'] : ['Récup basse', 'red', 'var(--red-soft)']; }
  function formeOn(ds) { return M.forme[ds] || null; }
  function formeLatest() {
    var t = iso(today()), ks = Object.keys(M.forme).filter(function (d) { return d <= t; }).sort();
    return ks.length ? M.forme[ks[ks.length - 1]] : null;
  }
  function formeAvg(ds, key, n) {
    var vals = [];
    for (var i = 1; i <= n; i++) { var f = M.forme[iso(addDays(parseD(ds), -i))]; if (f && f[key] != null) vals.push(f[key]); }
    return vals.length >= 5 ? vals.reduce(function (a, b) { return a + b; }, 0) / vals.length : null;
  }
  function fmtSleep(min) { if (min == null) return '—'; var h = Math.floor(min / 60), m = Math.round(min % 60); return h + ' h ' + pad(m); }
  function ring(v, size) {
    var p = v == null ? 0 : Math.max(0, Math.min(100, v)), inner = Math.round(size * 0.8);
    return '<div class="ring" style="width:' + size + 'px;height:' + size + 'px;background:conic-gradient(' + recColor(v) + ' 0 ' + p + '%, var(--line) ' + p + '% 100%)"><div style="width:' + inner + 'px;height:' + inner + 'px"><span class="num" style="font-size:' + Math.round(size * 0.33) + 'px">' + (v == null ? '–' : v) + '<span style="font-size:' + Math.round(size * 0.18) + 'px">%</span></span>' + (size >= 90 ? '<span class="small muted" style="font-size:11px">recovery</span>' : '') + '</div></div>';
  }
  function ratioColor(r, rating) { return r == null ? 'var(--muted)' : r >= 1.5 || /high/i.test(rating) ? 'var(--red-ink)' : /low/i.test(rating) ? 'var(--blue)' : 'var(--green)'; }
  function ratingFr(r) { return /high/i.test(r) ? 'Élevée' : /low/i.test(r) ? 'Basse' : /optimal/i.test(r) ? 'Optimale' : (r || ''); }

  // Bouton de l'accueil
  function formeButton() {
    var f = formeLatest(); if (!f) return '';
    var t = iso(today()), L = recLabel(f.recovery);
    var bits = [];
    if (f.vfc != null) bits.push('VFC ' + f.vfc + ' ms');
    if (f.sleep != null) bits.push('sommeil ' + fmtSleep(f.sleep));
    if (f.ratio != null) bits.push('charge ' + fmtNum(f.ratio, 1));
    return '<a class="forme-btn" href="#forme" aria-label="Ouvrir la forme du jour">' + ring(f.recovery, 60) +
      '<span class="stack" style="gap:4px;min-width:0;flex:1"><span class="row" style="gap:8px;flex-wrap:wrap"><b style="font-size:16px">' + (f.date === t ? 'Forme du jour' : 'Forme du ' + fmtDayMid(f.date)) + '</b><span class="pill ' + L[1] + '" style="background:' + L[2] + '">' + L[0] + '</span></span>' +
      '<span class="small muted">' + esc(bits.join(' · ')) + '</span></span>' + icon(I.right).replace('<svg', '<svg class="chev-r"') + '</a>';
  }
  function dayDot(ds) {
    var f = formeOn(ds);
    return f && f.recovery != null ? '<span class="rd" style="background:' + recColor(f.recovery) + '" title="Recovery ' + f.recovery + ' %"></span>' : '';
  }

  function repere(f) {
    var r = f.recovery, short = f.sleep != null && (f.sleep < 420 || (f.sgoal && f.sleep < f.sgoal - 90)), t;
    if (r == null) t = 'Pas de recovery calculée pour ce jour.';
    else if (r <= 33) t = 'Récup basse : privilégie la technique et des charges modérées, garde les max pour un autre jour.';
    else if (r < 67) t = short ? 'Récup moyenne et nuit courte : les charges prévues par la prog restent jouables, mais ce n’est pas le jour idéal pour aller chercher un max.' : 'Récup moyenne : suis la prog normalement et écoute tes sensations sur les blocs lourds.';
    else t = short ? 'Bonne récup malgré une nuit courte : tu peux pousser, en surveillant tes sensations.' : 'Bonne récup : bon jour pour pousser si la prog le permet.';
    if (f.ratio != null && f.ratio >= 1.5) t += ' Ta charge récente est élevée (ratio ' + fmtNum(f.ratio, 1) + ') : attention à l’accumulation.';
    return t;
  }
  function deltaTxt(v, avg, higherBetter, unit) {
    if (v == null || avg == null) return '<span class="small muted">&nbsp;</span>';
    var d = Math.round(v - avg), good = higherBetter ? d >= 0 : d <= 0;
    return '<span class="small ' + (d === 0 ? 'muted' : good ? 'ok' : 'amber') + '">' + (d > 0 ? '+' : '') + d + (unit || '') + ' vs 30 j</span>';
  }
  function watchRow(w, withLink) {
    return '<span class="t"><b>' + esc(w.heure || '') + ' · ' + esc(wLabel(w.type)) + ' · ' + (w.dur != null ? w.dur + ' min' : '—') + '</b><span>' + [w.kcal != null ? w.kcal + ' kcal' : '', w.effort != null ? 'effort ' + fmtNum(w.effort, 1) : 'effort en calcul', w.km && wKind(w) === 'endu' ? fmtNum(w.km, 1) + ' km' : ''].filter(Boolean).join(' · ') + (withLink ? ' · ' + esc(withLink) : '') + '</span></span>';
  }

  function viewForme() {
    var all = Object.keys(M.forme).sort(), t = iso(today());
    if (!all.length) return '<header class="row"><a class="icon-btn" href="#accueil" aria-label="Retour à l’accueil">' + icon(I.left) + '</a><h1 class="h1" style="font-size:34px">Forme du jour</h1></header><div class="empty">Pas encore de données Athlytic.<a class="btn primary" href="#moi">Importer un export</a></div>';
    if (!S.formeDay || !M.forme[S.formeDay]) { var f0 = formeLatest(); S.formeDay = f0 ? f0.date : all[all.length - 1]; }
    var f = M.forme[S.formeDay], i = all.indexOf(S.formeDay), L = recLabel(f.recovery);
    var h = '<div class="between" style="align-items:flex-start"><header class="row" style="align-items:flex-start"><a class="icon-btn" href="#accueil" aria-label="Retour à l’accueil">' + icon(I.left) + '</a><span class="stack" style="gap:4px"><h1 class="h1" style="font-size:34px">Forme du jour</h1><span class="small muted">' + cap(DOWL[parseD(f.date).getDay()]) + ' ' + parseD(f.date).getDate() + ' ' + MOL[parseD(f.date).getMonth()] + ' · Athlytic</span></span></header>' +
      '<div class="row" style="gap:6px"><button class="icon-btn" data-act="formed" data-v="-1" aria-label="Jour précédent"' + (i <= 0 ? ' disabled' : '') + '>' + icon(I.left) + '</button><button class="icon-btn" data-act="formed" data-v="1" aria-label="Jour suivant"' + (i >= all.length - 1 || all[i + 1] > t ? ' disabled' : '') + '>' + icon(I.right) + '</button></div></div>';

    var aRec = formeAvg(f.date, 'recovery', 30), aV = formeAvg(f.date, 'vfc', 30), aF = formeAvg(f.date, 'fc', 30);
    h += '<section class="card" style="gap:16px"><div class="row" style="gap:16px;align-items:center">' + ring(f.recovery, 104) +
      '<div class="stack" style="gap:6px;min-width:0"><span class="pill ' + L[1] + '" style="align-self:flex-start;background:' + L[2] + '">' + L[0] + '</span><span style="font-size:14px;color:var(--ink-2)">' +
      (aRec != null && f.recovery != null ? (f.recovery >= aRec ? 'Au-dessus' : 'En dessous') + ' de ta moyenne sur 30 jours (' + Math.round(aRec) + ' %).' : '') +
      (f.sleep != null ? ' Nuit de ' + fmtSleep(f.sleep) + (f.sgoal ? ' pour un objectif de ' + fmtSleep(f.sgoal) : '') + '.' : '') + '</span></div></div>';
    h += '<div class="grid3">' +
      '<div class="mini"><span class="label" style="font-size:11px">VFC</span><span class="num" style="font-size:26px">' + (f.vfc != null ? f.vfc + '<span class="u"> ms</span>' : '—') + '</span>' + deltaTxt(f.vfc, aV, true) + '</div>' +
      '<div class="mini"><span class="label" style="font-size:11px">FC repos</span><span class="num" style="font-size:26px">' + (f.fc != null ? f.fc + '<span class="u"> bpm</span>' : '—') + '</span>' + deltaTxt(f.fc, aF, false) + '</div>' +
      '<div class="mini"><span class="label" style="font-size:11px">Charge</span><span class="num" style="font-size:26px">' + (f.ratio != null ? fmtNum(f.ratio, 1) : '—') + '</span><span class="small" style="color:' + ratioColor(f.ratio, f.rating) + '">' + esc(ratingFr(f.rating)) + '</span></div></div>';
    if (f.sleep != null) {
      var parts = [['Profond', f.deep, 'var(--blue)'], ['REM', f.rem, 'var(--teal)'], ['Léger', f.core, '#52525B'], ['Éveillé', f.awake, 'var(--amber)']].filter(function (p) { return p[1]; });
      var tot = parts.reduce(function (a, p) { return a + p[1]; }, 0) || 1;
      h += '<div class="stack" style="gap:8px"><div class="between"><span class="label">Sommeil</span><span class="small" style="color:var(--ink-2)"><b style="color:var(--ink)">' + fmtSleep(f.sleep) + '</b>' + (f.sq != null ? ' · qualité ' + f.sq : '') + '</span></div>' +
        '<div class="sleepbar" role="img" aria-label="Phases de sommeil">' + parts.map(function (p) { return '<div style="width:' + (p[1] / tot * 100).toFixed(1) + '%;background:' + p[2] + '"></div>'; }).join('') + '</div>' +
        '<div class="legend2">' + parts.map(function (p) { return '<span><i style="background:' + p[2] + '"></i>' + p[0] + ' ' + (p[1] >= 60 ? fmtSleep(p[1]) : p[1] + ' min') + '</span>'; }).join('') + '</div></div>';
    }
    if (f.ex != null) {
      var inT = f.exMin != null && f.exMax != null ? (f.ex < f.exMin ? 'Sous la fourchette conseillée pour ta récup.' : f.ex > f.exMax ? 'Au-dessus de la fourchette conseillée pour ta récup.' : 'Dans la fourchette conseillée pour ta récup.') : '';
      h += '<div class="stack" style="gap:8px"><div class="between"><span class="label">Exertion</span><span class="small" style="color:var(--ink-2)"><b style="color:var(--ink)">' + fmtNum(f.ex, 1) + '</b> / 10' + (f.exMin != null ? ' · cible ' + fmtNum(f.exMin, 1) + ' à ' + fmtNum(f.exMax, 1) : '') + '</span></div>' +
        '<div class="gauge" role="img" aria-label="Exertion ' + fmtNum(f.ex, 1) + ' sur 10">' + (f.exMin != null ? '<div class="band" style="left:' + f.exMin * 10 + '%;width:' + (f.exMax - f.exMin) * 10 + '%"></div>' : '') + '<div class="fill" style="width:' + Math.min(100, f.ex * 10) + '%"></div><div class="mark" style="left:calc(' + Math.min(100, f.ex * 10) + '% - 2px)"></div></div>' +
        (inT ? '<span class="small muted">' + inT + '</span>' : '') + '</div>';
    }
    h += '<div class="hint">' + icon('M12 8v4M12 16h.01M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z') + '<span>Repère : ' + esc(repere(f)) + '</span></div></section>';

    // Séances montre du jour
    var ws = M.montreBy[f.date] || [];
    h += '<section class="stack"><h2 class="label">Séances montre</h2>';
    if (ws.length) {
      h += '<div class="list">' + ws.map(function (w) {
        var blocks = M.seances.filter(function (s) { if (s.date_faite !== f.date) return false; var bw = blockWatch(s); return bw && bw.list.indexOf(w) >= 0; }).map(function (s) { return s.nom; });
        return '<button class="li" data-act="gowod" data-v="' + f.date + '">' + watchRow(w, blocks.join(' + ')) + icon(I.right).replace('<svg', '<svg class="chev-r"') + '</button>';
      }).join('') + '</div>';
    } else h += '<span class="small muted">Aucune séance enregistrée par la montre ce jour-là.</span>';
    h += '</section>';

    // 7 jours
    var week = [];
    for (var k = 6; k >= 0; k--) { var d = iso(addDays(parseD(f.date), -k)), fx = M.forme[d]; week.push({ d: d, v: fx ? fx.recovery : null }); }
    h += '<section class="stack"><h2 class="label">7 derniers jours</h2><div class="card" style="gap:6px;padding:14px 12px 10px"><div class="bars7" role="img" aria-label="Recovery des 7 derniers jours">' + week.map(function (x) {
      return '<div><span class="small">' + (x.v != null ? x.v : '–') + '</span><i style="height:' + (x.v != null ? Math.max(3, Math.round(x.v * 0.7)) : 3) + 'px;background:' + (x.v != null ? recColor(x.v) : 'var(--line)') + '"></i><span class="small muted">' + DOWL[parseD(x.d).getDay()].slice(0, 3) + '.</span></div>';
    }).join('') + '</div></div><a class="small" href="#analyse" style="font-weight:600;align-self:flex-start;min-height:44px;display:flex;align-items:center">Voir l’analyse forme et perfs</a></section>';
    return h;
  }

  // Ligne « séance montre » dans une carte de bloc fait
  function watchBlock(b) {
    if (b.source === 'PR') return '';
    var bw = blockWatch(b), f = b.done ? formeOn(b.date_faite) : null;
    if (!bw && !f) return '';
    var h = '<div class="watch">';
    if (bw) {
      var tot = bw.list.reduce(function (a, w) { return a + (w.dur || 0); }, 0), kc = bw.list.reduce(function (a, w) { return a + (w.kcal || 0); }, 0);
      var eff = bw.list.length === 1 ? bw.list[0].effort : null;
      h += '<div class="row" style="gap:8px;align-items:flex-start">' + icon('M12 9v3l2 1M9 2h6M9 22h6M12 5a7 7 0 1 0 0 14 7 7 0 0 0 0-14z') + '<span class="small" style="color:var(--ink-2)">Montre · ' + bw.list.map(function (w) { return esc(w.heure) + ' ' + esc(wLabel(w.type)); }).join(' + ') + ' · <b style="color:var(--ink)">' + tot + ' min</b>' + (kc ? ' · ' + kc + ' kcal' : '') + (eff != null ? ' · effort ' + fmtNum(eff, 1) : '') + (bw.shared > 1 ? ' · séance commune à ' + bw.shared + ' blocs' : '') + '</span></div>';
      if (eff != null && b.rpe_ressenti) {
        h += '<div class="vs"><span>RPE ressenti</span><div><i style="width:' + b.rpe_ressenti * 10 + '%;background:var(--red-ink)"></i></div><b>' + b.rpe_ressenti + '</b><span>Effort montre</span><div><i style="width:' + eff * 10 + '%;background:var(--blue)"></i></div><b>' + fmtNum(eff, 1) + '</b></div>';
        if (b.rpe_ressenti - eff >= 4 && (b.type_bloc === 'haltero' || b.type_bloc === 'gym' || b.type_bloc === 'renfo')) h += '<span class="small muted">Écart normal sur un bloc de force ou de gym : la difficulté est musculaire, le cardio monte peu.</span>';
      }
    }
    if (f) h += '<button class="linkish small" data-act="openforme" data-v="' + f.date + '">Forme ce jour-là : recovery <b style="color:' + recColor(f.recovery) + '">' + (f.recovery != null ? f.recovery + ' %' : '–') + '</b>' + (f.sleep != null ? ' · nuit ' + fmtSleep(f.sleep) : '') + (f.vfc != null ? ' · VFC ' + f.vfc : '') + '</button>';
    return h + '</div>';
  }

  // Section Analyse
  function analyseForme() {
    var ks = Object.keys(M.forme).sort(); if (!ks.length) return '';
    var last = ks.slice(-60), from = last[0], to = last[last.length - 1];
    var prs = prEvents(from, to).filter(function (p) { return !p.tie; });
    var prDays = {}; prs.forEach(function (p) { prDays[p.a.date] = 1; });
    var h = '<section class="stack"><div class="between"><h2 class="label">Forme · recovery par jour</h2><span class="small muted">● = PR ce jour-là</span></div>';
    h += '<div class="card" style="gap:8px;padding:16px 12px 12px"><div class="bars60" role="img" aria-label="Recovery quotidienne">' + last.map(function (d) {
      var v = M.forme[d].recovery;
      return '<div>' + (prDays[d] ? '<b class="prdot"></b>' : '') + '<i style="height:' + (v != null ? Math.max(2, Math.round(v * 1.2)) : 2) + 'px;background:' + (v != null ? recColor(v) : 'var(--line)') + '"></i></div>';
    }).join('') + '</div><div class="between small muted" style="font-size:11px"><span>' + fmtDayMid(from) + '</span><span>' + fmtDayMid(to) + '</span></div>' +
      '<div class="legend2"><span><i style="background:var(--green)"></i>67 % et plus</span><span><i style="background:var(--amber)"></i>34 à 66 %</span><span><i style="background:var(--red-ink)"></i>33 % et moins</span></div></div>';
    function avg(arr, k) { var v = arr.map(function (d) { return M.forme[d][k]; }).filter(function (x) { return x != null; }); return v.length ? v.reduce(function (a, b) { return a + b; }, 0) / v.length : null; }
    if (last.length >= 20) {
      var half = Math.floor(last.length / 2), A = last.slice(0, half), B = last.slice(half);
      h += '<div class="grid2"><div class="tile"><span class="cap">' + fmtDayMid(A[0]) + ' → ' + fmtDayMid(A[A.length - 1]) + '</span><span class="num">' + Math.round(avg(A, 'recovery')) + ' %</span><span class="cap">recovery moyenne</span></div><div class="tile"><span class="cap">' + fmtDayMid(B[0]) + ' → ' + fmtDayMid(B[B.length - 1]) + '</span><span class="num">' + Math.round(avg(B, 'recovery')) + ' %</span><span class="cap">recovery moyenne</span></div></div>';
    }
    h += '</section>';
    if (prs.length) {
      h += '<section class="stack"><h2 class="label">Tes PR et ta forme</h2><div class="list">' + prs.slice(-6).reverse().map(function (p) {
        var f = M.forme[p.a.date];
        return '<button class="li" data-act="openforme" data-v="' + p.a.date + '"><span class="t"><b>' + esc(recordTitle(p.r)) + '</b><span>' + fmtDayMid(p.a.date) + (f ? ' · recovery <b style="color:' + recColor(f.recovery) + '">' + (f.recovery != null ? f.recovery + ' %' : '–') + '</b>' + (f.sleep != null ? ' · nuit ' + fmtSleep(f.sleep) : '') + (f.vfc != null ? ' · VFC ' + f.vfc : '') : '') + '</span></span><span class="v red">' + esc(recordValue(p.r, p.a.value, p.a)) + '</span></button>';
      }).join('') + '</div></section>';
    }
    var hi = last.filter(function (d) { return M.forme[d].ratio != null && M.forme[d].ratio >= 1.5; });
    h += '<section class="stack"><div class="between"><h2 class="label">Charge (7 j / 6 sem.)</h2><span class="small muted">seuil 1,5</span></div><div class="card" style="gap:8px;padding:16px 12px 12px"><div class="bars60 load" role="img" aria-label="Ratio de charge"><span class="thr"></span>' + last.map(function (d) {
      var r = M.forme[d].ratio;
      return '<div><i style="height:' + (r != null ? Math.min(110, Math.round(r * 60)) : 2) + 'px;background:' + (r == null ? 'var(--line)' : r >= 1.5 ? 'var(--red-ink)' : r < 0.8 ? 'var(--blue)' : '#52525B') + '"></i></div>';
    }).join('') + '</div><div class="between small muted" style="font-size:11px"><span>' + fmtDayMid(from) + '</span><span>' + fmtDayMid(to) + '</span></div>' +
      '<span class="small" style="color:var(--ink-2)">' + (hi.length ? hi.length + ' jour' + (hi.length > 1 ? 's' : '') + ' au-dessus de 1,5 : ' + hi.map(fmtDayMid).join(', ') + '.' : 'Aucun jour au-dessus de 1,5.') + '</span></div></section>';
    var sl = last.map(function (d) { return M.forme[d].sleep; }).filter(function (x) { return x != null; });
    h += '<div class="list"><div class="li"><span>Nuits sous 7 h</span><span class="v">' + sl.filter(function (x) { return x < 420; }).length + '<span style="color:var(--faint)"> / ' + sl.length + '</span></span></div>' +
      '<div class="li"><span>Jours sous 33 % de recovery</span><span class="v red">' + last.filter(function (d) { return M.forme[d].recovery != null && M.forme[d].recovery <= 33; }).length + '</span></div>' +
      (sl.length ? '<div class="li"><span>Sommeil moyen</span><span class="v">' + fmtSleep(sl.reduce(function (a, b) { return a + b; }, 0) / sl.length) + '</span></div>' : '') + '</div>';
    return h;
  }

  // Onglet Moi : import Athlytic
  function moiAthlytic() {
    var ks = Object.keys(M.forme).sort();
    var h = '<section class="card"><h2 class="label">Données Athlytic</h2>';
    if (ks.length) h += '<div class="row" style="gap:10px"><span class="rd big" style="background:var(--green)"></span><span class="stack" style="gap:2px"><b>Jusqu’au ' + fmtDay(ks[ks.length - 1]) + '</b><span class="small muted">' + ks.length + ' jours de forme · ' + M.montre.length + ' séances montre' + (M.reg.athlytic_maj ? '<br>Dernier envoi : ' + esc(M.reg.athlytic_maj) : '') + '</span></span></div>';
    else h += '<span class="muted small">Aucune donnée importée pour l’instant.</span>';
    if (M.gateway < 3 && !demoUrl()) h += '<div class="notice">Pour importer depuis l’app, mets à jour la passerelle : colle le nouveau Code.gs (v3) dans Apps Script, puis Déployer › Gérer les déploiements › Modifier › Nouvelle version.</div>';
    h += '<label class="btn primary" style="cursor:pointer">' + icon('M12 3v12M7 10l5 5 5-5M5 21h14') + 'Importer un export Athlytic (.json)<input type="file" id="m-athl" accept=".json,application/json" hidden></label>';
    h += '<span class="small muted">Dans Athlytic : More › Export Data › Last 60 Days › Share Data, enregistre le fichier dans Fichiers puis choisis-le ici. Les jours déjà importés sont mis à jour, jamais dupliqués. Ces données de santé restent dans ton Google Sheet (onglets Forme et Montre).</span></section>';
    return h;
  }
  function athlyticRows(j) {
    function g(o, k) { var v = (o || {})[k]; return v == null ? '' : v; }
    var forme = [], montre = [];
    (j.days || []).forEach(function (x) {
      var r = x.recovery, s = x.sleep, e = x.exertion, t = x.training_load;
      forme.push({ date: x.date, recovery: g(r, 'score'), vfc_ms: g(r, 'hrv_ms'), fc_repos: g(r, 'resting_hr_bpm'), sommeil_min: g(s, 'asleep_min'), profond_min: g(s, 'deep_min'), rem_min: g(s, 'rem_min'), core_min: g(s, 'core_min'), eveil_min: g(s, 'awake_min'), qualite_sommeil: g(s, 'quality_score'), perf_sommeil_pct: g(s, 'performance_pct'), objectif_sommeil_min: g(s, 'target_min'), exertion: g(e, 'score'), exertion_min: g(e, 'target_min'), exertion_max: g(e, 'target_max'), trimp: g(t, 'daily_trimp'), charge_7j: g(t, 'short_term'), charge_6sem: g(t, 'long_term'), ratio_charge: g(t, 'ratio'), statut_charge: g(t, 'rating') });
      (x.workouts || []).forEach(function (w) {
        var hm = String(w.start || '').slice(11, 16);
        montre.push({ date: x.date, heure: hm, id: 'ath-' + x.date + '-' + hm.replace(':', ''), type: w.type || '', duree_min: g(w, 'duration_min'), effort: g(w, 'effort'), kcal: g(w, 'active_energy'), distance_km: g(w, 'distance'), source: 'Athlytic' });
      });
    });
    return { forme: forme, montre: montre };
  }
  function importAthlytic(file) {
    if (!file) return;
    var rd = new FileReader();
    rd.onload = function () {
      var j; try { j = JSON.parse(rd.result); } catch (e) { toast('Fichier illisible : choisis l’export JSON d’Athlytic.'); return; }
      if (!j || !j.days || j.source !== 'Athlytic') { toast('Ce fichier n’est pas un export Athlytic.'); return; }
      var rows = athlyticRows(j);
      toast('Import de ' + rows.forme.length + ' jours…');
      apiPost({ action: 'athlytic', forme: rows.forme, montre: rows.montre }).then(function () {
        toast(rows.forme.length + ' jours et ' + rows.montre.length + ' séances importés'); load(false);
      }).catch(function (err) { toast('Import impossible : ' + err.message); });
    };
    rd.readAsText(file);
  }

  // ---------- Modal ----------
  function openSheet(html) { var el = $('#sheet'); el.innerHTML = '<div class="panel" role="dialog" aria-modal="true">' + html + '</div>'; el.hidden = false; document.body.classList.add('noscroll'); bindSheet(); }
  function closeSheet() { var el = $('#sheet'); el.hidden = true; el.innerHTML = ''; document.body.classList.remove('noscroll'); }
  function bindSheet() {
    var el = $('#sheet');
    el.onclick = function (e) { if (e.target === el) closeSheet(); };
    $$('[data-act]', el).forEach(function (b) { b.onclick = function (e) { act(b, e); }; });
    var sd = $('#s-date'); if (sd) sd.onchange = function () { if (sd.value) { F.date = sd.value; $$('[data-act="fdate"]').forEach(function (x) { x.setAttribute('aria-pressed', x.dataset.v === sd.value); }); } };
    $$('[data-mi]', el).forEach(function (inp) {
      inp.oninput = function () {
        var m = F.moves[+inp.dataset.mi], f = inp.dataset.f; F.edited = true;
        if (f === 'name') { m.name = inp.value; m.key = MV.canon(inp.value); m.machine = MV.machineOf(m.key); }
        else if (f === 'pr') {
          m.perRounds[+inp.dataset.r] = num(inp.value);
          var known = m.perRounds.filter(function (v) { return v != null; });
          m.reps = known.length ? known.reduce(function (a, b) { return a + b; }, 0) : null;
          var t = $('#mvt-' + inp.dataset.mi); if (t) t.textContent = m.reps != null ? m.reps : '–';
          refreshCharge();
        }
        else if (f === 'pl') { m.perLoads[+inp.dataset.r] = num(inp.value); refreshCharge(); }
        else if (f === 'load' && m.perLoads) {
          // La charge de la ligne remplit tous les rounds ; on ajuste ensuite round par round.
          m.load = num(inp.value);
          m.perLoads = m.perLoads.map(function () { return m.load; });
          $$('[data-f="pl"][data-mi="' + inp.dataset.mi + '"]').forEach(function (x) { x.value = inp.value; });
          refreshCharge();
        }
        else { m[f] = num(inp.value); if (f === 'load') refreshCharge(); }
      };
    });
  }

  // ---------- Événements ----------
  function bind() {
    $$('#view [data-act]').forEach(function (b) { b.onclick = function (e) { act(b, e); }; });
    var fw = $('#f-wod'); if (fw) fw.onsubmit = saveWod;
    var wd = $('#w-desc'), ws = $('#w-score');
    if (wd) { var upd = function () { $('#w-preview').innerHTML = previewMoves(wd.value, ws.value); }; wd.oninput = upd; ws.onchange = upd; }
    var fc = $('#f-cfg'); if (fc) fc.onsubmit = saveCfg;
    var fr = $('#f-reg'); if (fr) fr.onsubmit = saveReg;
    var fm = $('#f-rm'); if (fm) fm.onsubmit = saveRm;
    var fg = $('#f-goal'); if (fg) fg.onsubmit = addGoal;
    var ph = $('#m-photo'); if (ph) ph.onchange = function () { setPhoto(ph.files[0]); };
    var ax = $('#m-athl'); if (ax) ax.onchange = function () { importAthlytic(ax.files[0]); ax.value = ''; };
  }
  function keepScroll(fn) { var y = window.scrollY; fn(); window.scrollTo(0, y); }
  function act(el, e) {
    var a = el.dataset.act, v = el.dataset.v;
    switch (a) {
      case 'period': S.period = v; S.open = null; render(); break;
      case 'pprev': if (S.period === 'week') S.wOff--; else S.mOff--; keepScroll(render); break;
      case 'pnext': if (S.period === 'week') S.wOff++; else S.mOff++; keepScroll(render); break;
      case 'pnow': S.wOff = 0; S.mOff = 0; render(); break;
      case 'open': S.open = S.open === v ? null : v; keepScroll(render); break;
      case 'openall': S.openAll[v] = !S.openAll[v]; keepScroll(render); break;
      case 'openpr': closeSheet(); S.prKey = v; S.prLevel = el.dataset.l || 'RX'; if (location.hash !== '#pr') location.hash = '#pr'; else { render(); window.scrollTo(0, 0); } break;
      case 'prback': S.prKey = null; render(); break;
      case 'prlvl': S.prLevel = v; render(); break;
      case 'prsec': S.prOpen[v] = !S.prOpen[v]; setUi('prOpen', S.prOpen); keepScroll(render); break;
      case 'prall': ['lifts', 'gym', 'endu', 'wod'].forEach(function (k) { S.prOpen[k] = v === '1'; }); setUi('prOpen', S.prOpen); keepScroll(render); break;
      case 'wodtab': S.wodTab = v; setUi('wodTab', v); keepScroll(render); break;
      case 'wprev': S.wodWeek--; S.wodDay = null; render(); break;
      case 'wnext': S.wodWeek++; S.wodDay = null; render(); break;
      case 'wday': S.wodDay = v; keepScroll(render); break;
      case 'bver': S.ver[el.dataset.id] = v; keepScroll(render); break;
      case 'expand': var d = $('#d-' + CSS.escape(v)); if (d) d.classList.remove('clamp'); el.remove(); break;
      case 'score': openScore(v); break;
      case 'board': openBoard(v); break;
      case 'bfilter': S.boardFilter = v; openBoard(el.dataset.id); break;
      case 'bsex': setSex(el.dataset.id, el.dataset.n, v); break;
      case 'close': closeSheet(); break;
      case 'fmode': F = { mode: v }; render(); break;
      case 'fdate': F.date = v; $('#s-date').value = v; $$('[data-act="fdate"]').forEach(function (x) { x.setAttribute('aria-pressed', x.dataset.v === v); }); break;
      case 'flvl':
        captureScore(); F.level = v;
        if (!F.kindTouched) { var b0 = M.byId[F.id], am = /amrap/i.test(MV.section(b0.description, v)); F.kind = am && b0.type_score !== 'rounds_reps' && !/amrap/i.test(MV.section(b0.description, 'RX')) ? 'rounds_reps' : (b0.type_score || F.kind); }
        if (!F.edited) { var b = M.byId[F.id]; F.moves = cloneMoves(MV.parse(b.description, { reg: M.reg, sex: M.reg.sexe || 'H', version: v, score: b.score_valeur, scoreType: F.kind }), b); }
        drawScore(); break;
      case 'ftours': captureScore(); F.tours = Math.max(1, Math.min(30, (F.tours || 1) + (+v))); drawScore(); break;
      case 'fkind': captureScore(); F.kind = v; F.kindTouched = true; drawScore(); break;
      case 'fopt':
        captureScore();
        var mo = F.moves[+el.dataset.i], op = mo.options[+v];
        mo.choice = +v; mo.name = op.name; mo.key = op.key; mo.unit = op.unit || 'reps'; mo.machine = op.machine; mo.nbDb = op.nbDb;
        if (op.load != null) { mo.load = op.load; mo.presc = op.load; }
        var oldPr = mo.perRound; mo.perRound = op.perRound;
        if (mo.perRounds) { mo.perRounds = mo.perRounds.map(function () { return op.perRound; }); mo.reps = op.perRound != null ? op.perRound * mo.perRounds.length : null; }
        else if (op.perRound != null && mo.reps != null && oldPr) mo.reps = Math.round(mo.reps / oldPr * op.perRound);
        F.edited = true; drawScore(); break;
      case 'funit':
        captureScore();
        var mu = F.moves[+el.dataset.i];
        if (v === 'reps' && mu.unit !== 'reps') {
          mu.unit = 'reps'; mu.reps = null;
          if (mu.perRounds) { mu.perRounds = mu.perRounds.map(function () { return null; }); if (needsLoad(mu, M.byId[F.id])) mu.perLoads = mu.perRounds.map(function () { return mu.load != null ? mu.load : null; }); }
        } else if (v === 's' && mu.unit !== 's') {
          mu.unit = 's'; mu.perLoads = null; mu.load = null;
          if (mu.perRounds) { mu.perRounds = mu.perRounds.map(function () { return mu.secRound != null ? mu.secRound : null; }); var kn = mu.perRounds.filter(function (x) { return x != null; }); mu.reps = kn.length ? kn.reduce(function (a, c) { return a + c; }, 0) : null; }
          else mu.reps = mu.secRound != null ? mu.secRound : null;
        }
        F.edited = true; drawScore(); break;
      case 'fdb': captureScore(); F.moves[+el.dataset.i].nbDb = +v; F.edited = true; drawScore(); break;
      case 'fmadd': captureScore(); F.moves.push({ name: '', key: '', reps: null, load: null, presc: null, nbDb: null, unit: 'reps', isNew: true }); F.edited = true; drawScore(); break;
      case 'fmdel': captureScore(); F.moves.splice(+el.dataset.i, 1); F.edited = true; drawScore(); break;
      case 'frpe': F.rpe = +v; $$('[data-act="frpe"]').forEach(function (x) { x.setAttribute('aria-pressed', x.dataset.v === v); }); break;
      case 'fsave': saveScore(false); break;
      case 'fskip': saveScore(true); break;
      case 'mset': e.preventDefault(); saveReglages([[el.dataset.k, v]], el.dataset.k === 'sexe' ? 'Sexe enregistré' : 'Version par défaut enregistrée'); break;
      case 'goaladd': S.goalForm = !S.goalForm; keepScroll(render); break;
      case 'goaldel': var gl = M.goals.slice(); gl.splice(+v, 1); saveGoals(gl, 'Objectif supprimé'); break;
      case 'refresh': load(true); break;
      case 'formed': var fk = Object.keys(M.forme).sort(), fi = fk.indexOf(S.formeDay) + (+v); if (fi >= 0 && fi < fk.length) { S.formeDay = fk[fi]; keepScroll(render); } break;
      case 'openforme': S.formeDay = v; S.formeHold = true; if (location.hash === '#forme') { S.formeHold = false; keepScroll(render); } else location.hash = '#forme'; break;
      case 'gowod': S.wodDay = v; S.wodWeek = Math.round((monday(parseD(v)) - monday(today())) / (7 * 864e5)); location.hash = '#wod'; break;
    }
  }
  function route() {
    var t = (location.hash || '#accueil').slice(1) || 'accueil';
    if (['accueil', 'wod', 'ajouter', 'pr', 'analyse', 'moi', 'forme'].indexOf(t) < 0) t = 'accueil';
    if (t !== 'pr' && S.tab === 'pr') S.prKey = null;
    if (t === 'ajouter' && (!F || !F.mode)) F = { mode: 'wod' };
    if (t === 'forme' && !S.formeHold) S.formeDay = null;
    S.formeHold = false;
    S.tab = t; closeSheet(); render(); window.scrollTo(0, 0);
  }

  // ---------- Chargement ----------
  var rmChecked = false;
  function load(force) {
    S.loading = true; S.error = null; if (M) render();
    return apiGet().then(function (data) {
      S.raw = data; build(data); S.loading = false; S.syncedAt = new Date();
      cachePut('data', data); render();
      if (force) toast('Données à jour');
      if (!rmChecked) { rmChecked = true; autoRm(); }
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
    if (cached) { S.raw = cached; build(cached); }
    render();
    if (getCfg().url) load(false); else { S.loading = false; S.error = 'config'; render(); }
  });
  window.__kaizen = { S: S, get M() { return M; }, stats: stats, movesOf: movesOf };
})();
