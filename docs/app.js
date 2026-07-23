/* global window, document, fetch */

const LS_AUTH = "cr_demo_auth"; // { username, token }
const LS_SELECTED_TYPE = "cr_selected_cancer_type";
const LS_API_BASE = "cr_api_base"; // optional override, e.g. http://localhost:4000

function $(id) {
  return document.getElementById(id);
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getAuth() {
  const raw = window.localStorage.getItem(LS_AUTH);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.username === "string" &&
      typeof parsed.token === "string"
    ) {
      return { username: parsed.username, token: parsed.token };
    }
    return null;
  } catch {
    return null;
  }
}

function setAuth(auth) {
  window.localStorage.setItem(LS_AUTH, JSON.stringify(auth));
}

function clearAuth() {
  window.localStorage.removeItem(LS_AUTH);
  window.localStorage.removeItem(LS_SELECTED_TYPE);
}

function requireAuth() {
  const auth = getAuth();
  if (!auth) {
    window.location.href = "./index.html";
    return null;
  }
  return auth;
}

function renderTopbarUser(auth) {
  const whoami = $("whoami");
  if (whoami) whoami.textContent = auth?.username ?? "";
  const logoutBtn = $("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      clearAuth();
      window.location.href = "./index.html";
    });
  }
}

function getApiBase() {
  const override = (window.localStorage.getItem(LS_API_BASE) || "").trim();
  if (override) return override.replace(/\/$/, "");

  // Helpful default when user opens via Go Live (5500)
  if (window.location.port === "5500") return "http://localhost:4000";

  // Default: same origin (when served by realtime-server)
  return "";
}

async function api(path, options = {}) {
  const auth = getAuth();
  const headers = Object.assign(
    { "content-type": "application/json" },
    options.headers || {},
  );
  if (auth?.token) headers.authorization = `Bearer ${auth.token}`;

  const base = getApiBase();
  const url = base ? `${base}${path}` : path;
  const res = await fetch(url, Object.assign({}, options, { headers }));

  if (res.status === 405 && !base) {
    throw new Error(
      "Backend API tidak tersedia. Jangan pakai Go Live untuk mode realtime. Buka dari http://localhost:4000",
    );
  }

  if (res.status === 401) {
    clearAuth();
    window.location.href = "./index.html";
    throw new Error("Unauthorized");
  }
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}

function connectWs(onMessage) {
  const base = getApiBase();
  const origin = base || `${window.location.protocol}//${window.location.host}`;
  const u = new URL(origin);
  const proto = u.protocol === "https:" ? "wss:" : "ws:";
  const ws = new WebSocket(`${proto}//${u.host}/ws`);
  ws.addEventListener("message", (e) => {
    try {
      const msg = JSON.parse(e.data);
      onMessage(msg);
    } catch {
      // ignore
    }
  });
  return ws;
}

function bootLogin() {
  const form = $("loginForm");
  if (!form) return;

  const existing = getAuth();
  if (existing) window.location.href = "./type.html";

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = $("username")?.value?.trim() ?? "";
    const password = $("password")?.value ?? "";
    if (!username || !password) return;

    try {
      const data = await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
        headers: {},
      });
      setAuth({ username: data.username, token: data.token });
      window.location.href = "./type.html";
    } catch (err) {
      window.alert(err?.message || "Login failed");
    }
  });
}

function bootType() {
  const auth = requireAuth();
  if (!auth) return;
  renderTopbarUser(auth);

  const list = $("typeList");
  const search = $("typeSearch");
  if (!list || !search) return;

  let types = [];

  function render() {
    const q = (search.value ?? "").trim().toLowerCase();
    const selected = window.localStorage.getItem(LS_SELECTED_TYPE) ?? "";
    const filtered = !q
      ? types
      : types.filter((t) =>
          `${t.id} ${t.label} ${t.description || ""}`.toLowerCase().includes(q),
        );

    list.innerHTML = filtered
      .map((t) => {
        const active = selected === t.id;
        return `
          <div class="list-item ${active ? "list-item--active" : ""}">
            <div>
              <div class="list-item__title">${escapeHtml(t.id)}</div>
              ${
                t.description
                  ? `<div class="list-item__desc">${escapeHtml(
                      t.description,
                    )}</div>`
                  : ""
              }
            </div>
            <button class="btn ${active ? "btn--primary" : "btn--secondary"}" data-type="${
              t.id
            }">
              ${active ? "Selected" : "Select"}
            </button>
          </div>
        `;
      })
      .join("");

    list.querySelectorAll("button[data-type]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-type") || "";
        window.localStorage.setItem(LS_SELECTED_TYPE, id);
        window.location.href = id === "HL" ? "./hl.html" : "./patients.html";
      });
    });
  }

  search.addEventListener("input", render);

  api("/api/cancer-types")
    .then((d) => {
      types = d.items || [];
      render();
    })
    .catch((e) => window.alert(e?.message || "Failed to load cancer types"));
}

