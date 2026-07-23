## Static HTML pages

There are **two ways** to run this website:

1) **Realtime multi-user (recommended)**: run `realtime-server/` and open `http://<SERVER_IP>:4000`
2) **Go Live demo (single-user)**: open these files with Live Server (no shared database / no realtime)

### 1) Realtime multi-user (recommended)

Run the server:

```bash
cd "realtime-server"
npm install
npm start
```

Open:

- Server computer: `http://localhost:4000`
- Other computers (same Wi‑Fi/LAN): `http://<SERVER_IP>:4000`

### 2) Go Live demo (single-user)

Use this only if you **don’t need realtime shared data**.

### How to run (Go Live)

1. Open folder `static-html/` in VS Code
2. Right click `index.html` → **Open with Live Server** (or click **Go Live**)

### Pages

- `index.html`: login
- `type.html`: select cancer data type
- `patients.html`: patient list + search
- `hl.html`: DATA HL from CSV (URL public or upload)

### DATA HL note

If the Google Sheet requires login, the browser can’t fetch it directly.
Use **Publish to web (CSV)** or **download CSV** and upload it on `hl.html`.

