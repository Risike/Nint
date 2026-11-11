// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ShopPage } from '../src/pages/ShopPage';

vi.mock('../src/i18n/useI18n', () => ({
  useI18n: () => ({
    t: (source: string, vars?: Record<string, string | number>) =>
      source.replace(/\{(\w+)\}/g, (_, key) => String(vars?.[key] ?? `{${key}}`)),
    language: 'en'
  })
}));

vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      display_name: 'Tester',
      credits: 500,
      cosmetics: {
        piece_skin: 'classic',
        name_color: '#f8fafc',
        name_decoration: 'none',
        title: ''
      }
    },
    isAuthenticated: true,
    refreshProfile: vi.fn()
  })
}));

vi.mock('../src/services/api', () => ({
  ApiClient: {
    getShop: vi.fn().mockResolvedValue({
      credits: 500,
      cosmetics: {
        piece_skin: 'classic',
        name_color: '#f8fafc',
        name_decoration: 'none',
        title: ''
      },
      items: [
        {
          id: 'title_none',
          kind: 'title',
          name: 'No Title',
          value: '',
          price: 0,
          is_default: 1,
          owned: true,
          equipped: true,
          sort_order: 0
        },
        {
          id: 'title_line_lord',
          kind: 'title',
          name: 'Line Lord',
          value: 'Line Lord',
          price: 40,
          is_default: 0,
          owned: false,
          equipped: false,
          sort_order: 10
        },
        {
          id: 'color_cyan',
          kind: 'name_color',
          name: 'Cyan',
          value: '#22d3ee',
          price: 20,
          is_default: 0,
          owned: false,
          equipped: false,
          sort_order: 10
        }
      ]
    }),
    purchaseShopItem: vi.fn(),
    equipShopItem: vi.fn()
  }
}));

describe('Shop categories', () => {
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

  const categoryCards = () => Array.from(container!.querySelectorAll<HTMLElement>('.panel-card[role="button"]'));

  it('starts with four category choices and opens the selected category', async () => {
    await act(async () => {
      root!.render(<ShopPage onNavigate={() => {}} />);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(categoryCards()).toHaveLength(4);
    expect(categoryCards().map((card) => card.querySelector('h3')?.textContent)).toEqual([
      'Piece Skins',
      'Titles',
      'Name Colors',
      'Name Decorations'
    ]);
    expect(container!.textContent).toContain('2 items');

    const titleCard = categoryCards().find((card) => card.textContent?.includes('Titles'));
    expect(titleCard).toBeTruthy();

    await act(async () => {
      titleCard!.click();
    });

    expect(container!.textContent).toContain('Back to categories');
    expect(container!.textContent).toContain('Line Lord');
    expect(container!.textContent).toContain('No Title');
    expect(container!.textContent).not.toContain('Cyan');
    expect(categoryCards()).toHaveLength(0);

    const backButton = Array.from(container!.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Back to categories'));
    expect(backButton).toBeTruthy();

    await act(async () => {
      backButton!.click();
    });

    expect(categoryCards()).toHaveLength(4);
  });
});
