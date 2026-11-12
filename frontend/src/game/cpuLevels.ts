import { Bot, Flame, Shield, Swords, Zap, type LucideIcon } from 'lucide-react';
import { LocalStorageManager } from '../services/storage';

export const MAX_CPU_LEVEL = 10;

export type CpuTier = 'Beginner' | 'Casual' | 'Intermediate' | 'Advanced' | 'Master';

interface CpuTierMeta {
  tagline: string;
  description: string;
  color: string;
  background: string;
  icon: LucideIcon;
}

export interface CpuLevelDefinition extends CpuTierMeta {
  level: number;
  tier: CpuTier;
}

const TIER_META: Record<CpuTier, CpuTierMeta> = {
  Beginner: {
    tagline: 'Relaxed Pace',
    description: 'Slow placement speed (~700ms) with forgiving stacking and basic clears. Great for learning versus mechanics.',
    color: 'var(--accent-green)',
    background: 'rgba(34, 197, 94, 0.2)',
    icon: Shield
  },
  Casual: {
    tagline: 'Balanced Battle',
    description: 'Solid flat stacking, downstacks when garbage arrives, and sends regular counter-attacks.',
    color: 'var(--accent-cyan)',
    background: 'rgba(6, 182, 212, 0.2)',
    icon: Bot
  },
  Intermediate: {
    tagline: 'Fast Paced',
    description: 'Maintains an open right-side well for Tetris clears, reacts quickly to attacks, and builds clean stacks.',
    color: 'var(--accent-blue)',
    background: 'rgba(59, 130, 246, 0.2)',
    icon: Zap
  },
  Advanced: {
    tagline: 'Aggressive AI',
    description: 'High PPS (~200ms placements), deep heuristic evaluation, and proactive B2B Tetris attacks.',
    color: 'var(--accent-pink)',
    background: 'rgba(236, 72, 153, 0.2)',
    icon: Flame
  },
  Master: {
    tagline: 'Peak Competitive AI',
    description: 'Ultra-fast execution, lookahead optimization, ruthless garbage cancelling, and high APM.',
    color: 'var(--accent-red)',
    background: 'rgba(239, 68, 68, 0.2)',
    icon: Swords
  }
};

const tierForLevel = (level: number): CpuTier => {
  if (level <= 2) return 'Beginner';
  if (level <= 4) return 'Casual';
  if (level <= 6) return 'Intermediate';
  if (level <= 8) return 'Advanced';
  return 'Master';
};

export const CPU_LEVELS: CpuLevelDefinition[] = Array.from(
  { length: MAX_CPU_LEVEL },
  (_, index) => {
    const level = index + 1;
    const tier = tierForLevel(level);
    return { level, tier, ...TIER_META[tier] };
  }
);

export const clampCpuLevel = (level: number): number => {
  const parsed = Number(level);
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(1, Math.min(MAX_CPU_LEVEL, Math.floor(parsed)));
};

export const getCpuLevelDefinition = (level: number): CpuLevelDefinition =>
  CPU_LEVELS[clampCpuLevel(level) - 1];

const progressKey = (userId?: string | null) =>
  `cpu_unlocked_level_${userId || 'guest'}`;

export const getUnlockedCpuLevel = (userId?: string | null): number => {
  const stored = LocalStorageManager.getItem<unknown>(progressKey(userId), 1);
  const parsed = typeof stored === 'number' ? stored : Number(stored);
  return clampCpuLevel(parsed);
};

export const unlockCpuLevelAfterWin = (
  completedLevel: number,
  userId?: string | null
): number => {
  const currentUnlocked = getUnlockedCpuLevel(userId);
  const completed = clampCpuLevel(completedLevel);

  // Levels must be cleared in order: a win only advances the frontier level.
  if (completed > currentUnlocked) return currentUnlocked;

  const nextUnlocked = Math.min(
    MAX_CPU_LEVEL,
    Math.max(currentUnlocked, completed + 1)
  );

  if (nextUnlocked > currentUnlocked) {
    LocalStorageManager.setItem(progressKey(userId), nextUnlocked);
  }

  return nextUnlocked;
};
