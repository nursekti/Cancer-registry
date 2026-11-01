"use client";

import * as React from "react";
import Link from "next/link";
import { DatedEntriesField, LongTextField } from "@/components/LongText";
import { OptionSelect, SheetDropdownsProvider } from "@/components/OptionSelect";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { loadAddedRows } from "@/lib/addedRows";
import { fetchImtFormulas } from "@/lib/fetchImtFormulas";
import {
  DOSIS_RADIOTERAPI_OPTIONS,
  ECOG_OPTIONS,
  JK_OPTIONS,
  METASTASIS_OPTIONS,
  NODAL_TYPE_OPTIONS,
  PENDIDIKAN_OPTIONS,
  RADIOTERAPI_OPTIONS,
  RESPON_KEMOTERAPI_OPTIONS,
  STADIUM_OPTIONS,
  optionsForType,
  rejimenOptions,
} from "@/lib/fieldOptions";
import { FieldRef, headerFor, seedFromSheet } from "@/lib/sheetColumns";
import {
  applySheetUpdates,
  sheetUpdatesFor,
  sheetWriteEnabled,
  writeRowToSheet,
} from "@/lib/sheetWriteBack";
import {
  CheckupEntry,
  DiagnosisFields,
  DrugRow,
  ExamPhase,
  IdentityFields,
  LabFields,
  LiniEntry,
  OutcomeFields,
  RadioterapiFields,
  RecordStatus,
  RiwayatFields,
  RowOverride,
  diffOverride,
  emptyCheckup,
  emptyLini,
  emptyOverride,
  findHeaderValue,
  loadOverride,
  markDeleted,
  mergeOverride,
  newId,
  rowKey,
  saveOverride,
} from "@/lib/rowOverrides";

type Row = Record<string, string>;
type Field = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  // The sheet column behind a dropdown field; its options (and new labels)
  // come from that column's dropdown in the sheet.
  sheetHeader?: string;
};

