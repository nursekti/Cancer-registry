"use client";

import * as React from "react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { Input } from "@/components/ui/Input";
import { PATIENTS } from "@/data/patients";
import { cn } from "@/lib/cn";

export default function PatientsPage() {
  const [q, setQ] = React.useState("");

  const rows = React.useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return PATIENTS;
    return PATIENTS.filter((p) => {
      const hay = `${p.nama} ${p.noErm} ${p.nik}`.toLowerCase();
      return hay.includes(qq);
    });
  }, [q]);

  return (
    <RequireAuth>
      <AppShell>
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">
            List of patient data
          </h1>
          <p className="mt-1 text-sm text-zinc-600">
            Search berdasarkan <b>nama</b>, <b>no ERM</b>, atau <b>NIK</b>.
          </p>
        </div>

        <div className="max-w-3xl">
          <Input
            label="search..."
            placeholder="contoh: Dewi / ERM-000456 / 3174..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <div className="mt-5 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-[1100px] w-full text-sm">
              <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600">
                <tr>
                  <Th>NAMA</Th>
                  <Th>NO ERM</Th>
                  <Th>tahun</Th>
                  <Th>JK</Th>
                  <Th>USIA &gt;= 18 th</Th>
                  <Th>Pendidikan Terakhir</Th>
                  <Th>Pekerjaan</Th>
                  <Th>NO HP</Th>
                  <Th>NIK</Th>
                  <Th>LEADER</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const adult = p.usia >= 18;
                  return (
                    <tr
                      key={p.noErm}
                      className="border-t border-zinc-100 hover:bg-zinc-50"
                    >
                      <Td className="font-medium text-zinc-900">{p.nama}</Td>
                      <Td className="font-mono text-xs">{p.noErm}</Td>
                      <Td>{p.tahun}</Td>
                      <Td>{p.jk}</Td>
                      <Td>
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2 py-1 text-xs font-medium",
                            adult
                              ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200"
                              : "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
                          )}
                        >
                          {adult ? "Ya" : "Tidak"}
                        </span>
                        <span className="ml-2 text-xs text-zinc-500">
                          ({p.usia})
                        </span>
                      </Td>
                      <Td>{p.pendidikanTerakhir}</Td>
                      <Td>{p.pekerjaan}</Td>
                      <Td className="whitespace-nowrap">{p.noHp}</Td>
                      <Td className="font-mono text-xs">{p.nik}</Td>
                      <Td>{p.leader}</Td>
                    </tr>
                  );
                })}
                {rows.length === 0 ? (
                  <tr className="border-t border-zinc-100">
                    <Td className="py-10 text-center text-zinc-500" colSpan={10}>
                      Tidak ada data yang cocok.
                    </Td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </AppShell>
    </RequireAuth>
  );
}

function Th({
  className,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn("px-4 py-3 whitespace-nowrap", className)}
      {...props}
    />
  );
}

function Td({
  className,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn("px-4 py-3 whitespace-nowrap", className)} {...props} />
  );
}

