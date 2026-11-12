// @vitest-environment jsdom
import React, { StrictMode, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GamepadNavProvider } from '../src/context/GamepadNavContext';

const keyboardMock = vi.hoisted(() => {
  let attached = false;
  return {
    attach: vi.fn(() => { attached = true; }),
    detach: vi.fn(() => { attached = false; }),
    update: vi.fn(),
    isAttached: () => attached,
    reset: () => { attached = false; }
  };
});

vi.mock('../src/game/input/keyboardManager', () => ({
  KeyboardManager: class {
    attach = keyboardMock.attach;
    detach = keyboardMock.detach;
    update = keyboardMock.update;
  }
}));

vi.mock('../src/game/audio/soundManager', () => ({
  soundManager: {
    stopBgm: vi.fn(),
    startBgm: vi.fn(),
    pauseBgm: vi.fn(),
    resumeBgm: vi.fn(),
    playMove: vi.fn(),
    playRotate: vi.fn(),
    playLock: vi.fn(),
    playClear: vi.fn(),
    playCombo: vi.fn(),
    playGameOver: vi.fn(),
    playGarbageSent: vi.fn(),
    playGarbageWarning: vi.fn()
  }
}));

vi.mock('../src/hooks/useDynamicCellSize', () => ({
  useDynamicCellSize: () => 20
}));

vi.mock('../src/components/game/VersusArena', () => ({
  VersusArena: ({ player }: { player: { label: React.ReactNode } }) => (
    <div data-testid="versus-arena">{player.label}</div>
  )
}));

vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    user: { display_name: 'Tester', cosmetics: {} },
    isAuthenticated: true
  })
}));

vi.mock('../src/context/SettingsContext', () => ({
  useSettings: () => ({
    settings: {
      das: 167,
      arr: 33,
      softDropFactor: 20,
      lockDelay: 500,
      keybindings: {
        moveLeft: ['ArrowLeft'],
        moveRight: ['ArrowRight'],
        softDrop: ['ArrowDown'],
        hardDrop: [' '],
        rotateCW: ['ArrowUp'],
        rotateCCW: ['z'],
        hold: ['c'],
        pause: ['Escape'],
        restart: ['r']
      },
      gamepadBindings: {}
    }
  })
}));

vi.mock('../src/i18n/useI18n', () => ({
  useI18n: () => ({
    t: (key: string, vars?: Record<string, string | number>) =>
      key.replace(/\{(\w+)\}/g, (_, name) => String(vars?.[name] ?? `{${name}}`)),
    language: 'en'
  })
}));

vi.mock('../src/services/api', () => ({
  ApiClient: { recordMatch: vi.fn() }
}));

import { VersusAiPage } from '../src/pages/VersusAiPage';

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('Versus keyboard lifecycle', () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    keyboardMock.reset();
    vi.clearAllMocks();
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

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
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
  });

  it('keeps the keyboard attached when the Solo menu starts a CPU match', async () => {
    await act(async () => {
      root!.render(
        <StrictMode>
          <GamepadNavProvider activeTab="versus_ai" setActiveTab={() => {}}>
            <VersusAiPage initialDifficulty={2} onClearInitialDifficulty={() => {}} />
          </GamepadNavProvider>
        </StrictMode>
      );
      await flush();
    });

    await act(async () => {
      await flush();
    });

    expect(keyboardMock.attach).toHaveBeenCalled();
    expect(keyboardMock.isAttached()).toBe(true);
  });
});
