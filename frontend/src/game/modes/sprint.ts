import { GameEngine, GameEngineOptions } from '../engine/gameEngine';

export interface SprintConfig extends GameEngineOptions {
  lineGoal?: number; // 40, 20, or 100 lines
}

export class SprintMode {
  public engine: GameEngine;
  public lineGoal: number;
  public onVictory?: (completionTimeMs: number) => void;

  constructor(config: SprintConfig = {}, onVictory?: (completionTimeMs: number) => void) {
    this.lineGoal = config.lineGoal ?? 40;
    this.onVictory = onVictory;

    this.engine = new GameEngine(config, {
      onScoreUpdate: (_score, lines) => {
        if (lines >= this.lineGoal) {
          this.engine.state = 'completed';
          this.engine.endTime = Date.now();
          const duration = this.engine.totalPlayTimeMs;
          this.onVictory?.(duration);
        }
      }
    });
  }
}
