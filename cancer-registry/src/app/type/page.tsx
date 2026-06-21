"use client";

import * as React from "react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { CANCER_TYPES } from "@/data/cancerTypes";
import { LS_SELECTED_CANCER_TYPE } from "@/lib/constants";
import { setLocalStorageItem } from "@/lib/storage";
import { useLocalStorageValue } from "@/lib/useLocalStorageValue";
import { useRouter } from "next/navigation";

export default function CancerTypePage() {
  const router = useRouter();
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
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Cancer data type
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              Pilih tipe data kanker untuk diinput/ditampilkan.
            </p>
          </div>
        </div>

        <div className="max-w-2xl">
          <Input
            label="search..."
            placeholder="ketik: NHL / HL / ..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />

          <div className="mt-4 grid gap-3">
            {filtered.map((t) => {
              const active = selected === t.id;
              return (
                <Card
                  key={t.id}
                  className={
                    active
                      ? "ring-2 ring-zinc-900 shadow-[0_20px_70px_-30px_rgba(0,0,0,0.35)]"
                      : undefined
                  }
                >
                  <CardContent className="flex items-center justify-between gap-3 p-5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="text-base font-semibold">{t.id}</div>
                        {t.description ? (
                          <div className="truncate text-sm text-zinc-600">
                            {t.description}
                          </div>
                        ) : null}
                      </div>
                      {t.label !== t.id ? (
                        <div className="mt-0.5 text-sm text-zinc-600">
                          {t.label}
                        </div>
                      ) : null}
                    </div>

                    <Button
                      variant={active ? "primary" : "secondary"}
                      onClick={() => {
                        setLocalStorageItem(LS_SELECTED_CANCER_TYPE, t.id);
                        router.push(t.id === "HL" ? "/hl" : "/patients");
                      }}
                    >
                      {active ? "Selected" : "Select"}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </AppShell>
    </RequireAuth>
  );
}

