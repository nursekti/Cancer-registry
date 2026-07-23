type Row = Record<string, string>;

type CsvCacheEntry = {
  headers: string[];
  rows: Row[];
};

const PREFIX = "cr_csv_cache:";

export function cacheCsv(url: string, headers: string[], rows: Row[]): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      PREFIX + url,
      JSON.stringify({ headers, rows }),
    );
  } catch {
    // ignore (quota, disabled storage, etc.)
  }
}

export function readCsvCache(url: string): CsvCacheEntry | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(PREFIX + url);
    if (!raw) return null;
    return JSON.parse(raw) as CsvCacheEntry;
  } catch {
    return null;
  }
}
