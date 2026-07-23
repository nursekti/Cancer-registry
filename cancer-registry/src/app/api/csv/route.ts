import { NextResponse } from "next/server";

export const runtime = "nodejs";

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

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const rawUrl = searchParams.get("url");
  if (!rawUrl) {
    return NextResponse.json(
      { error: "Missing 'url' query param" },
      { status: 400 },
    );
  }

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    return NextResponse.json({ error: "Invalid url protocol" }, { status: 400 });
  }

  if (!isAllowedUrl(url)) {
    return NextResponse.json(
      {
        error:
          "URL host not allowed. Please use a public Google Sheets/Drive CSV link.",
      },
      { status: 400 },
    );
  }

  const resolvedUrl = normalizeGoogleSheetsUrl(url.toString());
  const res = await fetch(resolvedUrl, { cache: "no-store" });
  if (!res.ok) {
    return NextResponse.json(
      { error: `Fetch failed (${res.status})` },
      { status: 400 },
    );
  }

  const text = await res.text();
  if (text.length > 5_000_000) {
    return NextResponse.json(
      { error: "File too large (max 5MB)" },
      { status: 413 },
    );
  }

  return new NextResponse(text, {
    headers: {
      "content-type": res.headers.get("content-type") ?? "text/plain; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

