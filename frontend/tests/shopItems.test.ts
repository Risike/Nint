import { describe, expect, it } from 'vitest';
import { PIECE_SKINS } from '../src/game/rendering/pieceSkins';
import { getNameDecorationLabel, getPieceSkinLabel, getShopItemLabel } from '../src/i18n/shopItems';

const LANGUAGES = ['en', 'fr', 'de', 'es', 'it'] as const;

const COLORS = [
  'default', 'cyan', 'pink', 'gold', 'green',
  'red', 'orange', 'yellow', 'lime', 'emerald',
  'teal', 'sky', 'blue', 'indigo', 'violet',
  'purple', 'fuchsia', 'rose', 'silver', 'lava'
];

const DECORATIONS = [
  'none', 'glow', 'underline', 'brackets', 'sparkle',
  'double_underline', 'overline', 'shadow', 'outline', 'pill',
  'box', 'dots', 'wave', 'angles', 'stars',
  'diamonds', 'arrows', 'brackets_square', 'parentheses', 'highlight'
];

describe('shop item translations', () => {
  it('has 20 piece skins translated into every supported language', () => {
    expect(PIECE_SKINS).toHaveLength(20);
    expect(new Set(PIECE_SKINS).size).toBe(20);
    for (const skin of PIECE_SKINS) {
      for (const language of LANGUAGES) {
        expect(getPieceSkinLabel(skin, language).trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('has 20 color and 20 decoration names translated into every supported language', () => {
    for (const color of COLORS) {
      for (const language of LANGUAGES) {
        expect(getShopItemLabel(`color_${color}`, '', language).trim().length).toBeGreaterThan(0);
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
    expect(getShopItemLabel('color_teal', 'fallback', 'de')).toBe('Petrol');
    expect(getShopItemLabel('decor_square_brackets', 'fallback', 'es')).toBe('Corchetes');
    expect(getShopItemLabel('custom_item', 'Custom label', 'it')).toBe('Custom label');
  });
});
