import { describe, expect, it } from 'vitest';
import { PIECE_SKINS } from '../src/game/rendering/pieceSkins';
import { getNameDecorationLabel, getPieceSkinLabel, getShopItemDisplayName, getShopItemLabel } from '../src/i18n/shopItems';
import { FIXED_COLOR_LABELS, GRADIENT_COLOR_LABELS } from '../src/i18n/nameColors';
import { THEME_CATALOG, getThemeLabel } from '../src/i18n/themes';
import { PROFILE_ICONS, getProfileIcon, getProfileIconEmoji, getProfileIconLabel } from '../src/i18n/profileIcons';

const LANGUAGES = ['en', 'fr', 'de', 'es', 'it'] as const;

const COLORS = [
  'default', 'cyan', 'pink', 'gold', 'green',
  'red', 'orange', 'sky', 'violet', 'lime',
  'coral', 'mint', 'teal', 'indigo', 'rose',
  'amber', 'emerald', 'blue', 'magenta', 'silver'
];

const DECORATIONS = [
  'none', 'glow', 'underline', 'brackets', 'sparkle',
  'double_underline', 'overline', 'shadow', 'outline', 'pill',
  'box', 'dots', 'wave', 'angles', 'stars',
  'diamonds', 'arrows', 'brackets_square', 'parentheses', 'highlight',
  'quotes', 'guillemets', 'corner', 'corner_double', 'braces',
  'chevrons_double', 'tildes', 'pipes', 'slashes', 'plus_signs',
  'equals', 'hashes', 'at_sign', 'music', 'hearts',
  'lightning', 'flames', 'flowers', 'moons', 'crystals',
  'target', 'crowns', 'wings', 'ribbon', 'gold_frame',
  'emboss', 'glitch', 'dashed_line', 'orbit', 'terminal'
];

describe('shop item translations', () => {
  it('has 40 piece skins translated into every supported language', () => {
    expect(PIECE_SKINS).toHaveLength(40);
    expect(new Set(PIECE_SKINS).size).toBe(40);
    for (const skin of PIECE_SKINS) {
      for (const language of LANGUAGES) {
        expect(getPieceSkinLabel(skin, language).trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('has 56 profile icons translated into every supported language', () => {
    expect(PROFILE_ICONS).toHaveLength(56);
    expect(new Set(PROFILE_ICONS.map((icon) => icon.key)).size).toBe(56);
    for (const icon of PROFILE_ICONS) {
      expect(icon.emoji.trim().length).toBeGreaterThan(0);
      for (const language of LANGUAGES) {
        expect(getProfileIconLabel(icon.key, language).trim().length).toBeGreaterThan(0);
      }
    }
    expect(getProfileIcon('rocket')).toBe('rocket');
    expect(getProfileIcon('🛸')).toBe('🛸');
    expect(getProfileIconEmoji('rocket')).toBe('🚀');
    expect(getProfileIconEmoji('🛸')).toBe('🛸');
    expect(getProfileIcon('')).toBe('user');
    expect(getProfileIconEmoji(undefined)).toBe('👤');
    expect(getProfileIconEmoji('flag_black')).toBe('🏴');
    expect(getProfileIconEmoji('flag_red')).toBe('🚩');
    expect(getProfileIconEmoji('flag_rainbow')).toBe('🏳️‍🌈');
    expect(getProfileIconEmoji('flag_peace')).toBe('🏳️');
    expect(getProfileIconEmoji('peace_sign')).toBe('☮️');
    expect(getProfileIconEmoji('flag_pirate')).toBe('🏴‍☠️');
  });

  it('has 20 solid, 30 gradient, 40 theme and 50 decoration names translated into every supported language', () => {
    expect(Object.keys(FIXED_COLOR_LABELS)).toHaveLength(20);
    for (const color of COLORS) {
      for (const language of LANGUAGES) {
        expect(getShopItemLabel(`color_${color}`, '', language).trim().length).toBeGreaterThan(0);
      }
    }
    expect(Object.keys(GRADIENT_COLOR_LABELS)).toHaveLength(30);
    for (const gradient of Object.keys(GRADIENT_COLOR_LABELS)) {
      for (const language of LANGUAGES) {
        expect(getShopItemLabel(`color_${gradient}`, '', language).trim().length).toBeGreaterThan(0);
      }
    }
    expect(Object.keys(THEME_CATALOG)).toHaveLength(40);
    for (const theme of Object.keys(THEME_CATALOG)) {
      for (const language of LANGUAGES) {
        expect(getThemeLabel(theme, language).trim().length).toBeGreaterThan(0);
      }
    }
    for (const decoration of DECORATIONS) {
      for (const language of LANGUAGES) {
        expect(getNameDecorationLabel(decoration, language).trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('resolves translated shop ids and keeps custom item fallbacks', () => {
    expect(getShopItemLabel('piece_holographic', 'fallback', 'fr')).toBe('Holographique');
    expect(getShopItemLabel('piece_round_pearl', 'fallback', 'fr')).toBe('Perle');
    expect(getShopItemLabel('color_teal', 'fallback', 'de')).toBe('Petrol');
    expect(getShopItemLabel('decor_square_brackets', 'fallback', 'es')).toBe('Corchetes');
    expect(getShopItemLabel('color_mint', 'fallback', 'fr')).toBe('Menthe');
    expect(getShopItemLabel('color_cyan', 'fallback', 'es')).toBe('Cian');
    expect(getThemeLabel('dark-01', 'fr')).toBe('Sombre — Minuit');
    expect(getThemeLabel('light-20', 'it')).toBe('Chiaro — Porcellana');
    expect(getShopItemLabel('color_grad_rainbow', 'fallback', 'fr')).toBe('Arc-en-ciel');
    expect(getShopItemLabel('decor_gradient_fill', 'fallback', 'fr')).toBe('Cadre doré');
    expect(getShopItemLabel('decor_quotes', 'fallback', 'de')).toBe('Anführungszeichen');
    expect(getShopItemLabel('custom_item', 'Custom label', 'it')).toBe('Custom label');
  });

  it('uses per-language custom names and falls back to English when empty', () => {
    const customItem = {
      id: 'custom_item',
      kind: 'piece_skin',
      name: 'English Name',
      name_fr: 'Nom français',
      name_de: '',
      name_es: '   ',
      name_it: 'Nome italiano',
      value: 'neon',
      is_default: 0
    };

    expect(getShopItemDisplayName(customItem, 'en')).toBe('English Name');
    expect(getShopItemDisplayName(customItem, 'fr')).toBe('Nom français');
    expect(getShopItemDisplayName(customItem, 'de')).toBe('English Name');
    expect(getShopItemDisplayName(customItem, 'es')).toBe('English Name');
    expect(getShopItemDisplayName(customItem, 'it')).toBe('Nome italiano');

    expect(getShopItemDisplayName({
      id: 'title_line_lord',
      kind: 'title',
      name: 'Line Lord',
      name_fr: 'Seigneur des lignes',
      value: 'Line Lord',
      is_default: 1
    }, 'fr')).toBe('Seigneur des lignes');

    expect(getShopItemDisplayName({
      id: 'title_line_lord',
      kind: 'title',
      name: 'Line Lord',
      value: 'Line Lord',
      is_default: 1
    }, 'fr')).toBe('Line Lord');
  });
});
