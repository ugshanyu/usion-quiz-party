/**
 * Authentication: the client forwards the Usion platform JWT it received in
 * the SDK init config. We never decode it ourselves — we introspect it against
 * the platform (`GET /auth/me`) and cache the result. The platform base URL is
 * pinned server-side (never taken from the client).
 */
const USION_API_URL = (process.env.USION_API_URL || 'https://mobile.mongolai.mn').replace(/\/$/, '');

const OK_TTL_MS = 10 * 60 * 1000;
const BAD_TTL_MS = 60 * 1000;
const MAX_CACHE = 5000;
const cache = new Map(); // token -> { user|null, exp }

function remember(token, user, ttl) {
  if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value);
  cache.set(token, { user, exp: Date.now() + ttl });
}

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'UNAUTHENTICATED' });

  // Local-development escape hatch — inert in production.
  if (process.env.NODE_ENV !== 'production' && token.startsWith('dev:')) {
    req.user = { id: token.slice(4) || 'dev-user', name: 'Dev User', avatar: null };
    return next();
  }

  const hit = cache.get(token);
  if (hit && hit.exp > Date.now()) {
    if (!hit.user) return res.status(401).json({ error: 'UNAUTHENTICATED' });
    req.user = hit.user;
    return next();
  }

  try {
    const r = await fetch(USION_API_URL + '/auth/me', {
      headers: { Authorization: 'Bearer ' + token },
      signal: AbortSignal.timeout(6000),
    });
    if (r.status === 401 || r.status === 403) {
      remember(token, null, BAD_TTL_MS);
      return res.status(401).json({ error: 'UNAUTHENTICATED' });
    }
    if (!r.ok) return res.status(502).json({ error: 'AUTH_UPSTREAM' });
    const u = await r.json();
    if (!u || !u.id) return res.status(502).json({ error: 'AUTH_UPSTREAM' });
    const user = {
      id: String(u.id),
      name: String(u.display_name || u.name || 'Player').slice(0, 80),
      avatar: typeof u.avatar === 'string' ? u.avatar.slice(0, 512) : null,
    };
    remember(token, user, OK_TTL_MS);
    req.user = user;
    next();
  } catch {
    res.status(502).json({ error: 'AUTH_UPSTREAM' });
  }
}
