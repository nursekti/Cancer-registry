// Fills the "Data NHL - Post Processing" / "Data HL - Post Processing" tabs
// with every patient in DATA NHL / DATA HL, read the same way the web app
// reads a row (see cancer-registry/src/lib/sheetColumns.ts), then tidied so
// every dropdown/date cell is valid:
//   - spelling variants are mapped onto the dropdown's options
//     ("unknown" -> "tidak diketahui", "lugano III" -> "III", "nodul" -> "nodal")
//   - legitimate values missing from a dropdown are added to it (sub-stadia,
//     "R-MTX", "mamma", ...)
//   - anything else is left blank, with the original kept in "Catatan data"
//   - Siklus / Regimen / Awal-akhir cells that describe several lines of
//     therapy ("lini 1: ... lini 2: ...") are split into the Lini 1/2/3 columns,
//     and each Awal-akhir range into separate Awal / Akhir dates
//   - Follow up terakhir is split into its date and a status (Meninggal (MD),
//     Loss to follow up, Rujuk)
//   - DATA HL has no BB/TB columns; they're read back from its IMT formulas
//     ("=51/(1,7)^2")
//
// Run importNhlToPostProcessing() / importHlToPostProcessing() once from the
// editor. Each replaces all data rows (row 4 onward) of its tab except the
// formula columns (Jumlah komorbiditas, ANC..PLR, IMT, Kategori IMT, BSA),
// which recompute by themselves. After that the web app reads and writes the
// tab directly (see Code.gs).

// Tabs are found by their gid, so renaming them doesn't break the import.
const PP_TARGETS = {
  NHL: { label: "NHL", source: 0, target: 803887597, importedKey: "ppImportedAt" },
  HL: { label: "HL", source: 188215245, target: 374219075, importedKey: "ppImportedAt:HL" },
};
const PP_FIRST_ROW = 4;
const PP_COLUMNS = 88;
// 0-based column ranges [start, end) that hold data; the gaps are formula columns.
const PP_SEGMENTS = [[0, 17], [18, 37], [42, 55], [58, 88]];

// --- dropdown options (0-based column -> options) ------------------------------
// These match the tab's dropdowns; ppEnsureOptions_ adds whatever is missing.

