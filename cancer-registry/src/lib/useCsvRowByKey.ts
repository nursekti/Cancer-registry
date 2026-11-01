"use client";

import * as React from "react";
import { CancerTypeId, loadAddedRows } from "@/lib/addedRows";
import { parseCsv } from "@/lib/csv";
import { cacheCsv, readCsvCache } from "@/lib/csvCache";
import { fetchGoogleCsv } from "@/lib/fetchGoogleCsv";
import { rowKey } from "@/lib/rowOverrides";

type Row = Record<string, string>;

function findRow(rows: Row[], key: string, cancerType: CancerTypeId): Row | null {
  return (
    rows.find((r) => rowKey(r) === key) ??
    loadAddedRows(cancerType).find((r) => rowKey(r) === key) ??
    null
  );
}

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function useCsvRowByKey(
  url: string,
  key: string,
  cancerType: CancerTypeId,
) {
  const [headers, setHeaders] = React.useState<string[]>([]);
  const [row, setRow] = React.useState<Row | null | undefined>(undefined);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setRow(undefined);
    setError(null);

    async function load() {
      if (!url) {
        // A brand-new module without an imported CSV yet — only manually
        // added records exist.
        if (!cancelled) setRow(findRow([], key, cancerType));
        return;
      }
      // Show the cached copy right away, but always re-fetch so a page
      // refresh picks up edits made directly in the sheet.
      const cached = readCsvCache(url);
      if (cached && !cancelled) {
        setHeaders(cached.headers);
        setRow(findRow(cached.rows, key, cancerType));
      }
      try {
        const text = await fetchGoogleCsv(url);
        const parsed = parseCsv(text);
        cacheCsv(url, parsed.headers, parsed.rows);
        if (!cancelled) {
          // Keep the same objects when nothing changed, so the detail view
          // doesn't needlessly re-seed.
          setHeaders((prev) => (sameJson(prev, parsed.headers) ? prev : parsed.headers));
          const fresh = findRow(parsed.rows, key, cancerType);
          setRow((prev) => (sameJson(prev, fresh) ? prev : fresh));
        }
      } catch (e) {
        // With a cached copy on screen, a failed refresh just keeps it.
        if (!cancelled && !cached) {
          setError(e instanceof Error ? e.message : "Unknown error");
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [url, key, cancerType]);

  return { headers, row, error, loading: row === undefined && !error };
}
