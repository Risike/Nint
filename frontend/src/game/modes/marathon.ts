import { GameEngine, GameEngineOptions } from '../engine/gameEngine';

export interface MarathonConfig extends GameEngineOptions {
  isEndless?: boolean;
  targetLines?: number; // 150 by default for standard marathon
}

export class MarathonMode {
  public engine: GameEngine;
  public isEndless: boolean;
  public targetLines: number;
  public onVictory?: () => void;

  constructor(config: MarathonConfig = {}, onVictory?: () => void) {
    this.isEndless = config.isEndless ?? false;
    this.targetLines = config.targetLines ?? 150;
    this.onVictory = onVictory;

    this.engine = new GameEngine(config, {
      onScoreUpdate: (_score, lines) => {
        if (!this.isEndless && lines >= this.targetLines) {
          this.engine.state = 'completed';
          this.engine.endTime = Date.now();
          this.onVictory?.();
        }
      }
    });
  }
}
