import { describe, expect, it } from 'vitest';
import { BOARD_TOTAL_HEIGHT, BOARD_WIDTH, PIECES } from '../src/game/engine/constants';
import {
  BLAST_EFFECT_DURATION_MS,
  BLAST_TELEGRAPH_DURATION_MS,
  BOMB_PREFIX,
  MEGA_BOMB_PREFIX,
  bombColor,
  encodeBombCell,
  getBlastDimensions,
  isBombCell,
  isMegaBombCell,
  rotateBombLocal
} from '../src/game/engine/blast';
import { GameEngine } from '../src/game/engine/gameEngine';

function emptyBoard(): (string | null)[][] {
  return Array.from({ length: BOARD_TOTAL_HEIGHT }, () =>
    new Array<string | null>(BOARD_WIDTH).fill(null)
  );
}

describe('Blast cells and explosion table', () => {
  it('encodes normal and mega bombs without losing their colour', () => {
    expect(encodeBombCell('#06b6d4')).toBe(`${BOMB_PREFIX}#06b6d4`);
    expect(encodeBombCell('#f97316', true)).toBe(`${MEGA_BOMB_PREFIX}#f97316`);
    expect(bombColor(encodeBombCell('#22c55e'))).toBe('#22c55e');
    expect(isBombCell(encodeBombCell('#22c55e'))).toBe(true);
    expect(isMegaBombCell(encodeBombCell('#22c55e', true))).toBe(true);
    expect(isBombCell('#22c55e')).toBe(false);
  });

  it('keeps every bomb cell inside the SRS shape for every piece and rotation', () => {
    const types = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'] as const;
    for (const type of types) {
      const shape = PIECES[type].shapes[0];
      for (const bomb of shape) {
        for (let rotation = 0; rotation < 4; rotation += 1) {
          const rotated = rotateBombLocal(type, [bomb], rotation as 0 | 1 | 2 | 3);
          expect(rotated).toHaveLength(1);
          expect(PIECES[type].shapes[rotation as 0 | 1 | 2 | 3]).toContainEqual(rotated[0]);
        }
      }
    }
  });

  it('keeps the bomb on the same mino through SRS rotations', () => {
    const rotated = rotateBombLocal('T', [{ x: 1, y: 0 }], 1);
    expect(rotated).toEqual([{ x: 2, y: 1 }]);
  });

  it('rotates an O bomb around the four cells of the square', () => {
    const bomb = [{ x: 1, y: 0 }];
    expect(rotateBombLocal('O', bomb, 1)).toEqual([{ x: 2, y: 0 }]);
    expect(rotateBombLocal('O', bomb, 2)).toEqual([{ x: 2, y: 1 }]);
    expect(rotateBombLocal('O', bomb, 3)).toEqual([{ x: 1, y: 1 }]);
  });

  it('shows the exact bombs that the upcoming pieces will spawn with', () => {
    const engine = new GameEngine({ blast: true, blastMode: 'training', seed: 42 });
    const preview = engine.getBlastBombPreview(4);

    engine.start();
    expect(engine.activeBombLocal).toEqual(preview[0]);
    expect(engine.getBlastBombPreview(3)).toEqual(preview.slice(1));

    const firstPiece = engine.activePiece;
    const firstBombs = engine.activeBombLocal;
    engine.hold();
    expect(engine.holdPiece).toBe(firstPiece);
    expect(engine.holdBombs).toEqual(firstBombs);
    expect(engine.activeBombLocal).toEqual(preview[1]);

    const secondBombs = engine.activeBombLocal;
    engine.canHold = true;
    engine.hold();
    expect(engine.activeBombLocal).toEqual(firstBombs);
    expect(engine.holdBombs).toEqual(secondBombs);
  });

  it('turns four bombs in a square into one mega bomb', () => {
    const engine = new GameEngine({ blast: true, blastMode: 'training', seed: 7 });
    engine.start();
    engine.board[39].fill('#ef4444');
    for (const cell of [[4, 38], [5, 38], [4, 39], [5, 39]] as const) {
      engine.board[cell[1]][cell[0]] = encodeBombCell('#ef4444');
    }

    engine.activePiece = 'O';
    engine.activeRotation = 0;
    engine.activeX = 0;
    engine.activeY = 20;
    engine.activeBombLocal = [];
    engine.lockPiece();

    for (const cell of [[4, 38], [5, 38], [4, 39], [5, 39]] as const) {
      expect(isMegaBombCell(engine.board[cell[1]][cell[0]])).toBe(true);
    }

    engine.update(BLAST_TELEGRAPH_DURATION_MS + 1);
    expect(engine.blastEffects).toHaveLength(1);
    expect(engine.blastEffects[0]).toMatchObject({ mega: true, width: 10, height: 10 });
  });

  it('follows the 7x1 to 15x15 blast growth table', () => {
    expect(getBlastDimensions(1)).toEqual({ width: 7, height: 1 });
    expect(getBlastDimensions(2)).toEqual({ width: 7, height: 3 });
    expect(getBlastDimensions(4)).toEqual({ width: 7, height: 7 });
    expect(getBlastDimensions(5)).toEqual({ width: 9, height: 9 });
    expect(getBlastDimensions(6)).toEqual({ width: 11, height: 11 });
    expect(getBlastDimensions(10)).toEqual({ width: 15, height: 15 });
    expect(getBlastDimensions(1, true)).toEqual({ width: 10, height: 10 });
  });
});

