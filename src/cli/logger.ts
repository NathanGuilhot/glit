import { globalFlags } from './flags.js'

export const logVerbose = (msg: string): void => {
  if (globalFlags.verbose > 0) process.stderr.write(`[verbose] ${msg}\n`)
}

export const logError = (msg: string, hint?: string): void => {
  process.stderr.write(`glit: ${msg}\n`)
  if (hint) process.stderr.write(`  Hint: ${hint}\n`)
}

export const logJson = (data: unknown): void => {
  process.stdout.write(JSON.stringify(data, null, 2) + '\n')
}

export const logText = (msg: string): void => {
  if (!globalFlags.quiet) process.stdout.write(msg + '\n')
}

export function exit(code: number): never {
  return process.exit(code)
}
