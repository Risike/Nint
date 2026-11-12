// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  BOSS_LEVELS,
  getBossLevelDefinition,
  getBossSpeedLevel,
  getUnlockedBossLevel,
  MAX_BOSS_LEVEL,
  unlockBossLevelAfterWin
} from '../src/game/bossLevels';

describe('Boss level progression', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defines ten levels with growing HP and starting speed', () => {
    expect(BOSS_LEVELS).toHaveLength(MAX_BOSS_LEVEL);
    expect(getBossLevelDefinition(1)).toMatchObject({
      hp: 20_000,
      startingSpeedLevel: 1
    });
    expect(getBossLevelDefinition(2)).toMatchObject({
      hp: 25_000,
      startingSpeedLevel: 2
    });
    expect(getBossLevelDefinition(10)).toMatchObject({
      hp: 65_000,
      startingSpeedLevel: 10
    });
  });

  it('starts with only level 1 unlocked', () => {
    expect(getUnlockedBossLevel()).toBe(1);
    expect(getUnlockedBossLevel('user-a')).toBe(1);
  });

  it('unlocks the next boss level after a win', () => {
    expect(unlockBossLevelAfterWin(1, 'user-a')).toBe(2);
    expect(getUnlockedBossLevel('user-a')).toBe(2);

    expect(unlockBossLevelAfterWin(2, 'user-a')).toBe(3);
    expect(getUnlockedBossLevel('user-a')).toBe(3);
  });

  it('does not allow skipping or re-unlocking lower levels', () => {
    expect(unlockBossLevelAfterWin(5, 'user-a')).toBe(1);

    unlockBossLevelAfterWin(1, 'user-a');
    expect(unlockBossLevelAfterWin(1, 'user-a')).toBe(2);
    expect(getUnlockedBossLevel('user-a')).toBe(2);
  });

  it('caps progression at the final boss level', () => {
    for (let level = 1; level <= MAX_BOSS_LEVEL; level += 1) {
      unlockBossLevelAfterWin(level, 'user-a');
    }

    expect(getUnlockedBossLevel('user-a')).toBe(MAX_BOSS_LEVEL);
    expect(unlockBossLevelAfterWin(MAX_BOSS_LEVEL, 'user-a')).toBe(MAX_BOSS_LEVEL);
  });

  it('raises the boss speed by one every two applied attacks', () => {
    expect(getBossSpeedLevel(1, 0)).toBe(1);
    expect(getBossSpeedLevel(1, 1)).toBe(1);
    expect(getBossSpeedLevel(1, 2)).toBe(2);
    expect(getBossSpeedLevel(1, 3)).toBe(2);
    expect(getBossSpeedLevel(1, 4)).toBe(3);
    expect(getBossSpeedLevel(10, 2)).toBe(11);
  });

  it('keeps boss progress separate for guests and signed-in players', () => {
    unlockBossLevelAfterWin(1, 'user-a');
    unlockBossLevelAfterWin(2, 'user-a');
    unlockBossLevelAfterWin(1, 'user-b');

    expect(getUnlockedBossLevel('user-a')).toBe(3);
    expect(getUnlockedBossLevel('user-b')).toBe(2);
    expect(getUnlockedBossLevel()).toBe(1);
  });
});