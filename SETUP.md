# Revive Portal — setup

Node 24+, pnpm. SQLite through `node:sqlite` (no native build step).

## Local development

```bash
pnpm install
cp .env.example .env            # edit if the defaults don't suit
pnpm admin:setup                # asks for name, email and a hidden password; runs once
pnpm dev                        # API on :4180, Vite on :5177 (proxies /api)
```

Open http://127.0.0.1:5177, sign in as the admin, create a client, invite a
person. Without an email provider the invitation link is shown on screen —
copy it and open it in a private window to try the client side.

Demo data (an admin, one client, one project with a pending decision) for
exploring the UI: `pnpm seed:demo`. It refuses to run with
`NODE_ENV=production`. Accounts: `admin@demo.local / demo-admin-pass`,
`client@demo.local / revive-demo`.

## Environment

Every variable is read once in `server/src/config/env.js`.

| Variable | Default | Meaning |
|---|---|---|
| `NODE_ENV` | `development` | `production` turns on secure cookies, CSP, static serving of `dist/` |
| `PORT`, `HOST` | `4180`, `127.0.0.1` (`0.0.0.0` in production) | |
| `DATABASE_PATH` | `./data/revive-portal.db` | SQLite file; migrations run on start |
| `UPLOAD_DIR` | `./data/uploads` | private file storage; never served statically |
| `MAX_UPLOAD_MB` | `15` | per-file limit |
| `SESSION_HOURS` | `12` | session cookie lifetime |
| `APP_URL` | `http://127.0.0.1:5177` | public origin used in invitation / reset links |
| `RESEND_API_KEY` | — | optional; enables emailing invitations and resets |
| `EMAIL_FROM` | `Revive Portal <portal@siterevivesa.com>` | sender (domain must be verified at the provider) |

## Migrations

`server/src/db/migrations/NNN_name.sql`, applied in order on server start and
by `pnpm migrate`, recorded in `schema_migrations`. To change the schema add
the next numbered file; never edit one that has been applied anywhere.

## Production (Render)

`render.yaml` describes it. It ships on the **free** plan, where the database
and uploads live on the instance's own filesystem and are wiped on every
deploy — good for trying it, not for a real client. Before the first client:
switch the instance to Starter, uncomment the disk block and the two
`/var/data` paths in `render.yaml` (or add the same in the dashboard), and
data survives restarts and deploys. First deploy:

1. Create the service from the blueprint; set `RESEND_API_KEY` in the
   dashboard if you want email (optional).
2. Open a shell on the service and run `pnpm admin:setup` (interactive; it
   refuses to run if an admin already exists - `pnpm admin:reset-password`
   changes the password later).
3. Sign in at `APP_URL`, create the first client.

Do not run `seed:demo` in production. There are no demo credentials in the
production build.

## Tests

```bash
pnpm test      # integration tests against an in-memory database
pnpm check     # tests + client build
```

The tests cover: cross-client isolation (projects, messages, approvals,
files), clients attempting admin actions, expired and re-issued invitations,
revoked sessions, CSRF, rate limiting, upload type checks, and approval
history staying attached to its exact version.
