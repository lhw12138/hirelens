const attempts = new Map<string, { count: number; until: number }>();
export function allowAttempt(key: string, max = 8, now = Date.now()) {
  for (const [id, value] of attempts) if (value.until <= now) attempts.delete(id);
  const item = attempts.get(key);
  if (item && item.count >= max) return false;
  if (!item && attempts.size >= 5000) return false;
  attempts.set(key, { count: (item?.count ?? 0) + 1, until: item?.until ?? now + 15 * 60 * 1000 });
  return true;
}
