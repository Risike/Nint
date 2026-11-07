# Nint REST API Documentation

All API endpoints are prefixed with `/api`.

## 1. Authentication
- `POST /api/auth/register`: Create user account (`email`, `password`, `displayName`).
- `POST /api/auth/login`: Authenticate user (`email`, `password`). Returns JWT access token.
- `POST /api/auth/logout`: Clears session token.
- `GET /api/auth/me`: Get authenticated user profile (requires `Authorization: Bearer <token>`).
- `PATCH /api/auth/me`: Update display name or password.
- `DELETE /api/auth/me`: Delete account with password confirmation.
- `POST /api/auth/password-reset`: Request reset token.
- `POST /api/auth/password-reset/confirm`: Reset password with token.

## 2. Game Results & Anti-Cheat
- `POST /api/results`: Submit solo match result.
  - Server runs anti-cheat sanity checks (PPS limit ≤ 12, duration bounds, score-to-time limits).
  - Automatically updates personal bests and aggregated stats.
- `GET /api/results/me`: Retrieve user's personal game history.

## 3. Leaderboards
- `GET /api/leaderboards/:mode`: Fetch ranked leaderboards for `marathon_150`, `sprint_40`, or `ultra_3m`.
  - Supports query parameter `timeframe=all|monthly|weekly|daily`.

## 4. Player Statistics
- `GET /api/stats/me`: Get current user statistics, win rate, and recent match history.
- `GET /api/stats/:userId`: Public profile statistics for another player.

## 5. Settings
- `GET /api/settings`: Fetch user control preferences, keybinds, theme, and handling timings.
- `PUT /api/settings`: Persist updated preferences.

## 6. Versus Matches
- `POST /api/matches/record`: Record outcome of 1v1 AI or Online match.
- `GET /api/matchmaking/queue`: Query queue status.
