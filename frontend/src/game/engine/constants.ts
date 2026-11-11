export const BOARD_WIDTH = 10;
export const BOARD_VISIBLE_HEIGHT = 20;
export const BOARD_BUFFER_HEIGHT = 20;
export const BOARD_TOTAL_HEIGHT = BOARD_VISIBLE_HEIGHT + BOARD_BUFFER_HEIGHT; // 40

export type TetrominoType = 'I' | 'J' | 'L' | 'O' | 'S' | 'T' | 'Z';

export type RotationState = 0 | 1 | 2 | 3; // 0 = spawn, 1 = R, 2 = 2, 3 = L

export interface Point {
  x: number;
  y: number;
}

export interface PieceDefinition {
  type: TetrominoType;
  color: string;
  ghostColor: string;
  // Shapes per rotation state [0, 1, 2, 3], each is an array of relative coordinates [x, y]
  shapes: Record<RotationState, Point[]>;
  spawnOffset: Point;
}

// Standard piece definitions using bounding boxes
export const PIECES: Record<TetrominoType, PieceDefinition> = {
  I: {
    type: 'I',
    color: '#06b6d4', // Cyan
    ghostColor: 'rgba(6, 182, 212, 0.3)',
    shapes: {
      0: [{ x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }],
      1: [{ x: 2, y: 0 }, { x: 2, y: 1 }, { x: 2, y: 2 }, { x: 2, y: 3 }],
      2: [{ x: 0, y: 2 }, { x: 1, y: 2 }, { x: 2, y: 2 }, { x: 3, y: 2 }],
      3: [{ x: 1, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 2 }, { x: 1, y: 3 }]
    },
    spawnOffset: { x: 3, y: 18 } // starts on the 21st row, then drops one row
  },
  J: {
    type: 'J',
    color: '#3b82f6', // Blue
    ghostColor: 'rgba(59, 130, 246, 0.3)',
    shapes: {
      0: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }],
      1: [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 2 }],
      2: [{ x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 2, y: 2 }],
      3: [{ x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 2 }, { x: 1, y: 2 }]
    },
    spawnOffset: { x: 3, y: 18 }
  },
  L: {
    type: 'L',
    color: '#f97316', // Orange
    ghostColor: 'rgba(249, 115, 22, 0.3)',
    shapes: {
      0: [{ x: 2, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }],
      1: [{ x: 1, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 2 }, { x: 2, y: 2 }],
      2: [{ x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 0, y: 2 }],
      3: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 2 }]
    },
    spawnOffset: { x: 3, y: 18 }
  },
  O: {
    type: 'O',
    color: '#eab308', // Yellow
    ghostColor: 'rgba(234, 179, 8, 0.3)',
    shapes: {
      0: [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 }],
      1: [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 }],
      2: [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 }],
      3: [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 }]
    },
    spawnOffset: { x: 3, y: 18 }
  },
  S: {
    type: 'S',
    color: '#22c55e', // Green
    ghostColor: 'rgba(34, 197, 94, 0.3)',
    shapes: {
      0: [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }],
      1: [{ x: 1, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 2, y: 2 }],
      2: [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 0, y: 2 }, { x: 1, y: 2 }],
      3: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 2 }]
    },
    spawnOffset: { x: 3, y: 18 }
  },
  T: {
    type: 'T',
    color: '#a855f7', // Purple
    ghostColor: 'rgba(168, 85, 247, 0.3)',
    shapes: {
      0: [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }],
      1: [{ x: 1, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 1, y: 2 }],
      2: [{ x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 1, y: 2 }],
      3: [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 2 }]
    },
    spawnOffset: { x: 3, y: 18 }
  },
  Z: {
    type: 'Z',
    color: '#ef4444', // Red
    ghostColor: 'rgba(239, 68, 68, 0.3)',
    shapes: {
      0: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 }],
      1: [{ x: 2, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 1, y: 2 }],
      2: [{ x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 2 }, { x: 2, y: 2 }],
      3: [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 0, y: 2 }]
    },
    spawnOffset: { x: 3, y: 18 }
  }
};