const EXAM_TYPE_OPTIONS = ["CT scan", "Rontgen", "USG", "Bone survey"];
const YA_TIDAK_OPTIONS = ["Ya", "Tidak"];

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
  seedFromSheet(base, row, headers);

  // The sheet's Regimen/Siklus columns are free text describing the first
  // line of therapy; the rest of lini 1 (and lini 2, when the sheet has it)
  // comes from its own columns via seedFromSheet.
  const regimen = findHeaderValue(row, headers, "regimen kemoterapi");
  const lini1 = base.liniList[0] ?? emptyLini();
  base.liniList[0] = {
    ...lini1,
    siklus: parseSiklusCount(findHeaderValue(row, headers, "siklus kemoterapi")),
    regimen,
    drugs: splitRegimen(regimen),
  };
  return base;
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
  const col = (ref: FieldRef) => headerFor(ref, headers);
  // What the sheet alone says about this patient; saves store only the
  // fields that differ from it.
  const [baseline, setBaseline] = React.useState<RowOverride>(() =>
    buildInitialOverride(row, headers),
  );
  const [state, setState] = React.useState<RowOverride>(() => {
    const stored = loadOverride(key);
    return stored ? mergeOverride(baseline, stored) : baseline;
  });

  // Overrides saved before only-changed-fields storage are full copies of the
  // sheet as it was back then. Trim the fields that still match the sheet so
  // they go back to following it.
  React.useEffect(() => {
    const stored = loadOverride(key);
    if (!stored) return;
    const trimmed = diffOverride(baseline, mergeOverride(baseline, stored));
    if (JSON.stringify(trimmed) !== JSON.stringify(stored)) saveOverride(key, trimmed);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-time cleanup per patient
  }, [key]);

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
        setBaseline((b) => (b.bb || b.tb ? b : { ...b, bb: derived.bb, tb: derived.tbCm }));
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

  // The page first renders from the cached sheet, then a fresh copy may
  // arrive. Re-seed from it (keeping saved browser edits on top), but never
  // under an edit in progress — that waits until Simpan/Batal.
  const [seededRow, setSeededRow] = React.useState(row);
  if (row !== seededRow && !isEditing) {
    setSeededRow(row);
    const fresh = buildInitialOverride(row, headers);
    const stored = loadOverride(key);
    setBaseline(fresh);
    setState(stored ? mergeOverride(fresh, stored) : fresh);
  }

  async function persist(next: RowOverride, message: string) {
    // Only what was changed in this edit session goes to the sheet; older
    // browser-only edits stay local rather than overwriting newer sheet data.
    const sessionChanges = diffOverride(preEditSnapshot ?? baseline, next);
    saveOverride(key, diffOverride(baseline, next));
    setState(next);
    setSavedMessage(message);
    onSaved(key, next);
    setIsEditing(false);
    setPreEditSnapshot(null);

    const isSheetRow = !loadAddedRows(cancerType).some((r) => rowKey(r) === key);
    const updates =
      sheetWriteEnabled && csvUrl && isSheetRow
        ? sheetUpdatesFor(sessionChanges, headers)
        : [];
    if (!csvUrl || !updates.length) return;

    setSavedMessage("Menyimpan ke spreadsheet...");
    try {
      const { written, skipped } = await writeRowToSheet(csvUrl, row, updates);
      const nextBaseline = applySheetUpdates(baseline, sessionChanges, written);
      setBaseline(nextBaseline);
      saveOverride(key, diffOverride(nextBaseline, next));
      setSavedMessage(
        skipped.length
          ? `Tersimpan ke spreadsheet, kecuali: ${skipped.join(", ")}.`
          : "Tersimpan ke spreadsheet.",
      );
    } catch (e) {
      setSavedMessage(
        `Tersimpan di browser saja, gagal menulis ke spreadsheet: ${
          e instanceof Error ? e.message : "Unknown error"
        }`,
      );
    }
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
    void persist(state, "Tersimpan.");
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

  function updateLab(patch: Partial<LabFields>) {
    setState((s) => ({ ...s, lab: { ...s.lab, ...patch } }));
  }

  function updateRadioterapi(patch: Partial<RadioterapiFields>) {
    setState((s) => ({ ...s, radioterapi: { ...s.radioterapi, ...patch } }));
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

  const identityFields: Array<{
    field: Field;
    kind: "text" | "select";
    options?: string[];
  }> = [
    {
      field: { label: "Nama", value: state.identity.nama, onChange: (v) => updateIdentity({ nama: v }) },
      kind: "text",
    },
    {
      field: {
        label: "No ERM",
        value: state.identity.noErm,
        onChange: (v) => updateIdentity({ noErm: v }),
      },
      kind: "text",
    },
    {
      field: { label: "NIK", value: state.identity.nik, onChange: (v) => updateIdentity({ nik: v }) },
      kind: "text",
    },
    {
      field: {
        label: "Tahun",
        value: state.identity.tahun,
        onChange: (v) => updateIdentity({ tahun: v }),
      },
      kind: "text",
    },
    {
      field: {
        label: "JK",
        value: state.identity.jk,
        onChange: (v) => updateIdentity({ jk: v }),
        sheetHeader: col({ section: "identity", field: "jk" }),
      },
      kind: "select",
      options: JK_OPTIONS,
    },
    {
      field: { label: "Usia", value: state.identity.usia, onChange: (v) => updateIdentity({ usia: v }) },
      kind: "text",
    },
    {
      field: {
        label: "Pendidikan terakhir",
        value: state.identity.pendidikan,
        onChange: (v) => updateIdentity({ pendidikan: v }),
        sheetHeader: col({ section: "identity", field: "pendidikan" }),
      },
      kind: "select",
      options: PENDIDIKAN_OPTIONS,
    },
    {
      field: {
        label: "Pekerjaan",
        value: state.identity.pekerjaan,
        onChange: (v) => updateIdentity({ pekerjaan: v }),
      },
      kind: "text",
    },
    {
      field: {
        label: "No HP",
        value: state.identity.noHp,
        onChange: (v) => updateIdentity({ noHp: v }),
      },
      kind: "text",
    },
  ];

  const typeOptions = optionsForType(cancerType);

  const leaderField: Field = {
    label: "Leader",
    value: state.diagnosis.leader,
    onChange: (v) => updateDiagnosis({ leader: v }),
    sheetHeader: col({ section: "diagnosis", field: "leader" }),
  };
  const nodalTypeField: Field = {
    label: "Nodal / extranodal",
    value: state.diagnosis.nodalType,
    onChange: (v) => updateDiagnosis({ nodalType: v }),
    sheetHeader: col({ section: "diagnosis", field: "nodalType" }),
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
  const subtipeField: Field = {
    label: "Subtipe",
    value: state.diagnosis.subtipe,
    onChange: (v) => updateDiagnosis({ subtipe: v }),
    sheetHeader: col({ section: "diagnosis", field: "subtipe" }),
  };
  const ecogField: Field = {
    label: "ECOG score",
    value: state.diagnosis.ecogScore,
    onChange: (v) => updateDiagnosis({ ecogScore: v }),
    sheetHeader: col({ section: "diagnosis", field: "ecogScore" }),
  };
  const stadiumField: Field = {
    label: "Stadium (Ann-Arbor)",
    value: state.diagnosis.stadium,
    onChange: (v) => updateDiagnosis({ stadium: v }),
    sheetHeader: col({ section: "diagnosis", field: "stadium" }),
  };
  const metastasisField: Field = {
    label: "Metastasis",
    value: state.diagnosis.metastasis,
    onChange: (v) => updateDiagnosis({ metastasis: v }),
    sheetHeader: col({ section: "diagnosis", field: "metastasis" }),
  };

  function riwayatItem(label: string, field: keyof RiwayatFields): Field {
    return {
      label,
      value: state.riwayat[field],
      onChange: (v) => updateRiwayat({ [field]: v }),
      sheetHeader: col({ section: "riwayat", field }),
    };
  }

  const comorbidityItems: Field[] = [
    riwayatItem("Kanker keluarga", "kankerKeluarga"),
    riwayatItem("Diabetes melitus (DM)", "dm"),
    riwayatItem("Hipertensi (HT)", "ht"),
    riwayatItem("Penyakit jantung", "penyakitJantung"),
    riwayatItem("Hepatitis B", "hepatitisB"),
    riwayatItem("CKD", "ckd"),
    riwayatItem("PPOK", "ppok"),
    riwayatItem("HIV", "hiv"),
  ];

  const doublePrimaryField = riwayatItem("Double primary tumours", "doublePrimary");

  const jumlahKomorbiditas = comorbidityItems.filter(
    (item) => item.value.trim().toLowerCase() === "ya",
  ).length;

  const labFields: Field[] = [
    { label: "HB", value: state.lab.hb, onChange: (v) => updateLab({ hb: v }) },
    { label: "Trombosit", value: state.lab.trombosit, onChange: (v) => updateLab({ trombosit: v }) },
    {
      label: "Leukosit sebelum kemoterapi",
      value: state.lab.leukositSebelum,
      onChange: (v) => updateLab({ leukositSebelum: v }),
    },
    { label: "LDH", value: state.lab.ldh, onChange: (v) => updateLab({ ldh: v }) },
  ];

  const leukositFields: Field[] = [
    { label: "Eosinofil", value: state.lab.eosinofil, onChange: (v) => updateLab({ eosinofil: v }) },
    { label: "Basofil", value: state.lab.basofil, onChange: (v) => updateLab({ basofil: v }) },
    { label: "Neutrofil", value: state.lab.neutrofil, onChange: (v) => updateLab({ neutrofil: v }) },
    { label: "Limfosit", value: state.lab.limfosit, onChange: (v) => updateLab({ limfosit: v }) },
    { label: "Monosit", value: state.lab.monosit, onChange: (v) => updateLab({ monosit: v }) },
  ];

  const computedLabRows = computeLabRatios(state.lab);

  function renderExamRow(entry: CheckupEntry) {
    const typeLabels = [...entry.types, ...entry.customTypes.filter(Boolean)];
    return (
      <div key={entry.id} className="space-y-3 rounded-2xl border border-zinc-200 p-4">
        <div className="flex flex-wrap items-start gap-4">
          <div className="w-44">
            <DiagnosisField
              field={{
                label: "Tanggal periksa",
                value: entry.tanggal,
                onChange: (v) => updateCheckup(entry.id, { tanggal: v }),
              }}
              isEditing={isEditing}
              kind="date"
            />
          </div>
          <div className="min-w-0 flex-1">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Jenis pemeriksaan
            </label>
            {isEditing ? (
              <div className="mt-1.5 flex flex-wrap items-center gap-3">
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
                      className="h-8 w-32 rounded-lg bg-white px-2.5 text-xs text-zinc-900 ring-1 ring-inset ring-zinc-200 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-accent-500"
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
              <div className="mt-1.5 flex flex-wrap gap-2">
                {typeLabels.length ? (
                  typeLabels.map((type, idx) => (
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
        <LongTextField
          label="Hasil"
          value={entry.hasil}
          onChange={(v) => updateCheckup(entry.id, { hasil: v })}
          isEditing={isEditing}
        />
      </div>
    );
  }

  function renderPhaseSection(phase: ExamPhase) {
    const entries = state.checkups.filter((c) => c.phase === phase);
    return (
      <div className="space-y-3">
        {entries.map(renderExamRow)}
        {entries.length === 0 ? (
          <div className="text-sm text-zinc-400">Belum ada pemeriksaan.</div>
        ) : null}
        {isEditing ? (
          <Button variant="secondary" size="sm" onClick={() => addCheckup(phase)}>
            + Tambah pemeriksaan
          </Button>
        ) : null}
      </div>
    );
  }

  function renderLiniCard(entry: LiniEntry, idx: number) {
    return (
      <div key={entry.id} className="space-y-4 rounded-2xl border border-zinc-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
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
            <div className="w-56">
              <DiagnosisField
                field={{
                  label: `Rejimen lini ${idx + 1}`,
                  value: entry.rejimen,
                  onChange: (v) => updateLini(entry.id, { rejimen: v }),
                  sheetHeader: col({ section: "lini", index: idx, field: "rejimen" }),
                }}
                isEditing={isEditing}
                kind="select"
                options={rejimenOptions(idx)}
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

        <div className="grid gap-3 sm:grid-cols-2">
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
              label: "Respon kemoterapi",
              value: entry.responKemoterapi,
              onChange: (v) => updateLini(entry.id, { responKemoterapi: v }),
              sheetHeader: col({ section: "lini", index: idx, field: "responKemoterapi" }),
            }}
            isEditing={isEditing}
            kind="select"
            options={RESPON_KEMOTERAPI_OPTIONS}
          />
        </div>
      </div>
    );
  }

  const outcomeFields: Field[] = [
    {
      label: "Follow up terakhir",
      value: state.outcome.followUpTerakhir,
      onChange: (v) => updateOutcome({ followUpTerakhir: v }),
    },
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

  const phaseLabelClass = "mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500";

  if (deleted) {
    return (
      <div className="rounded-3xl border border-zinc-200 bg-white p-10 text-center">
        <div className="text-sm font-semibold text-zinc-900">
          Data telah dihapus.
        </div>
        <Link
          href={backHref}
          className="mt-4 inline-flex h-10 items-center justify-center rounded-xl bg-primary-700 px-4 text-sm font-medium text-white hover:bg-primary-600"
        >
          &larr; Kembali ke daftar
        </Link>
      </div>
    );
  }

  return (
    <SheetDropdownsProvider csvUrl={csvUrl}>
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
              className="h-9 rounded-lg bg-white px-2.5 text-sm text-zinc-900 ring-1 ring-inset ring-zinc-200 focus:outline-none focus:ring-2 focus:ring-accent-500"
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
                {identityFields.map(({ field, kind, options }) => (
                  <DiagnosisField
                    key={field.label}
                    field={field}
                    isEditing={isEditing}
                    kind={kind}
                    options={options}
                  />
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-8">
            <div className="space-y-6">
              <Section title="Diagnosis">
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <DiagnosisField
                      field={leaderField}
                      isEditing={isEditing}
                      kind="select"
                      options={typeOptions.leader}
                    />
                    <DiagnosisField
                      field={nodalTypeField}
                      isEditing={isEditing}
                      kind="select"
                      options={NODAL_TYPE_OPTIONS}
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <DiagnosisField field={tegakDiagnosisField} isEditing={isEditing} kind="date" />
                    <DiagnosisField field={lokasiPaField} isEditing={isEditing} kind="text" />
                  </div>
                  <DatedEntriesField
                    label="Hasil PA"
                    value={state.diagnosis.hasilPa}
                    onChange={(v) => updateDiagnosis({ hasilPa: v })}
                    isEditing={isEditing}
                  />
                  <DatedEntriesField
                    label="Hasil imunohistokimia (IHK)"
                    value={state.diagnosis.subtipeImunohistokimia}
                    onChange={(v) => updateDiagnosis({ subtipeImunohistokimia: v })}
                    isEditing={isEditing}
                  />
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <DiagnosisField
                      field={subtipeField}
                      isEditing={isEditing}
                      kind="select"
                      options={typeOptions.subtipe}
                    />
                    <DiagnosisField
                      field={ecogField}
                      isEditing={isEditing}
                      kind="select"
                      options={ECOG_OPTIONS}
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
                    <div className={phaseLabelClass}>Laboratorium</div>
                    <EditableGrid fields={labFields} isEditing={isEditing} />
                  </div>
                  <div>
                    <div className={phaseLabelClass}>Jumlah leukosit</div>
                    <EditableLeukositTable items={leukositFields} isEditing={isEditing} />
                  </div>
                  <div>
                    <div className={phaseLabelClass}>ANC / ALC / NLR / LMR / PLR</div>
                    <ComputedValueTable items={computedLabRows} />
                  </div>

                  <div className="border-t border-zinc-100 pt-6">
                    <div className={phaseLabelClass}>Pre-kemo</div>
                    <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <DiagnosisField
                        field={stadiumField}
                        isEditing={isEditing}
                        kind="select"
                        options={STADIUM_OPTIONS}
                      />
                      <DiagnosisField
                        field={metastasisField}
                        isEditing={isEditing}
                        kind="select"
                        options={METASTASIS_OPTIONS}
                      />
                    </div>
                    {renderPhaseSection("pre")}
                  </div>
                  <div>
                    <div className={phaseLabelClass}>During kemo</div>
                    {renderPhaseSection("during")}
                  </div>
                  <div>
                    <div className={phaseLabelClass}>Post kemo</div>
                    {renderPhaseSection("post")}
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
                      label: "BSA (m²)",
                      value: computeBsa(state.bb, state.tb),
                      onChange: () => undefined,
                    }}
                    isEditing={false}
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
                  <div className="border-t border-zinc-100 pt-4">
                    <LongTextField
                      label="Chemotherapy side effect"
                      value={state.chemoSideEffect}
                      onChange={(v) => setState((s) => ({ ...s, chemoSideEffect: v }))}
                      isEditing={isEditing}
                    />
                  </div>
                </div>
              </Section>

              <Section title="Radioterapi">
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <DiagnosisField
                      field={{
                        label: "Radioterapi",
                        value: state.radioterapi.radioterapi,
                        onChange: (v) => updateRadioterapi({ radioterapi: v }),
                        sheetHeader: col({ section: "radioterapi", field: "radioterapi" }),
                      }}
                      isEditing={isEditing}
                      kind="select"
                      options={RADIOTERAPI_OPTIONS}
                    />
                    <DiagnosisField
                      field={{
                        label: "Dosis radioterapi",
                        value: state.radioterapi.dosis,
                        onChange: (v) => updateRadioterapi({ dosis: v }),
                        sheetHeader: col({ section: "radioterapi", field: "dosis" }),
                      }}
                      isEditing={isEditing}
                      kind="select"
                      options={DOSIS_RADIOTERAPI_OPTIONS}
                    />
                  </div>
                  <DiagnosisField
                    field={{
                      label: "Respon radioterapi",
                      value: state.radioterapi.respon,
                      onChange: (v) => updateRadioterapi({ respon: v }),
                    }}
                    isEditing={isEditing}
                    kind="text"
                  />
                </div>
              </Section>

              <Section title="Ringkasan & outcome">
                <EditableGrid fields={outcomeFields} isEditing={isEditing} />
              </Section>
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
    </SheetDropdownsProvider>
  );
}

const fieldClass =
  "h-11 w-full rounded-xl bg-white px-3.5 text-sm text-zinc-900 ring-1 ring-inset ring-zinc-200 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-accent-500 disabled:bg-zinc-50 disabled:text-zinc-500";

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
          <div className="h-5 w-1 rounded-full bg-primary-700" />
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
              className="mt-1 h-9 w-full rounded-lg bg-white px-2.5 text-sm text-zinc-900 ring-1 ring-inset ring-zinc-200 focus:outline-none focus:ring-2 focus:ring-accent-500"
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
        kind === "select" && (options?.length || field.sheetHeader) ? (
          <OptionSelect
            value={field.value}
            onChange={field.onChange}
            options={options ?? []}
            sheetHeader={field.sheetHeader}
            className="mt-1 h-9 w-full rounded-lg bg-white px-2.5 text-sm text-zinc-900 ring-1 ring-inset ring-zinc-200 focus:outline-none focus:ring-2 focus:ring-accent-500"
          />
        ) : (
          <input
            type={kind === "date" ? "date" : "text"}
            value={field.value}
            onChange={(e) => field.onChange(e.target.value)}
            className="mt-1 h-9 w-full rounded-lg bg-white px-2.5 text-sm text-zinc-900 ring-1 ring-inset ring-zinc-200 focus:outline-none focus:ring-2 focus:ring-accent-500"
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
                  <div className="inline-block text-left">
                    <OptionSelect
                      value={item.value}
                      onChange={item.onChange}
                      options={YA_TIDAK_OPTIONS}
                      sheetHeader={item.sheetHeader}
                      className="h-8 rounded-lg bg-white px-2 text-xs text-zinc-900 ring-1 ring-inset ring-zinc-200 focus:outline-none focus:ring-2 focus:ring-accent-500"
                    />
                  </div>
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

function computeLabRatios(lab: LabFields): { label: string; value: string }[] {
  const leukosit = parseDecimal(lab.leukositSebelum);
  const neutrofil = parseDecimal(lab.neutrofil);
  const limfosit = parseDecimal(lab.limfosit);
  const monosit = parseDecimal(lab.monosit);
  const trombosit = parseDecimal(lab.trombosit);

  const anc = leukosit !== null && neutrofil !== null ? leukosit * neutrofil : null;
  const alc = limfosit !== null && leukosit !== null ? limfosit * leukosit : null;

  return [
    { label: "ANC (Absolute Neutrophil Count)", value: formatComputed(anc) },
    { label: "ALC (Absolute Lymphocyte Count)", value: formatComputed(alc) },
    { label: "NLR", value: formatComputed(safeDivide(neutrofil, limfosit)) },
    { label: "LMR", value: formatComputed(safeDivide(limfosit, monosit)) },
    { label: "PLR", value: formatComputed(safeDivide(trombosit, limfosit)) },
  ];
}

// Mosteller: BSA (m²) = √[(BB(kg) × TB(cm)) / 3600].
function computeBsa(bb: string, tb: string): string {
  const bbKg = parseDecimal(bb);
  const tbCm = parseDecimal(tb);
  if (bbKg === null || tbCm === null || bbKg <= 0 || tbCm <= 0) return "";
  return formatComputed(Math.sqrt((bbKg * tbCm) / 3600));
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
                        className="h-8 w-20 shrink-0 rounded-lg bg-white px-2 text-sm text-zinc-900 ring-1 ring-inset ring-zinc-200 focus:outline-none focus:ring-2 focus:ring-accent-500"
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
