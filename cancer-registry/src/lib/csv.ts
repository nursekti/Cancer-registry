import Papa from "papaparse";

export type CsvParseResult = {
  headers: string[];
  rows: Array<Record<string, string>>;
  errors: string[];
};

// Tabs like "Data NHL - Post Processing" have three header rows — section,
// group, field — with data from row 4. Field names repeat across groups
// (Lini 1/2/3 "Siklus", Pre/During/Post kemo "Tanggal periksa"), so a repeated
// field is keyed "Group › Field"; unique ones keep their plain name. The Apps
// Script (apps-script/Code.gs groupedHeaders_) builds the same keys.
export const GROUPED_HEADER_SEPARATOR = " › ";

export function groupedHeaders(sections: string[], groups: string[], fields: string[]): string[] {
  const counts = new Map<string, number>();
  for (const f of fields) if (f) counts.set(f, (counts.get(f) ?? 0) + 1);
  let group = "";
  return fields.map((field, i) => {
    // Merged cells come through only in their first column.
    if (sections[i]) group = "";
    if (groups[i]) group = groups[i];
    if (!field) return "";
    return (counts.get(field) ?? 0) > 1 && group ? `${group}${GROUPED_HEADER_SEPARATOR}${field}` : field;
  });
}

function isGroupedLayout(grid: string[][]): boolean {
  return grid.length >= 3 && grid[0][0]?.toLowerCase() === "identitas pasien";
}

export function isGroupedHeaders(headers: string[]): boolean {
  return headers.some((h) => h.includes(GROUPED_HEADER_SEPARATOR));
}

export function parseCsv(text: string): CsvParseResult {
  const parsed = Papa.parse<string[]>(text, { header: false, skipEmptyLines: "greedy" });
  const grid = (parsed.data ?? []).map((r) => r.map((v) => (typeof v === "string" ? v.trim() : "")));

  const grouped = isGroupedLayout(grid);
  const headerRows = grouped ? 3 : 1;
  const columnHeaders = grouped
    ? groupedHeaders(grid[0], grid[1], grid[2])
    : (grid[0] ?? []);

  const headers = columnHeaders.filter(Boolean);
  const rows: Array<Record<string, string>> = [];
  for (const r of grid.slice(headerRows)) {
    const out: Record<string, string> = {};
    columnHeaders.forEach((h, i) => {
      if (h) out[h] = r[i] ?? "";
    });
    if (Object.values(out).some((v) => v !== "")) rows.push(out);
  }

  const errors = (parsed.errors ?? []).map((e) => e.message);
  return { headers, rows, errors };
}
