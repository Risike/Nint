import {
  BOARD_TOTAL_HEIGHT,
  BOARD_WIDTH,
  PIECES,
  Point,
  RotationState,
  TetrominoType
} from './constants';

export const BOMB_PREFIX = 'bomb:';
export const MEGA_BOMB_PREFIX = 'megabomb:';

export type BlastMode = 'contest' | 'training' | 'fight';

export const BLAST_TELEGRAPH_DURATION_MS = 400;
export const BLAST_EFFECT_DURATION_MS = 720;

export interface BlastEffect {
  x: number;
  y: number;
  width: number;
  height: number;
  chain: number;
  color: string;
  mega: boolean;
  cells: Point[];
}

export interface BlastResult {
  chain: number;
  destroyedBlocks: number;
  bombs: number;
  scoreGained: number;
  effects: BlastEffect[];
  triggerRows: number;
  stageCleared: boolean;
  mega: boolean;
}

export function isBombCell(cell: string | null): cell is string {
  return Boolean(cell && (cell.startsWith(BOMB_PREFIX) || cell.startsWith(MEGA_BOMB_PREFIX)));
}

export function isMegaBombCell(cell: string | null): cell is string {
  return Boolean(cell && cell.startsWith(MEGA_BOMB_PREFIX));
}

export function bombColor(cell: string): string {
  return cell.startsWith(MEGA_BOMB_PREFIX)
    ? cell.slice(MEGA_BOMB_PREFIX.length)
    : cell.slice(BOMB_PREFIX.length);
}

export function encodeBombCell(color: string, mega: boolean = false): string {
  return `${mega ? MEGA_BOMB_PREFIX : BOMB_PREFIX}${color}`;
}

/**
 * Tetris Blast explosion footprint. The chain level is the number of rows
 * completed by the lock plus the current chain step (the classic L_k rule).
 */
export function getBlastDimensions(chainLevel: number, mega: boolean = false): { width: number; height: number } {
  if (mega) return { width: 10, height: 10 };
  const level = Math.max(1, Math.min(10, chainLevel));
  if (level === 1) return { width: 7, height: 1 };
  if (level === 2) return { width: 7, height: 3 };
  if (level === 3) return { width: 7, height: 5 };
  if (level === 4) return { width: 7, height: 7 };
  if (level === 5) return { width: 9, height: 9 };
  if (level === 6 || level === 7) return { width: 11, height: 11 };
  if (level === 8 || level === 9) return { width: 13, height: 13 };
  return { width: 15, height: 15 };
}

/**
 * Bomb markers are stored in spawn-orientation coordinates. Rotating them
 * with the same pivot as the SRS shape keeps the bomb on the same mino when
 * the player rotates the piece.
 */
export function rotateBombLocal(
  type: TetrominoType,
  local: Point[],
  rotation: RotationState
): Point[] {
  if (local.length === 0) return [];
  let points = local.map(point => ({ x: point.x, y: point.y }));
  // O keeps its shape but a bomb still travels around the four cells of the
  // square. Its pivot is the centre of the 2x2 block, not the 4x4 box centre.
  const pivotX = type === 'I' ? 1.5 : type === 'O' ? 1.5 : 1;
  const pivotY = type === 'I' ? 1.5 : type === 'O' ? 0.5 : 1;

  for (let step = 0; step < rotation; step += 1) {
    points = points.map(point => ({
      x: Math.round(pivotX + (pivotY - point.y)),
      y: Math.round(pivotY + (point.x - pivotX))
    }));
  }

  const seen = new Set<string>();
  return points.filter(point => {
    const key = `${point.x},${point.y}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function chooseBombLocal(type: TetrominoType, rng: () => number): Point[] {
  const shape = PIECES[type].shapes[0];

  // A 2x2 O piece made entirely of bombs is the classic mega bomb.
  if (type === 'O' && rng() < 0.06) {
    return shape.map(point => ({ x: point.x, y: point.y }));
  }

  const shuffled = shape.map(point => ({ x: point.x, y: point.y }));
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const other = Math.floor(rng() * (index + 1));
    [shuffled[index], shuffled[other]] = [shuffled[other], shuffled[index]];
  }

  const bombCount = shape.length > 1 && rng() < 0.22 ? 2 : 1;
  return shuffled.slice(0, bombCount);
}

function createEmptyBoard(): (string | null)[][] {
  return Array.from({ length: BOARD_TOTAL_HEIGHT }, () =>
    new Array<string | null>(BOARD_WIDTH).fill(null)
  );
}

/**
 * Contest stages start empty and progressively add bomb-filled structures.
 * Fight stages put a small fortification under the enemy. Blocks stay in
 * place on full rows: only explosions remove them.
 */
export function buildBlastStageBoard(
  mode: BlastMode,
  stage: number,
  round: number,
  rng: () => number
): (string | null)[][] {
  const board = createEmptyBoard();
  if (mode === 'training') return board;

  const rowCount = mode === 'contest'
    ? Math.min(10, Math.max(0, stage - 1))
    : Math.min(11, 2 + Math.floor(round / 2));
  if (rowCount === 0) return board;

  const colors = ['#06b6d4', '#3b82f6', '#f97316', '#eab308', '#22c55e', '#a855f7', '#ef4444'];

  for (let index = 0; index < rowCount; index += 1) {
    const boardRow = BOARD_TOTAL_HEIGHT - 1 - index;
    const row = new Array<string | null>(BOARD_WIDTH).fill(colors[index % colors.length]);

    const holeCount = index % 3 === 2 ? 2 : 1;
    const holes = new Set<number>();
    while (holes.size < holeCount) {
      holes.add(Math.floor(rng() * BOARD_WIDTH));
    }
    holes.forEach(hole => {
      row[hole] = null;
    });

    const openCells: number[] = [];
    row.forEach((cell, column) => {
      if (cell !== null) openCells.push(column);
    });
    if (openCells.length > 0) {
      const bombColumn = openCells[Math.floor(rng() * openCells.length)];
      row[bombColumn] = encodeBombCell(colors[index % colors.length]);
    }

    board[boardRow] = row;
  }

  return board;
}

export function getFightEnemyMaxHp(round: number): number {
  return 300 + Math.max(1, round) * 180;
}
