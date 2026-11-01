// Receives edits from the cancer-registry web app and writes them into this
// spreadsheet. Setup steps are in README.md next to this file.
//
// Request body (sent as text/plain to avoid a CORS preflight):
//   {
//     spreadsheetId: "...",           // must be this spreadsheet
//     gid: "188215245",               // which tab
//     match: { header: "NO ERM", value: "123456" },  // identifies the row
//     updates: { "STADIUM": "IV", ... }               // header -> new value
//   }
// Response: { ok: true, written: [header], skipped: [{ header, reason }] }
//        or { ok: false, error: "..." }

const HEADER_ROW = 1;

function doGet() {
  return json_({ ok: true, service: "cancer-registry-writeback" });
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    return json_(handle_(body));
  } catch (err) {
    return json_({ ok: false, error: String((err && err.message) || err) });
  }
}

function handle_(body) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (body.spreadsheetId !== ss.getId()) {
    throw new Error("Spreadsheet tidak cocok dengan script ini");
  }
  const sheet = ss.getSheets().find((s) => String(s.getSheetId()) === String(body.gid));
  if (!sheet) throw new Error("Tab sheet tidak ditemukan (gid " + body.gid + ")");

  const lock = LockService.getDocumentLock();
  lock.waitLock(10000);
  try {
    const lastCol = sheet.getLastColumn();
    const lastRow = sheet.getLastRow();
    const headers = sheet
      .getRange(HEADER_ROW, 1, 1, lastCol)
      .getDisplayValues()[0]
      .map((h) => normalizeHeader_(h));
    const colOf = (name) => headers.indexOf(normalizeHeader_(name)) + 1;

    const matchCol = colOf(body.match.header);
    if (!matchCol) throw new Error("Kolom " + body.match.header + " tidak ditemukan");
    if (lastRow <= HEADER_ROW) throw new Error("Sheet tidak punya baris data");

    const target = String(body.match.value).trim();
    const keys = sheet
      .getRange(HEADER_ROW + 1, matchCol, lastRow - HEADER_ROW, 1)
      .getDisplayValues();
    const hits = [];
    keys.forEach((r, i) => {
      if (r[0].trim() === target) hits.push(HEADER_ROW + 1 + i);
    });
    if (!hits.length) throw new Error("Baris pasien tidak ditemukan di spreadsheet");
    if (hits.length > 1) {
      throw new Error("Ada " + hits.length + " baris dengan " + body.match.header + " yang sama");
    }
    const rowNum = hits[0];

    const written = [];
    const skipped = [];
    Object.keys(body.updates || {}).forEach((header) => {
      const col = colOf(header);
      if (!col) {
        skipped.push({ header: header, reason: "kolom tidak ditemukan" });
        return;
      }
      const cell = sheet.getRange(rowNum, col);
      // Never overwrite computed columns (IMT, NLR, ...).
      if (cell.getFormula()) {
        skipped.push({ header: header, reason: "kolom berisi formula" });
        return;
      }
      cell.setValue(toCellValue_(body.updates[header]));
      written.push(header);
    });
    SpreadsheetApp.flush();
    return { ok: true, written: written, skipped: skipped };
  } finally {
    lock.releaseLock();
  }
}

// CSV export trims cell text, so the web app's header names may differ from
// the sheet's only in surrounding whitespace or case.
function normalizeHeader_(h) {
  return String(h).trim().toLowerCase();
}

// Long digit strings (NIK, no HP) would otherwise be turned into numbers,
// losing leading zeros or precision — force them to stay text.
function toCellValue_(v) {
  const s = v == null ? "" : String(v);
  return /^\d+$/.test(s) && (s.charAt(0) === "0" || s.length > 10) ? "'" + s : s;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON,
  );
}
