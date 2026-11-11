import {
  BOARD_BUFFER_HEIGHT,
  BOARD_TOTAL_HEIGHT,
  BOARD_VISIBLE_HEIGHT,
  BOARD_WIDTH,
  DEFAULT_TIMING,
  PIECES,
  Point,
  RotationState,
  SCORING,
  TetrominoType
} from './constants';
import { GarbageManager } from './garbage';
import { Randomizer } from './randomizer';
import { ClearResult, ScoringSystem } from './scoring';
import { SRS } from './srs';
import { TSpinDetector, TSpinType } from './tspin';

export interface GameEngineOptions {
  seed?: number;
  das?: number;
  arr?: number;
  lockDelay?: number;
  maxLockResets?: number;
  softDropFactor?: number;
  startingLevel?: number;
  gravityCurve?: (level: number) => number; // ms per drop step
  fixedGravity?: boolean; // If true, dropInterval does not increase on level-up
  immortal?: boolean; // Zen mode: soft reset board on top-out instead of stopping
  startingGarbageLines?: number; // Pre-fill with downstack practice lines
  enableGarbage?: boolean;
  lineClearDelay?: number; // Duration of line clear flash in ms (default 240ms)
}

export type GameState = 'ready' | 'playing' | 'paused' | 'gameover' | 'completed';

export interface GameEvents {
  onStateChange?: (state: GameState) => void;
  onPieceSpawn?: (piece: TetrominoType) => void;
  onPieceMove?: () => void;
  onPieceRotate?: () => void;
  onPieceLock?: () => void;
  onLineClear?: (result: ClearResult) => void;
  onLineClearFinish?: (clearedRows: number[]) => void;
  onPerfectClear?: () => void;
  onGarbageSent?: (amount: number) => void;
  onGarbageReceived?: (amount: number) => void;
  onGameOver?: (reason: string) => void;
  onScoreUpdate?: (score: number, lines: number, level: number) => void;
}

export class GameEngine {
  public board: (string | null)[][];
  public activePiece: TetrominoType | null = null;
  public activeX: number = 0;
  public activeY: number = 0;
  public activeRotation: RotationState = 0;
  public holdPiece: TetrominoType | null = null;
  public canHold: boolean = true;

  public state: GameState = 'ready';
  public score: number = 0;
  public lines: number = 0;
  public level: number = 1;
  public startingLevel: number = 1;
  public piecesPlaced: number = 0;
  public tetrisesCount: number = 0;
  public tSpinsCount: number = 0;
  public perfectClearsCount: number = 0;
  public maxCombo: number = 0;
  public maxB2B: number = 0;
  public b2bChain: number = 0;

  public b2bActive: boolean = false;
  public comboCount: number = -1;

  public randomizer: Randomizer;
  public garbageManager: GarbageManager;

  // Timings & Physics
  public das: number;
  public arr: number;
  public lockDelay: number;
  public maxLockResets: number;
  public softDropFactor: number;
  public fixedGravity: boolean = false;
  public immortal: boolean = false;
  public lineClearDelay: number = 240;
  public clearingRows: number[] = [];
  public lineClearTimer: number = 0;
  private gravityCurve: (level: number) => number;

  private dropInterval: number = 1000;
  private dropTimer: number = 0;
  private lockTimer: number = 0;
  private isLocking: boolean = false;
  private lockResets: number = 0;
  private lowestY: number = 0;

  private lastActionWasRotation: boolean = false;
  private lastKickIndex: number = 0;

  public startTime: number = 0;
  public endTime: number = 0;
  public totalPlayTimeMs: number = 0;

  public events: GameEvents = {};

