import { describe, expect, it } from 'vitest';
import { TITLE_TRANSLATIONS, getShopTitleLabel, getTitleLabel } from '../src/i18n/titles';

const LANGUAGES = ['en', 'fr', 'de', 'es', 'it'] as const;

describe('shop titles', () => {
  it('has 50 titles translated into every supported language', () => {
    const entries = Object.entries(TITLE_TRANSLATIONS);
    expect(entries).toHaveLength(50);
    for (const [, title] of entries) {
      for (const language of LANGUAGES) {
        expect(title[language].trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('translates keys, legacy values and the no-title option', () => {
    expect(getTitleLabel('title_line_lord', 'fr')).toBe('Seigneur des lignes');
    expect(getTitleLabel('Line Lord', 'de')).toBe('Linienfürst');
    expect(getTitleLabel('My Custom Title', 'es')).toBe('My Custom Title');
    expect(getTitleLabel('', 'it')).toBe('');
    expect(getShopTitleLabel('title_none', '', 'es')).toBe('Sin título');
  });
});
