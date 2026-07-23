"use client";

import * as React from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/cn";
import { CANCER_TYPES } from "@/data/cancerTypes";
import { LS_SELECTED_CANCER_TYPE } from "@/lib/constants";
import { setLocalStorageItem } from "@/lib/storage";
import { useLocalStorageValue } from "@/lib/useLocalStorageValue";

export default function CancerTypePage() {
  const [q, setQ] = React.useState("");
  const selected = useLocalStorageValue(LS_SELECTED_CANCER_TYPE) ?? "";

  const filtered = React.useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return CANCER_TYPES;
    return CANCER_TYPES.filter((t) => {
      const hay = `${t.id} ${t.label} ${t.description ?? ""}`.toLowerCase();
      return hay.includes(qq);
    });
  }, [q]);

  return (
    <RequireAuth>
      <AppShell>
        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">
              Choose a registry module
            </h1>
            <p className="mt-2 text-sm text-zinc-600">
              Pick the cancer dataset view that best fits your current task.
            </p>
          </div>

          <Input
            label="Search modules"
            placeholder="Try NHL, HL, or another keyword"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full"
          />

          <div className="grid gap-4 sm:grid-cols-2">
            {filtered.map((t) => {
              const active = selected === t.id;
              const href = t.id === "HL" ? "/hl" : "/patients";
              return (
                <Link
                  key={t.id}
                  href={href}
                  onClick={() => setLocalStorageItem(LS_SELECTED_CANCER_TYPE, t.id)}
                  className={cn(
                    "group relative flex items-center justify-between gap-4 rounded-3xl bg-white p-6 ring-1 ring-zinc-100 shadow-[0_20px_70px_-30px_rgba(0,0,0,0.25)] transition-all duration-200 ease-out hover:-translate-y-1 hover:shadow-[0_25px_80px_-25px_rgba(0,0,0,0.35)] hover:ring-zinc-200",
                    active && "ring-2 ring-emerald-200",
                  )}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="text-lg font-semibold text-zinc-900">
                        {t.id}
                      </div>
                      {active ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          Aktif
                        </span>
                      ) : null}
                    </div>
                    {t.description ? (
                      <div className="mt-1 truncate text-sm text-zinc-600">
                        {t.description}
                      </div>
                    ) : null}
                  </div>

                  <span
                    aria-hidden
                    className="shrink-0 text-xl text-zinc-300 transition-transform duration-200 group-hover:translate-x-1 group-hover:text-zinc-500"
                  >
                    &rarr;
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </AppShell>
    </RequireAuth>
  );
}
