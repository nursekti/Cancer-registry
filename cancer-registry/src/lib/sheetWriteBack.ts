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

function sheetTarget(csvUrl: string): { spreadsheetId: string; gid: string } {
  const spreadsheetId = parseSpreadsheetId(csvUrl);
  if (!spreadsheetId) throw new Error("URL spreadsheet tidak valid");
  return { spreadsheetId, gid: parseGid(csvUrl) || "0" };
}

async function callScript<T>(init?: RequestInit, query?: Record<string, string>): Promise<T> {
  const url = query ? `${WRITE_URL}?${new URLSearchParams(query)}` : WRITE_URL;
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`Gagal menghubungi spreadsheet (${res.status})`);
  const data = (await res.json()) as ({ ok: true } & T) | { ok: false; error: string };
  if (!data.ok) throw new Error(data.error);
  return data;
}

// Header names can differ between the CSV export and the sheet itself in
// whitespace (line breaks) or case.
export function normalizeHeader(h: string): string {
  return h.replace(/\s+/g, " ").trim().toLowerCase();
}

// Every column of this tab that has a dropdown in the sheet, keyed by
// normalized header.
export async function fetchSheetDropdowns(csvUrl: string): Promise<Record<string, string[]>> {
  const { dropdowns } = await callScript<{ dropdowns: Record<string, string[]> }>(undefined, {
    action: "dropdowns",
    ...sheetTarget(csvUrl),
  });
  return Object.fromEntries(Object.entries(dropdowns).map(([h, o]) => [normalizeHeader(h), o]));
}

// Adds a label to a column's dropdown in the sheet; returns the new options.
export async function addSheetDropdownOption(
  csvUrl: string,
  header: string,
  option: string,
): Promise<string[]> {
  const { options } = await callScript<{ options: string[] }>({
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action: "addOption", ...sheetTarget(csvUrl), header, option }),
  });
  return options;
}

type WriteResponse = {
  written: string[];
  skipped: Array<{ header: string; reason: string }>;
};

export async function writeRowToSheet(
  csvUrl: string,
  row: Row,
  updates: SheetUpdate[],
): Promise<{ written: SheetUpdate[]; skipped: string[] }> {
  // text/plain keeps this a "simple" request — Apps Script can't answer a
  // CORS preflight.
  const data = await callScript<WriteResponse>({
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({
      ...sheetTarget(csvUrl),
      match: matchFor(row),
      updates: Object.fromEntries(updates.map((u) => [u.header, u.value])),
    }),
  });

  const writtenHeaders = new Set(data.written);
  const written = updates.filter((u) => writtenHeaders.has(u.header));
  patchCachedRow(csvUrl, row, written);
  return {
    written,
    skipped: data.skipped.map((s) => `${s.header} (${s.reason})`),
  };
}
