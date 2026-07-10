/* Quiz Party — always mode: solo play, graded server-side. */
(function () {
  'use strict';
  const QP = window.QP;
  const el = QP.el; const t = QP.t;
  const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

  QP.screens.play = async function (quiz) {
    QP._backHandler = () => QP.screens.detail(quiz);
    QP.show(el('div', { class: 'screen' }, QP.backbar(QP._backHandler), QP.spinner()));

    let attempt;
    try {
      attempt = await QP.api('/quizzes/' + quiz.id + '/attempts', { method: 'POST', body: { code: quiz.code } });
    } catch (e) {
      QP.toast(e.code === 'OFFLINE' ? t('offline') : t('error_generic'));
      QP.screens.detail(quiz);
      return;
    }

    const questions = attempt.questions;
    let index = 0;
    let score = 0;

    showQuestion();

    function showQuestion() {
      const q = questions[index];
      const startedAt = Date.now();
      let locked = false;

      const bar = QP.timebar(q.time, () => submit(null));
      const optionButtons = q.options.map((opt, oi) => el('button', {
        class: 'answer-btn',
        onClick: () => { if (!locked) submit(oi); },
      },
      el('span', { class: 'answer-letter', text: LETTERS[oi] }),
      el('span', { class: 'answer-text', text: opt })));

      QP.show(el('div', { class: 'screen' },
        el('header', { class: 'topbar' },
          el('span', { class: 'muted', text: t('question_of', { i: index + 1, n: questions.length }) }),
          el('span', { class: 'topbar-title', text: quiz.emoji || '' }),
          el('span', { class: 'score-pill', text: QP.fmtNumber(score) })),
        bar.el,
        el('div', { class: 'content play' },
          QP.mediaEl(q.media, { autoplay: true }),
          el('h2', { class: 'question-text', text: q.text }),
          el('div', { class: 'answers' }, optionButtons))));

      async function submit(choice) {
        locked = true;
        bar.stop();
        optionButtons.forEach((b) => { b.disabled = true; });
        let result;
        try {
          result = await QP.api('/attempts/' + attempt.attemptId + '/answers', {
            method: 'POST',
            body: { index, choice, elapsedMs: Date.now() - startedAt },
          });
        } catch {
          QP.toast(t('error_generic'));
          QP.screens.detail(quiz);
          return;
        }
        score = result.score;
        optionButtons.forEach((b, oi) => {
          if (oi === result.correctIndex) b.classList.add('correct');
          else if (oi === choice) b.classList.add('wrong');
          else b.classList.add('dim');
        });
        const verdict = choice === null ? t('play_timeout') : (result.correct ? t('play_correct') : t('play_wrong'));
        const banner = el('div', { class: 'verdict ' + (result.correct ? 'good' : 'bad'), role: 'status' },
          el('span', { text: verdict }),
          result.correct ? el('span', { class: 'points-gain', text: t('plus_points', { n: result.points }) }) : null);
        document.querySelector('.play').prepend(banner);
        setTimeout(next, 1700);
      }
    }

    async function next() {
      index += 1;
      if (index < questions.length) { showQuestion(); return; }
      let final = null;
      try {
        final = await QP.api('/attempts/' + attempt.attemptId + '/finish', { method: 'POST' });
      } catch { /* show local score below */ }
      showFinal(final);
    }

    function showFinal(final) {
      QP._backHandler = () => QP.screens.detail(quiz);
      QP.show(el('div', { class: 'screen' },
        QP.backbar(QP._backHandler),
        el('div', { class: 'content center-col' },
          el('div', { class: 'detail-emoji', text: quiz.emoji || '🎯' }),
          el('p', { class: 'muted', text: t('play_final') }),
          el('div', { class: 'final-score', text: QP.fmtNumber(final ? final.score : score) }),
          final ? el('p', { class: 'muted', text: t('question_of', { i: final.correctCount, n: final.total }) + ' ✓ · ' + t('play_best', { n: QP.fmtNumber(final.best) }) + ' · ' + t('play_rank', { n: final.rank }) }) : null,
          el('div', { class: 'stack' },
            el('button', { class: 'btn btn-primary btn-block', text: t('play_again'), onClick: () => QP.screens.play(quiz) }),
            el('button', { class: 'btn btn-ghost btn-block', text: t('detail_leaderboard'), onClick: () => QP.screens.leaderboard(quiz) }),
            el('button', { class: 'btn btn-ghost btn-block', text: t('done'), onClick: () => QP.screens.detail(quiz) })))));
    }
  };
})();
