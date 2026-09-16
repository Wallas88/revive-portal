// Applies pending migrations and exits. Runs automatically on server start
// too; this exists for deploy hooks and for checking a backup restores.
import { loadEnv } from '../config/env.js'
import { openDatabase } from '../db/connection.js'
import { migrate } from '../db/migrate.js'
const env = loadEnv()
const db = openDatabase(env.DATABASE_PATH)
const applied = migrate(db, { log: console.log })
console.log(applied.length ? `${applied.length} migration(s) applied.` : 'Schema is up to date.')
db.close()
