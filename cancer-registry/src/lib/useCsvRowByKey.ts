"use client";

import * as React from "react";
import { CancerTypeId, loadAddedRows } from "@/lib/addedRows";
import { parseCsv } from "@/lib/csv";
import { cacheCsv, readCsvCache } from "@/lib/csvCache";
import { rowKey } from "@/lib/rowOverrides";

type Row = Record<string, string>;

function findRow(rows: Row[], key: string, cancerType: CancerTypeId): Row | null {
  return (
    rows.find((r) => rowKey(r) === key) ??
    loadAddedRows(cancerType).find((r) => rowKey(r) === key) ??
    null
  );
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
      const cached = readCsvCache(url);
      if (cached) {
        if (!cancelled) {
          setHeaders(cached.headers);
          setRow(findRow(cached.rows, key, cancerType));
        }
        return;
      }
      try {
        const res = await fetch(`/api/csv?url=${encodeURIComponent(url)}`);
        const text = await res.text();
        if (!res.ok) {
          if (!cancelled) setError(text || "Failed to load data");
          return;
        }
        const parsed = parseCsv(text);
        cacheCsv(url, parsed.headers, parsed.rows);
        if (!cancelled) {
          setHeaders(parsed.headers);
          setRow(findRow(parsed.rows, key, cancerType));
        }
      } catch (e) {
        if (!cancelled) {
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
