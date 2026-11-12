// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  getNews: vi.fn(),
  setNews: vi.fn(),
  getLeaderboard: vi.fn(),
  clearLeaderboards: vi.fn(),
  adminSearchUsers: vi.fn(),
  adminClearUserStats: vi.fn(),
  adminDeleteUser: vi.fn(),
  adminGetShopItems: vi.fn(),
  adminCreateShopItem: vi.fn(),
  adminUpdateShopItem: vi.fn(),
  adminDeleteShopItem: vi.fn()
}));

vi.mock('../src/services/api', () => ({ ApiClient: api }));

vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'admin-1', display_name: 'Admin', email: 'admin@nint.test', is_admin: true }
  })
}));

vi.mock('../src/i18n/useI18n', () => ({
  useI18n: () => ({
    t: (key: string, vars?: Record<string, string | number>) => {
      if (!vars) return key;
      return key.replace(/\{(\w+)\}/g, (match, name) => vars[name] !== undefined ? String(vars[name]) : match);
    },
    language: 'en',
    formatDate: () => 'Jan 1, 2026'
  })
}));

import { AdminPage } from '../src/pages/AdminPage';

const shopItems = [
  {
    id: 'custom_skin',
    kind: 'piece_skin',
    name: 'Custom Skin',
    name_fr: 'Skin français',
    name_de: 'Skin Deutsch',
    name_es: 'Skin español',
    name_it: 'Skin italiano',
    value: 'neon',
    price: 100,
    is_default: 0,
    active: 1,
    sort_order: 1
  },
  {
    id: 'custom_title',
    kind: 'title',
    name: 'Custom Title',
    value: 'custom_title',
    price: 200,
    is_default: 0,
    active: 1,
    sort_order: 1
  },
  {
    id: 'custom_color',
    kind: 'name_color',
    name: 'Rainbow',
    name_fr: 'Arc-en-ciel',
    name_de: 'Regenbogen',
    name_es: 'Arcoíris',
    name_it: 'Arcobaleno',
    value: 'gradient:90:#ff0040,#00b0ff',
    price: 400,
    is_default: 0,
    active: 1,
    sort_order: 500
  },
  {
    id: 'custom_icon',
    kind: 'profile_icon',
    name: 'Rocket',
    name_fr: 'Fusée',
    name_de: 'Rakete',
    name_es: 'Cohete',
    name_it: 'Razzo',
    value: 'rocket',
    price: 150,
    is_default: 0,
    active: 1,
    sort_order: 90
  },
  {
    id: 'custom_decor',
    kind: 'name_decoration',
    name: 'Flames',
    name_fr: 'Flammes',
    name_de: 'Flammen',
    name_es: 'Llamas',
    name_it: 'Fiamme',
    value: 'flames',
    html: '<span>🔥 {name} 🔥</span>',
    price: 800,
    is_default: 0,
    active: 1,
    sort_order: 360
  }
];

const users = [
  {
    id: 'player-1',
    email: 'player@nint.test',
    display_name: 'NormalPlayer',
    is_admin: 0,
    rating: 1100,
    games_played: 5,
    wins: 3,
    losses: 2
  }
];

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

