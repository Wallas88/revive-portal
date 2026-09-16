// One-time interactive setup of the admin account:
//   pnpm admin:setup
// Asks for name, email and password (typed blind, confirmed once), hashes
// the password with scrypt and stores the account. Refuses to run if an
// admin already exists - use `pnpm admin:reset-password` for that.
import { loadEnv } from '../config/env.js'
import { openDatabase } from '../db/connection.js'
import { hashPassword } from '../lib/tokens.js'
import { ask, askHidden } from '../lib/prompt.js'

const MIN_LENGTH = 12
const fail = (message) => { console.error(message); process.exit(1) }

const env = loadEnv()
const db = openDatabase(env.DATABASE_PATH)
try {
  const existing = db.prepare("SELECT email FROM users WHERE role = 'admin' ORDER BY id LIMIT 1").get()
  if (existing) fail(`An admin account already exists (${existing.email}). This command will not overwrite it.\nTo change its password: pnpm admin:reset-password`)

  console.log('Revive Portal - admin setup (runs once).')
  const name = await ask('Your name: ')
  if (name.length < 2) fail('Name must be at least 2 characters.')
  const email = (await ask('Email address: ')).toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('That does not look like an email address.')
  if (db.prepare('SELECT 1 FROM users WHERE email = ? COLLATE NOCASE').get(email)) fail('That email already has an account.')
  const password = await askHidden(`Password (at least ${MIN_LENGTH} characters, not shown): `)
  if (password.length < MIN_LENGTH) fail(`Password must be at least ${MIN_LENGTH} characters.`)
  const confirm = await askHidden('Confirm password: ')
  if (confirm !== password) fail('The two passwords do not match. Nothing was saved.')

  db.prepare("INSERT INTO users (name, email, password_hash, role, status) VALUES (?, ?, ?, 'admin', 'active')").run(name, email, hashPassword(password))
  console.log(`Admin account created for ${email}. Sign in at ${env.APP_URL}/login`)
} catch (error) {
  fail(error.message === 'Cancelled.' ? 'Cancelled. Nothing was saved.' : `Setup failed: ${error.message}`)
} finally {
  db.close()
}
