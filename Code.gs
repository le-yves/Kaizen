/**
 * Kaizen v2 — passerelle entre l'app et le Google Sheet.
 * À coller dans Extensions > Apps Script du Google Sheet "Kaizen".
 *
 * 1. Exécuter une fois la fonction creerCodeSecret() : le code s'affiche dans le journal d'exécution.
 * 2. Déployer > Nouveau déploiement > Application Web
 *    - Exécuter en tant que : Moi
 *    - Qui a accès : Tout le monde
 * 3. Copier l'URL de l'application Web et le code secret dans l'onglet "Moi" de Kaizen.
 */

var SHEETS = {
  Seances: { key: 'id' },
  Strava: { key: 'id' },
  Classements: { key: null },
  Reglages: { key: 'cle' },
  Mouvements: { key: null, optional: true },
  Athletes: { key: 'nom', optional: true }
};

// En-têtes créés automatiquement si un onglet v2 manque.
var HEADERS = {
  Mouvements: ['bloc_id', 'ordre', 'mouvement', 'reps', 'charge_kg', 'nb_db', 'unite', 'charge_prog'],
  Athletes: ['nom', 'sexe']
};

// Colonnes à garder en texte brut (sinon Sheets transforme "7:09" en heure ou "2026-11-09" en date).
var TEXT_COLS = ['id', 'date_prog', 'date_faite', 'date', 'heure', 'source', 'statut', 'nom', 'type_bloc',
  'description', 'type_score', 'score_affiche', 'niveau', 'charges', 'km_detail', 'cal_detail', 'notes',
  'sport', 'fichier', 'bloc_id', 'rx', 'moi', 'cle', 'mouvement', 'unite', 'sexe', 'valeur'];

function creerCodeSecret() {
  var token = Utilities.getUuid().replace(/-/g, '').slice(0, 24);
  PropertiesService.getScriptProperties().setProperty('KAIZEN_TOKEN', token);
  Logger.log('Ton code secret Kaizen : ' + token);
  return token;
}

function checkToken_(token) {
  var expected = PropertiesService.getScriptProperties().getProperty('KAIZEN_TOKEN');
  if (!expected) throw new Error('Code secret absent : exécute creerCodeSecret() une fois.');
  if (token !== expected) throw new Error('Code secret incorrect.');
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function sheet_(name) {
  if (!SHEETS[name]) throw new Error('Onglet inconnu : ' + name);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (!sh && HEADERS[name]) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, HEADERS[name].length).setValues([HEADERS[name]]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  if (!sh) throw new Error('Onglet introuvable dans le Sheet : ' + name);
  return sh;
}

function headers_(sh) {
  return sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
}

// Ajoute une colonne d'en-tête si elle manque (ex. "nom" dans Classements).
function ensureCol_(sh, col) {
  var h = headers_(sh);
  if (h.indexOf(col) >= 0) return h;
  sh.getRange(1, h.length + 1).setValue(col).setFontWeight('bold');
  return headers_(sh);
}

function readOptional_(name) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  return sh ? readSheet_(name) : [];
}

function cellOut_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return v;
}

function readSheet_(name) {
  var sh = sheet_(name);
  var last = sh.getLastRow();
  if (last < 2) return [];
  var h = headers_(sh);
  var values = sh.getRange(2, 1, last - 1, h.length).getValues();
  return values.map(function (row) {
    var o = {};
    for (var i = 0; i < h.length; i++) if (h[i]) o[h[i]] = cellOut_(row[i]);
    return o;
  });
}

function rowArray_(h, obj, existing) {
  return h.map(function (col, i) {
    if (obj.hasOwnProperty(col)) return obj[col] === null || obj[col] === undefined ? '' : obj[col];
    return existing ? existing[i] : '';
  });
}

function writeRow_(sh, rowIndex, h, values) {
  var range = sh.getRange(rowIndex, 1, 1, h.length);
  var formats = h.map(function (col) { return TEXT_COLS.indexOf(col) >= 0 ? '@' : 'General'; });
  range.setNumberFormats([formats]);
  range.setValues([values]);
}

