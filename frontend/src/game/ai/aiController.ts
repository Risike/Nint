import { GameEngine } from '../engine/gameEngine';
import { BoardEvaluator, PlacementCandidate } from './evaluator';

export class AIController {
  public engine: GameEngine;
  public difficulty: number; // 1 - 10
  private stepInterval: number = 300; // ms
  private timer: number = 0;
  private currentPlan: PlacementCandidate | null = null;
  private isExecuting: boolean = false;

  constructor(engine: GameEngine, difficulty: number = 5) {
    this.engine = engine;
    this.difficulty = Math.max(1, Math.min(10, difficulty));
    this.updateSpeed();
  }

  public setDifficulty(diff: number) {
    this.difficulty = Math.max(1, Math.min(10, diff));
    this.updateSpeed();
  }

  private updateSpeed() {
    // Difficulty 1: ~700ms per action; Difficulty 10: ~75ms per action
    this.stepInterval = Math.max(70, Math.floor(750 - (this.difficulty - 1) * 75));
  }

  public update(deltaMs: number) {
    if (this.engine.state !== 'playing' || !this.engine.activePiece) {
      return;
    }

    this.timer += deltaMs;
    if (this.timer < this.stepInterval) {
      return;
    }
    this.timer = 0;

    // If no plan, compute one
    if (!this.currentPlan) {
      this.currentPlan = BoardEvaluator.findBestPlacement(
        this.engine.board,
        this.engine.activePiece,
        this.difficulty
      );
    }

    if (!this.currentPlan) {
      this.engine.hardDrop();
      return;
    }

    // Step 1: Rotate towards planned rotation
    if (this.engine.activeRotation !== this.currentPlan.rotation) {
      this.engine.rotateCW();
      return;
    }

    // Step 2: Shift X towards target X
    if (this.engine.activeX < this.currentPlan.x) {
      this.engine.moveRight();
      return;
    } else if (this.engine.activeX > this.currentPlan.x) {
      this.engine.moveLeft();
      return;
    }

    // Step 3: Once aligned in rotation and X position, Hard Drop!
    this.engine.hardDrop();
    this.currentPlan = null;
  }
}
