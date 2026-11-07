import { GameEngine } from '../engine/gameEngine';

export interface KeyBindings {
  moveLeft: string[];
  moveRight: string[];
  softDrop: string[];
  hardDrop: string[];
  rotateCW: string[];
  rotateCCW: string[];
  hold: string[];
  pause: string[];
  restart: string[];
}

export const DEFAULT_KEYBINDINGS: KeyBindings = {
  moveLeft: ['ArrowLeft'],
  moveRight: ['ArrowRight'],
  softDrop: ['ArrowDown'],
  hardDrop: [' '], // Space
  rotateCW: ['ArrowUp', 'x', 'X'],
  rotateCCW: ['z', 'Z', 'Control'],
  hold: ['c', 'C', 'Shift'],
  pause: ['Escape'],
  restart: ['r', 'R']
};

export class KeyboardManager {
  private engine: GameEngine;
  private keybindings: KeyBindings;
  private keysDown: Set<string> = new Set();

  private dasTimer: number = 0;
  private arrTimer: number = 0;
  private activeHorizontalKey: 'left' | 'right' | null = null;
  private softDropIntervalId: number | null = null;

  private onRestartCallback?: () => void;
  private onPauseCallback?: () => void;

  constructor(
    engine: GameEngine,
    keybindings: KeyBindings = DEFAULT_KEYBINDINGS,
    callbacks?: { onRestart?: () => void; onPause?: () => void }
  ) {
    this.engine = engine;
    this.keybindings = keybindings;
    this.onRestartCallback = callbacks?.onRestart;
    this.onPauseCallback = callbacks?.onPause;

    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);
  }

  public setBindings(bindings: Partial<KeyBindings>) {
    this.keybindings = { ...this.keybindings, ...bindings };
  }

  public attach() {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
  }

  public detach() {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    this.keysDown.clear();
    this.activeHorizontalKey = null;
  }

  private handleKeyDown(e: KeyboardEvent) {
    // Avoid capturing inputs when typing into input fields
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }

    const key = e.key;

    // Prevent page scrolling on Space / Arrow keys during game
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(key)) {
      e.preventDefault();
    }

    if (this.keysDown.has(key)) {
      return; // Key repeat handled by DAS/ARR loop
    }
    this.keysDown.add(key);

    if (this.matches(key, this.keybindings.pause)) {
      this.onPauseCallback?.();
      return;
    }

    if (this.matches(key, this.keybindings.restart)) {
      this.onRestartCallback?.();
      return;
    }

    if (this.engine.state !== 'playing') {
      return;
    }

    if (this.matches(key, this.keybindings.rotateCW)) {
      this.engine.rotateCW();
    } else if (this.matches(key, this.keybindings.rotateCCW)) {
      this.engine.rotateCCW();
    } else if (this.matches(key, this.keybindings.hardDrop)) {
      this.engine.hardDrop();
    } else if (this.matches(key, this.keybindings.hold)) {
      this.engine.hold();
    } else if (this.matches(key, this.keybindings.moveLeft)) {
      this.engine.moveLeft();
      this.activeHorizontalKey = 'left';
      this.dasTimer = 0;
      this.arrTimer = 0;
    } else if (this.matches(key, this.keybindings.moveRight)) {
      this.engine.moveRight();
      this.activeHorizontalKey = 'right';
      this.dasTimer = 0;
      this.arrTimer = 0;
    } else if (this.matches(key, this.keybindings.softDrop)) {
      this.engine.softDrop();
    }
  }

  private handleKeyUp(e: KeyboardEvent) {
    const key = e.key;
    this.keysDown.delete(key);

    if (this.matches(key, this.keybindings.moveLeft) && this.activeHorizontalKey === 'left') {
      if (this.isAnyDown(this.keybindings.moveRight)) {
        this.activeHorizontalKey = 'right';
        this.dasTimer = 0;
        this.arrTimer = 0;
        this.engine.moveRight();
      } else {
        this.activeHorizontalKey = null;
      }
    } else if (this.matches(key, this.keybindings.moveRight) && this.activeHorizontalKey === 'right') {
      if (this.isAnyDown(this.keybindings.moveLeft)) {
        this.activeHorizontalKey = 'left';
        this.dasTimer = 0;
        this.arrTimer = 0;
        this.engine.moveLeft();
      } else {
        this.activeHorizontalKey = null;
      }
    }
  }

  public update(deltaMs: number) {
    if (this.engine.state !== 'playing') return;

    // Handle horizontal DAS & ARR
    if (this.activeHorizontalKey) {
      this.dasTimer += deltaMs;
      if (this.dasTimer >= this.engine.das) {
        this.arrTimer += deltaMs;
        const arr = Math.max(1, this.engine.arr);
        while (this.arrTimer >= arr) {
          this.arrTimer -= arr;
          if (this.activeHorizontalKey === 'left') {
            this.engine.moveLeft();
          } else {
            this.engine.moveRight();
          }
        }
      }
    }

    // Handle soft drop continuous pressure
    if (this.isAnyDown(this.keybindings.softDrop)) {
      this.engine.softDrop();
    }
  }

  private matches(key: string, bindList: string[]): boolean {
    return bindList.includes(key);
  }

  private isAnyDown(bindList: string[]): boolean {
    return bindList.some(k => this.keysDown.has(k));
  }
}
