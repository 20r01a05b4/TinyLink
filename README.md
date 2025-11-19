# TinyLink

TinyLink is a small URL shortener built with Node.js + Express and plain HTML/CSS/JS. It implements the assignment requirements: API endpoints, redirect behavior, click counting, delete, health check, and simple dashboard.

## Local setup

1. Copy `.env.example` to `.env` and set `DATABASE_URL` and `BASE_URL`.
2. Install dependencies:

```bash
npm install
```

3. Run migrations:

```bash
npm run migrate
```

4. Start server:

```bash
npm start
```

Visit `http://localhost:10000` to open the dashboard.

## Endpoints

- `POST /api/links` — create
- `GET /api/links` — list
- `GET /api/links/:code` — stats
- `DELETE /api/links/:code` — delete
- `GET /:code` — redirect
- `GET /healthz` — health check

## Deploy to Render (short)
1. Create a PostgreSQL database (Neon or Render Postgres) and get `DATABASE_URL`.
2. Create a new Web Service on Render (connect to GitHub repo) and set `start` command to `npm start`.
3. Add environment variables on Render: `DATABASE_URL`, `BASE_URL` (your Render URL), `PORT` (optional).
4. After deployment, run one-time deploy migration: either run `npm run migrate` using Render’s shell or locally with `DATABASE_URL` pointing to the deployed DB.

## Notes
- Code format: `[A-Za-z0-9]{6,8}`
- Duplicate custom codes return 409
- Redirect uses HTTP 302 and updates clicks + last_clicked