describe('Blast lock rules', () => {
  it('does not clear a full row when it contains no bomb', () => {
    const engine = new GameEngine({ blast: true, blastMode: 'training', seed: 1 });
    engine.start();
    engine.board[39].fill('#ef4444');

    engine.activePiece = 'O';
    engine.activeRotation = 0;
    engine.activeX = 3;
    engine.activeY = 20;
    engine.activeBombLocal = [];

    engine.lockPiece();

    expect(engine.clearingRows).toEqual([]);
    expect(engine.board[39].every(cell => cell !== null)).toBe(true);
    expect(engine.blastLastChain).toBe(0);
    expect(engine.activePiece).not.toBeNull();
  });

  it('detonates bombs in completed rows and removes their blast area', () => {
    const engine = new GameEngine({ blast: true, blastMode: 'training', seed: 2 });
    engine.start();

    engine.board[39].fill('#ef4444');
    engine.activePiece = 'I';
    engine.activeRotation = 0;
    engine.activeX = 3;
    engine.activeY = 38;
    engine.activeBombLocal = [{ x: 0, y: 1 }];

    engine.lockPiece();

    expect(engine.blastTelegraphTimer).toBe(BLAST_TELEGRAPH_DURATION_MS);
    expect(engine.blastTelegraphCells).toHaveLength(7);
    expect(engine.board[39].every(cell => cell !== null)).toBe(true);
    expect(engine.blastLastChain).toBe(0);

    engine.update(BLAST_TELEGRAPH_DURATION_MS + 1);
    expect(engine.blastLastChain).toBe(1);
    expect(engine.blastEffects).toHaveLength(1);
    expect(engine.blastEffects[0]).toMatchObject({ width: 7, height: 1 });
    expect(engine.blastEffects[0].cells).toHaveLength(7);
    expect(engine.blastBlocksDestroyed).toBe(7);
    expect(engine.score).toBeGreaterThan(0);
    expect(engine.activePiece).toBeNull();
    expect(engine.blastExplosionTimer).toBeGreaterThan(0);

    engine.update(BLAST_EFFECT_DURATION_MS + 1);
    expect(engine.blastExplosionTimer).toBe(0);
    expect(engine.activePiece).not.toBeNull();
  });

  it('spends Contest pieces and advances the stage when the board is emptied', () => {
    const engine = new GameEngine({ blast: true, blastMode: 'contest', seed: 3 });
    engine.start();
    expect(engine.blastPiecesLeft).toBe(100);
    expect(engine.blastStage).toBe(1);

    for (let row = 34; row <= 39; row += 1) {
      engine.board[row].fill('#ef4444');
    }
    engine.activePiece = 'I';
    engine.activeRotation = 0;
    engine.activeX = 5;
    engine.activeY = 38;
    engine.activeBombLocal = [{ x: 0, y: 1 }];

    engine.lockPiece();
    expect(engine.blastPiecesLeft).toBe(100);

    engine.update(BLAST_TELEGRAPH_DURATION_MS + 1);
    expect(engine.blastPiecesLeft).toBe(99);

    engine.update(BLAST_EFFECT_DURATION_MS + 1);

    expect(engine.blastStage).toBe(2);
    expect(engine.blastPiecesLeft).toBe(100);
    expect(engine.activePiece).not.toBeNull();
    expect(engine.board[BOARD_TOTAL_HEIGHT - 1].some(cell => cell !== null)).toBe(true);
  });

  it('damages the Fight enemy with the explosion', () => {
    const engine = new GameEngine({ blast: true, blastMode: 'fight', seed: 4 });
    engine.start();
    const initialHp = engine.blastEnemyHp;
    expect(initialHp).toBeGreaterThan(0);

    engine.board = emptyBoard();
    engine.board[39].fill('#ef4444');
    engine.activePiece = 'I';
    engine.activeRotation = 0;
    engine.activeX = 3;
    engine.activeY = 38;
    engine.activeBombLocal = [{ x: 0, y: 1 }];

    engine.lockPiece();
    engine.update(BLAST_TELEGRAPH_DURATION_MS + 1);

    expect(engine.blastEnemyHp).toBeLessThan(initialHp);
    expect(engine.blastEffects.length).toBeGreaterThan(0);
  });
});
