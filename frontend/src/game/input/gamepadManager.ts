import { GameEngine } from '../engine/gameEngine';

export interface GamepadBindings {
  moveLeft: number[];
  moveRight: number[];
  softDrop: number[];
  hardDrop: number[];
  rotateCW: number[];
  rotateCCW: number[];
  hold: number[];
  pause: number[];
  restart: number[];
}

export const DEFAULT_GAMEPAD_BINDINGS: GamepadBindings = {
  moveLeft: [14],    // D-Pad Left
  moveRight: [15],   // D-Pad Right
  softDrop: [13],    // D-Pad Down
  hardDrop: [3, 12], // Y / Triangle, D-Pad Up
  rotateCW: [0],     // A / Cross
  rotateCCW: [1, 2], // B / Circle, X / Square
  hold: [4, 5],      // LB / L1, RB / R1
  pause: [9],        // Start / Options
  restart: [8]       // Back / Share
};

export const GAMEPAD_BUTTON_NAMES: Record<number, string> = {
  0: 'A / Cross',
  1: 'B / Circle',
  2: 'X / Square',
  3: 'Y / Triangle',
  4: 'LB / L1',
  5: 'RB / R1',
  6: 'LT / L2',
  7: 'RT / R2',
  8: 'Back / Share',
  9: 'Start / Options',
  10: 'L3 Click',
  11: 'R3 Click',
  12: 'D-Pad Up',
  13: 'D-Pad Down',
  14: 'D-Pad Left',
  15: 'D-Pad Right'
};

export class GamepadManager {
  private engine: GameEngine;
  private bindings: GamepadBindings;
  private prevButtons: boolean[] = [];

  private dasTimer: number = 0;
  private arrTimer: number = 0;
  private activeDirection: 'left' | 'right' | null = null;

  private onPauseCallback?: () => void;
  private onRestartCallback?: () => void;

  constructor(
    engine: GameEngine,
    bindings: GamepadBindings = DEFAULT_GAMEPAD_BINDINGS,
    callbacks?: { onPause?: () => void; onRestart?: () => void }
  ) {
    this.engine = engine;
    this.bindings = bindings;
    this.onPauseCallback = callbacks?.onPause;
    this.onRestartCallback = callbacks?.onRestart;
  }

  public setBindings(newBindings: Partial<GamepadBindings>) {
    this.bindings = { ...this.bindings, ...newBindings };
  }

  public update(deltaMs: number) {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return;

    const gamepads = navigator.getGamepads();
    if (!gamepads) return;

    const gp = Array.from(gamepads).find(g => g && g.connected);
    if (!gp) return;

    const buttons = gp.buttons.map(b => (typeof b === 'object' ? b.pressed : b === 1.0));
    const axes = gp.axes;

    const justPressed = (btnIndices: number[]) => {
      return btnIndices.some(idx => buttons[idx] && !this.prevButtons[idx]);
    };

    const isPressed = (btnIndices: number[]) => {
      return btnIndices.some(idx => buttons[idx]);
    };

    // Pause
    if (justPressed(this.bindings.pause)) {
      this.onPauseCallback?.();
    }

    // Restart
    if (justPressed(this.bindings.restart)) {
      this.onRestartCallback?.();
    }

    if (this.engine.state === 'playing') {
      // Rotate CW
      if (justPressed(this.bindings.rotateCW)) {
        this.engine.rotateCW();
      }

      // Rotate CCW
      if (justPressed(this.bindings.rotateCCW)) {
        this.engine.rotateCCW();
      }

      // Hard Drop
      if (justPressed(this.bindings.hardDrop)) {
        this.engine.hardDrop();
      }

      // Hold
      if (justPressed(this.bindings.hold)) {
        this.engine.hold();
      }

      // Soft Drop: Bound buttons or Left Analog Stick Down
      const isSoftDrop = isPressed(this.bindings.softDrop) || (axes[1] && axes[1] > 0.5);
      if (isSoftDrop) {
        this.engine.softDrop();
      }

      // Horizontal Movement: Bound buttons or Left Stick
      const isLeft = isPressed(this.bindings.moveLeft) || (axes[0] && axes[0] < -0.5);
      const isRight = isPressed(this.bindings.moveRight) || (axes[0] && axes[0] > 0.5);

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
  }
}
