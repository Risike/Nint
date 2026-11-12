export const USERNAME_PATTERN = /^[a-z0-9]{3,32}$/;

export function normalizeUsername(value) {
  return String(value ?? '').trim().toLowerCase();
}

/**
 * Builds a readable identifier from a display name or an email local part.
 * The result is not guaranteed to be unique; use ensureUniqueUsername.
 */
export function deriveUsername({ displayName, email } = {}) {
  const localPart = String(email || '').split('@')[0];
  let base = String(displayName || localPart || 'player')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

  if (!base) base = 'player';
  if (base.length < 3) base = `${base}player`;

  return base.slice(0, 24) || 'player';
}

export function ensureUniqueUsername(db, base, excludeUserId = null) {
  const root = (base || 'player').slice(0, 24);
  const find = excludeUserId
    ? db.prepare('SELECT id FROM users WHERE username = ? AND id != ?')
    : db.prepare('SELECT id FROM users WHERE username = ?');

  let candidate = root;
  let suffix = 2;
  while (find.get(...(excludeUserId ? [candidate, excludeUserId] : [candidate]))) {
    const suffixText = String(suffix);
    candidate = `${root.slice(0, 32 - suffixText.length)}${suffixText}`;
    suffix += 1;
  }
  return candidate;
}
