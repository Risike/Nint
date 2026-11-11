import {
  BOARD_BUFFER_HEIGHT,
  BOARD_TOTAL_HEIGHT,
  BOARD_WIDTH,
  PIECES,
  RotationState,
  TetrominoType
} from '../engine/constants';

export interface PlacementCandidate {
  rotation: RotationState;
  x: number;
  y: number;
  score: number;
  linesCleared: number;
}

export interface HeuristicWeights {
  aggregateHeight: number;
  completeLines: number;
  holes: number;
  bumpiness: number;
  wellDepth: number;
  blockades: number;
}

export const AI_WEIGHTS_PRESETS: Record<number, HeuristicWeights> = {
  1: { aggregateHeight: -0.15, completeLines: 0.2, holes: -0.4, bumpiness: -0.05, wellDepth: 0.05, blockades: -0.1 },
  3: { aggregateHeight: -0.3, completeLines: 0.5, holes: -0.8, bumpiness: -0.1, wellDepth: 0.2, blockades: -0.3 },
  5: { aggregateHeight: -0.5, completeLines: 0.8, holes: -1.5, bumpiness: -0.2, wellDepth: 0.4, blockades: -0.6 },
  7: { aggregateHeight: -0.65, completeLines: 1.2, holes: -2.5, bumpiness: -0.3, wellDepth: 0.7, blockades: -1.0 },
  10: { aggregateHeight: -0.75, completeLines: 1.8, holes: -3.8, bumpiness: -0.38, wellDepth: 1.2, blockades: -1.8 }
};

export class BoardEvaluator {
  public static evaluate(
    board: (string | null)[][],
    weights: HeuristicWeights,
    linesCleared: number = 0
  ): number {
    const colHeights = this.getColumnHeights(board);
    const aggregateHeight = colHeights.reduce((a, b) => a + b, 0);
    const holes = this.countHoles(board, colHeights);
    const bumpiness = this.calculateBumpiness(colHeights);
    const wellDepth = this.getWellDepth(colHeights);
    const blockades = this.countBlockades(board, colHeights);

    return (
      weights.aggregateHeight * aggregateHeight +
      weights.completeLines * linesCleared +
      weights.holes * holes +
      weights.bumpiness * bumpiness +
      weights.wellDepth * wellDepth +
      weights.blockades * blockades
    );
  }

  public static getColumnHeights(board: (string | null)[][]): number[] {
    const heights = new Array(BOARD_WIDTH).fill(0);
    for (let c = 0; c < BOARD_WIDTH; c++) {
      for (let r = 0; r < BOARD_TOTAL_HEIGHT; r++) {
        if (board[r][c] !== null) {
          heights[c] = BOARD_TOTAL_HEIGHT - r;
          break;
        }
      }
    }
    return heights;
  }

  public static countHoles(board: (string | null)[][], heights: number[]): number {
    let holes = 0;
    for (let c = 0; c < BOARD_WIDTH; c++) {
      const topRow = BOARD_TOTAL_HEIGHT - heights[c];
      for (let r = topRow + 1; r < BOARD_TOTAL_HEIGHT; r++) {
        if (board[r][c] === null) {
          holes++;
        }
      }
    }
    return holes;
  }

  public static calculateBumpiness(heights: number[]): number {
    let bumpiness = 0;
    for (let i = 0; i < heights.length - 1; i++) {
      bumpiness += Math.abs(heights[i] - heights[i + 1]);
    }
    return bumpiness;
  }

  public static getWellDepth(heights: number[]): number {
    // Reward well on the right column (col 9) for standard Tetris setups
    const wellCol = BOARD_WIDTH - 1;
    const wellHeight = heights[wellCol];
    const adjacentHeight = heights[wellCol - 1];
    return Math.max(0, adjacentHeight - wellHeight);
  }

