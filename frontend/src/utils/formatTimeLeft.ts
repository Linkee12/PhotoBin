const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function formatTimeLeft(expiresAt: number | null, now = Date.now()): string {
  if (expiresAt === null) return "";
  const remaining = expiresAt - now;
  if (remaining <= 0) return "Expired";
  if (remaining >= DAY) {
    const days = Math.floor(remaining / DAY);
    return days === 1 ? "1 day left" : `${days} days left`;
  }
  if (remaining >= HOUR) {
    const hours = Math.floor(remaining / HOUR);
    return hours === 1 ? "1 hour left" : `${hours} hours left`;
  }
  const minutes = Math.max(1, Math.floor(remaining / MINUTE));
  return minutes === 1 ? "1 minute left" : `${minutes} minutes left`;
}