const PP_OPT = {
  pendidikan: ["SD", "SLTP", "SMP", "SLTA", "SMA", "Diploma", "S1", "S2", "S3", "Belum sekolah"],
  leader: ["BEDAH", "INTERNA", "ANAK", "THT", "SARAF", "PARU", "KULIT", "MATA", "BEDAH MULUT",
    "INTERNA - ANAK", "RADIOTERAPI"],
  nodal: ["nodal", "extranodal"],
  subtipe: [
    "NHL - Diffuse Large B-Cell Lymphoma (DLBCL)", "NHL - Mantle cell lymphoma",
    "NHL - Lymphoblastic lymphoma", "NHL - Burkitt lymphoma",
    "NHL - Primary mediastinal (thymic) large B-cell lymphoma (PMBCL)",
    "NHL - Transformed follicular and transformed MALT lymphomas",
    "NHL - High-grade B-cell lymphoma with double or triple hits (HBL)",
    "NHL - Primary cutaneous DLBCL", "NHL - PCNSL", "NHL - Follicular lymphoma",
    "NHL - Marginal zone lymphoma (MZL)", "NHL - CLL/SLL",
    "NHL - mucosa-associated lymphoid tissue (MALT) lymphoma",
    "NHL - Lymphoplasmacytic lymphoma", "NHL - Waldenström macroglobulinemia",
    "NHL - Nodal marginal zone lymphoma (NMZL)", "NHL - Splenic marginal zone lymphoma (SMZL)",
    "NHL - Peripheral T-cell lymphoma", "not otherwise specified (PTCL-NOS)",
    "NHL - Systemic anaplastic large-cell lymphoma (ALCL)", "NHL - Hepatosplenic T-cell lymphoma",
    "NHL - Mycosis fungoides (MF)", "NHL - Enteropathy-associated intestinal T-cell lymphoma",
    "NHL - Angioimmunoblastic T-cell lymphoma (AITL)",
    "NHL - Extranodal natural killer (NK)/T-cell lymphoma (ENK/TCL) nasal type",
    "NHL - Primary cutaneous anaplastic large-cell lymphoma (pcALCL)",
    "NHL - Subcutaneous panniculitis-like T-cell lymphoma (SPTCL)",
    "NHL - T cell type unspecified", "NHL - B cell type unspecified", "NHL - unspecified",
    "NHL - extranodal marginal-zone B-cell NHL", "HL - Nodular Sclerosis",
    "HL - Mixed Cellularity", "HL - Lymphocyte-rich", "HL - Lymphocyte-depleted",
    "HL - nodular lymphocyte-predominant B-cell lymphoma (NLPBL)", "HL - unspecified",
    "belum IHC",
  ],
  ecog: ["0", "1", "2", "3", "4"],
  yaTidak: ["Ya", "Tidak"],
  stadium: ["I", "IA", "IB", "IE", "II", "IIA", "IIB", "IIE", "III", "IIIA", "IIIB", "IIIE",
    "IV", "IVA", "IVB", "IVE", "tidak diketahui"],
  metastasis: ["tidak ada", "pulmo", "bone", "brain", "lien", "hepar", "thyroid", "duodenum",
    "pleura", "peritoneum", "mamma", "tidak diketahui"],
  rejimen1: ["CHOP", "R-CHOP", "R-CTX/R-CVP", "Rituximab", "CYP", "Chlorambucil", "Non-specific",
    "Others", "R-COEP", "COEP", "5-FU/LV", "CHEOP", "R-MTX"],
  rejimen2: ["CHOP", "R-CHOP", "R-CTX/R-CVP", "Rituximab", "CYP", "Chlorambucil", "mini R-CEOP",
    "HD-MTX", "ICE-Mesna", "RICE-Mesna", "R-ICE", "TC", "R-CEOP"],
  respon: ["CR", "PR", "SD", "PD", "tidak dievaluasi", "tidak dikemo", "kemo tidak lengkap",
    "eval dg USG, thorax", "on going chemo", "CT scan sebelum tidak ada", "masih dalam evaluasi",
    "MD sebelum sls kemo", "loss to fu"],
  radioterapi: ["Ya", "Tidak"],
  dosis: ["<30 Gy", "30-35 Gy", "36-40 Gy", "41-45 Gy", "46-50 Gy", "> 50 Gy", "Not Specified"],
  status: ["Include", "Exclude", "Tidak Lengkap"],
  jk: ["Laki - Laki", "Perempuan"],
};
PP_OPT.rejimen3 = PP_OPT.rejimen1.concat(PP_OPT.rejimen2.filter((o) => PP_OPT.rejimen1.indexOf(o) < 0));

// Dropdown lists to extend in the tab (replace: true swaps the whole list).
const PP_DROPDOWNS = [
  [6, PP_OPT.pendidikan], [9, PP_OPT.leader], [15, PP_OPT.subtipe],
  [42, PP_OPT.stadium, true], [43, PP_OPT.metastasis],
  [59, PP_OPT.rejimen1], [65, PP_OPT.rejimen2], [71, PP_OPT.rejimen3],
];

// Spelling variants -> option. A trailing "*" in the target means "mapped, but
// keep the original in Catatan data too" (the mapping loses some detail).
const PP_ALIAS = {
  pendidikan: { "sarjana 1": "S1", "belum seklah": "Belum sekolah" },
  nodal: { "nodul": "nodal", "extranodul": "extranodal" },
  subtipe: {
    "nhl - gastric mucosa-associated lymphoid tissue (malt) lymphoma":
      "NHL - mucosa-associated lymphoid tissue (MALT) lymphoma*",
    "cuteneous t-cell lymphoma": "NHL - T cell type unspecified*",
    "cutaneous t-cell lymphoma": "NHL - T cell type unspecified*",
  },
  metastasis: { "belum diketahui": "tidak diketahui", "pilmo": "pulmo", "lian": "lien",
    "tiroid": "thyroid", "pulmonal": "pulmo" },
  respon: { "tidak evaluasi": "tidak dievaluasi" },
};

const PP_EMPTY = ["", "-", "--", "?", "??", "—"];

// --- entry point ----------------------------------------------------------------

// Once imported, a tab is where the web app reads and writes that module's
// data, so a second import would wipe those edits. It refuses to run again;
// the reimport...AndOverwriteEdits() functions rebuild a tab on purpose.
function importNhlToPostProcessing() {
  ppImportOnce_(PP_TARGETS.NHL);
}

