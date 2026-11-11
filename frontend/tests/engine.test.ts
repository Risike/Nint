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

describe('Line Clear Logic and Timing', () => {
  it('clears full rows after line clear delay', () => {
    const engine = new GameEngine({ lineClearDelay: 240 });
    engine.start();

    // Fill row 39 completely
    for (let c = 0; c < BOARD_WIDTH; c++) {
      engine.board[39][c] = '#ff0000';
    }

    // Place active piece at top away from row 39, then trigger lockPiece
    engine.lockPiece();

    expect(engine.clearingRows).toEqual([39]);
    expect(engine.lineClearTimer).toBe(240);
    expect(engine.activePiece).toBeNull();
    // Row 39 is still on board during flash
    expect(engine.board[39].every(cell => cell !== null)).toBe(true);

    // Update by 100ms
    engine.update(100);
    expect(engine.clearingRows).toEqual([39]);
    expect(engine.lineClearTimer).toBe(140);
    expect(engine.activePiece).toBeNull();

    // Update by 150ms (total 250ms > 240ms)
    engine.update(150);
    expect(engine.clearingRows.length).toBe(0);
    expect(engine.activePiece).not.toBeNull();
    // Row 39 should now be empty (row above collapsed down)
    expect(engine.board[39].every(cell => cell === null)).toBe(true);
  });
});

describe('Multi-line Clear (Tetris & Double)', () => {
  it('clears all 4 lines of a Tetris and shifts upper blocks down properly', () => {
    const engine = new GameEngine();
    engine.start();

    // Fill rows 36, 37, 38, 39 completely
    for (let r = 36; r <= 39; r++) {
      for (let c = 0; c < BOARD_WIDTH; c++) {
        engine.board[r][c] = '#cyan';
      }
    }
    // Put marker blocks on rows 34 and 35
    engine.board[34][2] = '#marker34';
    engine.board[35][4] = '#marker35';

    engine.lockPiece();
    expect(engine.clearingRows).toEqual([36, 37, 38, 39]);

    // Finish animation
    engine.update(300);

    expect(engine.clearingRows.length).toBe(0);
    // Rows 36, 37 should be empty, marker34 moved to row 38, marker35 moved to row 39
    expect(engine.board[39][4]).toBe('#marker35');
    expect(engine.board[38][2]).toBe('#marker34');
    expect(engine.board[34].every(c => c === null)).toBe(true);
    expect(engine.board[35].every(c => c === null)).toBe(true);
  });
});

describe('Level progression and Perfect Clear scoring', () => {
  it('keeps the configured starting level after line clears', () => {
    const engine = new GameEngine({ startingLevel: 15 });
    engine.start();

    for (let c = 0; c < BOARD_WIDTH; c++) {
      engine.board[39][c] = '#ff0000';
    }

    engine.lockPiece();
    engine.update(300);

    expect(engine.level).toBe(15);
    expect(engine.lines).toBe(1);
  });

  it('awards the guideline perfect clear bonus exactly once', () => {
    const engine = new GameEngine({ lineClearDelay: 10 });
    engine.start();

    // Fill row 39 except the four cells the I piece will complete.
    for (let c = 4; c < BOARD_WIDTH; c++) {
      engine.board[39][c] = '#ff0000';
    }
    engine.activePiece = 'I';
    engine.activeRotation = 0;
    engine.activeX = 0;
    engine.activeY = 38;

    engine.lockPiece();

    // Single (100) + perfect clear single (800)
    expect(engine.score).toBe(900);
    expect(engine.clearingRows).toEqual([39]);

    engine.update(50);

    expect(engine.perfectClearsCount).toBe(1);
    // finishLineClear must not add another flat bonus
    expect(engine.score).toBe(900);
  });

  it('computes perfect clear scoring in the scoring system', () => {
    const result = ScoringSystem.evaluateClear({
      linesCleared: 1,
      tSpin: 'none',
      currentLevel: 1,
      isB2BActive: false,
      currentCombo: -1,
      isPerfectClear: true
    });

    expect(result.scoreGained).toBe(900);
    expect(result.garbageSent).toBe(10);
    expect(result.text).toContain('PERFECT CLEAR');
  });
});
