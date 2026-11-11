// @vitest-environment jsdom
import React, { act, useEffect, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GamepadNavProvider, useGamepadNav } from '../src/context/GamepadNavContext';

const settle = async (ms: number) => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
};

const rectAt = (top: number): DOMRect => ({
  top,
  left: 100,
  right: 300,
  bottom: top + 60,
  width: 200,
  height: 60,
  x: 100,
  y: top,
  toJSON: () => ({})
}) as DOMRect;

const sizeElement = (el: HTMLElement | null, top: number) => {
  if (!el) return;
  Object.defineProperties(el, {
    offsetWidth: { configurable: true, value: 200 },
    offsetHeight: { configurable: true, value: 60 },
    getBoundingClientRect: { configurable: true, value: () => rectAt(top) }
  });
};

function MarathonLevelHarness() {
  const [level, setLevel] = useState(5);
  const sliderRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { setFocusedElement } = useGamepadNav();

  useEffect(() => {
    sizeElement(sliderRef.current, 200);
    sizeElement(buttonRef.current, 300);
    setFocusedElement(sliderRef.current);
  }, [setFocusedElement]);

  return (
    <main className="main-content">
      <input
        ref={sliderRef}
        type="range"
        min={1}
        max={15}
        step={1}
        value={level}
        aria-label="Marathon starting level"
        onChange={(event) => setLevel(parseInt(event.target.value, 10))}
      />
      <span data-testid="level">{level}</span>
      <button ref={buttonRef} type="button">
        Start Marathon
      </button>
    </main>
  );
}

describe('Marathon starting level with gamepad', () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;
  let originalGetGamepads: Navigator['getGamepads'] | undefined;
  let gamepad: {
    id: string;
    connected: boolean;
    axes: number[];
    buttons: Array<{ pressed: boolean }>;
  };

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

    originalGetGamepads = navigator.getGamepads;
    gamepad = {
      id: 'Test Gamepad',
      connected: true,
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 16 }, () => ({ pressed: false }))
    };
    Object.defineProperty(navigator, 'getGamepads', {
      configurable: true,
      value: () => [gamepad]
    });

    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
      Number(setTimeout(() => callback(performance.now()), 16))
    );
    vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root?.unmount();
    });
    root = null;
    container?.remove();
    container = null;

    vi.unstubAllGlobals();
    if (originalGetGamepads) {
      Object.defineProperty(navigator, 'getGamepads', {
        configurable: true,
        value: originalGetGamepads
      });
    } else {
      delete (navigator as { getGamepads?: unknown }).getGamepads;
    }
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
  });

  it('changes the level with left/right and keeps it when moving down to the buttons', async () => {
    await act(async () => {
      root!.render(
        <GamepadNavProvider activeTab="solo" setActiveTab={() => {}} isAuthenticated={false}>
          <MarathonLevelHarness />
        </GamepadNavProvider>
      );
    });
    await settle(80);

    const slider = container!.querySelector<HTMLInputElement>('input[type="range"]')!;
    const level = () => container!.querySelector('[data-testid="level"]')!.textContent;
    const press = async (buttonIndex: number) => {
      gamepad.buttons[buttonIndex].pressed = true;
      await settle(40);
      gamepad.buttons[buttonIndex].pressed = false;
      await settle(40);
    };

    expect(slider.getAttribute('data-gamepad-focused')).toBe('true');

    await press(15); // D-pad right: 5 -> 6
    expect(level()).toBe('6');
    expect(slider.value).toBe('6');

    await press(14); // D-pad left: 6 -> 5
    expect(level()).toBe('5');
    expect(slider.value).toBe('5');

    await press(15); // D-pad right: 5 -> 6

    await press(13); // D-pad down to the button row

    expect(level()).toBe('6');
    expect(slider.value).toBe('6');
    expect(container!.querySelector('button')!.getAttribute('data-gamepad-focused')).toBe('true');
  });
});