  constructor(options: GameEngineOptions = {}, events: GameEvents = {}) {
    this.randomizer = new Randomizer(options.seed);
    this.garbageManager = new GarbageManager();
    this.events = events;

    this.das = options.das ?? DEFAULT_TIMING.DAS;
    this.arr = options.arr ?? DEFAULT_TIMING.ARR;
    this.lockDelay = options.lockDelay ?? DEFAULT_TIMING.LOCK_DELAY;
    this.maxLockResets = options.maxLockResets ?? DEFAULT_TIMING.MAX_LOCK_RESETS;
    this.softDropFactor = Math.max(1, options.softDropFactor ?? DEFAULT_TIMING.SOFT_DROP_FACTOR);
    this.startingLevel = Math.max(1, options.startingLevel ?? 1);
    this.level = this.startingLevel;
    this.fixedGravity = Boolean(options.fixedGravity);
    this.immortal = Boolean(options.immortal);
    this.lineClearDelay = options.lineClearDelay ?? DEFAULT_TIMING.LINE_CLEAR_DELAY;

    this.gravityCurve = options.gravityCurve ?? GameEngine.defaultGravityCurve;
    this.dropInterval = this.gravityCurve(this.level);

    this.board = this.createEmptyBoard();

    if (options.startingGarbageLines && options.startingGarbageLines > 0) {
      this.populateStartingGarbage(options.startingGarbageLines);
    }
  }

  public populateStartingGarbage(linesCount: number) {
    const count = Math.min(18, Math.max(1, linesCount));
    for (let i = 0; i < count; i++) {
      const rowIndex = BOARD_TOTAL_HEIGHT - 1 - i;
      const hole = Math.floor(Math.random() * BOARD_WIDTH);
      const row = new Array(BOARD_WIDTH).fill('#64748b');
      row[hole] = null;
      this.board[rowIndex] = row;
    }
  }

  public static defaultGravityCurve(level: number): number {
    // Guideline approximation formula: (0.8 - ((level - 1) * 0.007))^(level - 1) seconds
    const seconds = Math.pow(0.8 - ((level - 1) * 0.007), level - 1);
    return Math.max(16.67, Math.floor(seconds * 1000));
  }

  public createEmptyBoard(): (string | null)[][] {
    const b: (string | null)[][] = [];
    for (let r = 0; r < BOARD_TOTAL_HEIGHT; r++) {
      b.push(new Array(BOARD_WIDTH).fill(null));
    }
    return b;
  }

  public start() {
    this.state = 'playing';
    this.startTime = Date.now();
    this.spawnPiece();
    this.events.onStateChange?.(this.state);
  }

  public pause() {
    if (this.state === 'playing') {
      this.state = 'paused';
      this.events.onStateChange?.(this.state);
    }
  }

  public resume() {
    if (this.state === 'paused') {
      this.state = 'playing';
      this.events.onStateChange?.(this.state);
    }
  }

  public spawnPiece(pieceType?: TetrominoType) {
    const nextType = pieceType || this.randomizer.next();
    this.activePiece = nextType;
    this.activeRotation = 0;

    const def = PIECES[nextType];
    this.activeX = def.spawnOffset.x;
    this.activeY = def.spawnOffset.y;
    this.lockResets = 0;
    this.isLocking = false;
    this.lockTimer = 0;
    this.dropTimer = 0;
    this.lastActionWasRotation = false;
    this.lastKickIndex = 0;

    // Check for block out at the Guideline generation position.
    if (!this.isValidPosition(this.activePiece, this.activeRotation, this.activeX, this.activeY)) {
      this.gameOver('block_out');
      return;
    }

    // The Guideline immediately drops the new Tetrimino one row when the
    // path below its generation position is clear. Keeping the generation
    // row separate also preserves the "peeking" behaviour when the skyline
    // is blocked, instead of declaring a block out too early.
    if (this.isValidPosition(this.activePiece, this.activeRotation, this.activeX, this.activeY + 1)) {
      this.activeY++;
    }
    this.lowestY = this.activeY;

    this.events.onPieceSpawn?.(this.activePiece);
  }

  public getActiveBlocks(
    type = this.activePiece,
    rotation = this.activeRotation,
    offsetX = this.activeX,
    offsetY = this.activeY
  ): Point[] {
    if (!type) return [];
    return PIECES[type].shapes[rotation].map(pt => ({
      x: pt.x + offsetX,
      y: pt.y + offsetY
    }));
  }

  public isValidPosition(
    type: TetrominoType | null,
    rotation: RotationState,
    x: number,
    y: number
  ): boolean {
    if (!type) return false;
    const blocks = PIECES[type].shapes[rotation];

    for (const pt of blocks) {
      const bx = pt.x + x;
      const by = pt.y + y;

      // Boundary checks
      if (bx < 0 || bx >= BOARD_WIDTH || by >= BOARD_TOTAL_HEIGHT) {
        return false;
      }
      // Top buffer allows pieces to exist above 0, but by < 0 is out of bounds
      if (by < 0) {
        return false;
      }
      // Board occupancy
      if (this.board[by][bx] !== null) {
        return false;
      }
    }
    return true;
  }