function reimportNhlAndOverwriteEdits() {
  ppImport_(PP_TARGETS.NHL);
}

function importHlToPostProcessing() {
  ppImportOnce_(PP_TARGETS.HL);
}

function reimportHlAndOverwriteEdits() {
  ppImport_(PP_TARGETS.HL);
}

function ppImportOnce_(target) {
  const imported = PropertiesService.getScriptProperties().getProperty(target.importedKey);
  if (imported) {
    throw new Error(
      "Import " + target.label + " sudah dijalankan (" + imported + "). Tab ini sekarang sumber " +
        "data web, jadi import ulang akan menimpa semua edit. Kalau memang mau, jalankan reimport" +
        (target.label === "NHL" ? "Nhl" : "Hl") + "AndOverwriteEdits().",
    );
  }
  ppImport_(target);
}

// Key under which a row carries its IMT cell's formula (for DATA HL's BB/TB).
const PP_IMT_FORMULA = "__imtFormula";

function ppImport_(target) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dst = ppSheetById_(ss, target.target);
  const sourceRange = ppSheetById_(ss, target.source).getDataRange();
  const values = sourceRange.getDisplayValues();
  const formulas = sourceRange.getFormulas();
  const headers = values[0];
  const imtCol = headers.findIndex((h) => h.toLowerCase().includes("imt (kg"));
  // Same as the web app: values trimmed, rows without a name or ERM skipped.
  const rows = values
    .slice(1)
    .map((r, i) => {
      const row = {};
      headers.forEach((h, j) => (row[h] = String(r[j] == null ? "" : r[j]).trim()));
      row[PP_IMT_FORMULA] = imtCol >= 0 ? String(formulas[i + 1][imtCol] || "") : "";
      return row;
    })
    .filter((r) => r[ppExact_(headers, "nama")] || r[ppExact_(headers, "no erm")]);

  const out = rows.map((r) => ppBuildRow_(r, headers));

  const capacity = dst.getMaxRows() - PP_FIRST_ROW + 1;
  if (out.length > capacity) {
    throw new Error(
      "Tab " + dst.getName() + " hanya muat " + capacity + " baris data, perlu " + out.length +
        ". Tambahkan baris di bawah tabel (dengan format yang sama), lalu jalankan lagi.",
    );
  }

  PP_DROPDOWNS.forEach(([col, options, replace]) => ppEnsureOptions_(dst, col, options, replace));

  PP_SEGMENTS.forEach(([a, b]) => {
    dst.getRange(PP_FIRST_ROW, a + 1, capacity, b - a).clearContent();
    dst.getRange(PP_FIRST_ROW, a + 1, out.length, b - a).setValues(out.map((row) => row.slice(a, b)));
  });
  SpreadsheetApp.flush();
  PropertiesService.getScriptProperties().setProperty(target.importedKey, new Date().toISOString());
  const withNotes = out.filter((row) => row[PP_COLUMNS - 1]).length;
  Logger.log(
    "OK: " + out.length + " pasien " + target.label + " ditulis ke " + dst.getName() + " (" + withNotes +
      " dengan Catatan data).",
  );
}

function ppSheetById_(ss, id) {
  const sheet = ss.getSheets().find((s) => s.getSheetId() === id);
  if (!sheet) throw new Error("Tab dengan gid " + id + " tidak ditemukan");
  return sheet;
}

// Adds missing options to a column's dropdown (or swaps the list), keeping
// each rule's other settings — display style, multiple selections, warn vs
// reject — by copying it.
function ppEnsureOptions_(sheet, col, options, replace) {
  const range = sheet.getRange(PP_FIRST_ROW, col + 1, sheet.getMaxRows() - PP_FIRST_ROW + 1, 1);
  const rules = range.getDataValidations();
  const first = rules.map((r) => r[0]).find(ppIsListRule_);
  if (!first) return;
  const current = first.getCriteriaValues()[0].map(String);
  const next = replace
    ? options.slice()
    : current.concat(options.filter((o) => !current.some((c) => c.trim().toLowerCase() === o.toLowerCase())));
  if (next.length === current.length && next.every((o, i) => o === current[i])) return;
  const showDropdown = first.getCriteriaValues()[1];
  range.setDataValidations(
    rules.map((r) => [
      ppIsListRule_(r[0]) ? r[0].copy().requireValueInList(next, showDropdown).build() : r[0],
    ]),
  );
}

