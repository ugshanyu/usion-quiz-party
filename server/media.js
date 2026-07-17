/**
 * Question media uploads (image or sound). Raw-body upload (Content-Type =
 * the file's mime), stored on the data volume and served from /media with
 * immutable caching. Signatures are sniffed for images; size caps enforced.
 */
import { Router } from 'express';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { customAlphabet } from 'nanoid';
import { requireAuth } from './auth.js';
import { rateLimit } from './ratelimit.js';
import { ApiError } from './validate.js';

const genId = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 20);

export const mediaDir = path.join(process.env.DATA_DIR || path.join(process.cwd(), 'data'), 'media');
fs.mkdirSync(mediaDir, { recursive: true });

const IMAGE_MAX = 2 * 1024 * 1024;
const AUDIO_MAX = 4 * 1024 * 1024;

const TYPES = {
  'image/png': { ext: 'png', kind: 'image', magic: (b) => b[0] === 0x89 && b[1] === 0x50 },
  'image/jpeg': { ext: 'jpg', kind: 'image', magic: (b) => b[0] === 0xff && b[1] === 0xd8 },
  'image/webp': { ext: 'webp', kind: 'image', magic: (b) => b.slice(0, 4).toString() === 'RIFF' },
  'image/gif': { ext: 'gif', kind: 'image', magic: (b) => b.slice(0, 4).toString() === 'GIF8' },
  'audio/mpeg': { ext: 'mp3', kind: 'audio' },
  'audio/mp4': { ext: 'm4a', kind: 'audio' },
  'audio/x-m4a': { ext: 'm4a', kind: 'audio' },
  'audio/ogg': { ext: 'ogg', kind: 'audio' },
  'audio/webm': { ext: 'webm', kind: 'audio' },
  'audio/wav': { ext: 'wav', kind: 'audio' },
  'audio/x-wav': { ext: 'wav', kind: 'audio' },
};

export const mediaRouter = Router();

mediaRouter.post(
  '/media',
  requireAuth,
  rateLimit('media-upload', 120, 60 * 60 * 1000),
  express.raw({ type: ['image/*', 'audio/*'], limit: AUDIO_MAX }),
  (req, res) => {
    const mime = (req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    const spec = TYPES[mime];
    if (!spec || !Buffer.isBuffer(req.body) || req.body.length < 64) {
      throw new ApiError(400, 'UNSUPPORTED_MEDIA');
    }
    const cap = spec.kind === 'image' ? IMAGE_MAX : AUDIO_MAX;
    if (req.body.length > cap) throw new ApiError(413, 'MEDIA_TOO_LARGE');
    if (spec.magic && !spec.magic(req.body)) throw new ApiError(400, 'UNSUPPORTED_MEDIA');

    const name = `${genId()}.${spec.ext}`;
    fs.writeFileSync(path.join(mediaDir, name), req.body);
    res.status(201).json({ url: `/media/${name}`, type: spec.kind });
  },
);
