// The HL sheet only stores a computed IMT value, not BB/TB — reverse-parse
// them from the cell's literal formula (e.g. "=51/(1,7)^2") via the Sheets
// API, since that's the only place those numbers exist. Runs client-side
// with a Google API key that's restricted (HTTP referrer + Sheets API only)
// so it's safe to ship in the public bundle.

type SheetMeta = { properties: { sheetId: number; title: string } };

export function parseSpreadsheetId(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);
    const match = url.pathname.match(/\/spreadsheets\/d\/([^/]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

export function parseGid(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    return url.searchParams.get("gid") ?? url.hash.replace(/^#gid=/, "") ?? "0";
  } catch {
    return "0";
  }
}

// Rows written as "=51/(1,7)^2" embed the literal BB/TB(meters) values
// directly — only this exact shape can be reverse-parsed; anything else
// (plain typed-in numbers, blank cells, cell-reference formulas) is skipped.
function parseImtFormula(formula: string): { bb: string; tbCm: string } | null {
  const match = formula.match(/^=\s*([\d.,]+)\s*\/\s*\(?\s*([\d.,]+)\s*\)?\s*\^\s*2/);
  if (!match) return null;
  const tb = Number(match[2].replace(",", "."));
  if (Number.isNaN(tb)) return null;
  return { bb: match[1], tbCm: (tb * 100).toString().replace(".", ",") };
}

export async function fetchImtFormulas(
  sheetUrl: string,
): Promise<Record<string, { bb: string; tbCm: string }>> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_SHEETS_API_KEY;
  if (!apiKey) throw new Error("Missing NEXT_PUBLIC_GOOGLE_SHEETS_API_KEY");

  const spreadsheetId = parseSpreadsheetId(sheetUrl);
  if (!spreadsheetId) throw new Error("Invalid spreadsheet url");
  const gid = parseGid(sheetUrl);

  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?key=${apiKey}&fields=sheets.properties`,
    { cache: "no-store" },
  );
  if (!metaRes.ok) throw new Error("Failed to load sheet metadata");
  const meta = (await metaRes.json()) as { sheets?: SheetMeta[] };
  const sheet = meta.sheets?.find((s) => String(s.properties.sheetId) === gid);
  if (!sheet) throw new Error("Sheet tab not found");
  const title = sheet.properties.title;

  const params = new URLSearchParams({ key: apiKey, valueRenderOption: "FORMULA" });
  params.append("ranges", `'${title}'!B2:B`);
  params.append("ranges", `'${title}'!Z2:Z`);

  const valuesRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?${params.toString()}`,
    { cache: "no-store" },
  );
  if (!valuesRes.ok) throw new Error("Failed to load sheet formulas");
  const values = (await valuesRes.json()) as {
    valueRanges?: { values?: (string | number)[][] }[];
  };

  const noErmRows = values.valueRanges?.[0]?.values ?? [];
  const imtRows = values.valueRanges?.[1]?.values ?? [];

  const result: Record<string, { bb: string; tbCm: string }> = {};
  const rowCount = Math.max(noErmRows.length, imtRows.length);
  for (let i = 0; i < rowCount; i++) {
    const noErm = String(noErmRows[i]?.[0] ?? "").trim();
    const formula = imtRows[i]?.[0];
    if (!noErm || formula === undefined || typeof formula !== "string") continue;
    const parsed = parseImtFormula(formula);
    if (parsed) result[noErm] = parsed;
  }

  return result;
}
