import { LocalStorageManager } from '../services/storage';

export const MAX_BOSS_LEVEL = 10;
export const BOSS_BASE_HP = 20_000;
export const BOSS_HP_PER_LEVEL = 5_000;

export interface BossLevelDefinition {
  level: number;
  hp: number;
  startingSpeedLevel: number;
  color: string;
  background: string;
}

const LEVEL_COLORS = [
  { color: 'var(--accent-green)', background: 'rgba(34, 197, 94, 0.2)' },
  { color: 'var(--accent-cyan)', background: 'rgba(6, 182, 212, 0.2)' },
  { color: 'var(--accent-blue)', background: 'rgba(59, 130, 246, 0.2)' },
  { color: 'var(--accent-pink)', background: 'rgba(236, 72, 153, 0.2)' },
  { color: 'var(--accent-red)', background: 'rgba(239, 68, 68, 0.2)' }
];

const colorForLevel = (level: number) => {
  if (level <= 2) return LEVEL_COLORS[0];
  if (level <= 4) return LEVEL_COLORS[1];
  if (level <= 6) return LEVEL_COLORS[2];
  if (level <= 8) return LEVEL_COLORS[3];
  return LEVEL_COLORS[4];
};

export const BOSS_LEVELS: BossLevelDefinition[] = Array.from(
  { length: MAX_BOSS_LEVEL },
  (_, index) => {
    const level = index + 1;
    return {
      level,
      hp: BOSS_BASE_HP + BOSS_HP_PER_LEVEL * (level - 1),
      startingSpeedLevel: level,
      ...colorForLevel(level)
    };
  }
);

export const clampBossLevel = (level: number): number => {
  const parsed = Number(level);
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(1, Math.min(MAX_BOSS_LEVEL, Math.floor(parsed)));
};

export const getBossLevelDefinition = (level: number): BossLevelDefinition =>
  BOSS_LEVELS[clampBossLevel(level) - 1];

// The boss speed rises once every two attacks it actually applies.
export const getBossSpeedLevel = (
  startingSpeedLevel: number,
  appliedAttacks: number
): number => {
  const start = Math.max(1, Math.floor(Number.isFinite(startingSpeedLevel) ? startingSpeedLevel : 1));
  const attacks = Math.max(0, Math.floor(Number.isFinite(appliedAttacks) ? appliedAttacks : 0));
  return start + Math.floor(attacks / 2);
};

const progressKey = (userId?: string | null) =>
  `boss_unlocked_level_${userId || 'guest'}`;

export const getUnlockedBossLevel = (userId?: string | null): number => {
  const stored = LocalStorageManager.getItem<unknown>(progressKey(userId), 1);
  const parsed = typeof stored === 'number' ? stored : Number(stored);
  return clampBossLevel(parsed);
};

export const unlockBossLevelAfterWin = (
  completedLevel: number,
  userId?: string | null
): number => {
  const currentUnlocked = getUnlockedBossLevel(userId);
  const completed = clampBossLevel(completedLevel);

  // Levels must be cleared in order: a win only advances the frontier level.
  if (completed > currentUnlocked) return currentUnlocked;

  const nextUnlocked = Math.min(
    MAX_BOSS_LEVEL,
    Math.max(currentUnlocked, completed + 1)
  );

  if (nextUnlocked > currentUnlocked) {
    LocalStorageManager.setItem(progressKey(userId), nextUnlocked);
  }

  return nextUnlocked;
};