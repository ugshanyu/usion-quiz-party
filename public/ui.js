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
    // The host back-button claim is ONE-SHOT (host and SDK both reset after a
    // single press) — re-claim on every screen that has a back handler, and
    // release on root screens so the host button becomes a plain close again.
    if (QP.state && QP.state.embedded && window.Usion) {
      if (QP._backHandler && QP._invokeBack) Usion.claimBackButton(QP._invokeBack);
      else if (Usion.releaseBackButton) Usion.releaseBackButton();
    }
  };

  /**
   * No in-app header: when embedded, the Usion host header's back button
   * drives navigation (claimBackButton → QP._backHandler). Standalone/dev
   * gets a minimal back row so the app stays navigable outside the host.
   */
  QP.backbar = function (onBack) {
    if (!onBack || (QP.state && QP.state.embedded)) return QP.el('span', { class: 'backbar-none' });
    return QP.el('div', { class: 'backbar' },
      QP.el('button', { class: 'icon-btn', 'aria-label': QP.t('cancel'), onClick: onBack, text: '←' }));
  };

  /** Render a question's attached image or sound. */
  QP.mediaEl = function (media, opts) {
    if (!media || !media.url) return null;
    if (media.type === 'image') {
      return QP.el('img', { class: 'q-media-img', src: media.url, alt: '', loading: 'eager' });
    }
    return QP.el('audio', {
      class: 'q-media-audio', src: media.url, controls: '', preload: 'auto',
      autoplay: opts && opts.autoplay ? '' : null,
    });
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
