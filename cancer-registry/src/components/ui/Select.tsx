"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

export type SelectOption = { value: string; label: string };

export function Select({
  label,
  options,
  value,
  onChange,
  className,
  id,
}: {
  label?: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  id?: string;
}) {
  const autoId = React.useId();
  const selectId = id ?? autoId;

  return (
    <div className="flex flex-col gap-1.5">
      {label ? (
        <label
          className="text-sm font-medium text-zinc-800"
          htmlFor={selectId}
        >
          {label}
        </label>
      ) : null}
      <select
        id={selectId}
        className={cn(
          "h-11 w-full rounded-xl bg-white px-3.5 text-sm text-zinc-900 ring-1 ring-inset ring-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-400",
          className,
        )}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

