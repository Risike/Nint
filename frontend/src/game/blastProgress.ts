import { BLAST_CONTEST_STAGES, BLAST_FIGHT_ROUNDS } from './engine/blast';
import { LocalStorageManager } from '../services/storage';

export const clampBlastStage = (stage: number): number => {
  const parsed = Number(stage);
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(1, Math.min(BLAST_CONTEST_STAGES, Math.floor(parsed)));
};

export const clampBlastRound = (round: number): number => {
  const parsed = Number(round);
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(1, Math.min(BLAST_FIGHT_ROUNDS, Math.floor(parsed)));
};

const progressKey = (userId?: string | null) =>
  `blast_contest_unlocked_stage_${userId || 'guest'}`;

const fightProgressKey = (userId?: string | null) =>
  `blast_fight_unlocked_round_${userId || 'guest'}`;

export const getUnlockedBlastStage = (userId?: string | null): number => {
  const stored = LocalStorageManager.getItem<unknown>(progressKey(userId), 1);
  const parsed = typeof stored === 'number' ? stored : Number(stored);
  return clampBlastStage(parsed);
};

export const unlockBlastStageAfterClear = (
  clearedStage: number,
  userId?: string | null
): number => {
  const currentUnlocked = getUnlockedBlastStage(userId);
  const cleared = clampBlastStage(clearedStage);

  // Stages must be cleared in order; clearing an earlier stage never skips ahead.
  if (cleared > currentUnlocked) return currentUnlocked;

  const nextUnlocked = Math.min(
    BLAST_CONTEST_STAGES,
    Math.max(currentUnlocked, cleared + 1)
  );

  if (nextUnlocked > currentUnlocked) {
    LocalStorageManager.setItem(progressKey(userId), nextUnlocked);
  }

  return nextUnlocked;
};

export const getUnlockedBlastRound = (userId?: string | null): number => {
  const stored = LocalStorageManager.getItem<unknown>(fightProgressKey(userId), 1);
  const parsed = typeof stored === 'number' ? stored : Number(stored);
  return clampBlastRound(parsed);
};

export const unlockBlastRoundAfterClear = (
  clearedRound: number,
  userId?: string | null
): number => {
  const currentUnlocked = getUnlockedBlastRound(userId);
  const cleared = clampBlastRound(clearedRound);

  // Rounds must be cleared in order; clearing an earlier round never skips ahead.
  if (cleared > currentUnlocked) return currentUnlocked;

  const nextUnlocked = Math.min(
    BLAST_FIGHT_ROUNDS,
    Math.max(currentUnlocked, cleared + 1)
  );

  if (nextUnlocked > currentUnlocked) {
    LocalStorageManager.setItem(fightProgressKey(userId), nextUnlocked);
  }

  return nextUnlocked;
};
