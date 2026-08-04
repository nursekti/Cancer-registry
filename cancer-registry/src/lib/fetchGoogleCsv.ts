// Public "anyone with the link" Google Sheets/Drive CSV export URLs send
// `access-control-allow-origin: *`, so this can fetch directly from the
// browser — no server proxy needed.

function isAllowedUrl(url: URL) {
  const host = url.hostname.toLowerCase();
  return (
    host === "docs.google.com" ||
    host.endsWith(".docs.google.com") ||
    host === "drive.google.com" ||
    host.endsWith(".googleusercontent.com")
  );
}

function normalizeGoogleSheetsUrl(rawUrl: string) {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return rawUrl;
  }

  const host = url.hostname.toLowerCase();
  if (host !== "docs.google.com" && !host.endsWith(".docs.google.com")) {
    return rawUrl;
  }

  const match = url.pathname.match(/\/spreadsheets\/d\/([^/]+)/);
  if (!match) {
    return rawUrl;
  }

  const sheetId = match[1];
  const gid = url.searchParams.get("gid") ?? url.hash.replace(/^#gid=/, "");
  const exportUrl = new URL(`https://docs.google.com/spreadsheets/d/${sheetId}/export`);
  exportUrl.searchParams.set("format", "csv");
  if (gid) {
    exportUrl.searchParams.set("gid", gid);
  }

  return exportUrl.toString();
}

export async function fetchGoogleCsv(rawUrl: string): Promise<string> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Invalid url");
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Invalid url protocol");
  }

  if (!isAllowedUrl(url)) {
    throw new Error(
      "URL host not allowed. Please use a public Google Sheets/Drive CSV link.",
    );
  }

  const resolvedUrl = normalizeGoogleSheetsUrl(url.toString());
  const res = await fetch(resolvedUrl, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Fetch failed (${res.status})`);
  }

  const text = await res.text();
  if (text.length > 5_000_000) {
    throw new Error("File too large (max 5MB)");
  }

  return text;
}
