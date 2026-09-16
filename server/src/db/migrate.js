import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), 'migrations')

// Plain SQL files, applied in filename order, each in its own transaction,
// recorded in schema_migrations. To change the schema: add the next
// NNN_name.sql — never edit one that has shipped.
export function migrate(db, { log = () => {} } = {}) {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`)
  const applied = new Set(db.prepare('SELECT name FROM schema_migrations').all().map((row) => row.name))
  const files = readdirSync(migrationsDir).filter((file) => file.endsWith('.sql')).sort()
  const pending = files.filter((file) => !applied.has(file))
  for (const file of pending) {
    const sql = readFileSync(join(migrationsDir, file), 'utf8')
    db.exec('BEGIN')
    try {
      db.exec(sql)
      db.prepare('INSERT INTO schema_migrations (name) VALUES (?)').run(file)
      db.exec('COMMIT')
      log(`applied ${file}`)
    } catch (error) {
      db.exec('ROLLBACK')
      throw new Error(`Migration ${file} failed: ${error.message}`)
    }
  }
  return pending
}
