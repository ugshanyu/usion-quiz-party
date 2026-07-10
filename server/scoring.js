/**
 * Speed-based scoring, shared by always-mode (graded here) and live mode
 * (the host device applies the same formula client-side — keep in sync with
 * public/live.js `livePoints`).
 *
 * Correct answer: 1000 points at 0s decaying linearly to 500 at the full time
 * limit. Wrong or missing answer: 0.
 */
export function points(correct, elapsedMs, timeSec) {
  if (!correct) return 0;
  const windowMs = Math.max(1, Number(timeSec) || 20) * 1000;
  const elapsed = Math.min(Math.max(Number(elapsedMs) || 0, 0), windowMs);
  return Math.round(1000 - 500 * (elapsed / windowMs));
}
