import {
  BOARD_BUFFER_HEIGHT,
  BOARD_TOTAL_HEIGHT,
  BOARD_VISIBLE_HEIGHT,
  BOARD_WIDTH,
  DEFAULT_TIMING,
  PIECES,
  Point,
  RotationState,
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
  startingLevel?: number;
  gravityCurve?: (level: number) => number; // ms per drop step
  enableGarbage?: boolean;
}

export type GameState = 'ready' | 'playing' | 'paused' | 'gameover' | 'completed';

export interface GameEvents {
  onStateChange?: (state: GameState) => void;
  onPieceSpawn?: (piece: TetrominoType) => void;
  onPieceMove?: () => void;
  onPieceRotate?: () => void;
  onPieceLock?: () => void;
  onLineClear?: (result: ClearResult) => void;
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
  public piecesPlaced: number = 0;
  public tetrisesCount: number = 0;
  public tSpinsCount: number = 0;
  public perfectClearsCount: number = 0;
  public maxCombo: number = 0;
  public maxB2B: number = 0;

  public b2bActive: boolean = false;
  public comboCount: number = -1;

  public randomizer: Randomizer;
  public garbageManager: GarbageManager;

  // Timings & Physics
  public das: number;
  public arr: number;
  public lockDelay: number;
  public maxLockResets: number;
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
    this.level = options.startingLevel ?? 1;

    this.gravityCurve = options.gravityCurve ?? GameEngine.defaultGravityCurve;
    this.dropInterval = this.gravityCurve(this.level);

    this.board = this.createEmptyBoard();
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
    this.lowestY = this.activeY;
    this.lockResets = 0;
    this.isLocking = false;
    this.lockTimer = 0;
    this.dropTimer = 0;
    this.lastActionWasRotation = false;
    this.lastKickIndex = 0;

    // Check for block out (immediate spawn collision) -> Game Over
    if (!this.isValidPosition(this.activePiece, this.activeRotation, this.activeX, this.activeY)) {
      this.gameOver('block_out');
      return;
    }

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
      this.onPieceMoved();
      return true;
    }
    return false;
  }

  public moveRight(): boolean {
    if (this.state !== 'playing' || !this.activePiece) return false;
    if (this.isValidPosition(this.activePiece, this.activeRotation, this.activeX + 1, this.activeY)) {
      this.activeX++;
      this.onPieceMoved();
      return true;
    }
    return false;
  }

  public softDrop(): boolean {
    if (this.state !== 'playing' || !this.activePiece) return false;
    if (this.isValidPosition(this.activePiece, this.activeRotation, this.activeX, this.activeY + 1)) {
      this.activeY++;
      this.score += 1; // 1 point per soft drop cell
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
    this.activeY = ghostY;
    this.score += droppedDistance * 2; // 2 points per hard drop cell
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

    // If piece descended below its previous lowest point, reset lock delay allowances
    if (this.activeY > this.lowestY) {
      this.lowestY = this.activeY;
      this.lockResets = 0;
    }

    // Check if resting on surface
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
    }
  }

  public lockPiece() {
    if (!this.activePiece) return;

    const blocks = this.getActiveBlocks();
    const color = PIECES[this.activePiece].color;

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

    // T-Spin Check
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

    // Line Clear detection
    const clearedRowIndices: number[] = [];
    for (let r = 0; r < BOARD_TOTAL_HEIGHT; r++) {
      if (this.board[r].every(cell => cell !== null)) {
        clearedRowIndices.push(r);
      }
    }

    // Remove cleared rows and insert empty rows at top
    for (const r of clearedRowIndices) {
      this.board.splice(r, 1);
      this.board.unshift(new Array(BOARD_WIDTH).fill(null));
    }

    // Check for Perfect Clear
    const isPerfectClear = this.board.every(row => row.every(cell => cell === null));
    if (isPerfectClear) {
      this.perfectClearsCount++;
    }

    const linesCleared = clearedRowIndices.length;
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
      currentCombo: this.comboCount,
      isPerfectClear
    });

    this.score += result.scoreGained;
    this.lines += linesCleared;
    this.b2bActive = result.isB2B;
    this.comboCount = result.comboCount;

    if (this.comboCount > this.maxCombo) {
      this.maxCombo = this.comboCount;
    }
    if (this.b2bActive && result.b2bCount > this.maxB2B) {
      this.maxB2B = result.b2bCount;
    }

    // Level progression (every 10 lines)
    const newLevel = Math.floor(this.lines / 10) + 1;
    if (newLevel !== this.level) {
      this.level = newLevel;
      this.dropInterval = this.gravityCurve(this.level);
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

    // 2. If no lines were cleared and pending garbage exists, push incoming garbage into the board
    if (linesCleared === 0 && this.garbageManager.getPendingCount() > 0) {
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
    if (this.state !== 'playing' || !this.activePiece) return;

    this.totalPlayTimeMs += deltaMs;

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
        this.onPieceMoved();
      }
    }
  }

  public gameOver(reason: string = 'top_out') {
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
