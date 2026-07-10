/* Quiz Party — tiny DOM helpers. All text goes through textContent (no HTML injection). */
(function () {
  'use strict';
  const QP = window.QP;

  QP.el = function (tag, props, ...children) {
    const node = document.createElement(tag);
    props = props || {};
    Object.keys(props).forEach((key) => {
      const value = props[key];
      if (value === null || value === undefined) return;
      if (key === 'class') node.className = value;
      else if (key === 'text') node.textContent = value;
      else if (key.startsWith('on') && typeof value === 'function') {
        node.addEventListener(key.slice(2).toLowerCase(), value);
      } else if (key === 'dataset') Object.assign(node.dataset, value);
      else node.setAttribute(key, value);
    });
    children.flat().forEach((child) => {
      if (child === null || child === undefined || child === false) return;
      node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    });
    return node;
  };

  /** Replace the app root with a screen. Cleans up the previous screen. */
  QP.show = function (node) {
    if (QP._screenCleanup) { try { QP._screenCleanup(); } catch {} }
    QP._screenCleanup = node._cleanup || null;
    const root = document.getElementById('app');
    root.replaceChildren(node);
    root.scrollTop = 0;
    window.scrollTo(0, 0);
  };

  QP.header = function (opts) {
    opts = opts || {};
    return QP.el('header', { class: 'topbar' },
      opts.onBack
        ? QP.el('button', { class: 'icon-btn', 'aria-label': QP.t('cancel'), onClick: opts.onBack, text: '←' })
        : QP.el('span', { class: 'icon-spacer' }),
      QP.el('h1', { class: 'topbar-title', text: opts.title || QP.t('app_name') }),
      opts.right || QP.el('span', { class: 'icon-spacer' }));
  };

  let toastTimer = null;
  QP.toast = function (message) {
    const box = document.getElementById('toast');
    box.textContent = message;
    box.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => box.classList.remove('visible'), 2600);
  };

  QP.spinner = function () {
    return QP.el('div', { class: 'center-fill' }, QP.el('div', { class: 'spinner', role: 'status', 'aria-label': QP.t('loading') }));
  };

  QP.avatar = function (name, url, size) {
    const cls = 'avatar' + (size === 'lg' ? ' avatar-lg' : '');
    if (url) return QP.el('img', { class: cls, src: url, alt: '' });
    const letter = (name || '?').trim().charAt(0).toUpperCase() || '?';
    return QP.el('div', { class: cls + ' avatar-fallback', text: letter, 'aria-hidden': 'true' });
  };

  QP.confirmDialog = function (message) {
    return new Promise((resolve) => {
      const close = (value) => { overlay.remove(); resolve(value); };
      const overlay = QP.el('div', { class: 'overlay', onClick: (e) => { if (e.target === overlay) close(false); } },
        QP.el('div', { class: 'dialog', role: 'alertdialog', 'aria-modal': 'true' },
          QP.el('p', { class: 'dialog-text', text: message }),
          QP.el('div', { class: 'dialog-actions' },
            QP.el('button', { class: 'btn btn-ghost', text: QP.t('cancel'), onClick: () => close(false) }),
            QP.el('button', { class: 'btn btn-danger', text: QP.t('detail_delete'), onClick: () => close(true) }))));
      document.body.appendChild(overlay);
    });
  };

  /**
   * Animated countdown bar. Returns { el, stop }. Calls onDone once when the
   * time is up (unless stopped first).
   */
  QP.timebar = function (seconds, onDone) {
    const fill = QP.el('div', { class: 'timebar-fill' });
    const el = QP.el('div', { class: 'timebar', role: 'timer' }, fill);
    let done = false;
    fill.style.transitionDuration = seconds + 's';
    requestAnimationFrame(() => requestAnimationFrame(() => fill.classList.add('run')));
    const timer = setTimeout(() => { done = true; if (onDone) onDone(); }, seconds * 1000);
    return {
      el,
      stop() { if (!done) { clearTimeout(timer); fill.style.width = getComputedStyle(fill).width; fill.classList.remove('run'); } },
    };
  };

  QP.quizRow = function (quiz, onTap) {
    const meta = [
      quiz.questionCount === 1 ? QP.t('one_question') : QP.t('n_questions', { n: quiz.questionCount }),
      QP.t('n_plays', { n: QP.fmtNumber(quiz.plays) }),
    ];
    if (quiz.ownerName && !quiz.isOwner) meta.push(QP.t('by_name', { name: quiz.ownerName }));
    return QP.el('button', { class: 'quiz-row', onClick: onTap },
      QP.el('span', { class: 'quiz-emoji', text: quiz.emoji || '🎯', 'aria-hidden': 'true' }),
      QP.el('span', { class: 'quiz-row-main' },
        QP.el('span', { class: 'quiz-row-title' },
          quiz.title,
          quiz.visibility === 'private' ? QP.el('span', { class: 'badge', text: QP.t('private_badge') }) : null),
        QP.el('span', { class: 'quiz-row-meta', text: meta.join(' · ') })),
      QP.el('span', { class: 'chevron', 'aria-hidden': 'true', text: '›' }));
  };
})();
