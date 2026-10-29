// runInTransaction: every write lands, or none do.
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { test } from 'node:test'
import { runInTransaction } from '../../src/db/transaction.js'

function freshDatabase() {
  const db = new DatabaseSync(':memory:')
  db.exec('CREATE TABLE notes (text TEXT NOT NULL)')
  return db
}

function countNotes(db) {
  return db.prepare('SELECT COUNT(*) AS count FROM notes').get().count
}

test('all writes land and the work result is returned when nothing fails', () => {
  const db = freshDatabase()

  function writeTwoNotes() {
    db.prepare('INSERT INTO notes (text) VALUES (?)').run('first')
    db.prepare('INSERT INTO notes (text) VALUES (?)').run('second')
    return 'done'
  }

  const result = runInTransaction(db, writeTwoNotes)

  assert.equal(result, 'done')
  assert.equal(countNotes(db), 2)
})

test('no writes land and the error reaches the caller when a later step fails', () => {
  const db = freshDatabase()

  function writeOneThenFail() {
    db.prepare('INSERT INTO notes (text) VALUES (?)').run('first')
    throw new Error('second step failed')
  }

  assert.throws(function runFailingWork() {
    runInTransaction(db, writeOneThenFail)
  }, /second step failed/)
  assert.equal(countNotes(db), 0)
})
