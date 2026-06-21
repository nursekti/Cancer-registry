## Cancer Registry (demo)

Simple multi-page web app based on the provided sketches:

- `/`: login (username + password)
- `/type`: select cancer data type (NHL/HL/…)
- `/patients`: patient list + search (nama / no ERM / NIK)
- `/hl`: load & display **DATA HL** from a CSV (shows **all columns**, including those not visible in the spreadsheet UI)

## Getting Started

First, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## DATA HL (Google Sheet)

The provided Google Sheets link currently requires sign-in, so the app can’t fetch it directly.

Use one of these options:

- **Publish to web** in Google Sheets, copy the public CSV URL, paste it on `/hl`, then click **Load**.
- **Download CSV** (`File → Download → Comma-separated values (.csv)`) then upload on `/hl`.

## Notes

- Login is a **demo**: credentials are stored in the browser (localStorage).
