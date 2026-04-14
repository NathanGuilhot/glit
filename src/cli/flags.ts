import type { GlobalFlags } from './types.js'

export const globalFlags: GlobalFlags = {
  repo: process.cwd(),
  output: 'text',
  color: 'auto',
  quiet: false,
  verbose: 0,
  json: false,
  help: false,
  version: false,
}
