-- Nint Database Schema

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL,
    avatar_url TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS user_settings (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    theme TEXT DEFAULT 'dark',
    das INTEGER DEFAULT 133,
    arr INTEGER DEFAULT 10,
    soft_drop_factor INTEGER DEFAULT 20,
    lock_delay INTEGER DEFAULT 500,
    sound_volume REAL DEFAULT 0.7,
    music_volume REAL DEFAULT 0.5,
    keybindings TEXT, -- JSON string
    touch_controls_enabled INTEGER DEFAULT 1,
    ghost_piece INTEGER DEFAULT 1,
    skin TEXT DEFAULT 'default',
    colorblind_mode TEXT DEFAULT 'none',
    reduced_motion INTEGER DEFAULT 0,
    updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS game_results (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mode TEXT NOT NULL,
    score INTEGER NOT NULL,
    lines INTEGER NOT NULL,
    level INTEGER NOT NULL,
    duration INTEGER NOT NULL, -- ms
    pieces_placed INTEGER NOT NULL,
    pps REAL NOT NULL,
    apm REAL NOT NULL,
    tetrises INTEGER DEFAULT 0,
    t_spins INTEGER DEFAULT 0,
    perfect_clears INTEGER DEFAULT 0,
    max_combo INTEGER DEFAULT 0,
    max_b2b INTEGER DEFAULT 0,
    verified INTEGER DEFAULT 1,
    created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS personal_bests (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mode TEXT NOT NULL,
    metric TEXT NOT NULL, -- 'score', 'time_ms', 'lines'
    value REAL NOT NULL,
    achieved_at INTEGER NOT NULL,
    result_id TEXT REFERENCES game_results(id) ON DELETE SET NULL,
    UNIQUE(user_id, mode, metric)
);

CREATE TABLE IF NOT EXISTS match_history (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    opponent_name TEXT NOT NULL,
    opponent_type TEXT NOT NULL, -- 'ai' or 'human'
    difficulty INTEGER, -- 1-10
    mode TEXT DEFAULT 'versus_1v1',
    result TEXT NOT NULL, -- 'win', 'loss', 'draw'
    player_score INTEGER DEFAULT 0,
    player_lines INTEGER DEFAULT 0,
    opponent_score INTEGER DEFAULT 0,
    opponent_lines INTEGER DEFAULT 0,
    duration INTEGER NOT NULL,
    garbage_sent INTEGER DEFAULT 0,
    garbage_received INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS user_statistics (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    games_played INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    total_lines INTEGER DEFAULT 0,
    total_pieces INTEGER DEFAULT 0,
    total_playtime_ms INTEGER DEFAULT 0,
    total_tetrises INTEGER DEFAULT 0,
    total_tspins INTEGER DEFAULT 0,
    total_perfect_clears INTEGER DEFAULT 0,
    highest_combo INTEGER DEFAULT 0,
    highest_b2b INTEGER DEFAULT 0,
    rating INTEGER DEFAULT 1000,
    updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL,
    used INTEGER DEFAULT 0
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_game_results_user ON game_results(user_id);
CREATE INDEX IF NOT EXISTS idx_game_results_mode_score ON game_results(mode, score DESC);
CREATE INDEX IF NOT EXISTS idx_game_results_mode_duration ON game_results(mode, duration ASC);
CREATE INDEX IF NOT EXISTS idx_personal_bests_mode_val ON personal_bests(mode, metric, value);
CREATE INDEX IF NOT EXISTS idx_match_history_user ON match_history(user_id);
