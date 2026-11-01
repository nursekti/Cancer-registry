"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { parseGid, parseSpreadsheetId } from "@/lib/fetchImtFormulas";
import {
  addSheetDropdownOption,
  fetchSheetDropdowns,
  normalizeHeader,
  sheetWriteEnabled,
} from "@/lib/sheetWriteBack";
import { getLocalStorageItem, setLocalStorageItem } from "@/lib/storage";

type Dropdowns = Record<string, string[]>; // normalized header -> options

type SheetDropdowns = {
  // The sheet's own options for a column, or undefined when that column has
  // no dropdown in the sheet (or the sheet couldn't be reached).
  optionsFor: (header: string | undefined) => string[] | undefined;
  addOption: (header: string, option: string) => Promise<void>;
};

const SheetDropdownsContext = React.createContext<SheetDropdowns>({
  optionsFor: () => undefined,
  addOption: async () => {
    throw new Error("Spreadsheet tidak terhubung");
  },
});

function cacheKey(csvUrl: string): string {
  return `cr_sheet_dropdowns:${parseSpreadsheetId(csvUrl)}:${parseGid(csvUrl) || "0"}`;
}

function readCache(csvUrl: string): Dropdowns {
  try {
    return JSON.parse(getLocalStorageItem(cacheKey(csvUrl)) ?? "{}") as Dropdowns;
  } catch {
    return {};
  }
}

// Loads the dropdowns defined in the sheet tab behind `csvUrl` (cached
// copy first, then fresh), and adds labels to them.
export function SheetDropdownsProvider({
  csvUrl,
  children,
}: {
  csvUrl?: string;
  children: React.ReactNode;
}) {
  const enabled = sheetWriteEnabled && Boolean(csvUrl);
  const [dropdowns, setDropdowns] = React.useState<Dropdowns>(() =>
    enabled && csvUrl ? readCache(csvUrl) : {},
  );

  React.useEffect(() => {
    if (!enabled || !csvUrl) return;
    let cancelled = false;
    fetchSheetDropdowns(csvUrl)
      .then((fresh) => {
        if (cancelled) return;
        setDropdowns(fresh);
        setLocalStorageItem(cacheKey(csvUrl), JSON.stringify(fresh));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [enabled, csvUrl]);

  const value = React.useMemo<SheetDropdowns>(
    () => ({
      optionsFor: (header) => (header ? dropdowns[normalizeHeader(header)] : undefined),
      addOption: async (header, option) => {
        if (!enabled || !csvUrl) throw new Error("Spreadsheet tidak terhubung");
        const options = await addSheetDropdownOption(csvUrl, header, option);
        setDropdowns((prev) => {
          const next = { ...prev, [normalizeHeader(header)]: options };
          setLocalStorageItem(cacheKey(csvUrl), JSON.stringify(next));
          return next;
        });
      },
    }),
    [dropdowns, enabled, csvUrl],
  );

  return (
    <SheetDropdownsContext.Provider value={value}>{children}</SheetDropdownsContext.Provider>
  );
}

// Sheet values come in trimmed (and in any case), while some of the sheet's
// own dropdown options carry stray spaces — match them loosely.
function matchOption(value: string, options: string[]): string | undefined {
  const v = value.trim().toLowerCase();
  return options.find((o) => o.trim().toLowerCase() === v);
}

const ADD_VALUE = "__add_option__";

// A dropdown whose options come from the sheet column's own dropdown when it
// has one (falling back to `options`). Only then can the user add a label,
// which goes into that same dropdown in the sheet.
export function OptionSelect({
  value,
  onChange,
  options: fallback,
  sheetHeader,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  sheetHeader?: string;
  className?: string;
}) {
  const sheet = React.useContext(SheetDropdownsContext);
  const sheetOptions = sheet.optionsFor(sheetHeader);
  const options = sheetOptions ?? fallback;
  const canAdd = Boolean(sheetHeader && sheetOptions);

  const [adding, setAdding] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const matched = value ? matchOption(value, options) : undefined;
  // Older free-text values that aren't one of the options stay selectable,
  // so opening the editor doesn't silently blank them.
  const shown = value && !matched ? [value, ...options] : options;

  function closeAdd() {
    setAdding(false);
    setDraft("");
    setError(null);
  }

  async function saveNew() {
    const label = draft.trim();
    if (!label || !sheetHeader) return;
    const existing = matchOption(label, options);
    if (existing) {
      onChange(existing);
      closeAdd();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await sheet.addOption(sheetHeader, label);
      onChange(label);
      closeAdd();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menambah label");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-w-0">
      <select
        value={value ? (matched ?? value) : ""}
        onChange={(e) => {
          if (e.target.value === ADD_VALUE) setAdding(true);
          else onChange(e.target.value);
        }}
        className={className}
      >
        <option value="">-</option>
        {shown.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
        {canAdd ? <option value={ADD_VALUE}>+ Tambah label baru…</option> : null}
      </select>
      {adding ? (
        <div className="mt-1.5 flex items-center gap-1.5">
          <input
            autoFocus
            value={draft}
            placeholder="Label baru"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void saveNew();
              } else if (e.key === "Escape") {
                closeAdd();
              }
            }}
            className="h-8 min-w-0 flex-1 rounded-lg bg-white px-2.5 text-sm text-zinc-900 ring-1 ring-inset ring-zinc-200 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-accent-500"
          />
          <Button size="sm" disabled={saving || !draft.trim()} onClick={() => void saveNew()}>
            {saving ? "Menyimpan…" : "Simpan"}
          </Button>
          <Button size="sm" variant="secondary" disabled={saving} onClick={closeAdd}>
            Batal
          </Button>
        </div>
      ) : null}
      {error ? <div className="mt-1 text-xs text-red-600">{error}</div> : null}
    </div>
  );
}
