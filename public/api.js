/* Quiz Party — API clients: our own server (/api/*) and the Usion platform. */
(function () {
  'use strict';
  const QP = window.QP;

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
   *  Usion.config; a boot-time copy would go stale after an hour. */
  QP.api = function (path, opts) {
    const token = (window.Usion && Usion.config && Usion.config.authToken) || QP.state.authToken;
    return request('', '/api' + path, opts, token);
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
