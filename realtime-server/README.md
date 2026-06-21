## Cancer Registry (multi-user realtime)

This server:

- serves the website (the `static-html/` pages)
- stores shared data in a database file (`realtime-server/data/cancer-registry.db`)
- pushes **real-time updates** to all users via WebSocket (`/ws`)

### Run

```bash
cd "realtime-server"
npm install
npm start
```

Open on the server computer:

- `http://localhost:4000`

Open from other computers (same Wi‑Fi/LAN):

- `http://<SERVER_IP>:4000`

### What is stored

- **Users + sessions**: created on login (demo)
- **Patients**: stored in DB and served from `/api/patients`
- **HL data**: import CSV → stored in DB → all users see the same data

### Notes

- Login is still “demo” security (accepts any username/password) but it’s now **shared** (session tokens).
- If you want proper roles/users/password hashing, tell me the rules and I’ll add it.

