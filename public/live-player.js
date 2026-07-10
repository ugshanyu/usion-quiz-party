/* Quiz Party — live mode: PLAYER + pre-game lobby wait. State is rebuilt from
 * the host's sequenced actions (live or via sync replay), so reconnects and
 * late joins recover automatically. */
(function () {
  'use strict';
  const QP = window.QP;
  const el = QP.el; const t = QP.t;
  const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

  /** Joined a lobby by code; waiting for the host to start. */
  QP.screens.lobbyWait = function (code) {
    QP._backHandler = () => { try { Usion.lobby.leave(); } catch {} QP.screens.home(); };
    const membersBox = el('div', { class: 'list' });
    QP.show(el('div', { class: 'screen' },
      QP.backbar(QP._backHandler),
      el('div', { class: 'content center-col' },
        el('h2', { text: t('live_youre_in') }),
        el('div', { class: 'code-display' }, el('span', { class: 'code-value', text: code })),
        el('div', { class: 'spinner' }),
        el('p', { class: 'muted', text: t('live_waiting_host') }),
        membersBox)));

    function renderMembers(members) {
      membersBox.replaceChildren(...(members || []).map((m) => el('div', { class: 'board-row' },
        QP.avatar(m.name, null), el('span', { class: 'board-name', text: m.name || 'Player' }))));
    }
    renderMembers(Usion.lobby.state.members);
    Usion.lobby.onUpdate((d) => renderMembers(d.members));
    Usion.lobby.onStarted(async ({ room_id }) => {
      try {
        await QP.platformApi('/games/rooms/' + room_id + '/join', { method: 'POST' });
      } catch (e) {
        if (e.status === 400) { QP.toast(t('live_kicked_out')); QP.screens.home(); return; }
        // Other errors: we may already be in the room — try to play anyway.
      }
      QP.screens.livePlayer({ roomId: room_id });
    });
  };

  QP.screens.livePlayer = async function ({ roomId }) {
    const my = QP.state.user.id;
    const subs = QP.live.subs();
    QP.live.activeRoom = roomId;
    let hostId = null;
    let roster = new Map(); // pid -> {p, name, avatar}
    const state = { phase: 'wait', meta: null, q: null, myChoice: null, ackd: false, synced: false, reveal: null, board: [] };
    let bar = null;

    const body = el('div', { class: 'content' }, QP.spinner());
    const overlay = el('div', { class: 'reconnect-overlay hidden', text: t('live_reconnecting') });
    const root = el('div', { class: 'screen' }, QP.backbar(leave), body, overlay);
    root._cleanup = () => { subs.clear(); if (bar) bar.stop(); };
    QP._backHandler = leave;
    QP.show(root);

    // Handlers first, join after — sync replay then rebuilds current state.
    subs.on('action', (m) => { if (m.player_id === hostId) apply(m.action_type, m.action_data, false); });
    subs.on('sync', (d) => {
      (d.actions || []).forEach((a) => { if (a.player_id === hostId) apply(a.action_type, a.action_data, true); });
    });
    subs.on('realtime', (m) => {
      if (m.player_id !== hostId) return;
      if (m.action_type === 'roster' && m.action_data && Array.isArray(m.action_data.list)) {
        roster = new Map(m.action_data.list.map((x) => [x.p, x]));
        if (state.phase === 'wait') renderWait();
      } else if (m.action_type === 'ack' && state.q && m.action_data
                 && m.action_data.p === my && m.action_data.i === state.q.i) {
        state.ackd = true;
        const chip = document.getElementById('ack-chip');
        if (chip) chip.textContent = '✓ ' + t('live_answered');
      }
    });
    subs.on('player_left', (d) => { if (d.player_id === hostId) endedByHost(); });
    Usion.game.onConnectionState((s) => overlay.classList.toggle('hidden', s === 'connected'));
    Usion.game.onReconnected(() => { try { Usion.game.realtime('hello', { name: QP.state.user.name, avatar: QP.state.user.avatar }); } catch {} });

    try {
      await Usion.game.connect();
      const room = await QP.platformApi('/games/rooms/' + roomId);
      hostId = room.host_id || (room.player_ids || [])[0];
      await Usion.game.join(roomId);
      Usion.game.realtime('hello', { name: QP.state.user.name, avatar: QP.state.user.avatar });
    } catch {
      QP.toast(t('live_kicked_out'));
      QP.screens.home();
      return;
    }
    if (state.phase === 'wait') renderWait();

    function apply(type, data, fromSync) {
      if (!data) return;
      if (type === 'meta') {
        state.meta = data;
        if (state.phase === 'wait') renderWait();
      } else if (type === 'q') {
        if (state.q && state.q.i === data.i && state.phase !== 'wait') return; // dedupe replay
        state.phase = 'question';
        state.q = data;
        state.myChoice = null;
        state.ackd = false;
        state.synced = fromSync;
        renderQuestion();
      } else if (type === 'reveal') {
        if (state.reveal && state.reveal.i === data.i) return;
        state.phase = 'reveal';
        state.reveal = data;
        state.board = data.board || [];
        renderReveal();
      } else if (type === 'end') {
        state.phase = 'podium';
        state.board = data.board || [];
        renderPodium();
      }
    }

    function renderWait() {
      const meta = state.meta;
      body.replaceChildren(el('div', { class: 'center-col' },
        el('div', { class: 'detail-emoji', text: (meta && meta.emoji) || '🎉' }),
        meta ? el('h2', { class: 'detail-title', text: meta.title }) : null,
        el('div', { class: 'spinner' }),
        el('p', { class: 'muted', text: t('live_waiting_host') }),
        QP.live.rosterGrid(new Map([...roster].filter(([p]) => p !== my)))));
    }

    function renderQuestion() {
      if (bar) bar.stop();
      const q = state.q;
      const buttons = q.options.map((opt, oi) => el('button', {
        class: 'answer-btn', onClick: () => answer(oi),
      },
      el('span', { class: 'answer-letter', text: LETTERS[oi] }),
      el('span', { class: 'answer-text', text: opt })));
      bar = state.synced ? null : QP.timebar(q.t, () => lockAnswers(true));
      body.replaceChildren(
        el('p', { class: 'muted center', text: t('question_of', { i: q.i + 1, n: q.n }) }),
        bar ? bar.el : el('div'),
        QP.mediaEl(q.media, { autoplay: true }),
        el('h2', { class: 'question-text', text: q.text }),
        el('div', { class: 'answers' }, buttons),
        el('p', { class: 'muted center', id: 'ack-chip', text: '' }));
    }

    function answer(choice) {
      if (state.myChoice !== null || state.phase !== 'question') return;
      state.myChoice = choice;
      Usion.game.realtime('ans', { i: state.q.i, c: choice });
      lockAnswers(false);
      const chip = document.getElementById('ack-chip');
      if (chip) chip.textContent = state.ackd ? '✓ ' + t('live_answered') : '…';
    }

    function lockAnswers(timedOut) {
      body.querySelectorAll('.answer-btn').forEach((b, oi) => {
        b.disabled = true;
        if (state.myChoice === oi) b.classList.add('picked');
        else b.classList.add('dim');
      });
      if (timedOut && state.myChoice === null) {
        const chip = document.getElementById('ack-chip');
        if (chip) chip.textContent = t('play_timeout');
      }
    }

    function renderReveal() {
      if (bar) { bar.stop(); bar = null; }
      const r = state.reveal;
      const mine = state.board.find((entry) => entry.p === my);
      const correct = state.myChoice !== null && state.myChoice === r.correct;
      const verdict = state.myChoice === null ? t('play_timeout') : (correct ? t('play_correct') : t('play_wrong'));
      const withAvatars = state.board.map((entry) => ({ ...entry, avatar: (roster.get(entry.p) || {}).avatar }));
      body.replaceChildren(
        el('div', { class: 'verdict ' + (correct ? 'good' : 'bad'), role: 'status' },
          el('span', { text: verdict }),
          mine && mine.gained ? el('span', { class: 'points-gain', text: t('plus_points', { n: mine.gained }) }) : null),
        state.q ? QP.live.distribution(r.counts, r.correct, state.q.options) : null,
        el('h3', { class: 'section-title', text: t('live_scoreboard') }),
        QP.live.boardList(withAvatars, my, 10),
        el('p', { class: 'muted center', text: r.last ? '' : t('live_get_ready') }));
    }

    function renderPodium() {
      if (bar) { bar.stop(); bar = null; }
      const withAvatars = state.board.map((entry) => ({ ...entry, avatar: (roster.get(entry.p) || {}).avatar }));
      body.replaceChildren(QP.live.podium(withAvatars, my, leave));
    }

    function endedByHost() {
      if (state.phase === 'podium') return;
      if (bar) { bar.stop(); bar = null; }
      body.replaceChildren(el('div', { class: 'center-col' },
        el('p', { class: 'muted', text: t('live_host_left') }),
        state.board.length ? QP.live.boardList(state.board.map((entry) => ({ ...entry, avatar: (roster.get(entry.p) || {}).avatar })), my) : null,
        el('button', { class: 'btn btn-primary btn-block', text: t('exit'), onClick: leave })));
    }

    function leave() {
      try { Usion.game.leave(); } catch {}
      QP.live.activeRoom = null;
      QP.screens.home();
    }
  };
})();
