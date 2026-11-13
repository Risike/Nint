import { BOARD_TOTAL_HEIGHT, BOARD_WIDTH } from './constants';

export class GarbageManager {
  private pendingQueue: number[] = [];
  private holeColumn: number = Math.floor(Math.random() * BOARD_WIDTH);
  private linesInHoleGroup: number = 0;

  public getPendingCount(): number {
    return this.pendingQueue.reduce((acc, count) => acc + count, 0);
  }

  public enqueueGarbage(amount: number) {
    if (amount > 0) {
      this.pendingQueue.push(amount);
    }
  }

  // Cancels incoming garbage using attack lines. Returns remaining attack lines that penetrate through to the opponent.
  public cancelGarbage(attackAmount: number): number {
    let remainingAttack = attackAmount;

    while (remainingAttack > 0 && this.pendingQueue.length > 0) {
      if (this.pendingQueue[0] <= remainingAttack) {
        remainingAttack -= this.pendingQueue[0];
        this.pendingQueue.shift();
      } else {
        this.pendingQueue[0] -= remainingAttack;
        remainingAttack = 0;
      }
    }

    return remainingAttack;
  }

  // Consumes pending garbage and inserts garbage rows at the bottom of the board
  public insertGarbage(board: (string | null)[][], maxLinesToInsert: number = BOARD_TOTAL_HEIGHT): { insertedLines: number; toppedOut: boolean } {
    let linesToInsert = 0;
    while (this.pendingQueue.length > 0 && linesToInsert < maxLinesToInsert) {
      const needed = maxLinesToInsert - linesToInsert;
      if (this.pendingQueue[0] <= needed) {
        linesToInsert += this.pendingQueue.shift()!;
      } else {
        linesToInsert += needed;
        this.pendingQueue[0] -= needed;
      }
    }

    if (linesToInsert === 0) {
      return { insertedLines: 0, toppedOut: false };
    }

    // Check if blocks in the top lines will be pushed off above ceiling
    let toppedOut = false;
    for (let r = 0; r < linesToInsert; r++) {
      for (let c = 0; c < BOARD_WIDTH; c++) {
        if (board[r][c] !== null) {
          toppedOut = true;
          break;
        }
      }
    }

    // Shift existing rows UP
    for (let r = 0; r < BOARD_TOTAL_HEIGHT - linesToInsert; r++) {
      board[r] = [...board[r + linesToInsert]];
    }

    // Insert new garbage rows at the bottom. The Guideline keeps the same
    // gap for a group of eight lines before choosing a new random column.
    for (let r = BOARD_TOTAL_HEIGHT - linesToInsert; r < BOARD_TOTAL_HEIGHT; r++) {
      if (this.linesInHoleGroup >= 8) {
        this.holeColumn = Math.floor(Math.random() * BOARD_WIDTH);
        this.linesInHoleGroup = 0;
      }
      const newRow: (string | null)[] = new Array(BOARD_WIDTH).fill('#64748b'); // Garbage grey
      newRow[this.holeColumn] = null;
      board[r] = newRow;
      this.linesInHoleGroup++;
    }

    return { insertedLines: linesToInsert, toppedOut };
  }

  public reset() {
    this.pendingQueue = [];
    this.holeColumn = Math.floor(Math.random() * BOARD_WIDTH);
    this.linesInHoleGroup = 0;
  }
}
