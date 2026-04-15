import { globalFlags } from '../flags.js'
import { logJson, logText } from '../logger.js'
import { getStore } from '../store.js'

export async function handleList() {
  const store = getStore()
  const commands = Object.entries(store.devCommands).map(([worktree, command]) => ({ worktree, command }))
  if (globalFlags.output === 'json') { logJson(commands); return }
  if (commands.length === 0) { logText('No saved dev commands.'); return }
  logText('WORKTREE                  SAVED COMMAND')
  for (const { worktree, command } of commands) logText(`${worktree.padEnd(24)} ${command}`)
}
