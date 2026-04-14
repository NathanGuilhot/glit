import { SUBCOMMANDS } from './constants.js'
import { globalFlags } from './flags.js'
import type { ParsedCommand } from './types.js'

export function parseArgs(args: string[]): ParsedCommand {
  const cmd: ParsedCommand = { command: '', args: [], flags: {} }
  let i = 0

  while (i < args.length) {
    const arg = args[i]!

    if (arg === '--') { cmd.args.push(...args.slice(i + 1)); break }

    if (arg.startsWith('--')) {
      const flag = arg.slice(2)
      if (flag.includes('=')) {
        const [key, value] = flag.split('=', 2)
        cmd.flags[key!] = value!
      } else if (['repo', 'output', 'color'].includes(flag)) {
        cmd.flags[flag] = args[++i] ?? 'true'
      } else {
        cmd.flags[flag] = true
      }
    } else if (arg.startsWith('-') && arg !== '-') {
      for (const short of arg.slice(1)) {
        if (short === 'r') cmd.flags.repo = args[++i] ?? 'true'
        else if (short === 'o') cmd.flags.output = args[++i] ?? 'text'
        else if (short === 'q') cmd.flags.quiet = true
        else if (short === 'v') cmd.flags.verbose = ((cmd.flags.verbose as number) || 0) + 1
        else if (short === 'h') cmd.flags.help = true
        else if (short === 'V') cmd.flags.version = true
        else if (short === 'j') cmd.flags.json = true
        else cmd.flags[short] = true
      }
    } else if (!cmd.command) {
      cmd.command = arg
    } else if (!cmd.subcommand && SUBCOMMANDS.has(arg)) {
      cmd.subcommand = arg
    } else {
      cmd.args.push(arg)
    }
    i++
  }
  return cmd
}

export function applyEnvOverrides(): void {
  if (process.env.GLIT_REPO_PATH) globalFlags.repo = process.env.GLIT_REPO_PATH
  if (process.env.GLIT_OUTPUT) globalFlags.output = process.env.GLIT_OUTPUT as 'text' | 'json'
  if (process.env.GLIT_COLOR) globalFlags.color = process.env.GLIT_COLOR as 'always' | 'never' | 'auto'
  if (process.env.GLIT_DEBUG) globalFlags.verbose = 1
}

export function applyFlags(cmd: ParsedCommand): void {
  if (cmd.flags.repo) globalFlags.repo = String(cmd.flags.repo)
  if (cmd.flags.output) globalFlags.output = cmd.flags.output as 'text' | 'json'
  if (cmd.flags.color) globalFlags.color = cmd.flags.color as 'always' | 'never' | 'auto'
  if (cmd.flags.quiet) globalFlags.quiet = true
  if (cmd.flags.verbose) globalFlags.verbose = Number(cmd.flags.verbose)
  if (cmd.flags.json) globalFlags.output = 'json'
  if (cmd.flags.help) globalFlags.help = true
  if (cmd.flags.version) globalFlags.version = true
}
