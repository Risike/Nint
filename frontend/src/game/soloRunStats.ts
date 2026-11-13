import type { GameEngine } from './engine/gameEngine';

export type SoloRunStats = ReturnType<GameEngine['getStats']>;

export const emptySoloRunStats = (): SoloRunStats => ({
  score: 0,
  lines: 0,
  level: 1,
  duration: 0,
  piecesPlaced: 0,
  pps: 0,
  apm: 0,
  tetrises: 0,
  tSpins: 0,
  perfectClears: 0,
  maxCombo: 0,
  maxB2B: 0
});

export const mergeSoloRunStats = (previous: SoloRunStats, next: SoloRunStats): SoloRunStats => {
  const duration = previous.duration + next.duration;
  const lines = previous.lines + next.lines;
  const piecesPlaced = previous.piecesPlaced + next.piecesPlaced;
  const durationSec = duration / 1000;

  return {
    score: previous.score + next.score,
    lines,
    level: next.level,
    duration,
    piecesPlaced,
    pps: durationSec > 0 ? parseFloat((piecesPlaced / durationSec).toFixed(2)) : 0,
    apm: durationSec > 0 ? parseFloat(((lines * 60) / durationSec).toFixed(1)) : 0,
    tetrises: previous.tetrises + next.tetrises,
    tSpins: previous.tSpins + next.tSpins,
    perfectClears: previous.perfectClears + next.perfectClears,
    maxCombo: Math.max(previous.maxCombo, next.maxCombo),
    maxB2B: Math.max(previous.maxB2B, next.maxB2B)
  };
};
