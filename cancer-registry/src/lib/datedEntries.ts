// Hasil PA / Hasil IHK cells hold one or more reports, each usually opened by
// a short line with its date ("PA 10/11/2023", "IHC 24/11/2023",
// "25/03/2025"), followed by the long report text. These split such a cell
// into dated entries and join them back into the cell's text.

export type DatedEntry = { tanggal: string; isi: string }; // tanggal: yyyy-mm-dd or ""

const DATE_RE = /\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})\b/;

// Only short lines count as an entry's date line; a date mentioned inside a
// sentence of the report stays part of the text.
const MAX_DATE_LINE_LENGTH = 60;

function toIsoDate(day: string, month: string, year: string): string | null {
  const d = Number(day);
  const m = Number(month);
  const y = year.length === 2 ? 2000 + Number(year) : Number(year);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function formatDmy(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

export function parseDatedEntries(text: string): DatedEntry[] {
  const entries: DatedEntry[] = [];
  let current: DatedEntry | null = null;

  for (const line of text.replace(/\r\n?/g, "\n").split("\n")) {
    const match = line.length <= MAX_DATE_LINE_LENGTH ? line.match(DATE_RE) : null;
    const iso = match ? toIsoDate(match[1], match[2], match[3]) : null;
    if (match && iso) {
      if (current) entries.push(current);
      // Keep what else the date line says ("PA biopsi insisi R. Bucal (S)"),
      // but drop a bare "PA"/"IHC" label.
      const rest = line.replace(match[0], "").trim();
      current = { tanggal: iso, isi: /^(pa|ihc|ihk)\s*:?$/i.test(rest) ? "" : rest };
    } else {
      current ??= { tanggal: "", isi: "" };
      current.isi = current.isi ? `${current.isi}\n${line}` : line;
    }
  }
  if (current) entries.push(current);

  return entries
    .map((e) => ({ ...e, isi: e.isi.trim() }))
    .filter((e) => e.tanggal || e.isi);
}

export function serializeDatedEntries(entries: DatedEntry[]): string {
  return entries
    .map((e) => [e.tanggal ? formatDmy(e.tanggal) : "", e.isi.trim()].filter(Boolean).join("\n"))
    .filter(Boolean)
    .join("\n\n");
}
