/** Tiny fixed-window in-memory rate limiter (single-instance deployment). */
const windows = new Map(); // key -> { n, reset }

setInterval(() => {
  const now = Date.now();
  for (const [key, w] of windows) if (w.reset <= now) windows.delete(key);
}, 60 * 1000).unref();

/** Returns true when the call is allowed; false when over the limit. */
export function allow(key, limit, windowMs) {
  const now = Date.now();
  const w = windows.get(key);
  if (!w || w.reset <= now) {
    windows.set(key, { n: 1, reset: now + windowMs });
    return true;
  }
  if (w.n >= limit) return false;
  w.n += 1;
  return true;
}

/** Express middleware factory. */
export function rateLimit(name, limit, windowMs) {
  return (req, res, next) => {
    const id = (req.user && req.user.id) || req.ip;
    if (!allow(`${name}:${id}`, limit, windowMs)) {
      return res.status(429).json({ error: 'RATE_LIMITED' });
    }
    next();
  };
}
