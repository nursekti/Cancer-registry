import Papa from "papaparse";

export type ExportRow = Record<string, string>;

function toMatrix(headers: string[], rows: ExportRow[]): string[][] {
  return rows.map((row) => headers.map((h) => row[h] ?? ""));
}

export function exportToCsv(headers: string[], rows: ExportRow[], filename: string): void {
  const csv = Papa.unparse({ fields: headers, data: toMatrix(headers, rows) });
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  downloadBlob(blob, filename);
}

export async function exportToXlsx(
  headers: string[],
  rows: ExportRow[],
  filename: string,
): Promise<void> {
  const XLSX = await import("xlsx");
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...toMatrix(headers, rows)]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Data");
  XLSX.writeFile(workbook, filename);
}

export async function exportToPdf(
  headers: string[],
  rows: ExportRow[],
  filename: string,
  title?: string,
): Promise<void> {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: "landscape" });
  if (title) doc.text(title, 14, 12);

  autoTable(doc, {
    head: [headers],
    body: toMatrix(headers, rows),
    startY: title ? 18 : 10,
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [48, 71, 112] },
  });

  doc.save(filename);
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
