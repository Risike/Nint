export const MAIN_NAV_ITEMS = [
  { tab: 'home', label: 'Home' },
  { tab: 'solo', label: 'Solo' },
  { tab: 'online', label: 'Multiplayer' },
  { tab: 'leaderboards', label: 'Leaderboards' },
  { tab: 'stats', label: 'Stats' },
  { tab: 'settings', label: 'Settings' }
] as const;

export type MainTab = typeof MAIN_NAV_ITEMS[number]['tab'];

export const MAIN_TABS: readonly MainTab[] = MAIN_NAV_ITEMS.map(({ tab }) => tab);

/** CPU matches are part of the Solo section, not the online Multiplayer tab. */
export function getMainTab(tab: string): MainTab {
  if (tab === 'versus_ai') return 'solo';
  return MAIN_TABS.find((mainTab) => mainTab === tab) ?? 'home';
}