  public getSoftDropInterval(): number {
    return Math.max(1, Math.floor(this.dropInterval / this.softDropFactor));
  }

  public getGhostY(): number {
    if (!this.activePiece) return this.activeY;
    let gy = this.activeY;
    while (this.isValidPosition(this.activePiece, this.activeRotation, this.activeX, gy + 1)) {
      gy++;
    }
    return gy;
  }

  public moveLeft(): boolean {
    if (this.state !== 'playing' || !this.activePiece) return false;
    if (this.isValidPosition(this.activePiece, this.activeRotation, this.activeX - 1, this.activeY)) {
      this.activeX--;
      this.lastActionWasRotation = false;
      this.onPieceMoved();
      return true;
    }
    return false;
  }

  public moveRight(): boolean {
    if (this.state !== 'playing' || !this.activePiece) return false;
    if (this.isValidPosition(this.activePiece, this.activeRotation, this.activeX + 1, this.activeY)) {
      this.activeX++;
      this.lastActionWasRotation = false;
      this.onPieceMoved();
      return true;
    }
    return false;
  }

  public softDrop(): boolean {
    if (this.state !== 'playing' || !this.activePiece) return false;
    if (this.isValidPosition(this.activePiece, this.activeRotation, this.activeX, this.activeY + 1)) {
      this.activeY++;
      this.lastActionWasRotation = false;
      this.score += SCORING.SOFT_DROP_PER_CELL;
      this.dropTimer = 0;
      this.onPieceMoved();
      return true;
    }
    return false;
  }

  public hardDrop(): number {
    if (this.state !== 'playing' || !this.activePiece) return 0;
    const ghostY = this.getGhostY();
    const droppedDistance = ghostY - this.activeY;
    if (droppedDistance > 0) {
      this.lastActionWasRotation = false;
    }
    this.activeY = ghostY;
    this.score += droppedDistance * SCORING.HARD_DROP_PER_CELL;
    this.lockPiece();
    return droppedDistance;
  }

  public rotateCW(): boolean {
    return this.attemptRotate(((this.activeRotation + 1) % 4) as RotationState);
  }

  public rotateCCW(): boolean {
    return this.attemptRotate(((this.activeRotation + 3) % 4) as RotationState);
  }

  private attemptRotate(newRotation: RotationState): boolean {
    if (this.state !== 'playing' || !this.activePiece) return false;

    const fromState = this.activeRotation;
    const kickOffsets = SRS.getKickOffsets(this.activePiece, fromState, newRotation);

    for (let i = 0; i < kickOffsets.length; i++) {
      const offset = kickOffsets[i];
      const targetX = this.activeX + offset.x;
      const targetY = this.activeY + offset.y;

      if (this.isValidPosition(this.activePiece, newRotation, targetX, targetY)) {
        this.activeRotation = newRotation;
        this.activeX = targetX;
        this.activeY = targetY;
        this.lastActionWasRotation = true;
        this.lastKickIndex = i;
        this.onPieceMoved();
        this.events.onPieceRotate?.();
        return true;
      }
    }
    return false;
  }

  public hold(): boolean {
    if (this.state !== 'playing' || !this.activePiece || !this.canHold) return false;

    const current = this.activePiece;
    if (this.holdPiece === null) {
      this.holdPiece = current;
      this.spawnPiece();
    } else {
      const swapped = this.holdPiece;
      this.holdPiece = current;
      this.spawnPiece(swapped);
    }

    this.canHold = false;
    return true;
  }

  private onPieceMoved() {
    this.events.onPieceMove?.();

    // If the piece reached a new lowest row, the Guideline resets both the
    // placement counter and the lock-down timer.
    if (this.activeY > this.lowestY) {
      this.lowestY = this.activeY;
      this.lockResets = 0;
      this.lockTimer = 0;
    }

    // Check if resting on surface. A move/rotation while on the surface
    // restarts the 0.5 s lock timer; once airborne, the timer stays at zero.
    if (!this.isValidPosition(this.activePiece, this.activeRotation, this.activeX, this.activeY + 1)) {
      if (!this.isLocking) {
        this.isLocking = true;
        this.lockTimer = 0;
      } else if (this.lockResets < this.maxLockResets) {
        this.lockTimer = 0;
        this.lockResets++;
      }
    } else {
      this.isLocking = false;
      this.lockTimer = 0;
    }
  }

