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
  nodalType: string;
  tegakDiagnosis: string;
  lokasiPa: string;
  hasilPa: string;
  subtipeImunohistokimia: string;
  subtipe: string;
  ecogScore: string;
  // Shown under Pemeriksaan penunjang (pre-kemo), but they describe the
  // diagnosis and map to single sheet columns.
  stadium: string;
  metastasis: string;
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

// The baseline lab panel. The sheet has a single set of these columns, so
// there's one per patient rather than one per checkup.
export type LabFields = {
  hb: string;
  trombosit: string;
  leukositSebelum: string;
  ldh: string;
  eosinofil: string;
  basofil: string;
  neutrofil: string;
  limfosit: string;
  monosit: string;
};

export type OutcomeFields = {
  followUpTerakhir: string;
  statusRemission: string;
  lostToFollowUp: string;
  timeToEvent: string;
  dx: string;
};

export type RadioterapiFields = {
  radioterapi: string;
  dosis: string;
  respon: string;
};

// One exam under Pemeriksaan penunjang, tagged with a phase (pre/during/post
// kemo). Each phase holds zero or more of these.
export type CheckupEntry = {
  id: string;
  phase: ExamPhase;
  types: string[];
  customTypes: string[];
  tanggal: string;
  hasil: string;
};

// One line of chemotherapy ("Lini X") under Siklus kemoterapi. A patient can
// go through more than one line, each with its own regimen/cycles and its
// own response.
export type LiniEntry = {
  id: string;
  siklus: string;
  rejimen: string;
  regimen: string;
  drugs: DrugRow[];
  awalAkhirKemoterapi: string;
  responKemoterapi: string;
};

export type RowOverride = {
  status?: RecordStatus;
  deleted?: boolean;
  identity: IdentityFields;
  diagnosis: DiagnosisFields;
  riwayat: RiwayatFields;
  lab: LabFields;
  outcome: OutcomeFields;
  radioterapi: RadioterapiFields;
  checkups: CheckupEntry[];
  liniList: LiniEntry[];
  chemoSideEffect: string;
  bb: string;
  tb: string;
};

// The nested groups of plain text fields, compared and merged field by field.
export const FIELD_SECTIONS = [
  "identity",
  "diagnosis",
  "riwayat",
  "lab",
  "outcome",
  "radioterapi",
] as const;

export type FieldSection = (typeof FIELD_SECTIONS)[number];

// What actually gets persisted: only the fields the user changed relative to
// the sheet (see diffOverride), so later sheet updates still show up for
// every field the user never touched.
export type StoredOverride = Partial<Omit<RowOverride, FieldSection>> & {
  [S in FieldSection]?: Partial<RowOverride[S]>;
};

type OverrideMap = Record<string, StoredOverride>;

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Math.random().toString(36).slice(2)}`;
}

export function emptyCheckup(phase: ExamPhase): CheckupEntry {
  return {
    id: newId(),
    phase,
    types: [],
    customTypes: [],
    tanggal: "",
    hasil: "",
  };
}

export function emptyLini(): LiniEntry {
  return {
    id: newId(),
    siklus: "",
    rejimen: "",
    regimen: "",
    drugs: [],
    awalAkhirKemoterapi: "",
    responKemoterapi: "",
  };
}

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
      nodalType: "",
      tegakDiagnosis: "",
      lokasiPa: "",
      hasilPa: "",
      subtipeImunohistokimia: "",
      subtipe: "",
      ecogScore: "",
      stadium: "",
      metastasis: "",
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
    lab: {
      hb: "",
      trombosit: "",
      leukositSebelum: "",
      ldh: "",
      eosinofil: "",
      basofil: "",
      neutrofil: "",
      limfosit: "",
      monosit: "",
    },
    outcome: {
      followUpTerakhir: "",
      statusRemission: "",
      lostToFollowUp: "",
      timeToEvent: "",
      dx: "",
    },
    radioterapi: {
      radioterapi: "",
      dosis: "",
      respon: "",
    },
    checkups: [],
    liniList: [],
    chemoSideEffect: "",
    bb: "",
    tb: "",
  };
}

const LAB_KEYS = Object.keys(emptyOverride().lab) as Array<keyof LabFields>;

// Overrides saved by earlier versions of the page kept the lab panel inside
// each checkup and "Follow up terakhir" inside each lini. Lift those out into
// their own fields and drop what no longer exists.
function migrateLegacy(stored: StoredOverride): StoredOverride {
  type LegacyCheckup = CheckupEntry & Partial<LabFields>;
  type LegacyLini = LiniEntry & { followUpTerakhir?: string };
  const out: StoredOverride = { ...stored };
  const checkups = stored.checkups as LegacyCheckup[] | undefined;
  const liniList = stored.liniList as LegacyLini[] | undefined;

  if (checkups) {
    const withLab = checkups.find((c) => LAB_KEYS.some((k) => c[k] !== undefined));
    if (withLab && !stored.lab) {
      out.lab = Object.fromEntries(LAB_KEYS.map((k) => [k, withLab[k] ?? ""]));
    }
    out.checkups = checkups
      .map(({ id, phase, types, customTypes, tanggal, hasil }) => ({
        id,
        phase,
        types: types ?? [],
        customTypes: customTypes ?? [],
        tanggal: tanggal ?? "",
        hasil: hasil ?? "",
      }))
      .filter((c) => c.tanggal || c.hasil || c.types.length || c.customTypes.length);
  }

  if (liniList) {
    const followUp = liniList.find((l) => l.followUpTerakhir)?.followUpTerakhir;
    if (followUp && stored.outcome?.followUpTerakhir === undefined) {
      out.outcome = { ...stored.outcome, followUpTerakhir: followUp };
    }
    out.liniList = liniList.map((legacy) => {
      const l: LegacyLini = { ...legacy, rejimen: legacy.rejimen ?? "" };
      delete l.followUpTerakhir;
      return l;
    });
  }

  delete (out as { bsa?: unknown }).bsa;
  return out;
}

// Lays a saved (possibly partial or older-shaped) override over a
// freshly-seeded default, so the result is always complete.
export function mergeOverride(
  base: RowOverride,
  stored: StoredOverride,
): RowOverride {
  const s = migrateLegacy(stored);
  const out: RowOverride = { ...base, ...s } as RowOverride;
  for (const section of FIELD_SECTIONS) {
    (out as Record<FieldSection, unknown>)[section] = { ...base[section], ...s[section] };
  }
  return out;
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

  for (const section of FIELD_SECTIONS) {
    const changed = diffFields<Record<string, string>>(base[section], next[section]);
    if (changed) (out as Record<FieldSection, unknown>)[section] = changed;
  }

  if (!sameIgnoringIds(base.checkups, next.checkups)) out.checkups = next.checkups;
  if (!sameIgnoringIds(base.liniList, next.liniList)) out.liniList = next.liniList;

  for (const k of ["chemoSideEffect", "bb", "tb"] as const) {
    if (next[k] !== base[k]) out[k] = next[k];
  }
  return out;
}
