/**
 * Always-mode attempts. The client never receives correct answers — each
 * answer is graded here, so leaderboard scores can't be forged by hand-editing
 * a final submit.
 */
import { Router } from 'express';
import { customAlphabet } from 'nanoid';
import { db, transaction } from './db.js';
import { requireAuth } from './auth.js';
import { rateLimit } from './ratelimit.js';
import { ApiError } from './validate.js';
import { points } from './scoring.js';

const genId = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 16);
const ATTEMPT_TTL_MS = 2 * 60 * 60 * 1000;

export const attemptsRouter = Router();
attemptsRouter.use(requireAuth);

function canAccess(row, userId, code) {
  return row.owner_id === userId
    || row.visibility === 'public'
    || (code && String(code).toUpperCase() === row.code);
}

attemptsRouter.post('/quizzes/:id/attempts', rateLimit('attempt', 120, 60 * 60 * 1000), (req, res) => {
  const quiz = db.prepare('SELECT * FROM quizzes WHERE id = ?').get(req.params.id);
  if (!quiz) throw new ApiError(404, 'NOT_FOUND');
  if (!canAccess(quiz, req.user.id, req.body && req.body.code)) throw new ApiError(403, 'FORBIDDEN');

  const id = genId();
  db.prepare(`
    INSERT INTO attempts (id, quiz_id, user_id, user_name, user_avatar, created_at)
    VALUES (?, ?, ?, ?, ?, ?)`)
    .run(id, quiz.id, req.user.id, req.user.name, req.user.avatar, Date.now());
  db.prepare('UPDATE quizzes SET plays = plays + 1 WHERE id = ?').run(quiz.id);

  const questions = JSON.parse(quiz.questions).map((q) => ({
    text: q.text, options: q.options, time: q.time,
    points: q.points || 1, media: q.media || null,
  }));
  res.status(201).json({ attemptId: id, quiz: { id: quiz.id, title: quiz.title, emoji: quiz.emoji }, questions });
});

function getActiveAttempt(id, userId) {
  const attempt = db.prepare('SELECT * FROM attempts WHERE id = ?').get(id);
  if (!attempt || attempt.user_id !== userId) throw new ApiError(404, 'NOT_FOUND');
  if (attempt.status !== 'active' || attempt.created_at < Date.now() - ATTEMPT_TTL_MS) {
    throw new ApiError(409, 'ATTEMPT_CLOSED');
  }
  return attempt;
}

attemptsRouter.post('/attempts/:id/answers', (req, res) => {
  const attempt = getActiveAttempt(req.params.id, req.user.id);
  const quiz = db.prepare('SELECT * FROM quizzes WHERE id = ?').get(attempt.quiz_id);
  if (!quiz) throw new ApiError(404, 'NOT_FOUND');
  const questions = JSON.parse(quiz.questions);

  const index = Number(req.body && req.body.index);
  if (!Number.isInteger(index) || index < 0 || index >= questions.length) {
    throw new ApiError(400, 'INVALID_INDEX');
  }
  const question = questions[index];

  // choice === null → time ran out with no answer.
  let choice = req.body.choice;
  choice = choice === null || choice === undefined ? null : Number(choice);
  if (choice !== null && (!Number.isInteger(choice) || choice < 0 || choice >= question.options.length)) {
    throw new ApiError(400, 'INVALID_CHOICE');
  }

  const existing = db.prepare('SELECT * FROM answers WHERE attempt_id = ? AND question_index = ?')
    .get(attempt.id, index);
  if (existing) { // idempotent: replay returns the stored grade
    return res.json({
      correct: !!existing.correct, correctIndex: question.correct,
      points: existing.points, score: attempt.score,
    });
  }

  const correct = choice !== null && choice === question.correct;
  const gained = points(correct, Number(req.body.elapsedMs), question.time, question.points || 1);

  const score = transaction(() => {
    db.prepare(`
      INSERT INTO answers (attempt_id, question_index, choice, correct, points, created_at)
      VALUES (?, ?, ?, ?, ?, ?)`)
      .run(attempt.id, index, choice, correct ? 1 : 0, gained, Date.now());
    db.prepare('UPDATE attempts SET score = score + ?, correct_count = correct_count + ? WHERE id = ?')
      .run(gained, correct ? 1 : 0, attempt.id);
    return db.prepare('SELECT score FROM attempts WHERE id = ?').get(attempt.id).score;
  });

  res.json({ correct, correctIndex: question.correct, points: gained, score });
});

attemptsRouter.post('/attempts/:id/finish', (req, res) => {
  const attempt = getActiveAttempt(req.params.id, req.user.id);
  const quiz = db.prepare('SELECT question_count FROM quizzes WHERE id = ?').get(attempt.quiz_id);

  transaction(() => {
    db.prepare("UPDATE attempts SET status = 'done', finished_at = ? WHERE id = ?")
      .run(Date.now(), attempt.id);
    const prev = db.prepare('SELECT best FROM scores WHERE quiz_id = ? AND user_id = ?')
      .get(attempt.quiz_id, req.user.id);
    if (!prev) {
      db.prepare(`
        INSERT INTO scores (quiz_id, user_id, name, avatar, best, plays, updated_at)
        VALUES (?, ?, ?, ?, ?, 1, ?)`)
        .run(attempt.quiz_id, req.user.id, req.user.name, req.user.avatar, attempt.score, Date.now());
    } else {
      db.prepare(`
        UPDATE scores SET best = MAX(best, ?), plays = plays + 1, name = ?, avatar = ?, updated_at = ?
        WHERE quiz_id = ? AND user_id = ?`)
        .run(attempt.score, req.user.name, req.user.avatar, Date.now(), attempt.quiz_id, req.user.id);
    }
  });

  const me = db.prepare('SELECT best FROM scores WHERE quiz_id = ? AND user_id = ?')
    .get(attempt.quiz_id, req.user.id);
  const rank = db.prepare('SELECT COUNT(*) + 1 AS r FROM scores WHERE quiz_id = ? AND best > ?')
    .get(attempt.quiz_id, me.best).r;

  res.json({
    score: attempt.score,
    correctCount: attempt.correct_count,
    total: quiz ? quiz.question_count : null,
    best: me.best,
    rank,
  });
});

attemptsRouter.get('/quizzes/:id/leaderboard', (req, res) => {
  const quiz = db.prepare('SELECT * FROM quizzes WHERE id = ?').get(req.params.id);
  if (!quiz) throw new ApiError(404, 'NOT_FOUND');
  if (!canAccess(quiz, req.user.id, req.query.code)) throw new ApiError(403, 'FORBIDDEN');

  const top = db.prepare(`
    SELECT user_id, name, avatar, best FROM scores
    WHERE quiz_id = ? ORDER BY best DESC, updated_at ASC LIMIT 20`).all(quiz.id)
    .map((r, i) => ({
      userId: r.user_id, name: r.name, avatar: r.avatar, score: r.best,
      rank: i + 1, isMe: r.user_id === req.user.id,
    }));

  let me = top.find((e) => e.isMe) || null;
  if (!me) {
    const mine = db.prepare('SELECT best FROM scores WHERE quiz_id = ? AND user_id = ?')
      .get(quiz.id, req.user.id);
    if (mine) {
      const rank = db.prepare('SELECT COUNT(*) + 1 AS r FROM scores WHERE quiz_id = ? AND best > ?')
        .get(quiz.id, mine.best).r;
      me = { userId: req.user.id, name: req.user.name, avatar: req.user.avatar, score: mine.best, rank, isMe: true };
    }
  }
  res.json({ top, me });
});
