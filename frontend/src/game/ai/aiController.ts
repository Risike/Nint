import { GameEngine } from '../engine/gameEngine';
import { BoardEvaluator, PlacementCandidate } from './evaluator';

export class AIController {
  public engine: GameEngine;
  public difficulty: number; // 1 - 10
  private stepInterval: number = 300; // ms
  private timer: number = 0;
  private currentPlan: PlacementCandidate | null = null;
  private planPiece: string | null = null;
  private failedActions: number = 0;

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
    // Difficulty 1: ~700ms per action; Difficulty 10: ~70ms per action.
    this.stepInterval = Math.max(50, Math.floor(700 - (this.difficulty - 1) * 70));
  }

  public update(deltaMs: number) {
    if (this.engine.state !== 'playing' || !this.engine.activePiece) {
      this.currentPlan = null;
      this.planPiece = null;
      return;
    }

    this.timer += deltaMs;
    if (this.timer < this.stepInterval) {
      return;
    }
    this.timer = 0;

    // If there is no plan, or the active piece changed without a held piece,
    // compute a fresh plan using the next pieces in the queue.
    if (!this.currentPlan || this.planPiece !== this.engine.activePiece) {
      const lookahead = this.engine.randomizer.peek(3);
      this.currentPlan = BoardEvaluator.findBestPlan(
        this.engine.board,
        this.engine.activePiece,
        lookahead,
        this.engine.holdPiece,
        this.engine.canHold,
        this.difficulty
      );
      this.planPiece = this.engine.activePiece;
      this.failedActions = 0;
    }

    if (!this.currentPlan) {
      this.engine.hardDrop();
      return;
    }

    // Use hold only when the planner explicitly chose the held/next piece.
    if (this.currentPlan.useHold) {
      if (this.engine.canHold) {
        this.engine.hold();
        this.currentPlan = { ...this.currentPlan, useHold: false };
        this.planPiece = this.engine.activePiece;
        this.failedActions = 0;
        return;
      }

      this.currentPlan = null;
      this.planPiece = null;
      return;
    }

    if (this.planPiece !== this.engine.activePiece) {
      this.currentPlan = null;
      return;
    }

    // Grandmaster batches several movement steps per tick; lower levels
    // deliberately move at a more human pace.
    const maxSteps = this.difficulty >= 8 ? 4 : this.difficulty >= 6 ? 2 : 1;

    for (let step = 0; step < maxSteps; step++) {
      if (!this.currentPlan) return;

      if (this.engine.activeRotation !== this.currentPlan.rotation) {
        if (!this.engine.rotateCW()) {
          this.failedActions++;
          break;
        }
        this.failedActions = 0;
        continue;
      }

      if (this.engine.activeX < this.currentPlan.x) {
        if (!this.engine.moveRight()) {
          this.failedActions++;
          break;
        }
        this.failedActions = 0;
        continue;
      }

      if (this.engine.activeX > this.currentPlan.x) {
        if (!this.engine.moveLeft()) {
          this.failedActions++;
          break;
        }
        this.failedActions = 0;
        continue;
      }

      this.engine.hardDrop();
      this.currentPlan = null;
      this.planPiece = null;
      return;
    }

    // Never get stuck forever on a blocked rotation or kick sequence.
    if (this.failedActions > 12) {
      this.engine.hardDrop();
      this.currentPlan = null;
      this.planPiece = null;
    }
  }
}
