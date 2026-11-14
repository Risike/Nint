import { describe, expect, it } from 'vitest';
import { MAIN_NAV_ITEMS, MAIN_TABS, getMainTab } from '../src/navigation';

describe('main navigation', () => {
  it('exposes the eight requested destinations in order', () => {
    expect(MAIN_NAV_ITEMS.map(({ label }) => label)).toEqual([
      'Home',
      'Solo',
      'Multiplayer',
      'Leaderboards',
      'Player',
      'Shop',
      'Guide',
      'Settings'
    ]);
    expect(MAIN_TABS).toEqual(['home', 'solo', 'online', 'leaderboards', 'player', 'shop', 'guide', 'settings']);
  });

  it('treats CPU matches as part of the Solo section', () => {
    expect(getMainTab('versus_ai')).toBe('solo');
    expect(getMainTab('online')).toBe('online');
    expect(getMainTab('shop')).toBe('shop');
    expect(getMainTab('guide')).toBe('guide');
    expect(getMainTab('player-public')).toBe('leaderboards');
    expect(getMainTab('unknown')).toBe('home');
  });
});
