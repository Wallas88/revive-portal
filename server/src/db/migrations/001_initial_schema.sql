-- Revive Portal schema, version 1 (September 2026).
-- Replaces the inline CREATE IF NOT EXISTS bootstrap that shipped with the
-- demo. Every project-scoped read/write goes through project_memberships
-- (or role = 'admin'); approvals point at an exact deliverable version.

CREATE TABLE users (
  id            INTEGER PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT,                                   -- NULL until an invitation is accepted
  role          TEXT NOT NULL CHECK (role IN ('client', 'admin')),
  status        TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'active', 'disabled')),
  created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE clients (
  id         INTEGER PRIMARY KEY,
  name       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Which people belong to which client business.
CREATE TABLE client_memberships (
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (client_id, user_id)
);

CREATE TABLE projects (
  id          INTEGER PRIMARY KEY,
  client_id   INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  summary     TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'discovery' CHECK (status IN ('discovery', 'design', 'build', 'review', 'complete')),
  progress    INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  target_date TEXT,
  created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Explicit access: a client user sees a project only with a row here.
CREATE TABLE project_memberships (
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (project_id, user_id)
);

CREATE TABLE milestones (
  id           INTEGER PRIMARY KEY,
  project_id   INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  state        TEXT NOT NULL DEFAULT 'upcoming' CHECK (state IN ('complete', 'active', 'upcoming')),
  position     INTEGER NOT NULL,
  due_date     TEXT,
  completed_at TEXT,
  note         TEXT NOT NULL DEFAULT ''
);

-- Something the client reviews: a homepage design, a revision, a copy deck.
CREATE TABLE deliverables (
  id          INTEGER PRIMARY KEY,
  project_id  INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_by  INTEGER NOT NULL REFERENCES users(id),
  created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Private uploads. stored_key is the path inside UPLOAD_DIR (never the
-- original name); downloads are authorized through the project.
CREATE TABLE files (
  id            INTEGER PRIMARY KEY,
  project_id    INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  uploaded_by   INTEGER NOT NULL REFERENCES users(id),
  original_name TEXT NOT NULL,
  stored_key    TEXT NOT NULL UNIQUE,
  mime_type     TEXT NOT NULL,
  size_bytes    INTEGER NOT NULL,
  sha256        TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at    TEXT
);

-- v1, v2… of a deliverable. A new version never inherits an approval.
CREATE TABLE deliverable_versions (
  id             INTEGER PRIMARY KEY,
  deliverable_id INTEGER NOT NULL REFERENCES deliverables(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  note           TEXT NOT NULL DEFAULT '',
  preview_url    TEXT,
  file_id        INTEGER REFERENCES files(id) ON DELETE SET NULL,
  created_by     INTEGER NOT NULL REFERENCES users(id),
  created_at     TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (deliverable_id, version_number)
);

-- "Please decide on this exact version." Status follows the latest response.
CREATE TABLE approval_requests (
  id                     INTEGER PRIMARY KEY,
  deliverable_version_id INTEGER NOT NULL REFERENCES deliverable_versions(id) ON DELETE CASCADE,
  requested_by           INTEGER NOT NULL REFERENCES users(id),
  message                TEXT NOT NULL DEFAULT '',
  status                 TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'changes_requested', 'withdrawn')),
  due_date               TEXT,
  created_at             TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at            TEXT
);

-- Who decided what, when. Never edited; the history of a version.
CREATE TABLE approval_responses (
  id                  INTEGER PRIMARY KEY,
  approval_request_id INTEGER NOT NULL REFERENCES approval_requests(id) ON DELETE CASCADE,
  responded_by        INTEGER NOT NULL REFERENCES users(id),
  decision            TEXT NOT NULL CHECK (decision IN ('approved', 'changes_requested')),
  feedback            TEXT NOT NULL DEFAULT '',
  created_at          TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE messages (
  id         INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  author_id  INTEGER NOT NULL REFERENCES users(id),
  body       TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 2000),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Server-side, revocable. Only the token hash is stored.
CREATE TABLE sessions (
  id         INTEGER PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL,
  revoked_at TEXT
);

-- Single-use, expiring.
CREATE TABLE invitations (
  id         INTEGER PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL,
  used_at    TEXT
);

CREATE TABLE password_resets (
  id         INTEGER PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL,
  used_at    TEXT
);

-- Who did what. meta is small JSON; never message bodies, never tokens.
CREATE TABLE audit_events (
  id          INTEGER PRIMARY KEY,
  actor_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  project_id  INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  action      TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id   INTEGER,
  meta        TEXT NOT NULL DEFAULT '{}',
  created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_projects_client            ON projects(client_id);
CREATE INDEX idx_project_memberships_user   ON project_memberships(user_id);
CREATE INDEX idx_milestones_project         ON milestones(project_id, position);
CREATE INDEX idx_deliverables_project       ON deliverables(project_id);
CREATE INDEX idx_versions_deliverable       ON deliverable_versions(deliverable_id, version_number);
CREATE INDEX idx_requests_version           ON approval_requests(deliverable_version_id, status);
CREATE INDEX idx_responses_request          ON approval_responses(approval_request_id, created_at);
CREATE INDEX idx_messages_project           ON messages(project_id, created_at);
CREATE INDEX idx_files_project              ON files(project_id, created_at);
CREATE INDEX idx_sessions_user              ON sessions(user_id, expires_at);
CREATE INDEX idx_invitations_user           ON invitations(user_id);
CREATE INDEX idx_audit_project              ON audit_events(project_id, created_at);
