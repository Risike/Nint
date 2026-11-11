// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GamepadBar } from '../src/components/layout/GamepadBar';

vi.mock('../src/context/GamepadNavContext', () => ({
  useGamepadNav: () => ({ gamepadConnected: true, isGameplayActive: false })
}));

vi.mock('../src/i18n/useI18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}));

describe('GamepadBar', () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
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
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
  });

  it('shows the right-stick scroll hint on its own bottom row', async () => {
    await act(async () => {
      root!.render(<GamepadBar />);
    });

    const items = container!.querySelectorAll('.gamepad-helper-item');
    const scrollHint = container!.querySelector('.gamepad-helper-item--scroll');

    expect(scrollHint).not.toBeNull();
    expect(items[items.length - 1]).toBe(scrollHint);
    expect(scrollHint?.textContent).toContain('RS');
    expect(scrollHint?.textContent).toContain('↕');
    expect(scrollHint?.textContent).toContain('Right Stick Scroll');
  });
});
