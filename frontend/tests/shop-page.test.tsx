// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ShopPage } from '../src/pages/ShopPage';

const { mockSetPreviewTheme } = vi.hoisted(() => ({ mockSetPreviewTheme: vi.fn() }));
const gamepad = vi.hoisted(() => ({
  back: null as null | (() => boolean | void)
}));

vi.mock('../src/context/GamepadNavContext', () => ({
  useGamepadBack: (handler: () => boolean | void) => {
    gamepad.back = handler;
  }
}));

vi.mock('../src/i18n/useI18n', () => ({
  useI18n: () => ({
    t: (source: string, vars?: Record<string, string | number>) =>
      source.replace(/\{(\w+)\}/g, (_, key) => String(vars?.[key] ?? `{${key}}`)),
    language: 'en'
  })
}));

vi.mock('../src/context/SettingsContext', () => ({
  useSettings: () => ({
    settings: { theme: 'dark-01' },
    updateSettings: vi.fn(),
    previewTheme: null,
    setPreviewTheme: mockSetPreviewTheme
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
        profile_icon: 'user',
        title: '',
        theme: 'dark-01'
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
        profile_icon: 'user',
        title: '',
        theme: 'dark-01'
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
          id: 'piece_round_pearl',
          kind: 'piece_skin',
          name: 'Pearl',
          value: 'round_pearl',
          price: 220,
          is_default: 0,
          owned: false,
          equipped: false,
          sort_order: 380
        },
        {
          id: 'icon_rocket',
          kind: 'profile_icon',
          name: 'Rocket',
          value: 'rocket',
          price: 150,
          is_default: 0,
          owned: false,
          equipped: false,
          sort_order: 90
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
        },
        {
          id: 'theme_light_01',
          kind: 'theme',
          name: 'Light — Clean',
          value: 'light-01',
          price: 1200,
          is_default: 0,
          owned: false,
          equipped: false,
          sort_order: 200
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
    mockSetPreviewTheme.mockClear();
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

  const categoryCards = () => Array.from(container!.querySelectorAll<HTMLElement>('.panel-card[role="button"]'));

  it('starts with six category choices and opens the selected category', async () => {
    await act(async () => {
      root!.render(<ShopPage onNavigate={() => {}} />);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(categoryCards()).toHaveLength(6);
    expect(categoryCards().map((card) => card.querySelector('h3')?.textContent)).toEqual([
      'Piece Skins',
      'Titles',
      'Themes',
      'Name Colors',
      'Name Decorations',
      'Profile Icons'
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

    expect(categoryCards()).toHaveLength(6);
  });

  it('returns from a category to the shop with B, then leaves through the parent back handler', async () => {
    const onBack = vi.fn();
    await act(async () => {
      root!.render(<ShopPage onNavigate={() => {}} mode="player" onBack={onBack} />);
      await Promise.resolve();
      await Promise.resolve();
    });

    const titleCard = categoryCards().find((card) => card.textContent?.includes('Titles'));
    expect(titleCard).toBeTruthy();
    await act(async () => {
      titleCard!.click();
    });

    expect(gamepad.back).toBeTypeOf('function');
    await act(async () => {
      expect(gamepad.back?.()).toBe(true);
    });
    expect(categoryCards()).toHaveLength(6);
    expect(onBack).not.toHaveBeenCalled();

    await act(async () => {
      expect(gamepad.back?.()).toBe(true);
    });
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('opens themes and renders a theme preview', async () => {
    await act(async () => {
      root!.render(<ShopPage onNavigate={() => {}} />);
      await Promise.resolve();
      await Promise.resolve();
    });

    const themeCard = categoryCards().find((card) => card.textContent?.includes('Themes'));
    expect(themeCard).toBeTruthy();

    await act(async () => {
      themeCard!.click();
    });

    expect(container!.textContent).toContain('Light — Clean');
    const preview = container!.querySelector('[data-theme-preview="light-01"]');
    expect(preview).toBeTruthy();
    expect(preview!.textContent).toContain('Aa');

    const previewButton = container!.querySelector<HTMLButtonElement>('[data-theme-preview-action="light-01"]');
    expect(previewButton).toBeTruthy();
    expect(previewButton!.textContent).toContain('Preview');

    await act(async () => {
      previewButton!.click();
    });

    expect(mockSetPreviewTheme).toHaveBeenCalledWith('light-01');
  });

  it('restores the equipped theme when the shop unmounts', async () => {
    await act(async () => {
      root!.render(<ShopPage onNavigate={() => {}} />);
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      root!.unmount();
    });
    root = null;

    expect(mockSetPreviewTheme).toHaveBeenCalledWith(null);
  });

  it('opens profile icons and previews the equipped icon', async () => {
    await act(async () => {
      root!.render(<ShopPage onNavigate={() => {}} />);
      await Promise.resolve();
      await Promise.resolve();
    });

    const iconCard = categoryCards().find((card) => card.textContent?.includes('Profile Icons'));
    expect(iconCard).toBeTruthy();

    await act(async () => {
      iconCard!.click();
    });

    expect(container!.textContent).not.toContain('Rocket');
    const icon = container!.querySelector('[data-profile-icon="rocket"]');
    expect(icon?.textContent).toBe('🚀');
  });

  it('lets you choose the piece shown in the skin previews', async () => {
    await act(async () => {
      root!.render(<ShopPage onNavigate={() => {}} />);
      await Promise.resolve();
      await Promise.resolve();
    });

    const skinCard = categoryCards().find((card) => card.textContent?.includes('Piece Skins'));
    expect(skinCard).toBeTruthy();

    await act(async () => {
      skinCard!.click();
    });

    const selector = container!.querySelector<HTMLSelectElement>('select[aria-label="Preview piece"]');
    expect(selector).toBeTruthy();
    expect(Array.from(selector!.options).map((option) => option.value)).toEqual([
      'I', 'O', 'T', 'S', 'Z', 'J', 'L'
    ]);
    expect(selector!.value).toBe('T');

    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!;
      setter.call(selector!, 'I');
      selector!.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(selector!.value).toBe('I');
    expect(container!.textContent).toContain('Pearl');
  });
});