function upsert_(name, obj) {
  var keyCol = SHEETS[name].key;
  var sh = sheet_(name);
  var h = headers_(sh);
  var k = h.indexOf(keyCol);
  if (k < 0 || !obj[keyCol]) throw new Error('Identifiant manquant pour ' + name);
  var last = sh.getLastRow();
  if (last >= 2) {
    var keys = sh.getRange(2, k + 1, last - 1, 1).getValues();
    for (var i = 0; i < keys.length; i++) {
      if (String(keys[i][0]) === String(obj[keyCol])) {
        var existing = sh.getRange(i + 2, 1, 1, h.length).getValues()[0];
        writeRow_(sh, i + 2, h, rowArray_(h, obj, existing));
        return { updated: obj[keyCol] };
      }
    }
  }
  writeRow_(sh, last + 1, h, rowArray_(h, obj, null));
  return { created: obj[keyCol] };
}

function remove_(name, id) {
  var keyCol = SHEETS[name].key;
  var sh = sheet_(name);
  var h = headers_(sh);
  var k = h.indexOf(keyCol);
  var last = sh.getLastRow();
  if (last < 2) return { deleted: 0 };
  var keys = sh.getRange(2, k + 1, last - 1, 1).getValues();
  for (var i = keys.length - 1; i >= 0; i--) {
    if (String(keys[i][0]) === String(id)) { sh.deleteRow(i + 2); return { deleted: id }; }
  }
  return { deleted: 0 };
}

// Remplace toutes les lignes d'un bloc dans un onglet sans clé unique (Classements, Mouvements).
function replaceRows_(name, blocId, rows) {
  var sh = sheet_(name);
  var h = name === 'Classements' ? ensureCol_(sh, 'nom') : headers_(sh);
  var k = h.indexOf('bloc_id');
  var last = sh.getLastRow();
  if (last >= 2) {
    var keys = sh.getRange(2, k + 1, last - 1, 1).getValues();
    for (var i = keys.length - 1; i >= 0; i--) if (String(keys[i][0]) === String(blocId)) sh.deleteRow(i + 2);
  }
  (rows || []).forEach(function (r) {
    r.bloc_id = blocId;
    writeRow_(sh, sh.getLastRow() + 1, h, rowArray_(h, r, null));
  });
  return { bloc_id: blocId, rows: (rows || []).length };
}

function replaceClassement_(blocId, rows) { return replaceRows_('Classements', blocId, rows); }

function doGet(e) {
  try {
    checkToken_(e.parameter.token);
    var data = {
      seances: readSheet_('Seances'),
      strava: readSheet_('Strava'),
      classements: readSheet_('Classements'),
      mouvements: readOptional_('Mouvements'),
      athletes: readOptional_('Athletes'),
      reglages: {}
    };
    readSheet_('Reglages').forEach(function (r) { if (r.cle) data.reglages[r.cle] = r.valeur; });
    data.lu_le = new Date().toISOString();
    data.version_passerelle = 2;
    return json_({ ok: true, data: data });
  } catch (err) {
    return json_({ ok: false, erreur: String(err.message || err) });
  }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    var body = JSON.parse(e.postData.contents);
    checkToken_(body.token);
    lock.waitLock(20000);
    var result;
    switch (body.action) {
      case 'upsert': result = upsert_(body.sheet, body.row); break;
      case 'delete': result = remove_(body.sheet, body.id); break;
      case 'classement': result = replaceClassement_(body.bloc_id, body.rows); break;
      case 'reglage': result = upsert_('Reglages', { cle: body.cle, valeur: body.valeur }); break;
      case 'mouvements': result = replaceRows_('Mouvements', body.bloc_id, body.rows); break;
      case 'athlete': result = upsert_('Athletes', { nom: body.nom, sexe: body.sexe }); break;
      default: throw new Error('Action inconnue : ' + body.action);
    }
    return json_({ ok: true, result: result });
  } catch (err) {
    return json_({ ok: false, erreur: String(err.message || err) });
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}