// Standard SRS Wall Kick Data (offsets applied as (dx, dy) where positive y is UP in guideline, so we invert y for board coordinates)
// Guideline: (0,0), (-1, 0), (-1, 1), (0, -2), (-1, -2) for 0->1
// In screen/board coordinates where Y increases DOWNWARDS, +y in SRS means -y on board.
export const SRS_KICKS_JLSTZ: Record<string, Point[]> = {
  '0->1': [{ x: 0, y: 0 }, { x: -1, y: 0 }, { x: -1, y: -1 }, { x: 0, y: 2 }, { x: -1, y: 2 }],
  '1->0': [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: -2 }, { x: 1, y: -2 }],
  '1->2': [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: -2 }, { x: 1, y: -2 }],
  '2->1': [{ x: 0, y: 0 }, { x: -1, y: 0 }, { x: -1, y: -1 }, { x: 0, y: 2 }, { x: -1, y: 2 }],
  '2->3': [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: -1 }, { x: 0, y: 2 }, { x: 1, y: 2 }],
  '3->2': [{ x: 0, y: 0 }, { x: -1, y: 0 }, { x: -1, y: 1 }, { x: 0, y: -2 }, { x: -1, y: -2 }],
  '3->0': [{ x: 0, y: 0 }, { x: -1, y: 0 }, { x: -1, y: 1 }, { x: 0, y: -2 }, { x: -1, y: -2 }],
  '0->3': [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: -1 }, { x: 0, y: 2 }, { x: 1, y: 2 }]
};

export const SRS_KICKS_I: Record<string, Point[]> = {
  '0->1': [{ x: 0, y: 0 }, { x: -2, y: 0 }, { x: 1, y: 0 }, { x: -2, y: 1 }, { x: 1, y: -2 }],
  '1->0': [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: -1, y: 0 }, { x: 2, y: -1 }, { x: -1, y: 2 }],
  '1->2': [{ x: 0, y: 0 }, { x: -1, y: 0 }, { x: 2, y: 0 }, { x: -1, y: -2 }, { x: 2, y: 1 }],
  '2->1': [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: -2, y: 0 }, { x: 1, y: 2 }, { x: -2, y: -1 }],
  '2->3': [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: -1, y: 0 }, { x: 2, y: -1 }, { x: -1, y: 2 }],
  '3->2': [{ x: 0, y: 0 }, { x: -2, y: 0 }, { x: 1, y: 0 }, { x: -2, y: 1 }, { x: 1, y: -2 }],
  '3->0': [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: -2, y: 0 }, { x: 1, y: 2 }, { x: -2, y: -1 }],
  '0->3': [{ x: 0, y: 0 }, { x: -1, y: 0 }, { x: 2, y: 0 }, { x: -1, y: -2 }, { x: 2, y: 1 }]
};

// Gameplay scoring values centralized
export const SCORING = {
  SINGLE: 100,
  DOUBLE: 300,
  TRIPLE: 500,
  TETRIS: 800,
  TSPIN_NO_LINES: 400,
  MINI_TSPIN_NO_LINES: 100,
  TSPIN_SINGLE: 800,
  MINI_TSPIN_SINGLE: 200,
  TSPIN_DOUBLE: 1200,
  TSPIN_TRIPLE: 1600,
  B2B_MULTIPLIER: 1.5,
  COMBO_BONUS_PER_COMBO: 50,
  SOFT_DROP_PER_CELL: 1,
  HARD_DROP_PER_CELL: 2,
  PERFECT_CLEAR_SINGLE: 800,
  PERFECT_CLEAR_DOUBLE: 1200,
  PERFECT_CLEAR_TRIPLE: 1800,
  PERFECT_CLEAR_TETRIS: 2000,
  PERFECT_CLEAR_B2B_TETRIS: 3200
};

// Garbage attack lines sent
export const GARBAGE_ATTACK = {
  SINGLE: 0,
  DOUBLE: 1,
  TRIPLE: 2,
  TETRIS: 4,
  TSPIN_SINGLE: 2,
  MINI_TSPIN_SINGLE: 0,
  TSPIN_DOUBLE: 4,
  TSPIN_TRIPLE: 6,
  B2B_BONUS: 1,
  PERFECT_CLEAR: 10,
  // Guideline combo garbage ladder:
  // combo 0..12 -> 0, 0, 1, 1, 1, 2, 2, 3, 3, 4, 4, 4, 5
  COMBO_BONUS: [0, 0, 1, 1, 1, 2, 2, 3, 3, 4, 4, 4, 5, 5, 5, 5]
};

// Official Guideline timing configuration (ms) - Tetris Holding LLC Standards
export const GUIDELINE_TIMING = {
  DAS: 167, // Official Guideline Delayed Auto Shift (~10 frames at 60Hz)
  ARR: 33,  // Official Guideline Auto Repeat Rate (~2 frames at 60Hz)
  SOFT_DROP_FACTOR: 20, // 20x gravity speed
  LOCK_DELAY: 500, // 0.5s lock delay
  MAX_LOCK_RESETS: 15, // 15 moves/rotations reset limit
  LINE_CLEAR_DELAY: 200,
  SPAWN_DELAY: 0
};

export const DEFAULT_TIMING = GUIDELINE_TIMING;
