import { BOARD_TOTAL_HEIGHT, BOARD_WIDTH } from './constants';

export interface GarbageAttack {
  id: string;
  amount: number;
  timestamp: number;
}

export class GarbageManager {
  private pendingQueue: number[] = [];

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
  public insertGarbage(board: (string | null)[][], maxLinesToInsert: number = 8): { insertedLines: number; toppedOut: boolean } {
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

    // Insert new garbage rows at the bottom
    // We choose a hole column, often sticking with the same hole for consecutive lines in the same chunk
    let holeCol = Math.floor(Math.random() * BOARD_WIDTH);
    for (let r = BOARD_TOTAL_HEIGHT - linesToInsert; r < BOARD_TOTAL_HEIGHT; r++) {
      // 20% chance to switch hole column per line
      if (Math.random() < 0.2) {
        holeCol = Math.floor(Math.random() * BOARD_WIDTH);
      }
      const newRow: (string | null)[] = new Array(BOARD_WIDTH).fill('#64748b'); // Garbage grey
      newRow[holeCol] = null;
      board[r] = newRow;
    }

    return { insertedLines: linesToInsert, toppedOut };
  }

  public reset() {
    this.pendingQueue = [];
  }
}
