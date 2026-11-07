import { GameEngine } from '../engine/gameEngine';

export class GamepadManager {
  private engine: GameEngine;
  private prevButtons: boolean[] = [];
  private prevAxes: number[] = [];

  private dasTimer: number = 0;
  private arrTimer: number = 0;
  private activeDirection: 'left' | 'right' | null = null;

  private onPauseCallback?: () => void;
  private onRestartCallback?: () => void;

  constructor(
    engine: GameEngine,
    callbacks?: { onPause?: () => void; onRestart?: () => void }
  ) {
    this.engine = engine;
    this.onPauseCallback = callbacks?.onPause;
    this.onRestartCallback = callbacks?.onRestart;
  }

  public update(deltaMs: number) {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return;

    const gamepads = navigator.getGamepads();
    if (!gamepads) return;

    // Check first connected gamepad
    const gp = Array.from(gamepads).find(g => g && g.connected);
    if (!gp) return;

    const buttons = gp.buttons.map(b => (typeof b === 'object' ? b.pressed : b === 1.0));
    const axes = gp.axes;

    // Detect button presses (rising edge)
    const justPressed = (idx: number) => buttons[idx] && !this.prevButtons[idx];

    // Pause: Button 9 (Start / Options)
    if (justPressed(9)) {
      this.onPauseCallback?.();
    }

    // Restart: Button 8 (Select / Back)
    if (justPressed(8)) {
      this.onRestartCallback?.();
    }

    if (this.engine.state === 'playing') {
      // Rotate CW: Button 0 (A / Cross) or Button 12 (D-Pad Up if used for rotate in some mappings, but Button 0 is standard)
      if (justPressed(0)) {
        this.engine.rotateCW();
      }

      // Rotate CCW: Button 1 (B / Circle) or Button 2 (X / Square)
      if (justPressed(1) || justPressed(2)) {
        this.engine.rotateCCW();
      }

      // Hard Drop: Button 3 (Y / Triangle) or Button 12 (D-Pad Up)
      if (justPressed(3) || justPressed(12)) {
        this.engine.hardDrop();
      }

      // Hold: Button 4 (LB / L1) or Button 5 (RB / R1)
      if (justPressed(4) || justPressed(5)) {
        this.engine.hold();
      }

      // Soft Drop: Button 13 (D-Pad Down) or Left Stick Down (axes[1] > 0.5)
      const isSoftDrop = buttons[13] || (axes[1] && axes[1] > 0.5);
      if (isSoftDrop) {
        this.engine.softDrop();
      }

      // Horizontal direction state: D-Pad Left (14) or axes[0] < -0.5 vs D-Pad Right (15) or axes[0] > 0.5
      const isLeft = buttons[14] || (axes[0] && axes[0] < -0.5);
      const isRight = buttons[15] || (axes[0] && axes[0] > 0.5);

      if (isLeft && !isRight) {
        if (this.activeDirection !== 'left') {
          this.activeDirection = 'left';
          this.dasTimer = 0;
          this.arrTimer = 0;
          this.engine.moveLeft();
        } else {
          this.dasTimer += deltaMs;
          if (this.dasTimer >= this.engine.das) {
            this.arrTimer += deltaMs;
            const arr = Math.max(1, this.engine.arr);
            while (this.arrTimer >= arr) {
              this.arrTimer -= arr;
              this.engine.moveLeft();
            }
          }
        }
      } else if (isRight && !isLeft) {
        if (this.activeDirection !== 'right') {
          this.activeDirection = 'right';
          this.dasTimer = 0;
          this.arrTimer = 0;
          this.engine.moveRight();
        } else {
          this.dasTimer += deltaMs;
          if (this.dasTimer >= this.engine.das) {
            this.arrTimer += deltaMs;
            const arr = Math.max(1, this.engine.arr);
            while (this.arrTimer >= arr) {
              this.arrTimer -= arr;
              this.engine.moveRight();
            }
          }
        }
      } else {
        this.activeDirection = null;
        this.dasTimer = 0;
        this.arrTimer = 0;
      }
    }

    this.prevButtons = buttons;
    this.prevAxes = Array.from(axes);
  }
}
