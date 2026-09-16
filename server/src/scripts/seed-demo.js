// Demo data for local exploration only. Refuses to run in production.
//   pnpm seed:demo
// Accounts: admin@demo.local / demo-admin-pass · client@demo.local / revive-demo
import { loadEnv } from '../config/env.js'
import { openDatabase } from '../db/connection.js'
import { hashPassword } from '../lib/tokens.js'

const env = loadEnv()
if (env.production) { console.error('seed:demo refuses to run with NODE_ENV=production.'); process.exit(1) }
const db = openDatabase(env.DATABASE_PATH)
if (db.prepare("SELECT 1 FROM users WHERE email = 'client@demo.local'").get()) { console.log('Demo data already present.'); process.exit(0) }

db.exec('BEGIN')
try {
  const admin = db.prepare("INSERT INTO users (name, email, password_hash, role, status) VALUES (?, ?, ?, 'admin', 'active') RETURNING id").get('Waldo Trytsman', 'admin@demo.local', hashPassword('demo-admin-pass'))
  const client = db.prepare('INSERT INTO clients (name) VALUES (?) RETURNING id').get('Northstar Consulting')
  const mara = db.prepare("INSERT INTO users (name, email, password_hash, role, status) VALUES (?, ?, ?, 'client', 'active') RETURNING id").get('Mara Jacobs', 'client@demo.local', hashPassword('revive-demo'))
  db.prepare('INSERT INTO client_memberships (client_id, user_id) VALUES (?, ?)').run(client.id, mara.id)
  const project = db.prepare('INSERT INTO projects (client_id, name, summary, status, progress, target_date) VALUES (?, ?, ?, ?, ?, ?) RETURNING id')
    .get(client.id, 'Northstar Website', 'A focused service website built around qualified enquiries and a cleaner client journey.', 'build', 64, '2026-10-18')
  db.prepare('INSERT INTO project_memberships (project_id, user_id) VALUES (?, ?)').run(project.id, mara.id)
  const addMilestone = db.prepare('INSERT INTO milestones (project_id, title, state, position, due_date) VALUES (?, ?, ?, ?, ?)')
  ;[['Discovery & content map', 'complete', '2026-09-05'], ['Visual direction', 'complete', '2026-09-12'], ['Responsive build', 'active', '2026-09-30'], ['Content review', 'upcoming', '2026-10-08'], ['Launch & handover', 'upcoming', '2026-10-18']]
    .forEach(([title, state, due], position) => addMilestone.run(project.id, title, state, position, due))
  const deliverable = db.prepare('INSERT INTO deliverables (project_id, title, description, created_by) VALUES (?, ?, ?, ?) RETURNING id')
    .get(project.id, 'Homepage design', 'Desktop and mobile layouts for the new homepage.', admin.id)
  db.prepare('INSERT INTO deliverable_versions (deliverable_id, version_number, note, preview_url, created_by) VALUES (?, 1, ?, ?, ?)')
    .run(deliverable.id, 'First pass: hero, services and enquiry section.', 'https://example.com/preview/homepage-v1', admin.id)
  const v2 = db.prepare('INSERT INTO deliverable_versions (deliverable_id, version_number, note, preview_url, created_by) VALUES (?, 2, ?, ?, ?) RETURNING id')
    .get(deliverable.id, 'Revision: tighter hero copy, testimonials moved up.', 'https://example.com/preview/homepage-v2', admin.id)
  db.prepare('INSERT INTO approval_requests (deliverable_version_id, requested_by, message, due_date) VALUES (?, ?, ?, ?)')
    .run(v2.id, admin.id, 'Please review the revised homepage on phone and desktop.', '2026-09-24')
  db.prepare('INSERT INTO messages (project_id, author_id, body) VALUES (?, ?, ?)').run(project.id, admin.id, 'Revised homepage is up for review — the testimonials now sit above the fold on mobile.')
  db.prepare('INSERT INTO messages (project_id, author_id, body) VALUES (?, ?, ?)').run(project.id, mara.id, 'The revised service structure looks much clearer. I have added the final testimonial copy for review.')
  db.exec('COMMIT')
  console.log('Demo data seeded: admin@demo.local / demo-admin-pass · client@demo.local / revive-demo')
} catch (error) { db.exec('ROLLBACK'); throw error }
db.close()
