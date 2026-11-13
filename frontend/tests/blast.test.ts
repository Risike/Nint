import { describe, expect, it } from 'vitest';
import { BOARD_TOTAL_HEIGHT, BOARD_WIDTH, PIECES } from '../src/game/engine/constants';
import {
  BLAST_CONTEST_LAYOUTS,
  BLAST_CRUSH_DAMAGE,
  BLAST_EFFECT_DURATION_MS,
  BLAST_ENEMY_HEAL,
  BLAST_FIGHT_ENEMIES,
  BLAST_FIGHT_LAYOUTS,
  BLAST_TELEGRAPH_DURATION_MS,
  BOMB_PREFIX,
  MEGA_BOMB_PREFIX,
  bombColor,
  encodeBombCell,
  getBlastDimensions,
  getBlastEnemyDamage,
  isBombCell,
  isMegaBombCell,
  rotateBombLocal
} from '../src/game/engine/blast';
import { GameEngine } from '../src/game/engine/gameEngine';
import {
  clampBlastRound,
  getUnlockedBlastRound,
  getUnlockedBlastStage,
  unlockBlastRoundAfterClear,
  unlockBlastStageAfterClear
} from '../src/game/blastProgress';

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

  it('fuses four bombs after the field settles, not before the explosion', () => {
    const engine = new GameEngine({ blast: true, blastMode: 'training', seed: 7 });
    engine.start();
    for (const cell of [[4, 37], [5, 37], [4, 38], [5, 38]] as const) {
      engine.board[cell[1]][cell[0]] = encodeBombCell('#ef4444');
    }

    engine.activePiece = 'O';
    engine.activeRotation = 0;
    engine.activeX = 0;
    engine.activeY = 20;
    engine.activeBombLocal = [];
    engine.lockPiece();

    for (const cell of [[4, 37], [5, 37], [4, 38], [5, 38]] as const) {
      expect(isMegaBombCell(engine.board[cell[1]][cell[0]])).toBe(true);
    }
  });

  it('gives the mega bomb its fixed 10x8 blast', () => {
    const engine = new GameEngine({ blast: true, blastMode: 'training', seed: 7 });
    engine.start();
    engine.board[39].fill('#ef4444');
    for (const cell of [[4, 38], [5, 38], [4, 39], [5, 39]] as const) {
      engine.board[cell[1]][cell[0]] = encodeBombCell('#ef4444', true);
    }

    engine.activePiece = 'I';
    engine.activeRotation = 0;
    engine.activeX = 3;
    engine.activeY = 20;
    engine.activeBombLocal = [];
    engine.lockPiece();
    engine.update(BLAST_TELEGRAPH_DURATION_MS + 1);

    const megaEffect = engine.blastEffects.find(effect => effect.mega);
    expect(megaEffect).toMatchObject({ width: 10, height: 8 });
  });

  it('scales Fight damage with cleared rows and chains', () => {
    expect(getBlastEnemyDamage(1, 1)).toBe(68);
    expect(getBlastEnemyDamage(2, 1)).toBe(96);
    expect(getBlastEnemyDamage(4, 1)).toBe(152);
    expect(getBlastEnemyDamage(4, 3)).toBe(228);
    expect(getBlastEnemyDamage(4, 3)).toBeGreaterThan(getBlastEnemyDamage(4, 1));
  });

  it('follows the 7x1 to 15x15 blast growth table', () => {
    expect(getBlastDimensions(1)).toEqual({ width: 7, height: 1 });
    expect(getBlastDimensions(2)).toEqual({ width: 7, height: 3 });
    expect(getBlastDimensions(4)).toEqual({ width: 7, height: 7 });
    expect(getBlastDimensions(5)).toEqual({ width: 9, height: 9 });
    expect(getBlastDimensions(6)).toEqual({ width: 11, height: 11 });
    expect(getBlastDimensions(10)).toEqual({ width: 15, height: 15 });
    expect(getBlastDimensions(1, true)).toEqual({ width: 10, height: 8 });
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
    expect(engine.blastTelegraphRows).toEqual([39]);
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

  it('detonates a bomb reached by another explosion even outside a completed row', () => {
    const engine = new GameEngine({ blast: true, blastMode: 'training', seed: 8 });
    engine.start();
    engine.board[38].fill('#ef4444');
    engine.board[39].fill('#ef4444');
    engine.board[38][4] = encodeBombCell('#ef4444');
    engine.board[37][4] = encodeBombCell('#06b6d4');

    engine.activePiece = 'O';
    engine.activeRotation = 0;
    engine.activeX = 0;
    engine.activeY = 20;
    engine.activeBombLocal = [];
    engine.lockPiece();
    engine.update(BLAST_TELEGRAPH_DURATION_MS + 1);

    expect(engine.blastEffects).toHaveLength(2);
    expect(engine.blastEffects.every(effect => effect.height === 3)).toBe(true);
  });

  it('drops connected blocks as one sticky group', () => {
    const engine = new GameEngine({ blast: true, blastMode: 'training', seed: 9 });
    engine.start();
    engine.board[39][0] = '#ef4444';
    engine.board[37][0] = '#06b6d4';
    engine.board[36][0] = '#06b6d4';
    engine.board[36][1] = '#06b6d4';

    (engine as unknown as { applyBlastGravity: () => void }).applyBlastGravity();

    expect(engine.board[38][0]).toBe('#06b6d4');
    expect(engine.board[37][0]).toBe('#06b6d4');
    expect(engine.board[37][1]).toBe('#06b6d4');
    expect(engine.board[36][1]).toBeNull();
  });

  it('keeps falling segments independent when they pass beside a supported one', () => {
    const engine = new GameEngine({ blast: true, blastMode: 'training', seed: 10 });
    engine.start();
    // A supported two-cell column on the left...
    engine.board[39][0] = '#ef4444';
    engine.board[38][0] = '#ef4444';
    // ...and a separate single block that should fall all the way beside it.
    engine.board[20][1] = '#06b6d4';

    (engine as unknown as { applyBlastGravity: () => void }).applyBlastGravity();

    expect(engine.board[39][1]).toBe('#06b6d4');
    expect(engine.board[38][1]).toBeNull();
  });

  it('spends Contest pieces and waits for validation before the next stage', () => {
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

    expect(engine.blastStage).toBe(1);
    expect(engine.blastIntermission).toEqual({ kind: 'stage', current: 1, next: 2 });
    expect(engine.activePiece).toBeNull();

    engine.update(5000);
    expect(engine.blastStage).toBe(1);
    expect(engine.activePiece).toBeNull();

    expect(engine.continueBlast()).toBe(true);
    expect(engine.blastStage).toBe(2);
    expect(engine.blastPiecesLeft).toBe(100);
    expect(engine.activePiece).not.toBeNull();
    expect(engine.board[BOARD_TOTAL_HEIGHT - 1].some(cell => cell !== null)).toBe(true);
  });

  it('damages the Fight enemy with the explosion', () => {
    const engine = new GameEngine({ blast: true, blastMode: 'fight', seed: 4 });
    engine.setupBlastStage();
    engine.start();
    const initialHp = engine.blastEnemyHp;
    expect(initialHp).toBeGreaterThan(0);

    engine.board = emptyBoard();
    engine.blastEnemy!.x = 1;
    engine.blastEnemy!.y = 19;
    engine.board[39].fill('#ef4444');
    engine.activePiece = 'I';
    engine.activeRotation = 0;
    engine.activeX = 3;
    engine.activeY = 38;
    engine.activeBombLocal = [{ x: 0, y: 1 }];

    engine.lockPiece();
    engine.update(BLAST_TELEGRAPH_DURATION_MS + 1);

    expect(engine.blastEnemyHp).toBe(initialHp - getBlastEnemyDamage(1, 1));
    expect(engine.blastEffects.length).toBeGreaterThan(0);
  });

  it('does not damage the enemy when the explosion misses it', () => {
    const engine = new GameEngine({ blast: true, blastMode: 'fight', seed: 6 });
    engine.setupBlastStage();
    engine.start();
    engine.board = emptyBoard();
    engine.blastEnemy!.x = 0;
    engine.blastEnemy!.y = 0;
    engine.board[39].fill('#ef4444');
    engine.activePiece = 'I';
    engine.activeRotation = 0;
    engine.activeX = 3;
    engine.activeY = 38;
    engine.activeBombLocal = [{ x: 0, y: 1 }];

    engine.lockPiece();
    engine.update(BLAST_TELEGRAPH_DURATION_MS + 1);

    expect(engine.blastEnemyHp).toBe(engine.blastEnemyMaxHp);
  });

  it('damages the Fight enemy when a piece is locked on its cell', () => {
    const engine = new GameEngine({ blast: true, blastMode: 'fight', seed: 10 });
    engine.setupBlastStage();
    engine.start();
    engine.board = emptyBoard();
    engine.blastEnemyHp = 100;
    engine.blastEnemy!.x = 5;
    engine.blastEnemy!.y = 19;

    const actions: string[] = [];
    engine.events.onBlastEnemyAction = (action) => actions.push(`${action.type}:${action.amount}`);
    engine.activePiece = 'O';
    engine.activeRotation = 0;
    engine.activeX = 3;
    engine.activeY = 38;
    engine.activeBombLocal = [];

    engine.lockPiece();

    expect(engine.blastEnemyHp).toBe(100 - BLAST_CRUSH_DAMAGE);
    expect(engine.blastEnemy!.y).toBeLessThan(19);
    expect(engine.blastEnemy!.stunTimer).toBeGreaterThan(0);
    expect(actions).toContain(`damage:${BLAST_CRUSH_DAMAGE}`);
  });

  it('cannot defeat the enemy by crushing it', () => {
    const engine = new GameEngine({ blast: true, blastMode: 'fight', seed: 11 });
    engine.setupBlastStage();
    engine.start();
    engine.board = emptyBoard();
    engine.blastEnemyHp = 1;
    engine.blastEnemy!.x = 5;
    engine.blastEnemy!.y = 19;
    engine.activePiece = 'O';
    engine.activeRotation = 0;
    engine.activeX = 3;
    engine.activeY = 38;
    engine.activeBombLocal = [];

    engine.lockPiece();

    expect(engine.blastEnemyHp).toBe(1);
    expect(engine.blastIntermission).toBeNull();
  });

  it('does not crush Gloop', () => {
    const engine = new GameEngine({ blast: true, blastMode: 'fight', blastRound: 3, seed: 12 });
    engine.setupBlastStage();
    engine.start();
    engine.board = emptyBoard();
    const initialHp = engine.blastEnemyHp;
    engine.blastEnemy!.x = 5;
    engine.blastEnemy!.y = 19;
    engine.activePiece = 'O';
    engine.activeRotation = 0;
    engine.activeX = 3;
    engine.activeY = 38;
    engine.activeBombLocal = [];

    engine.lockPiece();

    expect(engine.blastEnemyHp).toBe(initialHp);
    expect(engine.blastEnemy!.y).toBe(19);
  });

  it('does not end the round on an empty board while the enemy still has HP', () => {
    const engine = new GameEngine({ blast: true, blastMode: 'fight', seed: 7 });
    engine.setupBlastStage();
    engine.start();
    engine.blastEnemyHp = 200;
    engine.board = emptyBoard();
    engine.activePiece = 'O';
    engine.activeRotation = 0;
    engine.activeX = 3;
    engine.activeY = 38;
    engine.activeBombLocal = [];

    engine.lockPiece();

    expect(engine.blastEnemyHp).toBe(200);
    expect(engine.blastIntermission).toBeNull();
  });

  it('lets development defeat the current Fight enemy instantly', () => {
    const engine = new GameEngine({ blast: true, blastMode: 'fight', seed: 4 });
    engine.setupBlastStage();
    engine.start();

    expect(engine.debugDefeatBlastEnemy()).toBe(true);
    expect(engine.blastEnemyHp).toBe(0);
    expect(engine.blastIntermission).toEqual({
      kind: 'enemy',
      current: 1,
      next: 2
    });

    const training = new GameEngine({ blast: true, blastMode: 'training', seed: 4 });
    training.start();
    expect(training.debugDefeatBlastEnemy()).toBe(false);
  });

  it('waits for validation before the next Fight round', () => {
    const engine = new GameEngine({ blast: true, blastMode: 'fight', seed: 5 });
    engine.setupBlastStage();
    engine.start();
    engine.blastEnemyHp = 1;
    engine.blastEnemy!.x = 1;
    engine.blastEnemy!.y = 19;
    engine.board = emptyBoard();
    engine.board[39].fill('#ef4444');
    engine.activePiece = 'I';
    engine.activeRotation = 0;
    engine.activeX = 3;
    engine.activeY = 38;
    engine.activeBombLocal = [{ x: 0, y: 1 }];

    engine.lockPiece();
    engine.update(BLAST_TELEGRAPH_DURATION_MS + 1);
    engine.update(BLAST_EFFECT_DURATION_MS + 1);

    expect(engine.blastRound).toBe(1);
    expect(engine.blastIntermission).toEqual({ kind: 'enemy', current: 1, next: 2 });

    expect(engine.continueBlast()).toBe(true);
    expect(engine.blastRound).toBe(2);
    expect(engine.blastEnemyHp).toBeGreaterThan(0);
    expect(engine.activePiece).not.toBeNull();
  });
});

