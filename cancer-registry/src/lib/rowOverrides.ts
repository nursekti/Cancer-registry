import {
  getLocalStorageItem,
  setLocalStorageItem,
} from "@/lib/storage";

export const LS_ROW_OVERRIDES = "cr_row_overrides";

export type ExamPhase = "pre" | "during" | "post";

export type SupportExam = {
  id: string;
  phase: ExamPhase;
  types: string[];
  otherType: string;
  tanggal: string;
  hasil: string;
};

export type LabColumn = {
  id: string;
  phase: ExamPhase;
  hb: string;
  trombosit: string;
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
  jumlahKomorbiditas: string;
};

export type BaselineLabFields = {
  leukositSebelum: string;
  anemia: string;
  anc: string;
  alc: string;
  nlr: string;
  lmr: string;
  plr: string;
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
  awalAkhirKemoterapi: string;
  followUpTerakhir: string;
  responKemoterapi: string;
  statusRemission: string;
  lostToFollowUp: string;
  timeToEvent: string;
  kesimpulan: string;
  dx: string;
};

export type RowOverride = {
  status?: "complete";
  deleted?: boolean;
  identity: IdentityFields;
  diagnosis: DiagnosisFields;
  riwayat: RiwayatFields;
  baselineLab: BaselineLabFields;
  leukosit: LeukositFields;
  outcome: OutcomeFields;
  exams: SupportExam[];
  labs: LabColumn[];
  lini: string;
  siklus: string;
  bb: string;
  tb: string;
  imt: string;
  imtKategori: string;
  bsa: string;
  regimen: string;
  drugs: DrugRow[];
};

type OverrideMap = Record<string, RowOverride>;

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

export function loadOverride(key: string): RowOverride | null {
  return loadOverrides()[key] ?? null;
}

export function saveOverride(key: string, override: RowOverride): void {
  const all = loadOverrides();
  all[key] = override;
  setLocalStorageItem(LS_ROW_OVERRIDES, JSON.stringify(all));
}

export function markDeleted(key: string): void {
  const all = loadOverrides();
  const existing = all[key];
  all[key] = { ...(existing ?? emptyOverride()), deleted: true };
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
      jumlahKomorbiditas: "",
    },
    baselineLab: {
      leukositSebelum: "",
      anemia: "",
      anc: "",
      alc: "",
      nlr: "",
      lmr: "",
      plr: "",
      ldh: "",
    },
    leukosit: {
      eosinofil: "",
      basofil: "",
      neutrofil: "",
      limfosit: "",
      monosit: "",
    },
    outcome: {
      awalAkhirKemoterapi: "",
      followUpTerakhir: "",
      responKemoterapi: "",
      statusRemission: "",
      lostToFollowUp: "",
      timeToEvent: "",
      kesimpulan: "",
      dx: "",
    },
    exams: [],
    labs: [],
    lini: "",
    siklus: "",
    bb: "",
    tb: "",
    imt: "",
    imtKategori: "",
    bsa: "",
    regimen: "",
    drugs: [],
  };
}

// Merges a possibly-older/partial saved override (missing newer nested
// sections) on top of a freshly-seeded default so the shape is always
// complete, however the data was created.
export function mergeOverride(
  base: RowOverride,
  stored: Partial<RowOverride>,
): RowOverride {
  return {
    ...base,
    ...stored,
    identity: { ...base.identity, ...stored.identity },
    diagnosis: { ...base.diagnosis, ...stored.diagnosis },
    riwayat: { ...base.riwayat, ...stored.riwayat },
    baselineLab: { ...base.baselineLab, ...stored.baselineLab },
    leukosit: { ...base.leukosit, ...stored.leukosit },
    outcome: { ...base.outcome, ...stored.outcome },
  };
}
