// Runs several writes as one SQLite transaction: they all land, or none do.
// node:sqlite is synchronous, so the work must be synchronous too. Email and
// other outside calls go after the transaction, never inside it.
export function runInTransaction(db, work) {
  db.exec('BEGIN')
  try {
    const result = work()
    db.exec('COMMIT')
    return result
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}
