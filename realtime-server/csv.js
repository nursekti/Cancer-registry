function parseCsv(text) {
  const rows = [];
  let row = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"' && inQuotes && next === '"') {
      cur += '"';
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      row.push(cur);
      cur = "";
      continue;
    }
    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && next === "\n") i++;
      row.push(cur);
      cur = "";
      rows.push(row);
      row = [];
      continue;
    }
    cur += ch;
  }
  row.push(cur);
  rows.push(row);

  const cleaned = rows
    .map((r) => r.map((v) => (typeof v === "string" ? v.trim() : v)))
    .filter((r) => r.some((v) => String(v ?? "").trim() !== ""));

  if (cleaned.length === 0) return { headers: [], data: [] };
  const headers = cleaned[0].map((h) => String(h ?? "").trim());

  const data = cleaned.slice(1).map((r) => {
    const obj = {};
    for (let i = 0; i < headers.length; i++) {
      const key = headers[i] || `col_${i + 1}`;
      obj[key] = r[i] == null ? "" : String(r[i]);
    }
    return obj;
  });

  return { headers, data };
}

module.exports = { parseCsv };

