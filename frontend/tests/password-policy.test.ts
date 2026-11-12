import { describe, expect, it } from 'vitest';
import { validatePassword } from '../src/utils/passwordPolicy';

describe('password policy', () => {
  it('accepts a password with every required character class', () => {
    expect(validatePassword('Str0ng!Pass')).toBeNull();
  });

  it('rejects passwords that miss a requirement', () => {
    expect(validatePassword('Short1!')).toBe('Password must be at least 8 characters');
    expect(validatePassword('lowercase1!')).toBe('Password must contain at least one uppercase letter');
    expect(validatePassword('UPPERCASE1!')).toBe('Password must contain at least one lowercase letter');
    expect(validatePassword('NoNumber!')).toBe('Password must contain at least one number');
    expect(validatePassword('NoSpecial1')).toBe('Password must contain at least one special character');
  });
});
