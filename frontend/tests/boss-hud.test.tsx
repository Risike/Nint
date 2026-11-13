// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BossHUD } from '../src/components/game/BossHUD';

vi.mock('../src/i18n/useI18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}));

describe('BossHUD damage segment', () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
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
    vi.useRealTimers();
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
  });

  const renderHud = (hp: number) => {
    act(() => {
      root!.render(
        <BossHUD
          hp={hp}
          maxHp={1000}
          nextAttackMs={30_000}
          pendingAttackName={null}
          activeEffects={[]}
        />
      );
    });
  };

  it('shows lost HP as a white segment for two seconds', () => {
    renderHud(1000);
    expect(container!.querySelector('[data-boss-damage-trail]')).toBeNull();

    renderHud(800);
    const segment = container!.querySelector<HTMLElement>('[data-boss-damage-trail]');
    expect(segment).not.toBeNull();
    expect(segment!.style.left).toBe('0%');
    expect(segment!.style.width).toBe('100%');
    expect(segment!.dataset.damageFrom).toBe('80');
    expect(segment!.dataset.damageTo).toBe('100');

    act(() => {
      vi.advanceTimersByTime(1999);
    });
    expect(container!.querySelector('[data-boss-damage-trail]')).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(container!.querySelector('[data-boss-damage-trail]')).toBeNull();
  });

  it('extends the same white segment for rapid consecutive hits', () => {
    renderHud(1000);
    renderHud(800);
    renderHud(600);

    const segment = container!.querySelector<HTMLElement>('[data-boss-damage-trail]');
    expect(segment).not.toBeNull();
    expect(segment!.style.left).toBe('0%');
    expect(segment!.style.width).toBe('100%');
    expect(segment!.dataset.damageFrom).toBe('60');
    expect(segment!.dataset.damageTo).toBe('100');
  });
});