"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";

export function ModuleHeader({
  title,
  subtitle,
  resultCount,
  summaryCards,
  onImportClick,
  onAddClick,
}: {
  title: string;
  subtitle: string;
  resultCount: number;
  summaryCards: { label: string; value: React.ReactNode }[];
  onImportClick: () => void;
  onAddClick: () => void;
}) {
  return (
    <div className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            {title}
          </h1>
          <p className="mt-1 text-sm text-zinc-600">{subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-sm text-zinc-600">
            {resultCount} result{resultCount === 1 ? "" : "s"}
          </div>
          <Button variant="secondary" onClick={onImportClick}>
            Import data
          </Button>
          <Button onClick={onAddClick}>+ Tambah data</Button>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {summaryCards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4"
          >
            <div className="text-sm text-zinc-600">{card.label}</div>
            <div className="mt-1 text-2xl font-semibold text-zinc-900">
              {card.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
