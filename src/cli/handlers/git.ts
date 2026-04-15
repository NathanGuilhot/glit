import { EXIT } from '../constants.js'
import { globalFlags } from '../flags.js'
import { commitFiles, getGitStatus, pullBranch, pushBranch } from '../git.js'
import { exit, logError, logJson, logText } from '../logger.js'
import type { ParsedCommand } from '../types.js'
import { requireRepo } from '../validation.js'

export async function handleStatus() {
  requireRepo(globalFlags.repo)
  const status = await getGitStatus(globalFlags.repo)
  if (globalFlags.output === 'json') { logJson(status); return }
  for (const s of status) logText(`${s.staged ? 'Y' : ' '}${s.status[0]!.toUpperCase()} ${s.path}`)
}

export async function handleCommit(cmd: ParsedCommand) {
  requireRepo(globalFlags.repo)
  const message = typeof cmd.flags.message === 'string' ? cmd.flags.message : undefined
  if (!message) { logError('missing required argument: -m <message>'); exit(EXIT.INVALID_USAGE) }

  const files = cmd.args
  const result = await commitFiles(globalFlags.repo, files.length > 0 ? files : ['.'], message)
  if (!result.success) { logError(`commit failed: ${result.error}`); exit(EXIT.GENERAL) }
  logText('Committed.')
}

export async function handlePush(cmd: ParsedCommand) {
  requireRepo(globalFlags.repo)
  const result = await pushBranch(globalFlags.repo, Boolean(cmd.flags.force))
  if (!result.success) { logError(`push failed: ${result.error}`); exit(EXIT.GENERAL) }
  logText('Pushed.')
}

export async function handlePull() {
  requireRepo(globalFlags.repo)
  const result = await pullBranch(globalFlags.repo)
  if (!result.success) {
    logError(`pull failed: ${result.error}`)
    if (result.isNonFastForward) exit(EXIT.REBASE_CONFLICT)
    exit(EXIT.GENERAL)
  }
  logText('Pulled.')
}
