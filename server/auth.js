/**
 * Authentication: embedded mini-apps receive a SCOPED iframe token
 * (purpose="iframe", bound to this service) in the SDK init config — never
 * the user's full JWT. The client forwards it; we verify it against the
 * platform's purpose-built endpoint `POST /iframe/verify-token` (scoped to
 * OUR service id) and cache the result. The platform base URL and service id
 * are pinned server-side (never taken from the client).
 */
const USION_API_URL = (process.env.USION_API_URL || 'https://mobile.mongolai.mn').replace(/\/$/, '');
const USION_SERVICE_ID = process.env.USION_SERVICE_ID || 'quiz-party';

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
    const r = await fetch(USION_API_URL + '/iframe/verify-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, expected_service_id: USION_SERVICE_ID }),
      signal: AbortSignal.timeout(6000),
    });
    if (r.status === 401 || r.status === 403 || r.status === 422) {
      remember(token, null, BAD_TTL_MS);
      return res.status(401).json({ error: 'UNAUTHENTICATED' });
    }
    if (!r.ok) return res.status(502).json({ error: 'AUTH_UPSTREAM' });
    const u = await r.json();
    if (!u || !u.user_id) return res.status(502).json({ error: 'AUTH_UPSTREAM' });
    const user = {
      id: String(u.user_id),
      name: String(u.name || 'Player').slice(0, 80),
      avatar: typeof u.avatar === 'string' ? u.avatar.slice(0, 512) : null,
    };
    remember(token, user, OK_TTL_MS);
    req.user = user;
    next();
  } catch {
    res.status(502).json({ error: 'AUTH_UPSTREAM' });
  }
}
