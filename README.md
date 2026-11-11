# Nint — “Nint is not Tetris.”

A modern, production-quality, Guideline-compliant online falling-block puzzle web game.

---

## 1. Project Overview

**Nint** is an original falling-block puzzle game engineered for competitive responsiveness, fluid animations, and modern gameplay conventions:
- **Guideline-compliant mechanics**: 10x20 visible matrix plus 20 buffer rows for kicks and garbage headroom (pieces spawn at the top of the visible field), SRS (Super Rotation System) wall kicks, 3-corner T-Spin detection (Regular and Mini), 7-bag randomizer, hold slot, and ghost piece.
- **Low latency**: Sub-millisecond DAS/ARR handling, 60fps Canvas playfield rendering, lock delay with 15 move resets, and procedural Web Audio API synthesizer.
- **Multiple Game Modes**:
  - **Marathon**: 150-line standard challenge and endless survival.
  - **Sprint (40 Lines)**: High-speed 40-line speedrun attack with sub-second precision.
  - **Ultra (3 Minutes)**: Score maximization under a strict countdown.
  - **Zen / Practice**: Relaxed endless play with customizable settings.
  - **1v1 Versus AI**: Offline battle against an intelligent AI opponent with 10 difficulty tiers.
  - **Online 1v1**: Low-latency casual room and quick matches, plus a ranked quick-match queue whose results update ELO. Powered by Firebase Realtime Database with room codes, seed synchronization, and live garbage cancellation.
- **Accounts & Guest Play**: Instant guest play with local storage persistence; full user accounts with JWT authentication, verified leaderboards, and detailed statistics.

---

## 2. Technology Stack Justification

### Frontend
- **React 18 + Vite + TypeScript**: Lean, fast build times, strict type safety across the game loop, and reactive HUD/menus.
- **HTML5 Canvas 2D**: Direct 60fps hardware-accelerated rendering for the playfield, ghost piece, lock flashes, and floating combo/particle animations.
- **Web Audio API**: Procedural sound synthesizer generating clean retro/arcade sound effects (move, rotate, hard drop, lock, combo pitch scale, Tetris chime, garbage alerts) without third-party audio asset dependencies.

### Backend
- **Node.js + Express**: Chosen for its minimal overhead, asynchronous I/O performance, and battle-tested ecosystem.
- **SQLite with `better-sqlite3`**: High-performance synchronous SQLite driver with Write-Ahead Logging (`WAL` mode) and foreign keys enabled. Mounted on a Docker volume so data persists across container restarts without the resource overhead of an external database engine.
- **Authentication**: JWT access tokens, bcrypt password hashing, and rate limiting on authentication routes.
- **Anti-Cheat Engine**: Server-side sanity checks validating piece placement rates (PPS), impossible sprint times, and unrealistic score submissions before verifying leaderboard entries.

### Realtime Multiplayer
- **Firebase Realtime Database**: Low-latency peer-to-peer game state synchronization, room codes, garbage attack transmission, and disconnect handling.

---

## 3. Quick Start & Docker Deployment

### Prerequisites
- Docker & Docker Compose **OR** Node.js 20+ and npm

### Local Deployment (Single Command)
```bash
docker compose up --build
```
- Web Application: `http://localhost:8103` (or `http://localhost:5173` in development)
- Backend API: `http://localhost:3001/api`
- Health Check: `http://localhost:3001/api/health`

### Development Mode (Hot Reload)
```bash
# Using Makefile
make dev

# Or directly with npm
npm run dev
```

`npm run dev` also starts the Firebase Auth and Realtime Database emulators and waits for them before launching Vite:

- Emulator UI: `http://127.0.0.1:4000`
- Auth emulator: `127.0.0.1:9099`
- Realtime Database emulator: `127.0.0.1:9000`

The frontend automatically connects to the emulator in development when the demo Firebase config is used. Java 11+ is required for the Realtime Database emulator, and the first run downloads its JAR. To start only the emulators, run `npm run emulators`.

### Development Accounts
With `NODE_ENV=development` (the default for `npm run dev`), the API automatically creates three accounts:

