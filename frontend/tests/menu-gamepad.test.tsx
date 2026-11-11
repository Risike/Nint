// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GamepadNavProvider, useGamepadActive } from '../src/context/GamepadNavContext';

const settle = async (ms: number) => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
};

function TestHarness({ active }: { active: boolean }) {
  useGamepadActive(active);
  return (
    <main className="main-content">
      <button type="button">Test</button>
    </main>
  );
}

describe('menu gamepad system actions', () => {
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
      id: 'Menu Test Gamepad',
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

  it('mutes with LT and toggles fullscreen with RT, but not during gameplay', async () => {
    const onMenuMute = vi.fn();
    const onMenuFullscreen = vi.fn();

    const renderProvider = async (active: boolean) => {
      await act(async () => {
        root!.render(
          <GamepadNavProvider
            activeTab="home"
            setActiveTab={() => {}}
            onMenuMute={onMenuMute}
            onMenuFullscreen={onMenuFullscreen}
          >
            <TestHarness active={active} />
          </GamepadNavProvider>
        );
      });
      await settle(100);
    };

    const press = async (index: number) => {
      gamepad.buttons[index].pressed = true;
      await settle(40);
      gamepad.buttons[index].pressed = false;
      await settle(40);
    };

    await renderProvider(false);

    await press(6); // LT
    expect(onMenuMute).toHaveBeenCalledTimes(1);
    expect(onMenuFullscreen).not.toHaveBeenCalled();

    await press(7); // RT
    expect(onMenuFullscreen).toHaveBeenCalledTimes(1);

    await renderProvider(true);
    await press(6);
    await press(7);

    expect(onMenuMute).toHaveBeenCalledTimes(1);
    expect(onMenuFullscreen).toHaveBeenCalledTimes(1);
  });

  it('scrolls vertically with the right stick on menu and gameplay pages', async () => {
    const scrollBy = vi.fn();
    vi.stubGlobal('scrollBy', scrollBy);

    const renderProvider = async (active: boolean) => {
      await act(async () => {
        root!.render(
          <GamepadNavProvider
            activeTab="home"
            setActiveTab={() => {}}
          >
            <TestHarness active={active} />
          </GamepadNavProvider>
        );
      });
      await settle(100);
    };

    const scrollWithStick = async (axisY: number) => {
      scrollBy.mockClear();
      gamepad.axes[3] = axisY;
      await settle(100);
      gamepad.axes[3] = 0;
      await settle(40);
    };

    const verticalDeltas = () => scrollBy.mock.calls
      .map(([options]) => (typeof options === 'object' ? options.top : 0))
      .filter((value): value is number => typeof value === 'number');

    await renderProvider(false);

    await scrollWithStick(0.9);
    expect(verticalDeltas().some((delta) => delta > 0)).toBe(true);

    await scrollWithStick(-0.9);
    expect(verticalDeltas().some((delta) => delta < 0)).toBe(true);

    await scrollWithStick(0.1);
    expect(scrollBy).not.toHaveBeenCalled();

    await renderProvider(true);
    await scrollWithStick(0.9);
    expect(verticalDeltas().some((delta) => delta > 0)).toBe(true);
  });

  it('wraps LB/RB between Home and Settings without profile or login', async () => {
    const setActiveTab = vi.fn();

    const renderProvider = async (activeTab: string) => {
      await act(async () => {
        root!.render(
          <GamepadNavProvider activeTab={activeTab} setActiveTab={setActiveTab}>
            <TestHarness active={false} />
          </GamepadNavProvider>
        );
      });
      await settle(100);
    };

    const press = async (index: number) => {
      gamepad.buttons[index].pressed = true;
      await settle(40);
      gamepad.buttons[index].pressed = false;
      await settle(40);
    };

    await renderProvider('settings');
    await press(5); // RB
    expect(setActiveTab).toHaveBeenCalledTimes(1);
    expect(setActiveTab).toHaveBeenCalledWith('home');

    setActiveTab.mockClear();
    await renderProvider('home');
    await press(4); // LB
    expect(setActiveTab).toHaveBeenCalledTimes(1);
    expect(setActiveTab).toHaveBeenCalledWith('settings');
    expect(setActiveTab).not.toHaveBeenCalledWith('profile');
    expect(setActiveTab).not.toHaveBeenCalledWith('login');
  });
});