function ppIsListRule_(rule) {
  return rule && rule.getCriteriaType() === SpreadsheetApp.DataValidationCriteria.VALUE_IN_LIST;
}

// --- one patient -> one row of 88 columns ------------------------------------------

const PP_RIWAYAT = [
  ["kanker keluarga", "Kanker keluarga"],
  ["riwayat dm", "DM"],
  ["riwayat ht", "HT"],
  ["penyakit jantung", "Penyakit jantung"],
  ["hepatitis b", "Hepatitis B"],
  ["riwayat ckd", "CKD"],
  ["riwayat ppok", "PPOK"],
  ["riwayat hiv", "HIV"],
  ["double primary", "Double primary"],
];

function ppBuildRow_(r, headers) {
  const c = (needle) => ppGet_(r, ppContains_(headers, needle));
  const x = (needle) => ppGet_(r, ppExact_(headers, needle));
  const notes = []; // -> Catatan data
  const pick = (label, raw, options, aliases) => {
    const res = ppPick_(raw, options, aliases);
    if (res.note) notes.push(label + ": " + res.note);
    return res.value;
  };

  // Riwayat cells hold "Ya"/"Tidak", sometimes with a remark ("ya, amlodipin
  // 10mg"): the answer stays in its column, the remark goes to Catatan riwayat.
  const riwayatNotes = [];
  const riwayat = PP_RIWAYAT.map(([needle, label]) => {
    const split = ppSplitYaTidak_(c(needle));
    if (split.note) riwayatNotes.push(label + ": " + split.note);
    if (split.data) notes.push(label + ": " + split.data);
    return split.value;
  });

  const tegak = ppTegak_(c("tegak"));
  if (tegak.note) notes.push("Tegak diagnosis: " + tegak.note);
  const stadium = ppStadium_(c("stadium"));
  if (stadium.note) notes.push("Stadium: " + stadium.note);
  const metastasis = ppMulti_(x("metastasis"), PP_OPT.metastasis, PP_ALIAS.metastasis);
  if (metastasis.note) notes.push("Metastasis: " + metastasis.note);

  // Lines of therapy: Siklus/Regimen/Awal-akhir cells may describe several.
  const siklus = ppSplitLini_(c("siklus kemoterapi"));
  const regimen = ppSplitLini_(c("regimen kemoterapi"));
  const awal = ppSplitLini_(c("awal-akhir kemoterapi"));
  const rejimen = [
    pick("Rejimen lini 1", c("rejimen lini pertama"), PP_OPT.rejimen1),
    pick("Rejimen lini 2", c("rejimen lini ke 2"), PP_OPT.rejimen2),
    "",
  ];
  const respon = [
    pick("Respon kemoterapi lini 1", c("respon kemoterapi"), PP_OPT.respon, PP_ALIAS.respon),
    pick("Respon kemoterapi lini 2", c("respons lini ke 2"), PP_OPT.respon, PP_ALIAS.respon),
    "",
  ];
  const lini = [1, 2, 3].map((n, i) => {
    const range = ppRange_(awal[n] || "");
    if (range.note) notes.push("Awal-akhir kemoterapi lini " + n + ": " + range.note);
    return [
      ppSiklusText_(siklus[n] || ""), rejimen[i], ppDrugLines_(regimen[n] || ""),
      range.awal, range.akhir, respon[i],
    ];
  });
  const followUp = ppFollowUp_(c("follow up terakhir"));
  const body = ppBodySize_(r, headers);
  if (followUp.note) notes.push("Follow up terakhir: " + followUp.note);

  const row = [
    // Identitas pasien
    x("nama"), x("no erm"), c("nik"), c("tahun"),
    pick("JK", c("jenis kelamin") || c("jk"), PP_OPT.jk), c("usia"),
    pick("Pendidikan", c("pendidikan"), PP_OPT.pendidikan, PP_ALIAS.pendidikan),
    c("pekerjaan"), c("no hp"),
    // Diagnosis
    pick("Leader", c("leader"), PP_OPT.leader),
    pick("Nodal / extranodal", c("extranodal"), PP_OPT.nodal, PP_ALIAS.nodal),
    tegak.value, c("lokasi pa"),
    ppDatedText_(c("hasil pa")), ppDatedText_(c("imunohistokimia")),
    pick("Subtipe", x("subtipe"), PP_OPT.subtipe, PP_ALIAS.subtipe),
    pick("ECOG", c("ecog"), PP_OPT.ecog),
    // Riwayat (Jumlah komorbiditas is a formula column)
    null, ...riwayat, riwayatNotes.join("\n").replace(/\r/g, ""),
    // Pemeriksaan penunjang: lab, then ANC..PLR formula columns
    ppNum_(c("hb sebelum")), ppNum_(c("trombosit/platelet")), ppNum_(c("leukosit sebelum")),
    ppNum_(c("ldh")), ppNum_(c("eosinofil")), ppNum_(c("basofil")),
    ppNum_(x("neutrofil (%)")), ppNum_(x("limfosit (%)")), ppNum_(x("monosit (%)")),
    null, null, null, null, null,
    // Pre-kemo stadium/metastasis; exams (pre/during/post) aren't in the sheet
    stadium.value, metastasis.value, "", "", "", "", "", "", "", "", "",
    // Status BMI: BB, TB, then IMT/Kategori/BSA formula columns
    body.bb, body.tb, null, null, null,
    // Siklus kemoterapi: lini 1, 2, 3 (siklus, rejimen, obat, awal, akhir, respon), side effect
    ...lini[0], ...lini[1], ...lini[2],
    c("side effect"),
    // Radioterapi
    pick("Radioterapi", x("radioterapi"), PP_OPT.radioterapi),
    pick("Dosis radioterapi", c("dosis radioterapi"), PP_OPT.dosis),
    c("respon radioterapi"),
    // Ringkasan & outcome
    followUp.tanggal, followUp.status, c("remission"), c("lost to follow up"), c("time to event"),
    x("dx"), ppStatusLabel_(c("kesimpulan")),
    notes.join("\n").replace(/\r/g, ""),
  ];
  if (row.length !== PP_COLUMNS) throw new Error("Jumlah kolom " + row.length + " ≠ " + PP_COLUMNS);
  // Text starting with "=" would otherwise be read as a formula.
  return row.map((v) => (typeof v === "string" && v.charAt(0) === "=" ? "'" + v : v));
}

