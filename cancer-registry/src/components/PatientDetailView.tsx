"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import {
  BaselineLabFields,
  DiagnosisFields,
  DrugRow,
  ExamPhase,
  IdentityFields,
  LabColumn,
  LeukositFields,
  OutcomeFields,
  RiwayatFields,
  RowOverride,
  SupportExam,
  emptyOverride,
  findExactHeaderValue,
  findHeaderValue,
  isHeaderMapped,
  loadOverride,
  markDeleted,
  mergeOverride,
  rowKey,
  saveOverride,
} from "@/lib/rowOverrides";

type Row = Record<string, string>;
type Field = { label: string; value: string; onChange: (value: string) => void };

const EXAM_TYPE_OPTIONS = ["CT scan", "Rontgen", "USG", "Bone survey"];
const IMT_CATEGORY_OPTIONS = ["Underweight", "Normoweight", "Overweight", "Obese"];
const PHASE_LABELS: Record<ExamPhase, string> = {
  pre: "Pre kemo",
  during: "During",
  post: "Post",
};

// Headers already surfaced elsewhere (identity sidebar, diagnosis, history,
// labs, or consumed by the editable form below) — excluded from the raw
// "data mentah" dump so nothing is shown twice.
const MAPPED_HEADER_NEEDLES = [
  "nama",
  "no erm",
  "tahun",
  "jk",
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
  return parts.map((nama) => ({ id: newId(), nama, dosis: "" }));
}

function buildInitialOverride(row: Row, headers: string[]): RowOverride {
  const base = emptyOverride();

  const penunjangDone = findHeaderValue(row, headers, "pemeriksaan penunjang")
    .trim()
    .toLowerCase();
  const exams: SupportExam[] =
    penunjangDone === "ya"
      ? [
          {
            id: newId(),
            phase: "pre",
            types: [],
            otherType: "",
            tanggal: "",
            hasil: "",
          },
        ]
      : [];

  const hb = findHeaderValue(row, headers, "hb sebelum");
  const trombosit = findHeaderValue(row, headers, "trombosit");
  const labs: LabColumn[] =
    hb || trombosit
      ? [{ id: newId(), phase: "pre", hb, trombosit }]
      : [];

  const regimen = findHeaderValue(row, headers, "regimen kemoterapi");

  return {
    ...base,
    identity: {
      nama: row["NAMA"] ?? "",
      noErm: row["NO ERM"] ?? "",
      tahun: findHeaderValue(row, headers, "tahun"),
      jk: findHeaderValue(row, headers, "jk"),
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
      jumlahKomorbiditas: findHeaderValue(row, headers, "jumlah komorbiditas"),
    },
    baselineLab: {
      leukositSebelum: findHeaderValue(row, headers, "leukosit sebelum"),
      anemia: findHeaderValue(row, headers, "anemia"),
      anc: findHeaderValue(row, headers, "anc ("),
      alc: findHeaderValue(row, headers, "alc ("),
      nlr: findHeaderValue(row, headers, "nlr"),
      lmr: findHeaderValue(row, headers, "lmr"),
      plr: findHeaderValue(row, headers, "plr"),
      ldh: findHeaderValue(row, headers, "ldh"),
    },
    leukosit: {
      eosinofil: findHeaderValue(row, headers, "eosinofil"),
      basofil: findHeaderValue(row, headers, "basofil"),
      neutrofil: findHeaderValue(row, headers, "neutrofil"),
      limfosit: findHeaderValue(row, headers, "limfosit"),
      monosit: findHeaderValue(row, headers, "monosit"),
    },
    outcome: {
      awalAkhirKemoterapi: findHeaderValue(row, headers, "awal-akhir kemoterapi"),
      followUpTerakhir: findHeaderValue(row, headers, "follow up terakhir"),
      responKemoterapi: findHeaderValue(row, headers, "respon kemoterapi"),
      statusRemission: findHeaderValue(row, headers, "remission"),
      lostToFollowUp: findHeaderValue(row, headers, "lost to follow up"),
      timeToEvent: findHeaderValue(row, headers, "time to event"),
      kesimpulan: findHeaderValue(row, headers, "kesimpulan"),
      dx: findExactHeaderValue(row, headers, "dx"),
    },
    exams,
    labs,
    siklus: findHeaderValue(row, headers, "siklus kemoterapi"),
    imt: findHeaderValue(row, headers, "imt (kg"),
    imtKategori: findHeaderValue(row, headers, "kategori imt"),
    regimen,
    drugs: splitRegimen(regimen),
  };
}

