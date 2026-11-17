// Which sheet column each field of the patient form lives in. The same map
// seeds the form from a sheet row and writes edits back to the sheet, so a
// field is always written to the column it was read from.
//
// Two layouts exist: the original tabs (DATA NHL / DATA HL, one header row,
// free-text lini cells) and the tidied "Data NHL - Post Processing" tab (three
// header rows, one column per lini field, real dates).

import { isGroupedHeaders } from "@/lib/csv";
import { EXAM_TYPE_OPTIONS } from "@/lib/fieldOptions";
import { drugsFromLines, drugsToLines } from "@/lib/regimen";
import {
  CheckupEntry,
  ExamPhase,
  FieldSection,
  LiniEntry,
  RECORD_STATUS_META,
  RecordStatus,
  RowOverride,
  StoredOverride,
  emptyCheckup,
  emptyLini,
  mapKesimpulanToStatus,
} from "@/lib/rowOverrides";

type Row = Record<string, string>;

type RootField = "status" | "chemoSideEffect" | "catatanData" | "bb" | "tb";
type LiniField =
  | "siklus"
  | "rejimen"
  | "drugs"
  | "awal"
  | "akhir"
  | "responKemoterapi"
  | "awalAkhirKemoterapi";
type ExamField = "tanggal" | "jenis" | "hasil";

export type FieldRef =
  | { section: FieldSection; field: string }
  | { section: null; field: RootField }
  | { section: "lini"; index: number; field: LiniField }
  // The first exam of a phase (the sheet has one set of exam columns per phase).
  | { section: "exam"; phase: ExamPhase; field: ExamField };

type FindHeader = (headers: string[]) => string | undefined;

const contains =
  (needle: string): FindHeader =>
  (headers) =>
    headers.find((h) => h.toLowerCase().includes(needle));

const exact =
  (needle: string): FindHeader =>
  (headers) =>
    headers.find((h) => h.trim().toLowerCase() === needle.toLowerCase());

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

function root(field: RootField, header: FindHeader): SheetColumn {
  return { ref: { section: null, field }, header };
}

function lini(index: number, field: LiniField, header: FindHeader): SheetColumn {
  return { ref: { section: "lini", index, field }, header };
}

function exam(phase: ExamPhase, field: ExamField, header: FindHeader): SheetColumn {
  return { ref: { section: "exam", phase, field }, header };
}

// Headers differ slightly between DATA NHL and DATA HL (e.g. "Jenis Kelamin"
// vs "JK", "Respon Kemoterapi lini pertama" vs "Respon Kemoterapi (CR = ...)"),
// so most lookups match on a distinctive substring. Columns that only exist in
// one tab simply aren't found in the other. These tabs have no columns for
// Pemeriksaan penunjang exams, cycles, or drug lists.
const ORIGINAL_COLUMNS: SheetColumn[] = [
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
  root("chemoSideEffect", contains("side effect")),
  root("bb", contains("bb (kg)")),
  root("tb", contains("tb (cm)")),
];

const PHASES: Array<[ExamPhase, string]> = [
  ["pre", "Pre-kemo"],
  ["during", "During kemo"],
  ["post", "Post kemo"],
];

