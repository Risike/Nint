import {
  BOARD_BUFFER_HEIGHT,
  BOARD_TOTAL_HEIGHT,
  BOARD_WIDTH,
  DEFAULT_TIMING,
  PIECES,
  Point,
  RotationState,
  SCORING,
  TetrominoType
} from './constants';
import {
  BLAST_EFFECT_DURATION_MS,
  BLAST_TELEGRAPH_DURATION_MS,
  BlastEffect,
  BlastMode,
  BlastResult,
  buildBlastStageBoard,
  bombColor,
  chooseBombLocal,
  encodeBombCell,
  getBlastDimensions,
  getFightEnemyMaxHp,
  isBombCell,
  isMegaBombCell,
  rotateBombLocal
} from './blast';
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
  lineLevelProgression?: boolean; // If false, line clears do not advance the level
  immortal?: boolean; // Zen mode: soft reset board on top-out instead of stopping
  startingGarbageLines?: number; // Pre-fill with downstack practice lines
  enableGarbage?: boolean;
  lineClearDelay?: number; // Duration of line clear flash in ms (default 240ms)
  blast?: boolean;
  blastMode?: BlastMode;
  blastStage?: number;
  blastRound?: number;
  blastBudget?: number;
}

export type GameState = 'ready' | 'playing' | 'paused' | 'gameover' | 'completed';

export interface GameEvents {
  onStateChange?: (state: GameState) => void;
  onPieceSpawn?: (piece: TetrominoType) => void;
  onPieceMove?: () => void;
  onPieceRotate?: () => void;
  onPieceLock?: () => void;
  onPieceLocked?: (info: { linesCleared: number; scoreGained: number; tSpin: TSpinType; tetris: boolean; clearedRows: number[] }) => void;
  onLineClear?: (result: ClearResult) => void;
  onLineClearFinish?: (clearedRows: number[]) => void;
  onPerfectClear?: () => void;
  onGarbageSent?: (amount: number) => void;
  onGarbageReceived?: (amount: number) => void;
  onGameOver?: (reason: string) => void;
  onScoreUpdate?: (score: number, lines: number, level: number) => void;
  onBlast?: (result: BlastResult) => void;
  onBlastRunComplete?: () => void;
  onBlastStageChange?: (info: { stage: number; round: number; piecesLeft: number; enemyHp: number; enemyMaxHp: number }) => void;
}

export class GameEngine {
  public board: (string | null)[][];
  public activePiece: TetrominoType | null = null;
  public activeX: number = 0;
  public activeY: number = 0;
  public activeRotation: RotationState = 0;
  public holdPiece: TetrominoType | null = null;
  public holdBombs: Point[] = [];
  public holdMegaBomb: boolean = false;
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
  public lineLevelProgression: boolean = true;
  public immortal: boolean = false;
  public rotationLocked: boolean = false;
  public horizontalInverted: boolean = false;
  public gravityLevelOffset: number = 0;
  public lineClearDelay: number = 240;
  public clearingRows: number[] = [];
  public lineClearTimer: number = 0;
  public blast: boolean = false;
  public blastMode: BlastMode | null = null;
  public blastStage: number = 1;
  public blastRound: number = 1;
  public blastPiecesLeft: number = 0;
  public blastEnemyHp: number = 0;
  public blastEnemyMaxHp: number = 0;
  public blastBlocksDestroyed: number = 0;
  public blastBestChain: number = 0;
  public blastLastChain: number = 0;
  public blastEffects: BlastEffect[] = [];
  public blastExplosionTimer: number = 0;
  public blastTelegraphEffects: BlastEffect[] = [];
  public blastTelegraphCells: Point[] = [];
  public blastTelegraphTimer: number = 0;
  private blastPendingRows: number[] = [];
  public activeBombLocal: Point[] = [];
  public activeMegaBomb: boolean = false;
  private blastBombQueue: Point[][] = [];
  private blastRng: () => number;
  private blastTransition: 'stage' | 'enemy' | 'complete' | null = null;
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
    this.lineLevelProgression = options.lineLevelProgression !== false;
    this.immortal = Boolean(options.immortal);
    this.lineClearDelay = options.lineClearDelay ?? DEFAULT_TIMING.LINE_CLEAR_DELAY;
    this.blast = Boolean(options.blast);
    this.blastMode = this.blast ? (options.blastMode ?? 'contest') : null;
    this.blastStage = Math.max(1, options.blastStage ?? 1);
    this.blastRound = Math.max(1, options.blastRound ?? 1);
    this.blastPiecesLeft = Math.max(0, options.blastBudget ?? (this.blastMode === 'contest' ? 100 : 0));
    this.blastRng = Randomizer.createMulberry32((options.seed ?? Date.now()) + 0x9e3779b9);

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
    if (this.blast) {
      if (this.blastMode === 'contest') {
        this.blastPiecesLeft = 100;
      }
      this.setupBlastStage();
      this.level = this.getBlastSpeedLevel();
      this.setGravityLevel(this.level);
    }
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

