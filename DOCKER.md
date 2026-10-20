# Docker Quick Start

## 1) Run full stack

From project root:

```bash
docker compose up --build
```

Services:

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:3000`
- Postgres: `localhost:5432`

## 2) Stop services

```bash
docker compose down
```

To remove DB volume too:

```bash
docker compose down -v
```

## Notes

- Backend DB config now reads env vars: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`.
- Frontend API base URL now reads `VITE_API_BASE_URL` at build time.
- Default compose config maps frontend to backend on host (`http://localhost:3000`).
