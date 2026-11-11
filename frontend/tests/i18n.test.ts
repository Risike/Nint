import { describe, expect, it } from 'vitest';
import { de } from '../src/i18n/locales/de';
import { es } from '../src/i18n/locales/es';
import { fr } from '../src/i18n/locales/fr';
import { it as italian } from '../src/i18n/locales/it';
import { isLanguage, translate } from '../src/i18n/translations';

describe('i18n', () => {
  it('keeps English as the default and validates supported languages', () => {
    expect(translate('en', 'Settings')).toBe('Settings');
    expect(translate('fr', 'Settings')).toBe('Paramètres');
    expect(translate('de', 'Settings')).toBe('Einstellungen');
    expect(translate('es', 'Settings')).toBe('Ajustes');
    expect(translate('it', 'Settings')).toBe('Impostazioni');
    expect(translate('fr', 'Home')).toBe('Accueil');
    expect(translate('fr', 'Multiplayer')).toBe('Multijoueur');
    expect(translate('fr', 'Single Player')).toBe('Un joueur');
    expect(translate('fr', 'Two Players')).toBe('Deux joueurs');
    expect(translate('fr', 'Right Stick Scroll')).toBe('Stick droit défiler');
    expect(translate('fr', 'Back to categories')).toBe('Retour aux catégories');
    expect(translate('fr', 'Spend credits on skins, colors, decorations, and titles.'))
      .toBe('Dépensez vos crédits en skins, couleurs, décorations et titres.');
    expect(translate('es', '{count} items', { count: 4 })).toBe('4 artículos');
    expect(translate('it', 'Browse')).toBe('Sfoglia');
    expect(isLanguage('en')).toBe(true);
    expect(isLanguage('fr')).toBe(true);
    expect(isLanguage('pt')).toBe(false);
  });

  it('interpolates translated values', () => {
    expect(translate('fr', 'Level {level} ({ms}ms)', { level: 4, ms: 500 })).toBe('Niveau 4 (500 ms)');
    expect(translate('de', 'You ({name})', { name: 'Ada' })).toBe('Du (Ada)');
  });

  it('falls back to the English source for unknown strings', () => {
    expect(translate('it', 'Unknown string')).toBe('Unknown string');
  });

  it('keeps all locale dictionaries in sync', () => {
    const reference = Object.keys(fr).sort();
    expect(Object.keys(de).sort()).toEqual(reference);
    expect(Object.keys(es).sort()).toEqual(reference);
    expect(Object.keys(italian).sort()).toEqual(reference);
  });
});
