#!/usr/bin/env node
import { EXIT, VERSION } from './constants.js'
import { globalFlags } from './flags.js'
import { COMMANDS } from './handlers/index.js'
import { showHelp } from './help.js'
import { exit, logError, logText } from './logger.js'
import { applyEnvOverrides, applyFlags, parseArgs } from './parser.js'
import type { ParsedCommand } from './types.js'

async function dispatch(cmd: ParsedCommand): Promise<void> {
  if (cmd.command === 'help' || cmd.command === '') { showHelp(); return }
  if (cmd.command === 'version') { logText(`glit v${VERSION}`); return }

  const command = COMMANDS[cmd.command]
  if (!command) { logError(`Unknown command: ${cmd.command}`); logText("Run 'glit --help' for usage."); exit(EXIT.INVALID_USAGE) }

  const subcommand = cmd.subcommand ?? ''
  const handler = command.handlers[subcommand]
  if (!handler) {
    const available = Object.keys(command.handlers).join(', ')
    logError(`unknown ${cmd.command} subcommand: ${subcommand || '(none)'}`)
    logText(`Available subcommands: ${available}`)
    exit(EXIT.INVALID_USAGE)
  }

  await handler(cmd)
}

async function main(): Promise<void> {
  const rawArgs = process.argv.slice(2)
  applyEnvOverrides()
  const cmd = parseArgs(rawArgs)
  applyFlags(cmd)

  if (globalFlags.version) { logText(`glit v${VERSION}`); exit(EXIT.SUCCESS) }
  if (globalFlags.help) { showHelp(cmd.command || undefined, cmd.subcommand); exit(EXIT.SUCCESS) }

  await dispatch(cmd)
  exit(EXIT.SUCCESS)
}

main().catch((err) => {
  logError(err instanceof Error ? err.message : String(err))
  exit(EXIT.GENERAL)
})