describe('Admin page', () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();
    api.getNews.mockResolvedValue({ message: '' });
    api.setNews.mockResolvedValue({ success: true });
    api.getLeaderboard.mockResolvedValue({
      entries: [{
        id: 'entry-1',
        rank: 1,
        display_name: 'NormalPlayer',
        name_color: '#f8fafc',
        name_decoration: 'none',
        title: '',
        score: 12345,
        created_at: 1
      }]
    });
    api.clearLeaderboards.mockResolvedValue({ success: true });
    api.adminSearchUsers.mockResolvedValue(users);
    api.adminClearUserStats.mockResolvedValue({ success: true });
    api.adminDeleteUser.mockResolvedValue({ success: true });
    api.adminGetShopItems.mockResolvedValue(shopItems);
    api.adminCreateShopItem.mockResolvedValue({ success: true });
    api.adminUpdateShopItem.mockResolvedValue({ success: true });
    api.adminDeleteShopItem.mockResolvedValue({ success: true });

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

  const renderPage = async () => {
    await act(async () => {
      root!.render(<AdminPage />);
      await flush();
    });
  };

  const clickButton = async (label: string) => {
    const button = Array.from(container!.querySelectorAll('button'))
      .find((item) => item.textContent?.includes(label));
    expect(button).toBeTruthy();
    await act(async () => {
      button!.click();
      await flush();
    });
  };

  const clickCard = async (label: string) => {
    const card = Array.from(container!.querySelectorAll<HTMLElement>('.panel-card[role="button"]'))
      .find((item) => item.textContent?.includes(label));
    expect(card).toBeTruthy();
    await act(async () => {
      card!.click();
      await flush();
    });
  };

  const setInputValue = async (input: HTMLInputElement, value: string) => {
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      setter.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await flush();
    });
  };

  it('opens the four admin categories and the five shop categories', async () => {
    await renderPage();

    expect(Array.from(container!.querySelectorAll('h3')).map((heading) => heading.textContent)).toEqual([
      'Announcements',
      'Leaderboards',
      'Shop',
      'Users'
    ]);

    await clickCard('Shop');
    expect(Array.from(container!.querySelectorAll('h3')).map((heading) => heading.textContent)).toEqual([
      'Piece Skins',
      'Titles',
      'Themes',
      'Name Colors',
      'Name Decorations',
      'Profile Icons'
    ]);

    await clickCard('Piece Skins');
    expect(api.adminGetShopItems).toHaveBeenCalledTimes(1);
    expect(container!.textContent).toContain('Custom Skin');
    expect(container!.textContent).not.toContain('Custom Title');
  });

  it('shows a large gradient preview in the color list and edit form', async () => {
    await renderPage();
    await clickCard('Shop');
    await clickCard('Name Colors');

    const gradientValue = 'gradient:90:#ff0040,#00b0ff';
    const listPreview = container!.querySelector<HTMLElement>(`[data-name-color-preview="${gradientValue}"]`);
    expect(listPreview).toBeTruthy();
    expect(listPreview!.style.backgroundImage).toContain('linear-gradient');

    await clickButton('Edit');

    const formPreview = Array.from(container!.querySelectorAll<HTMLElement>('[data-name-color-preview]'))
      .find((preview) => preview.style.width === '72px');
    expect(formPreview).toBeTruthy();
    expect(formPreview!.style.backgroundImage).toContain('linear-gradient');
  });

  it('sends a name for every shop language', async () => {
    await renderPage();
    await clickCard('Shop');
    await clickCard('Titles');

    const nameInputs = Array.from(container!.querySelectorAll<HTMLInputElement>('input[lang]'));
    expect(nameInputs.map((input) => input.lang)).toEqual(['en', 'fr', 'de', 'es', 'it']);

    await setInputValue(nameInputs[0], 'English Skin');
    await setInputValue(nameInputs[1], 'Skin FR');
    await setInputValue(nameInputs[3], 'Skin ES');
    await setInputValue(nameInputs[4], 'Skin IT');

    const form = container!.querySelector('form')!;
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await flush();
    });

    expect(api.adminCreateShopItem).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'title',
      name: 'English Skin',
      name_fr: 'Skin FR',
      name_de: '',
      name_es: 'Skin ES',
      name_it: 'Skin IT'
    }));
  });

  it('disables adding new piece skins but allows editable name decorations', async () => {
    await renderPage();
    await clickCard('Shop');
    await clickCard('Piece Skins');

    expect(container!.textContent).toContain('Adding new items is disabled for this category.');
    expect(container!.querySelector('form')).toBeNull();

    await clickButton('Back to shop categories');
    await clickCard('Name Decorations');

    expect(container!.textContent).not.toContain('Adding new items is disabled for this category.');
    expect(container!.querySelector('form')).toBeTruthy();
    expect(container!.textContent).toContain('🔥 Flames 🔥');
    expect(container!.textContent).toContain('Decoration HTML');
  });

  it('adds, re-prices and deletes profile icons in a compact grid', async () => {
    await renderPage();
    await clickCard('Shop');
    await clickCard('Profile Icons');

    const rocket = container!.querySelector('[data-profile-icon="rocket"]');
    expect(rocket?.textContent).toBe('🚀');
    expect(container!.textContent).not.toContain('Rocket');

    const grid = rocket?.parentElement?.parentElement as HTMLElement;
    expect(grid.style.display).toBe('grid');
    expect(grid.style.gridTemplateColumns).toContain('auto-fill');

    expect(container!.querySelector('form')).toBeTruthy();
    expect(container!.querySelectorAll('input[lang]')).toHaveLength(0);

    const emojiInput = container!.querySelector<HTMLInputElement>('input[placeholder="😀"]');
    expect(emojiInput).toBeTruthy();
    await setInputValue(emojiInput!, '🛸');

    const form = container!.querySelector('form')!;
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await flush();
    });

    expect(api.adminCreateShopItem).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'profile_icon',
      name: '🛸',
      name_fr: '',
      value: '🛸',
      price: 0,
      sort_order: 0,
      active: true
    }));
    expect(api.adminUpdateShopItem).not.toHaveBeenCalled();

    const editButton = container!.querySelector<HTMLButtonElement>('button[aria-label="Edit"]');
    expect(editButton).toBeTruthy();
    expect(editButton!.disabled).toBe(false);

    await act(async () => {
      editButton!.click();
      await flush();
    });

    const priceInput = container!.querySelector<HTMLInputElement>('input[aria-label="Price"]');
    expect(priceInput).toBeTruthy();
    expect(priceInput!.value).toBe('150');
    await setInputValue(priceInput!, '275');

    const priceForm = priceInput!.closest('form')!;
    await act(async () => {
      priceForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await flush();
    });

    expect(api.adminUpdateShopItem).toHaveBeenCalledWith('custom_icon', { price: 275 });

    const deleteButton = container!.querySelector<HTMLButtonElement>('button[aria-label="Delete"]');
    expect(deleteButton).toBeTruthy();
    expect(deleteButton!.disabled).toBe(false);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    await act(async () => {
      deleteButton!.click();
      await flush();
    });
    confirmSpy.mockRestore();

    expect(api.adminDeleteShopItem).toHaveBeenCalledWith('custom_icon');
  });

  it('fills every language field when editing a saved item', async () => {
    await renderPage();
    await clickCard('Shop');
    await clickCard('Piece Skins');

    const editButton = Array.from(container!.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Edit'));
    expect(editButton).toBeTruthy();

    await act(async () => {
      editButton!.click();
      await flush();
    });

    const nameInputs = Array.from(container!.querySelectorAll<HTMLInputElement>('input[lang]'));
    expect(nameInputs.map((input) => input.value)).toEqual([
      'Custom Skin',
      'Skin français',
      'Skin Deutsch',
      'Skin español',
      'Skin italiano'
    ]);
  });

  it('loads and saves the homepage announcement', async () => {
    await renderPage();
    await clickCard('Announcements');

    expect(api.getNews).toHaveBeenCalledTimes(1);
    const textarea = container!.querySelector('textarea')!;

    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!;
      setter.call(textarea, 'Weekend tournament announced!');
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      await flush();
    });

    await clickButton('Save Announcement');
    expect(api.setNews).toHaveBeenCalledWith('Weekend tournament announced!');
  });

  it('shows leaderboards and resets them after confirmation', async () => {
    await renderPage();
    await clickCard('Leaderboards');

    expect(api.getLeaderboard).toHaveBeenCalledWith('marathon_150', 'all');
    expect(container!.textContent).toContain('Top 10');
    expect(container!.textContent).toMatch(/12.?345/);

    await clickButton('Wipe All Leaderboards');
    expect(container!.textContent).toContain('Confirm leaderboard wipe?');

    await clickButton('Yes, Wipe Everything');
    expect(api.clearLeaderboards).toHaveBeenCalledTimes(1);
    expect(api.getLeaderboard).toHaveBeenCalledTimes(2);
  });

  it('loads users and clears their statistics after confirmation', async () => {
    await renderPage();
    await clickCard('Users');

    expect(api.adminSearchUsers).toHaveBeenCalledWith('');
    expect(container!.textContent).toContain('NormalPlayer');

    await clickButton('Clear Stats');
    await clickButton('Confirm: Clear Stats');

    expect(api.adminClearUserStats).toHaveBeenCalledWith('player-1');
  });
});