function bootPatients() {
  const auth = requireAuth();
  if (!auth) return;
  renderTopbarUser(auth);

  const tbody = $("patientTbody");
  const search = $("patientSearch");
  if (!tbody || !search) return;

  let lastReq = 0;
  let timer = null;

  async function loadAndRender() {
    const myReq = ++lastReq;
    const q = (search.value ?? "").trim();
    try {
      const d = await api(`/api/patients${q ? `?search=${encodeURIComponent(q)}` : ""}`);
      if (myReq !== lastReq) return;
      const items = d.items || [];
      if (items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" style="padding:18px; color:#6b7280;">Tidak ada data yang cocok.</td></tr>`;
        return;
      }
      tbody.innerHTML = items
        .map((p) => {
          const adult = Number(p.usia) >= 18;
          return `
            <tr>
              <td><b>${escapeHtml(p.nama)}</b></td>
              <td style="font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size:12px;">${escapeHtml(
                p.noErm,
              )}</td>
              <td>${escapeHtml(p.tahun)}</td>
              <td>${escapeHtml(p.jk)}</td>
              <td>
                <span class="pill ${adult ? "pill--yes" : "pill--no"}">${
                  adult ? "Ya" : "Tidak"
                }</span>
                <span style="color:#6b7280; font-size:12px;"> (${escapeHtml(
                  p.usia,
                )})</span>
              </td>
              <td>${escapeHtml(p.pendidikanTerakhir)}</td>
              <td>${escapeHtml(p.pekerjaan)}</td>
              <td>${escapeHtml(p.noHp)}</td>
              <td style="font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size:12px;">${escapeHtml(
                p.nik,
              )}</td>
              <td>${escapeHtml(p.leader)}</td>
            </tr>
          `;
        })
        .join("");
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="10" style="padding:18px; color:#b45309;">Error: ${escapeHtml(
        e?.message || "Failed",
      )}</td></tr>`;
    }
  }

  search.addEventListener("input", () => {
    if (timer) window.clearTimeout(timer);
    timer = window.setTimeout(loadAndRender, 200);
  });

  connectWs((msg) => {
    if (msg?.type === "patients_updated") loadAndRender();
  });

  loadAndRender();
}

function bootHL() {
  const auth = requireAuth();
  if (!auth) return;
  renderTopbarUser(auth);

  const csvUrl = $("csvUrl");
  const loadBtn = $("loadCsvBtn");
  const fileInput = $("csvFile");
  const search = $("hlSearch");
  const toggleColsBtn = $("toggleColsBtn");
  const status = $("hlStatus");
  const theadRow = $("hlTheadRow");
  const tbody = $("hlTbody");
  const modal = $("modal");
  const modalClose = $("modalClose");
  const modalBody = $("modalBody");

  if (
    !csvUrl ||
    !loadBtn ||
    !fileInput ||
    !search ||
    !toggleColsBtn ||
    !status ||
    !theadRow ||
    !tbody ||
    !modal ||
    !modalClose ||
    !modalBody
  ) {
    return;
  }

  let headers = [];
  let rows = [];
  let showAllCols = false;

  function setStatus(msg) {
    status.textContent = msg;
  }

  function setLoading(loading) {
    loadBtn.disabled = loading;
    toggleColsBtn.disabled = headers.length === 0 || loading;
    loadBtn.textContent = loading ? "Loading..." : "Load";
  }

  function openModal(row) {
    modalBody.innerHTML = headers
      .map((h) => {
        const v = row[h] ?? "";
        return `
          <div class="kv">
            <div class="kv__k">${escapeHtml(h)}</div>
            <div class="kv__v">${v ? escapeHtml(v) : '<span style="color:#9ca3af;">(empty)</span>'}</div>
          </div>
        `;
      })
      .join("");
    modal.classList.remove("hidden");
  }

  function closeModal() {
    modal.classList.add("hidden");
  }

  modalClose.addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });

  function renderTable(meta) {
    const visibleHeaders = showAllCols ? headers : headers.slice(0, 10);

    theadRow.innerHTML = visibleHeaders
      .map((h) => `<th>${escapeHtml(h)}</th>`)
      .join("");

    const shown = rows.slice(0, 500);
    tbody.innerHTML =
      shown.length === 0 && headers.length
        ? `<tr><td colspan="${Math.max(
            visibleHeaders.length,
            1,
          )}" style="padding:18px; color:#6b7280;">Tidak ada data yang cocok.</td></tr>`
        : shown
            .map((r, idx) => {
              const cells = visibleHeaders
                .map((h) => {
                  const v = r[h] ?? "";
                  const title = v ? ` title="${escapeHtml(v)}"` : "";
                  const cls =
                    v.length > 40 ? ' style="max-width:340px; overflow:hidden; text-overflow:ellipsis;"' : "";
                  return `<td${title}${cls}>${escapeHtml(v)}</td>`;
                })
                .join("");
              return `<tr data-row="${idx}">${cells}</tr>`;
            })
            .join("");

    tbody.querySelectorAll("tr[data-row]").forEach((tr) => {
      tr.style.cursor = "pointer";
      tr.addEventListener("click", () => {
        const i = Number(tr.getAttribute("data-row"));
        const row = shown[i];
        if (row) openModal(row);
      });
    });

    toggleColsBtn.disabled = headers.length === 0;
    toggleColsBtn.textContent = showAllCols
      ? "Show fewer columns"
      : "Show all columns";
    if (meta) {
      setStatus(
        headers.length
          ? `${meta.matched} matched / ${meta.total} total${meta.matched > 500 ? " (showing first 500)" : ""}`
          : "Belum ada data yang dimuat",
      );
    } else {
      setStatus(headers.length ? `${rows.length} rows` : "Belum ada data yang dimuat");
    }
  }

  async function refreshFromServer() {
    const q = (search.value ?? "").trim();
    const d = await api(`/api/hl${q ? `?search=${encodeURIComponent(q)}` : ""}`);
    headers = d.headers || [];
    rows = d.rows || [];
    renderTable({ total: d.total, matched: d.matched });
  }

  async function importFromUrl(url) {
    setLoading(true);
    setStatus("Importing CSV from URL...");
    try {
      await api("/api/hl/import-url", {
        method: "POST",
        body: JSON.stringify({ url }),
        headers: {},
      });
      showAllCols = false;
      await refreshFromServer();
    } catch (e) {
      setStatus(e?.message ? `Error: ${e.message}` : "Error importing CSV");
    } finally {
      setLoading(false);
    }
  }

  async function importFromFile(file) {
    setLoading(true);
    setStatus("Importing CSV file...");
    try {
      const text = await file.text();
      await api("/api/hl/import-csv", {
        method: "POST",
        body: JSON.stringify({ csvText: text }),
        headers: {},
      });
      showAllCols = false;
      await refreshFromServer();
    } catch (e) {
      setStatus(e?.message ? `Error: ${e.message}` : "Error importing CSV");
    } finally {
      setLoading(false);
    }
  }

  loadBtn.addEventListener("click", () => {
    const url = (csvUrl.value ?? "").trim();
    if (!url) return;
    importFromUrl(url);
  });

  fileInput.addEventListener("change", (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    importFromFile(f);
  });

  let t = null;
  search.addEventListener("input", () => {
    if (t) window.clearTimeout(t);
    t = window.setTimeout(() => {
      refreshFromServer().catch(() => {});
    }, 200);
  });
  toggleColsBtn.addEventListener("click", () => {
    showAllCols = !showAllCols;
    renderTable();
  });

  connectWs((msg) => {
    if (msg?.type === "hl_updated") refreshFromServer().catch(() => {});
  });

  refreshFromServer().catch(() => {});
}

document.addEventListener("DOMContentLoaded", () => {
  const page = document.body.getAttribute("data-page") || "";
  if (page === "login") bootLogin();
  if (page === "type") bootType();
  if (page === "patients") bootPatients();
  if (page === "hl") bootHL();
});

