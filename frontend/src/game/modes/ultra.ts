import { GameEngine, GameEngineOptions } from '../engine/gameEngine';

export interface UltraConfig extends GameEngineOptions {
  timeLimitMs?: number; // 3 minutes = 180,000 ms by default (or 120,000 / 300,000)
}

export class UltraMode {
  public engine: GameEngine;
  public timeLimitMs: number;
  public onTimeExpired?: (finalScore: number) => void;

  constructor(config: UltraConfig = {}, onTimeExpired?: (finalScore: number) => void) {
    this.timeLimitMs = config.timeLimitMs ?? 180000;
    this.onTimeExpired = onTimeExpired;

    this.engine = new GameEngine(config);
  }

  public update(deltaMs: number) {
    if (this.engine.state === 'playing') {
      this.engine.update(deltaMs);
      if (this.engine.totalPlayTimeMs >= this.timeLimitMs) {
        this.engine.state = 'completed';
        this.engine.endTime = Date.now();
        this.onTimeExpired?.(this.engine.score);
      }
    }
  }

  public getRemainingTimeMs(): number {
    return Math.max(0, this.timeLimitMs - this.engine.totalPlayTimeMs);
  }
}