  public lockPiece() {
    if (!this.activePiece) return;

    const blocks = this.getActiveBlocks();
    const color = PIECES[this.activePiece].color;

    // T-Spin Check before writing minos to the board
    let tSpinType: TSpinType = 'none';
    if (this.activePiece === 'T') {
      tSpinType = TSpinDetector.checkTSpin(
        this.board,
        this.activeX,
        this.activeY,
        this.activeRotation,
        this.lastActionWasRotation,
        this.lastKickIndex
      );
    }

    // Check if piece locked entirely above visible area (Row < 20) -> Lock out
    let allAboveVisible = true;
    for (const b of blocks) {
      if (b.y >= BOARD_BUFFER_HEIGHT) {
        allAboveVisible = false;
      }
      if (b.y >= 0 && b.y < BOARD_TOTAL_HEIGHT && b.x >= 0 && b.x < BOARD_WIDTH) {
        this.board[b.y][b.x] = color;
      }
    }

    this.piecesPlaced++;
    this.events.onPieceLock?.();

    if (allAboveVisible) {
      this.gameOver('lock_out');
      return;
    }

    // Line Clear detection
    const clearedRowIndices: number[] = [];
    for (let r = 0; r < BOARD_TOTAL_HEIGHT; r++) {
      if (this.board[r].every(cell => cell !== null)) {
        clearedRowIndices.push(r);
      }
    }

    const linesCleared = clearedRowIndices.length;
    // A perfect clear means every row that is not being cleared is empty.
    const isPerfectClear = linesCleared > 0 && this.board.every((row, rowIndex) =>
      clearedRowIndices.includes(rowIndex) || row.every(cell => cell === null)
    );
    if (linesCleared === 4) {
      this.tetrisesCount++;
    }
    if (tSpinType !== 'none') {
      this.tSpinsCount++;
    }

    // Evaluate score, combos, B2B, garbage
    const result = ScoringSystem.evaluateClear({
      linesCleared,
      tSpin: tSpinType,
      currentLevel: this.level,
      isB2BActive: this.b2bActive,
      currentB2BChain: this.b2bChain,
      currentCombo: this.comboCount,
      isPerfectClear
    });

    this.score += result.scoreGained;
    this.lines += linesCleared;
    this.b2bActive = result.isB2B;
    this.b2bChain = result.b2bChain;
    this.comboCount = result.comboCount;

    if (this.comboCount > this.maxCombo) {
      this.maxCombo = this.comboCount;
    }
    if (this.b2bChain > this.maxB2B) {
      this.maxB2B = this.b2bChain;
    }

    // Level progression (every 10 lines)
    const newLevel = this.startingLevel + Math.floor(this.lines / 10);
    if (newLevel !== this.level) {
      this.level = newLevel;
      if (!this.fixedGravity) {
        this.dropInterval = this.gravityCurve(this.level);
      }
    }

    this.events.onScoreUpdate?.(this.score, this.lines, this.level);

    if (linesCleared > 0 || tSpinType !== 'none') {
      this.events.onLineClear?.(result);
    }

    // Garbage interaction in versus mode:
    // 1. Cancel own pending garbage first
    if (result.garbageSent > 0) {
      const remainingAttack = this.garbageManager.cancelGarbage(result.garbageSent);
      if (remainingAttack > 0) {
        this.events.onGarbageSent?.(remainingAttack);
      }
    }

    if (linesCleared > 0) {
      // Enter Line Clear Delay & Flash Animation:
      // Rows remain on board during the delay to flash/blink, then collapse in finishLineClear()
      this.clearingRows = [...clearedRowIndices];
      this.lineClearTimer = this.lineClearDelay;
      this.activePiece = null;
    } else {
      // 2. If no lines were cleared and pending garbage exists, push incoming garbage into the board
      if (this.garbageManager.getPendingCount() > 0) {
        const { insertedLines, toppedOut } = this.garbageManager.insertGarbage(this.board);
        if (toppedOut) {
          this.gameOver('top_out');
          return;
        }
        if (insertedLines > 0) {
          this.events.onGarbageReceived?.(insertedLines);
        }
      }

      this.canHold = true;
      this.spawnPiece();
    }
  }

