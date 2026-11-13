import { describe, expect, it } from 'vitest';
import { emptySoloRunStats, mergeSoloRunStats } from '../src/game/soloRunStats';

describe('solo run stats', () => {
  it('accumulates score and totals across bosses', () => {
    const firstBoss = {
      score: 20_000,
      lines: 40,
      level: 1,
      duration: 60_000,
      piecesPlaced: 100,
      pps: 1.67,
      apm: 40,
      tetrises: 5,
      tSpins: 2,
      perfectClears: 1,
      maxCombo: 5,
      maxB2B: 2
    };
    const secondBoss = {
      score: 25_000,
      lines: 50,
      level: 2,
      duration: 70_000,
      piecesPlaced: 120,
      pps: 1.71,
      apm: 42.9,
      tetrises: 6,
      tSpins: 3,
      perfectClears: 0,
      maxCombo: 7,
      maxB2B: 3
    };

    expect(mergeSoloRunStats(firstBoss, secondBoss)).toEqual({
      score: 45_000,
      lines: 90,
      level: 2,
      duration: 130_000,
      piecesPlaced: 220,
      pps: 1.69,
      apm: 41.5,
      tetrises: 11,
      tSpins: 5,
      perfectClears: 1,
      maxCombo: 7,
      maxB2B: 3
    });
  });

  it('keeps the second boss stats when there is no previous run', () => {
    const boss = {
      score: 20_000,
      lines: 40,
      level: 1,
      duration: 60_000,
      piecesPlaced: 100,
      pps: 1.67,
      apm: 40,
      tetrises: 5,
      tSpins: 2,
      perfectClears: 1,
      maxCombo: 5,
      maxB2B: 2
    };

    expect(mergeSoloRunStats(emptySoloRunStats(), boss)).toEqual(boss);
  });
});
