"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { PatientDetailView } from "@/components/PatientDetailView";
import { RequireAuth } from "@/components/RequireAuth";
import { CancerTypeConfig, loadCancerTypes } from "@/lib/cancerTypes";
import { useCsvRowByKey } from "@/lib/useCsvRowByKey";

export default function RegistryDetailPage() {
  return (
    <React.Suspense
      fallback={
        <RequireAuth>
          <AppShell>
            <div className="rounded-3xl border border-zinc-200 bg-white p-10 text-center text-sm text-zinc-500">
              Memuat data...
            </div>
          </AppShell>
        </RequireAuth>
      }
    >
      <RegistryDetailPageInner />
    </React.Suspense>
  );
}

function RegistryDetailPageInner() {
  const searchParams = useSearchParams();
  const typeId = decodeURIComponent(searchParams.get("typeId") ?? "");
  const key = decodeURIComponent(searchParams.get("key") ?? "");

  const [config, setConfig] = React.useState<CancerTypeConfig | null | undefined>(
    undefined,
  );
  React.useEffect(() => {
    setConfig(loadCancerTypes().find((t) => t.id === typeId) ?? null);
  }, [typeId]);

  const backHref = `/registry?typeId=${encodeURIComponent(typeId)}`;
  const { headers, row, error, loading } = useCsvRowByKey(
    config?.csvUrl ?? "",
    key,
    typeId,
  );

  if (config === undefined || loading) {
    return (
      <RequireAuth>
        <AppShell>
          <div className="rounded-3xl border border-zinc-200 bg-white p-10 text-center text-sm text-zinc-500">
            Memuat data...
          </div>
        </AppShell>
      </RequireAuth>
    );
  }

  if (config === null) {
    return (
      <RequireAuth>
        <AppShell>
          <div className="rounded-3xl border border-zinc-200 bg-white p-10 text-center">
            <div className="text-sm font-semibold text-zinc-900">
              Modul tidak ditemukan.
            </div>
            <Link
              href="/type"
              className="mt-4 inline-flex h-10 items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800"
            >
              &larr; Kembali ke homepage
            </Link>
          </div>
        </AppShell>
      </RequireAuth>
    );
  }

  return (
    <RequireAuth>
      <AppShell>
        {!row && error ? (
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-10 text-center text-sm text-amber-900">
            {error}
          </div>
        ) : !row ? (
          <div className="rounded-3xl border border-zinc-200 bg-white p-10 text-center">
            <div className="text-sm font-semibold text-zinc-900">
              Data tidak ditemukan.
            </div>
            <Link
              href={backHref}
              className="mt-4 inline-flex h-10 items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800"
            >
              &larr; Kembali ke daftar
            </Link>
          </div>
        ) : (
          <PatientDetailView
            cancerType={typeId}
            title={config.label.toUpperCase()}
            backHref={backHref}
            headers={headers}
            row={row}
            csvUrl={config.csvUrl}
            onDeleted={() => {}}
            onSaved={() => {}}
          />
        )}
      </AppShell>
    </RequireAuth>
  );
}
