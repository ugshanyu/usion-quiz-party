/** Quiz payload validation. Plain data in, normalized data out — throws ApiError. */

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message || code);
    this.status = status;
    this.code = code;
  }
}

export const LIMITS = {
  TITLE_MAX: 80,
  DESCRIPTION_MAX: 200,
  QUESTIONS_MAX: 50,
  QUESTION_TEXT_MAX: 200,
  OPTION_MAX: 80,
  OPTIONS_MIN: 2,
  OPTIONS_MAX: 4,
  TIME_MIN: 5,
  TIME_MAX: 60,
  QUIZZES_PER_USER: 100,
};

function cleanText(value, max) {
  if (typeof value !== 'string') return '';
  // Strip control characters, collapse whitespace runs, trim.
  return value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

export function validateQuiz(body) {
  if (!body || typeof body !== 'object') throw new ApiError(400, 'INVALID_BODY');

  const title = cleanText(body.title, LIMITS.TITLE_MAX);
  if (!title) throw new ApiError(400, 'TITLE_REQUIRED');

  const description = cleanText(body.description, LIMITS.DESCRIPTION_MAX);

  const emoji = cleanText(body.emoji, 8) || '🎯';

  const visibility = body.visibility === 'private' ? 'private' : 'public';

  if (!Array.isArray(body.questions) || body.questions.length < 1) {
    throw new ApiError(400, 'QUESTIONS_REQUIRED');
  }
  if (body.questions.length > LIMITS.QUESTIONS_MAX) {
    throw new ApiError(400, 'TOO_MANY_QUESTIONS');
  }

  const questions = body.questions.map((q) => {
    if (!q || typeof q !== 'object') throw new ApiError(400, 'INVALID_QUESTION');
    const text = cleanText(q.text, LIMITS.QUESTION_TEXT_MAX);
    if (!text) throw new ApiError(400, 'QUESTION_TEXT_REQUIRED');

    if (!Array.isArray(q.options)) throw new ApiError(400, 'OPTIONS_REQUIRED');
    const options = q.options.map((o) => cleanText(o, LIMITS.OPTION_MAX)).filter(Boolean);
    if (options.length < LIMITS.OPTIONS_MIN || options.length > LIMITS.OPTIONS_MAX) {
      throw new ApiError(400, 'INVALID_OPTIONS');
    }

    const correct = Number(q.correct);
    if (!Number.isInteger(correct) || correct < 0 || correct >= options.length) {
      throw new ApiError(400, 'INVALID_CORRECT');
    }

    let time = Number(q.time);
    if (!Number.isInteger(time)) time = 20;
    time = Math.max(LIMITS.TIME_MIN, Math.min(LIMITS.TIME_MAX, time));

    return { text, options, correct, time };
  });

  return { title, description, emoji, visibility, questions };
}