- `test` — empty password, 1,000,000 credits
- `test2` — empty password, 1,000,000 credits
- `admin` — empty password, administrator access

They are never created when `NODE_ENV=production`, and empty passwords are rejected in production. You can sign in with the username or the linked email (`test@nint.local`, `test2@nint.local`, `admin@nint.local`).

### Run Automated Tests
```bash
# Run both backend and frontend tests
npm test

# Or using Makefile
make test
```

---

## 4. Environment Variables (`.env.example`)

| Variable | Description | Default |
| :--- | :--- | :--- |
| `PORT` | API server port | `3001` |
| `NODE_ENV` | Environment mode | `development` / `production` |
| `JWT_SECRET` | Secret key for JWT signing | Required in production (no fallback) |
| `CORS_ORIGIN` | Allowed browser origin(s) | `http://localhost:5173` |
| `TRUST_PROXY` | Reverse-proxy hops in front of the API | `false` (set `1` behind nginx) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Optional bootstrap administrator | Empty (disabled) |
| `DATABASE_PATH` | Path to persistent SQLite file | `./data/nint.db` |
| `VITE_API_URL` | Base API URL for frontend | `/api` |
| `VITE_FIREBASE_API_KEY` | Firebase Web API Key | `demo-api-key` |
| `VITE_FIREBASE_DATABASE_URL` | Firebase Realtime DB URL | `https://nint-demo-default-rtdb.firebaseio.com` |
| `VITE_FIREBASE_PROJECT_ID` | Firebase Project ID | `nint-demo` |

---

## 5. Controls

### Default Keyboard Controls
- **Move Left / Right**: `Left Arrow` / `Right Arrow`
- **Soft Drop**: `Down Arrow`
- **Hard Drop**: `Space`
- **Rotate Clockwise (CW)**: `Up Arrow` or `X`
- **Rotate Counter-Clockwise (CCW)**: `Z` or `Ctrl`
- **Hold Piece**: `C` or `Shift`
- **Pause / Resume**: `Escape`
- **Restart**: `R`

*All keybindings can be interactively remapped in the Settings page and are persisted to your profile.*

### Mobile Controls
On mobile devices and tablets, an on-screen touch control panel (D-pad and action buttons) is automatically enabled with touch-action isolation to prevent accidental browser scrolling.

---

## 6. AI Opponent Difficulty (Levels 1–10)

The offline 1v1 battle AI operates strictly under the same rules as human players (identical 7-bag stream, SRS kicks, and garbage queuing):
- **Level 1–3 (Beginner)**: Slower placement (~700ms/piece), shallow evaluation, intentional human-like mistakes, and basic line clears.
- **Level 4–6 (Intermediate)**: Faster reaction (~400ms/piece), flat stacking, maintains an open well on the right column for Tetrises, and downstacks under garbage pressure.
- **Level 7–8 (Advanced)**: High execution speed (~200ms/piece), heuristic multi-column bumpiness optimization, hole minimization, and garbage counter-attacks.
- **Level 9–10 (Master / Grandmaster)**: Sub-100ms piece placement, lookahead optimization, deep well management, and aggressive B2B/T-Spin setups.

---

## 7. Working Demo Flow Walkthrough

1. **Solo Marathon**: Navigate to **Solo** -> **Marathon**. Place pieces using Arrow keys and Space. Listen to sound effects as lines clear.
2. **Speedrun Sprint (40 Lines)**: Select **Sprint (40L)** tab. Complete 40 lines as fast as possible to register your personal best time.
3. **1v1 Versus AI**: Navigate to **1v1 AI**. Pick difficulty (Lv 1 to Lv 10). Attack the AI by clearing Doubles, Triples, and Tetrises to push red garbage lines into its board.
4. **Online 1v1 Multiplayer**: Navigate to **Online 1v1**. Click **Create Private Room** to generate a 6-character room code. Open a second browser window/tab, enter the code, click **Join**, and battle in real-time. Quick Search and private rooms are casual and never change ELO; **Ranked Match** uses the same quick matchmaking but updates ratings after both players confirm the result.
5. **Account & Leaderboards**: Click **Sign In** -> **Create Account**. Save your score and view your verified rank on the global **Leaderboards** page.