export function PatientDetailView({
  cancerType,
  backHref,
  headers,
  row,
  onDeleted,
  onSaved,
}: {
  cancerType: "HL" | "NHL";
  backHref: string;
  headers: string[];
  row: Row;
  onDeleted: (key: string) => void;
  onSaved: (key: string, override: RowOverride) => void;
}) {
  const key = React.useMemo(() => rowKey(row), [row]);
  const [state, setState] = React.useState<RowOverride>(() => {
    const seeded = buildInitialOverride(row, headers);
    const stored = loadOverride(key);
    return stored ? mergeOverride(seeded, stored) : seeded;
  });
  const [confirmingDelete, setConfirmingDelete] = React.useState(false);
  const [savedMessage, setSavedMessage] = React.useState<string | null>(null);
  const [deleted, setDeleted] = React.useState(false);
  const [isEditing, setIsEditing] = React.useState(false);
  const [preEditSnapshot, setPreEditSnapshot] = React.useState<RowOverride | null>(
    null,
  );

  const title =
    cancerType === "NHL" ? "NON HODGKIN LYMPHOMA" : "HODGKIN LYMPHOMA";

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

  function handleComplete() {
    persist({ ...state, status: "complete" }, "Ditandai selesai.");
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

  function updateBaselineLab(patch: Partial<BaselineLabFields>) {
    setState((s) => ({ ...s, baselineLab: { ...s.baselineLab, ...patch } }));
  }

  function updateLeukosit(patch: Partial<LeukositFields>) {
    setState((s) => ({ ...s, leukosit: { ...s.leukosit, ...patch } }));
  }

  function updateOutcome(patch: Partial<OutcomeFields>) {
    setState((s) => ({ ...s, outcome: { ...s.outcome, ...patch } }));
  }

  function addExam() {
    setState((s) => ({
      ...s,
      exams: [
        ...s.exams,
        {
          id: newId(),
          phase: "pre",
          types: [],
          otherType: "",
          tanggal: "",
          hasil: "",
        },
      ],
    }));
  }

  function updateExam(id: string, patch: Partial<SupportExam>) {
    setState((s) => ({
      ...s,
      exams: s.exams.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    }));
  }

  function removeExam(id: string) {
    setState((s) => ({ ...s, exams: s.exams.filter((e) => e.id !== id) }));
  }

  function toggleExamType(id: string, type: string) {
    setState((s) => ({
      ...s,
      exams: s.exams.map((e) => {
        if (e.id !== id) return e;
        const has = e.types.includes(type);
        return {
          ...e,
          types: has ? e.types.filter((t) => t !== type) : [...e.types, type],
        };
      }),
    }));
  }

  function addLabColumn() {
    setState((s) => ({
      ...s,
      labs: [...s.labs, { id: newId(), phase: "during", hb: "", trombosit: "" }],
    }));
  }

  function updateLabColumn(id: string, patch: Partial<LabColumn>) {
    setState((s) => ({
      ...s,
      labs: s.labs.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    }));
  }

  function removeLabColumn(id: string) {
    setState((s) => ({ ...s, labs: s.labs.filter((l) => l.id !== id) }));
  }

  function addDrug() {
    setState((s) => ({
      ...s,
      drugs: [...s.drugs, { id: newId(), nama: "", dosis: "" }],
    }));
  }

  function updateDrug(id: string, patch: Partial<DrugRow>) {
    setState((s) => ({
      ...s,
      drugs: s.drugs.map((d) => (d.id === id ? { ...d, ...patch } : d)),
    }));
  }

  function removeDrug(id: string) {
    setState((s) => ({ ...s, drugs: s.drugs.filter((d) => d.id !== id) }));
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

  const diagnosisFields: Field[] = [
    { label: "Leader", value: state.diagnosis.leader, onChange: (v) => updateDiagnosis({ leader: v }) },
    {
      label: "Tegak diagnosis",
      value: state.diagnosis.tegakDiagnosis,
      onChange: (v) => updateDiagnosis({ tegakDiagnosis: v }),
    },
    {
      label: "Lokasi PA",
      value: state.diagnosis.lokasiPa,
      onChange: (v) => updateDiagnosis({ lokasiPa: v }),
    },
    {
      label: "Hasil PA",
      value: state.diagnosis.hasilPa,
      onChange: (v) => updateDiagnosis({ hasilPa: v }),
    },
    {
      label: "Subtipe (imunohistokimia)",
      value: state.diagnosis.subtipeImunohistokimia,
      onChange: (v) => updateDiagnosis({ subtipeImunohistokimia: v }),
    },
    {
      label: "Subtipe",
      value: state.diagnosis.subtipe,
      onChange: (v) => updateDiagnosis({ subtipe: v }),
    },
    {
      label: "ECOG score",
      value: state.diagnosis.ecogScore,
      onChange: (v) => updateDiagnosis({ ecogScore: v }),
    },
    {
      label: "Stadium (Ann-Arbor)",
      value: state.diagnosis.stadium,
      onChange: (v) => updateDiagnosis({ stadium: v }),
    },
  ];

  const historyItems: Field[] = [
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
    {
      label: "Double primary tumours",
      value: state.riwayat.doublePrimary,
      onChange: (v) => updateRiwayat({ doublePrimary: v }),
    },
  ];

  const baselineLabFields: Field[] = [
    {
      label: "Leukosit sebelum kemoterapi",
      value: state.baselineLab.leukositSebelum,
      onChange: (v) => updateBaselineLab({ leukositSebelum: v }),
    },
    { label: "Anemia", value: state.baselineLab.anemia, onChange: (v) => updateBaselineLab({ anemia: v }) },
    {
      label: "ANC (Absolute Neutrophil Count)",
      value: state.baselineLab.anc,
      onChange: (v) => updateBaselineLab({ anc: v }),
    },
    {
      label: "ALC (Absolute Lymphocyte Count)",
      value: state.baselineLab.alc,
      onChange: (v) => updateBaselineLab({ alc: v }),
    },
    { label: "NLR", value: state.baselineLab.nlr, onChange: (v) => updateBaselineLab({ nlr: v }) },
    { label: "LMR", value: state.baselineLab.lmr, onChange: (v) => updateBaselineLab({ lmr: v }) },
    { label: "PLR", value: state.baselineLab.plr, onChange: (v) => updateBaselineLab({ plr: v }) },
    { label: "LDH", value: state.baselineLab.ldh, onChange: (v) => updateBaselineLab({ ldh: v }) },
  ];

  const leukositItems: Field[] = [
    { label: "Eosinofil", value: state.leukosit.eosinofil, onChange: (v) => updateLeukosit({ eosinofil: v }) },
    { label: "Basofil", value: state.leukosit.basofil, onChange: (v) => updateLeukosit({ basofil: v }) },
    { label: "Neutrofil", value: state.leukosit.neutrofil, onChange: (v) => updateLeukosit({ neutrofil: v }) },
    { label: "Limfosit", value: state.leukosit.limfosit, onChange: (v) => updateLeukosit({ limfosit: v }) },
    { label: "Monosit", value: state.leukosit.monosit, onChange: (v) => updateLeukosit({ monosit: v }) },
  ];

  const outcomeFields: Field[] = [
    {
      label: "Awal-akhir kemoterapi",
      value: state.outcome.awalAkhirKemoterapi,
      onChange: (v) => updateOutcome({ awalAkhirKemoterapi: v }),
    },
    {
      label: "Follow up terakhir",
      value: state.outcome.followUpTerakhir,
      onChange: (v) => updateOutcome({ followUpTerakhir: v }),
    },
    {
      label: "Respon kemoterapi",
      value: state.outcome.responKemoterapi,
      onChange: (v) => updateOutcome({ responKemoterapi: v }),
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
    {
      label: "Kesimpulan",
      value: state.outcome.kesimpulan,
      onChange: (v) => updateOutcome({ kesimpulan: v }),
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
          {state.status === "complete" ? (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
              Selesai
            </span>
          ) : null}
        </div>
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
          <Card>
            <CardContent className="space-y-8 p-6">
              <Section title="Diagnosis">
                <EditableGrid fields={diagnosisFields} isEditing={isEditing} />
              </Section>

              <Section title="Riwayat penyakit & komorbiditas">
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Jumlah komorbiditas
                  </span>
                  {isEditing ? (
                    <input
                      type="text"
                      value={state.riwayat.jumlahKomorbiditas}
                      onChange={(e) =>
                        updateRiwayat({ jumlahKomorbiditas: e.target.value })
                      }
                      className="h-8 w-20 rounded-lg bg-white px-2.5 text-xs text-zinc-900 ring-1 ring-inset ring-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-400"
                    />
                  ) : (
                    <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700">
                      {state.riwayat.jumlahKomorbiditas || "-"}
                    </span>
                  )}
                </div>
                <EditableHistoryTable items={historyItems} isEditing={isEditing} />
              </Section>

              <Section title="Pemeriksaan penunjang">
                <div className="space-y-4">
                  {state.exams.map((exam) => (
                    <div
                      key={exam.id}
                      className="rounded-2xl border border-zinc-200 p-4"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <PhaseSelect
                          value={exam.phase}
                          onChange={(phase) => updateExam(exam.id, { phase })}
                          disabled={!isEditing}
                        />
                        <input
                          type="date"
                          value={exam.tanggal}
                          disabled={!isEditing}
                          onChange={(e) =>
                            updateExam(exam.id, { tanggal: e.target.value })
                          }
                          className="h-11 rounded-xl bg-white px-3.5 text-sm text-zinc-900 ring-1 ring-inset ring-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-400 disabled:bg-zinc-50 disabled:text-zinc-500"
                        />
                        <input
                          type="text"
                          placeholder="hasil"
                          value={exam.hasil}
                          disabled={!isEditing}
                          onChange={(e) =>
                            updateExam(exam.id, { hasil: e.target.value })
                          }
                          className="h-11 flex-1 rounded-xl bg-white px-3.5 text-sm text-zinc-900 ring-1 ring-inset ring-zinc-200 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400 disabled:bg-zinc-50 disabled:text-zinc-500"
                        />
                        {isEditing ? (
                          <button
                            type="button"
                            onClick={() => removeExam(exam.id)}
                            className="text-xs font-medium text-red-600 hover:text-red-500"
                          >
                            Hapus
                          </button>
                        ) : null}
                      </div>

                      <div className="mt-3 flex flex-wrap gap-3">
                        {EXAM_TYPE_OPTIONS.map((type) => (
                          <label
                            key={type}
                            className="flex items-center gap-1.5 text-sm text-zinc-700"
                          >
                            <input
                              type="checkbox"
                              checked={exam.types.includes(type)}
                              disabled={!isEditing}
                              onChange={() => toggleExamType(exam.id, type)}
                              className="h-4 w-4 rounded border-zinc-300"
                            />
                            {type}
                          </label>
                        ))}
                        <input
                          type="text"
                          placeholder="lainnya, dll"
                          value={exam.otherType}
                          disabled={!isEditing}
                          onChange={(e) =>
                            updateExam(exam.id, { otherType: e.target.value })
                          }
                          className="h-8 w-32 rounded-lg bg-white px-2.5 text-xs text-zinc-900 ring-1 ring-inset ring-zinc-200 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400 disabled:bg-zinc-50 disabled:text-zinc-500"
                        />
                      </div>
                    </div>
                  ))}

                  {isEditing ? (
                    <div className="flex items-center gap-2">
                      <Button variant="secondary" size="sm" onClick={addExam}>
                        + Tambah pemeriksaan
                      </Button>
                      <span className="text-xs text-red-500">dapat lebih dari 1</span>
                    </div>
                  ) : null}
                </div>
              </Section>

              <Section title="Laboratorium">
                <div className="overflow-x-auto rounded-2xl border border-zinc-200">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600">
                        <th className="px-4 py-3">Parameter</th>
                        {state.labs.map((lab) => (
                          <th key={lab.id} className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <PhaseSelect
                                value={lab.phase}
                                onChange={(phase) =>
                                  updateLabColumn(lab.id, { phase })
                                }
                                compact
                                disabled={!isEditing}
                              />
                              {isEditing ? (
                                <button
                                  type="button"
                                  onClick={() => removeLabColumn(lab.id)}
                                  className="text-red-500 hover:text-red-400"
                                  aria-label="Hapus kolom"
                                >
                                  &times;
                                </button>
                              ) : null}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t border-zinc-100">
                        <td className="px-4 py-3 font-medium text-zinc-700">HB</td>
                        {state.labs.map((lab) => (
                          <td key={lab.id} className="px-4 py-3">
                            <input
                              type="text"
                              value={lab.hb}
                              disabled={!isEditing}
                              onChange={(e) =>
                                updateLabColumn(lab.id, { hb: e.target.value })
                              }
                              className="h-9 w-24 rounded-lg bg-white px-2.5 text-sm text-zinc-900 ring-1 ring-inset ring-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-400 disabled:bg-zinc-50 disabled:text-zinc-500"
                            />
                          </td>
                        ))}
                      </tr>
                      <tr className="border-t border-zinc-100">
                        <td className="px-4 py-3 font-medium text-zinc-700">
                          Trombosit
                        </td>
                        {state.labs.map((lab) => (
                          <td key={lab.id} className="px-4 py-3">
                            <input
                              type="text"
                              value={lab.trombosit}
                              disabled={!isEditing}
                              onChange={(e) =>
                                updateLabColumn(lab.id, {
                                  trombosit: e.target.value,
                                })
                              }
                              className="h-9 w-24 rounded-lg bg-white px-2.5 text-sm text-zinc-900 ring-1 ring-inset ring-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-400 disabled:bg-zinc-50 disabled:text-zinc-500"
                            />
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
                {isEditing ? (
                  <div className="mt-3 flex items-center gap-2">
                    <Button variant="secondary" size="sm" onClick={addLabColumn}>
                      + Tambah kolom
                    </Button>
                    <span className="text-xs text-red-500">dapat lebih dari 1</span>
                  </div>
                ) : null}
              </Section>

              <Section title="Hasil laboratorium awal">
                <EditableGrid fields={baselineLabFields} isEditing={isEditing} />
              </Section>

              <Section title="Hitung jenis leukosit">
                <EditableLeukositTable items={leukositItems} isEditing={isEditing} />
              </Section>

              <Section title="Siklus kemoterapi">
                <div className="grid gap-3 sm:grid-cols-2">
                  <LabeledField label="Lini">
                    <input
                      type="text"
                      value={state.lini}
                      onChange={(e) =>
                        setState((s) => ({ ...s, lini: e.target.value }))
                      }
                      disabled={!isEditing}
                      className={fieldClass}
                    />
                  </LabeledField>
                  <LabeledField label="Siklus">
                    <input
                      type="text"
                      value={state.siklus}
                      onChange={(e) =>
                        setState((s) => ({ ...s, siklus: e.target.value }))
                      }
                      disabled={!isEditing}
                      className={fieldClass}
                    />
                  </LabeledField>
                  <LabeledField label="BB (kg)">
                    <input
                      type="text"
                      value={state.bb}
                      onChange={(e) =>
                        setState((s) => ({ ...s, bb: e.target.value }))
                      }
                      disabled={!isEditing}
                      className={fieldClass}
                    />
                  </LabeledField>
                  <LabeledField label="TB (cm)">
                    <input
                      type="text"
                      value={state.tb}
                      onChange={(e) =>
                        setState((s) => ({ ...s, tb: e.target.value }))
                      }
                      disabled={!isEditing}
                      className={fieldClass}
                    />
                  </LabeledField>
                  <LabeledField label="IMT">
                    <input
                      type="text"
                      value={state.imt}
                      onChange={(e) =>
                        setState((s) => ({ ...s, imt: e.target.value }))
                      }
                      disabled={!isEditing}
                      className={fieldClass}
                    />
                  </LabeledField>
                  <LabeledField label="Kategori IMT">
                    <select
                      value={state.imtKategori}
                      onChange={(e) =>
                        setState((s) => ({ ...s, imtKategori: e.target.value }))
                      }
                      disabled={!isEditing}
                      className={fieldClass}
                    >
                      <option value="">-</option>
                      {IMT_CATEGORY_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </LabeledField>
                  <LabeledField label="BSA">
                    <input
                      type="text"
                      value={state.bsa}
                      onChange={(e) =>
                        setState((s) => ({ ...s, bsa: e.target.value }))
                      }
                      disabled={!isEditing}
                      className={fieldClass}
                    />
                  </LabeledField>
                </div>

                <div className="mt-4 space-y-2">
                  <label className="text-sm font-medium text-zinc-800">
                    Regimen kemoterapi
                  </label>
                  {state.drugs.map((drug) => (
                    <div key={drug.id} className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="nama obat"
                        value={drug.nama}
                        disabled={!isEditing}
                        onChange={(e) =>
                          updateDrug(drug.id, { nama: e.target.value })
                        }
                        className={cn(fieldClass, "min-w-0 flex-1")}
                      />
                      <div className="w-28 shrink-0">
                        <input
                          type="text"
                          placeholder="dosis"
                          value={drug.dosis}
                          disabled={!isEditing}
                          onChange={(e) =>
                            updateDrug(drug.id, { dosis: e.target.value })
                          }
                          className={fieldClass}
                        />
                      </div>
                      {isEditing ? (
                        <button
                          type="button"
                          onClick={() => removeDrug(drug.id)}
                          className="text-xs font-medium text-red-600 hover:text-red-500"
                        >
                          Hapus
                        </button>
                      ) : null}
                    </div>
                  ))}
                  {isEditing ? (
                    <Button variant="secondary" size="sm" onClick={addDrug}>
                      + Tambah obat
                    </Button>
                  ) : null}
                </div>
              </Section>

              <Section title="Ringkasan & outcome">
                <EditableGrid fields={outcomeFields} isEditing={isEditing} />
              </Section>

              {rawDataHeaders.length ? (
                <details className="rounded-2xl border border-zinc-200 p-4">
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
              ) : null}
            </CardContent>
          </Card>

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
                <Button variant="success" onClick={handleComplete}>
                  Complete
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
    <div>
      <div className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
        {title}
      </div>
      {children}
    </div>
  );
}

function LabeledField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-zinc-800">{label}</label>
      {children}
    </div>
  );
}

function PhaseSelect({
  value,
  onChange,
  compact,
  disabled,
}: {
  value: ExamPhase;
  onChange: (phase: ExamPhase) => void;
  compact?: boolean;
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as ExamPhase)}
      className={cn(
        "rounded-xl bg-white text-sm text-zinc-900 ring-1 ring-inset ring-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-400 disabled:bg-zinc-50 disabled:text-zinc-500",
        compact ? "h-9 px-2.5" : "h-11 px-3.5",
      )}
    >
      {(Object.keys(PHASE_LABELS) as ExamPhase[]).map((phase) => (
        <option key={phase} value={phase}>
          {PHASE_LABELS[phase]}
        </option>
      ))}
    </select>
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

function BooleanBadge({ value }: { value: string }) {
  const v = value.trim().toLowerCase();
  if (v === "ya") {
    return (
      <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700">
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
