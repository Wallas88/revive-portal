// Creates (or re-passwords) an admin account. Usage:
//   pnpm admin:create -- --email you@example.com --name "Waldo Trytsman"
// The password is asked for interactively (never on the command line);
// set ADMIN_PASSWORD in the environment for non-interactive use.
import { createInterface } from 'node:readline/promises'
import { loadEnv } from '../config/env.js'
import { openDatabase } from '../db/connection.js'
import { hashPassword } from '../lib/tokens.js'

const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => a.startsWith('--') ? [a.slice(2), all[i + 1]] : []).filter((p) => p.length))
if (!args.email || !args.name) { console.error('Usage: pnpm admin:create -- --email <email> --name "<name>"'); process.exit(1) }

let password = process.env.ADMIN_PASSWORD
if (!password) {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  password = await rl.question('Password (min 10 characters, not echoed back): ')
  rl.close()
}
if (!password || password.length < 10) { console.error('Password must be at least 10 characters.'); process.exit(1) }

const env = loadEnv()
const db = openDatabase(env.DATABASE_PATH)
const existing = db.prepare('SELECT id, role FROM users WHERE email = ? COLLATE NOCASE').get(args.email)
if (existing && existing.role !== 'admin') { console.error('That email belongs to a client account.'); process.exit(1) }
if (existing) {
  db.prepare("UPDATE users SET name = ?, password_hash = ?, status = 'active' WHERE id = ?").run(args.name, hashPassword(password), existing.id)
  db.prepare('UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ? AND revoked_at IS NULL').run(existing.id)
  console.log(`Updated admin ${args.email} (existing sessions revoked).`)
} else {
  db.prepare("INSERT INTO users (name, email, password_hash, role, status) VALUES (?, ?, ?, 'admin', 'active')").run(args.name, args.email, hashPassword(password))
  console.log(`Created admin ${args.email}.`)
}
db.close()
