// Game Boy Tetris Blast link play is a best-of-five: the first player to win
// three rounds takes the duel.
export const BLAST_ROUNDS_TO_WIN = 3;

export interface BlastDuelScore {
  myWins: number;
  opponentWins: number;
  round: number;
}

export function createBlastDuelScore(): BlastDuelScore {
  return { myWins: 0, opponentWins: 0, round: 1 };
}

export function withRoundWin(score: BlastDuelScore): BlastDuelScore {
  return { ...score, myWins: score.myWins + 1 };
}

export function withRoundLoss(score: BlastDuelScore): BlastDuelScore {
  return { ...score, opponentWins: score.opponentWins + 1 };
}

export function withNextRound(score: BlastDuelScore): BlastDuelScore {
  return { ...score, round: score.round + 1 };
}

export function blastDuelOutcome(score: BlastDuelScore): 'win' | 'loss' | null {
  if (score.myWins >= BLAST_ROUNDS_TO_WIN) return 'win';
  if (score.opponentWins >= BLAST_ROUNDS_TO_WIN) return 'loss';
  return null;
}

export interface OpponentRoundState {
  round?: number | null;
  roundOutcome?: 'win' | 'loss' | null;
  alive?: boolean | null;
}

/**
 * Reads the opponent's state as an event for the round currently being played.
 * Results are only trusted for the exact round they were written for and only
 * while the local round is still open, so a delayed snapshot can never close a
 * round twice or award a round that was already resolved.
 */
export function opponentRoundEvent(
  state: OpponentRoundState,
  currentRound: number,
  isRoundOver: boolean
): 'won' | 'lost' | null {
  if (isRoundOver) return null;
  const remoteRound = typeof state.round === 'number' ? state.round : currentRound;
  if (remoteRound !== currentRound) return null;
  if (state.roundOutcome === 'win') return 'lost';
  if (state.roundOutcome === 'loss') return 'won';
  // A top-out is kept as a fallback when the explicit result was missed.
  if (state.alive === false) return 'won';
  return null;
}

export interface BlastRoundPlan {
  round: number;
  startsAt: number;
}

export function createRoundPlan(round: number, now: number, delayMs: number): BlastRoundPlan {
  return { round, startsAt: now + delayMs };
}

/**
 * The winner is the single writer of the next-round plan, so both clients only
 * adopt a plan for the round they are waiting for, and never replace an earlier
 * plan for that same round with a later one.
 */
export function shouldAdoptRoundPlan(
  plan: BlastRoundPlan,
  currentRound: number,
  existing: BlastRoundPlan | null
): boolean {
  if (plan.round <= currentRound) return false;
  if (existing && existing.round === plan.round) return false;
  return true;
}

/** Clamped delay so clock skew can never freeze or rush the next round. */
export function roundStartDelayMs(
  plan: BlastRoundPlan,
  now: number,
  minDelayMs: number = 350,
  maxDelayMs: number = 5000
): number {
  return Math.max(minDelayMs, Math.min(maxDelayMs, plan.startsAt - now));
}