// --- header lookup (same matching as the web app) ---------------------------------

function ppContains_(headers, needle) {
  return headers.find((h) => h.toLowerCase().includes(needle));
}

function ppExact_(headers, needle) {
  return headers.find((h) => h.trim().toLowerCase() === needle);
}

function ppGet_(r, header) {
  return header ? r[header] || "" : "";
}

// --- tidying ---------------------------------------------------------------------

function ppIsEmpty_(s) {
  return PP_EMPTY.indexOf(s.trim()) >= 0;
}

// One dropdown value: exact option (any case), else a known variant, else
// blank with the original returned as a note.
function ppPick_(raw, options, aliases) {
  const v = raw.trim();
  if (ppIsEmpty_(v)) return { value: "", note: "" };
  const hit = options.find((o) => o.trim().toLowerCase() === v.toLowerCase());
  if (hit) return { value: hit, note: "" };
  const alias = aliases && aliases[v.toLowerCase()];
  if (alias) {
    const keep = alias.slice(-1) === "*";
    return { value: keep ? alias.slice(0, -1) : alias, note: keep ? v : "" };
  }
  return { value: "", note: v };
}

// A comma-separated multi-select value (Metastasis): every part is tidied on
// its own; parts that can't be matched go to the note.
function ppMulti_(raw, options, aliases) {
  if (ppIsEmpty_(raw)) return { value: "", note: "" };
  const kept = [];
  const dropped = [];
  raw.split(",").forEach((part) => {
    const res = ppPick_(part, options, aliases);
    if (res.value && kept.indexOf(res.value) < 0) kept.push(res.value);
    if (res.note) dropped.push(res.note);
  });
  return { value: kept.join(", "), note: dropped.length ? raw.replace(/\s+/g, " ").trim() : "" };
}

