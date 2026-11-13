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
import {
  BLAST_CONTEST_STAGES,
  BLAST_CRUSH_DAMAGE,
  BLAST_EFFECT_DURATION_MS,
  BLAST_ENEMY_HEAL,
  BLAST_FIGHT_ENEMIES,
  BLAST_FIGHT_ROUNDS,
  BLAST_TELEGRAPH_DURATION_MS,
  BlastEffect,
  BlastMode,
  BlastResult,
  buildBlastStageBoard,
  bombColor,
  chooseBombLocal,
  encodeBombCell,
      getBlastDimensions,
    getBlastEnemyDamage,
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

// Blast stops between stages until the player explicitly continues.
export interface BlastIntermission {
  kind: 'stage' | 'enemy';
  current: number;
  next: number;
}

export interface BlastEnemyState {
  kind: number;
  name: string;
  x: number;
  y: number;
  homeX: number;
  moveTimer: number;
  abilityTimer: number;
  stunTimer: number;
}

export interface BlastEnemyAction {
  id: number;
  type: 'attack' | 'damage' | 'defeat';
  enemyKind: number;
  amount: number;
}

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
  onBlastIntermission?: (info: BlastIntermission | null) => void;
  onBlastStageChange?: (info: { stage: number; round: number; piecesLeft: number; enemyHp: number; enemyMaxHp: number }) => void;
  onBlastEnemyAction?: (action: BlastEnemyAction) => void;
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
  public blastEnemy: BlastEnemyState | null = null;
  public blastControlFreeze: number = 0;
  public blastBlocksDestroyed: number = 0;
  public blastBestChain: number = 0;
  public blastLastChain: number = 0;
  public blastEffects: BlastEffect[] = [];
  public blastExplosionTimer: number = 0;
  public blastTelegraphEffects: BlastEffect[] = [];
  public blastTelegraphCells: Point[] = [];
  public blastTelegraphRows: number[] = [];
  public blastTelegraphTimer: number = 0;
  public blastIntermission: BlastIntermission | null = null;
  private blastPendingRows: number[] = [];
  public activeBombLocal: Point[] = [];
  public activeMegaBomb: boolean = false;
  private blastBombQueue: Point[][] = [];
  private blastEnemyActionId: number = 0;
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
    this.blastIntermission = null;
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
    if (this.state !== 'playing' || !this.activePiece || this.blastControlFreeze > 0) return false;
    if (this.isValidPosition(this.activePiece, this.activeRotation, this.activeX + dx, this.activeY)) {
      this.activeX += dx;
      this.lastActionWasRotation = false;
      this.onPieceMoved();
      return true;
    }
    return false;
  }

  public softDrop(): boolean {
    if (this.state !== 'playing' || !this.activePiece || this.blastControlFreeze > 0) return false;
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
    if (this.state !== 'playing' || !this.activePiece || this.blastControlFreeze > 0) return 0;
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
    if (this.state !== 'playing' || !this.activePiece || this.rotationLocked || this.blastControlFreeze > 0) return false;

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
    if (this.state !== 'playing' || !this.activePiece || !this.canHold || this.blastControlFreeze > 0) return false;

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
    this.blastTelegraphRows = [];
    this.blastTelegraphTimer = 0;
    this.blastPendingRows = [];
    this.board = buildBlastStageBoard(
      this.blastMode,
      this.blastStage,
      this.blastRound
    );
    // Pre-placed 2x2 bomb groups are already complete at stage start, so fuse
    // them before the first piece spawns instead of waiting for a detonation.
    this.promoteMegaBombs();
    this.blastControlFreeze = 0;
    this.horizontalInverted = false;
    if (this.blastMode === 'fight') {
      this.blastEnemyMaxHp = getFightEnemyMaxHp(this.blastRound);
      this.blastEnemyHp = this.blastEnemyMaxHp;
      this.blastEnemy = this.createBlastEnemy();
    } else {
      this.blastEnemyHp = 0;
      this.blastEnemyMaxHp = 0;
      this.blastEnemy = null;
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

  private createBlastEnemy(): BlastEnemyState {
    const spec = BLAST_FIGHT_ENEMIES[
      Math.max(0, Math.min(BLAST_FIGHT_ROUNDS - 1, this.blastRound - 1))
    ];
    const homeX = 5;
    return {
      kind: Math.max(0, Math.min(BLAST_FIGHT_ROUNDS - 1, this.blastRound - 1)),
      name: spec.name,
      x: homeX,
      y: this.getEnemySurfaceY(homeX),
      homeX,
      moveTimer: 900,
      abilityTimer: 3200,
      stunTimer: 0
    };
  }

  /** Row of the empty cell directly above the stack in a column. */
  private getEnemySurfaceY(column: number): number {
    for (let row = 0; row < BOARD_VISIBLE_HEIGHT; row += 1) {
      if (this.board[BOARD_BUFFER_HEIGHT + row][column] !== null) {
        return Math.max(0, row - 1);
      }
    }
    return BOARD_VISIBLE_HEIGHT - 1;
  }

  private updateBlastEnemy(deltaMs: number) {
    const enemy = this.blastEnemy;
    if (!enemy) return;

    if (this.blastControlFreeze > 0) {
      this.blastControlFreeze = Math.max(0, this.blastControlFreeze - deltaMs);
    }

    if (enemy.stunTimer > 0) {
      enemy.stunTimer = Math.max(0, enemy.stunTimer - deltaMs);
      return;
    }

    enemy.moveTimer -= deltaMs;
    if (enemy.moveTimer <= 0) {
      this.moveBlastEnemy(enemy);
      enemy.moveTimer = 650 + Math.floor(this.blastRng() * 450);
    }

    enemy.abilityTimer -= deltaMs;
    if (enemy.abilityTimer <= 0) {
      this.triggerBlastEnemyAbility(enemy);
      enemy.abilityTimer = 4500 + Math.floor(this.blastRng() * 1800);
    }
  }

  private moveBlastEnemy(enemy: BlastEnemyState) {
    const direction = this.blastRng() < 0.5 ? -1 : 1;
    let targetX = enemy.x + direction;

    if (enemy.kind === 1 || enemy.kind === 5) {
      // Snaptor and Dug Grub seek bombs and large bombs.
      const targets: number[] = [];
      for (let row = 0; row < BOARD_BUFFER_HEIGHT; row += 1) {
        for (let column = 0; column < BOARD_WIDTH; column += 1) {
          const cell = this.board[BOARD_BUFFER_HEIGHT + row][column];
          const wanted = enemy.kind === 5 ? isMegaBombCell(cell) : isBombCell(cell);
          if (wanted) targets.push(column);
        }
      }
      if (targets.length > 0) {
        targetX = targets.sort((a, b) =>
          Math.abs(a - enemy.x) - Math.abs(b - enemy.x)
        )[0];
      }
    } else if (enemy.kind === 3) {
      // Creepa heads for the highest stack.
      let highest = enemy.x;
      let bestY = this.getEnemySurfaceY(enemy.x);
      for (let column = 0; column < BOARD_WIDTH; column += 1) {
        const y = this.getEnemySurfaceY(column);
        if (y < bestY) {
          bestY = y;
          highest = column;
        }
      }
      targetX = highest;
    } else if (enemy.kind === 4) {
      targetX = enemy.homeX;
    } else if (enemy.kind === 6 || enemy.kind === 7) {
      // Shadow and B-Boy drop towards the lowest open area.
      let lowest = enemy.x;
      let bestY = -1;
      for (let column = 0; column < BOARD_WIDTH; column += 1) {
        const y = this.getEnemySurfaceY(column);
        if (y > bestY) {
          bestY = y;
          lowest = column;
        }
      }
      targetX = lowest;
    }

    enemy.x = Math.max(0, Math.min(BOARD_WIDTH - 1, targetX));
    if (enemy.kind === 2) {
      // Gloop flies through blocks instead of walking on the surface.
      enemy.y = Math.max(0, Math.min(BOARD_VISIBLE_HEIGHT - 1,
        enemy.y + (this.blastRng() < 0.5 ? -1 : 1)));
    } else {
      enemy.y = this.getEnemySurfaceY(enemy.x);
    }
  }

  private triggerBlastEnemyAbility(enemy: BlastEnemyState) {
    switch (enemy.kind) {
      case 0: // Cubit: builds a rising column.
        this.addEnemyBlock(enemy.x);
        break;
      case 1: { // Snaptor: eats a bomb and heals.
        const bomb = this.findEnemyTarget(isBombCell);
        if (bomb) {
          this.board[BOARD_BUFFER_HEIGHT + bomb.y][bomb.x] = '#94a3b8';
        }
        break;
      }
      case 2: // Gloop: forces the current piece to drop and lock.
        if (this.activePiece) this.hardDrop();
        break;
      case 3: { // Creepa: adds a block on the highest stack.
        let highest = 0;
        let bestY = BOARD_BUFFER_HEIGHT;
        for (let column = 0; column < BOARD_WIDTH; column += 1) {
          const y = this.getEnemySurfaceY(column);
          if (y < bestY) {
            bestY = y;
            highest = column;
          }
        }
        this.addEnemyBlock(highest);
        break;
      }
      case 4: // Squidly: raises a garbage row with one hole.
        this.addEnemyGarbageRow();
        break;
      case 5: { // Dug Grub: eats a large bomb or a 3x3 cluster.
        let foundMega = false;
        for (let row = 0; row < BOARD_BUFFER_HEIGHT - 1 && !foundMega; row += 1) {
          for (let column = 0; column < BOARD_WIDTH - 1; column += 1) {
            if (isMegaBombCell(this.board[BOARD_BUFFER_HEIGHT + row][column])) {
              this.removeBlastArea(column, BOARD_BUFFER_HEIGHT + row, 2, 2);
              foundMega = true;
              break;
            }
          }
        }
        if (!foundMega) {
          this.removeBlastArea(enemy.x - 1, BOARD_BUFFER_HEIGHT + enemy.y - 1, 3, 3);
        }
        break;
      }
      case 6: // Shadow: inverts the playfield and briefly freezes controls.
        this.blastControlFreeze = 1900;
        break;
      case 7: // B-Boy: explodes a 7x1 row around itself.
        this.removeBlastArea(enemy.x - 3, BOARD_BUFFER_HEIGHT + enemy.y, 7, 1);
        break;
    }
    // Every special move restores a little health in the original game.
    const hpBeforeHeal = this.blastEnemyHp;
    this.blastEnemyHp = Math.min(this.blastEnemyMaxHp, this.blastEnemyHp + BLAST_ENEMY_HEAL);
    this.emitBlastEnemyAction('attack', this.blastEnemyHp - hpBeforeHeal, enemy.kind);
  }

  private emitBlastEnemyAction(type: BlastEnemyAction['type'], amount: number, enemyKind?: number) {
    const kind = enemyKind ?? this.blastEnemy?.kind;
    if (kind === undefined) return;
    this.blastEnemyActionId += 1;
    this.events.onBlastEnemyAction?.({
      id: this.blastEnemyActionId,
      type,
      enemyKind: kind,
      amount
    });
  }

  private findEnemyTarget(predicate: (cell: string | null) => boolean): Point | null {
    for (let row = 0; row < BOARD_BUFFER_HEIGHT; row += 1) {
      for (let column = 0; column < BOARD_WIDTH; column += 1) {
        if (predicate(this.board[BOARD_BUFFER_HEIGHT + row][column])) {
          return { x: column, y: row };
        }
      }
    }
    return null;
  }

  private addEnemyBlock(column: number) {
    const y = this.getEnemySurfaceY(column);
    const row = BOARD_BUFFER_HEIGHT + y;
    if (this.board[row][column] !== null) return;

    // An enemy block must never be the move that completes a line. The
    // player alone is responsible for triggering explosions.
    const emptyCells = this.board[row].filter(cell => cell === null).length;
    if (emptyCells <= 1) return;

    this.board[row][column] = '#94a3b8';
  }

  private addEnemyGarbageRow() {
    const row = new Array<string | null>(BOARD_WIDTH).fill('#94a3b8');
    row[Math.floor(this.blastRng() * BOARD_WIDTH)] = null;
    this.board.shift();
    this.board.push(row);
    if (this.blastEnemy) this.blastEnemy.y = this.getEnemySurfaceY(this.blastEnemy.x);
  }

  private damageBlastEnemy(amount: number, canDefeat: boolean = true) {
    if (!this.blastEnemy) return;
    const hpBefore = this.blastEnemyHp;
    const requested = Math.max(0, Math.floor(amount));
    const applied = canDefeat
      ? Math.min(requested, hpBefore)
      : Math.min(requested, Math.max(0, hpBefore - 1));
    this.blastEnemyHp = Math.max(0, hpBefore - applied);
    this.blastEnemy.stunTimer = Math.max(this.blastEnemy.stunTimer, 850);
    if (applied > 0) {
      this.emitBlastEnemyAction('damage', applied);
    }
    if (canDefeat && this.blastEnemyHp <= 0) {
      this.emitBlastEnemyAction('defeat', 0);
    }
  }

  /** Development-only shortcut: instantly defeats the current Fight enemy. */
  public debugDefeatBlastEnemy(): boolean {
    if (!import.meta.env.DEV) return false;
    if (
      this.blastMode !== 'fight'
      || !this.blastEnemy
      || this.state !== 'playing'
      || this.blastIntermission
    ) {
      return false;
    }

    this.damageBlastEnemy(this.blastEnemyHp);
    this.activePiece = null;
    this.blastTransition = this.blastRound >= BLAST_FIGHT_ROUNDS ? 'complete' : 'enemy';

    // Let an explosion or warning already in progress finish its animation;
    // otherwise move to the intermission or victory screen immediately.
    if (this.blastTelegraphTimer <= 0 && this.blastExplosionTimer <= 0) {
      this.finishBlastTransition();
    }
    return true;
  }

  /** Crush damage only applies when a locked block actually covers the enemy. */
  private tryCrushBlastEnemy(blocks: Point[]) {
    const enemy = this.blastEnemy;
    if (!enemy || enemy.kind === 2) return false;

    const enemyRow = BOARD_BUFFER_HEIGHT + enemy.y;
    if (!blocks.some(block => block.x === enemy.x && block.y === enemyRow)) {
      return false;
    }

    this.damageBlastEnemy(BLAST_CRUSH_DAMAGE, false);
    this.floatBlastEnemy(enemy);
    return true;
  }

  /** Move a crushed enemy to the nearest free cell above it. */
  private floatBlastEnemy(enemy: BlastEnemyState) {
    const columnOffsets = [0, -1, 1, -2, 2, -3, 3, -4, 4];

    for (let y = enemy.y - 1; y >= 0; y -= 1) {
      for (const offset of columnOffsets) {
        const x = enemy.x + offset;
        if (x < 0 || x >= BOARD_WIDTH) continue;
        if (this.board[BOARD_BUFFER_HEIGHT + y][x] === null) {
          enemy.x = x;
          enemy.y = y;
          return;
        }
      }
    }

    // The stack can reach the ceiling: use any remaining open cell.
    for (let y = 0; y < BOARD_VISIBLE_HEIGHT; y += 1) {
      for (let x = 0; x < BOARD_WIDTH; x += 1) {
        if (this.board[BOARD_BUFFER_HEIGHT + y][x] === null) {
          enemy.x = x;
          enemy.y = y;
          return;
        }
      }
    }
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

    this.piecesPlaced += 1;
    this.events.onPieceLock?.();

    this.tryCrushBlastEnemy(blocks);

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
      this.blastTelegraphRows = [...fullRows];
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
    // The Game Boy fuses a 2x2 bomb square only once every detonation and
    // gravity step has settled.
    this.promoteMegaBombs();
    const boardCleared = this.isBoardEmpty();
    const stageCleared = this.blastMode === 'contest' ? boardCleared : false;

    this.blastLastChain = result.chain;
    if (result.chain > this.blastBestChain) this.blastBestChain = result.chain;
    this.blastBlocksDestroyed += result.destroyedBlocks;
    this.score += result.scoreGained;
    this.lines += result.destroyedBlocks;

    if (this.blastMode === 'contest') {
      this.blastPiecesLeft = Math.max(0, this.blastPiecesLeft - 1);
      if (result.chain >= 6 || result.mega) this.blastPiecesLeft += 1;
    }

    // The round is won by draining the opponent's HP, not merely by
    // clearing every block from the board.
    const enemyDefeated = this.blastMode === 'fight' && this.blastEnemyHp <= 0;

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
      this.blastTransition = this.blastStage >= BLAST_CONTEST_STAGES ? 'complete' : 'stage';
    } else if (this.blastMode === 'fight' && enemyDefeated) {
      this.blastTransition = this.blastRound >= BLAST_FIGHT_ROUNDS ? 'complete' : 'enemy';
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
    this.blastTelegraphRows = [];
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
    let enemyHit = false;

    // The Game Boy keeps a cumulative line counter through chain reactions.
    // It is not reset when gravity creates a fresh set of completed rows.
    let chainLevel = 0;

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
      chainLevel += rows.length;
      const megaSeen: Array<{ x: number; y: number }> = [];
      const scheduled = new Set(targets.map(target => `${target.x},${target.y}`));

      for (let index = 0; index < targets.length; index += 1) {
        const target = targets[index];
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

        // A bomb caught in a blast detonates too, even when it is not in a
        // completed row. Queue it before the area removes its cell.
        for (let row = startY; row < startY + height; row += 1) {
          if (row < 0 || row >= BOARD_TOTAL_HEIGHT) continue;
          for (let column = startX; column < startX + width; column += 1) {
            if (column < 0 || column >= BOARD_WIDTH) continue;
            const cell = this.board[row][column];
            if (!isBombCell(cell)) continue;
            const key = `${column},${row}`;
            if (scheduled.has(key)) continue;
            scheduled.add(key);
            targets.push({
              x: column,
              y: row,
              color: bombColor(cell),
              mega: isMegaBombCell(cell)
            });
          }
        }

        const destroyedCells = this.removeBlastArea(startX, startY, width, height);
        if (!enemyHit && this.blastEnemy) {
          const enemyRow = BOARD_BUFFER_HEIGHT + this.blastEnemy.y;
          if (
            this.blastEnemy.x >= startX && this.blastEnemy.x < startX + width &&
            enemyRow >= startY && enemyRow < startY + height
          ) {
            enemyHit = true;
          }
        }
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

      bombs += targets.length;
      this.applyBlastGravity();
      rows = this.getFullBoardRows();
    }

    // Damage is resolved once the whole chain has settled, so multi-row
    // explosions and chain reactions are worth more than isolated blasts.
    if (enemyHit) {
      this.damageBlastEnemy(getBlastEnemyDamage(chainLevel, chain));
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

  /**
   * Tetris Blast uses sticky gravity: orthogonally connected blocks fall as a
   * single group. A support under any cell stops the whole group, which lets
   * disconnected structures drop and create the classic chain reactions.
   */
  private applyBlastGravity() {
    // Segments are fixed once, immediately after the explosion. Recomputing
    // them during the fall would merge a falling segment with a supported one
    // as soon as they become side-by-side, stopping it in mid-air.
    const groups = this.getStickyGroups();
    if (groups.length === 0) return;

    while (true) {
      // Settle the lowest groups first so upper groups can follow them.
      groups.sort((a, b) =>
        Math.max(...b.map(cell => cell.y)) - Math.max(...a.map(cell => cell.y))
      );

      let moved = false;
      for (const group of groups) {
        if (this.dropStickyGroup(group)) {
          moved = true;
          break;
        }
      }
      if (!moved) return;
    }
  }

  private getStickyGroups(): Array<Array<{ x: number; y: number; cell: string }>> {
    const visited = Array.from({ length: BOARD_TOTAL_HEIGHT }, () =>
      new Array<boolean>(BOARD_WIDTH).fill(false)
    );
    const groups: Array<Array<{ x: number; y: number; cell: string }>> = [];

    for (let row = 0; row < BOARD_TOTAL_HEIGHT; row += 1) {
      for (let column = 0; column < BOARD_WIDTH; column += 1) {
        const cell = this.board[row][column];
        if (cell === null || visited[row][column]) continue;

        const group: Array<{ x: number; y: number; cell: string }> = [];
        const queue: Point[] = [{ x: column, y: row }];
        visited[row][column] = true;

        while (queue.length > 0) {
          const point = queue.shift()!;
          group.push({ ...point, cell: this.board[point.y][point.x]! });

          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
            const nx = point.x + dx;
            const ny = point.y + dy;
            if (nx < 0 || nx >= BOARD_WIDTH || ny < 0 || ny >= BOARD_TOTAL_HEIGHT) continue;
            if (visited[ny][nx] || this.board[ny][nx] === null) continue;
            visited[ny][nx] = true;
            queue.push({ x: nx, y: ny });
          }
        }

        groups.push(group);
      }
    }

    return groups;
  }

  private dropStickyGroup(group: Array<{ x: number; y: number; cell: string }>): boolean {
    const keys = new Set(group.map(cell => `${cell.x},${cell.y}`));

    for (const cell of group) {
      const nextRow = cell.y + 1;
      if (nextRow >= BOARD_TOTAL_HEIGHT) return false;
      const below = this.board[nextRow][cell.x];
      if (below !== null && !keys.has(`${cell.x},${nextRow}`)) return false;
    }

    for (const cell of group) {
      this.board[cell.y][cell.x] = null;
    }
    for (const cell of group) {
      cell.y += 1;
      this.board[cell.y][cell.x] = cell.cell;
    }
    return true;
  }

  private finishBlastTransition() {
    const transition = this.blastTransition;
    this.blastTransition = null;
    this.blastEffects = [];
    this.blastExplosionTimer = 0;
    this.blastTelegraphEffects = [];
    this.blastTelegraphCells = [];
    this.blastTelegraphRows = [];
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

    const current = transition === 'stage' ? this.blastStage : this.blastRound;
    this.blastIntermission = {
      kind: transition,
      current,
      next: current + 1
    };
    this.events.onBlastIntermission?.(this.blastIntermission);
  }

  /** Start the next Contest stage or Fight round after the player validates. */
  public continueBlast(): boolean {
    const intermission = this.blastIntermission;
    if (!intermission || this.state !== 'playing') return false;

    this.blastIntermission = null;
    this.events.onBlastIntermission?.(null);

    if (intermission.kind === 'stage') {
      this.blastStage = intermission.next;
      this.blastPiecesLeft = 100;
    } else {
      this.blastRound = intermission.next;
    }

    this.level = this.getBlastSpeedLevel();
    this.setGravityLevel(this.level);
    this.setupBlastStage();
    this.canHold = true;
    this.spawnPiece();
    return true;
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
    if (this.blastIntermission) return;

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

    if (this.blastMode === 'fight') {
      this.updateBlastEnemy(deltaMs);
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
