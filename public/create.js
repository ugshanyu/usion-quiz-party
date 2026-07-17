/* Quiz Party — quiz builder (create + edit). No chrome: the host header's
 * back button navigates (QP._backHandler). */
(function () {
  'use strict';
  const QP = window.QP;
  const el = QP.el; const t = QP.t;
  const TIMES = [5, 10, 20, 30, 60];
  const POINTS = [1, 2, 3, 5];
  const MIN_OPTIONS = 2;
  const MAX_OPTIONS = 6;

  function blankQuestion() {
    return { text: '', options: ['', ''], correct: -1, time: 10, points: 1, media: null };
  }

  QP.screens.create = function (existing) {
    const goBack = () => (existing ? QP.screens.detail(existing) : QP.screens.home());
    QP._backHandler = goBack;
    const model = {
      title: existing ? existing.title : '',
      visibility: existing ? existing.visibility : 'public',
      questions: [blankQuestion()],
    };
    if (existing) {
      QP.api('/quizzes/' + existing.id + '/full')
        .then((full) => {
          model.questions = full.questions.map((q) => ({
            text: q.text,
            options: [...q.options],
            correct: q.correct,
            time: q.time,
            points: q.points || 1,
            media: q.media || null,
          }));
          renderQuestions();
        })
        .catch(() => QP.toast(t('error_generic')));
    }

    const titleInput = el('input', { class: 'input', value: model.title, maxlength: '80', placeholder: t('title_placeholder'), 'aria-label': t('title_label'), onInput: (e) => { model.title = e.target.value; } });

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

    function mediaRow(q) {
      if (q.media) {
        return el('div', { class: 'media-row' },
          q.media.type === 'image'
            ? el('img', { class: 'media-thumb', src: q.media.url, alt: '' })
            : el('audio', { class: 'q-media-audio', src: q.media.url, controls: '' }),
          el('button', { class: 'link danger', text: t('remove'), onClick: () => { q.media = null; renderQuestions(); } }));
      }
      const picker = (accept, label) => el('button', {
        class: 'chip',
        text: label,
        onClick: (e) => {
          const input = el('input', { type: 'file', accept });
          input.addEventListener('change', async () => {
            const file = input.files && input.files[0];
            if (!file) return;
            const btn = e.target;
            btn.disabled = true;
            btn.textContent = t('uploading');
            try {
              q.media = await QP.upload(file);
            } catch (err) {
              QP.toast(err.code === 'MEDIA_TOO_LARGE' ? t('media_too_large') : t('upload_failed'));
            }
            renderQuestions();
          });
          input.click();
        },
      });
      return el('div', { class: 'media-row' },
        picker('image/*', '🖼 ' + t('add_image')),
        picker('audio/*', '🎵 ' + t('add_sound')));
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
        }),
        q.options.length > MIN_OPTIONS ? el('button', {
          class: 'icon-btn opt-remove', 'aria-label': t('remove'), text: '✕',
          onClick: () => {
            q.options.splice(oi, 1);
            if (q.correct === oi) q.correct = -1;
            else if (q.correct > oi) q.correct -= 1;
            renderQuestions();
          },
        }) : null));

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
        mediaRow(q),
        el('div', { class: 'stack-sm' }, options),
        q.options.length < MAX_OPTIONS
          ? el('button', { class: 'chip', text: '+ ' + t('add_answer'), onClick: () => { q.options.push(''); renderQuestions(); } })
          : null,
        el('div', { class: 'time-row' },
          el('span', { class: 'muted', text: t('time_label') }),
          ...TIMES.map((sec) => el('button', {
            class: 'chip' + (q.time === sec ? ' selected' : ''),
            text: t('seconds_n', { n: sec }), 'aria-pressed': String(q.time === sec),
            onClick: () => { q.time = sec; renderQuestions(); },
          }))),
        el('div', { class: 'time-row' },
          el('span', { class: 'muted', text: t('points_label') }),
          ...POINTS.map((p) => el('button', {
            class: 'chip' + ((q.points || 1) === p ? ' selected' : ''),
            text: '×' + p, 'aria-pressed': String((q.points || 1) === p),
            onClick: () => { q.points = p; renderQuestions(); },
          }))));
    }
    renderQuestions();

    const saveBtn = el('button', { class: 'btn btn-primary btn-block', text: t('save'), onClick: save });

    QP.show(el('div', { class: 'screen' },
      QP.backbar(goBack),
      el('div', { class: 'content stack' },
        el('h2', { class: 'screen-title', text: t(existing ? 'edit_title' : 'create_title') }),
        el('label', { class: 'field-label', text: t('title_label') }), titleInput,
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
        if (!q.text.trim() || options.length < MIN_OPTIONS || q.correct < 0 || !correctText || correct < 0) {
          QP.toast(t('err_question_incomplete', { n: i + 1 }));
          return;
        }
        questions.push({ text: q.text.trim(), options, correct, time: q.time, points: q.points || 1, media: q.media });
      }
      if (!questions.length) { QP.toast(t('err_need_question')); return; }

      saveBtn.disabled = true;
      try {
        const body = { title: model.title, visibility: model.visibility, questions };
        const saved = existing
          ? await QP.api('/quizzes/' + existing.id, { method: 'PUT', body })
          : await QP.api('/quizzes', { method: 'POST', body });
        QP.toast(t('saved'));
        QP.screens.detail(saved);
      } catch {
        QP.toast(t('error_generic'));
        saveBtn.disabled = false;
      }
    }
  };
})();