  private syncBlastBombQueue() {
    if (!this.blast) return;
    const upcoming = this.randomizer.peek(14);
    while (this.blastBombQueue.length < upcoming.length) {
      const index = this.blastBombQueue.length;
      this.blastBombQueue.push(chooseBombLocal(upcoming[index], this.blastRng));
    }
  }

  /** Bomb layouts for the visible queue, in the same order as the pieces. */
  public getBlastBombPreview(count: number = 6): Point[][] {
    if (!this.blast) return [];
    this.syncBlastBombQueue();
    return this.blastBombQueue.slice(0, count).map(bombs =>
      bombs.map(point => ({ x: point.x, y: point.y }))
    );
  }

  public spawnPiece(
    pieceType?: TetrominoType,
    bombLocal?: Point[],
    megaBomb?: boolean
  ) {
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

    if (this.blast) {
      if (bombLocal) {
        this.activeBombLocal = bombLocal.map(point => ({ x: point.x, y: point.y }));
      } else if (pieceType) {
        this.activeBombLocal = chooseBombLocal(nextType, this.blastRng);
      } else {
        this.syncBlastBombQueue();
        this.activeBombLocal = this.blastBombQueue.shift() ?? chooseBombLocal(nextType, this.blastRng);
        this.syncBlastBombQueue();
      }
      this.activeMegaBomb = megaBomb ?? (nextType === 'O' && this.activeBombLocal.length === 4);
    } else {
      this.activeBombLocal = [];
      this.activeMegaBomb = false;
    }

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

  public getActiveBombs(): Point[] {
    if (!this.blast || !this.activePiece || this.activeBombLocal.length === 0) return [];
    return rotateBombLocal(this.activePiece, this.activeBombLocal, this.activeRotation).map(point => ({
      x: point.x + this.activeX,
      y: point.y + this.activeY
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
    return this.moveHorizontal(this.horizontalInverted ? 1 : -1);
  }

  public moveRight(): boolean {
    return this.moveHorizontal(this.horizontalInverted ? -1 : 1);
  }

  private moveHorizontal(dx: number): boolean {
    if (this.state !== 'playing' || !this.activePiece) return false;
    if (this.isValidPosition(this.activePiece, this.activeRotation, this.activeX + dx, this.activeY)) {
      this.activeX += dx;
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
    if (this.state !== 'playing' || !this.activePiece || this.rotationLocked) return false;

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

  public setGravityLevelOffset(offset: number) {
    this.gravityLevelOffset = Math.max(0, Math.floor(offset));
    if (!this.fixedGravity) {
      this.dropInterval = this.gravityCurve(this.level + this.gravityLevelOffset);
    }
  }

  // Explicit override for modes that drive speed independently from line clears.
  public setGravityLevel(level: number) {
    this.dropInterval = this.gravityCurve(Math.max(1, Math.floor(level)));
  }

  public hold(): boolean {
    if (this.state !== 'playing' || !this.activePiece || !this.canHold) return false;

    const current = this.activePiece;
    const currentBombs = this.activeBombLocal;
    const currentMega = this.activeMegaBomb;
    if (this.holdPiece === null) {
      this.holdPiece = current;
      this.holdBombs = currentBombs;
      this.holdMegaBomb = currentMega;
      this.spawnPiece();
    } else {
      const swapped = this.holdPiece;
      const swappedBombs = this.holdBombs;
      const swappedMega = this.holdMegaBomb;
      this.holdPiece = current;
      this.holdBombs = currentBombs;
      this.holdMegaBomb = currentMega;
      this.spawnPiece(swapped, swappedBombs, swappedMega);
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
    if (this.blast) {
      this.lockBlastPiece();
      return;
    }

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

    // Level progression (every 10 lines), unless the mode drives it itself.
    if (this.lineLevelProgression) {
      const newLevel = this.startingLevel + Math.floor(this.lines / 10);
      if (newLevel !== this.level) {
        this.level = newLevel;
        if (!this.fixedGravity) {
          this.dropInterval = this.gravityCurve(this.level + this.gravityLevelOffset);
        }
      }
    }

    this.events.onScoreUpdate?.(this.score, this.lines, this.level);

    if (linesCleared > 0 || tSpinType !== 'none') {
      this.events.onLineClear?.(result);
    }

    this.events.onPieceLocked?.({
      linesCleared,
      scoreGained: result.scoreGained,
      tSpin: tSpinType,
      tetris: linesCleared === 4,
      clearedRows: clearedRowIndices
    });

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

  public setupBlastStage() {
    if (!this.blast || !this.blastMode) return;
    this.blastTelegraphEffects = [];
    this.blastTelegraphCells = [];
    this.blastTelegraphTimer = 0;
    this.blastPendingRows = [];
    this.board = buildBlastStageBoard(
      this.blastMode,
      this.blastStage,
      this.blastRound,
      this.blastRng
    );
    if (this.blastMode === 'fight') {
      this.blastEnemyMaxHp = getFightEnemyMaxHp(this.blastRound);
      this.blastEnemyHp = this.blastEnemyMaxHp;
    } else {
      this.blastEnemyHp = 0;
      this.blastEnemyMaxHp = 0;
    }
    this.events.onBlastStageChange?.({
      stage: this.blastStage,
      round: this.blastRound,
      piecesLeft: this.blastPiecesLeft,
      enemyHp: this.blastEnemyHp,
      enemyMaxHp: this.blastEnemyMaxHp
    });
  }

  public getBlastSpeedLevel(): number {
    if (!this.blast) return this.startingLevel;
    if (this.blastMode === 'training') return this.startingLevel;
    if (this.blastMode === 'fight') return 1 + Math.floor((this.blastRound - 1) / 2);
    return 1 + Math.floor((this.blastStage - 1) / 5);
  }

  private getFullBoardRows(): number[] {
    const rows: number[] = [];
    for (let row = 0; row < BOARD_TOTAL_HEIGHT; row += 1) {
      if (this.board[row].every(cell => cell !== null)) rows.push(row);
    }
    return rows;
  }

  private isBoardEmpty(): boolean {
    return this.board.every(row => row.every(cell => cell === null));
  }

  /** Four bombs arranged in a 2x2 square become one super bomb. */
  private promoteMegaBombs() {
    const covered = new Set<string>();
    for (let row = 0; row < BOARD_TOTAL_HEIGHT - 1; row += 1) {
      for (let column = 0; column < BOARD_WIDTH - 1; column += 1) {
        if (covered.has(`${column},${row}`)) continue;
        const square = [
          this.board[row][column],
          this.board[row][column + 1],
          this.board[row + 1][column],
          this.board[row + 1][column + 1]
        ];
        if (!square.every(cell => isBombCell(cell))) continue;
        if (square.some(cell => !isMegaBombCell(cell))) {
          const color = bombColor(square[0] as string);
          for (let dy = 0; dy < 2; dy += 1) {
            for (let dx = 0; dx < 2; dx += 1) {
              this.board[row + dy][column + dx] = encodeBombCell(color, true);
            }
          }
        }
        covered.add(`${column},${row}`);
        covered.add(`${column + 1},${row}`);
        covered.add(`${column},${row + 1}`);
        covered.add(`${column + 1},${row + 1}`);
      }
    }
  }

  private lockBlastPiece() {
    if (!this.activePiece) return;

    const blocks = this.getActiveBlocks();
    const color = PIECES[this.activePiece].color;
    const bombKeys = new Set(this.getActiveBombs().map(point => `${point.x},${point.y}`));

    let allAboveVisible = true;
    for (const block of blocks) {
      if (block.y >= BOARD_BUFFER_HEIGHT) allAboveVisible = false;
      if (block.y >= 0 && block.y < BOARD_TOTAL_HEIGHT && block.x >= 0 && block.x < BOARD_WIDTH) {
        const key = `${block.x},${block.y}`;
        this.board[block.y][block.x] = bombKeys.has(key)
          ? encodeBombCell(color, this.activeMegaBomb)
          : color;
      }
    }

    if (this.blast) {
      this.promoteMegaBombs();
    }

    this.piecesPlaced += 1;
    this.events.onPieceLock?.();

    if (allAboveVisible) {
      this.gameOver('lock_out');
      return;
    }

    const fullRows = this.getFullBoardRows();
    const preview = fullRows.length > 0 ? this.buildBlastPreview(fullRows) : [];

    if (preview.length > 0) {
      // Show the doomed blocks before removing them. This telegraph phase is
      // also what makes long chains readable when several bombs overlap.
      this.blastTelegraphEffects = preview;
      this.blastTelegraphCells = preview.flatMap(effect => effect.cells);
      this.blastPendingRows = [...fullRows];
      this.blastTelegraphTimer = BLAST_TELEGRAPH_DURATION_MS;
      this.blastEffects = [];
      this.blastExplosionTimer = 0;
      this.activePiece = null;
      return;
    }

    this.finishBlastLock({
      chain: 0,
      destroyedBlocks: 0,
      bombs: 0,
      scoreGained: 0,
      effects: [],
      triggerRows: fullRows.length,
      stageCleared: false,
      mega: false
    });
  }

  private finishBlastLock(result: BlastResult) {
    const boardCleared = this.isBoardEmpty();
    const stageCleared = this.blastMode === 'contest' || this.blastMode === 'fight'
      ? boardCleared
      : false;

    this.blastLastChain = result.chain;
    if (result.chain > this.blastBestChain) this.blastBestChain = result.chain;
    this.blastBlocksDestroyed += result.destroyedBlocks;
    this.score += result.scoreGained;
    this.lines += result.destroyedBlocks;

    if (this.blastMode === 'contest') {
      this.blastPiecesLeft = Math.max(0, this.blastPiecesLeft - 1);
      if (result.chain >= 6 || result.mega) this.blastPiecesLeft += 1;
    }

    if (this.blastMode === 'fight') {
      const damage = result.destroyedBlocks * 12 * Math.max(1, result.chain);
      this.blastEnemyHp = Math.max(0, this.blastEnemyHp - damage);
    }

    const enemyDefeated = this.blastMode === 'fight' &&
      (this.blastEnemyHp <= 0 || boardCleared);

    if (result.chain > 0) {
      this.blastEffects = result.effects;
      this.blastExplosionTimer = BLAST_EFFECT_DURATION_MS;
      const clearResult: ClearResult = {
        linesCleared: Math.min(4, result.triggerRows),
        scoreGained: result.scoreGained,
        garbageSent: 0,
        text: result.chain > 1 ? `BLAST x${result.chain}` : 'BLAST',
        isB2B: false,
        b2bChain: 0,
        comboCount: result.chain - 1,
        isPerfectClear: false,
        tSpin: 'none'
      };
      this.events.onLineClear?.(clearResult);
      this.events.onBlast?.(result);
    }

    this.events.onScoreUpdate?.(this.score, this.lines, this.level);
    this.events.onPieceLocked?.({
      linesCleared: result.triggerRows,
      scoreGained: result.scoreGained,
      tSpin: 'none',
      tetris: false,
      clearedRows: []
    });

    this.activePiece = null;
    this.blastTransition = null;

    if (this.blastMode === 'contest' && stageCleared) {
      this.blastTransition = this.blastStage >= 50 ? 'complete' : 'stage';
    } else if (this.blastMode === 'fight' && enemyDefeated) {
      this.blastTransition = this.blastRound >= 8 ? 'complete' : 'enemy';
    }

    if (this.blastTransition) {
      if (this.blastExplosionTimer === 0) this.finishBlastTransition();
      return;
    }

    if (this.blastExplosionTimer > 0) return;

    if (this.blastMode === 'contest' && this.blastPiecesLeft <= 0) {
      this.gameOver('blast_budget');
      return;
    }

    this.canHold = true;
    this.spawnPiece();
  }

  private resolvePendingBlast() {
    if (this.blastPendingRows.length === 0) return;
    const rows = this.blastPendingRows;
    this.blastPendingRows = [];
    this.blastTelegraphEffects = [];
    this.blastTelegraphCells = [];
    this.blastTelegraphTimer = 0;
    this.finishBlastLock(this.detonateBlast(rows));
  }

  private buildBlastPreview(rows: number[]): BlastEffect[] {
    const targets: Array<{ x: number; y: number; color: string; mega: boolean }> = [];
    for (const row of rows) {
      for (let column = 0; column < BOARD_WIDTH; column += 1) {
        const cell = this.board[row][column];
        if (!isBombCell(cell)) continue;
        targets.push({
          x: column,
          y: row,
          color: bombColor(cell),
          mega: isMegaBombCell(cell)
        });
      }
    }

    const effects: BlastEffect[] = [];
    const megaSeen: Array<{ x: number; y: number }> = [];
    for (const target of targets) {
      if (target.mega) {
        const alreadyExploded = megaSeen.some(seen =>
          Math.abs(seen.x - target.x) <= 1 && Math.abs(seen.y - target.y) <= 1
        );
        megaSeen.push({ x: target.x, y: target.y });
        if (alreadyExploded) continue;
      }

      const { width, height } = getBlastDimensions(rows.length, target.mega);
      // The first mega cell is the top-left of a 2x2 group; shift the area by
      // one cell so the explosion is centred on the whole group.
      const megaAnchor = target.mega ? 1 : 0;
      const startX = target.x - Math.floor(width / 2) + megaAnchor;
      const startY = target.y - Math.floor(height / 2) + megaAnchor;
      const cells: Point[] = [];
      for (let row = startY; row < startY + height; row += 1) {
        if (row < 0 || row >= BOARD_TOTAL_HEIGHT) continue;
        for (let column = startX; column < startX + width; column += 1) {
          if (column < 0 || column >= BOARD_WIDTH) continue;
          if (this.board[row][column] !== null) cells.push({ x: column, y: row });
        }
      }
      effects.push({
        x: target.x + megaAnchor,
        y: target.y + megaAnchor,
        width,
        height,
        chain: 1,
        color: target.color,
        mega: target.mega,
        cells
      });
    }
    return effects;
  }

  private detonateBlast(initialRows: number[]): BlastResult {
    const effects: BlastEffect[] = [];
    let rows = initialRows;
    let chain = 0;
    let destroyedBlocks = 0;
    let bombs = 0;
    let mega = false;

    while (rows.length > 0) {
      const targets: Array<{ x: number; y: number; color: string; mega: boolean }> = [];
      for (const row of rows) {
        for (let column = 0; column < BOARD_WIDTH; column += 1) {
          const cell = this.board[row][column];
          if (!isBombCell(cell)) continue;
          targets.push({
            x: column,
            y: row,
            color: bombColor(cell),
            mega: isMegaBombCell(cell)
          });
        }
      }

      if (targets.length === 0) break;
      chain += 1;
      bombs += targets.length;
      const chainLevel = rows.length + chain - 1;
      const megaSeen: Array<{ x: number; y: number }> = [];

      for (const target of targets) {
        if (target.mega) {
          const alreadyExploded = megaSeen.some(seen =>
            Math.abs(seen.x - target.x) <= 1 && Math.abs(seen.y - target.y) <= 1
          );
          megaSeen.push({ x: target.x, y: target.y });
          if (alreadyExploded) continue;
          mega = true;
        }

        const { width, height } = getBlastDimensions(chainLevel, target.mega);
        const megaAnchor = target.mega ? 1 : 0;
        const startX = target.x - Math.floor(width / 2) + megaAnchor;
        const startY = target.y - Math.floor(height / 2) + megaAnchor;
        const destroyedCells = this.removeBlastArea(startX, startY, width, height);
        destroyedBlocks += destroyedCells.length;
        effects.push({
          x: target.x + megaAnchor,
          y: target.y + megaAnchor,
          width,
          height,
          chain,
          color: target.color,
          mega: target.mega,
          cells: destroyedCells
        });
      }

      this.applyBlastGravity();
      rows = this.getFullBoardRows();
    }

    return {
      chain,
      destroyedBlocks,
      bombs,
      scoreGained: destroyedBlocks * 10 * Math.max(1, chain) + bombs * 25 * Math.max(1, chain),
      effects,
      triggerRows: initialRows.length,
      stageCleared: this.isBoardEmpty(),
      mega
    };
  }

  private removeBlastArea(startX: number, startY: number, width: number, height: number): Point[] {
    const destroyed: Point[] = [];
    for (let row = startY; row < startY + height; row += 1) {
      if (row < 0 || row >= BOARD_TOTAL_HEIGHT) continue;
      for (let column = startX; column < startX + width; column += 1) {
        if (column < 0 || column >= BOARD_WIDTH) continue;
        if (this.board[row][column] !== null) {
          this.board[row][column] = null;
          destroyed.push({ x: column, y: row });
        }
      }
    }
    return destroyed;
  }

  private applyBlastGravity() {
    for (let column = 0; column < BOARD_WIDTH; column += 1) {
      let writeRow = BOARD_TOTAL_HEIGHT - 1;
      for (let row = BOARD_TOTAL_HEIGHT - 1; row >= 0; row -= 1) {
        const cell = this.board[row][column];
        if (cell === null) continue;
        this.board[writeRow][column] = cell;
        if (writeRow !== row) this.board[row][column] = null;
        writeRow -= 1;
      }
      for (let row = writeRow; row >= 0; row -= 1) {
        this.board[row][column] = null;
      }
    }
  }

  private finishBlastTransition() {
    const transition = this.blastTransition;
    this.blastTransition = null;
    this.blastEffects = [];
    this.blastExplosionTimer = 0;
    this.blastTelegraphEffects = [];
    this.blastTelegraphCells = [];
    this.blastTelegraphTimer = 0;
    if (!transition) {
      if (this.blastMode === 'contest' && this.blastPiecesLeft <= 0) {
        this.gameOver('blast_budget');
        return;
      }
      this.canHold = true;
      this.spawnPiece();
      return;
    }

    if (transition === 'complete') {
      this.state = 'completed';
      this.endTime = Date.now();
      this.events.onStateChange?.(this.state);
      this.events.onBlastRunComplete?.();
      return;
    }

    if (transition === 'stage') {
      this.blastStage += 1;
      this.blastPiecesLeft = 100;
    } else if (transition === 'enemy') {
      this.blastRound += 1;
    }

    this.level = this.getBlastSpeedLevel();
    this.setGravityLevel(this.level);
    this.setupBlastStage();
    this.canHold = true;
    this.spawnPiece();
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

    // Blast warning phase: the doomed cells stay on the board and pulse so
    // the player can read the explosion before the blocks disappear.
    if (this.blastTelegraphTimer > 0) {
      this.blastTelegraphTimer -= deltaMs;
      if (this.blastTelegraphTimer <= 0) {
        this.resolvePendingBlast();
      }
      return;
    }

    // Blast explosion animation: the board is already resolved, then a flash
    // shows every removed block before the next piece or stage transition.
    if (this.blastExplosionTimer > 0) {
      this.blastExplosionTimer -= deltaMs;
      if (this.blastExplosionTimer <= 0) {
        this.finishBlastTransition();
      }
      return;
    }

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
    if (this.blast && this.blastMode === 'training') {
      this.board = this.createEmptyBoard();
      this.canHold = true;
      this.spawnPiece();
      return;
    }

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
