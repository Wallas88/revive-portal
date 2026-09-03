# Revive Portal

A working full-stack client workspace demo by Waldo Trytsman, built as part of developing backend and database skills alongside front-end development. It demonstrates a client journey for following project progress, reviewing milestones, and leaving feedback.

This repository is a working vertical slice rather than a static dashboard mockup. The React interface talks to an Express API backed by SQLite, with authentication and project-level authorization enforced on the server.

**Live demo:** [revive-portal.onrender.com](https://revive-portal.onrender.com/)

Use `client@demo.local` with password `revive-demo`. The free demo service may take a short moment to wake after a period of inactivity.

This is a shared sample account, not a private client workspace. Do not enter personal, confidential, or real client information. The current free hosting setup uses temporary local storage: messages and sessions can reset when the service sleeps, restarts, or redeploys.

## What it demonstrates

- Responsive React interface built around a real client workflow
- Express 5 API with structured JSON responses and same-origin production serving
- SQLite persistence using Node's built-in database driver
- Password hashing with `scrypt`
- Random bearer tokens with only token hashes stored in the database
- Session expiry, logout invalidation, and protected routes
- Per-project access control for client and admin roles
- Zod request validation, request-size limits, rate limiting, and Helmet headers
- API integration tests using Node's native test runner

## Architecture

```text
React client
    │  same-origin /api requests
    ▼
Express API
    ├── authentication and authorization
    ├── validation and security headers
    └── SQLite persistence
```

The browser keeps the raw session token in `sessionStorage`. The API stores a SHA-256 hash of that token, checks its expiry on every protected request, and filters projects by the authenticated user before returning data.

## Run locally

Requires Node.js 24 or newer and pnpm.

```bash
pnpm install
pnpm dev
```

Open `http://127.0.0.1:5177`. The API runs at `http://127.0.0.1:4180` and Vite proxies `/api` requests during development.

Demo account:

```text
Email:    client@demo.local
Password: revive-demo
```

The local SQLite database is created inside `data/`, which is excluded from Git.

## Verify the build

```bash
pnpm check
```

This runs the API integration suite followed by a production Vite build. The tests cover health checks, anonymous access, login, project retrieval, feedback creation, cross-client isolation, input validation, and logout invalidation.

## API surface

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Service health check |
| `POST` | `/api/auth/login` | Authenticate and create a session |
| `DELETE` | `/api/auth/session` | Revoke the current session |
| `GET` | `/api/me` | Restore the authenticated user |
| `GET` | `/api/projects` | List projects available to the user |
| `GET` | `/api/projects/:id` | Read one project with milestones and messages |
| `POST` | `/api/projects/:id/messages` | Add validated project feedback |

## Production

```bash
pnpm build
pnpm start
```

The production process serves both the built React client and the API. It listens on `0.0.0.0` by default in production so a hosting platform can route traffic to it; `PORT`, `HOST`, `DATABASE_PATH`, `SESSION_HOURS`, and `SEED_DEMO` are configurable through the environment.

This demo is not yet ready for real client data. The following is a starting checklist, not a security certification:

1. Set `SEED_DEMO=false`.
2. Use a persistent volume for `DATABASE_PATH`.
3. Provision users through a controlled administrative workflow.
4. Put the service behind HTTPS and the hosting platform's trusted proxy.
5. Replace the in-memory login limiter if the application runs across multiple instances.

## Project structure

```text
client/    React interface and API client
server/    Express API, authentication, schema, and persistence
test/      API integration tests
public/    Static browser assets
data/      Local SQLite database (ignored)
```

## Scope

The current release deliberately focuses on the core client journey. File storage, password recovery, email notifications, audit history, and an administrative workspace are documented future work—not simulated features presented as complete.

