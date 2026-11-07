import { describe, expect, it } from 'vitest';
import { BOARD_BUFFER_HEIGHT, BOARD_TOTAL_HEIGHT, BOARD_WIDTH } from '../src/game/engine/constants';
import { GameEngine } from '../src/game/engine/gameEngine';
import { GarbageManager } from '../src/game/engine/garbage';
import { Randomizer } from '../src/game/engine/randomizer';
import { ScoringSystem } from '../src/game/engine/scoring';
import { TSpinDetector } from '../src/game/engine/tspin';

describe('7-Bag Randomizer', () => {
  it('generates exactly one of each of the 7 tetrominoes in each bag', () => {
    const randomizer = new Randomizer(1337);
    const standardSet = new Set(['I', 'J', 'L', 'O', 'S', 'T', 'Z']);

    // Check first 3 full bags
    for (let bagIndex = 0; bagIndex < 3; bagIndex++) {
      const drawn: string[] = [];
      for (let i = 0; i < 7; i++) {
        drawn.push(randomizer.next());
      }
      expect(new Set(drawn)).toEqual(standardSet);
      expect(drawn.length).toBe(7);
    }
  });

  it('produces deterministic output with seed', () => {
    const rng1 = new Randomizer(4242);
    const rng2 = new Randomizer(4242);

    const seq1 = [rng1.next(), rng1.next(), rng1.next(), rng1.next()];
    const seq2 = [rng2.next(), rng2.next(), rng2.next(), rng2.next()];
    expect(seq1).toEqual(seq2);
  });
});

describe('Movement, SRS Rotation, and Lock Delay', () => {
  it('moves horizontally within playfield boundaries', () => {
    const engine = new GameEngine();
    engine.start();

    const startX = engine.activeX;
    const moved = engine.moveLeft();
    expect(moved).toBe(true);
    expect(engine.activeX).toBe(startX - 1);

    // Repeated moves left to edge
    for (let i = 0; i < 10; i++) {
      engine.moveLeft();
    }
    const leftLimit = engine.activeX;
    expect(engine.moveLeft()).toBe(false);
    expect(engine.activeX).toBe(leftLimit);
  });

  it('performs hard drop, updates score and locks piece', () => {
    const engine = new GameEngine();
    engine.start();
    const initialPlaced = engine.piecesPlaced;

    engine.hardDrop();

    expect(engine.piecesPlaced).toBe(initialPlaced + 1);
    expect(engine.score).toBeGreaterThan(0);
  });

  it('rotates CW and CCW with SRS', () => {
    const engine = new GameEngine();
    engine.start();
    engine.activePiece = 'T';
    engine.activeRotation = 0;

    expect(engine.rotateCW()).toBe(true);
    expect(engine.activeRotation).toBe(1);

    expect(engine.rotateCCW()).toBe(true);
    expect(engine.activeRotation).toBe(0);
  });

  it('swaps piece with hold slot and locks repeated immediate hold', () => {
    const engine = new GameEngine();
    engine.start();
    const firstPiece = engine.activePiece;

    expect(engine.hold()).toBe(true);
    expect(engine.holdPiece).toBe(firstPiece);

    // Immediate second hold should fail
    expect(engine.hold()).toBe(false);
  });
});

describe('T-Spin Detection', () => {
  it('detects a regular T-Spin when 3 corners and 2 front corners are occupied', () => {
    const board: (string | null)[][] = [];
    for (let r = 0; r < BOARD_TOTAL_HEIGHT; r++) {
      board.push(new Array(BOARD_WIDTH).fill(null));
    }

    const tX = 3;
    const tY = 30;

    // Pointing UP (rotation 0). Front corners are TL (3, 30) and TR (5, 30)
    // One back corner BL (3, 32)
    board[30][3] = '#999';
    board[30][5] = '#999';
    board[32][3] = '#999';

    const result = TSpinDetector.checkTSpin(
      board,
      tX,
      tY,
      0,
      true, // lastActionWasRotation
      0     // basic kick
    );

    expect(result).toBe('regular');
  });

  it('detects a mini T-Spin when only 1 front corner is occupied', () => {
    const board: (string | null)[][] = [];
    for (let r = 0; r < BOARD_TOTAL_HEIGHT; r++) {
      board.push(new Array(BOARD_WIDTH).fill(null));
    }

    const tX = 3;
    const tY = 30;

    // Pointing UP (0). 1 front corner TL (3,30), 2 back corners (3,32) and (5,32)
    board[30][3] = '#999';
    board[32][3] = '#999';
    board[32][5] = '#999';

    const result = TSpinDetector.checkTSpin(
      board,
      tX,
      tY,
      0,
      true,
      0
    );

    expect(result).toBe('mini');
  });
});

describe('Scoring & Back-to-Back Chains', () => {
  it('evaluates Tetris with B2B bonus on consecutive difficult clears', () => {
    // 1st Tetris
    const res1 = ScoringSystem.evaluateClear({
      linesCleared: 4,
      tSpin: 'none',
      currentLevel: 1,
      isB2BActive: false,
      currentCombo: -1,
      isPerfectClear: false
    });
    expect(res1.scoreGained).toBe(800);
    expect(res1.garbageSent).toBe(4);
    expect(res1.isB2B).toBe(true);

    // 2nd consecutive Tetris gets B2B bonus (1.5x score, +1 garbage)
    const res2 = ScoringSystem.evaluateClear({
      linesCleared: 4,
      tSpin: 'none',
      currentLevel: 1,
      isB2BActive: true,
      currentCombo: 0,
      isPerfectClear: false
    });
    expect(res2.scoreGained).toBe(1200 + 50); // 800 * 1.5 + combo 1 bonus (50)
    expect(res2.garbageSent).toBe(5); // 4 + 1 B2B
  });
});

describe('Garbage Manager', () => {
  it('queues, cancels and inserts garbage correctly', () => {
    const gm = new GarbageManager();
    gm.enqueueGarbage(4);
    expect(gm.getPendingCount()).toBe(4);

    // Cancel 2 lines of incoming garbage
    const remainingAttack = gm.cancelGarbage(2);
    expect(remainingAttack).toBe(0);
    expect(gm.getPendingCount()).toBe(2);

    // Attack with 5 lines cancels remaining 2 and sends 3 through
    const counterAttack = gm.cancelGarbage(5);
    expect(counterAttack).toBe(3);
    expect(gm.getPendingCount()).toBe(0);
  });
});
