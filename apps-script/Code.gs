// Receives edits from the cancer-registry web app and writes them into this
// spreadsheet. Setup steps are in README.md next to this file.
//
// Write a patient's row — POST body (sent as text/plain to avoid a CORS
// preflight):
//   {
//     spreadsheetId: "...",           // must be this spreadsheet
//     gid: "188215245",               // which tab
//     match: { header: "NO ERM", value: "123456" },  // identifies the row
//     updates: { "STADIUM": "IV", ... }               // header -> new value
//   }
// Response: { ok: true, written: [header], skipped: [{ header, reason }] }
//
// Read a tab's dropdowns:
//   GET ?action=dropdowns&spreadsheetId=...&gid=...
// Response: { ok: true, dropdowns: { header: [option] } }
//
// Add a label to a column's dropdown:
//   POST { action: "addOption", spreadsheetId, gid, header, option }
// Response: { ok: true, options: [option] }
//
// Any failure: { ok: false, error: "..." }

const HEADER_ROW = 1;

function doGet(e) {
  const params = (e && e.parameter) || {};
  try {
    if (params.action === "dropdowns") {
      const ss = checkSpreadsheet_(params.spreadsheetId);
      return json_({ ok: true, dropdowns: dropdowns_(ss, sheetByGid_(ss, params.gid)) });
    }
    return json_({ ok: true, service: "cancer-registry-writeback" });
  } catch (err) {
    return json_({ ok: false, error: String((err && err.message) || err) });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    return json_(body.action === "addOption" ? addOption_(body) : handle_(body));
  } catch (err) {
    return json_({ ok: false, error: String((err && err.message) || err) });
  }
}

function checkSpreadsheet_(spreadsheetId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (spreadsheetId !== ss.getId()) {
    throw new Error("Spreadsheet tidak cocok dengan script ini");
  }
  return ss;
}

function sheetByGid_(ss, gid) {
  const sheet = ss.getSheets().find((s) => String(s.getSheetId()) === String(gid));
  if (!sheet) throw new Error("Tab sheet tidak ditemukan (gid " + gid + ")");
  return sheet;
}

