import type { GlobalFlags } from './types.js'

export const globalFlags: GlobalFlags = {
  repo: process.cwd(),
  output: 'text',
  color: 'auto',
  quiet: false,
  verbose: 0,
  help: false,
  version: false,
}
