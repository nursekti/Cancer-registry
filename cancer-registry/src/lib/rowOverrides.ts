import {
  getLocalStorageItem,
  setLocalStorageItem,
} from "@/lib/storage";

export const LS_ROW_OVERRIDES = "cr_row_overrides";

export type ExamPhase = "pre" | "during" | "post";

export type RecordStatus = "include" | "exclude" | "tidak_lengkap";

export const RECORD_STATUS_META: Record<
  RecordStatus,
  { label: string; badgeClass: string }
> = {
  include: { label: "Include", badgeClass: "bg-emerald-100 text-emerald-700" },
  exclude: { label: "Exclude", badgeClass: "bg-red-100 text-red-700" },
  tidak_lengkap: {
    label: "Tidak Lengkap",
    badgeClass: "bg-amber-100 text-amber-700",
  },
};

export type DrugRow = {
  id: string;
  nama: string;
  dosis: string;
};

export type IdentityFields = {
  nama: string;
  noErm: string;
  tahun: string;
  jk: string;
  usia: string;
  pendidikan: string;
  pekerjaan: string;
  noHp: string;
  nik: string;
};

export type DiagnosisFields = {
  leader: string;
  tegakDiagnosis: string;
  lokasiPa: string;
  hasilPa: string;
  subtipeImunohistokimia: string;
  subtipe: string;
  ecogScore: string;
  stadium: string;
};

export type RiwayatFields = {
  kankerKeluarga: string;
  dm: string;
  ht: string;
  penyakitJantung: string;
  hepatitisB: string;
  ckd: string;
  ppok: string;
  hiv: string;
  doublePrimary: string;
};

export type BaselineLabFields = {
  leukositSebelum: string;
  ldh: string;
};

export type LeukositFields = {
  eosinofil: string;
  basofil: string;
  neutrofil: string;
  limfosit: string;
  monosit: string;
};

export type OutcomeFields = {
  statusRemission: string;
  lostToFollowUp: string;
  timeToEvent: string;
  dx: string;
};

// A single "checkup" instance under Pemeriksaan penunjang: one physical
// visit/draw, tagged with a phase (pre/during/post kemo). Bundles the exam
// itself with all lab results drawn at that same visit, so each phase
// section can hold zero or more of these independently.
export type CheckupEntry = {
  id: string;
  phase: ExamPhase;
  types: string[];
  customTypes: string[];
  tanggal: string;
  hasil: string;
  hb: string;
  trombosit: string;
} & BaselineLabFields &
  LeukositFields;

// One line of chemotherapy ("Lini X") under Siklus kemoterapi. A patient can
// go through more than one line, each with its own regimen/cycles and its
// own outcome.
export type LiniEntry = {
  id: string;
  siklus: string;
  regimen: string;
  drugs: DrugRow[];
  awalAkhirKemoterapi: string;
  followUpTerakhir: string;
  responKemoterapi: string;
};

export type RowOverride = {
  status?: RecordStatus;
  deleted?: boolean;
  identity: IdentityFields;
  diagnosis: DiagnosisFields;
  riwayat: RiwayatFields;
  outcome: OutcomeFields;
  checkups: CheckupEntry[];
  liniList: LiniEntry[];
  bb: string;
  tb: string;
  bsa: string;
};

// What actually gets persisted: only the fields the user changed relative to
// the sheet (see diffOverride), so later sheet updates still show up for
// every field the user never touched.
export type StoredOverride = Partial<
  Omit<RowOverride, "identity" | "diagnosis" | "riwayat" | "outcome">
> & {
  identity?: Partial<IdentityFields>;
  diagnosis?: Partial<DiagnosisFields>;
  riwayat?: Partial<RiwayatFields>;
  outcome?: Partial<OutcomeFields>;
};

type OverrideMap = Record<string, StoredOverride>;

export function rowKey(row: Record<string, string>): string {
  return (
    row["NO ERM"]?.trim() ||
    row["NIK"]?.trim() ||
    row["NAMA"]?.trim() ||
    JSON.stringify(row)
  );
}

export function findHeaderValue(
  row: Record<string, string>,
  headers: string[],
  needle: string,
): string {
  const target = needle.toLowerCase();
  const header = headers.find((h) => h.toLowerCase().includes(target));
  return header ? (row[header] ?? "") : "";
}

// The sheet's KESIMPULAN column already holds our three status values
// (INCLUDE / EXCLUDE / TIDAK LENGKAP) — just normalize casing.
export function mapKesimpulanToStatus(raw: string): RecordStatus | undefined {
  const v = raw.trim().toLowerCase();
  if (v === "include") return "include";
  if (v === "exclude") return "exclude";
  if (v === "tidak lengkap") return "tidak_lengkap";
  return undefined;
}

// Some headers are short substrings of others (e.g. "SUBTIPE" vs "Subtipe
// Limfoma dari hasil imunohistokimia (IHK)"), so findHeaderValue's
// first-substring-match isn't reliable for them. This matches only a header
// whose trimmed text equals the needle exactly (case-insensitive).
export function findExactHeaderValue(
  row: Record<string, string>,
  headers: string[],
  needle: string,
): string {
  const target = needle.trim().toLowerCase();
  const header = headers.find((h) => h.trim().toLowerCase() === target);
  return header ? (row[header] ?? "") : "";
}

