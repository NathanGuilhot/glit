import { globalFlags } from '../flags.js'
import { logText } from '../logger.js'
import { getStore } from '../store.js'
import type { ParsedCommand } from '../types.js'
import { requireRepo } from '../validation.js'

export async function handleTerminal(cmd: ParsedCommand) {
  const wtPath = cmd.args[0] || globalFlags.repo
  requireRepo(wtPath)
  const terminal = (cmd.flags.terminal as string) || getStore().settings.preferredTerminal
  logText(`Opening terminal at ${wtPath} with ${terminal}...`)
}

export async function handleIde(cmd: ParsedCommand) {
  const wtPath = cmd.args[0] || globalFlags.repo
  requireRepo(wtPath)
  const ide = (cmd.flags.ide as string) || getStore().settings.preferredIDE
  logText(`Opening ${ide} at ${wtPath}...`)
}
