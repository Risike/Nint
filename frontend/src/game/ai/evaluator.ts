import {
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
  piece?: TetrominoType;
  useHold?: boolean;
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
  1: { aggregateHeight: -0.18, completeLines: 0.35, holes: -0.55, bumpiness: -0.06, wellDepth: 0.05, blockades: -0.15 },
  3: { aggregateHeight: -0.3, completeLines: 0.65, holes: -1.1, bumpiness: -0.12, wellDepth: 0.15, blockades: -0.35 },
  5: { aggregateHeight: -0.45, completeLines: 1.2, holes: -2.2, bumpiness: -0.2, wellDepth: 0.3, blockades: -0.8 },
  7: { aggregateHeight: -0.5, completeLines: 2.2, holes: -4.5, bumpiness: -0.26, wellDepth: 0.45, blockades: -1.3 },
  8: { aggregateHeight: -0.48, completeLines: 2.8, holes: -5.8, bumpiness: -0.28, wellDepth: 0.5, blockades: -1.5 },
  10: { aggregateHeight: -0.42, completeLines: 4.0, holes: -8.0, bumpiness: -0.3, wellDepth: 0.55, blockades: -2.0 }
};

interface SimulatedPlacement {
  candidate: PlacementCandidate;
  board: (string | null)[][];
}

