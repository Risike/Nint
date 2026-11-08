import { GARBAGE_ATTACK, SCORING } from './constants';
import { TSpinType } from './tspin';

export interface ClearResult {
  linesCleared: number;
  scoreGained: number;
  garbageSent: number;
  text: string;
  isB2B: boolean;
  b2bChain: number;
  comboCount: number;
  isPerfectClear: boolean;
  tSpin: TSpinType;
}

export class ScoringSystem {
  public static evaluateClear({
    linesCleared,
    tSpin,
    currentLevel,
    isB2BActive,
    currentB2BChain = 0,
    currentCombo,
    isPerfectClear
  }: {
    linesCleared: number;
    tSpin: TSpinType;
    currentLevel: number;
    isB2BActive: boolean;
    currentB2BChain?: number;
    currentCombo: number;
    isPerfectClear: boolean;
  }): ClearResult {
    let baseScore = 0;
    let baseGarbage = 0;
    let label = '';
    let isDifficult = false;

    if (tSpin === 'regular') {
      if (linesCleared === 0) {
        baseScore = SCORING.TSPIN_NO_LINES;
        label = 'T-SPIN';
      } else if (linesCleared === 1) {
        baseScore = SCORING.TSPIN_SINGLE;
        baseGarbage = GARBAGE_ATTACK.TSPIN_SINGLE;
        label = 'T-SPIN SINGLE';
        isDifficult = true;
      } else if (linesCleared === 2) {
        baseScore = SCORING.TSPIN_DOUBLE;
        baseGarbage = GARBAGE_ATTACK.TSPIN_DOUBLE;
        label = 'T-SPIN DOUBLE';
        isDifficult = true;
      } else if (linesCleared === 3) {
        baseScore = SCORING.TSPIN_TRIPLE;
        baseGarbage = GARBAGE_ATTACK.TSPIN_TRIPLE;
        label = 'T-SPIN TRIPLE';
        isDifficult = true;
      }
    } else if (tSpin === 'mini') {
      if (linesCleared === 0) {
        baseScore = SCORING.MINI_TSPIN_NO_LINES;
        label = 'MINI T-SPIN';
      } else if (linesCleared === 1) {
        baseScore = SCORING.MINI_TSPIN_SINGLE;
        baseGarbage = GARBAGE_ATTACK.MINI_TSPIN_SINGLE;
        label = 'MINI T-SPIN SINGLE';
        isDifficult = true;
      }
    } else {
      // Normal clears
      if (linesCleared === 1) {
        baseScore = SCORING.SINGLE;
        baseGarbage = GARBAGE_ATTACK.SINGLE;
        label = 'SINGLE';
      } else if (linesCleared === 2) {
        baseScore = SCORING.DOUBLE;
        baseGarbage = GARBAGE_ATTACK.DOUBLE;
        label = 'DOUBLE';
      } else if (linesCleared === 3) {
        baseScore = SCORING.TRIPLE;
        baseGarbage = GARBAGE_ATTACK.TRIPLE;
        label = 'TRIPLE';
      } else if (linesCleared === 4) {
        baseScore = SCORING.TETRIS;
        baseGarbage = GARBAGE_ATTACK.TETRIS;
        label = 'TETRIS';
        isDifficult = true;
      }
    }

    let scoreGained = baseScore * currentLevel;
    let garbageSent = baseGarbage;

    // Back-to-Back (B2B) handling strictly adhering to Tetris Guideline
    let newB2B = isB2BActive;
    let newB2BChain = currentB2BChain;

    if (linesCleared > 0) {
      if (isDifficult) {
        if (isB2BActive) {
          // Consecutive difficult clear gets 1.5x score bonus and +1 garbage bonus
          scoreGained = Math.floor(scoreGained * SCORING.B2B_MULTIPLIER);
          garbageSent += GARBAGE_ATTACK.B2B_BONUS;
          newB2BChain = currentB2BChain + 1;
          label = `B2B ${label}`;
        } else {
          // First difficult clear arms B2B
          newB2BChain = 1;
        }
        newB2B = true;
      } else {
        // Normal Single, Double, Triple breaks B2B chain
        newB2B = false;
        newB2BChain = 0;
      }
    } else {
      // Placing a piece with 0 lines cleared DOES NOT break B2B in Guideline
      newB2B = isB2BActive;
      newB2BChain = currentB2BChain;
    }

    // Combo calculation
    let newCombo = currentCombo;
    if (linesCleared > 0) {
      newCombo = currentCombo + 1;
      if (newCombo > 0) {
        scoreGained += SCORING.COMBO_BONUS_PER_COMBO * newCombo * currentLevel;
        const comboIndex = Math.min(newCombo, GARBAGE_ATTACK.COMBO_BONUS.length - 1);
        garbageSent += GARBAGE_ATTACK.COMBO_BONUS[comboIndex];
      }
    } else {
      newCombo = -1; // Reset combo if piece placed without line clear
    }

    // Perfect Clear bonus
    if (isPerfectClear) {
      label = label ? `PERFECT CLEAR ${label}` : 'PERFECT CLEAR';
      let pcScore = SCORING.PERFECT_CLEAR_SINGLE;
      if (linesCleared === 2) pcScore = SCORING.PERFECT_CLEAR_DOUBLE;
      if (linesCleared === 3) pcScore = SCORING.PERFECT_CLEAR_TRIPLE;
      if (linesCleared === 4) pcScore = (newB2BChain > 1) ? SCORING.PERFECT_CLEAR_B2B_TETRIS : SCORING.PERFECT_CLEAR_TETRIS;
      scoreGained += pcScore * currentLevel;
      garbageSent += GARBAGE_ATTACK.PERFECT_CLEAR;
    }

    return {
      linesCleared,
      scoreGained,
      garbageSent,
      text: label,
      isB2B: newB2B,
      b2bChain: newB2BChain,
      comboCount: newCombo,
      isPerfectClear,
      tSpin
    };
  }
}
