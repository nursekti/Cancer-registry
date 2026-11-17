## Sheet write-back (Google Apps Script)

Lets the web app write edits from the patient detail page back into the
Google Sheet. Without it, edits are stored only in the browser.

### Setup (once, by someone who can edit the spreadsheet)

1. Open the spreadsheet → **Extensions → Apps Script**.
2. Replace the contents of `Code.gs` with [`Code.gs`](Code.gs) from this folder, then save.
3. **Deploy → New deployment** → type **Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**
4. Authorize when asked, then copy the **Web app URL** (`https://script.google.com/macros/s/.../exec`).
5. Give that URL to the web app as `NEXT_PUBLIC_SHEETS_WRITE_URL`:
   - local dev: add it to `cancer-registry/.env.local`
   - GitHub Pages: repo **Settings → Secrets and variables → Actions** → new secret `NEXT_PUBLIC_SHEETS_WRITE_URL`, then re-run the deploy workflow.

Opening the URL in a browser should show `{"ok":true,"service":"cancer-registry-writeback"}`.

### Updating the script

After editing `Code.gs`: **Deploy → Manage deployments → Edit (pencil) → Version: New version → Deploy**.
This keeps the same URL. Creating a *new* deployment instead gives a new URL.
If Google asks to authorize again (new permissions), accept — the dropdown
feature calls the Sheets API, which needs "connect to an external service".

### Where the data lives

- **NHL**: the web app reads and writes the **Data NHL - Post Processing** tab
  (three header rows; columns keyed like `Lini 2 › Respon kemoterapi`). That tab
  was built once from DATA NHL by `ImportPostProcessing.gs`; edits made directly
  in DATA NHL no longer reach the web app.
- **HL**: still DATA HL (one header row).

### What it writes

- Only plain columns of the patient's row, found by `NO ERM` (or `NIK`/`NAMA` when empty).
- Cells that contain a formula are never overwritten; they come back as `skipped`.
- In the Post Processing tab, each lini's fields (incl. the drug list, one per
  line) and the first exam of each phase (pre/during/post) are written too.
  Further exams of a phase stay in the browser. In DATA NHL / DATA HL, exams
  and drug lists are not written.

### Building the Post Processing tab (`ImportPostProcessing.gs`)

Run `importNhlToPostProcessing()` once from the editor. It refuses to run a
second time, because the tab is now the source of truth and a re-import would
overwrite every edit. To rebuild it from DATA NHL anyway, run
`reimportNhlAndOverwriteEdits()`.

### Dropdowns

The web app reads each column's dropdown options from the sheet itself, and
"+ Tambah label baru…" adds the label to that same dropdown in the sheet —
for Table1 columns (DATA NHL) and plain dropdown validations (DATA HL) alike.
Only columns that already have a dropdown in the sheet offer this.
