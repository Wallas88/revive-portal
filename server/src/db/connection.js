import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { migrate } from './migrate.js'

// Opens (or creates) the SQLite database and brings it to the latest
// migration. ':memory:' is used by the integration tests.
export function openDatabase(filename) {
  const target = filename === ':memory:' ? filename : resolve(filename)
  if (target !== ':memory:') mkdirSync(dirname(target), { recursive: true })
  const db = new DatabaseSync(target)
  db.exec('PRAGMA foreign_keys = ON;')
  if (target !== ':memory:') db.exec('PRAGMA journal_mode = WAL;')
  migrate(db)
  return db
}
