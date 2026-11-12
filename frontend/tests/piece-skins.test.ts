import { describe, expect, it } from 'vitest';
import { PIECE_SKINS, isRoundPieceSkin, normalizePieceSkin } from '../src/game/rendering/pieceSkins';

describe('piece skin shapes', () => {
  it('only marks round_* skins as round', () => {
    for (const skin of PIECE_SKINS) {
      expect(isRoundPieceSkin(skin)).toBe(skin.startsWith('round_'));
    }
  });

  it('keeps unknown and square skins rectangular', () => {
    expect(isRoundPieceSkin('classic')).toBe(false);
    expect(isRoundPieceSkin('neon')).toBe(false);
    expect(isRoundPieceSkin('not-a-skin')).toBe(false);
    expect(normalizePieceSkin('round_planet')).toBe('round_planet');
  });
});
