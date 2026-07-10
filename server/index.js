import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { quizzesRouter } from './quizzes.js';
import { attemptsRouter } from './attempts.js';
import { ApiError } from './validate.js';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '256kb' }));

app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'no-referrer');
  // No X-Frame-Options: this app is meant to be embedded by the Usion host.
  next();
});

app.get('/health', (req, res) => res.json({ ok: true }));

app.use('/api', quizzesRouter);
app.use('/api', attemptsRouter);
app.use('/api', (req, res) => res.status(404).json({ error: 'NOT_FOUND' }));

const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
app.use(express.static(publicDir, { maxAge: process.env.NODE_ENV === 'production' ? '5m' : 0 }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err instanceof ApiError) {
    return res.status(err.status).json({ error: err.code });
  }
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'PAYLOAD_TOO_LARGE' });
  }
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'INVALID_JSON' });
  }
  console.error(err);
  res.status(500).json({ error: 'INTERNAL' });
});

const port = Number(process.env.PORT) || 3022;
app.listen(port, () => console.log(`quiz-party listening on :${port}`));
