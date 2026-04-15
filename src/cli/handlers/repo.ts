import * as path from 'path'

import { globalFlags } from '../flags.js'
import { logJson, logText } from '../logger.js'
import { isGitRepo } from '../validation.js'

export async function handleDetect() {
  const cwd = process.cwd()
  const isRepo = isGitRepo(cwd)
  const name = path.basename(cwd)
  const displayPath = cwd.replace(process.env.HOME || '', '~')

  if (globalFlags.output === 'json') logJson({ isRepo, path: cwd, displayPath, name })
  else logText(`${displayPath}  ${isRepo ? '✓ git repo (current)' : '✗ not a git repo'}`)
}
