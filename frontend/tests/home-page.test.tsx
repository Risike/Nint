// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HomePage } from '../src/pages/HomePage';

vi.mock('../src/i18n/useI18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}));

vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({ isGuest: false })
}));

vi.mock('../src/services/api', () => ({
  ApiClient: {
    getNews: vi.fn().mockResolvedValue({ message: '' })
  }
}));

describe('Home page navigation', () => {
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

  it('shows Shop before Settings and opens it', async () => {
    const onNavigate = vi.fn();

    await act(async () => {
      root!.render(<HomePage onNavigate={onNavigate} />);
      await Promise.resolve();
    });

    const headings = Array.from(container!.querySelectorAll('h3')).map((heading) => heading.textContent);
    expect(headings).toEqual(['Solo', 'Multiplayer', 'Leaderboards', 'Stats', 'Shop', 'Settings']);

    const shopCard = Array.from(container!.querySelectorAll<HTMLElement>('.panel-card[role="button"]'))
      .find((card) => card.textContent?.includes('Shop'));
    expect(shopCard).toBeTruthy();

    await act(async () => {
      shopCard!.click();
    });

    expect(onNavigate).toHaveBeenCalledWith('shop');
  });
});