const PP_ROMAN = { 1: "I", 2: "II", 3: "III", 4: "IV" };
const PP_STADIUM_UNKNOWN = ["unknown", "belum diketahui", "tidak diketahui", "?", "??"];

// Ann-Arbor stage: "lugano III" / "stage III" / "3" -> "III", "3B" -> "IIIB",
// "IVB," -> "IVB"; unknowns -> "tidak diketahui"; anything else (TNM, ranges,
// free text) -> "tidak diketahui" with the original noted.
function ppStadium_(raw) {
  const v = raw.trim();
  if (v === "" || v === "-") return { value: "", note: "" };
  if (PP_STADIUM_UNKNOWN.indexOf(v.toLowerCase()) >= 0) return { value: "tidak diketahui", note: "" };
  const head = v.split(",")[0];
  let s = head.replace(/^(lugano|stage|stadium)\s*/i, "").replace(/[\s`.,;]+$/, "").trim().toUpperCase();
  s = s.replace(/^([1-4])([A-E]?)$/, (m, n, letter) => PP_ROMAN[n] + letter);
  if (PP_OPT.stadium.indexOf(s) >= 0) {
    // Lossless clean-ups don't need a note; dropping text after a comma does.
    return { value: s, note: head !== v ? v : "" };
  }
  return { value: "tidak diketahui", note: v };
}

function ppSplitYaTidak_(raw) {
  if (ppIsEmpty_(raw)) return { value: "", note: "", data: "" };
  const m = raw.match(/^(ya|tidak)\b[\s,:;.\-–]*([\s\S]*)$/i);
  if (m) {
    const note = m[2].trim().replace(/^\(([\s\S]*)\)$/, "$1").trim();
    return { value: m[1].toLowerCase() === "ya" ? "Ya" : "Tidak", note: note, data: "" };
  }
  // Abbreviations seen in the data.
  if (/^(t|0)$/i.test(raw)) return { value: "Tidak", note: "", data: "\"" + raw + "\" dibaca Tidak" };
  if (/^(y|1)$/i.test(raw)) return { value: "Ya", note: "", data: "\"" + raw + "\" dibaca Ya" };
  // A description of the condition itself (e.g. a cardiac diagnosis) means Ya.
  return { value: "Ya", note: raw, data: "diisi Ya berdasarkan keterangan, mohon dicek" };
}

// Tegak diagnosis must be a full date; a leading date with extra text keeps
// the date, everything else ("2016", "belum tegak dx") goes to the note.
function ppTegak_(raw) {
  const v = raw.trim();
  if (ppIsEmpty_(v)) return { value: "", note: "" };
  const m = v.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4}|\d{2})\b\s*([\s\S]*)$/);
  const date = m ? ppDate_(m[1], m[2], m[3]) : null;
  if (date) return { value: date, note: m[4].trim() ? v : "" };
  return { value: "", note: v };
}

function ppDate_(day, month, year) {
  const d = Number(day);
  const mo = Number(month);
  const y = year.length === 2 ? 2000 + Number(year) : Number(year);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return new Date(y, mo - 1, d);
}

// BB/TB: their own columns when the sheet has them (DATA NHL); otherwise
// (DATA HL) read back from the IMT formula "=BB/(TB in m)^2", e.g.
// "=51/(1,7)^2" -> 51 kg, 170 cm. Same parsing as the web app's
// fetchImtFormulas.
function ppBodySize_(r, headers) {
  if (ppContains_(headers, "bb (kg)") || ppContains_(headers, "tb (cm)")) {
    return {
      bb: ppNum_(ppGet_(r, ppContains_(headers, "bb (kg)"))),
      tb: ppNum_(ppGet_(r, ppContains_(headers, "tb (cm)"))),
    };
  }
  const m = String(r[PP_IMT_FORMULA] || "").match(
    /^=\s*([\d.,]+)\s*\/\s*\(?\s*([\d.,]+)\s*\)?\s*\^\s*2/,
  );
  if (!m) return { bb: "", tb: "" };
  const bb = Number(m[1].replace(",", "."));
  const tbM = Number(m[2].replace(",", "."));
  if (!(bb > 0) || !(tbM > 0)) return { bb: "", tb: "" };
  return { bb: bb, tb: Math.round(tbM * 1000) / 10 };
}

// Plain numbers ("14,6", "249") become numbers so the formula columns can use
// them; anything else ("13,5 (kemo ke 2)") stays as typed.
function ppNum_(s) {
  return /^-?\d+([.,]\d+)?$/.test(s) ? Number(s.replace(",", ".")) : s;
}

function ppStatusLabel_(raw) {
  const v = raw.trim().toLowerCase();
  if (v === "include") return "Include";
  if (v === "exclude") return "Exclude";
  if (v === "tidak lengkap") return "Tidak Lengkap";
  return "";
}

// --- lines of therapy ------------------------------------------------------------------

// A line starting with "lini 2:", "Lini II", "Kemoterapi lini 1 ..." opens that
// lini; text before any marker belongs to lini 1. Markers in the middle of a
// sentence ("rencana kemo lini 2 pasien menolak") don't split. Lini past 3 are
// kept in lini 3, labelled.
const PP_LINI_LINE =
  /^\s*(?:kemo(?:terapi)?\s+)?lini\s*(?:ke\s*)?(\d+|iv|i{1,3})\b(?:\s*[-–&]\s*(\d+|iv|i{1,3})\b)?\s*[:.)\-–]?\s*/i;

function ppLiniNumber_(s) {
  const roman = { i: 1, ii: 2, iii: 3, iv: 4 };
  return roman[s.toLowerCase()] || Number(s);
}

// "lini 1 (6x), lini 2 (6x)" on one line is treated as two lines.
const PP_LINI_INLINE = /\s*[,;]\s*(?=(?:kemo(?:terapi)?\s+)?lini\s*(?:ke\s*)?(?:\d+|iv|i{1,3})\b)/gi;

function ppSplitLini_(text) {
  const out = {};
  let current = 1;
  const lines = text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .flatMap((line) => (PP_LINI_LINE.test(line) ? line.split(PP_LINI_INLINE) : [line]));
  lines.forEach((line) => {
    const m = line.match(PP_LINI_LINE);
    let content = line;
    if (m) {
      const n = ppLiniNumber_(m[1]);
      current = Math.min(n, 3);
      content = line.slice(m[0].length);
      const label = m[2] ? "lini " + n + "-" + ppLiniNumber_(m[2]) : n > 3 ? "lini " + n : "";
      if (label) content = "(" + label + ") " + content;
    }
    out[current] = out[current] ? out[current] + "\n" + content : content;
  });
  Object.keys(out).forEach((k) => {
    out[k] = out[k].replace(/\n{3,}/g, "\n\n").trim();
    if (!out[k]) delete out[k];
  });
  return out;
}

// Awal-akhir kemoterapi: "20/2/23-13/6/23" -> both dates, "20/2/23-" or a single
// date -> Awal only, "...-16/1/16" -> Akhir only; anything else goes to the note.
const PP_D = "(\\d{1,2})[/.-](\\d{1,2})[/.-](\\d{4}|\\d{2})";
const PP_RANGE_FULL = new RegExp("^" + PP_D + "\\s*(?:-|–|s\\/?d|sampai)+\\s*" + PP_D + "$", "i");
const PP_RANGE_FROM = new RegExp("^" + PP_D + "(?:\\s*[-–]+\\s*(?:sekarang|now|on ?going|\\.+)?)?$", "i");
const PP_RANGE_UNTIL = new RegExp("^(?:\\.+|-+)?\\s*[-–]\\s*" + PP_D + "$");

function ppRange_(raw) {
  const v = raw.trim().replace(/\s+/g, " ");
  if (ppIsEmpty_(v)) return { awal: "", akhir: "", note: "" };
  let m = v.match(PP_RANGE_FULL);
  if (m) {
    const a = ppDate_(m[1], m[2], m[3]);
    const b = ppDate_(m[4], m[5], m[6]);
    if (a && b) return { awal: a, akhir: b, note: "" };
  }
  m = v.match(PP_RANGE_FROM);
  if (m && ppDate_(m[1], m[2], m[3])) return { awal: ppDate_(m[1], m[2], m[3]), akhir: "", note: "" };
  m = v.match(PP_RANGE_UNTIL);
  if (m && ppDate_(m[1], m[2], m[3])) return { awal: "", akhir: ppDate_(m[1], m[2], m[3]), note: "" };
  return { awal: "", akhir: "", note: raw.trim() };
}

// Follow up terakhir: the date anywhere in the cell, plus a status read from
// "MD"/"meninggal", "loss to follow up" or "rujuk". "Hidup" is never guessed.
// Anything else in the cell ("(kontrol/tahun)", "rujuk dharmais") keeps the
// original in the note.
const PP_DATE_ANYWHERE = new RegExp("(^|[^\\d])" + PP_D + "(?!\\d)");

function ppFollowUp_(raw) {
  const v = raw.trim();
  if (ppIsEmpty_(v)) return { tanggal: "", status: "", note: "" };
  const m = v.match(PP_DATE_ANYWHERE);
  const tanggal = m ? ppDate_(m[2], m[3], m[4]) : null;
  let status = "";
  if (/\bMD\b|meninggal/i.test(v)) status = "Meninggal (MD)";
  else if (/lo(ss|st) to follow/i.test(v)) status = "Loss to follow up";
  else if (/rujuk/i.test(v)) status = "Rujuk";
  let rest = tanggal ? v.replace(m[0].slice(m[1].length), "") : v;
  rest = rest
    .replace(/\bMD\b|meninggal( dunia)?|lo(ss|st) to follow ?up/gi, "")
    .replace(/[()\s,;:\-]+/g, " ")
    .trim();
  return { tanggal: tanggal || "", status: status, note: rest ? v.replace(/\r/g, "") : "" };
}

// "6x" -> "Siklus 6", "1x dari 6x" -> "Siklus 1 dari 6", "6 siklus" -> "Siklus 6";
// anything longer stays as written so nothing is lost.
function ppSiklusText_(s) {
  const t = s.trim().replace(/^\(([^()]*)\)$/, "$1").trim();
  let m = t.match(/^(\d+)\s*(?:x|kali|siklus)$/i) || t.match(/^siklus\s*(\d+)$/i);
  if (m) return "Siklus " + m[1];
  m = t.match(/^(\d+)\s*x?\s*dari\s*(\d+)\s*(?:x|siklus)?$/i);
  if (m) return "Siklus " + m[1] + " dari " + m[2];
  return t;
}

// One drug per line. Single-line regimens like "Doxorubicin 34mg (H1)Vincristin
// 1,5mg (H1)" are split after each ")" that runs straight into the next drug.
function ppDrugLines_(s) {
  return s
    .split("\n")
    .flatMap((line) => line.split(/\)(?=\s*[A-Za-z])/).map((p, i, all) => (i < all.length - 1 ? p + ")" : p)))
    .map((p) => p.trim())
    .filter(Boolean)
    .join("\n");
}

// --- Hasil PA / IHK (port of lib/datedEntries.ts) -----------------------------------------
// Split a cell into dated reports and write them back as "dd/mm/yyyy\nisi".

const PP_DATE_RE = /\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})\b/;

function ppDatedText_(text) {
  const entries = [];
  let current = null;
  text.replace(/\r\n?/g, "\n").split("\n").forEach((line) => {
    const match = line.length <= 60 ? line.match(PP_DATE_RE) : null;
    const iso = match ? ppIsoDate_(match[1], match[2], match[3]) : null;
    if (match && iso) {
      if (current) entries.push(current);
      const rest = line.replace(match[0], "").trim();
      current = { tanggal: iso, isi: /^(pa|ihc|ihk)\s*:?$/i.test(rest) ? "" : rest };
    } else {
      if (!current) current = { tanggal: "", isi: "" };
      current.isi = current.isi ? current.isi + "\n" + line : line;
    }
  });
  if (current) entries.push(current);
  return entries
    .map((e) => ({ tanggal: e.tanggal, isi: e.isi.trim() }))
    .filter((e) => e.tanggal || e.isi)
    .map((e) => [e.tanggal ? ppDmy_(e.tanggal) : "", e.isi].filter(Boolean).join("\n"))
    .filter(Boolean)
    .join("\n\n");
}

function ppIsoDate_(day, month, year) {
  const d = Number(day);
  const m = Number(month);
  const y = year.length === 2 ? 2000 + Number(year) : Number(year);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return y + "-" + String(m).padStart(2, "0") + "-" + String(d).padStart(2, "0");
}

function ppDmy_(iso) {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? m[3] + "/" + m[2] + "/" + m[1] : iso;
}
