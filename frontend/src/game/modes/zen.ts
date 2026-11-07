import { GameEngine, GameEngineOptions } from '../engine/gameEngine';

export class ZenMode {
  public engine: GameEngine;

  constructor(config: GameEngineOptions = {}) {
    // Fixed gentle gravity, no game-over pressure
    this.engine = new GameEngine({
      ...config,
      startingLevel: 1,
      gravityCurve: () => 800 // comfortable fixed speed
    });
  }
}
