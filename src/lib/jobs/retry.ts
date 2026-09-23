export function calculateBackoffMs(attempt: number, retryAfterSeconds?: number | null, random = Math.random) {
  if (retryAfterSeconds && retryAfterSeconds > 0) return Math.min(retryAfterSeconds * 1000, 60 * 60 * 1000);
  const base = Math.min(1000 * 2 ** Math.max(0, attempt - 1), 30 * 60 * 1000);
  return Math.round(base * (0.75 + random() * 0.5));
}
