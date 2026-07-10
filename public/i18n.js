/* Quiz Party — i18n. English + Mongolian; picked from Usion.getLanguage(). */
(function () {
  'use strict';
  window.QP = window.QP || {};
  QP.screens = QP.screens || {};
  QP._errors = [];
  window.addEventListener('error', (e) => {
    QP._errors.push((e.filename || '') + ':' + (e.lineno || 0) + ' ' + e.message);
  });

  const en = {
    app_name: 'Quiz Party',
    loading: 'Loading…',
    open_in_usion: 'Quiz Party runs inside the Usion app.',
    error_generic: 'Something went wrong. Please try again.',
    retry: 'Retry',
    offline: 'No connection. Check your network and try again.',

    home_join_placeholder: 'Enter a code…',
    join: 'Join',
    create_quiz: 'Create a quiz',
    popular: 'Popular',
    newest: 'New',
    my_quizzes: 'My quizzes',
    search_placeholder: 'Search quizzes…',
    empty_public: 'No quizzes yet — create the first one!',
    empty_mine: 'Quizzes you create appear here.',
    empty_search: 'No quizzes match your search.',
    code_not_found: 'Nothing found for that code.',
    lobby_full: 'That game is full.',
    lobby_closed: 'That game has already started.',

    by_name: 'by {name}',
    n_questions: '{n} questions',
    one_question: '1 question',
    n_plays: '{n} plays',

    detail_play: 'Play',
    detail_host: 'Host live',
    detail_leaderboard: 'Leaderboard',
    detail_edit: 'Edit',
    detail_delete: 'Delete',
    detail_share: 'Share',
    private_badge: 'Private',
    code_label: 'Code',
    delete_confirm: 'Delete this quiz? This cannot be undone.',
    share_text: 'Join my quiz "{title}" on Usion! Open Quiz Party and enter code {code}',
    copied: 'Copied',

    create_title: 'New quiz',
    edit_title: 'Edit quiz',
    title_label: 'Title',
    title_placeholder: 'e.g. World capitals',
    desc_label: 'Description (optional)',
    visibility_label: 'Who can find it?',
    vis_public: 'Public',
    vis_public_hint: 'Anyone can find and play it',
    vis_private: 'Private',
    vis_private_hint: 'Only people with the code',
    questions_label: 'Questions',
    add_question: 'Add question',
    question_n: 'Question {n}',
    q_text_placeholder: 'Ask something…',
    option_placeholder: 'Answer {n}',
    time_label: 'Time',
    seconds_n: '{n}s',
    save: 'Save',
    cancel: 'Cancel',
    remove: 'Remove',
    err_need_title: 'Give your quiz a title.',
    err_need_question: 'Add at least one question.',
    err_question_incomplete: 'Question {n} needs text, at least 2 answers, and a correct answer selected.',
    saved: 'Saved',

    question_of: '{i} of {n}',
    play_correct: 'Correct!',
    play_wrong: 'Not quite',
    play_timeout: "Time's up",
    plus_points: '+{n}',
    play_final: 'Your score',
    play_best: 'Best: {n}',
    play_rank: 'Rank #{n}',
    play_again: 'Play again',
    done: 'Done',

    leaderboard_title: 'Leaderboard',
    leaderboard_empty: 'No scores yet. Be the first!',
    you: 'You',

    host_pick_quiz: 'Pick a quiz to host',
    live_code_hint: 'Players join with this code',
    live_invite: 'Invite friends',
    live_players: 'Players',
    live_start: 'Start quiz',
    live_start_anyway: 'Start now',
    live_bringing_in: 'Bringing players in…',
    live_waiting_players: 'Waiting for players…',
    live_waiting_host: 'Waiting for the host to start…',
    live_youre_in: "You're in!",
    live_get_ready: 'Get ready…',
    live_answered: 'Answer received',
    live_answers_in: '{n} answered',
    live_reveal: 'Show answers',
    live_next: 'Next question',
    live_finish: 'Finish',
    live_scoreboard: 'Scoreboard',
    live_podium: 'Final results',
    live_host_left: 'The host ended the quiz.',
    live_no_players: 'No players yet — invite someone or share the code.',
    live_kicked_out: 'Could not join this game.',
    live_reconnecting: 'Reconnecting…',
    live_host_answers: '{answered}/{total} answered',
    exit: 'Exit',
  };

  const mn = {
    app_name: 'Quiz Party',
    loading: 'Ачаалж байна…',
    open_in_usion: 'Quiz Party нь Usion аппликейшн дотор ажилладаг.',
    error_generic: 'Алдаа гарлаа. Дахин оролдоно уу.',
    retry: 'Дахин оролдох',
    offline: 'Холболт алга. Сүлжээгээ шалгаад дахин оролдоно уу.',

    home_join_placeholder: 'Код оруулах…',
    join: 'Нэгдэх',
    create_quiz: 'Квиз үүсгэх',
    popular: 'Эрэлттэй',
    newest: 'Шинэ',
    my_quizzes: 'Миний квизүүд',
    search_placeholder: 'Квиз хайх…',
    empty_public: 'Одоогоор квиз алга — анхных нь та болоорой!',
    empty_mine: 'Таны үүсгэсэн квизүүд энд харагдана.',
    empty_search: 'Хайлтад тохирох квиз олдсонгүй.',
    code_not_found: 'Энэ кодоор юу ч олдсонгүй.',
    lobby_full: 'Энэ тоглоом дүүрсэн байна.',
    lobby_closed: 'Энэ тоглоом аль хэдийн эхэлсэн.',

    by_name: '{name}',
    n_questions: '{n} асуулт',
    one_question: '1 асуулт',
    n_plays: '{n} тоглолт',

    detail_play: 'Тоглох',
    detail_host: 'Шууд явуулах',
    detail_leaderboard: 'Оноо',
    detail_edit: 'Засах',
    detail_delete: 'Устгах',
    detail_share: 'Хуваалцах',
    private_badge: 'Хувийн',
    code_label: 'Код',
    delete_confirm: 'Энэ квизийг устгах уу? Буцаах боломжгүй.',
    share_text: 'Usion дээр "{title}" квизэд минь нэгдээрэй! Quiz Party-г нээгээд {code} кодыг оруулна уу',
    copied: 'Хуулагдлаа',

    create_title: 'Шинэ квиз',
    edit_title: 'Квиз засах',
    title_label: 'Гарчиг',
    title_placeholder: 'ж: Дэлхийн нийслэлүүд',
    desc_label: 'Тайлбар (заавал биш)',
    visibility_label: 'Хэн олж чадах вэ?',
    vis_public: 'Нийтийн',
    vis_public_hint: 'Хүн бүр олж, тоглож чадна',
    vis_private: 'Хувийн',
    vis_private_hint: 'Зөвхөн кодтой хүмүүс',
    questions_label: 'Асуултууд',
    add_question: 'Асуулт нэмэх',
    question_n: 'Асуулт {n}',
    q_text_placeholder: 'Асуултаа бичнэ үү…',
    option_placeholder: 'Хариулт {n}',
    time_label: 'Хугацаа',
    seconds_n: '{n}с',
    save: 'Хадгалах',
    cancel: 'Болих',
    remove: 'Хасах',
    err_need_title: 'Квиздээ гарчиг өгнө үү.',
    err_need_question: 'Дор хаяж нэг асуулт нэмнэ үү.',
    err_question_incomplete: '{n}-р асуултад текст, дор хаяж 2 хариулт, зөв хариулт сонгосон байх шаардлагатай.',
    saved: 'Хадгалагдлаа',

    question_of: '{i} / {n}',
    play_correct: 'Зөв!',
    play_wrong: 'Буруу байна',
    play_timeout: 'Хугацаа дууслаа',
    plus_points: '+{n}',
    play_final: 'Таны оноо',
    play_best: 'Дээд: {n}',
    play_rank: 'Байр #{n}',
    play_again: 'Дахин тоглох',
    done: 'Болсон',

    leaderboard_title: 'Онооны самбар',
    leaderboard_empty: 'Оноо алга. Анхных нь болоорой!',
    you: 'Та',

    host_pick_quiz: 'Явуулах квизээ сонгоно уу',
    live_code_hint: 'Тоглогчид энэ кодоор нэгдэнэ',
    live_invite: 'Найзаа урих',
    live_players: 'Тоглогчид',
    live_start: 'Квиз эхлүүлэх',
    live_start_anyway: 'Шууд эхлүүлэх',
    live_bringing_in: 'Тоглогчдыг оруулж байна…',
    live_waiting_players: 'Тоглогчдыг хүлээж байна…',
    live_waiting_host: 'Хөтлөгчийг хүлээж байна…',
    live_youre_in: 'Та орлоо!',
    live_get_ready: 'Бэлдээрэй…',
    live_answered: 'Хариулт хүлээн авлаа',
    live_answers_in: '{n} хариуллаа',
    live_reveal: 'Хариулт харуулах',
    live_next: 'Дараагийн асуулт',
    live_finish: 'Дуусгах',
    live_scoreboard: 'Онооны самбар',
    live_podium: 'Эцсийн үр дүн',
    live_host_left: 'Хөтлөгч квизийг дуусгалаа.',
    live_no_players: 'Тоглогч алга — найзаа урих эсвэл кодоо хуваалцаарай.',
    live_kicked_out: 'Энэ тоглоомд нэгдэж чадсангүй.',
    live_reconnecting: 'Дахин холбогдож байна…',
    live_host_answers: '{answered}/{total} хариуллаа',
    exit: 'Гарах',
  };

  const dicts = { en, mn };
  let lang = 'en';

  QP.setLanguage = function (value) {
    lang = dicts[value] ? value : 'en';
    document.documentElement.lang = lang;
  };
  QP.getLanguage = function () { return lang; };
  QP.t = function (key, vars) {
    let s = (dicts[lang] && dicts[lang][key]) || en[key] || key;
    if (vars) Object.keys(vars).forEach((k) => { s = s.replaceAll('{' + k + '}', String(vars[k])); });
    return s;
  };
  QP.fmtNumber = function (n) {
    try { return new Intl.NumberFormat(lang === 'mn' ? 'mn-MN' : 'en-US').format(n); } catch { return String(n); }
  };
})();
