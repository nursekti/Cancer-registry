// Which sheet column each field of the patient form lives in. The same map
// seeds the form from a sheet row and writes edits back to the sheet, so a
// field is always written to the column it was read from.

import {
  FieldSection,
  LiniEntry,
  RECORD_STATUS_META,
  RecordStatus,
  RowOverride,
  StoredOverride,
  emptyLini,
  mapKesimpulanToStatus,
} from "@/lib/rowOverrides";

type Row = Record<string, string>;

type RootField = "status" | "chemoSideEffect" | "bb" | "tb";
type LiniField = "rejimen" | "responKemoterapi" | "awalAkhirKemoterapi";

export type FieldRef =
  | { section: FieldSection; field: string }
  | { section: null; field: RootField }
  | { section: "lini"; index: number; field: LiniField };

type FindHeader = (headers: string[]) => string | undefined;

const contains =
  (needle: string): FindHeader =>
  (headers) =>
    headers.find((h) => h.toLowerCase().includes(needle));

const exact =
  (needle: string): FindHeader =>
  (headers) =>
    headers.find((h) => h.trim().toLowerCase() === needle);

type SheetColumn = {
  ref: FieldRef;
  header: FindHeader;
  // Converters for fields whose sheet text differs from the form's value.
  fromSheet?: (raw: string) => string | undefined;
  toSheet?: (value: string) => string;
};

function col(section: FieldSection, field: string, header: FindHeader): SheetColumn {
  return { ref: { section, field }, header };
}

function lini(index: number, field: LiniField, header: FindHeader): SheetColumn {
  return { ref: { section: "lini", index, field }, header };
}

// Headers differ slightly between DATA NHL and DATA HL (e.g. "Jenis Kelamin"
// vs "JK", "Respon Kemoterapi lini pertama" vs "Respon Kemoterapi (CR = ...)"),
// so most lookups match on a distinctive substring. Columns that only exist in
// one tab simply aren't found in the other. Pemeriksaan penunjang exams,
// cycles, and drug lists aren't here: the sheet has no columns for them.
export const SHEET_COLUMNS: SheetColumn[] = [
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
  col("diagnosis", "nodalType", contains("extranodal")),
  col("diagnosis", "tegakDiagnosis", contains("tegak")),
  col("diagnosis", "lokasiPa", contains("lokasi pa")),
  col("diagnosis", "hasilPa", contains("hasil pa")),
  col("diagnosis", "subtipeImunohistokimia", contains("imunohistokimia")),
  col("diagnosis", "subtipe", exact("subtipe")),
  col("diagnosis", "ecogScore", contains("ecog")),
  col("diagnosis", "stadium", contains("stadium")),
  col("diagnosis", "metastasis", exact("metastasis")),
  col("riwayat", "kankerKeluarga", contains("kanker keluarga")),
  col("riwayat", "dm", contains("riwayat dm")),
  col("riwayat", "ht", contains("riwayat ht")),
  col("riwayat", "penyakitJantung", contains("penyakit jantung")),
  col("riwayat", "hepatitisB", contains("hepatitis b")),
  col("riwayat", "ckd", contains("riwayat ckd")),
  col("riwayat", "ppok", contains("riwayat ppok")),
  col("riwayat", "hiv", contains("riwayat hiv")),
  col("riwayat", "doublePrimary", contains("double primary")),
  col("lab", "hb", contains("hb sebelum")),
  col("lab", "trombosit", contains("trombosit/platelet")),
  col("lab", "leukositSebelum", contains("leukosit sebelum")),
  col("lab", "ldh", contains("ldh")),
  col("lab", "eosinofil", contains("eosinofil")),
  col("lab", "basofil", contains("basofil")),
  col("lab", "neutrofil", exact("neutrofil (%)")),
  col("lab", "limfosit", exact("limfosit (%)")),
  col("lab", "monosit", exact("monosit (%)")),
  col("outcome", "followUpTerakhir", contains("follow up terakhir")),
  col("outcome", "statusRemission", contains("remission")),
  col("outcome", "lostToFollowUp", contains("lost to follow up")),
  col("outcome", "timeToEvent", contains("time to event")),
  col("outcome", "dx", exact("dx")),
  col("radioterapi", "radioterapi", exact("radioterapi")),
  col("radioterapi", "dosis", contains("dosis radioterapi")),
  col("radioterapi", "respon", contains("respon radioterapi")),
  lini(0, "rejimen", contains("rejimen lini pertama")),
  lini(0, "responKemoterapi", contains("respon kemoterapi")),
  lini(0, "awalAkhirKemoterapi", contains("awal-akhir kemoterapi")),
  lini(1, "rejimen", contains("rejimen lini ke 2")),
  lini(1, "responKemoterapi", contains("respons lini ke 2")),
  {
    ref: { section: null, field: "status" },
    header: contains("kesimpulan"),
    // KESIMPULAN holds the status as upper-case text.
    fromSheet: mapKesimpulanToStatus,
    toSheet: (v) => RECORD_STATUS_META[v as RecordStatus].label.toUpperCase(),
  },
  { ref: { section: null, field: "chemoSideEffect" }, header: contains("side effect") },
  { ref: { section: null, field: "bb" }, header: contains("bb (kg)") },
  { ref: { section: null, field: "tb" }, header: contains("tb (cm)") },
];

export function readField(o: StoredOverride, ref: FieldRef): string | undefined {
  if (ref.section === null) return o[ref.field];
  if (ref.section === "lini") {
    // A changed list without this lini means it was removed (or never
    // existed): its columns should be blank.
    return o.liniList ? (o.liniList[ref.index]?.[ref.field] ?? "") : undefined;
  }
  return (o[ref.section] as Record<string, string | undefined> | undefined)?.[ref.field];
}

// Sets one field on a complete form value, in place.
export function setField(o: RowOverride, ref: FieldRef, value: string | undefined): void {
  if (ref.section === null) {
    (o as Record<RootField, string | undefined>)[ref.field] = value;
  } else if (ref.section === "lini") {
    if (!o.liniList[ref.index]) {
      if (!value) return;
      while (o.liniList.length <= ref.index) o.liniList.push(emptyLini());
    }
    o.liniList[ref.index] = { ...o.liniList[ref.index], [ref.field]: value ?? "" } as LiniEntry;
  } else {
    (o[ref.section] as Record<string, string>)[ref.field] = value ?? "";
  }
}

// Fills every mapped field of `o` from the sheet row.
export function seedFromSheet(o: RowOverride, row: Row, headers: string[]): void {
  for (const { ref, header: findHeader, fromSheet } of SHEET_COLUMNS) {
    const header = findHeader(headers);
    const raw = header ? (row[header] ?? "") : "";
    setField(o, ref, fromSheet ? fromSheet(raw) : raw);
  }
}

export type SheetUpdate = { ref: FieldRef; header: string; value: string };

// The fields in `changes` that have a column in this sheet, with values in
// the sheet's own format.
export function sheetUpdatesFor(changes: StoredOverride, headers: string[]): SheetUpdate[] {
  const out: SheetUpdate[] = [];
  for (const { ref, header: findHeader, toSheet } of SHEET_COLUMNS) {
    const raw = readField(changes, ref);
    if (raw === undefined) continue;
    const header = findHeader(headers);
    if (!header) continue;
    out.push({ ref, header, value: toSheet ? toSheet(raw) : raw });
  }
  return out;
}
