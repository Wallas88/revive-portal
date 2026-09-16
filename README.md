# Revive Portal

The client portal behind SiteReviveSA projects: clients follow their website
build, review deliverables, approve or request changes, talk in one channel
and pick up shared files. Waldo runs it from an admin workspace.

**Live:** https://revive-portal.onrender.com/

## What it does

- **Admin (Waldo):** create clients and invite their people; create projects
  and give access; keep milestones and progress current; share previews and
  files; ask for a decision on an exact version of a deliverable; see every
  outstanding decision in one queue.
- **Client:** sign in through an invitation; see only the projects they were
  given; read updates and milestones; review a deliverable; approve or
  request changes with feedback; message and download shared files.

Approvals point at a specific `deliverable_versions` row. A new version never
inherits an earlier decision; who decided what, and when, is kept as history.

## Architecture

React 19 + Vite (`client/src`) talking to Express 5 (`server/src`) over a
same-origin JSON API, SQLite through `node:sqlite`. No ORM, no build step
for the server.

```
client/src/
  app/            App.jsx, router.jsx (react-router)
  layouts/        AuthLayout, PortalLayout
  features/       auth, dashboard, projects, milestones, approvals, messages, files, admin
  components/ui/  shared states, fields, tabs, panel
  lib/            api.js (fetch + CSRF), format.js
  styles/         tokens.css, global.css, ui.css
server/src/
  app.js          wiring; server.js entry
  config/env.js   every environment variable, validated once
  middleware/     cookies, csrf, authenticate, requireAdmin, validateRequest, rateLimit, errorHandler
  modules/        auth, clients, projects, milestones, deliverables, messages, files
                  (routes → service/queries where the module warrants it)
  db/             connection.js, migrate.js, migrations/*.sql
  services/       audit.js, email.js, storage.js
  scripts/        admin-create, seed-demo, migrate
server/tests/integration/
```

Security in one paragraph: httpOnly cookie sessions stored server-side and
revocable; CSRF double-submit on every write; every project read/write —
including file downloads — is authorized through `project_memberships` (or
the admin role) on the server; scrypt passwords; single-use expiring
invitation and reset tokens (hashed at rest); rate-limited auth endpoints;
uploads allow-listed by type and signature, stored under random keys outside
any static path; audit trail without message bodies or tokens.

## Run it

See **SETUP.md** (local, environment, migrations, Render) and **BACKUP.md**.

```bash
pnpm install && pnpm admin:create -- --email you@example.com --name "You" && pnpm dev
```

## Not done yet

Reported honestly so nobody assumes otherwise:

- **Email notifications** on new messages/decisions — the transport exists
  (`services/email.js`, used for invitations and resets when `RESEND_API_KEY`
  is set) but nothing else sends yet.
- **In-portal password change** for a signed-in user (reset by email works).
- **Object storage** — files live on the service's disk; `services/storage.js`
  is the seam for R2/S3.
- **Rate limiting across instances** — in-memory, fine for one process.
- **Pagination** — messages are capped at 50 per load; activity at 30.
