const path = require("node:path");

const express = require("express");
const { WebSocketServer, WebSocket } = require("ws");

const { initDb, query, one, run, saveDebounced, randomId } = require("./db");
const { parseCsv } = require("./csv");

const PORT = Number(process.env.PORT || 4000);

function json(res, status, obj) {
  res.status(status).json(obj);
}

function getToken(req) {
  const h = req.headers.authorization || "";
  const m = /^Bearer\s+(.+)$/.exec(h);
  return m ? m[1] : null;
}

function isAllowedCsvUrl(u) {
  try {
    const url = new URL(u);
    const host = url.hostname.toLowerCase();
    return (
      url.protocol === "https:" &&
      (host === "docs.google.com" ||
        host.endsWith(".docs.google.com") ||
        host === "drive.google.com" ||
        host.endsWith(".googleusercontent.com"))
    );
  } catch {
    return false;
  }
}

function toGoogleSheetsCsvExportUrl(input) {
  let url;
  try {
    url = new URL(input);
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase();
  if (host !== "docs.google.com" && !host.endsWith(".docs.google.com")) {
    return url.toString();
  }

  // If already an export/gviz CSV link, keep it.
  if (
    url.searchParams.get("format") === "csv" ||
    url.searchParams.get("tqx")?.includes("out:csv")
  ) {
    return url.toString();
  }

  const m = /\/spreadsheets\/d\/([^/]+)/.exec(url.pathname);
  if (!m) return url.toString();
  const spreadsheetId = m[1];

  const gid =
    url.searchParams.get("gid") ||
    (() => {
      const hm = /gid=(\d+)/.exec(url.hash || "");
      return hm ? hm[1] : null;
    })();

  if (!gid) return null;
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;
}

function normalizePatientRow(r) {
  return {
    id: r.id,
    nama: r.nama,
    noErm: r.no_erm,
    tahun: r.tahun,
    jk: r.jk,
    usia: r.usia,
    pendidikanTerakhir: r.pendidikan_terakhir,
    pekerjaan: r.pekerjaan,
    noHp: r.no_hp,
    nik: r.nik,
    leader: r.leader,
    updatedAt: r.updated_at,
  };
}

async function main() {
  await initDb();

  const app = express();
  app.use(express.json({ limit: "6mb" }));

  // Allow using a separate static server (e.g. Go Live) during development.
  // For normal use, open the site from this server (same origin).
  app.use("/api", (req, res, next) => {
    res.setHeader("access-control-allow-origin", "*");
    res.setHeader("access-control-allow-headers", "content-type, authorization");
    res.setHeader("access-control-allow-methods", "GET,POST,OPTIONS");
    if (req.method === "OPTIONS") return res.status(204).end();
    next();
  });

  // Serve the static website (so everyone uses same URL).
  const staticDir = path.join(__dirname, "..", "docs");
  app.use(express.static(staticDir));

  // Health check
  app.get("/api/health", (_req, res) => {
    return json(res, 200, { ok: true, time: new Date().toISOString() });
  });

  function importHlFromCsvText(csvText) {
    const parsed = parseCsv(csvText);
    const headers = parsed.headers.filter((h) => h.trim() !== "");
    const rows = parsed.data;

    run("BEGIN");
    try {
      run("DELETE FROM hl_rows");
      run("INSERT OR REPLACE INTO hl_meta(key,value) VALUES('headers',?)", [
        JSON.stringify(headers),
      ]);
      const now = new Date().toISOString();
      for (const r of rows) {
        run("INSERT INTO hl_rows(id,row_json,updated_at) VALUES(?,?,?)", [
          randomId(),
          JSON.stringify(r),
          now,
        ]);
      }
      run("COMMIT");
    } catch (e) {
      run("ROLLBACK");
      throw e;
    }

    saveDebounced();
    return { headersCount: headers.length, rowsCount: rows.length };
  }

  // Auth (demo): accept any username/password, create session token.
  app.post("/api/auth/login", (req, res) => {
    const username = String(req.body?.username ?? "").trim();
    const password = String(req.body?.password ?? "");
    if (!username || !password) return json(res, 400, { error: "Missing fields" });

    const now = new Date().toISOString();
    let user = one("SELECT * FROM users WHERE username = ?", [username]);
    if (!user) {
      const userId = randomId();
      run("INSERT INTO users(id, username, created_at) VALUES(?,?,?)", [
        userId,
        username,
        now,
      ]);
      user = { id: userId, username };
    }

    const token = randomId();
    run(
      "INSERT INTO sessions(token, user_id, created_at, last_seen_at) VALUES(?,?,?,?)",
      [token, user.id, now, now],
    );
    saveDebounced();
    return json(res, 200, { token, username });
  });

  // Auth middleware for APIs
  app.use("/api", (req, res, next) => {
    if (req.path === "/health" || req.path === "/auth/login") return next();
    const token = getToken(req);
    if (!token) return json(res, 401, { error: "Unauthorized" });
    const sess = one("SELECT * FROM sessions WHERE token = ?", [token]);
    if (!sess) return json(res, 401, { error: "Unauthorized" });
    run("UPDATE sessions SET last_seen_at = ? WHERE token = ?", [
      new Date().toISOString(),
      token,
    ]);
    req.userId = sess.user_id;
    next();
  });

  // Cancer types
  app.get("/api/cancer-types", (_req, res) => {
    return json(res, 200, {
      items: [
        { id: "NHL", label: "NHL", description: "Non-Hodgkin Lymphoma" },
        { id: "HL", label: "HL", description: "Hodgkin Lymphoma" },
        { id: "BC", label: "Breast Cancer" },
        { id: "CC", label: "Cervical Cancer" },
        { id: "CRC", label: "Colorectal Cancer" },
        { id: "LC", label: "Lung Cancer" },
      ],
    });
  });

  // Patients
  app.get("/api/patients", (req, res) => {
    const q = String(req.query.search ?? "").trim().toLowerCase();
    const rows = q
      ? query(
          `
        SELECT * FROM patients
        WHERE lower(nama) LIKE ?
           OR lower(no_erm) LIKE ?
           OR lower(nik) LIKE ?
        ORDER BY updated_at DESC
        LIMIT 500
      `,
          [`%${q}%`, `%${q}%`, `%${q}%`],
        )
      : query(
          `SELECT * FROM patients ORDER BY updated_at DESC LIMIT 500`,
          [],
        );

    return json(res, 200, { items: rows.map(normalizePatientRow) });
  });

  app.post("/api/patients", (req, res) => {
    const b = req.body ?? {};
    const now = new Date().toISOString();
    const id = randomId();

    const required = [
      "nama",
      "noErm",
      "tahun",
      "jk",
      "usia",
      "pendidikanTerakhir",
      "pekerjaan",
      "noHp",
      "nik",
      "leader",
    ];
    for (const k of required) {
      if (b[k] == null || String(b[k]).trim() === "") {
        return json(res, 400, { error: `Missing ${k}` });
      }
    }

    run(
      `
      INSERT INTO patients(
        id, nama, no_erm, tahun, jk, usia,
        pendidikan_terakhir, pekerjaan, no_hp, nik, leader, updated_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    `,
      [
        id,
        String(b.nama).trim(),
        String(b.noErm).trim(),
        Number(b.tahun),
        String(b.jk).trim(),
        Number(b.usia),
        String(b.pendidikanTerakhir).trim(),
        String(b.pekerjaan).trim(),
        String(b.noHp).trim(),
        String(b.nik).trim(),
        String(b.leader).trim(),
        now,
      ],
    );
    saveDebounced();
    broadcast({ type: "patients_updated" });
    const r = one("SELECT * FROM patients WHERE id = ?", [id]);
    return json(res, 200, { item: normalizePatientRow(r) });
  });

  // HL: import CSV from file text
  app.post("/api/hl/import-csv", (req, res) => {
    const csvText = String(req.body?.csvText ?? "");
    if (!csvText.trim()) return json(res, 400, { error: "Missing csvText" });

    try {
      const result = importHlFromCsvText(csvText);
      broadcast({ type: "hl_updated" });
      return json(res, 200, { ok: true, ...result });
    } catch (e) {
      return json(res, 400, { error: e?.message ?? "Import failed" });
    }
  });

  // HL: import from URL (server-side fetch; avoids browser CORS)
  app.post("/api/hl/import-url", async (req, res) => {
    const raw = String(req.body?.url ?? "").trim();
    if (!raw) return json(res, 400, { error: "Missing url" });

    const url = toGoogleSheetsCsvExportUrl(raw);
    if (!url) {
      return json(res, 400, {
        error:
          "Could not detect gid from Google Sheets URL. Please copy the full URL including `gid=...`.",
      });
    }
    if (!isAllowedCsvUrl(url)) {
      return json(res, 400, {
        error:
          "URL not allowed. Please use a public Google Sheets/Drive CSV link.",
      });
    }

    try {
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) return json(res, 400, { error: `Fetch failed (${r.status})` });
      const text = await r.text();
      const result = importHlFromCsvText(text);
      broadcast({ type: "hl_updated" });
      return json(res, 200, { ok: true, sourceUrl: url, ...result });
    } catch (e) {
      return json(res, 400, { error: e?.message ?? "Fetch failed" });
    }
  });

  // HL: query (returns headers + first 500 rows, with search)
  app.get("/api/hl", (req, res) => {
    const meta = one("SELECT value FROM hl_meta WHERE key='headers'");
    const headers = meta?.value ? JSON.parse(meta.value) : [];
    const q = String(req.query.search ?? "").trim().toLowerCase();

    const all = query("SELECT row_json FROM hl_rows ORDER BY updated_at DESC", []);
    const parsedRows = all.map((r) => {
      try {
        return JSON.parse(r.row_json);
      } catch {
        return {};
      }
    });

    const filtered = !q
      ? parsedRows
      : parsedRows.filter((row) =>
          headers
            .map((h) => String(row[h] ?? ""))
            .join(" ")
            .toLowerCase()
            .includes(q),
        );

    return json(res, 200, {
      headers,
      rows: filtered.slice(0, 500),
      total: parsedRows.length,
      shown: Math.min(filtered.length, 500),
      matched: filtered.length,
    });
  });

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`LAN: open http://<this-computer-ip>:${PORT}`);
  });

  const wss = new WebSocketServer({ server, path: "/ws" });
  const sockets = new Set();

  function broadcast(msg) {
    const text = JSON.stringify(msg);
    for (const ws of sockets) {
      if (ws.readyState === WebSocket.OPEN) ws.send(text);
    }
  }

  wss.on("connection", (ws) => {
    sockets.add(ws);
    ws.on("close", () => sockets.delete(ws));
    ws.on("message", () => {});
    ws.send(JSON.stringify({ type: "hello" }));
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