  public finishLineClear() {
    if (this.clearingRows.length === 0) return;

    // Remove cleared rows and insert empty rows at top
    // First remove all cleared rows from bottom to top so indices don't shift
    const sorted = [...this.clearingRows].sort((a, b) => b - a);
    for (const r of sorted) {
      this.board.splice(r, 1);
    }
    // Then insert the exact same number of empty rows at the top
    for (let i = 0; i < sorted.length; i++) {
      this.board.unshift(new Array(BOARD_WIDTH).fill(null));
    }

    // Check for Perfect Clear after lines are eliminated
    const isPerfectClear = this.board.every(row => row.every(cell => cell === null));
    if (isPerfectClear) {
      this.perfectClearsCount++;
      // Perfect clear score and garbage were already awarded by ScoringSystem.
      this.events.onScoreUpdate?.(this.score, this.lines, this.level);
      this.events.onPerfectClear?.();
    }

    const finished = [...this.clearingRows];
    this.clearingRows = [];
    this.lineClearTimer = 0;

    this.events.onLineClearFinish?.(finished);

    // If pending garbage arrived during the line clear delay, insert it now before next piece spawns
    if (this.garbageManager.getPendingCount() > 0) {
      const { insertedLines, toppedOut } = this.garbageManager.insertGarbage(this.board);
      if (toppedOut) {
        this.gameOver('top_out');
        return;
      }
      if (insertedLines > 0) {
        this.events.onGarbageReceived?.(insertedLines);
      }
    }

    this.canHold = true;
    this.spawnPiece();
  }

  public update(deltaMs: number) {
    if (this.state !== 'playing') return;

    this.totalPlayTimeMs += deltaMs;

    // Line clear animation in progress: blink and pause piece spawning
    if (this.clearingRows.length > 0) {
      this.lineClearTimer -= deltaMs;
      if (this.lineClearTimer <= 0) {
        this.finishLineClear();
      }
      return;
    }

    if (!this.activePiece) return;

    // Check if resting on ground
    const onGround = !this.isValidPosition(this.activePiece, this.activeRotation, this.activeX, this.activeY + 1);

    if (onGround) {
      this.isLocking = true;
      this.lockTimer += deltaMs;
      if (this.lockTimer >= this.lockDelay) {
        this.lockPiece();
        return;
      }
    } else {
      this.isLocking = false;
      this.lockTimer = 0;

      // Normal gravity drop
      this.dropTimer += deltaMs;
      if (this.dropTimer >= this.dropInterval) {
        this.dropTimer = 0;
        this.activeY++;
        this.lastActionWasRotation = false;
        this.onPieceMoved();
      }
    }
  }

  public gameOver(reason: string = 'top_out') {
    if (this.immortal) {
      // Zen mode: soft reset board on top-out, preserve stats and continue seamlessly
      this.board = this.createEmptyBoard();
      this.spawnPiece();
      this.events.onPieceSpawn?.(this.activePiece!);
      return;
    }

    this.state = 'gameover';
    this.endTime = Date.now();
    this.events.onStateChange?.(this.state);
    this.events.onGameOver?.(reason);
  }

  public getVisibleBoard(): (string | null)[][] {
    return this.board.slice(BOARD_BUFFER_HEIGHT);
  }

  public getStats() {
    const duration = this.totalPlayTimeMs;
    const durationSec = duration / 1000;
    const pps = durationSec > 0 ? parseFloat((this.piecesPlaced / durationSec).toFixed(2)) : 0;
    const apm = durationSec > 0 ? parseFloat(((this.lines * 60) / durationSec).toFixed(1)) : 0;

    return {
      score: this.score,
      lines: this.lines,
      level: this.level,
      duration,
      piecesPlaced: this.piecesPlaced,
      pps,
      apm,
      tetrises: this.tetrisesCount,
      tSpins: this.tSpinsCount,
      perfectClears: this.perfectClearsCount,
      maxCombo: this.maxCombo,
      maxB2B: this.maxB2B
    };
  }
}
