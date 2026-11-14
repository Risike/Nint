import { describe, expect, it } from 'vitest';
import {
  BLAST_ROUNDS_TO_WIN,
  blastDuelOutcome,
  createBlastDuelScore,
  createRoundPlan,
  opponentRoundEvent,
  roundStartDelayMs,
  shouldAdoptRoundPlan,
  withNextRound,
  withRoundLoss,
  withRoundWin
} from '../src/game/blastDuel';

describe('Blast duel best-of-five', () => {
  it('starts at zero wins on round one', () => {
    const score = createBlastDuelScore();
    expect(score).toEqual({ myWins: 0, opponentWins: 0, round: 1 });
    expect(blastDuelOutcome(score)).toBeNull();
  });

  it('does not end the duel after one win and one loss', () => {
    let score = createBlastDuelScore();
    score = withRoundWin(score);
    expect(blastDuelOutcome(score)).toBeNull();
    score = withNextRound(score);
    score = withRoundLoss(score);
    expect(score).toEqual({ myWins: 1, opponentWins: 1, round: 2 });
    expect(blastDuelOutcome(score)).toBeNull();
  });

  it('only wins the duel on the third round win', () => {
    let score = createBlastDuelScore();
    for (let round = 0; round < BLAST_ROUNDS_TO_WIN - 1; round += 1) {
      score = withRoundWin(score);
      expect(blastDuelOutcome(score)).toBeNull();
      score = withNextRound(score);
    }
    score = withRoundWin(score);
    expect(score.myWins).toBe(BLAST_ROUNDS_TO_WIN);
    expect(blastDuelOutcome(score)).toBe('win');
  });

  it('only loses the duel on the third round loss', () => {
    let score = createBlastDuelScore();
    score = withRoundWin(score);
    score = withNextRound(score);
    score = withRoundLoss(score);
    expect(blastDuelOutcome(score)).toBeNull();
    score = withNextRound(score);
    score = withRoundLoss(score);
    expect(blastDuelOutcome(score)).toBeNull();
    expect(score.opponentWins).toBe(2);
    score = withNextRound(score);
    score = withRoundLoss(score);
    expect(blastDuelOutcome(score)).toBe('loss');
  });

  it('increments one round at a time, never jumping to a match end', () => {
    let score = createBlastDuelScore();
    for (let loss = 0; loss < BLAST_ROUNDS_TO_WIN; loss += 1) {
      const before = score;
      score = withRoundLoss(score);
      expect(score.opponentWins).toBe(before.opponentWins + 1);
      score = withNextRound(score);
    }
    // Three separate losses are needed; a single stale counter cannot do it.
    expect(blastDuelOutcome({ myWins: 1, opponentWins: 1, round: 2 })).toBeNull();
  });

  it('advances rounds independently of the wins', () => {
    let score = createBlastDuelScore();
    score = withNextRound(score);
    score = withNextRound(score);
    expect(score.round).toBe(3);
    expect(score.myWins).toBe(0);
  });
});

describe('Blast duel opponent round signals', () => {
  it('reads the opponent win as a lost round for this client', () => {
    expect(opponentRoundEvent({ round: 2, roundOutcome: 'win' }, 2, false)).toBe('lost');
  });

  it('reads the opponent loss as a won round for this client', () => {
    expect(opponentRoundEvent({ round: 2, roundOutcome: 'loss' }, 2, false)).toBe('won');
  });

  it('ignores a result written for another round', () => {
    expect(opponentRoundEvent({ round: 1, roundOutcome: 'win' }, 2, false)).toBeNull();
  });

  it('ignores any signal once the local round is already over', () => {
    expect(opponentRoundEvent({ round: 2, roundOutcome: 'win' }, 2, true)).toBeNull();
    expect(opponentRoundEvent({ round: 2, alive: false }, 2, true)).toBeNull();
  });

  it('falls back to the top-out flag when no explicit result arrived', () => {
    expect(opponentRoundEvent({ round: 3, alive: false }, 3, false)).toBe('won');
  });

  it('does not treat a stale death from the previous round as a win', () => {
    expect(opponentRoundEvent({ round: 1, alive: false }, 3, false)).toBeNull();
  });
});

describe('Blast duel shared round start', () => {
  it('plans the next round at a fixed deadline', () => {
    expect(createRoundPlan(4, 1000, 2400)).toEqual({ round: 4, startsAt: 3400 });
  });

  it('adopts only a future round', () => {
    expect(shouldAdoptRoundPlan({ round: 3, startsAt: 9000 }, 2, null)).toBe(true);
    expect(shouldAdoptRoundPlan({ round: 2, startsAt: 9000 }, 2, null)).toBe(false);
    expect(shouldAdoptRoundPlan({ round: 1, startsAt: 9000 }, 2, null)).toBe(false);
  });

  it('does not let a late plan move an already-armed round', () => {
    expect(shouldAdoptRoundPlan({ round: 3, startsAt: 8000 }, 2, { round: 3, startsAt: 7000 })).toBe(false);
  });

  it('clamps the start delay against clock skew', () => {
    expect(roundStartDelayMs({ round: 2, startsAt: 1000 }, 1000)).toBe(350);
    expect(roundStartDelayMs({ round: 2, startsAt: 3400 }, 1000)).toBe(2400);
    expect(roundStartDelayMs({ round: 2, startsAt: 99_000 }, 1000)).toBe(5000);
  });
});
