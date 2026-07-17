/* Quiz Party — API clients: our own server (/api/*) and the Usion platform. */
(function () {
  'use strict';
  const QP = window.QP;

  /** Wait up to timeoutMs for the host to deliver a (new) scoped token via
   *  (re-)INIT. The host sends its first INIT before the token mint finishes,
   *  so the first seconds of an embedded session are legitimately tokenless. */
  QP.waitForToken = async function (previous, timeoutMs) {
    const deadline = Date.now() + (timeoutMs || 4000);
    for (;;) {
      const current = (window.Usion && Usion.config && Usion.config.authToken) || QP.state.authToken || null;
      if (current && current !== previous) return current;
      if (Date.now() > deadline) return null;
      await new Promise((r) => setTimeout(r, 250));
    }
  };

  async function request(base, path, opts, token) {
    opts = opts || {};
    let res;
    try {
      res = await fetch(base + path, {
        method: opts.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: 'Bearer ' + token } : {}),
        },
        body: opts.body ? JSON.stringify(opts.body) : undefined,
      });
    } catch {
      const err = new Error('offline');
      err.code = 'OFFLINE';
      throw err;
    }
    let data = null;
    try { data = await res.json(); } catch { /* empty body */ }
    if (!res.ok) {
      const err = new Error((data && (data.error || data.detail)) || 'HTTP ' + res.status);
      err.code = (data && data.error) || 'HTTP_' + res.status;
      err.status = res.status;
      throw err;
    }
    return data;
  }

  /** Our own backend. Reads the token live — the host re-mints the scoped
   *  iframe token and re-INITs before expiry, and the SDK merges it into
   *  Usion.config. On an embedded 401, the token was missing or stale (the
   *  host's FIRST INIT races its token mint) — wait briefly for a fresh one
   *  and retry once before surfacing the "reopen" notice. */
  QP.api = async function (path, opts) {
    const token = (window.Usion && Usion.config && Usion.config.authToken) || QP.state.authToken;
    try {
      return await request('', '/api' + path, opts, token);
    } catch (err) {
      if (err.status !== 401 || !QP.state.embedded) throw err;
      const fresh = await QP.waitForToken(token, 5000);
      if (fresh) {
        try { return await request('', '/api' + path, opts, fresh); } catch (err2) { err = err2; }
      }
      if (err.status === 401 && !QP._auth401Notified) {
        QP._auth401Notified = true;
        setTimeout(() => { QP._auth401Notified = false; }, 15000);
        QP.toast(QP.t('session_reopen'));
      }
      throw err;
    }
  };

  /** Upload question media (image/sound) as a raw body. Resolves {url, type}. */
  QP.upload = async function (file) {
    const token = (window.Usion && Usion.config && Usion.config.authToken) || QP.state.authToken;
    let res;
    try {
      res = await fetch('/api/media', {
        method: 'POST',
        headers: { 'Content-Type': file.type || 'application/octet-stream', Authorization: 'Bearer ' + token },
        body: file,
      });
    } catch { const e = new Error('offline'); e.code = 'OFFLINE'; throw e; }
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const e = new Error((data && data.error) || 'HTTP ' + res.status);
      e.code = (data && data.error) || 'HTTP_' + res.status;
      throw e;
    }
    return data;
  };

  /** The Usion platform REST API (room create/join for live mode). */
  QP.platformApi = function (path, opts) {
    const base = (QP.state.config && QP.state.config.apiUrl || '').replace(/\/$/, '');
    const token = window.Usion && Usion.user && Usion.user.getToken && Usion.user.getToken();
    if (!base || !token) {
      const err = new Error('platform unavailable');
      err.code = 'NO_PLATFORM';
      return Promise.reject(err);
    }
    return request(base, path, opts, token);
  };
})();
