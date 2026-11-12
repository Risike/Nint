export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

const PASSWORD_SPECIAL_PATTERN = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/;

export function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return 'Password must be at least 8 characters';
  if (password.length > PASSWORD_MAX_LENGTH) return 'Password must be at most 128 characters';
  if (!/[a-z]/.test(password)) return 'Password must contain at least one lowercase letter';
  if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter';
  if (!/\d/.test(password)) return 'Password must contain at least one number';
  if (!PASSWORD_SPECIAL_PATTERN.test(password)) return 'Password must contain at least one special character';
  return null;
}
