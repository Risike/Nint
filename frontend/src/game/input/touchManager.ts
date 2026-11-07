import { GameEngine } from '../engine/gameEngine';

export class TouchManager {
  private engine: GameEngine;
  private touchStartX: number = 0;
  private touchStartY: number = 0;
  private touchStartTime: number = 0;

  constructor(engine: GameEngine) {
    this.engine = engine;
  }

  // Button-based triggers for on-screen touch D-pad / action buttons
  public onMoveLeft() {
    this.engine.moveLeft();
  }

  public onMoveRight() {
    this.engine.moveRight();
  }

  public onSoftDrop() {
    this.engine.softDrop();
  }

  public onHardDrop() {
    this.engine.hardDrop();
  }

  public onRotateCW() {
    this.engine.rotateCW();
  }

  public onRotateCCW() {
    this.engine.rotateCCW();
  }

  public onHold() {
    this.engine.hold();
  }

  // Swipe gesture support on the canvas area
  public handleTouchStart(e: TouchEvent) {
    if (e.touches.length > 0) {
      this.touchStartX = e.touches[0].clientX;
      this.touchStartY = e.touches[0].clientY;
      this.touchStartTime = Date.now();
    }
  }

  public handleTouchEnd(e: TouchEvent) {
    if (e.changedTouches.length === 0) return;
    const dx = e.changedTouches[0].clientX - this.touchStartX;
    const dy = e.changedTouches[0].clientY - this.touchStartY;
    const dt = Date.now() - this.touchStartTime;

    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    // Tap detection (< 15px movement, < 250ms) -> Rotate CW
    if (absDx < 15 && absDy < 15 && dt < 250) {
      this.engine.rotateCW();
      return;
    }

    // Swipe down fast -> Hard Drop
    if (dy > 50 && absDy > absDx * 1.5 && dt < 300) {
      this.engine.hardDrop();
      return;
    }

    // Swipe up fast -> Hold
    if (dy < -40 && absDy > absDx * 1.5 && dt < 300) {
      this.engine.hold();
      return;
    }
  }
}