describe('Blast adventure layouts', () => {
  it('uses 50 distinct Game Boy stage layouts with pre-placed bombs', () => {
    expect(BLAST_CONTEST_LAYOUTS).toHaveLength(50);
    expect(new Set(BLAST_CONTEST_LAYOUTS.map(rows => rows.join('/'))).size).toBe(50);
    expect(
      BLAST_CONTEST_LAYOUTS.every(rows =>
        rows.length === 17 && rows.every(row => row.length === BOARD_WIDTH)
      )
    ).toBe(true);
    expect(BLAST_CONTEST_LAYOUTS[0].join('')).toContain('B');
    expect(BLAST_CONTEST_LAYOUTS[49].join('')).toContain('#');
  });

  it('fuses pre-placed 2x2 bomb groups when the stage starts', () => {
    const engine = new GameEngine({
      blast: true,
      blastMode: 'contest',
      blastStage: 2,
      seed: 1
    });
    engine.setupBlastStage();

    expect(engine.board.flat().filter(isMegaBombCell)).toHaveLength(4);
  });
});

describe('Blast Fight opponents', () => {
  it('uses the eight original opponents and their starting fortresses', () => {
    expect(BLAST_FIGHT_ENEMIES[7].ability).toBe(
      'Explodes a 7x1 strip around itself when it attacks.'
    );
    expect(BLAST_FIGHT_ENEMIES.map(enemy => enemy.name)).toEqual([
      'Cubit',
      'Snaptor',
      'Gloop',
      'Creepa',
      'Squidly',
      'Dug Grub',
      'Shadow',
      'B-Boy'
    ]);
    expect(BLAST_FIGHT_LAYOUTS).toHaveLength(8);
    expect(new Set(BLAST_FIGHT_LAYOUTS.map(rows => rows.join('/'))).size).toBe(8);
    expect(
      BLAST_FIGHT_LAYOUTS.every(rows =>
        rows.length === 17 && rows.every(row => row.length === BOARD_WIDTH)
      )
    ).toBe(true);

    const engine = new GameEngine({ blast: true, blastMode: 'fight', blastRound: 8, seed: 1 });
    engine.setupBlastStage();
    expect(engine.blastEnemyMaxHp).toBe(680);
    expect(engine.board[BOARD_TOTAL_HEIGHT - 1].some(cell => cell !== null)).toBe(true);
  });

  it('never lets an enemy block complete a line', () => {
    const engine = new GameEngine({ blast: true, blastMode: 'fight', seed: 13 });
    engine.setupBlastStage();
    engine.start();
    engine.board = emptyBoard();
    for (let column = 0; column < BOARD_WIDTH; column += 1) {
      if (column !== 5) engine.board[39][column] = '#ef4444';
    }
    engine.blastEnemy!.x = 5;
    engine.blastEnemy!.y = 19;
    engine.blastEnemy!.abilityTimer = 1;

    engine.update(1);

    expect(engine.board[39].every(cell => cell !== null)).toBe(false);
    expect(engine.board[39][5]).toBeNull();
  });

  it('moves the opponent and triggers its ability', () => {
    const engine = new GameEngine({ blast: true, blastMode: 'fight', seed: 2 });
    engine.setupBlastStage();
    engine.start();
    expect(engine.blastEnemy?.name).toBe('Cubit');
    expect(engine.blastEnemy?.x).toBe(5);

    const actions: string[] = [];
    engine.events.onBlastEnemyAction = (action) => actions.push(`${action.type}:${action.amount}`);
    const blocksBefore = engine.board.flat().filter(cell => cell !== null).length;
    engine.blastEnemy!.abilityTimer = 1;
    engine.update(1);
    expect(engine.board.flat().filter(cell => cell !== null).length).toBeGreaterThan(blocksBefore);
    expect(actions.some(action => action.startsWith('attack:'))).toBe(true);

    engine.blastEnemyHp = 100;
    engine.blastEnemy!.abilityTimer = 1;
    engine.update(1);
    expect(engine.blastEnemyHp).toBe(100 + BLAST_ENEMY_HEAL);

    const oldX = engine.blastEnemy!.x;
    engine.blastEnemy!.moveTimer = 1;
    engine.update(1);
    expect(engine.blastEnemy!.x).not.toBe(oldX);
  });

  it('freezes controls without inverting them when Shadow attacks', () => {
    expect(BLAST_FIGHT_ENEMIES[6].ability).toBe('Freezes your controls for a few seconds.');

    const engine = new GameEngine({ blast: true, blastMode: 'fight', blastRound: 7, seed: 21 });
    engine.setupBlastStage();
    engine.start();
    expect(engine.blastEnemy?.name).toBe('Shadow');

    const startX = engine.activeX;
    engine.blastEnemy!.abilityTimer = 1;
    engine.update(1);

    expect(engine.blastControlFreeze).toBe(1900);
    expect(engine.horizontalInverted).toBe(false);
    expect(engine.moveLeft()).toBe(false);
    expect(engine.moveRight()).toBe(false);
    expect(engine.activeX).toBe(startX);

    engine.update(1900);
    expect(engine.blastControlFreeze).toBe(0);
    expect(engine.moveLeft()).toBe(true);
  });

  it('runs every opponent ability without breaking the round', () => {
    for (let round = 1; round <= 8; round += 1) {
      const engine = new GameEngine({ blast: true, blastMode: 'fight', blastRound: round, seed: round });
      engine.setupBlastStage();
      engine.start();
      engine.blastEnemy!.abilityTimer = 1;
      expect(() => engine.update(1)).not.toThrow();
      expect(engine.blastEnemy).not.toBeNull();
    }
  });

  it('takes damage and is stunned by explosions', () => {
    const engine = new GameEngine({ blast: true, blastMode: 'fight', seed: 3 });
    engine.setupBlastStage();
    expect(engine.blastEnemyHp).toBe(260);

    const actions: string[] = [];
    engine.events.onBlastEnemyAction = (action) => actions.push(`${action.type}:${action.amount}`);
    (engine as unknown as { damageBlastEnemy: (amount: number) => void }).damageBlastEnemy(100);
    expect(engine.blastEnemyHp).toBe(160);
    expect(engine.blastEnemy!.stunTimer).toBeGreaterThan(0);
    expect(actions).toEqual(['damage:100']);
  });
});

describe('Blast progression', () => {
  it('unlocks Fight rounds in order and never skips ahead', () => {
    const values = new Map<string, string>();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key)
      }
    });

    try {
      expect(getUnlockedBlastRound('fight-progress-test')).toBe(1);
      expect(unlockBlastRoundAfterClear(1, 'fight-progress-test')).toBe(2);
      expect(unlockBlastRoundAfterClear(3, 'fight-progress-test')).toBe(2);
      expect(unlockBlastRoundAfterClear(2, 'fight-progress-test')).toBe(3);
      expect(clampBlastRound(99)).toBe(8);
    } finally {
      Reflect.deleteProperty(globalThis, 'localStorage');
    }
  });

  it('unlocks stages in order and never skips ahead', () => {
    const values = new Map<string, string>();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key)
      }
    });

    try {
      expect(getUnlockedBlastStage('progress-test')).toBe(1);
      expect(unlockBlastStageAfterClear(1, 'progress-test')).toBe(2);
      expect(unlockBlastStageAfterClear(3, 'progress-test')).toBe(2);
      expect(unlockBlastStageAfterClear(2, 'progress-test')).toBe(3);
    } finally {
      Reflect.deleteProperty(globalThis, 'localStorage');
    }
  });
});
