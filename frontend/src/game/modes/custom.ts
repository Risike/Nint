import { GameEngine, GameEngineOptions } from '../engine/gameEngine';

export interface CustomRulesConfig extends GameEngineOptions {
  ghostEnabled?: boolean;
  holdEnabled?: boolean;
  gravityIntervalMs?: number;
  initialGarbage?: number;
}

export class CustomMode {
  public engine: GameEngine;
  public ghostEnabled: boolean;
  public holdEnabled: boolean;

  constructor(config: CustomRulesConfig = {}) {
    this.ghostEnabled = config.ghostEnabled ?? true;
    this.holdEnabled = config.holdEnabled ?? true;

    this.engine = new GameEngine({
      ...config,
      gravityCurve: config.gravityIntervalMs ? () => config.gravityIntervalMs! : undefined
    });

    if (config.initialGarbage && config.initialGarbage > 0) {
      this.engine.garbageManager.enqueueGarbage(config.initialGarbage);
    }
  }
}