export function isHeaderMapped(header: string, needles: string[]): boolean {
  const h = header.toLowerCase();
  return needles.some((n) => h.includes(n.toLowerCase()));
}

// Spreadsheet exports commonly include junk rows: trailing blank rows, or
// rows where dragged-down formulas leave stray values like "0"/"#DIV/0!" in
// ratio columns even though there's no real patient behind the row. Either
// way, a row with no name and no ERM number isn't a real record.
export function isEmptyRow(row: Record<string, string>): boolean {
  return !row["NAMA"]?.trim() && !row["NO ERM"]?.trim();
}

export function loadOverrides(): OverrideMap {
  const raw = getLocalStorageItem(LS_ROW_OVERRIDES);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as OverrideMap;
  } catch {
    return {};
  }
}

export function loadOverride(key: string): StoredOverride | null {
  return loadOverrides()[key] ?? null;
}

export function saveOverride(key: string, override: StoredOverride): void {
  const all = loadOverrides();
  if (Object.keys(override).length) all[key] = override;
  else delete all[key];
  setLocalStorageItem(LS_ROW_OVERRIDES, JSON.stringify(all));
}

export function markDeleted(key: string): void {
  const all = loadOverrides();
  all[key] = { ...all[key], deleted: true };
  setLocalStorageItem(LS_ROW_OVERRIDES, JSON.stringify(all));
}

export function emptyOverride(): RowOverride {
  return {
    identity: {
      nama: "",
      noErm: "",
      tahun: "",
      jk: "",
      usia: "",
      pendidikan: "",
      pekerjaan: "",
      noHp: "",
      nik: "",
    },
    diagnosis: {
      leader: "",
      tegakDiagnosis: "",
      lokasiPa: "",
      hasilPa: "",
      subtipeImunohistokimia: "",
      subtipe: "",
      ecogScore: "",
      stadium: "",
    },
    riwayat: {
      kankerKeluarga: "",
      dm: "",
      ht: "",
      penyakitJantung: "",
      hepatitisB: "",
      ckd: "",
      ppok: "",
      hiv: "",
      doublePrimary: "",
    },
    outcome: {
      statusRemission: "",
      lostToFollowUp: "",
      timeToEvent: "",
      dx: "",
    },
    checkups: [],
    liniList: [],
    bb: "",
    tb: "",
    bsa: "",
  };
}

// Merges a possibly-older/partial saved override (missing newer nested
// sections) on top of a freshly-seeded default so the shape is always
// complete, however the data was created.
export function mergeOverride(
  base: RowOverride,
  stored: StoredOverride,
): RowOverride {
  return {
    ...base,
    ...stored,
    identity: { ...base.identity, ...stored.identity },
    diagnosis: { ...base.diagnosis, ...stored.diagnosis },
    riwayat: { ...base.riwayat, ...stored.riwayat },
    outcome: { ...base.outcome, ...stored.outcome },
  };
}

function diffFields<T extends Record<string, string>>(
  base: T,
  next: T,
): Partial<T> | undefined {
  const out: Partial<T> = {};
  for (const k of Object.keys(next) as Array<keyof T>) {
    if (next[k] !== base[k]) out[k] = next[k];
  }
  return Object.keys(out).length ? out : undefined;
}

// Checkup/lini/drug ids are freshly generated every time a row is seeded from
// the sheet, so entries are compared by content only.
function sameIgnoringIds(a: unknown, b: unknown): boolean {
  const skipIds = (k: string, v: unknown) => (k === "id" ? undefined : v);
  return JSON.stringify(a, skipIds) === JSON.stringify(b, skipIds);
}

// The inverse of mergeOverride: keeps only what differs from the sheet-seeded
// base. Text fields are compared one by one; the checkup and lini lists are
// stored whole once anything in them changes.
export function diffOverride(base: RowOverride, next: RowOverride): StoredOverride {
  const out: StoredOverride = {};
  if (next.deleted) out.deleted = true;
  if (next.status && next.status !== base.status) out.status = next.status;

  const identity = diffFields(base.identity, next.identity);
  if (identity) out.identity = identity;
  const diagnosis = diffFields(base.diagnosis, next.diagnosis);
  if (diagnosis) out.diagnosis = diagnosis;
  const riwayat = diffFields(base.riwayat, next.riwayat);
  if (riwayat) out.riwayat = riwayat;
  const outcome = diffFields(base.outcome, next.outcome);
  if (outcome) out.outcome = outcome;

  if (!sameIgnoringIds(base.checkups, next.checkups)) out.checkups = next.checkups;
  if (!sameIgnoringIds(base.liniList, next.liniList)) out.liniList = next.liniList;

  for (const k of ["bb", "tb", "bsa"] as const) {
    if (next[k] !== base[k]) out[k] = next[k];
  }
  return out;
}
