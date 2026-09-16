// Terminal prompts for the one-off admin scripts. askHidden reads the
// password with the terminal's echo off, so nothing appears while typing
// and nothing lands in scrollback. When stdin is not a terminal (a pipe,
// used by tests), lines are read plainly - nothing is echoed either way.
import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'

let lines = null
async function nextLine() {
  if (!lines) {
    const chunks = []
    for await (const chunk of stdin) chunks.push(chunk)
    lines = Buffer.concat(chunks).toString('utf8').split(/\r?\n/)
  }
  return lines.shift() ?? ''
}

export async function ask(question) {
  if (!stdin.isTTY) return (await nextLine()).trim()
  const rl = createInterface({ input: stdin, output: stdout })
  const answer = await rl.question(question)
  rl.close()
  return answer.trim()
}

export function askHidden(question) {
  if (!stdin.isTTY) return nextLine()
  return new Promise((resolve, reject) => {
    stdout.write(question)
    stdin.setRawMode(true); stdin.resume(); stdin.setEncoding('utf8')
    let value = ''
    const done = (result) => { stdin.setRawMode(false); stdin.pause(); stdin.removeListener('data', onData); stdout.write('\n'); result instanceof Error ? reject(result) : resolve(result) }
    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === '\u0003') return done(new Error('Cancelled.'))            // Ctrl+C
        if (ch === '\r' || ch === '\n') return done(value)
        if (ch === '\u007f' || ch === '\b') { value = value.slice(0, -1); continue }
        if (ch >= ' ') value += ch
      }
    }
    stdin.on('data', onData)
  })
}
