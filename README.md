# Quiz Party 🎉

A **Usion mini-app**: create quizzes and play them two ways —

- **Live** (Kahoot-style): host a quiz in real time. Friends join from a chat
  game invite, the in-game **Invite friends** picker, or by typing the 6-letter
  code on the home screen. The host's device runs the show; answers are scored
  by speed and everyone sees the reveal, scoreboard, and podium together.
- **Anytime**: play any quiz solo whenever you like. Answers are graded
  **server-side** (the client never receives the correct answers), and each
  quiz has its own persistent leaderboard.

Quizzes are **public** (searchable by everyone) or **private** (reachable only
via their share code).

## How it maps onto the Usion platform

| Concern | Mechanism |
| --- | --- |
| Identity | Client forwards the SDK `config.authToken`; this server introspects it against `GET {USION_API_URL}/auth/me` (pinned base URL, cached) |
| Live transport | Platform relay (`connection_mode: "platform"`) — `Usion.game.action()` for questions/reveals (sequenced + replayed on sync), `Usion.game.realtime()` for answers/acks/roster |
| Live authority | Host-authoritative: `player_ids[0]` scores answers and broadcasts results |
| Join by code | `Usion.lobby` party codes; on start the host creates a room via `POST /games/rooms` and `lobby.start(roomId)`, members REST-join then `Usion.game.join` |
| Invites | Platform-owned: chat `game_invite` cards, `Usion.game.invite()`, and Share-button solo→host promotion (`onRoomAssigned`) |
| Quiz storage | This server: Express + SQLite (`node:sqlite`, WAL) on a Railway volume |
| Anytime scoring | Server-graded per answer (`/attempts/:id/answers`), per-quiz leaderboard |

The scoring formula is identical in both modes: a correct answer earns
1000 → 500 points, decaying linearly over the question's time limit
(`server/scoring.js` = `public/live-common.js`).

## Structure

```
server/   Express API: auth introspection, quiz CRUD, attempts + leaderboards
public/   Static client (no build step) — loads https://usions.com/usion-sdk.js
test/     node --test unit tests (validation + scoring)
```

## Local development

```bash
npm install
npm run dev            # http://localhost:3022
npm test
```

Outside the Usion host, open `http://localhost:3022/?dev=1&user=alice` — a dev
identity is injected (accepted by the server only when `NODE_ENV !== 'production'`).
Live mode needs the real platform (or the Usion devkit fake host).

## Environment

| Var | Purpose | Default |
| --- | --- | --- |
| `PORT` | HTTP port | `3022` |
| `DATA_DIR` | SQLite directory (Railway volume mount) | `./data` |
| `USION_API_URL` | Usion platform base for token introspection | `https://mobile.mongolai.mn` |

## Deploy

Railway (Singapore), one service: static client + API from the same host, with
a volume mounted at `/data`. Registered in the Usion service registry as
`quiz-party` with `realtime.connection_mode: "platform"`, `max_players: 50`
(seed script `backend/scripts/seed_quiz_party.py` in the Usion monorepo).
