"use client";

import { Input } from "@/components/ui/Input";

export function SearchBar({
  value,
  onChange,
  placeholder,
  totalCount,
  filteredCount,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  totalCount: number;
  filteredCount: number;
}) {
  return (
    <Input
      label="Search records"
      placeholder={placeholder ?? "Search by name, ERM number, NIK, regimen, etc."}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      hint={
        totalCount
          ? `${filteredCount} / ${totalCount} rows`
          : "Belum ada data yang dimuat"
      }
    />
  );
}
