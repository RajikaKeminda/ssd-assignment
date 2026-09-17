/**
 * SECURITY FIX (ReDoS via Unsanitized Regex — see SECURITY.md #4):
 * Several search/filter endpoints built a MongoDB `$regex` directly out of
 * raw, unescaped user input (e.g. `{ $regex: query.search, $options: 'i' }`).
 * Because Mongoose/MongoDB compiles that string as a real regular
 * expression, a client could submit a pattern with catastrophic
 * backtracking (e.g. `(a+)+$`, or a long run of nested quantifiers) and
 * make the single-threaded Node.js event loop hang evaluating it against
 * every candidate document — a denial-of-service affecting every user of
 * the API, not just the attacker.
 *
 * `escapeRegex` neutralizes all regex metacharacters so the string is
 * always matched literally, which is what a "search box" should do anyway.
 */
export function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
