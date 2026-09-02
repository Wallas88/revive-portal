import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { hashPassword } from './auth.js'

export function createDatabase(filename = process.env.DATABASE_PATH || './data/revive-portal.db') {
  const target = filename === ':memory:' ? filename : resolve(filename)
  if (target !== ':memory:') mkdirSync(dirname(target), { recursive: true })
  const db = new DatabaseSync(target)
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;')
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('client', 'admin')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY,
      client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      summary TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('discovery', 'design', 'build', 'review', 'complete')),
      progress INTEGER NOT NULL CHECK (progress BETWEEN 0 AND 100),
      target_date TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS milestones (
      id INTEGER PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      state TEXT NOT NULL CHECK (state IN ('complete', 'active', 'upcoming')),
      position INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 2000),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_projects_client ON projects(client_id);
    CREATE INDEX IF NOT EXISTS idx_milestones_project ON milestones(project_id, position);
    CREATE INDEX IF NOT EXISTS idx_messages_project ON messages(project_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);
  `)
  return db
}

export function seedDemo(db) {
  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get('client@demo.local')
  if (exists) return
  db.exec('BEGIN')
  try {
    const user = db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?) RETURNING id')
      .get('Mara Jacobs', 'client@demo.local', hashPassword('revive-demo'), 'client')
    const project = db.prepare('INSERT INTO projects (client_id, name, summary, status, progress, target_date) VALUES (?, ?, ?, ?, ?, ?) RETURNING id')
      .get(user.id, 'Northstar Website', 'A focused service website built around qualified enquiries and a cleaner client journey.', 'build', 64, '2026-10-18')
    const addMilestone = db.prepare('INSERT INTO milestones (project_id, title, state, position) VALUES (?, ?, ?, ?)')
    ;[
      ['Discovery & content map', 'complete'],
      ['Visual direction', 'complete'],
      ['Responsive build', 'active'],
      ['Content review', 'upcoming'],
      ['Launch & handover', 'upcoming'],
    ].forEach(([title, state], position) => addMilestone.run(project.id, title, state, position))
    db.prepare('INSERT INTO messages (project_id, author_id, body) VALUES (?, ?, ?)')
      .run(project.id, user.id, 'The revised service structure looks much clearer. I have added the final testimonial copy for review.')
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}
