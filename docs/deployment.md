# Nint Deployment Guide

## Production Deployment with Docker Compose

Nint includes production-ready multi-stage Docker containers built from the repository root so the npm lockfile is used (`npm ci`).

### 1. Configure Environment
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
`JWT_SECRET` is mandatory in production: the API refuses to start without it. Also set:
- `CORS_ORIGIN` to the public frontend origin (defaults to `http://localhost:8103`).
- `APP_BASE_URL` to the public origin used in password-reset emails.
- `TRUST_PROXY=1` when running behind the bundled nginx container.
- `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` from a free [Cloudflare Turnstile](https://dash.cloudflare.com/?to=/:account/turnstile) widget. Registration is disabled without them.
- `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` and `SMTP_FROM` so account-verification and password-reset emails can be delivered. Registration returns an error when the verification email cannot be sent.
- Optionally `ADMIN_EMAIL` / `ADMIN_PASSWORD` to bootstrap an administrator. There is no default admin account; leaving both empty disables admin creation.

### 2. Launch Services
Run with a single command:
```bash
docker compose up --build -d
```

This launches:
- `web`: Optimized Nginx static server hosting the compiled React Vite SPA and proxying `/api` requests on port **8103**.
- `api`: Node.js Express server running on port 3001 with SQLite WAL mode.
- The persistent SQLite database volume is mounted at `/data/nint.db`.

### 3. Verify Health
```bash
curl http://localhost:3001/api/health
# {"status":"ok","service":"nint-api","timestamp":...}
```

### 4. Stopping Containers
```bash
docker compose down
```

## Local Development Mode (Hot Reload)

To run the development environment with hot reload for both frontend and backend:
```bash
# Option A: With Docker Compose
docker compose -f docker-compose.dev.yml up

# Option B: Directly on host
make dev
# or: npm run dev
```
Frontend runs at `http://localhost:5173` and API runs at `http://localhost:3001`.

## Firebase Rules

Deploy the hardened rules after configuring a real Firebase project:
```bash
firebase deploy --only database
```
