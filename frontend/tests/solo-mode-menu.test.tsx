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

  it('offers Marathon, Sprint, Ultra and Practice, without Classic', async () => {
    await act(async () => {
      root!.render(<SoloModeMenu onSelectMode={() => {}} onStartCpu={() => {}} />);
    });

    const singlePlayerModes = Array.from(container!.querySelectorAll('section:first-of-type h3'))
      .map((heading) => heading.textContent?.trim());

    expect(singlePlayerModes).toEqual([
      'Marathon',
      'Sprint (40 Lines)',
      'Ultra',
      'Practice'
    ]);
    expect(singlePlayerModes).not.toContain('Classic');
    expect(container!.querySelectorAll('section:last-of-type [role="button"]')).toHaveLength(5);
  });
});
