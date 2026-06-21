const fs = require("node:fs");
const path = require("node:path");

const initSqlJs = require("sql.js");

const DATA_DIR = path.join(__dirname, "data");
const DB_PATH = path.join(DATA_DIR, "cancer-registry.db");

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

let SQL = null;
let db = null;
let saving = false;

async function initDb() {
  ensureDataDir();
  if (!SQL) {
    SQL = await initSqlJs({
      locateFile: (file) =>
        path.join(__dirname, "node_modules", "sql.js", "dist", file),
    });
  }

  let fileBuffer = null;
  if (fs.existsSync(DB_PATH)) {
    fileBuffer = fs.readFileSync(DB_PATH);
  }
  db = new SQL.Database(fileBuffer ? new Uint8Array(fileBuffer) : undefined);

  migrate();
  seedIfEmpty();
  saveNow(); // ensure file exists

  return db;
}

function migrate() {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS patients (
      id TEXT PRIMARY KEY,
      nama TEXT NOT NULL,
      no_erm TEXT NOT NULL,
      tahun INTEGER NOT NULL,
      jk TEXT NOT NULL,
      usia INTEGER NOT NULL,
      pendidikan_terakhir TEXT NOT NULL,
      pekerjaan TEXT NOT NULL,
      no_hp TEXT NOT NULL,
      nik TEXT NOT NULL,
      leader TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_patients_name ON patients(nama);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_patients_noerm ON patients(no_erm);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_patients_nik ON patients(nik);`);

  db.run(`
    CREATE TABLE IF NOT EXISTS hl_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS hl_rows (
      id TEXT PRIMARY KEY,
      row_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
}

function seedIfEmpty() {
  const c = one(`SELECT COUNT(*) AS c FROM patients`).c;
  if (c > 0) return;

  const now = new Date().toISOString();
  const seed = [
    {
      nama: "Ahmad Fauzi",
      no_erm: "ERM-000123",
      tahun: 2025,
      jk: "Laki-laki",
      usia: 34,
      pendidikan_terakhir: "SMA",
      pekerjaan: "Karyawan Swasta",
      no_hp: "0812-3456-7890",
      nik: "3276010101010001",
      leader: "Dr. Sari",
    },
    {
      nama: "Dewi Lestari",
      no_erm: "ERM-000456",
      tahun: 2024,
      jk: "Perempuan",
      usia: 28,
      pendidikan_terakhir: "S1",
      pekerjaan: "Perawat",
      no_hp: "0821-2345-6789",
      nik: "3174010202020002",
      leader: "Dr. Budi",
    },
    {
      nama: "Rizky Pratama",
      no_erm: "ERM-000789",
      tahun: 2026,
      jk: "Laki-laki",
      usia: 41,
      pendidikan_terakhir: "S2",
      pekerjaan: "Wiraswasta",
      no_hp: "0852-1111-2222",
      nik: "3201010303030003",
      leader: "Dr. Sari",
    },
  ];

  const stmt = db.prepare(`
    INSERT INTO patients(
      id, nama, no_erm, tahun, jk, usia,
      pendidikan_terakhir, pekerjaan, no_hp, nik, leader, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?
    )
  `);
  try {
    db.run("BEGIN");
    for (const p of seed) {
      stmt.run([
        randomId(),
        p.nama,
        p.no_erm,
        p.tahun,
        p.jk,
        p.usia,
        p.pendidikan_terakhir,
        p.pekerjaan,
        p.no_hp,
        p.nik,
        p.leader,
        now,
      ]);
    }
    db.run("COMMIT");
  } catch (e) {
    db.run("ROLLBACK");
    throw e;
  } finally {
    stmt.free();
  }
}

function query(sql, params = []) {
  const stmt = db.prepare(sql);
  try {
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    return rows;
  } finally {
    stmt.free();
  }
}

function one(sql, params = []) {
  return query(sql, params)[0] ?? null;
}

function run(sql, params = []) {
  const stmt = db.prepare(sql);
  try {
    stmt.run(params);
  } finally {
    stmt.free();
  }
}

function saveNow() {
  if (!db) return;
  ensureDataDir();
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

function saveDebounced() {
  if (saving) return;
  saving = true;
  setTimeout(() => {
    try {
      saveNow();
    } finally {
      saving = false;
    }
  }, 250);
}

function randomId() {
  return (
    Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10)
  );
}

module.exports = {
  initDb,
  query,
  one,
  run,
  saveNow,
  saveDebounced,
  randomId,
};

