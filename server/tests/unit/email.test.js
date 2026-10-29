// The email transport's answers when Resend is slow or unreachable. Uses a
// fake fetch, so nothing leaves the machine.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createEmail } from '../../src/services/email.js'

const TEST_ENV = { RESEND_API_KEY: 'test-key', EMAIL_FROM: 'Portal <portal@test.local>' }
const SHORT_TIMEOUT_MS = 20
const SILENT_LOG = { error() {} }
const MESSAGE = { to: 'client@test.local', subject: 'Hello', text: 'Test message' }

// Never answers; rejects only when the caller's signal aborts, as real fetch does.
function fetchThatNeverAnswers(_url, options) {
  return new Promise(function waitForAbort(_resolve, reject) {
    function rejectWithAbortReason() {
      reject(options.signal.reason)
    }

    options.signal.addEventListener('abort', rejectWithAbortReason)
  })
}

async function fetchThatCannotConnect() {
  throw new TypeError('fetch failed')
}

test('a send that gets no answer gives up after the timeout and reports it', async () => {
  const email = createEmail(TEST_ENV, { fetchImpl: fetchThatNeverAnswers, log: SILENT_LOG, timeoutMs: SHORT_TIMEOUT_MS })

  const result = await email.send(MESSAGE)

  assert.deepEqual(result, { sent: false, reason: 'timeout' })
})

test('a send that cannot connect still reports a network failure', async () => {
  const email = createEmail(TEST_ENV, { fetchImpl: fetchThatCannotConnect, log: SILENT_LOG })

  const result = await email.send(MESSAGE)

  assert.deepEqual(result, { sent: false, reason: 'network' })
})
