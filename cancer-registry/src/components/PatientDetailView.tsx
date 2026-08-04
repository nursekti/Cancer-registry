"use client";

import * as React from "react";
import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { fetchImtFormulas } from "@/lib/fetchImtFormulas";
import {
  CheckupEntry,
  DiagnosisFields,
  DrugRow,
  ExamPhase,
  IdentityFields,
  LiniEntry,
  OutcomeFields,
  RecordStatus,
  RiwayatFields,
  RowOverride,
  emptyOverride,
  findExactHeaderValue,
  findHeaderValue,
  isHeaderMapped,
  loadOverride,
  mapKesimpulanToStatus,
  markDeleted,
  mergeOverride,
  rowKey,
  saveOverride,
} from "@/lib/rowOverrides";

type Row = Record<string, string>;
type Field = { label: string; value: string; onChange: (value: string) => void };

const EXAM_TYPE_OPTIONS = ["CT scan", "Rontgen", "USG", "Bone survey"];
const LEADER_OPTIONS = [
  "Anak",
  "Bedah",
  "Bedah Mulut",
  "Interna",
  "Interna - Anak",
  "Paru",
  "THT",
];
const SUBTIPE_OPTIONS = [
  "HL - Nodular Sclerosis",
  "HL - Mixed Cellularity",
  "HL - Lymphocyte-rich",
  "HL - Lymphocyte-depleted",
  "HL - nodular lymphocyte-predominant B-cell lymphoma (NLPBL)",
  "HL - unspecified",
];
const ECOG_OPTIONS = ["0", "1", "2", "3", "4"];
const STADIUM_OPTIONS = ["I", "II", "III", "IV"];

