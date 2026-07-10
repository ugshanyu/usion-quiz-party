/**
 * SQLite storage via node:sqlite (built into Node ≥ 24 — no native deps).
 * One file under DATA_DIR — on Railway that's a mounted volume so data
 * survives deploys.
 */
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const dir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
fs.mkdirSync(dir, { recursive: true });

export const db = new DatabaseSync(path.join(dir, 'quiz.db'));
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA busy_timeout = 5000');

/** Run fn atomically. */
export function transaction(fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    try { db.exec('ROLLBACK'); } catch { /* already rolled back */ }
    throw err;
  }
}

db.exec(`
CREATE TABLE IF NOT EXISTS quizzes (
  id             TEXT PRIMARY KEY,
  code           TEXT NOT NULL UNIQUE,
  owner_id       TEXT NOT NULL,
  owner_name     TEXT,
  title          TEXT NOT NULL,
  description    TEXT NOT NULL DEFAULT '',
  emoji          TEXT NOT NULL DEFAULT '🎯',
  visibility     TEXT NOT NULL DEFAULT 'public',
  questions      TEXT NOT NULL,
  question_count INTEGER NOT NULL,
  plays          INTEGER NOT NULL DEFAULT 0,
  created_at     INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_quizzes_owner  ON quizzes(owner_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_quizzes_public ON quizzes(visibility, plays DESC);

CREATE TABLE IF NOT EXISTS attempts (
  id            TEXT PRIMARY KEY,
  quiz_id       TEXT NOT NULL,
  user_id       TEXT NOT NULL,
  user_name     TEXT,
  user_avatar   TEXT,
  score         INTEGER NOT NULL DEFAULT 0,
  correct_count INTEGER NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'active',
  created_at    INTEGER NOT NULL,
  finished_at   INTEGER
);
CREATE INDEX IF NOT EXISTS idx_attempts_user ON attempts(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS answers (
  attempt_id     TEXT NOT NULL,
  question_index INTEGER NOT NULL,
  choice         INTEGER,
  correct        INTEGER NOT NULL,
  points         INTEGER NOT NULL,
  created_at     INTEGER NOT NULL,
  PRIMARY KEY (attempt_id, question_index)
);

CREATE TABLE IF NOT EXISTS scores (
  quiz_id    TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  name       TEXT,
  avatar     TEXT,
  best       INTEGER NOT NULL DEFAULT 0,
  plays      INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (quiz_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_scores_board ON scores(quiz_id, best DESC, updated_at ASC);
`);
