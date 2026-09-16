// Reset an admin's password from the server shell (for when email delivery
// is not configured, or the admin is locked out):
//   pnpm admin:reset-password
// Asks which admin (by email) and for the new password, typed blind and
// confirmed. Every session for that account is revoked.
import { loadEnv } from '../config/env.js'
import { openDatabase } from '../db/connection.js'
import { hashPassword } from '../lib/tokens.js'
import { ask, askHidden } from '../lib/prompt.js'

const MIN_LENGTH = 12
const fail = (message) => { console.error(message); process.exit(1) }

const env = loadEnv()
const db = openDatabase(env.DATABASE_PATH)
try {
  const admins = db.prepare("SELECT id, email FROM users WHERE role = 'admin' ORDER BY id").all()
  if (!admins.length) fail('No admin account exists yet. Run: pnpm admin:setup')
  console.log('Revive Portal - admin password reset.')
  const email = (await ask(admins.length === 1 ? `Email address (${admins[0].email}): ` : 'Email address of the admin: ')).toLowerCase() || admins[0].email
  const admin = admins.find((a) => a.email.toLowerCase() === email)
  if (!admin) fail('No admin account with that email.')
  const password = await askHidden(`New password (at least ${MIN_LENGTH} characters, not shown): `)
  if (password.length < MIN_LENGTH) fail(`Password must be at least ${MIN_LENGTH} characters.`)
  const confirm = await askHidden('Confirm new password: ')
  if (confirm !== password) fail('The two passwords do not match. Nothing was changed.')

  db.exec('BEGIN')
  db.prepare("UPDATE users SET password_hash = ?, status = 'active' WHERE id = ?").run(hashPassword(password), admin.id)
  db.prepare('UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ? AND revoked_at IS NULL').run(admin.id)
  db.exec('COMMIT')
  console.log(`Password updated for ${admin.email}; all their sessions were signed out.`)
} catch (error) {
  try { db.exec('ROLLBACK') } catch {}
  fail(error.message === 'Cancelled.' ? 'Cancelled. Nothing was changed.' : `Reset failed: ${error.message}`)
} finally {
  db.close()
}
