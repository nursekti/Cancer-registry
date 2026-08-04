"use client";

import * as React from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/cn";
import {
  CancerTypeConfig,
  LS_CANCER_TYPES,
  addCancerType,
  deleteCancerType,
  loadCancerTypes,
} from "@/lib/cancerTypes";
import { useLocalStorageValue } from "@/lib/useLocalStorageValue";

export default function CancerTypePage() {
  const [q, setQ] = React.useState("");
  const [addOpen, setAddOpen] = React.useState(false);
  const [manageMode, setManageMode] = React.useState(false);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [confirmingBulkDelete, setConfirmingBulkDelete] = React.useState(false);

  const typesRaw = useLocalStorageValue(LS_CANCER_TYPES);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- recompute when localStorage changes
  const types = React.useMemo(() => loadCancerTypes(), [typesRaw]);

  const filtered = React.useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return types;
    return types.filter((t) => {
      const hay = `${t.id} ${t.label} ${t.description ?? ""}`.toLowerCase();
      return hay.includes(qq);
    });
  }, [q, types]);

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function exitManageMode() {
    setManageMode(false);
    setSelectedIds(new Set());
    setConfirmingBulkDelete(false);
  }

  function handleConfirmBulkDelete() {
    selectedIds.forEach((id) => deleteCancerType(id));
    exitManageMode();
  }

  return (
    <RequireAuth>
      <AppShell>
        <div className="space-y-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">
                Choose a registry module
              </h1>
              <p className="mt-2 text-sm text-zinc-600">
                Pick the cancer dataset view that best fits your current task.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {manageMode ? (
                <>
                  <Button
                    variant="danger"
                    disabled={selectedIds.size === 0}
                    onClick={() => setConfirmingBulkDelete(true)}
                  >
                    Hapus{selectedIds.size ? ` (${selectedIds.size})` : ""}
                  </Button>
                  <Button variant="secondary" onClick={exitManageMode}>
                    Selesai
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="secondary" onClick={() => setManageMode(true)}>
                    Edit
                  </Button>
                  <Button onClick={() => setAddOpen(true)}>+ Tambah jenis kanker</Button>
                </>
              )}
            </div>
          </div>

          {confirmingBulkDelete ? (
            <div className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-red-900">
                Hapus {selectedIds.size} modul terpilih? Data yang sudah tersimpan
                tidak akan terhapus, hanya modul ini yang hilang dari daftar.
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button variant="danger" size="sm" onClick={handleConfirmBulkDelete}>
                  Ya, hapus
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setConfirmingBulkDelete(false)}
                >
                  Batal
                </Button>
              </div>
            </div>
          ) : null}

          <Input
            label="Search modules"
            placeholder="Try NHL, HL, or another keyword"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full"
          />

          <div className="grid gap-4 sm:grid-cols-2">
            {filtered.map((t) => (
              <ModuleCard
                key={t.id}
                type={t}
                manageMode={manageMode}
                selected={selectedIds.has(t.id)}
                onToggleSelected={() => toggleSelected(t.id)}
              />
            ))}
          </div>
        </div>

        {addOpen ? (
          <AddCancerTypeModal onClose={() => setAddOpen(false)} />
        ) : null}
      </AppShell>
    </RequireAuth>
  );
}

function ModuleCard({
  type: t,
  manageMode,
  selected,
  onToggleSelected,
}: {
  type: CancerTypeConfig;
  manageMode: boolean;
  selected: boolean;
  onToggleSelected: () => void;
}) {
  const cardClass = cn(
    "flex items-center justify-between gap-4 rounded-3xl bg-white p-6 ring-1 shadow-[0_20px_70px_-30px_rgba(0,0,0,0.25)] transition-all duration-200 ease-out",
    manageMode
      ? selected
        ? "ring-2 ring-primary-700"
        : "ring-1 ring-zinc-100 hover:ring-zinc-300"
      : "ring-1 ring-zinc-100 hover:-translate-y-1 hover:shadow-[0_25px_80px_-25px_rgba(0,0,0,0.35)] hover:ring-zinc-200",
  );

  const content = (
    <>
      <div className="min-w-0">
        <div className="text-lg font-semibold text-zinc-900">{t.id}</div>
        {t.description ? (
          <div className="mt-1 truncate text-sm text-zinc-600">{t.description}</div>
        ) : null}
      </div>

      {manageMode ? (
        <span
          aria-hidden
          className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-full ring-1 ring-inset transition-colors",
            selected
              ? "bg-primary-700 text-white ring-primary-700"
              : "text-transparent ring-zinc-300",
          )}
        >
          &#10003;
        </span>
      ) : (
        <span
          aria-hidden
          className="group-hover:translate-x-1 group-hover:text-zinc-500 shrink-0 text-xl text-zinc-300 transition-transform duration-200"
        >
          &rarr;
        </span>
      )}
    </>
  );

  if (manageMode) {
    return (
      <button
        type="button"
        onClick={onToggleSelected}
        aria-pressed={selected}
        className={cn(cardClass, "text-left")}
      >
        {content}
      </button>
    );
  }

  return (
    <Link href={`/registry?typeId=${encodeURIComponent(t.id)}`} className={cn(cardClass, "group")}>
      {content}
    </Link>
  );
}

function AddCancerTypeModal({ onClose }: { onClose: () => void }) {
  const [label, setLabel] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [csvUrl, setCsvUrl] = React.useState("");

  const canSubmit = label.trim().length > 0;

  function handleSubmit() {
    if (!canSubmit) return;
    addCancerType({ label: label.trim(), description: description.trim(), csvUrl });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-20 bg-black/30 p-4 backdrop-blur-sm">
      <div className="mx-auto max-h-[90vh] max-w-lg overflow-y-auto rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
          <div>
            <div className="text-sm font-semibold text-zinc-900">
              Tambah jenis kanker
            </div>
            <div className="mt-0.5 text-xs text-zinc-500">
              Buat modul registry baru selain HL/NHL.
            </div>
          </div>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="space-y-4 p-6">
          <Input
            label="Nama jenis kanker *"
            placeholder="Contoh: Leukemia"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <Input
            label="Deskripsi"
            placeholder="Contoh: Acute Myeloid Leukemia"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <Input
            label="CSV URL (opsional)"
            placeholder="https://docs.google.com/spreadsheets/d/.../export?format=csv&gid=..."
            value={csvUrl}
            onChange={(e) => setCsvUrl(e.target.value)}
            hint="Bisa juga diisi nanti lewat tombol Import data di halaman modul."
          />
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-zinc-100 px-6 py-4">
          <span className="mr-auto text-xs text-zinc-500">* wajib diisi</span>
          <Button variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button disabled={!canSubmit} onClick={handleSubmit}>
            Buat modul
          </Button>
        </div>
      </div>
    </div>
  );
}
