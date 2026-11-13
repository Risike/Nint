// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SoloModeMenu } from '../src/pages/SoloModeMenu';

vi.mock('../src/i18n/useI18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}));

describe('Solo mode menu', () => {
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

  const renderMenu = async (props: React.ComponentProps<typeof SoloModeMenu> = { onSelectMode: () => {} }) => {
    await act(async () => {
      root!.render(<SoloModeMenu {...props} />);
    });
  };

  it('shows the four categories in order and opens the classic modes', async () => {
    const onSelectMode = vi.fn();
    await renderMenu({ onSelectMode });

    const categories = Array.from(container!.querySelectorAll('[data-solo-category]'));
    expect(categories).toHaveLength(4);
    expect(categories.map((card) => card.getAttribute('data-solo-category'))).toEqual([
      'classic',
      'cpu',
      'boss',
      'blast'
    ]);
    expect(container!.querySelectorAll('[data-solo-mode]')).toHaveLength(0);

    await act(async () => {
      (container!.querySelector('[data-solo-category="classic"]') as HTMLElement).click();
    });

    const classicModes = Array.from(container!.querySelectorAll('[data-solo-mode]'));
    expect(classicModes).toHaveLength(4);
    expect(classicModes.map((card) => card.getAttribute('data-solo-mode'))).toEqual([
      'marathon',
      'sprint',
      'ultra',
      'zen'
    ]);

    await act(async () => {
      (container!.querySelector('[data-solo-mode="marathon"]') as HTMLElement).click();
    });
    expect(onSelectMode).toHaveBeenCalledWith('marathon');

    await act(async () => {
      (container!.querySelector('[data-solo-back]') as HTMLElement).click();
    });
    expect(container!.querySelectorAll('[data-solo-category]')).toHaveLength(4);
  });

  it('opens the Blast modes and starts the selected one', async () => {
    const onSelectMode = vi.fn();
    await renderMenu({ onSelectMode });

    await act(async () => {
      (container!.querySelector('[data-solo-category="blast"]') as HTMLElement).click();
    });

    const blastModes = Array.from(container!.querySelectorAll('[data-solo-mode]'));
    expect(blastModes.map((card) => card.getAttribute('data-solo-mode'))).toEqual([
      'blast-contest',
      'blast-training',
      'blast-fight'
    ]);

    await act(async () => {
      (container!.querySelector('[data-solo-mode="blast-fight"]') as HTMLElement).click();
    });
    expect(onSelectMode).toHaveBeenCalledWith('blast-fight');
  });

  it('shows only CPU levels under the CPU category', async () => {
    const onStartCpu = vi.fn();
    await renderMenu({
      onSelectMode: () => {},
      onStartCpu,
      unlockedCpuLevel: 2
    });

    await act(async () => {
      (container!.querySelector('[data-solo-category="cpu"]') as HTMLElement).click();
    });

    expect(container!.querySelectorAll('[data-cpu-level]')).toHaveLength(10);
    expect(container!.querySelectorAll('[data-boss-level]')).toHaveLength(0);
    expect(container!.querySelector('[data-cpu-level="1"]')?.getAttribute('data-cpu-locked')).toBe('false');
    expect(container!.querySelector('[data-cpu-level="2"]')?.getAttribute('data-cpu-locked')).toBe('false');
    expect(container!.querySelector('[data-cpu-level="3"]')?.getAttribute('data-cpu-locked')).toBe('true');

    await act(async () => {
      (container!.querySelector('[data-cpu-level="2"]') as HTMLElement).click();
    });
    expect(onStartCpu).toHaveBeenCalledWith(2);
  });

  it('opens the boss category separately from the CPU levels', async () => {
    const onStartBoss = vi.fn();
    await renderMenu({
      onSelectMode: () => {},
      onStartBoss,
      unlockedBossLevel: 2
    });

    await act(async () => {
      (container!.querySelector('[data-solo-category="boss"]') as HTMLElement).click();
    });

    expect(container!.querySelectorAll('[data-boss-level]')).toHaveLength(10);
    expect(container!.querySelectorAll('[data-cpu-level]')).toHaveLength(0);
    expect(container!.querySelector('[data-boss-level="1"]')?.getAttribute('data-boss-locked')).toBe('false');
    expect(container!.querySelector('[data-boss-level="2"]')?.getAttribute('data-boss-locked')).toBe('false');
    expect(container!.querySelector('[data-boss-level="3"]')?.getAttribute('data-boss-locked')).toBe('true');

    await act(async () => {
      (container!.querySelector('[data-boss-level="2"]') as HTMLElement).click();
    });
    expect(onStartBoss).toHaveBeenCalledWith(2);
  });
});
