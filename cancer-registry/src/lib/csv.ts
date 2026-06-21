import Papa from "papaparse";

export type CsvParseResult = {
  headers: string[];
  rows: Array<Record<string, string>>;
  errors: string[];
};

export function parseCsv(text: string): CsvParseResult {
  const parsed = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transform: (value) => (typeof value === "string" ? value.trim() : value),
  });

  const headers = (parsed.meta.fields ?? []).filter(Boolean);

  const rows: Array<Record<string, string>> = [];
  for (const r of parsed.data ?? []) {
    const out: Record<string, string> = {};
    for (const h of headers) {
      const v = r?.[h];
      out[h] = v == null ? "" : String(v);
    }
    if (Object.values(out).some((v) => v !== "")) rows.push(out);
  }

  const errors = (parsed.errors ?? []).map((e) => e.message);
  return { headers, rows, errors };
}

