import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const rulesUrl = new URL('../../firebase/database.rules.json', import.meta.url);

describe('firebase database rules', () => {
  it('is valid JSON', () => {
    expect(() => JSON.parse(readFileSync(rulesUrl, 'utf8'))).not.toThrow();
  });

  it('keeps every online path closed to unauthenticated clients', () => {
    const { rules } = JSON.parse(readFileSync(rulesUrl, 'utf8'));

    expect(rules['.read']).toBe(false);
    expect(rules['.write']).toBe(false);

    const match = rules.matches.$matchId;
    expect(match['.read']).toContain('auth != null');
    expect(match['.write']).toContain('auth != null');
    expect(match.seed['.write']).toBe(false);
    expect(match.rematch.$uid['.validate']).toBe('newData.isBoolean()');

    expect(rules.rooms.$roomCode['.read']).toBe('auth != null');
    expect(rules.matchmaking_queue['.read']).toBe('auth != null');
  });
});
