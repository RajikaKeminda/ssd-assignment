/**
 * Parses a short duration string like "15m", "7d", "1h" into milliseconds.
 * Used to size the refresh-token cookie's `maxAge` from
 * `env.JWT_REFRESH_EXPIRATION` (see SECURITY.md #5).
 */
export function parseDurationToMs(value: string, fallbackMs: number): number {
  const match = value.match(/^(\d+)\s*(d|h|m|s)$/i);
  if (!match) return fallbackMs;

  const amount = parseInt(match[1], 10);
  const unitMs: Record<string, number> = {
    d: 24 * 60 * 60 * 1000,
    h: 60 * 60 * 1000,
    m: 60 * 1000,
    s: 1000,
  };

  return amount * unitMs[match[2].toLowerCase()];
}
