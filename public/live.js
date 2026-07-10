/* Quiz Party — live mode: HOST. Host-authoritative over the platform relay:
 * questions/reveals ride sequenced action()s (replayed to late joiners via
 * sync); answers arrive as realtime() and are scored on the host device. */
(function () {
  'use strict';
  const QP = window.QP;
  const el = QP.el; const t = QP.t;

  /** Launched as host of a room (chat invite / Share promotion): pick a quiz. */
  QP.screens.hostPick = function (roomId) {
    QP._backHandler = () => QP.screens.home();
    const box = el('div', { class: 'list' }, QP.spinner());
    QP.show(el('div', { class: 'screen' },
      QP.backbar(QP._backHandler),
      el('div', { class: 'content' },
        el('h2', { class: 'screen-title center', text: t('host_pick_quiz') }), box)));
    Promise.all([QP.api('/quizzes/mine'), QP.api('/quizzes/public')])
      .then(([mine, pub]) => {
        const seen = new Set();
        const rows = [...mine.items, ...pub.items]
          .filter((q) => !seen.has(q.id) && seen.add(q.id))
          .map((q) => QP.quizRow(q, () => QP.screens.liveHost({ quizId: q.id, roomId })));
        box.replaceChildren(...(rows.length ? rows : [el('p', { class: 'empty', text: t('empty_mine') })]));
      })
      .catch(() => box.replaceChildren(el('p', { class: 'empty', text: t('error_generic') })));
  };

  QP.screens.liveHost = async function ({ quizId, roomId }) {
    const my = QP.state.user.id;
    const subs = QP.live.subs();
    let quiz = null;
    let room = roomId || null;
    let lobbyCode = null;
    const players = new Map();   // pid -> {name, avatar} (room members, host excluded)
    let lobbyIds = [];           // lobby members not necessarily in the room yet
    const totals = new Map();    // pid -> score
    let phase = 'loading';
    let current = null;          // {i, sentAt, answers: Map, closed, timer}
    const body = el('div', { class: 'content' }, QP.spinner());
    const root = el('div', { class: 'screen' },
      QP.backbar(leave), body);
    root._cleanup = () => { subs.clear(); if (current) clearTimeout(current.timer); };
    QP._backHandler = leave;
    QP.show(root);

    try {
      quiz = await QP.api('/quizzes/' + quizId + '/full');
    } catch { QP.toast(t('error_generic')); QP.screens.home(); return; }

    // Multiplayer wiring — registered before any join.
    subs.on('player_joined', (d) => {
      syncRoster(d.player_ids);
      if (phase === 'waiting') renderWaiting();
      broadcastRoster();
    });
    subs.on('player_left', (d) => {
      if (Array.isArray(d.player_ids)) syncRoster(d.player_ids);
      else players.delete(d.player_id);
      if (phase === 'waiting') renderWaiting();
      if (phase === 'question' && allAnswered()) closeQuestion();
    });
    subs.on('realtime', (m) => {
      if (m.player_id === my) return;
      if (m.action_type === 'hello') {
        const p = players.get(m.player_id) || {};
        players.set(m.player_id, { ...p, name: m.action_data.name, avatar: m.action_data.avatar });
        broadcastRoster();
        if (phase === 'waiting') renderWaiting();
      } else if (m.action_type === 'ans' && current && !current.closed
                 && m.action_data && m.action_data.i === current.i
                 && !current.answers.has(m.player_id)) {
        current.answers.set(m.player_id, {
          c: m.action_data.c, elapsed: Date.now() - current.sentAt,
        });
        Usion.game.realtime('ack', { p: m.player_id, i: current.i });
        if (allAnswered()) closeQuestion();
        else if (phase === 'question') updateAnswerCount();
      }
    });

    try {
      await Usion.game.connect();
      if (room) {
        QP.live.activeRoom = room;
        const info = await QP.platformApi('/games/rooms/' + room);
        syncRoster(info.player_ids || []);
        await Usion.game.join(room);
      } else {
        lobbyCode = (await Usion.lobby.create({ maxPlayers: 50 })).code;
        Usion.lobby.onUpdate((d) => {
          lobbyIds = (d.members || []).map((m) => m.id).filter((id) => id !== my);
          if (phase === 'waiting') renderWaiting();
        });
      }
    } catch { QP.toast(t('error_generic')); QP.screens.home(); return; }

    phase = 'waiting';
    Usion.game.action('meta', { quizId: quiz.id, title: quiz.title, emoji: quiz.emoji, n: quiz.questions.length });
    renderWaiting();

    function syncRoster(ids) {
      const wanted = new Set(ids.filter((id) => id !== my));
      wanted.forEach((id) => { if (!players.has(id)) players.set(id, { name: null, avatar: null }); });
      [...players.keys()].forEach((id) => { if (!wanted.has(id)) players.delete(id); });
    }
    function broadcastRoster() {
      if (!room) return;
      const list = [...players.entries()].map(([p, i]) => ({ p, name: i.name, avatar: i.avatar }));
      list.push({ p: my, name: QP.state.user.name, avatar: QP.state.user.avatar, host: true });
      Usion.game.realtime('roster', { list });
    }

    // ── Waiting room ──────────────────────────────────────────────────────
    function renderWaiting() {
      const pending = lobbyIds.filter((id) => !players.has(id)).length;
      const count = players.size + (room ? 0 : pending);
      const startBtn = el('button', {
        class: 'btn btn-primary btn-block', text: t('live_start'),
        disabled: count === 0 ? 'disabled' : null, onClick: start,
      });
      body.replaceChildren(
        el('div', { class: 'center-col' },
          el('div', { class: 'detail-emoji', text: quiz.emoji || '🎯' }),
          el('h2', { class: 'detail-title', text: quiz.title }),
          lobbyCode ? el('div', { class: 'code-display' },
            el('span', { class: 'code-value', text: lobbyCode }),
            el('span', { class: 'muted', text: t('live_code_hint') })) : null,
          el('h3', { class: 'section-title', text: t('live_players') + ' · ' + count }),
          QP.live.rosterGrid(players),
          pending ? el('p', { class: 'muted center', text: t('live_waiting_players') + ' +' + pending }) : null,
          el('div', { class: 'stack' },
            QP.state.embedded && Usion.game.invite
              ? el('button', { class: 'btn btn-block', text: '👥 ' + t('live_invite'), onClick: invite }) : null,
            startBtn)));
    }

    async function invite() {
      try {
        const res = await Usion.game.invite({ maxPlayers: 50 });
        if (res && res.roomId && !room) { room = res.roomId; QP.live.activeRoom = room; }
      } catch { /* user cancelled the picker */ }
    }

    async function start() {
      try {
        if (!room) {
          const created = await QP.platformApi('/games/rooms', {
            method: 'POST',
            body: {
              service_id: QP.state.config.serviceId,
              conversation_id: 'quizlive-' + (lobbyCode || my) + '-' + Date.now(),
            },
          });
          room = created.id;
          QP.live.activeRoom = room;
          await Usion.game.join(room);
        }
        if (lobbyCode) {
          await Usion.lobby.start(room);
          phase = 'starting';
          body.replaceChildren(el('div', { class: 'center-col' },
            el('div', { class: 'spinner' }),
            el('p', { class: 'muted', text: t('live_bringing_in') })));
          await waitForLobbyMembers(8000);
        }
        Usion.game.action('meta', { quizId: quiz.id, title: quiz.title, emoji: quiz.emoji, n: quiz.questions.length });
        startQuestion(0);
      } catch { QP.toast(t('error_generic')); phase = 'waiting'; renderWaiting(); }
    }

    function waitForLobbyMembers(timeoutMs) {
      const deadline = Date.now() + timeoutMs;
      return new Promise((resolve) => {
        (function poll() {
          const missing = lobbyIds.filter((id) => !players.has(id)).length;
          if (!missing || Date.now() > deadline) resolve();
          else setTimeout(poll, 300);
        })();
      });
    }

    // ── Question loop ─────────────────────────────────────────────────────
    function startQuestion(i) {
      const q = quiz.questions[i];
      current = { i, sentAt: Date.now(), answers: new Map(), closed: false, timer: null };
      phase = 'question';
      Usion.game.action('q', { i, text: q.text, options: q.options, t: q.time, n: quiz.questions.length, media: q.media || null, pts: q.points || 1 });
      current.timer = setTimeout(closeQuestion, q.time * 1000 + 800);
      renderQuestion(q);
    }

    function allAnswered() {
      return players.size > 0 && [...players.keys()].every((p) => current.answers.has(p));
    }

    let answerCountEl = null;
    function renderQuestion(q) {
      const bar = QP.timebar(q.time, () => {});
      answerCountEl = el('p', { class: 'muted center', text: t('live_host_answers', { answered: 0, total: players.size }) });
      body.replaceChildren(
        el('p', { class: 'muted center', text: t('question_of', { i: current.i + 1, n: quiz.questions.length }) }),
        bar.el,
        QP.mediaEl(q.media, { autoplay: true }),
        el('h2', { class: 'question-text', text: q.text }),
        el('div', { class: 'stack-sm' }, q.options.map((opt, oi) => el('div', { class: 'host-opt', text: opt }))),
        answerCountEl,
        el('button', { class: 'btn btn-block', text: t('live_reveal'), onClick: closeQuestion }));
    }
    function updateAnswerCount() {
      if (answerCountEl) answerCountEl.textContent = t('live_host_answers', { answered: current.answers.size, total: players.size });
    }

    function closeQuestion() {
      if (!current || current.closed) return;
      current.closed = true;
      clearTimeout(current.timer);
      const q = quiz.questions[current.i];
      const counts = q.options.map(() => 0);
      players.forEach((info, pid) => {
        const a = current.answers.get(pid);
        if (a && Number.isInteger(a.c) && a.c >= 0 && a.c < q.options.length) counts[a.c] += 1;
        const correct = !!a && a.c === q.correct;
        const gained = QP.live.points(correct, a ? a.elapsed : 0, q.time, q.points || 1);
        totals.set(pid, (totals.get(pid) || 0) + gained);
        info.gained = gained;
      });
      const board = buildBoard(true);
      const last = current.i === quiz.questions.length - 1;
      phase = 'reveal';
      Usion.game.action('reveal', { i: current.i, correct: q.correct, counts, board, last });
      renderReveal(q, counts, board, last);
    }

    function buildBoard(withGained) {
      return [...players.entries()]
        .map(([p, info]) => ({ p, name: info.name, total: totals.get(p) || 0, gained: withGained ? info.gained || 0 : 0 }))
        .sort((a, b) => b.total - a.total);
    }

    function renderReveal(q, counts, board, last) {
      const withAvatars = board.map((entry) => ({ ...entry, avatar: (players.get(entry.p) || {}).avatar }));
      body.replaceChildren(
        el('h2', { class: 'question-text', text: q.text }),
        QP.live.distribution(counts, q.correct, q.options),
        el('h3', { class: 'section-title', text: t('live_scoreboard') }),
        QP.live.boardList(withAvatars, my, 5),
        el('button', {
          class: 'btn btn-primary btn-block',
          text: last ? t('live_finish') : t('live_next'),
          onClick: () => (last ? finish() : startQuestion(current.i + 1)),
        }));
    }

    function finish() {
      const board = buildBoard(false);
      phase = 'podium';
      Usion.game.action('end', { board });
      const withAvatars = board.map((entry) => ({ ...entry, avatar: (players.get(entry.p) || {}).avatar }));
      body.replaceChildren(QP.live.podium(withAvatars, my, leave));
    }

    function leave() {
      try { if (lobbyCode) Usion.lobby.leave(); } catch {}
      try { Usion.game.leave(); } catch {}
      QP.live.activeRoom = null;
      QP.screens.home();
    }
  };
})();
