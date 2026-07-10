/* Quiz Party — quiz builder (create + edit). */
(function () {
  'use strict';
  const QP = window.QP;
  const el = QP.el; const t = QP.t;
  const EMOJIS = ['🎯', '🧠', '🌍', '⚽', '🎬', '🎵', '🔬', '📚', '🍔', '🐾', '💡', '🏛️'];
  const TIMES = [10, 20, 30, 60];

  function blankQuestion() {
    return { text: '', options: ['', '', '', ''], correct: -1, time: 20 };
  }

  QP.screens.create = function (existing) {
    QP._backHandler = () => (existing ? QP.screens.detail(existing) : QP.screens.home());
    const model = {
      title: existing ? existing.title : '',
      description: existing ? existing.description : '',
      emoji: existing ? existing.emoji : EMOJIS[0],
      visibility: existing ? existing.visibility : 'public',
      questions: [blankQuestion()],
    };
    if (existing) {
      QP.api('/quizzes/' + existing.id + '/full')
        .then((full) => {
          model.questions = full.questions.map((q) => ({
            text: q.text,
            options: [...q.options, '', '', ''].slice(0, 4),
            correct: q.correct,
            time: q.time,
          }));
          renderQuestions();
        })
        .catch(() => QP.toast(t('error_generic')));
    }

    const titleInput = el('input', { class: 'input', value: model.title, maxlength: '80', placeholder: t('title_placeholder'), 'aria-label': t('title_label'), onInput: (e) => { model.title = e.target.value; } });
    const descInput = el('input', { class: 'input', value: model.description, maxlength: '200', placeholder: t('desc_label'), 'aria-label': t('desc_label'), onInput: (e) => { model.description = e.target.value; } });

    const emojiRow = el('div', { class: 'emoji-row', role: 'radiogroup', 'aria-label': 'emoji' });
    function renderEmojis() {
      emojiRow.replaceChildren(...EMOJIS.map((em) => el('button', {
        class: 'emoji-pick' + (model.emoji === em ? ' selected' : ''),
        text: em, role: 'radio', 'aria-checked': String(model.emoji === em),
        onClick: () => { model.emoji = em; renderEmojis(); },
      })));
    }
    renderEmojis();

    const visRow = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': t('visibility_label') });
    function renderVis() {
      visRow.replaceChildren(...['public', 'private'].map((v) => el('button', {
        class: 'seg-item' + (model.visibility === v ? ' selected' : ''),
        role: 'radio', 'aria-checked': String(model.visibility === v),
        onClick: () => { model.visibility = v; renderVis(); },
      },
      el('span', { class: 'seg-label', text: t(v === 'public' ? 'vis_public' : 'vis_private') }),
      el('span', { class: 'seg-hint', text: t(v === 'public' ? 'vis_public_hint' : 'vis_private_hint') }))));
    }
    renderVis();

    const questionsBox = el('div', { class: 'stack' });
    function renderQuestions() {
      questionsBox.replaceChildren(...model.questions.map((q, qi) => questionCard(q, qi)));
    }
    function questionCard(q, qi) {
      const options = q.options.map((opt, oi) => el('div', { class: 'opt-edit' },
        el('button', {
          class: 'correct-pick' + (q.correct === oi ? ' selected' : ''),
          'aria-label': 'correct ' + (oi + 1), 'aria-pressed': String(q.correct === oi),
          text: q.correct === oi ? '✓' : '',
          onClick: () => { q.correct = oi; renderQuestions(); },
        }),
        el('input', {
          class: 'input opt-input', value: opt, maxlength: '80',
          placeholder: t('option_placeholder', { n: oi + 1 }),
          onInput: (e) => { q.options[oi] = e.target.value; },
        })));
      return el('div', { class: 'card' },
        el('div', { class: 'card-head' },
          el('span', { class: 'card-title', text: t('question_n', { n: qi + 1 }) }),
          model.questions.length > 1
            ? el('button', { class: 'link danger', text: t('remove'), onClick: () => { model.questions.splice(qi, 1); renderQuestions(); } })
            : null),
        el('input', {
          class: 'input', value: q.text, maxlength: '200', placeholder: t('q_text_placeholder'),
          onInput: (e) => { q.text = e.target.value; },
        }),
        el('div', { class: 'stack-sm' }, options),
        el('div', { class: 'time-row' },
          el('span', { class: 'muted', text: t('time_label') }),
          ...TIMES.map((sec) => el('button', {
            class: 'chip' + (q.time === sec ? ' selected' : ''),
            text: t('seconds_n', { n: sec }), 'aria-pressed': String(q.time === sec),
            onClick: () => { q.time = sec; renderQuestions(); },
          }))));
    }
    renderQuestions();

    const saveBtn = el('button', { class: 'btn btn-primary btn-block', text: t('save'), onClick: save });

    QP.show(el('div', { class: 'screen' },
      QP.header({ title: t(existing ? 'edit_title' : 'create_title'), onBack: QP._backHandler }),
      el('div', { class: 'content stack' },
        el('label', { class: 'field-label', text: t('title_label') }), titleInput,
        descInput,
        emojiRow,
        el('label', { class: 'field-label', text: t('visibility_label') }), visRow,
        el('label', { class: 'field-label', text: t('questions_label') }), questionsBox,
        el('button', { class: 'btn btn-block', text: '+ ' + t('add_question'), onClick: () => { model.questions.push(blankQuestion()); renderQuestions(); } }),
        saveBtn)));

    async function save() {
      if (!model.title.trim()) { QP.toast(t('err_need_title')); return; }
      const questions = [];
      for (let i = 0; i < model.questions.length; i += 1) {
        const q = model.questions[i];
        const options = q.options.map((o) => o.trim()).filter(Boolean);
        const correctText = q.correct >= 0 ? (q.options[q.correct] || '').trim() : '';
        const correct = options.indexOf(correctText);
        if (!q.text.trim() || options.length < 2 || q.correct < 0 || !correctText || correct < 0) {
          QP.toast(t('err_question_incomplete', { n: i + 1 }));
          return;
        }
        questions.push({ text: q.text.trim(), options, correct, time: q.time });
      }
      if (!questions.length) { QP.toast(t('err_need_question')); return; }

      saveBtn.disabled = true;
      try {
        const body = { title: model.title, description: model.description, emoji: model.emoji, visibility: model.visibility, questions };
        const saved = existing
          ? await QP.api('/quizzes/' + existing.id, { method: 'PUT', body })
          : await QP.api('/quizzes', { method: 'POST', body });
        QP.toast(t('saved'));
        QP.screens.detail(saved);
      } catch (e) {
        QP.toast(e.code === 'RATE_LIMITED' ? t('error_generic') : t('error_generic'));
        saveBtn.disabled = false;
      }
    }
  };
})();
