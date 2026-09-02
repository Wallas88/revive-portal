# Revive Portal

A small, production-minded client project portal designed and built by Waldo Trytsman. It gives clients one calm place to see progress, milestones, next actions, and project messages.

## What it proves

- Responsive React interface with purposeful product design
- Express API with structured JSON responses
- SQLite persistence using Node's built-in database driver
- Password hashing with `scrypt` and hashed bearer sessions
- Per-project access control, input validation, rate limiting, and security headers
- API integration tests using Node's native test runner
- One-process production serving after the Vite build

## Run locally

Requires Node 24+ and pnpm.

```bash
pnpm install
pnpm dev
```

Open `http://127.0.0.1:5177`.

Demo account:

```text
client@demo.local
revive-demo
```

The API runs at `http://127.0.0.1:4180`. Demo data is created locally in `data/` and is excluded from Git.

## Verify

```bash
pnpm check
```

## Production

```bash
pnpm build
pnpm start
```

Set `SEED_DEMO=false` outside a portfolio demonstration and provision users through an administrative workflow before using real client data. Copy `.env.example` to `.env` and adjust the database path and session duration for the deployment environment.

## Structure

```text
client/    React UI and API client
server/    HTTP API, auth, schema, and persistence
test/      Integration tests
data/      Local SQLite database (ignored)
```

This is intentionally a focused vertical slice. File storage, password recovery, email notifications, audit history, and an admin workspace belong in a later release rather than being faked in the first one.
