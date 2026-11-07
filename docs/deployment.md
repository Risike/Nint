# Nint Deployment Guide

## Production Deployment with Docker Compose

Nint includes production-ready Docker containers with multi-stage builds.

### 1. Configure Environment
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Ensure you provide a strong `JWT_SECRET` and your Firebase credentials.

### 2. Launch Services
Run with a single command:
```bash
docker compose up --build -d
```

This launches:
- `web`: Optimized Nginx static server hosting the compiled React Vite single-page application and proxying `/api` requests on port 80.
- `api`: Node.js Express server running on port 3001 with SQLite WAL mode.
- `db`: Persistent SQLite database volume mounted at `/data/nint.db`.

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
