/* Quiz Party — boot + home/detail/leaderboard screens. Loaded last. */
(function () {
  'use strict';
  const QP = window.QP;
  const { el, t } = { el: QP.el, t: QP.t };

  QP.state = { user: null, config: null, authToken: null, embedded: false };
  QP._backHandler = null;

  // ── Boot ────────────────────────────────────────────────────────────────
  function boot() {
    const params = new URLSearchParams(location.search);
    if (params.get('dev') === '1') {
      const uid = params.get('user') || 'dev-user';
      QP.state.user = { id: uid, name: 'Dev ' + uid, avatar: null };
      QP.state.authToken = 'dev:' + uid;
      QP.screens.home();
      return;
    }
    if (!window.Usion) { renderStandalone(); return; }

    let inited = false;
    const fallback = setTimeout(() => { if (!inited) renderStandalone(); }, 5000);

    Usion.init((config) => {
      inited = true;
      clearTimeout(fallback);
      QP.state.config = config;
      QP.state.embedded = true;
      QP.state.authToken = config.authToken;
      QP.state.user = {
        id: config.userId,
        name: config.userName || 'Player',
        avatar: config.userAvatar || null,
      };
      QP.setLanguage((config.language || 'en').slice(0, 2));
      applyTheme(config.theme);
      wirePlatform();
      route(config);
    });
  }

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme === 'dark' ? 'dark' : 'light';
  }

  function wirePlatform() {
    // Multiplayer handlers must exist up front — a solo launch can be promoted
    // to a hosted room at any time via the platform Share button.
    Usion.game.onRoomAssigned((d) => {
      if (QP.live && QP.live.activeRoom === d.roomId) return;
      QP.screens.hostPick(d.roomId);
    });
    Usion.claimBackButton(() => {
      if (QP._backHandler) QP._backHandler();
      else Usion.exit();
    });
  }

  function route(config) {
    const launch = (Usion.getLaunchParams && Usion.getLaunchParams()) || {};
    const roomId = launch.roomId || config.roomId;
    const multiplayer = launch.mode === 'multiplayer' && roomId;
    if (multiplayer) {
      const isHost = Array.isArray(config.playerIds) && config.playerIds[0] === QP.state.user.id;
      if (isHost) QP.screens.hostPick(roomId);
      else QP.screens.livePlayer({ roomId });
      return;
    }
    QP.screens.home();
  }

  function renderStandalone() {
    QP._backHandler = null;
    QP.show(el('div', { class: 'center-fill standalone' },
      el('div', { class: 'brand-emoji', text: '🎉' }),
      el('h1', { text: t('app_name') }),
      el('p', { class: 'muted', text: t('open_in_usion') })));
  }

  // ── Home ────────────────────────────────────────────────────────────────
  QP.screens.home = async function () {
    QP._backHandler = null;
    let searchTimer = null;

    const codeInput = el('input', {
      class: 'input code-input', placeholder: t('home_join_placeholder'),
      autocapitalize: 'characters', autocomplete: 'off', spellcheck: 'false',
      maxlength: '8', 'aria-label': t('home_join_placeholder'),
      onKeydown: (e) => { if (e.key === 'Enter') joinByCode(codeInput.value); },
    });
    const searchInput = el('input', {
      class: 'input', placeholder: t('search_placeholder'), 'aria-label': t('search_placeholder'),
      onInput: () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => loadPublic(searchInput.value), 300); },
    });

    const mineBox = el('div', { class: 'list' });
    const publicBox = el('div', { class: 'list' });

    const screen = el('div', { class: 'screen' },
      el('header', { class: 'topbar' },
        QP.avatar(QP.state.user.name, QP.state.user.avatar),
        el('h1', { class: 'topbar-title', text: t('app_name') }),
        el('span', { class: 'icon-spacer' })),
      el('div', { class: 'content' },
        el('div', { class: 'join-row' }, codeInput,
          el('button', { class: 'btn btn-primary', text: t('join'), onClick: () => joinByCode(codeInput.value) })),
        el('button', { class: 'btn btn-block btn-create', onClick: () => QP.screens.create(), text: '+ ' + t('create_quiz') }),
        el('section', {},
          el('h2', { class: 'section-title', text: t('my_quizzes') }), mineBox),
        el('section', {},
          el('h2', { class: 'section-title', text: t('popular') }), searchInput, publicBox)));
    QP.show(screen);

    loadMine();
    loadPublic('');

    async function loadMine() {
      try {
        const { items } = await QP.api('/quizzes/mine');
        mineBox.replaceChildren(...(items.length
          ? items.map((q) => QP.quizRow(q, () => QP.screens.detail(q)))
          : [el('p', { class: 'empty', text: t('empty_mine') })]));
      } catch { mineBox.replaceChildren(el('p', { class: 'empty', text: t('error_generic') })); }
    }
    async function loadPublic(q) {
      try {
        const { items } = await QP.api('/quizzes/public?q=' + encodeURIComponent(q || ''));
        publicBox.replaceChildren(...(items.length
          ? items.map((quiz) => QP.quizRow(quiz, () => QP.screens.detail(quiz)))
          : [el('p', { class: 'empty', text: t(q ? 'empty_search' : 'empty_public') })]));
      } catch { publicBox.replaceChildren(el('p', { class: 'empty', text: t('error_generic') })); }
    }
  };

  async function joinByCode(raw) {
    const code = String(raw || '').trim().toUpperCase();
    if (code.length < 4) return;
    if (QP.state.embedded) {
      try { await Usion.game.connect(); } catch { /* backend channel may still relay */ }
      try {
        await Usion.lobby.join(code);
        QP.screens.lobbyWait(code);
        return;
      } catch (e) {
        if (e && e.code === 'LOBBY_FULL') { QP.toast(t('lobby_full')); return; }
        if (e && e.code === 'LOBBY_CLOSED') { QP.toast(t('lobby_closed')); return; }
        // NOT_FOUND → try as a quiz share code below.
      }
    }
    try {
      const quiz = await QP.api('/quizzes/code/' + encodeURIComponent(code));
      QP.screens.detail(quiz);
    } catch (e) {
      QP.toast(e.status === 404 ? t('code_not_found') : t('error_generic'));
    }
  }

  // ── Quiz detail ─────────────────────────────────────────────────────────
  QP.screens.detail = function (quiz) {
    QP._backHandler = () => QP.screens.home();
    const meta = [
      quiz.questionCount === 1 ? t('one_question') : t('n_questions', { n: quiz.questionCount }),
      t('n_plays', { n: QP.fmtNumber(quiz.plays) }),
    ];
    if (quiz.ownerName) meta.push(t('by_name', { name: quiz.ownerName }));

    const actions = [
      el('button', { class: 'btn btn-primary btn-block', text: t('detail_play'), onClick: () => QP.screens.play(quiz) }),
    ];
    if (QP.state.embedded && (quiz.isOwner || quiz.visibility === 'public')) {
      actions.push(el('button', { class: 'btn btn-block', text: '📡 ' + t('detail_host'), onClick: () => QP.screens.liveHost({ quizId: quiz.id }) }));
    }
    actions.push(el('button', { class: 'btn btn-ghost btn-block', text: t('detail_leaderboard'), onClick: () => QP.screens.leaderboard(quiz) }));
    if (quiz.code && (quiz.isOwner || quiz.visibility === 'private')) {
      actions.push(el('button', { class: 'btn btn-ghost btn-block', text: t('detail_share') + ' · ' + t('code_label') + ' ' + quiz.code, onClick: () => shareQuiz(quiz) }));
    }
    if (quiz.isOwner) {
      actions.push(el('div', { class: 'row-2' },
        el('button', { class: 'btn btn-ghost', text: t('detail_edit'), onClick: () => QP.screens.create(quiz) }),
        el('button', { class: 'btn btn-ghost btn-danger-text', text: t('detail_delete'), onClick: () => removeQuiz(quiz) })));
    }

    QP.show(el('div', { class: 'screen' },
      QP.header({ onBack: () => QP.screens.home() }),
      el('div', { class: 'content detail' },
        el('div', { class: 'detail-emoji', text: quiz.emoji || '🎯', 'aria-hidden': 'true' }),
        el('h2', { class: 'detail-title' }, quiz.title,
          quiz.visibility === 'private' ? el('span', { class: 'badge', text: t('private_badge') }) : null),
        quiz.description ? el('p', { class: 'muted center', text: quiz.description }) : null,
        el('p', { class: 'muted center', text: meta.join(' · ') }),
        el('div', { class: 'stack' }, actions))));
  };

  async function shareQuiz(quiz) {
    const text = t('share_text', { title: quiz.title, code: quiz.code });
    if (QP.state.embedded && Usion.share) {
      try { Usion.share('text', { text }); return; } catch { /* fall through */ }
    }
    try { await navigator.clipboard.writeText(text); QP.toast(t('copied')); } catch { QP.toast(quiz.code); }
  }

  async function removeQuiz(quiz) {
    if (!(await QP.confirmDialog(t('delete_confirm')))) return;
    try { await QP.api('/quizzes/' + quiz.id, { method: 'DELETE' }); QP.screens.home(); }
    catch { QP.toast(t('error_generic')); }
  }

  // ── Leaderboard (always mode, per quiz) ─────────────────────────────────
  QP.screens.leaderboard = async function (quiz) {
    QP._backHandler = () => QP.screens.detail(quiz);
    const box = el('div', { class: 'list' }, QP.spinner());
    QP.show(el('div', { class: 'screen' },
      QP.header({ title: t('leaderboard_title'), onBack: QP._backHandler }),
      el('div', { class: 'content' },
        el('p', { class: 'center', text: (quiz.emoji || '🎯') + ' ' + quiz.title }), box)));
    try {
      const { top, me } = await QP.api('/quizzes/' + quiz.id + '/leaderboard' + (quiz.code ? '?code=' + quiz.code : ''));
      const rows = top.map(boardRow);
      if (me && !top.some((e) => e.isMe)) rows.push(el('div', { class: 'board-sep' }), boardRow(me));
      box.replaceChildren(...(rows.length ? rows : [el('p', { class: 'empty', text: t('leaderboard_empty') })]));
    } catch { box.replaceChildren(el('p', { class: 'empty', text: t('error_generic') })); }
  };

  function boardRow(entry) {
    return el('div', { class: 'board-row' + (entry.isMe ? ' me' : '') },
      el('span', { class: 'board-rank', text: '#' + entry.rank }),
      QP.avatar(entry.name, entry.avatar),
      el('span', { class: 'board-name', text: (entry.name || 'Player') + (entry.isMe ? ' · ' + t('you') : '') }),
      el('span', { class: 'board-score', text: QP.fmtNumber(entry.score) }));
  }

  boot();
})();
