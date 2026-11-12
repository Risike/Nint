// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  getUnlockedCpuLevel,
  MAX_CPU_LEVEL,
  unlockCpuLevelAfterWin
} from '../src/game/cpuLevels';

describe('CPU level progression', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts with only level 1 unlocked', () => {
    expect(getUnlockedCpuLevel()).toBe(1);
    expect(getUnlockedCpuLevel('user-a')).toBe(1);
  });

  it('unlocks the next level after a win on the current level', () => {
    expect(unlockCpuLevelAfterWin(1, 'user-a')).toBe(2);
    expect(getUnlockedCpuLevel('user-a')).toBe(2);

    expect(unlockCpuLevelAfterWin(2, 'user-a')).toBe(3);
    expect(getUnlockedCpuLevel('user-a')).toBe(3);
  });

  it('does not skip locked levels by beating a lower level repeatedly', () => {
    unlockCpuLevelAfterWin(1, 'user-a');
    expect(unlockCpuLevelAfterWin(1, 'user-a')).toBe(2);
    expect(getUnlockedCpuLevel('user-a')).toBe(2);
  });

  it('does not unlock a level that was not accessible yet', () => {
    expect(unlockCpuLevelAfterWin(5, 'user-a')).toBe(1);
    expect(getUnlockedCpuLevel('user-a')).toBe(1);
  });

  it('caps progression at the final level', () => {
    for (let level = 1; level <= MAX_CPU_LEVEL; level += 1) {
      unlockCpuLevelAfterWin(level, 'user-a');
    }

    expect(getUnlockedCpuLevel('user-a')).toBe(MAX_CPU_LEVEL);
    expect(unlockCpuLevelAfterWin(MAX_CPU_LEVEL, 'user-a')).toBe(MAX_CPU_LEVEL);
  });

  it('keeps progress separate for guests and signed-in players', () => {
    unlockCpuLevelAfterWin(1, 'user-a');
    unlockCpuLevelAfterWin(2, 'user-a');
    unlockCpuLevelAfterWin(1, 'user-b');

    expect(getUnlockedCpuLevel('user-a')).toBe(3);
    expect(getUnlockedCpuLevel('user-b')).toBe(2);
    expect(getUnlockedCpuLevel()).toBe(1);
  });
});
