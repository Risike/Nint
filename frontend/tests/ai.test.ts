import { describe, expect, it } from 'vitest';
import { AIController } from '../src/game/ai/aiController';
import { BoardEvaluator } from '../src/game/ai/evaluator';
import { GameEngine } from '../src/game/engine/gameEngine';

describe('AI Opponent Engine', () => {
  it('computes valid placement candidates for any tetromino', () => {
    const engine = new GameEngine();
    const candidate = BoardEvaluator.findBestPlacement(engine.board, 'T', 5);
    expect(candidate).not.toBeNull();
    expect(candidate?.rotation).toBeGreaterThanOrEqual(0);
    expect(candidate?.rotation).toBeLessThanOrEqual(3);
    expect(candidate?.x).toBeGreaterThanOrEqual(0);
    expect(candidate?.x).toBeLessThan(10);
  });

  it('AI controller executes moves and places pieces without illegal states', () => {
    const engine = new GameEngine();
    engine.start();
    const ai = new AIController(engine, 10); // fast level 10

    const initialPlaced = engine.piecesPlaced;

    // Simulate 3 seconds of AI updates
    for (let step = 0; step < 60; step++) {
      ai.update(50);
      engine.update(50);
    }

    // AI should have placed multiple pieces cleanly
    expect(engine.piecesPlaced).toBeGreaterThan(initialPlaced);
    expect(engine.state).toBe('playing');
  });
});
