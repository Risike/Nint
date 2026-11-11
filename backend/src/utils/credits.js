/**
 * Awards one credit per cleared line to an account.
 * Credits are always derived from server-validated result data.
 */
export function awardLineCredits(db, userId, lines, now = Date.now()) {
  const amount = Number.isSafeInteger(lines) && lines > 0 ? lines : 0;
  if (amount === 0) return 0;

  const result = db.prepare(`
    UPDATE users
    SET credits = credits + ?, updated_at = ?
    WHERE id = ?
  `).run(amount, now, userId);

  return result.changes > 0 ? amount : 0;
}
