/**
 * Nøtteknekker-samlingen – Google Apps Script backend
 *
 * Setup:
 *  1. Create a blank Google Sheet.
 *  2. Extensions → Apps Script, paste this file, change ADMIN_PASSWORD.
 *  3. Run `setup` once (authorize when asked).
 *  4. Deploy → New deployment → Web app
 *       Execute as: Me
 *       Who has access: Anyone
 *  5. Copy the Web app URL into API_URL in index.html.
 *
 * After code changes: Deploy → Manage deployments → Edit → Version: New version.
 */

const ADMIN_PASSWORD = 'bytt-meg';   // <-- CHANGE THIS

const SHEET_ITEMS = 'Samling';
const SHEET_GIFTS = 'Gaver';
const ITEM_HEADERS = ['id', 'name', 'details', 'height', 'maker', 'origin', 'photo', 'added'];
const GIFT_HEADERS = ['id', 'name', 'details', 'height', 'shop', 'buyer', 'occasion', 'photo', 'added', 'token'];

const MAX_TEXT = 500;
const MAX_PHOTO = 48000; // a cell holds max 50 000 characters

function setup() {
  sheet_(SHEET_ITEMS, ITEM_HEADERS);
  sheet_(SHEET_GIFTS, GIFT_HEADERS);
}

// ---------- HTTP ----------

function doGet() {
  const items = readAll_(SHEET_ITEMS, ITEM_HEADERS);
  const gifts = readAll_(SHEET_GIFTS, GIFT_HEADERS).map(g => { delete g.token; return g; });
  return json_({ ok: true, items: items, gifts: gifts });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const req = JSON.parse(e.postData.contents || '{}');
    const isAdmin = req.password === ADMIN_PASSWORD;
    const needAdmin = () => { if (!isAdmin) throw new Error('Feil passord'); };

    switch (req.action) {
      case 'checkPassword':
        return json_({ ok: isAdmin, error: isAdmin ? '' : 'Feil passord' });

      case 'addGift': {
        const g = clean_(req.gift, GIFT_HEADERS);
        if (!g.name) throw new Error('Mangler navn/beskrivelse på nøtteknekkeren');
        if (!g.buyer) throw new Error('Skriv inn navnet ditt');
        g.id = Utilities.getUuid();
        g.token = Utilities.getUuid();
        g.added = new Date().toISOString();
        append_(SHEET_GIFTS, GIFT_HEADERS, g);
        return json_({ ok: true, id: g.id, token: g.token });
      }

      case 'deleteGift': {
        const sh = sheet_(SHEET_GIFTS, GIFT_HEADERS);
        const row = findRow_(sh, req.id);
        if (!row) throw new Error('Fant ikke registreringen');
        const token = sh.getRange(row, GIFT_HEADERS.indexOf('token') + 1).getValue();
        if (!isAdmin && (!req.token || req.token !== token)) throw new Error('Ikke tilgang');
        sh.deleteRow(row);
        return json_({ ok: true });
      }

      case 'saveItem': {
        needAdmin();
        const it = clean_(req.item, ITEM_HEADERS);
        if (!it.name) throw new Error('Mangler navn');
        const sh = sheet_(SHEET_ITEMS, ITEM_HEADERS);
        const row = it.id ? findRow_(sh, it.id) : 0;
        if (row) {
          const old = rowObj_(sh, row, ITEM_HEADERS);
          it.added = old.added;
          if (req.keepPhoto) it.photo = old.photo;
          sh.getRange(row, 1, 1, ITEM_HEADERS.length).setValues([ITEM_HEADERS.map(h => safe_(it[h]))]);
        } else {
          it.id = Utilities.getUuid();
          it.added = new Date().toISOString();
          append_(SHEET_ITEMS, ITEM_HEADERS, it);
        }
        return json_({ ok: true, id: it.id });
      }

      case 'deleteItem': {
        needAdmin();
        const sh = sheet_(SHEET_ITEMS, ITEM_HEADERS);
        const row = findRow_(sh, req.id);
        if (row) sh.deleteRow(row);
        return json_({ ok: true });
      }

      case 'receiveGift': {
        // Gift has arrived: move it into the collection
        needAdmin();
        const gs = sheet_(SHEET_GIFTS, GIFT_HEADERS);
        const row = findRow_(gs, req.id);
        if (!row) throw new Error('Fant ikke gaven');
        const g = rowObj_(gs, row, GIFT_HEADERS);
        const origin = 'Gave fra ' + g.buyer + (g.occasion ? ' (' + g.occasion + ')' : '');
        append_(SHEET_ITEMS, ITEM_HEADERS, {
          id: Utilities.getUuid(), name: g.name, details: g.details, height: g.height,
          maker: g.shop ? 'Kjøpt hos ' + g.shop : '', origin: origin, photo: g.photo,
          added: new Date().toISOString()
        });
        gs.deleteRow(row);
        return json_({ ok: true });
      }

      default:
        throw new Error('Ukjent handling');
    }
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  } finally {
    lock.releaseLock();
  }
}

// ---------- helpers ----------

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function sheet_(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.appendRow(headers);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  }
  return sh;
}

function readAll_(name, headers) {
  const sh = sheet_(name, headers);
  const last = sh.getLastRow();
  if (last < 2) return [];
  const values = sh.getRange(2, 1, last - 1, headers.length).getValues();
  return values.filter(r => r[0] !== '').map(r => {
    const o = {};
    headers.forEach((h, i) => o[h] = r[i] instanceof Date ? r[i].toISOString() : String(r[i]));
    return o;
  });
}

function rowObj_(sh, row, headers) {
  const r = sh.getRange(row, 1, 1, headers.length).getValues()[0];
  const o = {};
  headers.forEach((h, i) => o[h] = String(r[i]));
  return o;
}

function findRow_(sh, id) {
  if (!id) return 0;
  const last = sh.getLastRow();
  if (last < 2) return 0;
  const ids = sh.getRange(2, 1, last - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(id)) return i + 2;
  return 0;
}

function append_(name, headers, obj) {
  sheet_(name, headers).appendRow(headers.map(h => safe_(obj[h])));
}

// Trim input, cap lengths, validate photo
function clean_(src, headers) {
  src = src || {};
  const o = {};
  headers.forEach(h => {
    let v = src[h] == null ? '' : String(src[h]).trim();
    if (h === 'photo') {
      if (v && (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v) || v.length > MAX_PHOTO)) v = '';
    } else {
      v = v.slice(0, MAX_TEXT);
    }
    o[h] = v;
  });
  return o;
}

// Stop Sheets from treating user text as a formula
function safe_(v) {
  v = v == null ? '' : String(v);
  return /^[=+\-@]/.test(v) ? "'" + v : v;
}