// "Data NHL - Post Processing": headers as built by groupedHeaders (lib/csv.ts),
// e.g. "Lini 2 › Respon kemoterapi". Formula columns (Jumlah komorbiditas,
// ANC..PLR, IMT, Kategori IMT, BSA) aren't mapped — the sheet computes them.
const GROUPED_COLUMNS: SheetColumn[] = [
  col("identity", "nama", exact("Nama")),
  col("identity", "noErm", exact("No ERM")),
  col("identity", "nik", exact("NIK")),
  col("identity", "tahun", exact("Tahun")),
  col("identity", "jk", exact("JK")),
  col("identity", "usia", exact("Usia")),
  col("identity", "pendidikan", exact("Pendidikan terakhir")),
  col("identity", "pekerjaan", exact("Pekerjaan")),
  col("identity", "noHp", exact("No HP")),
  col("diagnosis", "leader", exact("Leader")),
  col("diagnosis", "nodalType", exact("Nodal / extranodal")),
  col("diagnosis", "tegakDiagnosis", exact("Tegak diagnosis")),
  col("diagnosis", "lokasiPa", exact("Lokasi PA")),
  col("diagnosis", "hasilPa", exact("Hasil PA")),
  col("diagnosis", "subtipeImunohistokimia", exact("Hasil imunohistokimia (IHK)")),
  col("diagnosis", "subtipe", exact("Subtipe")),
  col("diagnosis", "ecogScore", exact("ECOG score")),
  col("diagnosis", "stadium", exact("Stadium (Ann-Arbor)")),
  col("diagnosis", "metastasis", exact("Metastasis")),
  col("riwayat", "kankerKeluarga", exact("Kanker keluarga")),
  col("riwayat", "dm", exact("Diabetes melitus (DM)")),
  col("riwayat", "ht", exact("Hipertensi (HT)")),
  col("riwayat", "penyakitJantung", exact("Penyakit jantung")),
  col("riwayat", "hepatitisB", exact("Hepatitis B")),
  col("riwayat", "ckd", exact("CKD")),
  col("riwayat", "ppok", exact("PPOK")),
  col("riwayat", "hiv", exact("HIV")),
  col("riwayat", "doublePrimary", exact("Double primary tumours")),
  col("riwayat", "catatan", exact("Catatan riwayat")),
  col("lab", "hb", exact("HB")),
  col("lab", "trombosit", exact("Trombosit")),
  col("lab", "leukositSebelum", exact("Leukosit sebelum kemoterapi")),
  col("lab", "ldh", exact("LDH")),
  col("lab", "eosinofil", exact("Eosinofil (%)")),
  col("lab", "basofil", exact("Basofil (%)")),
  col("lab", "neutrofil", exact("Neutrofil (%)")),
  col("lab", "limfosit", exact("Limfosit (%)")),
  col("lab", "monosit", exact("Monosit (%)")),
  ...PHASES.flatMap(([phase, label]) => [
    exam(phase, "tanggal", exact(`${label} › Tanggal periksa`)),
    exam(phase, "jenis", exact(`${label} › Jenis pemeriksaan`)),
    exam(phase, "hasil", exact(`${label} › Hasil`)),
  ]),
  root("bb", exact("BB (kg)")),
  root("tb", exact("TB (cm)")),
  ...[0, 1, 2].flatMap((i) => [
    lini(i, "siklus", exact(`Lini ${i + 1} › Siklus`)),
    lini(i, "rejimen", exact(`Rejimen lini ${i + 1}`)),
    lini(i, "drugs", exact(`Lini ${i + 1} › Regimen kemoterapi (obat)`)),
    lini(i, "awal", exact(`Lini ${i + 1} › Awal kemoterapi`)),
    lini(i, "akhir", exact(`Lini ${i + 1} › Akhir kemoterapi`)),
    lini(i, "responKemoterapi", exact(`Lini ${i + 1} › Respon kemoterapi`)),
  ]),
  root("chemoSideEffect", exact("Chemotherapy side effect")),
  col("radioterapi", "radioterapi", exact("Radioterapi")),
  col("radioterapi", "dosis", exact("Dosis radioterapi")),
  col("radioterapi", "respon", exact("Respon radioterapi")),
  col("outcome", "followUpTerakhir", exact("Tanggal follow up terakhir")),
  col("outcome", "statusFollowUp", exact("Status follow up")),
  col("outcome", "statusRemission", exact("Status remission/refrakter/relapse")),
  col("outcome", "lostToFollowUp", exact("Lost to follow up (>12 bulan CR)")),
  col("outcome", "timeToEvent", exact("Time to event (bulan)")),
  col("outcome", "dx", exact("DX")),
  {
    ref: { section: null, field: "status" },
    header: exact("Status (kesimpulan)"),
    fromSheet: mapKesimpulanToStatus,
    toSheet: (v) => RECORD_STATUS_META[v as RecordStatus].label,
  },
  root("catatanData", exact("Catatan data")),
];

