// Outbound email. With RESEND_API_KEY set, sends through Resend's HTTP API;
// without it, reports "not sent" so callers can fall back to handing the
// link to the admin. Never logs message contents.

// How long to wait for Resend before giving up, so a provider that hangs
// never hangs the admin's request with it.
export const EMAIL_TIMEOUT_MS = 10_000

export function createEmail(env, { fetchImpl = globalThis.fetch, log = console, timeoutMs = EMAIL_TIMEOUT_MS } = {}) {
  const enabled = Boolean(env.RESEND_API_KEY)
  return {
    enabled,
    async send({ to, subject, text }) {
      if (!enabled) return { sent: false, reason: 'no-transport' }
      try {
        const response = await fetchImpl('https://api.resend.com/emails', {
          method: 'POST',
          headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
          body: JSON.stringify({ from: env.EMAIL_FROM, to, subject, text }),
          signal: AbortSignal.timeout(timeoutMs),
        })
        if (!response.ok) {
          log.error(`email send failed: ${response.status}`)
          return { sent: false, reason: `http-${response.status}` }
        }
        return { sent: true }
      } catch (error) {
        if (error.name === 'TimeoutError') {
          log.error(`email send timed out after ${timeoutMs}ms`)
          return { sent: false, reason: 'timeout' }
        }
        log.error(`email send failed: ${error.message}`)
        return { sent: false, reason: 'network' }
      }
    },
  }
}