// Headers already surfaced elsewhere (identity sidebar, diagnosis, history,
// labs, or consumed by the editable form below) — excluded from the raw
// "data mentah" dump so nothing is shown twice.
const MAPPED_HEADER_NEEDLES = [
  "nama",
  "no erm",
  "tahun",
  "jk",
  "jenis kelamin",
  "usia",
  "pendidikan",
  "pekerjaan",
  "no hp",
  "nik",
  "leader",
  "tegak",
  "lokasi pa",
  "hasil pa",
  "imunohistokimia",
  "subtipe",
  "ecog",
  "stadium",
  "double primary",
  "kanker keluarga",
  "riwayat dm",
  "riwayat ht",
  "penyakit jantung",
  "hepatitis b",
  "riwayat ckd",
  "riwayat ppok",
  "riwayat hiv",
  "jumlah komorbiditas",
  "anemia",
  "leukosit sebelum",
  "anc (",
  "alc (",
  "nlr",
  "lmr",
  "plr",
  "ldh",
  "eosinofil",
  "basofil",
  "neutrofil",
  "limfosit",
  "monosit",
  "pemeriksaan penunjang",
  "hb sebelum",
  "trombosit",
  "regimen kemoterapi",
  "siklus kemoterapi",
  "bb (kg)",
  "tb (cm)",
  "imt (kg",
  "kategori imt",
  "awal-akhir kemoterapi",
  "follow up terakhir",
  "respon kemoterapi",
  "remission",
  "lost to follow up",
  "time to event",
  "kesimpulan",
  "dx",
];

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Math.random().toString(36).slice(2)}`;
}

function emptyCheckup(phase: ExamPhase): CheckupEntry {
  return {
    id: newId(),
    phase,
    types: [],
    customTypes: [],
    tanggal: "",
    hasil: "",
    hb: "",
    trombosit: "",
    leukositSebelum: "",
    ldh: "",
    eosinofil: "",
    basofil: "",
    neutrofil: "",
    limfosit: "",
    monosit: "",
  };
}

function emptyLini(): LiniEntry {
  return {
    id: newId(),
    siklus: "",
    regimen: "",
    drugs: [],
    awalAkhirKemoterapi: "",
    followUpTerakhir: "",
    responKemoterapi: "",
  };
}

const DOSE_PATTERN = /\d+(?:[.,]\d+)?\s*(?:mg|mcg|g|gr|ml|cc|iu|unit)\b/i;

// Real regimen entries embed the dose in the drug text itself (e.g.
// "Doxorubicin 35 mg selesai"). Pull the dose out into its own field and
// leave the rest (drug name plus any trailing notes) as the name.
function parseDrugDose(text: string): { nama: string; dosis: string } {
  const match = text.match(DOSE_PATTERN);
  if (!match || match.index === undefined) {
    return { nama: text.trim(), dosis: "" };
  }
  const dosis = match[0].replace(/\s+/g, " ").trim();
  const nama = (text.slice(0, match.index) + text.slice(match.index + match[0].length))
    .replace(/\s+/g, " ")
    .trim();
  return { nama, dosis };
}

function splitRegimen(regimen: string): DrugRow[] {
  const trimmed = regimen.trim();
  if (!trimmed) return [];

  // Real regimen text tends to look like "Doxorubicin 34mg (H1)Vincristin 1,5mg
  // (H1)..." — one entry per drug, each ending in a "(H..)" cycle marker and no
  // separator before the next drug name. Splitting on ")" keeps each drug's
  // name/dose/cycle together without breaking decimal commas (e.g. "1,5mg").
  const parts = /\)/.test(trimmed)
    ? trimmed
        .split(/\)(?!\s*$)/)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => (p.endsWith(")") ? p : `${p})`))
    : trimmed
        .split(/[\n;]+|\s+\+\s+/)
        .map((p) => p.trim())
        .filter(Boolean);

  if (!parts.length) return [];
  return parts.map((part) => ({ id: newId(), ...parseDrugDose(part) }));
}

// The sheet's Siklus column is a free-text blurb ("LINI I (16 Siklus),"
// or "...Lini 1 Siklus 12 dengan..."). Pull out just the cycle count so the
// field reads as a plain "Siklus N".
function parseSiklusCount(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const after = trimmed.match(/siklus\s*(\d+)/i);
  if (after) return `Siklus ${after[1]}`;
  const before = trimmed.match(/(\d+)\s*siklus/i);
  if (before) return `Siklus ${before[1]}`;
  return trimmed;
}

function buildInitialOverride(row: Row, headers: string[]): RowOverride {
  const base = emptyOverride();

  // Everything the spreadsheet has today (single Hb/Trombosit values, a
  // single baseline lab panel, a single leukosit differential) represents one
  // visit — bundled into the first Pre-kemo entry for now.
  const initialCheckup: CheckupEntry = {
    ...emptyCheckup("pre"),
    hb: findHeaderValue(row, headers, "hb sebelum"),
    trombosit: findHeaderValue(row, headers, "trombosit"),
    leukositSebelum: findHeaderValue(row, headers, "leukosit sebelum"),
    ldh: findHeaderValue(row, headers, "ldh"),
    eosinofil: findHeaderValue(row, headers, "eosinofil"),
    basofil: findHeaderValue(row, headers, "basofil"),
    neutrofil: findHeaderValue(row, headers, "neutrofil"),
    limfosit: findHeaderValue(row, headers, "limfosit"),
    monosit: findHeaderValue(row, headers, "monosit"),
  };

  const regimen = findHeaderValue(row, headers, "regimen kemoterapi");

  // The sheet's regimen/cycle/outcome columns represent one line of therapy
  // today — bundled into the first Lini entry for now.
  const initialLini: LiniEntry = {
    ...emptyLini(),
    siklus: parseSiklusCount(findHeaderValue(row, headers, "siklus kemoterapi")),
    regimen,
    drugs: splitRegimen(regimen),
    awalAkhirKemoterapi: findHeaderValue(row, headers, "awal-akhir kemoterapi"),
    followUpTerakhir: findHeaderValue(row, headers, "follow up terakhir"),
    responKemoterapi: findHeaderValue(row, headers, "respon kemoterapi"),
  };

  return {
    ...base,
    identity: {
      nama: findExactHeaderValue(row, headers, "nama") || row["NAMA"] || "",
      noErm: row["NO ERM"] ?? "",
      tahun: findHeaderValue(row, headers, "tahun"),
      jk: findHeaderValue(row, headers, "jenis kelamin") || findHeaderValue(row, headers, "jk"),
      usia: findHeaderValue(row, headers, "usia"),
      pendidikan: findHeaderValue(row, headers, "pendidikan"),
      pekerjaan: findHeaderValue(row, headers, "pekerjaan"),
      noHp: findHeaderValue(row, headers, "no hp"),
      nik: findHeaderValue(row, headers, "nik"),
    },
    diagnosis: {
      leader: findHeaderValue(row, headers, "leader"),
      tegakDiagnosis: findHeaderValue(row, headers, "tegak"),
      lokasiPa: findHeaderValue(row, headers, "lokasi pa"),
      hasilPa: findHeaderValue(row, headers, "hasil pa"),
      subtipeImunohistokimia: findHeaderValue(row, headers, "imunohistokimia"),
      subtipe: findExactHeaderValue(row, headers, "subtipe"),
      ecogScore: findHeaderValue(row, headers, "ecog"),
      stadium: findHeaderValue(row, headers, "stadium"),
    },
    riwayat: {
      kankerKeluarga: findHeaderValue(row, headers, "kanker keluarga"),
      dm: findHeaderValue(row, headers, "riwayat dm"),
      ht: findHeaderValue(row, headers, "riwayat ht"),
      penyakitJantung: findHeaderValue(row, headers, "penyakit jantung"),
      hepatitisB: findHeaderValue(row, headers, "hepatitis b"),
      ckd: findHeaderValue(row, headers, "riwayat ckd"),
      ppok: findHeaderValue(row, headers, "riwayat ppok"),
      hiv: findHeaderValue(row, headers, "riwayat hiv"),
      doublePrimary: findHeaderValue(row, headers, "double primary"),
    },
    outcome: {
      statusRemission: findHeaderValue(row, headers, "remission"),
      lostToFollowUp: findHeaderValue(row, headers, "lost to follow up"),
      timeToEvent: findHeaderValue(row, headers, "time to event"),
      dx: findExactHeaderValue(row, headers, "dx"),
    },
    checkups: [initialCheckup],
    liniList: [initialLini],
    // Present as real columns only in the NHL sheet; the HL sheet only has
    // the computed IMT, so bb/tb stay blank there until the async
    // formula-derived lookup (see the effect in PatientDetailView) fills them.
    bb: findHeaderValue(row, headers, "bb (kg)"),
    tb: findHeaderValue(row, headers, "tb (cm)"),
    status: mapKesimpulanToStatus(findHeaderValue(row, headers, "kesimpulan")),
  };
}

export function PatientDetailView({
  cancerType,
  title,
  backHref,
  headers,
  row,
  csvUrl,
  onDeleted,
  onSaved,
}: {
  cancerType: string;
  title: string;
  backHref: string;
  headers: string[];
  row: Row;
  csvUrl?: string;
  onDeleted: (key: string) => void;
  onSaved: (key: string, override: RowOverride) => void;
}) {
  const key = React.useMemo(() => rowKey(row), [row]);
  const [state, setState] = React.useState<RowOverride>(() => {
    const seeded = buildInitialOverride(row, headers);
    const stored = loadOverride(key);
    return stored ? mergeOverride(seeded, stored) : seeded;
  });

  // The HL sheet only stores a computed IMT value, not BB/TB — reverse-parse
  // them from the cell's literal formula (e.g. "=51/(1,7)^2") via the
  // Sheets API, since that's the only place those numbers exist.
  React.useEffect(() => {
    if (cancerType !== "HL" || !csvUrl) return;
    let cancelled = false;
    fetchImtFormulas(csvUrl)
      .then((map) => {
        if (cancelled || !map) return;
        const noErm = row["NO ERM"]?.trim();
        const derived = noErm ? map[noErm] : undefined;
        if (!derived) return;
        setState((s) => (s.bb || s.tb ? s : { ...s, bb: derived.bb, tb: derived.tbCm }));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [cancerType, csvUrl, row, key]);
  const [confirmingDelete, setConfirmingDelete] = React.useState(false);
  const [savedMessage, setSavedMessage] = React.useState<string | null>(null);
  const [deleted, setDeleted] = React.useState(false);
  const [isEditing, setIsEditing] = React.useState(false);
  const [preEditSnapshot, setPreEditSnapshot] = React.useState<RowOverride | null>(
    null,
  );

  function persist(next: RowOverride, message: string) {
    saveOverride(key, next);
    setState(next);
    setSavedMessage(message);
    onSaved(key, next);
    setIsEditing(false);
    setPreEditSnapshot(null);
  }

  function handleEdit() {
    setPreEditSnapshot(state);
    setSavedMessage(null);
    setIsEditing(true);
  }

  function handleCancel() {
    if (preEditSnapshot) setState(preEditSnapshot);
    setPreEditSnapshot(null);
    setConfirmingDelete(false);
    setIsEditing(false);
  }

  function handleUpdate() {
    persist(state, "Tersimpan.");
  }

  function handleDelete() {
    markDeleted(key);
    onDeleted(key);
    setDeleted(true);
  }

  function updateIdentity(patch: Partial<IdentityFields>) {
    setState((s) => ({ ...s, identity: { ...s.identity, ...patch } }));
  }

  function updateDiagnosis(patch: Partial<DiagnosisFields>) {
    setState((s) => ({ ...s, diagnosis: { ...s.diagnosis, ...patch } }));
  }

  function updateRiwayat(patch: Partial<RiwayatFields>) {
    setState((s) => ({ ...s, riwayat: { ...s.riwayat, ...patch } }));
  }

  function updateOutcome(patch: Partial<OutcomeFields>) {
    setState((s) => ({ ...s, outcome: { ...s.outcome, ...patch } }));
  }

  function addCheckup(phase: ExamPhase) {
    setState((s) => ({ ...s, checkups: [...s.checkups, emptyCheckup(phase)] }));
  }

  function updateCheckup(id: string, patch: Partial<CheckupEntry>) {
    setState((s) => ({
      ...s,
      checkups: s.checkups.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));
  }

  function removeCheckup(id: string) {
    setState((s) => ({
      ...s,
      checkups: s.checkups.filter((c) => c.id !== id),
    }));
  }

  function toggleCheckupType(id: string, type: string) {
    setState((s) => ({
      ...s,
      checkups: s.checkups.map((c) => {
        if (c.id !== id) return c;
        const has = c.types.includes(type);
        return {
          ...c,
          types: has ? c.types.filter((t) => t !== type) : [...c.types, type],
        };
      }),
    }));
  }

  function addCustomType(id: string) {
    setState((s) => ({
      ...s,
      checkups: s.checkups.map((c) =>
        c.id === id ? { ...c, customTypes: [...c.customTypes, ""] } : c,
      ),
    }));
  }

  function updateCustomType(id: string, index: number, value: string) {
    setState((s) => ({
      ...s,
      checkups: s.checkups.map((c) =>
        c.id === id
          ? { ...c, customTypes: c.customTypes.map((t, i) => (i === index ? value : t)) }
          : c,
      ),
    }));
  }

  function removeCustomType(id: string, index: number) {
    setState((s) => ({
      ...s,
      checkups: s.checkups.map((c) =>
        c.id === id
          ? { ...c, customTypes: c.customTypes.filter((_, i) => i !== index) }
          : c,
      ),
    }));
  }

  function addLini() {
    setState((s) => ({ ...s, liniList: [...s.liniList, emptyLini()] }));
  }

  function updateLini(id: string, patch: Partial<LiniEntry>) {
    setState((s) => ({
      ...s,
      liniList: s.liniList.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    }));
  }

  function removeLini(id: string) {
    setState((s) => ({ ...s, liniList: s.liniList.filter((l) => l.id !== id) }));
  }

  function addDrug(liniId: string) {
    setState((s) => ({
      ...s,
      liniList: s.liniList.map((l) =>
        l.id === liniId
          ? { ...l, drugs: [...l.drugs, { id: newId(), nama: "", dosis: "" }] }
          : l,
      ),
    }));
  }

  function updateDrug(liniId: string, drugId: string, patch: Partial<DrugRow>) {
    setState((s) => ({
      ...s,
      liniList: s.liniList.map((l) =>
        l.id === liniId
          ? { ...l, drugs: l.drugs.map((d) => (d.id === drugId ? { ...d, ...patch } : d)) }
          : l,
      ),
    }));
  }

  function removeDrug(liniId: string, drugId: string) {
    setState((s) => ({
      ...s,
      liniList: s.liniList.map((l) =>
        l.id === liniId ? { ...l, drugs: l.drugs.filter((d) => d.id !== drugId) } : l,
      ),
    }));
  }

  const identityFields: Field[] = [
    { label: "Nama", value: state.identity.nama, onChange: (v) => updateIdentity({ nama: v }) },
    { label: "No ERM", value: state.identity.noErm, onChange: (v) => updateIdentity({ noErm: v }) },
    { label: "Tahun", value: state.identity.tahun, onChange: (v) => updateIdentity({ tahun: v }) },
    { label: "JK", value: state.identity.jk, onChange: (v) => updateIdentity({ jk: v }) },
    { label: "Usia", value: state.identity.usia, onChange: (v) => updateIdentity({ usia: v }) },
    {
      label: "Pendidikan terakhir",
      value: state.identity.pendidikan,
      onChange: (v) => updateIdentity({ pendidikan: v }),
    },
    {
      label: "Pekerjaan",
      value: state.identity.pekerjaan,
      onChange: (v) => updateIdentity({ pekerjaan: v }),
    },
    { label: "No HP", value: state.identity.noHp, onChange: (v) => updateIdentity({ noHp: v }) },
    { label: "NIK", value: state.identity.nik, onChange: (v) => updateIdentity({ nik: v }) },
  ];

  const leaderField: Field = {
    label: "Leader",
    value: state.diagnosis.leader,
    onChange: (v) => updateDiagnosis({ leader: v }),
  };
  const tegakDiagnosisField: Field = {
    label: "Tegak diagnosis",
    value: state.diagnosis.tegakDiagnosis,
    onChange: (v) => updateDiagnosis({ tegakDiagnosis: v }),
  };
  const lokasiPaField: Field = {
    label: "Lokasi PA",
    value: state.diagnosis.lokasiPa,
    onChange: (v) => updateDiagnosis({ lokasiPa: v }),
  };
  const hasilPaField: Field = {
    label: "Hasil PA",
    value: state.diagnosis.hasilPa,
    onChange: (v) => updateDiagnosis({ hasilPa: v }),
  };
  const ihkField: Field = {
    label: "Hasil imunohistokimia (IHK)",
    value: state.diagnosis.subtipeImunohistokimia,
    onChange: (v) => updateDiagnosis({ subtipeImunohistokimia: v }),
  };
  const subtipeField: Field = {
    label: "Subtipe",
    value: state.diagnosis.subtipe,
    onChange: (v) => updateDiagnosis({ subtipe: v }),
  };
  const ecogField: Field = {
    label: "ECOG score",
    value: state.diagnosis.ecogScore,
    onChange: (v) => updateDiagnosis({ ecogScore: v }),
  };
  const stadiumField: Field = {
    label: "Stadium",
    value: state.diagnosis.stadium,
    onChange: (v) => updateDiagnosis({ stadium: v }),
  };

  const comorbidityItems: Field[] = [
    {
      label: "Kanker keluarga",
      value: state.riwayat.kankerKeluarga,
      onChange: (v) => updateRiwayat({ kankerKeluarga: v }),
    },
    { label: "Diabetes melitus (DM)", value: state.riwayat.dm, onChange: (v) => updateRiwayat({ dm: v }) },
    { label: "Hipertensi (HT)", value: state.riwayat.ht, onChange: (v) => updateRiwayat({ ht: v }) },
    {
      label: "Penyakit jantung",
      value: state.riwayat.penyakitJantung,
      onChange: (v) => updateRiwayat({ penyakitJantung: v }),
    },
    {
      label: "Hepatitis B",
      value: state.riwayat.hepatitisB,
      onChange: (v) => updateRiwayat({ hepatitisB: v }),
    },
    { label: "CKD", value: state.riwayat.ckd, onChange: (v) => updateRiwayat({ ckd: v }) },
    { label: "PPOK", value: state.riwayat.ppok, onChange: (v) => updateRiwayat({ ppok: v }) },
    { label: "HIV", value: state.riwayat.hiv, onChange: (v) => updateRiwayat({ hiv: v }) },
  ];

  const doublePrimaryField: Field = {
    label: "Double primary tumours",
    value: state.riwayat.doublePrimary,
    onChange: (v) => updateRiwayat({ doublePrimary: v }),
  };

  const jumlahKomorbiditas = comorbidityItems.filter(
    (item) => item.value.trim().toLowerCase() === "ya",
  ).length;

  function baselineLabFieldsFor(entry: CheckupEntry): Field[] {
    return [
      { label: "HB", value: entry.hb, onChange: (v) => updateCheckup(entry.id, { hb: v }) },
      {
        label: "Trombosit",
        value: entry.trombosit,
        onChange: (v) => updateCheckup(entry.id, { trombosit: v }),
      },
      {
        label: "Leukosit sebelum kemoterapi",
        value: entry.leukositSebelum,
        onChange: (v) => updateCheckup(entry.id, { leukositSebelum: v }),
      },
      { label: "LDH", value: entry.ldh, onChange: (v) => updateCheckup(entry.id, { ldh: v }) },
    ];
  }

  function computedLabRowsFor(entry: CheckupEntry): { label: string; value: string }[] {
    const leukosit = parseDecimal(entry.leukositSebelum);
    const neutrofil = parseDecimal(entry.neutrofil);
    const limfosit = parseDecimal(entry.limfosit);
    const monosit = parseDecimal(entry.monosit);
    const trombosit = parseDecimal(entry.trombosit);

    const anc = leukosit !== null && neutrofil !== null ? leukosit * neutrofil : null;
    const alc = limfosit !== null && leukosit !== null ? limfosit * leukosit : null;
    const nlr = safeDivide(neutrofil, limfosit);
    const lmr = safeDivide(limfosit, monosit);
    const plr = safeDivide(trombosit, limfosit);

    return [
      { label: "ANC (Absolute Neutrophil Count)", value: formatComputed(anc) },
      { label: "ALC (Absolute Lymphocyte Count)", value: formatComputed(alc) },
      { label: "NLR", value: formatComputed(nlr) },
      { label: "LMR", value: formatComputed(lmr) },
      { label: "PLR", value: formatComputed(plr) },
    ];
  }

  function leukositFieldsFor(entry: CheckupEntry): Field[] {
    return [
      {
        label: "Eosinofil",
        value: entry.eosinofil,
        onChange: (v) => updateCheckup(entry.id, { eosinofil: v }),
      },
      {
        label: "Basofil",
        value: entry.basofil,
        onChange: (v) => updateCheckup(entry.id, { basofil: v }),
      },
      {
        label: "Neutrofil",
        value: entry.neutrofil,
        onChange: (v) => updateCheckup(entry.id, { neutrofil: v }),
      },
      {
        label: "Limfosit",
        value: entry.limfosit,
        onChange: (v) => updateCheckup(entry.id, { limfosit: v }),
      },
      {
        label: "Monosit",
        value: entry.monosit,
        onChange: (v) => updateCheckup(entry.id, { monosit: v }),
      },
    ];
  }

  function renderCheckupCard(entry: CheckupEntry, label: string) {
    return (
      <div key={entry.id} className="space-y-5 rounded-2xl border border-zinc-200 p-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-zinc-800">{label}</div>
          {isEditing ? (
            <button
              type="button"
              onClick={() => removeCheckup(entry.id)}
              className="text-xs font-medium text-red-600 hover:text-red-500"
            >
              Hapus
            </button>
          ) : null}
        </div>

        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Pemeriksaan
          </div>
          <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
            <DiagnosisField
              field={{
                label: "Tanggal periksa",
                value: entry.tanggal,
                onChange: (v) => updateCheckup(entry.id, { tanggal: v }),
              }}
              isEditing={isEditing}
              kind="date"
            />
            <DiagnosisField
              field={{
                label: "Hasil",
                value: entry.hasil,
                onChange: (v) => updateCheckup(entry.id, { hasil: v }),
              }}
              isEditing={isEditing}
              kind="text"
            />
          </div>
          {isEditing ? (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {EXAM_TYPE_OPTIONS.map((type) => (
                <label key={type} className="flex items-center gap-1.5 text-sm text-zinc-700">
                  <input
                    type="checkbox"
                    checked={entry.types.includes(type)}
                    onChange={() => toggleCheckupType(entry.id, type)}
                    className="h-4 w-4 rounded border-zinc-300"
                  />
                  {type}
                </label>
              ))}
              {entry.customTypes.map((custom, idx) => (
                <div key={idx} className="flex items-center gap-1">
                  <input
                    type="text"
                    placeholder="lainnya, dll"
                    value={custom}
                    onChange={(e) => updateCustomType(entry.id, idx, e.target.value)}
                    className="h-8 w-32 rounded-lg bg-white px-2.5 text-xs text-zinc-900 ring-1 ring-inset ring-zinc-200 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400"
                  />
                  <button
                    type="button"
                    onClick={() => removeCustomType(entry.id, idx)}
                    className="text-xs font-medium text-red-600 hover:text-red-500"
                  >
                    &times;
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => addCustomType(entry.id)}
                className="text-xs font-medium text-zinc-600 hover:text-zinc-800"
              >
                + Tambah lainnya
              </button>
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {[...entry.types, ...entry.customTypes.filter(Boolean)].length ? (
                [...entry.types, ...entry.customTypes.filter(Boolean)].map((type, idx) => (
                  <span
                    key={idx}
                    className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700"
                  >
                    {type}
                  </span>
                ))
              ) : (
                <span className="text-sm text-zinc-400">-</span>
              )}
            </div>
          )}
        </div>

        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Laboratorium
          </div>
          <EditableGrid fields={baselineLabFieldsFor(entry)} isEditing={isEditing} />
        </div>

        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Jumlah leukosit
          </div>
          <EditableLeukositTable items={leukositFieldsFor(entry)} isEditing={isEditing} />
        </div>

        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            ANC / ALC / NLR / LMR / PLR
          </div>
          <ComputedValueTable items={computedLabRowsFor(entry)} />
        </div>
      </div>
    );
  }

  function renderPhaseSection(phase: ExamPhase, phaseLabel: string) {
    const entries = state.checkups.filter((c) => c.phase === phase);
    return (
      <div className="space-y-4">
        {entries.map((entry, idx) => renderCheckupCard(entry, `${phaseLabel} ${idx + 1}`))}
        {entries.length === 0 ? (
          <div className="text-sm text-zinc-400">Belum ada data.</div>
        ) : null}
        {isEditing ? (
          <Button variant="secondary" size="sm" onClick={() => addCheckup(phase)}>
            + Tambah {phaseLabel.toLowerCase()}
          </Button>
        ) : null}
      </div>
    );
  }

  function renderLiniCard(entry: LiniEntry, idx: number) {
    return (
      <div key={entry.id} className="space-y-4 rounded-2xl border border-zinc-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="text-sm font-semibold text-zinc-800">Lini {idx + 1}</div>
            <div className="w-40">
              <DiagnosisField
                field={{
                  label: "Siklus",
                  value: entry.siklus,
                  onChange: (v) => updateLini(entry.id, { siklus: v }),
                }}
                isEditing={isEditing}
                kind="text"
              />
            </div>
          </div>
          {isEditing ? (
            <button
              type="button"
              onClick={() => removeLini(entry.id)}
              className="text-xs font-medium text-red-600 hover:text-red-500"
            >
              Hapus
            </button>
          ) : null}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-800">Regimen kemoterapi</label>
          {entry.drugs.map((drug) =>
            isEditing ? (
              <div key={drug.id} className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="nama obat"
                  value={drug.nama}
                  onChange={(e) => updateDrug(entry.id, drug.id, { nama: e.target.value })}
                  className={cn(fieldClass, "min-w-0 flex-1")}
                />
                <div className="w-28 shrink-0">
                  <input
                    type="text"
                    placeholder="dosis"
                    value={drug.dosis}
                    onChange={(e) => updateDrug(entry.id, drug.id, { dosis: e.target.value })}
                    className={fieldClass}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeDrug(entry.id, drug.id)}
                  className="text-xs font-medium text-red-600 hover:text-red-500"
                >
                  Hapus
                </button>
              </div>
            ) : (
              <div
                key={drug.id}
                className="flex items-center gap-3 rounded-xl border border-zinc-100 bg-zinc-50/60 px-3.5 py-2.5"
              >
                <div className="min-w-0 flex-1 break-words text-sm font-medium text-zinc-900">
                  {drug.nama || <span className="text-zinc-400">-</span>}
                </div>
                <div className="w-28 shrink-0 text-sm text-zinc-700">
                  {drug.dosis || <span className="text-zinc-400">-</span>}
                </div>
              </div>
            ),
          )}
          {entry.drugs.length === 0 ? (
            <div className="text-sm text-zinc-400">Belum ada data.</div>
          ) : null}
          {isEditing ? (
            <Button variant="secondary" size="sm" onClick={() => addDrug(entry.id)}>
              + Tambah obat
            </Button>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <DiagnosisField
            field={{
              label: "Awal-akhir kemoterapi",
              value: entry.awalAkhirKemoterapi,
              onChange: (v) => updateLini(entry.id, { awalAkhirKemoterapi: v }),
            }}
            isEditing={isEditing}
            kind="text"
          />
          <DiagnosisField
            field={{
              label: "Follow up terakhir",
              value: entry.followUpTerakhir,
              onChange: (v) => updateLini(entry.id, { followUpTerakhir: v }),
            }}
            isEditing={isEditing}
            kind="text"
          />
          <DiagnosisField
            field={{
              label: "Respon kemoterapi",
              value: entry.responKemoterapi,
              onChange: (v) => updateLini(entry.id, { responKemoterapi: v }),
            }}
            isEditing={isEditing}
            kind="text"
          />
        </div>
      </div>
    );
  }

  const outcomeFields: Field[] = [
    {
      label: "Status remission/refrakter/relapse",
      value: state.outcome.statusRemission,
      onChange: (v) => updateOutcome({ statusRemission: v }),
    },
    {
      label: "Lost to follow up (>12 bulan CR)",
      value: state.outcome.lostToFollowUp,
      onChange: (v) => updateOutcome({ lostToFollowUp: v }),
    },
    {
      label: "Time to event (bulan)",
      value: state.outcome.timeToEvent,
      onChange: (v) => updateOutcome({ timeToEvent: v }),
    },
    { label: "DX", value: state.outcome.dx, onChange: (v) => updateOutcome({ dx: v }) },
  ];

  const rawDataHeaders = React.useMemo(
    () => headers.filter((h) => !isHeaderMapped(h, MAPPED_HEADER_NEEDLES)),
    [headers],
  );

  if (deleted) {
    return (
      <div className="rounded-3xl border border-zinc-200 bg-white p-10 text-center">
        <div className="text-sm font-semibold text-zinc-900">
          Data telah dihapus.
        </div>
        <Link
          href={backHref}
          className="mt-4 inline-flex h-10 items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800"
        >
          &larr; Kembali ke daftar
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={backHref}
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-white px-4 text-sm font-medium text-zinc-900 ring-1 ring-inset ring-zinc-200 hover:bg-zinc-50"
        >
          &larr; Back
        </Link>
        <div className="flex items-center gap-2 text-xl font-semibold text-zinc-900">
          {title}
        </div>
        {isEditing ? (
          <select
            value={state.status ?? ""}
            onChange={(e) =>
              setState((s) => ({
                ...s,
                status: (e.target.value || undefined) as RecordStatus | undefined,
              }))
            }
            className="h-9 rounded-lg bg-white px-2.5 text-sm text-zinc-900 ring-1 ring-inset ring-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-400"
          >
            <option value="">Status: -</option>
            <option value="include">Include</option>
            <option value="exclude">Exclude</option>
            <option value="tidak_lengkap">Tidak Lengkap</option>
          </select>
        ) : (
          <StatusBadge status={state.status} />
        )}
        {!isEditing && savedMessage ? (
          <span className="text-xs text-zinc-500">{savedMessage}</span>
        ) : null}
        {!isEditing ? (
          <Button className="ml-auto" variant="secondary" onClick={handleEdit}>
            Edit
          </Button>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr] lg:items-start">
        <Card className="lg:sticky lg:top-24">
          <CardContent className="p-5">
            <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Identitas pasien
            </div>
            <div className="space-y-4">
              {identityFields.map((field) => (
                <div key={field.label}>
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                    {field.label}
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={field.value}
                      onChange={(e) => field.onChange(e.target.value)}
                      className="mt-1 h-9 w-full rounded-lg bg-white px-2.5 text-sm text-zinc-900 ring-1 ring-inset ring-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-400"
                    />
                  ) : (
                    <div className="break-words text-sm font-medium text-zinc-900">
                      {field.value || <span className="text-zinc-400">-</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-8">
          <div className="space-y-6">
              <Section title="Diagnosis">
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4">
                    <DiagnosisField
                      field={leaderField}
                      isEditing={isEditing}
                      kind="select"
                      options={LEADER_OPTIONS}
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <DiagnosisField
                      field={tegakDiagnosisField}
                      isEditing={isEditing}
                      kind="date"
                    />
                    <DiagnosisField field={lokasiPaField} isEditing={isEditing} kind="text" />
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <DiagnosisField field={hasilPaField} isEditing={isEditing} kind="text" />
                    <DiagnosisField field={ihkField} isEditing={isEditing} kind="text" />
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <DiagnosisField
                      field={subtipeField}
                      isEditing={isEditing}
                      kind="select"
                      options={SUBTIPE_OPTIONS}
                    />
                    <DiagnosisField
                      field={ecogField}
                      isEditing={isEditing}
                      kind="select"
                      options={ECOG_OPTIONS}
                    />
                    <DiagnosisField
                      field={stadiumField}
                      isEditing={isEditing}
                      kind="select"
                      options={STADIUM_OPTIONS}
                    />
                  </div>
                </div>
              </Section>

              <Section title="Riwayat penyakit & komorbiditas">
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Jumlah komorbiditas
                  </span>
                  <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700">
                    {jumlahKomorbiditas}
                  </span>
                </div>
                <EditableHistoryTable items={comorbidityItems} isEditing={isEditing} />

                <div className="mt-5 border-t border-zinc-100 pt-5">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Double primary tumours
                  </div>
                  <EditableHistoryTable items={[doublePrimaryField]} isEditing={isEditing} />
                </div>
              </Section>

              <Section title="Pemeriksaan penunjang">
                <div className="space-y-6">
                  <div>
                    <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Pre-kemo
                    </div>
                    {renderPhaseSection("pre", "Pre-kemo")}
                  </div>
                  <div>
                    <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      During kemo
                    </div>
                    {renderPhaseSection("during", "During kemo")}
                  </div>
                  <div>
                    <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Post kemo
                    </div>
                    {renderPhaseSection("post", "Post kemo")}
                  </div>
                </div>
              </Section>

              <Section title="Status BMI">
                <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                  <DiagnosisField
                    field={{
                      label: "BB (kg)",
                      value: state.bb,
                      onChange: (v) => setState((s) => ({ ...s, bb: v })),
                    }}
                    isEditing={isEditing}
                    kind="text"
                  />
                  <DiagnosisField
                    field={{
                      label: "TB (cm)",
                      value: state.tb,
                      onChange: (v) => setState((s) => ({ ...s, tb: v })),
                    }}
                    isEditing={isEditing}
                    kind="text"
                  />
                  <DiagnosisField
                    field={{
                      label: "IMT",
                      value: computeImt(state.bb, state.tb),
                      onChange: () => undefined,
                    }}
                    isEditing={false}
                    kind="text"
                  />
                  <DiagnosisField
                    field={{
                      label: "Kategori IMT",
                      value: categorizeImt(computeImt(state.bb, state.tb)),
                      onChange: () => undefined,
                    }}
                    isEditing={false}
                    kind="text"
                  />
                  <DiagnosisField
                    field={{
                      label: "BSA",
                      value: state.bsa,
                      onChange: (v) => setState((s) => ({ ...s, bsa: v })),
                    }}
                    isEditing={isEditing}
                    kind="text"
                  />
                </div>
              </Section>

              <Section title="Siklus kemoterapi">
                <div className="space-y-4">
                  {state.liniList.map((lini, idx) => renderLiniCard(lini, idx))}
                  {state.liniList.length === 0 ? (
                    <div className="text-sm text-zinc-400">Belum ada data.</div>
                  ) : null}
                  {isEditing ? (
                    <Button variant="secondary" size="sm" onClick={addLini}>
                      + Tambah lini
                    </Button>
                  ) : null}
                </div>
              </Section>

              <Section title="Ringkasan & outcome">
                <EditableGrid fields={outcomeFields} isEditing={isEditing} />
              </Section>

              {rawDataHeaders.length ? (
                <Card>
                  <CardContent className="p-6">
                    <details>
                      <summary className="cursor-pointer text-sm font-semibold text-zinc-700">
                        Data mentah dari spreadsheet
                      </summary>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        {rawDataHeaders.map((h) => (
                          <div key={h} className="rounded-xl border border-zinc-200 p-3">
                            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                              {h}
                            </div>
                            <div className="mt-1 break-words text-sm text-zinc-900">
                              {row[h] || <span className="text-zinc-400">(empty)</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </details>
                  </CardContent>
                </Card>
              ) : null}
          </div>

          {isEditing ? (
            <div className="sticky bottom-4 z-10 flex items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white/95 px-6 py-4 shadow-[0_20px_70px_-30px_rgba(0,0,0,0.35)] backdrop-blur">
              <div>
                {confirmingDelete ? (
                  <div className="flex items-center gap-2 text-sm text-zinc-700">
                    Hapus data ini?
                    <Button variant="danger" size="sm" onClick={handleDelete}>
                      Ya, hapus
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setConfirmingDelete(false)}
                    >
                      Batal
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="danger"
                    onClick={() => setConfirmingDelete(true)}
                  >
                    Delete
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-3">
                {savedMessage ? (
                  <span className="text-xs text-zinc-500">{savedMessage}</span>
                ) : null}
                <Button variant="secondary" onClick={handleCancel}>
                  Cancel
                </Button>
                <Button variant="warning" onClick={handleUpdate}>
                  Update
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

const fieldClass =
  "h-11 w-full rounded-xl bg-white px-3.5 text-sm text-zinc-900 ring-1 ring-inset ring-zinc-200 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400 disabled:bg-zinc-50 disabled:text-zinc-500";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="mb-5 flex items-center gap-2.5 border-b border-zinc-100 pb-4">
          <div className="h-5 w-1 rounded-full bg-zinc-900" />
          <h2 className="text-base font-semibold text-zinc-900">{title}</h2>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function EditableGrid({
  fields,
  isEditing,
}: {
  fields: Field[];
  isEditing: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
      {fields.map((field) => (
        <div key={field.label} className="min-w-0">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            {field.label}
          </label>
          {isEditing ? (
            <input
              type="text"
              value={field.value}
              onChange={(e) => field.onChange(e.target.value)}
              className="mt-1 h-9 w-full rounded-lg bg-white px-2.5 text-sm text-zinc-900 ring-1 ring-inset ring-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-400"
            />
          ) : (
            <div className="break-words text-sm font-medium text-zinc-900">
              {field.value || <span className="text-zinc-400">-</span>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function DiagnosisField({
  field,
  isEditing,
  kind,
  options,
}: {
  field: Field;
  isEditing: boolean;
  kind: "text" | "date" | "select";
  options?: string[];
}) {
  return (
    <div className="min-w-0">
      <label className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
        {field.label}
      </label>
      {isEditing ? (
        kind === "select" ? (
          <select
            value={field.value}
            onChange={(e) => field.onChange(e.target.value)}
            className="mt-1 h-9 w-full rounded-lg bg-white px-2.5 text-sm text-zinc-900 ring-1 ring-inset ring-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-400"
          >
            <option value="">-</option>
            {(options ?? []).map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        ) : (
          <input
            type={kind === "date" ? "date" : "text"}
            value={field.value}
            onChange={(e) => field.onChange(e.target.value)}
            className="mt-1 h-9 w-full rounded-lg bg-white px-2.5 text-sm text-zinc-900 ring-1 ring-inset ring-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-400"
          />
        )
      ) : (
        <div className="break-words text-sm font-medium text-zinc-900">
          {field.value || <span className="text-zinc-400">-</span>}
        </div>
      )}
    </div>
  );
}

function BooleanBadge({ value }: { value: string }) {
  const v = value.trim().toLowerCase();
  if (v === "ya") {
    return (
      <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
        Ya
      </span>
    );
  }
  if (v === "tidak") {
    return (
      <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600">
        Tidak
      </span>
    );
  }
  return <span className="text-xs text-zinc-400">{value || "-"}</span>;
}

function EditableHistoryTable({
  items,
  isEditing,
}: {
  items: Field[];
  isEditing: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200">
      <table className="w-full text-sm">
        <tbody>
          {items.map((item, idx) => (
            <tr key={item.label} className={idx > 0 ? "border-t border-zinc-100" : ""}>
              <td className="px-4 py-3 text-zinc-700">{item.label}</td>
              <td className="px-4 py-3 text-right">
                {isEditing ? (
                  <select
                    value={item.value}
                    onChange={(e) => item.onChange(e.target.value)}
                    className="h-8 rounded-lg bg-white px-2 text-xs text-zinc-900 ring-1 ring-inset ring-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-400"
                  >
                    <option value="">-</option>
                    <option value="Ya">Ya</option>
                    <option value="Tidak">Tidak</option>
                  </select>
                ) : (
                  <BooleanBadge value={item.value} />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function parsePercent(value: string): number | null {
  const cleaned = value.trim().replace(",", ".").replace("%", "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (Number.isNaN(n)) return null;
  return Math.min(100, Math.max(0, n));
}

function parseDecimal(value: string): number | null {
  const cleaned = value.trim().replace(",", ".");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isNaN(n) ? null : n;
}

function safeDivide(a: number | null, b: number | null): number | null {
  if (a === null || b === null || b === 0) return null;
  return a / b;
}

function formatComputed(n: number | null): string {
  if (n === null) return "-";
  const rounded = Math.round(n * 100) / 100;
  return rounded.toString().replace(".", ",");
}

// IMT = BB(kg) / TB(m)^2 — TB is stored in cm, so convert to meters first.
function computeImt(bb: string, tb: string): string {
  const bbKg = parseDecimal(bb);
  const tbCm = parseDecimal(tb);
  if (bbKg === null || tbCm === null || tbCm === 0) return "";
  const tbM = tbCm / 100;
  return formatComputed(bbKg / (tbM * tbM));
}

// BMI classification per WHO Asia-Pacific cutoffs: <18.5 underweight,
// 18.5–24.9 normoweight, 25–29.9 overweight, >=30 obese.
function categorizeImt(rawImt: string): string {
  const n = parseDecimal(rawImt);
  if (n === null) return "";
  if (n < 18.5) return "Underweight";
  if (n < 25) return "Normoweight";
  if (n < 30) return "Overweight";
  return "Obese";
}

function EditableLeukositTable({
  items,
  isEditing,
}: {
  items: Field[];
  isEditing: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600">
            <th className="px-4 py-3">Jenis leukosit</th>
            <th className="px-4 py-3">Persentase</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => {
            const pct = parsePercent(item.value);
            return (
              <tr key={item.label} className={idx > 0 ? "border-t border-zinc-100" : ""}>
                <td className="px-4 py-3 text-zinc-700">{item.label}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {isEditing ? (
                      <input
                        type="text"
                        value={item.value}
                        onChange={(e) => item.onChange(e.target.value)}
                        className="h-8 w-20 shrink-0 rounded-lg bg-white px-2 text-sm text-zinc-900 ring-1 ring-inset ring-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-400"
                      />
                    ) : (
                      <span className="w-14 shrink-0 font-medium text-zinc-900">
                        {item.value ? `${item.value}%` : <span className="text-zinc-400">-</span>}
                      </span>
                    )}
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100">
                      {pct !== null ? (
                        <div
                          className="h-full rounded-full bg-zinc-400"
                          style={{ width: `${pct}%` }}
                        />
                      ) : null}
                    </div>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ComputedValueTable({ items }: { items: { label: string; value: string }[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200">
      <table className="w-full text-sm">
        <tbody>
          {items.map((item, idx) => (
            <tr key={item.label} className={idx > 0 ? "border-t border-zinc-100" : ""}>
              <td className="px-4 py-3 text-zinc-700">{item.label}</td>
              <td className="px-4 py-3 text-right font-medium text-zinc-900">
                {item.value === "-" ? <span className="text-zinc-400">-</span> : item.value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
