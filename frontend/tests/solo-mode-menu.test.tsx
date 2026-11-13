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

  it('groups classic modes, Blast, CPU opponents and the boss battle', async () => {
    await act(async () => {
      root!.render(<SoloModeMenu onSelectMode={() => {}} onStartCpu={() => {}} />);
    });

    const sections = container!.querySelectorAll('section');
    expect(sections).toHaveLength(4);

    const classicModes = Array.from(sections[0].querySelectorAll('h3'))
      .map((heading) => heading.textContent?.trim());
    expect(classicModes).toEqual([
      'Marathon',
      'Sprint (40 Lines)',
      'Ultra',
      'Practice'
    ]);

    expect(sections[0].querySelectorAll('[role="button"]')).toHaveLength(4);

    const blastModes = Array.from(sections[1].querySelectorAll('h3'))
      .map((heading) => heading.textContent?.trim());
    expect(blastModes).toEqual(['Contest', 'Training', 'Fight']);
    expect(sections[1].querySelectorAll('[role="button"]')).toHaveLength(3);

    expect(sections[2].querySelectorAll('[data-cpu-level]')).toHaveLength(10);
    expect(sections[2].querySelectorAll('[role="button"]')).toHaveLength(1);
    expect(sections[2].querySelector('[data-cpu-level="1"]')?.getAttribute('data-cpu-locked')).toBe('false');
    expect(sections[2].querySelector('[data-cpu-level="2"]')?.getAttribute('data-cpu-locked')).toBe('true');

    expect(sections[3].querySelectorAll('[data-boss-level]')).toHaveLength(10);
    expect(sections[3].querySelectorAll('[role="button"]')).toHaveLength(1);
    expect(sections[3].querySelector('[data-boss-level="1"]')?.getAttribute('data-boss-locked')).toBe('false');
    expect(sections[3].querySelector('[data-boss-level="2"]')?.getAttribute('data-boss-locked')).toBe('true');
  });

  it('only makes unlocked CPU levels selectable', async () => {
    const onStartCpu = vi.fn();

    await act(async () => {
      root!.render(
        <SoloModeMenu
          onSelectMode={() => {}}
          onStartCpu={onStartCpu}
          unlockedCpuLevel={2}
        />
      );
    });

    const cpuSection = container!.querySelectorAll('section')[2];
    expect(cpuSection.querySelectorAll('[role="button"]')).toHaveLength(2);

    (cpuSection.querySelector('[data-cpu-level="2"]') as HTMLElement).click();
    expect(onStartCpu).toHaveBeenCalledWith(2);

    (cpuSection.querySelector('[data-cpu-level="3"]') as HTMLElement).click();
    expect(onStartCpu).toHaveBeenCalledTimes(1);
  });

  it('only makes unlocked boss levels selectable', async () => {
    const onStartBoss = vi.fn();

    await act(async () => {
      root!.render(
        <SoloModeMenu
          onSelectMode={() => {}}
          onStartBoss={onStartBoss}
          unlockedBossLevel={2}
        />
      );
    });

    const bossSection = container!.querySelectorAll('section')[3];
    expect(bossSection.querySelectorAll('[role="button"]')).toHaveLength(2);

    (bossSection.querySelector('[data-boss-level="2"]') as HTMLElement).click();
    expect(onStartBoss).toHaveBeenCalledWith(2);

    (bossSection.querySelector('[data-boss-level="3"]') as HTMLElement).click();
    expect(onStartBoss).toHaveBeenCalledTimes(1);
  });
});
