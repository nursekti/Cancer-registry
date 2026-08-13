"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

const OPTIONS: Array<{ format: "csv" | "xlsx" | "pdf"; label: string; hint: string }> = [
  { format: "csv", label: "CSV (spreadsheet)", hint: "Opens in Excel, Sheets, Numbers" },
  { format: "xlsx", label: "Excel (.xlsx)", hint: "Native Excel workbook" },
  { format: "pdf", label: "PDF", hint: "Printable table" },
];

const MENU_WIDTH = 220;

export function ExportMenu({
  disabled,
  onExport,
}: {
  disabled?: boolean;
  onExport: (format: "csv" | "xlsx" | "pdf") => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [pos, setPos] = React.useState<{ top: number; left: number } | null>(null);

  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);

  function toggleOpen() {
    if (!open) {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (rect) {
        const left = Math.min(rect.left, window.innerWidth - MENU_WIDTH - 8);
        setPos({ top: rect.bottom + 6, left: Math.max(8, left) });
      }
    }
    setOpen((v) => !v);
  }

  React.useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (menuRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <>
      <Button ref={buttonRef} variant="secondary" disabled={disabled} onClick={toggleOpen}>
        Export
      </Button>

      {open && pos ? (
        <div
          ref={menuRef}
          style={{ top: pos.top, left: pos.left, width: MENU_WIDTH }}
          className="fixed z-30 overflow-hidden rounded-xl border border-zinc-200 bg-white py-1.5 shadow-lg"
        >
          {OPTIONS.map((opt) => (
            <button
              key={opt.format}
              type="button"
              onClick={() => {
                onExport(opt.format);
                setOpen(false);
              }}
              className={cn(
                "flex w-full flex-col items-start gap-0.5 px-3.5 py-2 text-left transition-colors hover:bg-zinc-50",
              )}
            >
              <span className="text-sm font-medium text-zinc-900">{opt.label}</span>
              <span className="text-xs text-zinc-500">{opt.hint}</span>
            </button>
          ))}
        </div>
      ) : null}
    </>
  );
}
