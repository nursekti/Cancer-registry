// Writes edits from the patient detail page back into the Google Sheet via
// the Apps Script web app in /apps-script. Disabled (edits stay in the
// browser only) when NEXT_PUBLIC_SHEETS_WRITE_URL isn't set at build time.

import { cacheCsv, readCsvCache } from "@/lib/csvCache";
import { parseGid, parseSpreadsheetId } from "@/lib/fetchImtFormulas";
import { RowOverride, StoredOverride, rowKey } from "@/lib/rowOverrides";
import { SheetUpdate, readField, setField } from "@/lib/sheetColumns";

export { sheetUpdatesFor } from "@/lib/sheetColumns";
export type { SheetUpdate } from "@/lib/sheetColumns";

type Row = Record<string, string>;

const WRITE_URL = process.env.NEXT_PUBLIC_SHEETS_WRITE_URL ?? "";

export const sheetWriteEnabled = Boolean(WRITE_URL);

// The sheet-seeded base after `written` landed in the sheet: those fields now
// come from the sheet, so they no longer count as local edits.
export function applySheetUpdates(
  base: RowOverride,
  changes: StoredOverride,
  written: SheetUpdate[],
): RowOverride {
  const next = structuredClone(base);
  for (const { ref } of written) setField(next, ref, readField(changes, ref));
  return next;
}

// Same precedence as rowKey: the sheet row is found by NO ERM, else NIK,
// else NAMA.
function matchFor(row: Row): { header: string; value: string } {
  for (const header of ["NO ERM", "NIK", "NAMA"]) {
    const value = row[header]?.trim();
    if (value) return { header, value };
  }
  throw new Error("Baris tidak punya NO ERM, NIK, atau NAMA");
}

// Keeps the cached CSV in step with what was just written, so the list and
// detail pages show it without re-fetching the sheet.
function patchCachedRow(csvUrl: string, row: Row, written: SheetUpdate[]): void {
  const cached = readCsvCache(csvUrl);
  if (!cached) return;
  const key = rowKey(row);
  const patch = Object.fromEntries(written.map((u) => [u.header, u.value]));
  cacheCsv(
    csvUrl,
    cached.headers,
    cached.rows.map((r) => (rowKey(r) === key ? { ...r, ...patch } : r)),
  );
}

type WriteResponse =
  | { ok: true; written: string[]; skipped: Array<{ header: string; reason: string }> }
  | { ok: false; error: string };

export async function writeRowToSheet(
  csvUrl: string,
  row: Row,
  updates: SheetUpdate[],
): Promise<{ written: SheetUpdate[]; skipped: string[] }> {
  const spreadsheetId = parseSpreadsheetId(csvUrl);
  if (!spreadsheetId) throw new Error("URL spreadsheet tidak valid");

  // text/plain keeps this a "simple" request — Apps Script can't answer a
  // CORS preflight.
  const res = await fetch(WRITE_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({
      spreadsheetId,
      gid: parseGid(csvUrl) || "0",
      match: matchFor(row),
      updates: Object.fromEntries(updates.map((u) => [u.header, u.value])),
    }),
  });
  if (!res.ok) throw new Error(`Gagal menghubungi spreadsheet (${res.status})`);
  const data = (await res.json()) as WriteResponse;
  if (!data.ok) throw new Error(data.error);

  const writtenHeaders = new Set(data.written);
  const written = updates.filter((u) => writtenHeaders.has(u.header));
  patchCachedRow(csvUrl, row, written);
  return {
    written,
    skipped: data.skipped.map((s) => `${s.header} (${s.reason})`),
  };
}