function columnsFor(headers: string[]): SheetColumn[] {
  return isGroupedHeaders(headers) ? GROUPED_COLUMNS : ORIGINAL_COLUMNS;
}

// True for the tidied layout, where each lini has its own Awal/Akhir dates.
export function hasSplitLiniColumns(headers: string[]): boolean {
  return isGroupedHeaders(headers);
}

function sameRef(a: FieldRef, b: FieldRef): boolean {
  if (a.section !== b.section || a.field !== b.field) return false;
  if (a.section === "lini") return b.section === "lini" && a.index === b.index;
  if (a.section === "exam") return b.section === "exam" && a.phase === b.phase;
  return true;
}

// The sheet column a field is read from and written to, if this sheet has it.
export function headerFor(ref: FieldRef, headers: string[]): string | undefined {
  return columnsFor(headers).find((c) => sameRef(c.ref, ref))?.header(headers);
}

function examTypesText(c: CheckupEntry): string {
  return [...c.types, ...c.customTypes.map((t) => t.trim()).filter(Boolean)].join(", ");
}

function readLini(l: LiniEntry | undefined, field: LiniField): string {
  if (!l) return "";
  return field === "drugs" ? drugsToLines(l.drugs) : (l[field] ?? "");
}

export function readField(o: StoredOverride, ref: FieldRef): string | undefined {
  if (ref.section === null) return o[ref.field];
  if (ref.section === "lini") {
    // A changed list without this lini means it was removed (or never
    // existed): its columns should be blank.
    return o.liniList ? readLini(o.liniList[ref.index], ref.field) : undefined;
  }
  if (ref.section === "exam") {
    if (!o.checkups) return undefined;
    const first = o.checkups.find((c) => c.phase === ref.phase);
    if (!first) return "";
    return ref.field === "jenis" ? examTypesText(first) : first[ref.field];
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
    const current = o.liniList[ref.index];
    o.liniList[ref.index] =
      ref.field === "drugs"
        ? { ...current, drugs: drugsFromLines(value ?? "") }
        : ({ ...current, [ref.field]: value ?? "" } as LiniEntry);
  } else if (ref.section === "exam") {
    let index = o.checkups.findIndex((c) => c.phase === ref.phase);
    if (index < 0) {
      if (!value) return;
      o.checkups.push(emptyCheckup(ref.phase));
      index = o.checkups.length - 1;
    }
    const current = o.checkups[index];
    if (ref.field === "jenis") {
      const parts = (value ?? "").split(",").map((p) => p.trim()).filter(Boolean);
      const known = (p: string) => EXAM_TYPE_OPTIONS.find((t) => t.toLowerCase() === p.toLowerCase());
      o.checkups[index] = {
        ...current,
        types: parts.map(known).filter((t): t is string => Boolean(t)),
        customTypes: parts.filter((p) => !known(p)),
      };
    } else {
      o.checkups[index] = { ...current, [ref.field]: value ?? "" };
    }
  } else {
    (o[ref.section] as Record<string, string>)[ref.field] = value ?? "";
  }
}

// Fills every mapped field of `o` from the sheet row.
export function seedFromSheet(o: RowOverride, row: Row, headers: string[]): void {
  for (const { ref, header: findHeader, fromSheet } of columnsFor(headers)) {
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
  for (const { ref, header: findHeader, toSheet } of columnsFor(headers)) {
    const raw = readField(changes, ref);
    if (raw === undefined) continue;
    const header = findHeader(headers);
    if (!header) continue;
    out.push({ ref, header, value: toSheet && raw ? toSheet(raw) : raw });
  }
  return out;
}
