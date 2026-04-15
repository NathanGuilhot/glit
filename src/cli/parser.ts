import { SUBCOMMANDS } from './constants.js'
import { globalFlags } from './flags.js'
import type { ParsedCommand } from './types.js'

const VALUE_FLAGS = new Set(['repo', 'output', 'color', 'base', 'path', 'format', 'branch', 'terminal', 'ide', 'message'])
const OUTPUT_VALUES = ['text', 'json'] as const
const COLOR_VALUES = ['always', 'never', 'auto'] as const

function asOutput(v: unknown): 'text' | 'json' | undefined {
  return typeof v === 'string' && (OUTPUT_VALUES as readonly string[]).includes(v) ? v as 'text' | 'json' : undefined
}
function asColor(v: unknown): 'always' | 'never' | 'auto' | undefined {
  return typeof v === 'string' && (COLOR_VALUES as readonly string[]).includes(v) ? v as 'always' | 'never' | 'auto' : undefined
}

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
      } else if (VALUE_FLAGS.has(flag)) {
        const next = args[i + 1]
        if (next !== undefined && !next.startsWith('-')) { cmd.flags[flag] = next; i++ }
        else cmd.flags[flag] = true
      } else {
        cmd.flags[flag] = true
      }
    } else if (arg.startsWith('-') && arg !== '-') {
      for (const short of arg.slice(1)) {
        if (short === 'r') cmd.flags.repo = args[++i] ?? 'true'
        else if (short === 'o') cmd.flags.output = args[++i] ?? 'text'
        else if (short === 'm') cmd.flags.message = args[++i] ?? ''
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
  const envOutput = asOutput(process.env.GLIT_OUTPUT)
  if (envOutput) globalFlags.output = envOutput
  const envColor = asColor(process.env.GLIT_COLOR)
  if (envColor) globalFlags.color = envColor
  if (process.env.GLIT_DEBUG) globalFlags.verbose = 1
}

export function applyFlags(cmd: ParsedCommand): void {
  if (cmd.flags.repo) globalFlags.repo = String(cmd.flags.repo)
  const output = asOutput(cmd.flags.output)
  if (output) globalFlags.output = output
  const color = asColor(cmd.flags.color)
  if (color) globalFlags.color = color
  if (cmd.flags.quiet) globalFlags.quiet = true
  if (cmd.flags.verbose) globalFlags.verbose = Number(cmd.flags.verbose)
  if (cmd.flags.json) globalFlags.output = 'json'
  if (cmd.flags.help) globalFlags.help = true
  if (cmd.flags.version) globalFlags.version = true
}
