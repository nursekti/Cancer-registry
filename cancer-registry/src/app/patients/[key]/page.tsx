"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { PatientDetailView } from "@/components/PatientDetailView";
import { RequireAuth } from "@/components/RequireAuth";
import { PATIENTS } from "@/data/patients";
import { useCsvRowByKey } from "@/lib/useCsvRowByKey";

const DEFAULT_CSV_URL =
  "https://docs.google.com/spreadsheets/d/10tlI23LbJ4hiAZpeSygoxqtCu-XQrfxVLhgp7iqwkZc/edit?gid=188215245#gid=188215245";

function fallbackRow(key: string) {
  const patient = PATIENTS.find(
    (p) => p.noErm === key || p.nik === key || p.nama === key,
  );
  if (!patient) return null;
  return {
    NAMA: patient.nama,
    "NO ERM": patient.noErm,
    NIK: patient.nik,
    JK: patient.jk,
    USIA: String(patient.usia),
  };
}

export default function PatientDetailPage() {
  const params = useParams<{ key: string }>();
  const key = decodeURIComponent(params.key ?? "");
  const { headers, row, error, loading } = useCsvRowByKey(
    DEFAULT_CSV_URL,
    key,
    "NHL",
  );

  const resolvedRow = row ?? fallbackRow(key);

  return (
    <RequireAuth>
      <AppShell>
        {loading ? (
          <div className="rounded-3xl border border-zinc-200 bg-white p-10 text-center text-sm text-zinc-500">
            Memuat data...
          </div>
        ) : !resolvedRow && error ? (
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-10 text-center text-sm text-amber-900">
            {error}
          </div>
        ) : !resolvedRow ? (
          <div className="rounded-3xl border border-zinc-200 bg-white p-10 text-center">
            <div className="text-sm font-semibold text-zinc-900">
              Data tidak ditemukan.
            </div>
            <Link
              href="/patients"
              className="mt-4 inline-flex h-10 items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800"
            >
              &larr; Kembali ke daftar
            </Link>
          </div>
        ) : (
          <PatientDetailView
            cancerType="NHL"
            backHref="/patients"
            headers={headers.length ? headers : Object.keys(resolvedRow)}
            row={resolvedRow}
            onDeleted={() => {}}
            onSaved={() => {}}
          />
        )}
      </AppShell>
    </RequireAuth>
  );
}
