/** Quiz CRUD + discovery. All routes require platform auth. */
import { Router } from 'express';
import { customAlphabet } from 'nanoid';
import { db, transaction } from './db.js';
import { requireAuth } from './auth.js';
import { rateLimit } from './ratelimit.js';
import { validateQuiz, ApiError, LIMITS } from './validate.js';

// Unambiguous share codes (no 0/O/1/I/L) — distinct enough from lobby codes,
// and the client resolves "enter code" against lobbies first anyway.
const genCode = customAlphabet('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 6);
const genId = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 12);

export const quizzesRouter = Router();
quizzesRouter.use(requireAuth);

function toMeta(row, userId) {
  const isOwner = row.owner_id === userId;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    emoji: row.emoji,
    visibility: row.visibility,
    questionCount: row.question_count,
    plays: row.plays,
    ownerName: row.owner_name,
    isOwner,
    // The share code unlocks a private quiz, so only the owner sees it here.
    code: isOwner || row.visibility === 'public' ? row.code : undefined,
    createdAt: row.created_at,
  };
}

function getQuiz(id) {
  const row = db.prepare('SELECT * FROM quizzes WHERE id = ?').get(id);
  if (!row) throw new ApiError(404, 'NOT_FOUND');
  return row;
}

/** Owner, or public quiz, or anyone presenting the share code. */
function assertCanAccess(row, userId, code) {
  if (row.owner_id === userId) return;
  if (row.visibility === 'public') return;
  if (code && String(code).toUpperCase() === row.code) return;
  throw new ApiError(403, 'FORBIDDEN');
}

quizzesRouter.get('/me', (req, res) => res.json(req.user));

quizzesRouter.post('/quizzes', rateLimit('quiz-write', 30, 60 * 60 * 1000), (req, res) => {
  const data = validateQuiz(req.body);
  const count = db.prepare('SELECT COUNT(*) AS n FROM quizzes WHERE owner_id = ?').get(req.user.id).n;
  if (count >= LIMITS.QUIZZES_PER_USER) throw new ApiError(400, 'QUIZ_LIMIT_REACHED');

  const now = Date.now();
  const insert = db.prepare(`
    INSERT INTO quizzes (id, code, owner_id, owner_name, title, description, emoji,
                         visibility, questions, question_count, created_at, updated_at)
    VALUES (@id, @code, @ownerId, @ownerName, @title, @description, @emoji,
            @visibility, @questions, @questionCount, @now, @now)`);
  let row;
  for (let i = 0; i < 5; i += 1) {
    try {
      const id = genId();
      insert.run({
        id, code: genCode(), ownerId: req.user.id, ownerName: req.user.name,
        title: data.title, description: data.description, emoji: data.emoji,
        visibility: data.visibility, questions: JSON.stringify(data.questions),
        questionCount: data.questions.length, now,
      });
      row = getQuiz(id);
      break;
    } catch (e) {
      if (!String(e.message).includes('UNIQUE')) throw e; // code collision → retry
    }
  }
  if (!row) throw new ApiError(500, 'CODE_ALLOCATION');
  res.status(201).json(toMeta(row, req.user.id));
});

quizzesRouter.get('/quizzes/mine', (req, res) => {
  const rows = db.prepare('SELECT * FROM quizzes WHERE owner_id = ? ORDER BY updated_at DESC LIMIT 200')
    .all(req.user.id);
  res.json({ items: rows.map((r) => toMeta(r, req.user.id)) });
});

quizzesRouter.get('/quizzes/public', (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 50);
  const sort = req.query.sort === 'new' ? 'created_at DESC' : 'plays DESC, created_at DESC';
  const offset = Math.max(0, Number(req.query.offset) || 0);
  let rows;
  if (q) {
    rows = db.prepare(
      `SELECT * FROM quizzes WHERE visibility = 'public' AND (title LIKE ? OR description LIKE ?)
       ORDER BY ${sort} LIMIT 30 OFFSET ?`,
    ).all(`%${q}%`, `%${q}%`, offset);
  } else {
    rows = db.prepare(`SELECT * FROM quizzes WHERE visibility = 'public' ORDER BY ${sort} LIMIT 30 OFFSET ?`)
      .all(offset);
  }
  res.json({ items: rows.map((r) => toMeta(r, req.user.id)) });
});

quizzesRouter.get('/quizzes/code/:code', (req, res) => {
  const code = String(req.params.code || '').toUpperCase().slice(0, 12);
  const row = db.prepare('SELECT * FROM quizzes WHERE code = ?').get(code);
  if (!row) throw new ApiError(404, 'NOT_FOUND');
  const meta = toMeta(row, req.user.id);
  meta.code = row.code; // arriving by code = allowed to keep using it
  res.json(meta);
});

quizzesRouter.get('/quizzes/:id', (req, res) => {
  const row = getQuiz(req.params.id);
  assertCanAccess(row, req.user.id, req.query.code);
  res.json(toMeta(row, req.user.id));
});

// Full quiz WITH correct answers — for the live host. Owner always; public
// quizzes may be hosted by anyone. Private quizzes: owner only.
quizzesRouter.get('/quizzes/:id/full', (req, res) => {
  const row = getQuiz(req.params.id);
  if (row.owner_id !== req.user.id && row.visibility !== 'public') {
    throw new ApiError(403, 'FORBIDDEN');
  }
  res.json({ ...toMeta(row, req.user.id), questions: JSON.parse(row.questions) });
});

quizzesRouter.put('/quizzes/:id', rateLimit('quiz-write', 30, 60 * 60 * 1000), (req, res) => {
  const row = getQuiz(req.params.id);
  if (row.owner_id !== req.user.id) throw new ApiError(403, 'FORBIDDEN');
  const data = validateQuiz(req.body);
  db.prepare(`
    UPDATE quizzes SET title = ?, description = ?, emoji = ?, visibility = ?,
                       questions = ?, question_count = ?, updated_at = ?
    WHERE id = ?`).run(
    data.title, data.description, data.emoji, data.visibility,
    JSON.stringify(data.questions), data.questions.length, Date.now(), row.id,
  );
  res.json(toMeta(getQuiz(row.id), req.user.id));
});

quizzesRouter.delete('/quizzes/:id', (req, res) => {
  const row = getQuiz(req.params.id);
  if (row.owner_id !== req.user.id) throw new ApiError(403, 'FORBIDDEN');
  transaction(() => {
    db.prepare('DELETE FROM quizzes WHERE id = ?').run(row.id);
    db.prepare('DELETE FROM scores WHERE quiz_id = ?').run(row.id);
    db.prepare(`DELETE FROM answers WHERE attempt_id IN (SELECT id FROM attempts WHERE quiz_id = ?)`)
      .run(row.id);
    db.prepare('DELETE FROM attempts WHERE quiz_id = ?').run(row.id);
  });
  res.json({ success: true });
});
