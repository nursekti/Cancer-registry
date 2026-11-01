// Writes edits from the patient detail page back into the Google Sheet via
// the Apps Script web app in /apps-script. Disabled (edits stay in the
// browser only) when NEXT_PUBLIC_SHEETS_WRITE_URL isn't set at build time.

import { cacheCsv, readCsvCache } from "@/lib/csvCache";
import { parseGid, parseSpreadsheetId } from "@/lib/fetchImtFormulas";
import {
  RECORD_STATUS_META,
  RecordStatus,
  RowOverride,
  StoredOverride,
  mergeOverride,
  rowKey,
} from "@/lib/rowOverrides";

type Row = Record<string, string>;

const WRITE_URL = process.env.NEXT_PUBLIC_SHEETS_WRITE_URL ?? "";

export const sheetWriteEnabled = Boolean(WRITE_URL);

type Section = "identity" | "diagnosis" | "riwayat" | "outcome";

type FieldRef =
  | { section: Section; field: string }
  | { section: null; field: "status" | "bb" | "tb" };

type FindHeader = (headers: string[]) => string | undefined;

const contains =
  (needle: string): FindHeader =>
  (headers) =>
    headers.find((h) => h.toLowerCase().includes(needle));

const exact =
  (needle: string): FindHeader =>
  (headers) =>
    headers.find((h) => h.trim().toLowerCase() === needle);

function col(section: Section, field: string, header: FindHeader) {
  return { ref: { section, field } as FieldRef, header };
}

// Mirrors the header lookups in buildInitialOverride (PatientDetailView), so
// each field is written back to the same column it was read from.
// Pemeriksaan penunjang and Siklus kemoterapi aren't here: the sheet has a
// single set of columns for what the app models as lists, so they stay in
// the browser.
const SHEET_COLUMNS: Array<{ ref: FieldRef; header: FindHeader }> = [
  col("identity", "nama", exact("nama")),
  col("identity", "noErm", exact("no erm")),
  col("identity", "tahun", contains("tahun")),
  col("identity", "jk", (h) => contains("jenis kelamin")(h) ?? contains("jk")(h)),
  col("identity", "usia", contains("usia")),
  col("identity", "pendidikan", contains("pendidikan")),
  col("identity", "pekerjaan", contains("pekerjaan")),
  col("identity", "noHp", contains("no hp")),
  col("identity", "nik", contains("nik")),
  col("diagnosis", "leader", contains("leader")),
  col("diagnosis", "tegakDiagnosis", contains("tegak")),
  col("diagnosis", "lokasiPa", contains("lokasi pa")),
  col("diagnosis", "hasilPa", contains("hasil pa")),
  col("diagnosis", "subtipeImunohistokimia", contains("imunohistokimia")),
  col("diagnosis", "subtipe", exact("subtipe")),
  col("diagnosis", "ecogScore", contains("ecog")),
  col("diagnosis", "stadium", contains("stadium")),
  col("riwayat", "kankerKeluarga", contains("kanker keluarga")),
  col("riwayat", "dm", contains("riwayat dm")),
  col("riwayat", "ht", contains("riwayat ht")),
  col("riwayat", "penyakitJantung", contains("penyakit jantung")),
  col("riwayat", "hepatitisB", contains("hepatitis b")),
  col("riwayat", "ckd", contains("riwayat ckd")),
  col("riwayat", "ppok", contains("riwayat ppok")),
  col("riwayat", "hiv", contains("riwayat hiv")),
  col("riwayat", "doublePrimary", contains("double primary")),
  col("outcome", "statusRemission", contains("remission")),
  col("outcome", "lostToFollowUp", contains("lost to follow up")),
  col("outcome", "timeToEvent", contains("time to event")),
  col("outcome", "dx", exact("dx")),
  { ref: { section: null, field: "status" }, header: contains("kesimpulan") },
  { ref: { section: null, field: "bb" }, header: contains("bb (kg)") },
  { ref: { section: null, field: "tb" }, header: contains("tb (cm)") },
];

export type SheetUpdate = { ref: FieldRef; header: string; value: string };

function readField(o: StoredOverride, ref: FieldRef): string | undefined {
  if (ref.section === null) return o[ref.field];
  return (o[ref.section] as Record<string, string | undefined> | undefined)?.[ref.field];
}

// The fields in `changes` that have a column in this sheet, with values in
// the sheet's own format.
export function sheetUpdatesFor(changes: StoredOverride, headers: string[]): SheetUpdate[] {
  const out: SheetUpdate[] = [];
  for (const { ref, header: findHeader } of SHEET_COLUMNS) {
    const raw = readField(changes, ref);
    if (raw === undefined) continue;
    const header = findHeader(headers);
    if (!header) continue;
    // KESIMPULAN holds the status as upper-case text (see mapKesimpulanToStatus).
    const value =
      ref.section === null && ref.field === "status"
        ? RECORD_STATUS_META[raw as RecordStatus].label.toUpperCase()
        : raw;
    out.push({ ref, header, value });
  }
  return out;
}

// The sheet-seeded base after `written` landed in the sheet: those fields now
// come from the sheet, so they no longer count as local edits.
export function applySheetUpdates(
  base: RowOverride,
  changes: StoredOverride,
  written: SheetUpdate[],
): RowOverride {
  const landed: StoredOverride = {};
  for (const { ref } of written) {
    const value = readField(changes, ref);
    if (ref.section === null) {
      (landed as Record<string, unknown>)[ref.field] = value;
    } else {
      landed[ref.section] = { ...landed[ref.section], [ref.field]: value };
    }
  }
  return mergeOverride(base, landed);
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
