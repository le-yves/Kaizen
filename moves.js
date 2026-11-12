/* Kaizen v2 — lecture des mouvements d'un WOD.
   Transforme le texte d'un bloc (prog DarkZone ou historique BTWB) en liste de mouvements :
   reps totales (reps × rounds), charge par implément, nombre d'haltères, unité (reps, cal, m, s).
   Règles :
   - « 6/6 » (même chiffre) = par côté → 12 reps, 1 haltère.
   - « 30/20 cal » ou « 9/6 kg » (chiffres différents) = homme / femme.
   - « alt » = 1 haltère ; « DB » sans précision = 2 haltères (sauf snatch, goblet…).
   - « 1-3 rope climb » = fourchette : on prend le haut, signalé à compléter.
   - « Max … » = reps inconnues, reprises du score si le bloc se score en reps. */
(function (root) {
  'use strict';

  function num(v) { if (v === '' || v == null) return null; var n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.')); return isFinite(n) ? n : null; }
  function r05(n) { return Math.round(n * 2) / 2; }

  var RM_MAP = [['clean and jerk', 'rm_clean_and_jerk'], ['clean & jerk', 'rm_clean_and_jerk'], ['c&j', 'rm_clean_and_jerk'], ['power clean', 'rm_power_clean'], ['power snatch', 'rm_power_snatch'], ['snatch', 'rm_snatch'], ['clean', 'rm_clean'], ['back squat', 'rm_back_squat'], ['front squat', 'rm_front_squat'], ['squat', 'rm_back_squat'], ['deadlift', 'rm_deadlift'], ['bench', 'rm_bench'], ['push press', 'rm_push_press'], ['strict press', 'rm_strict_press'], ['press', 'rm_strict_press']];
  function rmFor(text, reg) {
    var t = String(text || '').toLowerCase();
    for (var i = 0; i < RM_MAP.length; i++) if (t.indexOf(RM_MAP[i][0]) >= 0 && num(reg[RM_MAP[i][1]])) return { key: RM_MAP[i][1], name: RM_MAP[i][0], rm: num(reg[RM_MAP[i][1]]) };
    return null;
  }

  // Nom canonique, pour regrouper « Wall Balls », « wall ball » et « Wall Ball, 9 kg ».
  var ALIAS = [
    [/\bdouble dumbbells?\b/g, 'db'], [/\b(alternating|alt\.?) dumbbells?\b/g, 'db alt'], [/\bsingle[- ]arm dumbbells?\b/g, 'db'],
    [/\bdumbbells?\b/g, 'db'], [/\bkettlebells?\b/g, 'kb'],
    [/\bt2b\b/g, 'toes-to-bar'], [/\btoes ?to ?bar\b/g, 'toes-to-bar'], [/\bttb\b/g, 'toes-to-bar'],
    [/\bc2b\b/g, 'chest-to-bar pull-up'], [/\bhspu\b/g, 'handstand push-up'], [/\bdus?\b/g, 'double under'],
    [/\bdouble[- ]unders?\b/g, 'double under'], [/\bpull ?ups?\b/g, 'pull-up'], [/\bpush ?ups?\b/g, 'push-up'], [/\bsit ?ups?\b/g, 'sit-up'],
    [/\bmuscle ?ups?\b/g, 'muscle-up'], [/\bbmu\b/g, 'bar muscle-up'], [/\brmu\b/g, 'ring muscle-up'], [/\bski ?erg\b/g, 'ski'], [/\bbike ?erg\b/g, 'bike'],
    [/\bassault bike\b/g, 'echo bike'], [/\bwb\b/g, 'wall ball'], [/\bc&j\b/g, 'clean & jerk'], [/\bclean and jerk\b/g, 'clean & jerk'], [/\bohs\b/g, 'overhead squat']
  ];
  function canon(name) {
    var s = ' ' + String(name || '').toLowerCase().replace(/[’']/g, "'") + ' ';
    ALIAS.forEach(function (a) { s = s.replace(a[0], a[1]); });
    s = s.replace(/[,;:|].*$/, '').replace(/\s+/g, ' ').trim();
    s = s.split(' ').map(function (w) {
      if (/^(press|cross|across|plus|bus|abs|toes|series|chest|lats|ss)$/.test(w)) return w;
      if (/ies$/.test(w) && w.length > 4) return w.slice(0, -3) + 'y';
      if (/(ches|shes|sses)$/.test(w)) return w.slice(0, -2);
      if (/[^su]s$/.test(w) && w.length > 3) return w.slice(0, -1);
      if (/-ups$|-unders$/.test(w)) return w.slice(0, -1);
      return w;
    }).join(' ');
    s = s.replace(/^(row|ski|bike|echo bike|run) (calory|calorie|cal)$/, '$1').replace(/ (calory|calorie)$/, '');
    return s;
  }
  function display(c) {
    var s = c.replace(/\b(db|kb|ghd|amrap|emom|rdl|sdhp|hspu|tgu)\b/g, function (x) { return x.toUpperCase(); });
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  var MACHINES = [[/\brow(er)?\b(?!.*(bent|upright|ring|renegade|pendlay|seal|barbell|db|kb|banded|t-bar|inverted))/, 'row'], [/\bski\b/, 'ski'], [/\bechos?\b|\bassault\b/, 'echo'], [/\bbike\b/, 'bike'], [/\brun\b|\brunning\b|\bcourse\b/, 'run'], [/\bswim\b/, 'swim']];
  function machineOf(c) { for (var i = 0; i < MACHINES.length; i++) if (MACHINES[i][0].test(c)) return MACHINES[i][1]; return null; }

  // Nombre d'haltères par défaut pour un mouvement à DB/KB.
  function defaultDb(c, perSide) {
    if (!/\b(db|kb)\b/.test(c)) return null;
    if (perSide || /\balt\b|single|one[- ]arm|\bsnatch\b|goblet|turkish|\btgu\b|bottom.?up/.test(c)) return 1;
    if (/\bkb\b/.test(c) && !/double|\bkbs\b.*2|farmer|carry/.test(c)) return 1;
    return 2;
  }

  function loadFrom(text, sex) {
    // « 22,5/15 kg », « 20 kg », « @ 60kg », « 95/65 lb »
    var m = String(text).match(/@?\s*(\d+(?:[.,]\d+)?)(?:\s*\/\s*(\d+(?:[.,]\d+)?))?\s*(kg|lbs?|#)\b/i);
    if (!m) return null;
    var a = num(m[1]), b = num(m[2]), v = sex === 'F' && b != null ? b : a;
    if (/lb|#/i.test(m[3])) v = r05(v * 0.4536);
    return v;
  }

  function pickSection(desc, version) {
    var t = String(desc || '');
    var parts = t.split(/\n?\s*ROOKIE VERSION\s*:?\s*\n?/i);
    var s = version === 'Rookie' && parts[1] ? parts[1] : parts[0];
    return s.replace(/^\s*RX\s*\/?\s*(INTER)?\s*VERSION\s*:?\s*$/gim, '');
  }

  function cleanLine(l) {
    return l.replace(/[℀-⅏←-⇿⌀-➿⬀-⯿️‍]|[\uD83C-\uDBFF][\uDC00-\uDFFF]/g, '')
      .replace(/\((?:rir|rpe|pause|tempo|3m|\d+\s*m\b)[^)]*\)/gi, '').replace(/\s+/g, ' ').trim();
  }

  // « 18 rounds of Cindy », « 3 round of DTs, 60 kg »
  var BENCH_ROUND = {
    cindy: [[5, 'pull-up'], [10, 'push-up'], [15, 'air squat']],
    dt: [[12, 'deadlift'], [9, 'hang power clean'], [6, 'push jerk']],
    'db dt': [[12, 'db deadlift'], [9, 'db hang power clean'], [6, 'db push jerk']],
    fran: [[21, 'thruster'], [21, 'pull-up']]
  };

  var SKIP = /^(rest|repos|resting|alterner|alternate between interval|l'objectif|si ce|si vous|pas de|complex of the day|sets\b|intervals?\s*:|note|objectif|scaling|time ?cap|tc\b|cap\b|for time:?$|then\b|puis\b|warm|échauff|coach|score\b|dans l'ordre|each round for time)/i;

  // Analyse un bloc. ctx = { reg, sex, version, score, scoreType, nom, typeBloc }
  function parse(desc, ctx) {
    ctx = ctx || {};
    var reg = ctx.reg || {}, sex = ctx.sex || 'H';
    var text = pickSection(desc, ctx.version);
    var lines = text.split('\n').map(cleanLine);
    var out = [], sec = [], mult = 1, alternate = /altern/i.test(text), alternating = false, scheme = null, amrap = false;
    var intervals = /interval\s*b/i.test(text) && /altern/i.test(desc || ''), curInterval = null;
    var progression = null, everySec = false;

    function flushSection() {
      if (everySec && mult > 1 && sec.length >= mult && sec.length % mult === 0 && !alternating) sec.forEach(function (m) { if (!m.fixed) m.mult = m.mult / mult * (sec.length / mult === 1 ? 1 : 1); });
      everySec = false;
      if (alternating && sec.length) {
        var k = sec.length;
        sec.forEach(function (m) { if (!m.fixed) m.mult = m.mult / k; });
      }
      sec.forEach(function (m) { out.push(m); });
      sec = []; alternating = false;
    }

    function addMove(o) {
      o.mult = o.fixed ? 1 : (o.interval ? (o.interval === 'A' ? Math.ceil(mult / 2) : Math.floor(mult / 2)) : mult);
      sec.push(o);
    }

    function lineToMove(l, fixedReps) {
      var m, o = { raw: l, reps: null, perRound: null, load: null, unit: 'reps', range: null, max: false, perSide: false, fixed: false, interval: curInterval };
      var body = l, res = null;
      var bar = l.split('|');
      if (bar.length > 1) { body = bar[0].trim(); res = bar.slice(1).join('|').trim(); }
      // Résultat BTWB à droite du « | »
      if (res != null) {
        o.fixed = true;
        var lr = loadFrom(res, sex);
        var rm2 = res.match(/^(\d+(?:[.,]\d+)?)\s*(m|km|cal\w*)\s*$/i);
        if (rm2) { o.unit = /^cal/i.test(rm2[2]) ? 'cal' : 'm'; o.perRound = num(rm2[1]) * (rm2[2].toLowerCase() === 'km' ? 1000 : 1); o.resUnit = true; }
        else if (lr != null && /kg|lb/i.test(res)) o.load = lr;
        else if ((rm2 = res.match(/^(\d+)\s*reps?$/i))) o.perRound = num(rm2[1]);
        else if (/^\d+(\s*,\s*\d+)*(\s*,?\s*and\s*\d+)?$/.test(res.replace(/\s+/g, ' '))) {
          var nums = res.match(/\d+/g).map(Number);
          o.perRound = nums.reduce(function (a, b) { return a + b; }, 0);
        }
      }
      // Max …
      if ((m = body.match(/^max(?:\s+reps?)?\s*(?:of\s*)?(.+)$/i))) { o.max = true; body = m[1]; }
      // Nombre en tête : « 30/20 Cal row », « 6/6 KB press », « 1-3 Rope climb », « 400 m run », « 30 sec plank »
      m = body.match(/^(\d+(?:[.,]\d+)?)(?:\s*[-–à]\s*(\d+))?(?:\s*\/\s*(\d+(?:[.,]\d+)?))?\s*(cal(?:ories?|s)?\.?|m\b|km\b|meters?\b|mètres?\b|sec(?:ondes?|s)?\b|s\b|min(?:utes?)?\b|['’]{1,2})?\s*(?:x\s+)?(.*)$/i);
      if (m && m[5] && /[a-z]/i.test(m[5])) {
        var a = num(m[1]), hi = num(m[2]), b = num(m[3]), u = (m[4] || '').toLowerCase();
        var n = a;
        if (b != null) { if (b === a) { o.perSide = true; n = a * 2; } else n = sex === 'F' ? b : a; }
        if (hi != null) { o.range = a + '–' + hi; n = hi; }
        o.perRound = o.perRound != null ? o.perRound : n;
        if (/^cal/.test(u)) o.unit = 'cal';
        else if (u === 'km') { o.unit = 'm'; o.perRound = n * 1000; }
        else if (/^(m|meter|mètre)/.test(u)) o.unit = 'm';
        else if (/^(sec|s$)/.test(u) || u === "''" || u === '’’') o.unit = 's';
        else if (/^(min|'|’)/.test(u)) { o.unit = 's'; o.perRound = n * 60; }
        body = m[5];
      } else if (fixedReps != null) {
        o.perRound = fixedReps;
      } else if (scheme && !o.max) {
        o.perRound = scheme; o.schemeApplied = true;
      }
      // « Row, 2000 m » ou « Ski Erg Calories »
      if (!o.resUnit && (m = body.match(/,\s*(\d+(?:[.,]\d+)?)\s*(m|km)\b/i)) && o.unit === 'reps') { o.unit = 'm'; o.perRound = num(m[1]) * (m[2].toLowerCase() === 'km' ? 1000 : 1); }
      if (/\bcalor(y|ie|ies)\b|\bcals?\b/i.test(body) && o.unit === 'reps') o.unit = 'cal';
      body = body.replace(/^(of|de)\s+/i, '');
      // Charge
      var ld = loadFrom(body, sex);
      if (ld != null && o.load == null) o.load = ld;
      var pct = body.match(/(\d+(?:[.,]\d+)?)\s*%\s*(?:du\s+|de\s+|of\s+)?(?:1\s*)?rm\s*([a-z&' ]{3,30})?/i);
      if (pct) { var rm = rmFor(pct[2] || body, reg); if (rm) { o.load = r05(rm.rm * num(pct[1]) / 100); o.pct = num(pct[1]); } }
      o.c = canon(body.replace(/@.*$/, '').replace(/\d+(?:[.,]\d+)?(?:\s*\/\s*\d+(?:[.,]\d+)?)?\s*(kg|lbs?|#)\b/gi, '').replace(/\d+(?:[.,]\d+)?\s*%.*$/, '').replace(/\balt\b/i, ' alt '));
      if (!o.c || !/[a-z]/.test(o.c)) return null;
      var mach = machineOf(o.c);
      if (mach && mach !== 'run' && o.unit === 'reps' && res != null && o.perRound != null) o.unit = 'cal';
      if (mach && (o.unit === 'cal' || o.unit === 'm')) o.machine = mach;
      if (mach === 'run' && o.unit === 'reps' && o.perRound >= 100) { o.unit = 'm'; o.machine = 'run'; }
      if (o.perRound == null && !o.max) o.perRound = o.unit === 'reps' ? null : null;
      return o;
    }

    lines.forEach(function (l) {
      if (!l) { return; }
      var m;
      // En-têtes de rounds
      if ((m = l.match(/every\s*(\d+(?:[.,]\d+)?)\s*(?:['’]|min\w*|:\d+)?\s*(?:x|×)\s*(\d+)(?:\s*-\s*(\d+))?\s*(?:rounds?|sets?|tours?)?/i))) {
        flushSection(); mult = num(m[3] || m[2]); everySec = true; if (m[3]) progression = { lo: num(m[2]), hi: num(m[3]) }; scheme = null; return;
      }
      if ((m = l.match(/every\s*(\d+(?:[.,]\d+)?)\s*(?:min\w*|['’])?\s*for\s*(\d+)\s*min/i))) {
        flushSection(); mult = Math.max(1, Math.round(num(m[2]) / num(m[1]))); alternating = /altern/i.test(l); everySec = true; scheme = null; return;
      }
      if ((m = l.match(/^(?:e?mom|otm)\s*(\d+)/i))) { flushSection(); mult = num(m[1]); alternating = /altern/i.test(l); return; }
      if ((m = l.match(/(\d+)\s*:\s*00\s*amrap|amrap\s*(\d+)/i))) { flushSection(); amrap = true; mult = 1; return; }
      if ((m = l.match(/^(\d+(?:\s*-\s*\d+){1,})\s*(?:reps?)?\s*(?:of|de|for time)?\s*:?\s*$/i)) || (m = l.match(/^(\d+(?:-\d+){2,})\b/))) {
        scheme = m[1].split('-').map(Number).reduce(function (a, b) { return a + b; }, 0); mult = 1; return;
      }
      if ((m = l.match(/^(\d+)\s*rounds?\s*of\s*(dumbbell |db )?(cindy|cindies|dts?|fran)\b(.*)$/i))) {
        var key = (/^c/i.test(m[3]) ? 'cindy' : /^f/i.test(m[3]) ? 'fran' : 'dt'); if (m[2] && key === 'dt') key = 'db dt';
        var ldb = loadFrom(m[4] || '', sex), nR = num(m[1]);
        var resB = (m[4] || '').match(/\|\s*(\d+)\s*reps?/i); if (resB) nR = num(resB[1]);
        BENCH_ROUND[key].forEach(function (x) { addMove({ raw: l, c: x[1], perRound: x[0] * nR, load: key === 'cindy' ? null : ldb, unit: 'reps', fixed: true }); });
        return;
      }
      if ((m = l.match(/^(?:x\s*)?(\d+)\s*(?:rounds?|rft|rounds? for time|tours?|sets?)\b/i)) || (m = l.match(/^(\d+)\s*rounds?,/i))) {
        flushSection(); mult = num(m[1]); scheme = null; return;
      }
      if ((m = l.match(/^interval\s*([ab])\b/i))) { flushSection(); curInterval = intervals ? m[1].toUpperCase() : null; return; }
      // % RM sur ligne séparée : s'applique au groupe en cours
      if (/%/.test(l) && /\brm\b/i.test(l) && /^\s*(\d+(?:[.,]\d+)?\s*%|commencer|start|@|à\s*\d)/i.test(l)) {
        var rm = rmFor(l, reg);
        var p = l.match(/(\d+)\s*%(?:\s*(?:to|à|-|et)\s*(\d+)\s*%)?/);
        var step = l.match(/augmenter de\s*(\d+(?:[.,]\d+)?)\s*%/i);
        if (rm && p) {
          var lo = num(p[1]), hi = p[2] ? num(p[2]) : null;
          if (step && ctx.scoreType === 'charge' && num(ctx.score)) {
            // Progression jusqu'au 1RM du jour : 75 %, 78 %, 81 %… jusqu'à la charge du score.
            var target = num(ctx.score), loads = [], pc = lo;
            while (loads.length < 15) { var kg = r05(rm.rm * pc / 100); if (kg >= target) { loads.push(target); break; } loads.push(kg); pc += num(step[1]); }
            sec.forEach(function (mv) { mv.mult = loads.length; mv.load = r05(loads.reduce(function (a, b) { return a + b; }, 0) / loads.length); mv.avgLoad = true; });
          } else {
            var avg = hi ? (lo + hi) / 2 : lo;
            sec.forEach(function (mv) { if (mv.load == null) { mv.load = r05(rm.rm * avg / 100); mv.pct = avg; } });
          }
        }
        return;
      }
      if (SKIP.test(l)) return;
      // « 4x [ 1 A + 1 B + 1 C ] | 70 kg »
      if ((m = l.match(/^(\d+)\s*x\s*\[\s*(.+?)\s*\](.*)$/i))) {
        var times = num(m[1]), tail = m[3] || '', fixed = /\|/.test(tail);
        m[2].split('+').forEach(function (part) {
          var o = lineToMove(part.trim() + tail, null);
          if (!o) return;
          o.perRound = (o.perRound || 1) * times;
          addMove(o);
        });
        return;
      }
      if (/^[a-z]/i.test(l) && !/\|/.test(l) && !/\d/.test(l.slice(0, 3)) && !scheme && !/^max\b/i.test(l) && !/,\s*\d+(?:[.,]\d+)?\s*(m|km)\b|calor/i.test(l)) {
        // ligne de texte sans chiffre (consigne) : ignorée sauf mouvement nu dans un WOD nommé
        if (l.split(' ').length > 6 || /[.!?]$/.test(l)) return;
        var bare = lineToMove(l, null);
        if (bare) { bare.unknown = true; addMove(bare); }
        return;
      }
      var o = lineToMove(l, null);
      if (o) addMove(o);
    });
    flushSection();

    // AMRAP : rounds complets × reps + reps en plus, dans l'ordre.
    if (amrap && ctx.scoreType === 'rounds_reps' && num(ctx.score) != null) {
      var rounds = Math.floor(num(ctx.score)), extra = Math.round((num(ctx.score) - rounds) * 1000);
      out.forEach(function (mv) {
        var pr = mv.perRound || 0, add = Math.min(extra, pr); extra -= add;
        mv.mult = 1; mv.perRound = pr * rounds + add;
      });
    }
    // Lignes avec résultat (« | 20 reps ») : les lignes sans résultat n'ont pas été faites.
    var logged = out.some(function (mv) { return mv.fixed && mv.raw && /\|/.test(mv.raw); });
    if (logged) out = out.filter(function (mv) { return mv.fixed || mv.max; });
    // Max : reps reprises du score si le bloc se score en reps (moins les reps déjà comptées ailleurs).
    var maxes = out.filter(function (mv) { return mv.max && mv.perRound == null; });
    if (maxes.length === 1 && ctx.scoreType === 'reps' && num(ctx.score) != null) {
      var others = logged ? out.reduce(function (a, mv) { return a + (mv !== maxes[0] && mv.perRound ? mv.perRound * mv.mult : 0); }, 0) : 0;
      maxes[0].perRound = Math.max(0, num(ctx.score) - others); maxes[0].mult = 1; maxes[0].fromScore = true;
    }

    var res = [];
    out.forEach(function (mv, i) {
      var reps = mv.perRound != null ? Math.round(mv.perRound * mv.mult) : null;
      var nb = defaultDb(mv.c, mv.perSide);
      res.push({
        ordre: i + 1, key: mv.c, name: display(mv.c), reps: reps, load: mv.load, nbDb: nb, unit: mv.unit, machine: mv.machine || null,
        range: mv.range, max: mv.max && !mv.fromScore, avgLoad: !!mv.avgLoad, pct: mv.pct || null, perSide: mv.perSide, raw: mv.raw,
        hint: mv.range ? 'fourchette ' + mv.range + ' par round' : mv.max && !mv.fromScore ? 'max : reps à saisir' : mv.fromScore ? 'repris du score' : mv.perSide ? mv.raw.match(/^\d+\s*\/\s*\d+/)[0].replace(/\s/g, '') + ' = par côté' : mv.avgLoad ? 'charge moyenne de la progression' : mv.pct ? mv.pct + ' % RM' : ''
      });
    });
    // Fusionne les doublons (même mouvement, même charge, même unité).
    var merged = [];
    res.forEach(function (m) {
      var d = merged.find(function (x) { return x.key === m.key && x.unit === m.unit && x.load === m.load && x.nbDb === m.nbDb && !x.range && !m.range && !x.max && !m.max; });
      if (d && d.reps != null && m.reps != null) d.reps += m.reps; else merged.push(m);
    });
    merged.forEach(function (m, i) { m.ordre = i + 1; });
    return merged;
  }

  // Tonnage d'un mouvement : reps × charge × nombre d'haltères.
  function kgOf(m) {
    if (m.unit !== 'reps' || !m.reps || !m.load) return 0;
    return m.reps * m.load * (m.nbDb || 1);
  }

  var api = { parse: parse, canon: canon, display: display, kgOf: kgOf, rmFor: rmFor, machineOf: machineOf, defaultDb: defaultDb };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.KaizenMoves = api;
})(this);
