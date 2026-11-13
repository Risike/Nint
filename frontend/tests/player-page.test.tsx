// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlayerPage } from '../src/pages/PlayerPage';

const gamepad = vi.hoisted(() => ({
  back: null as null | (() => boolean | void)
}));

vi.mock('../src/context/GamepadNavContext', () => ({
  useGamepadBack: (handler: () => boolean | void) => {
    gamepad.back = handler;
  }
}));

vi.mock('../src/i18n/useI18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}));

vi.mock('../src/pages/StatsPage', () => ({
  StatsPage: () => <div>Stats content</div>
}));

vi.mock('../src/pages/ShopPage', () => ({
  ShopPage: ({ onBack }: { onBack?: () => void }) => (
    <button type="button" onClick={onBack}>Player shop back</button>
  )
}));

describe('Player page navigation', () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  beforeEach(() => {
    gamepad.back = null;
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

  const clickCard = async (label: string) => {
    const card = Array.from(container!.querySelectorAll<HTMLElement>('.panel-card'))
      .find((item) => item.textContent?.includes(label));
    expect(card).toBeTruthy();
    await act(async () => {
      card!.click();
    });
  };

  it('returns from Stats to the Player menu with B', async () => {
    await act(async () => {
      root!.render(<PlayerPage onNavigate={() => {}} />);
    });

    await clickCard('Stats');
    expect(container!.textContent).toContain('Stats content');

    expect(gamepad.back).toBeTypeOf('function');
    await act(async () => {
      expect(gamepad.back?.()).toBe(true);
    });

    expect(container!.textContent).toContain('Your statistics and player customization.');
    expect(container!.textContent).not.toContain('Stats content');
  });

  it('returns from the Player shop to the Player menu through its parent back action', async () => {
    await act(async () => {
      root!.render(<PlayerPage onNavigate={() => {}} />);
    });

    await clickCard('Player');
    expect(container!.textContent).toContain('Player shop back');

    const shopBack = Array.from(container!.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Player shop back'));
    expect(shopBack).toBeTruthy();
    await act(async () => {
      shopBack!.click();
    });

    expect(container!.textContent).toContain('Your statistics and player customization.');
  });
});
