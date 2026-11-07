# Nint Architecture

## System Overview

**Nint** ("Nint is not Tetris") is designed with modularity, low-latency execution, and non-negotiable Guideline compliance.

```
+-------------------------------------------------------------+
|                      Client (Browser)                       |
|  +---------------------+  +-------------------------------+ |
|  |   React / HTML5 UI  |  |  60 FPS Canvas Game Engine    | |
|  | - Menus & Modes     |  | - SRS Kick Engine             | |
|  | - HUD & Previews    |  | - 7-Bag PRNG Randomizer       | |
|  | - Mobile Controls   |  | - T-Spin & Garbage Manager    | |
|  | - Web Audio Synth   |  | - 10-Tier AI Evaluator        | |
|  +----------+----------+  +---------------+---------------+ |
+-------------|-----------------------------|-----------------+
              |                             |
      REST API (JWT)               Realtime Sync (P2P/RTDB)
              v                             v
+-----------------------+     +-------------------------------+
|  Backend (Express.js) |     |  Firebase Realtime Database   |
|  - Auth & Passwords   |     |  - Matchmaking & Rooms        |
|  - Results Validation |     |  - Attack Pipelines           |
|  - Anti-Cheat Sanity  |     |  - Disconnect Grace Periods   |
|  - Leaderboards Query |     +-------------------------------+
|  - Player Statistics  |
+-----------+-----------+
            |
            v
+-----------------------+
|  SQLite Database (WAL)|
|  - Users & Settings   |
|  - Game Results       |
|  - Personal Bests     |
|  - Match History      |
+-----------------------+
```

## Game Engine Decoupling
The core physics engine (`frontend/src/game/engine/gameEngine.ts`) is completely decoupled from DOM or React state. It can be run headless in unit tests, in AI simulation loops, or driven by `requestAnimationFrame` for Canvas rendering.

Key sub-modules:
- `constants.ts`: Complete SRS kick tables for JLSTZ and I pieces, piece matrices, centralized scoring and garbage values.
- `randomizer.ts`: 7-bag randomizer powered by Mulberry32 PRNG for deterministic seed synchronization.
- `srs.ts`: 5-test wall kick sequence for standard clockwise and counter-clockwise rotations.
- `tspin.ts`: 3-corner rule T-Spin detector with front vs back corner classification and kick index 4 upgrade.
- `garbage.ts`: Incoming garbage meter, line-for-line counter-attack cancellation, and randomized single-hole generation.
- `scoring.ts`: Back-to-Back difficulty chain tracking (Tetris, TSS, TSD, TST) with 1.5x score multiplier and +1 garbage bonus; escalating combo counter bonus.
- `evaluator.ts` & `aiController.ts`: Offline 1v1 battle AI with 10 difficulty tiers evaluating aggregate height, bumpiness, complete lines, holes, and well depth.
