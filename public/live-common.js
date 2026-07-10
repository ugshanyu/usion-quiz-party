/* Quiz Party — live mode: shared scoring + renderers used by host and player. */
(function () {
  'use strict';
  const QP = window.QP;
  const el = QP.el; const t = QP.t;

  QP.live = { activeRoom: null };

  /** Keep identical to server/scoring.js `points`. */
  QP.live.points = function (correct, elapsedMs, timeSec) {
    if (!correct) return 0;
    const windowMs = Math.max(1, Number(timeSec) || 20) * 1000;
    const elapsed = Math.min(Math.max(Number(elapsedMs) || 0, 0), windowMs);
    return Math.round(1000 - 500 * (elapsed / windowMs));
  };

  QP.live.rosterGrid = function (players) {
    const items = [...players.values()];
    if (!items.length) return el('p', { class: 'empty', text: t('live_no_players') });
    return el('div', { class: 'roster' }, items.map((p) => el('div', { class: 'roster-item' },
      QP.avatar(p.name, p.avatar),
      el('span', { class: 'roster-name', text: p.name || 'Player' }))));
  };

  /** board: [{p, name, avatar, total, gained?}] sorted desc. */
  QP.live.boardList = function (board, myId, limit) {
    const rows = (limit ? board.slice(0, limit) : board).map((entry, i) => el('div', {
      class: 'board-row' + (entry.p === myId ? ' me' : ''),
    },
    el('span', { class: 'board-rank', text: '#' + (i + 1) }),
    QP.avatar(entry.name, entry.avatar),
    el('span', { class: 'board-name', text: (entry.name || 'Player') + (entry.p === myId ? ' · ' + t('you') : '') }),
    entry.gained ? el('span', { class: 'points-gain', text: t('plus_points', { n: entry.gained }) }) : null,
    el('span', { class: 'board-score', text: QP.fmtNumber(entry.total) })));
    return el('div', { class: 'list' }, rows);
  };

  QP.live.podium = function (board, myId, onExit) {
    const medals = ['🥇', '🥈', '🥉'];
    const top = board.slice(0, 3);
    return el('div', { class: 'content center-col' },
      el('h2', { text: t('live_podium') }),
      el('div', { class: 'podium' }, top.map((entry, i) => el('div', { class: 'podium-slot rank-' + (i + 1) },
        el('span', { class: 'podium-medal', text: medals[i] }),
        QP.avatar(entry.name, entry.avatar, 'lg'),
        el('span', { class: 'roster-name', text: entry.name || 'Player' }),
        el('span', { class: 'board-score', text: QP.fmtNumber(entry.total) })))),
      board.length > 3 ? QP.live.boardList(board.slice(3), myId) : null,
      el('button', { class: 'btn btn-primary btn-block', text: t('exit'), onClick: onExit }));
  };

  /** Distribution bars for the reveal screen. */
  QP.live.distribution = function (counts, correctIndex, options) {
    const total = counts.reduce((a, b) => a + b, 0) || 1;
    return el('div', { class: 'stack-sm' }, counts.map((n, i) => el('div', { class: 'dist-row' + (i === correctIndex ? ' correct' : '') },
      el('span', { class: 'dist-label', text: options && options[i] ? options[i] : '' }),
      el('div', { class: 'dist-bar' }, el('div', { class: 'dist-fill', style: 'width:' + Math.round((n / total) * 100) + '%' })),
      el('span', { class: 'dist-count', text: String(n) }))));
  };

  /** Small helper: normalized unsubscribe collection for game handlers. */
  QP.live.subs = function () {
    const unsubs = [];
    return {
      on(event, cb) { unsubs.push(Usion.game.on(event, cb)); },
      clear() { unsubs.forEach((u) => { try { u(); } catch {} }); unsubs.length = 0; },
    };
  };
})();
