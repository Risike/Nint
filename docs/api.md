# Nint REST API Documentation

All API endpoints are prefixed with `/api`.

## 1. Authentication
- `POST /api/auth/register`: Create user account (`email`, `password`, `displayName`, optional `username`). If `username` is omitted, a unique identifier is derived from the display name/email.
- `POST /api/auth/login`: Authenticate with `identifier` (email **or** username) and `password`, or with `email` and `password`. Returns a JWT access token.
- `POST /api/auth/logout`: Revokes the current session (requires `Authorization`).
- `GET /api/auth/me`: Get authenticated user profile (requires `Authorization: Bearer <token>`).
- `PATCH /api/auth/me`: Update display name or password. Changing the password rotates the session and returns a new `token`.
- `DELETE /api/auth/me`: Delete account with password confirmation.
- `POST /api/auth/password-reset`: Request a reset email. The reset link is never written to server logs.
- `POST /api/auth/password-reset/confirm`: Reset password with token (`token`, `newPassword`, minimum 6 characters). All existing sessions are revoked.

In development (`NODE_ENV=development`, the default with `npm run dev`), two accounts are created automatically: `test` and `test2`, both with an empty password. They are never seeded in production, and empty-password logins are rejected when `NODE_ENV=production`.

Tokens embed a per-account version. Logout, password change and password reset invalidate all previously issued tokens, and tokens of deleted accounts are rejected.

## 2. Game Results & Anti-Cheat
- `POST /api/results`: Submit solo game result (rate limited).
  - Allowed modes: `marathon_150`, `sprint_40`, `ultra_3m`, `zen`. Unknown modes are rejected with `400`.
  - The server recomputes `pps` and `apm` from `piecesPlaced`, `lines` and `duration`; client-provided values are ignored.
  - Plausibility checks flag impossible PPS (> 12), line counts, Tetris/perfect clear counts, scores and mode-specific bounds. Flagged results are stored with `verified: false` and never reach leaderboards.
  - Zen sessions only add playtime, capped per submission.
- `GET /api/results/me`: Retrieve the authenticated user's game history (`mode`, `limit` ≤ 100).

## 3. Leaderboards
- `GET /api/leaderboards/:mode`: Fetch ranked leaderboards.
  - Modes: `marathon_150`, `sprint_40`, `ultra_3m`, `elo` (or `pvp_elo`).
  - Query parameters: `timeframe=all|monthly|weekly|daily`, `limit` (≤ 100), `offset`.

## 4. Player Statistics
- `GET /api/stats/me`: Get current user statistics, win rate, personal bests and recent match history.
- `GET /api/stats/:userId`: Public profile statistics for another player (`404` for unknown users).

## 5. Settings
- `GET /api/settings`: Fetch theme, handling timings, volumes, keybindings, gamepad bindings and accessibility options.
- `PUT /api/settings`: Persist the same fields. Values are validated and clamped server-side.

## 6. Versus Matches
- `POST /api/matches/record`: Record the outcome of a match (rate limited).
  - AI matches (`opponentType: "ai"`) are recorded immediately and never affect ELO.
  - Online matches (`opponentType: "human"`) require a shared `matchId`, the opponent's `opponentId`, and a boolean `ranked` flag.
  - Casual matches (`ranked: false`, the default) are recorded immediately and never change ratings.
  - For a normal completed match, ranked matches (`ranked: true`) apply ELO once **both** players submit complementary reports for the same `matchId` (win/loss or draw/draw). A single report stays `pending` and changes no rating. Both reports must agree on `ranked`; conflicting, mismatched or duplicate reports return `409`. A disconnect or leave is settled through the forfeit endpoint below.
  - Opponent rating is read from the database, never from the request body. The ELO leaderboard only includes players with completed ranked matches.
- `POST /api/matches/forfeit`: Settle an online match after a disconnect, browser close or explicit leave (rate limited).
  - Only the player who abandons submits the request, with `result: "loss"`, `matchId`, `opponentId` and the `ranked` flag. The server records a win for the opponent, but the opponent's rating is unchanged.
  - The abandoning player loses ELO as a normal loss. A repeated request returns the existing settlement and never applies the loss twice.
  - A request with `result: "win"` is rejected so a player cannot force a loss onto an opponent. The remaining player records its normal win report, which stays pending and does not award ELO.
  - Leaving or disconnecting during a ranked match therefore costs the leaver ELO while the player who stayed wins without gaining rating.

Online room discovery and realtime matchmaking are handled client-side by Firebase Realtime Database; the backend no longer exposes placeholder matchmaking endpoints.
