import { afterEach, describe, expect, it, vi } from 'vitest';
import { GameEngine } from '../src/game/engine/gameEngine';
import { DEFAULT_GAMEPAD_BINDINGS, GamepadManager } from '../src/game/input/gamepadManager';

function installGamepad(startPressed: () => boolean) {
  vi.stubGlobal('navigator', {
    getGamepads: () => [{
      connected: true,
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 16 }, (_, index) => ({
        pressed: index === 9 ? startPressed() : false
      }))
    }]
  });
}

describe('Gamepad pause control', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('toggles pause with the Start / Options button', () => {
    let startPressed = false;
    installGamepad(() => startPressed);

    const engine = new GameEngine();
    engine.start();

    const manager = new GamepadManager(engine, DEFAULT_GAMEPAD_BINDINGS, {
      onPause: () => {
        if (engine.state === 'playing') engine.pause();
        else if (engine.state === 'paused') engine.resume();
      }
    });

    manager.update(16); // establish the released state
    expect(engine.state).toBe('playing');

    startPressed = true;
    manager.update(16);
    expect(engine.state).toBe('paused');

    startPressed = false;
    manager.update(16);

    startPressed = true;
    manager.update(16);
    expect(engine.state).toBe('playing');
  });
});
