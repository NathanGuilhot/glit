import { logText } from '../logger.js'
import { getStore } from '../store.js'

export async function handleList() {
  const store = getStore()
  const running = Object.entries(store.devCommands)
  if (running.length === 0) { logText('No running processes.'); return }
  logText('WORKTREE                  COMMAND')
  for (const [wtPath, command] of running) logText(`${wtPath.padEnd(24)} ${command}`)
}