interface PlanOption {
  piece: TetrominoType;
  useHold: boolean;
  following: TetrominoType[];
}

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
    const perfectClear = linesCleared > 0 && board.every(row => row.every(cell => cell === null));

    return (
      weights.aggregateHeight * aggregateHeight +
      weights.completeLines * linesCleared +
      weights.holes * holes +
      weights.bumpiness * bumpiness +
      weights.wellDepth * wellDepth +
      weights.blockades * blockades +
      (perfectClear ? 24 : 0)
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
    // Reward a deep right-side well for Tetris setups, but never reward
    // simply stacking the rest of the board higher than the well.
    const wellCol = BOARD_WIDTH - 1;
    const wellHeight = heights[wellCol];
    const adjacentHeight = heights[wellCol - 1];
    return Math.max(0, Math.min(4, adjacentHeight - wellHeight));
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

  private static getWeights(difficulty: number): HeuristicWeights {
    const clampedDiff = Math.max(1, Math.min(10, difficulty));
    const lowerKey = [1, 3, 5, 7, 8, 10].reverse().find(k => k <= clampedDiff) || 1;
    return AI_WEIGHTS_PRESETS[lowerKey] || AI_WEIGHTS_PRESETS[5];
  }

  public static findBestPlacement(
    board: (string | null)[][],
    pieceType: TetrominoType,
    difficulty: number
  ): PlacementCandidate | null {
    const weights = this.getWeights(difficulty);
    const placements = this.enumeratePlacements(board, pieceType, weights);
    if (placements.length === 0) return null;

    let bestScore = -Infinity;
    let bestPlacement: PlacementCandidate | null = null;

    for (const placement of placements) {
      let evalScore = placement.candidate.score;

      // Lower levels make deliberately imperfect decisions.
      if (difficulty < 8) {
        const noiseRange = (9 - difficulty) * 0.8;
        evalScore += (Math.random() - 0.5) * noiseRange;
      }

      if (evalScore > bestScore) {
        bestScore = evalScore;
        bestPlacement = {
          ...placement.candidate,
          piece: pieceType,
          useHold: false,
          score: evalScore
        };
      }
    }

    return bestPlacement;
  }

  /**
   * Plans one piece using a short lookahead of the upcoming queue and hold.
   * Grandmaster looks three pieces ahead with a beam over the best replies;
   * lower levels progressively fall back to shorter searches.
   */
  public static findBestPlan(
    board: (string | null)[][],
    currentPiece: TetrominoType,
    nextPieces: TetrominoType[] = [],
    holdPiece: TetrominoType | null = null,
    canHold: boolean = true,
    difficulty: number = 5
  ): PlacementCandidate | null {
    const clampedDiff = Math.max(1, Math.min(10, difficulty));

    if (clampedDiff < 6) {
      return this.findBestPlacement(board, currentPiece, clampedDiff);
    }

    const weights = this.getWeights(clampedDiff);
    const depth = clampedDiff >= 9 ? 3 : 2;
    const options: PlanOption[] = [{
      piece: currentPiece,
      useHold: false,
      following: nextPieces.slice(0, 2)
    }];

    if (clampedDiff >= 8 && canHold) {
      if (holdPiece) {
        options.push({
          piece: holdPiece,
          useHold: true,
          following: nextPieces.slice(0, 2)
        });
      } else if (nextPieces.length > 0) {
        options.push({
          piece: nextPieces[0],
          useHold: true,
          following: nextPieces.slice(1, 3)
        });
      }
    }

    let best: PlacementCandidate | null = null;
    let bestScore = -Infinity;

    for (const option of options) {
      const firstPlacements = this.enumeratePlacements(board, option.piece, weights);
      if (firstPlacements.length === 0) continue;

      firstPlacements.sort((a, b) => b.candidate.score - a.candidate.score);

      // Keep the search broad but bounded so the AI remains responsive.
      const firstBeam = depth === 3 ? 12 : 24;

      for (const first of firstPlacements.slice(0, firstBeam)) {
        let totalScore = first.candidate.score;

        if (depth >= 2 && option.following.length > 0) {
          const secondPlacements = this.enumeratePlacements(first.board, option.following[0], weights);
          secondPlacements.sort((a, b) => b.candidate.score - a.candidate.score);

          if (secondPlacements.length === 0) {
            totalScore = first.candidate.score - 1000;
          } else if (depth >= 3 && option.following.length > 1) {
            let bestPairScore = -Infinity;

            for (const second of secondPlacements.slice(0, 5)) {
              const thirdPlacements = this.enumeratePlacements(second.board, option.following[1], weights);
              thirdPlacements.sort((a, b) => b.candidate.score - a.candidate.score);

              const thirdScore = thirdPlacements.length > 0
                ? thirdPlacements[0].candidate.score
                : second.candidate.score - 1000;

              const pairScore = thirdScore + weights.completeLines * (
                first.candidate.linesCleared + second.candidate.linesCleared
              );

              if (pairScore > bestPairScore) {
                bestPairScore = pairScore;
              }
            }

            totalScore = bestPairScore;
          } else {
            totalScore = secondPlacements[0].candidate.score
              + weights.completeLines * first.candidate.linesCleared;
          }
        }

        if (totalScore > bestScore) {
          bestScore = totalScore;
          best = {
            ...first.candidate,
            piece: option.piece,
            useHold: option.useHold,
            score: totalScore
          };
        }
      }
    }

    if (best && clampedDiff < 8) {
      const noiseRange = (9 - clampedDiff) * 0.4;
      best.score += (Math.random() - 0.5) * noiseRange;
    }

    return best;
  }

  private static enumeratePlacements(
    board: (string | null)[][],
    pieceType: TetrominoType,
    weights: HeuristicWeights
  ): SimulatedPlacement[] {
    const placements: SimulatedPlacement[] = [];
    const numRotations = (pieceType === 'O' ? 1 : (pieceType === 'I' || pieceType === 'S' || pieceType === 'Z') ? 2 : 4);

    for (let r = 0; r < numRotations; r++) {
      const rot = r as RotationState;
      const shape = PIECES[pieceType].shapes[rot];
      const minX = Math.min(...shape.map(p => p.x));
      const maxX = Math.max(...shape.map(p => p.x));

      for (let x = -minX; x < BOARD_WIDTH - maxX; x++) {
        let y = 0;
        let valid = false;

        while (this.isValidPosition(board, pieceType, rot, x, y + 1)) {
          y++;
          valid = true;
        }

        if (!valid && !this.isValidPosition(board, pieceType, rot, x, y)) {
          continue;
        }

        const sim = this.simulatePlacement(board, pieceType, rot, x, y);
        const score = this.evaluate(sim.newBoard, weights, sim.linesCleared);

        placements.push({
          candidate: {
            rotation: rot,
            x,
            y,
            score,
            linesCleared: sim.linesCleared
          },
          board: sim.newBoard
        });
      }
    }

    return placements;
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
        r++;
      }
    }

    return { newBoard, linesCleared };
  }
}