function headerRow_(sheet) {
  return sheet.getRange(HEADER_ROW, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
}

function handle_(body) {
  const ss = checkSpreadsheet_(body.spreadsheetId);
  const sheet = sheetByGid_(ss, body.gid);

  const lock = LockService.getDocumentLock();
  lock.waitLock(10000);
  try {
    const lastRow = sheet.getLastRow();
    const headers = headerRow_(sheet).map((h) => normalizeHeader_(h));
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

// --- Dropdowns -------------------------------------------------------------
// A column's dropdown is either a typed column of a Table (Table1 in DATA NHL)
// or a plain "dropdown from a list" data validation (DATA HL). Tables are only
// reachable through the Sheets REST API, so those calls go through UrlFetchApp.

function sheetsApi_(method, path, payload) {
  const options = {
    method: method,
    headers: { Authorization: "Bearer " + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true,
  };
  if (payload) {
    options.contentType = "application/json";
    options.payload = JSON.stringify(payload);
  }
  const res = UrlFetchApp.fetch("https://sheets.googleapis.com/v4/spreadsheets/" + path, options);
  const body = JSON.parse(res.getContentText() || "{}");
  if (res.getResponseCode() >= 300) {
    throw new Error("Sheets API: " + ((body.error && body.error.message) || res.getResponseCode()));
  }
  return body;
}

function tables_(ss, sheet) {
  const res = sheetsApi_(
    "get",
    ss.getId() + "?fields=sheets(properties.sheetId,tables(tableId,range,columnProperties))",
  );
  const s = (res.sheets || []).find((x) => x.properties.sheetId === sheet.getSheetId());
  return (s && s.tables) || [];
}

// The table column property covering sheet column `col` (0-based), if any.
function tableColumn_(tables, col) {
  for (const t of tables) {
    const start = t.range.startColumnIndex || 0;
    if (col < start || col >= t.range.endColumnIndex) continue;
    const cp = (t.columnProperties || []).find((c) => (c.columnIndex || 0) === col - start);
    return { table: t, column: cp };
  }
  return null;
}

function listCondition_(columnProperty) {
  const cond =
    columnProperty && columnProperty.dataValidationRule && columnProperty.dataValidationRule.condition;
  return cond && cond.type === "ONE_OF_LIST" ? cond : null;
}

function isListRule_(rule) {
  return rule && rule.getCriteriaType() === SpreadsheetApp.DataValidationCriteria.VALUE_IN_LIST;
}

function dropdowns_(ss, sheet) {
  const headers = headerRow_(sheet);
  const out = {};
  const firstRow = sheet.getRange(HEADER_ROW + 1, 1, 1, headers.length).getDataValidations()[0];
  firstRow.forEach((rule, i) => {
    if (isListRule_(rule)) out[headers[i]] = rule.getCriteriaValues()[0].map(String);
  });
  const tables = tables_(ss, sheet);
  headers.forEach((h, i) => {
    const hit = tableColumn_(tables, i);
    const cond = hit && listCondition_(hit.column);
    if (cond) out[h] = (cond.values || []).map((v) => v.userEnteredValue);
  });
  return out;
}

function hasOption_(options, option) {
  const target = option.trim().toLowerCase();
  return options.some((o) => String(o).trim().toLowerCase() === target);
}

function addOption_(body) {
  const ss = checkSpreadsheet_(body.spreadsheetId);
  const sheet = sheetByGid_(ss, body.gid);
  const option = String(body.option || "").trim();
  if (!option) throw new Error("Label tidak boleh kosong");

  const lock = LockService.getDocumentLock();
  lock.waitLock(10000);
  try {
    const col = headerRow_(sheet)
      .map((h) => normalizeHeader_(h))
      .indexOf(normalizeHeader_(body.header));
    if (col < 0) throw new Error("Kolom " + body.header + " tidak ditemukan");

    const hit = tableColumn_(tables_(ss, sheet), col);
    if (hit) {
      const cond = listCondition_(hit.column);
      if (!cond) throw new Error("Kolom ini tidak punya dropdown di spreadsheet");
      const current = (cond.values || []).map((v) => v.userEnteredValue);
      if (!hasOption_(current, option)) {
        cond.values = (cond.values || []).concat([{ userEnteredValue: option }]);
        sheetsApi_("post", ss.getId() + ":batchUpdate", {
          requests: [
            {
              updateTable: {
                table: { tableId: hit.table.tableId, columnProperties: hit.table.columnProperties },
                fields: "columnProperties",
              },
            },
          ],
        });
      }
      return { ok: true, options: cond.values.map((v) => v.userEnteredValue) };
    }

    const range = sheet.getRange(HEADER_ROW + 1, col + 1, sheet.getMaxRows() - HEADER_ROW, 1);
    const rules = range.getDataValidations();
    const first = rules.map((r) => r[0]).find(isListRule_);
    if (!first) throw new Error("Kolom ini tidak punya dropdown di spreadsheet");
    const criteria = first.getCriteriaValues();
    const current = criteria[0].map(String);
    if (hasOption_(current, option)) return { ok: true, options: current };

    // Extend the list on every cell that already had a dropdown, keeping each
    // rule's other settings (show-dropdown, reject vs warn, help text).
    const next = current.concat([option]);
    range.setDataValidations(
      rules.map((r) => [
        isListRule_(r[0]) ? r[0].copy().requireValueInList(next, criteria[1]).build() : r[0],
      ]),
    );
    return { ok: true, options: next };
  } finally {
    lock.releaseLock();
  }
}

// CSV export trims cell text and may render line breaks differently, so the
// web app's header names can differ from the sheet's in whitespace or case.
function normalizeHeader_(h) {
  return String(h).replace(/\s+/g, " ").trim().toLowerCase();
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