  public static countBlockades(board: (string | null)[][], heights: number[]): number {
    let blockades = 0;
    for (let c = 0; c < BOARD_WIDTH; c++) {
      let foundHole = false;
      for (let r = BOARD_TOTAL_HEIGHT - 1; r >= BOARD_TOTAL_HEIGHT - heights[c]; r--) {
        if (board[r][c] === null) {
          foundHole = true;
        } else if (foundHole) {
          blockades++;
        }
      }
    }
    return blockades;
  }

  public static findBestPlacement(
    board: (string | null)[][],
    pieceType: TetrominoType,
    difficulty: number
  ): PlacementCandidate | null {
    // Interpolate weights based on difficulty 1..10
    const clampedDiff = Math.max(1, Math.min(10, difficulty));
    const lowerKey = [1, 3, 5, 7, 10].reverse().find(k => k <= clampedDiff) || 1;
    const weights = AI_WEIGHTS_PRESETS[lowerKey] || AI_WEIGHTS_PRESETS[5];

    let bestScore = -Infinity;
    let bestPlacement: PlacementCandidate | null = null;

    const numRotations = (pieceType === 'O' ? 1 : (pieceType === 'I' || pieceType === 'S' || pieceType === 'Z') ? 2 : 4);

    for (let r = 0; r < numRotations; r++) {
      const rot = r as RotationState;
      const shape = PIECES[pieceType].shapes[rot];
      const minX = Math.min(...shape.map(p => p.x));
      const maxX = Math.max(...shape.map(p => p.x));

      for (let x = -minX; x < BOARD_WIDTH - maxX; x++) {
        // Drop to lowest valid Y
        let y = 0;
        let valid = false;

        while (this.isValidPosition(board, pieceType, rot, x, y + 1)) {
          y++;
          valid = true;
        }

        if (!valid && !this.isValidPosition(board, pieceType, rot, x, y)) {
          continue;
        }

        // Simulate placement
        const sim = this.simulatePlacement(board, pieceType, rot, x, y);
        let evalScore = this.evaluate(sim.newBoard, weights, sim.linesCleared);

        // Add small random noise at lower difficulty to simulate human mistake rate
        if (difficulty < 8) {
          const noiseRange = (9 - difficulty) * 0.8;
          evalScore += (Math.random() - 0.5) * noiseRange;
        }

        if (evalScore > bestScore) {
          bestScore = evalScore;
          bestPlacement = {
            rotation: rot,
            x,
            y,
            score: evalScore,
            linesCleared: sim.linesCleared
          };
        }
      }
    }

    return bestPlacement;
  }

  private static isValidPosition(
    board: (string | null)[][],
    type: TetrominoType,
    rot: RotationState,
    x: number,
    y: number
  ): boolean {
    const shape = PIECES[type].shapes[rot];
    for (const pt of shape) {
      const bx = pt.x + x;
      const by = pt.y + y;
      if (bx < 0 || bx >= BOARD_WIDTH || by >= BOARD_TOTAL_HEIGHT || by < 0) {
        return false;
      }
      if (board[by][bx] !== null) {
        return false;
      }
    }
    return true;
  }

  private static simulatePlacement(
    board: (string | null)[][],
    type: TetrominoType,
    rot: RotationState,
    x: number,
    y: number
  ): { newBoard: (string | null)[][]; linesCleared: number } {
    // Clone board rows
    const newBoard = board.map(row => [...row]);
    const shape = PIECES[type].shapes[rot];

    for (const pt of shape) {
      const bx = pt.x + x;
      const by = pt.y + y;
      if (by >= 0 && by < BOARD_TOTAL_HEIGHT && bx >= 0 && bx < BOARD_WIDTH) {
        newBoard[by][bx] = '#fff';
      }
    }

    let linesCleared = 0;
    for (let r = BOARD_TOTAL_HEIGHT - 1; r >= 0; r--) {
      if (newBoard[r].every(c => c !== null)) {
        newBoard.splice(r, 1);
        newBoard.unshift(new Array(BOARD_WIDTH).fill(null));
        linesCleared++;
        r++; // check row index again
      }
    }

    return { newBoard, linesCleared };
  }
}
