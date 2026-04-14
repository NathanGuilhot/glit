import { globalFlags } from '../flags.js'
import { getBranches, getLocalBranchNames } from '../git.js'
import { logJson, logText } from '../logger.js'
import type { ParsedCommand } from '../types.js'
import { requireRepo } from '../validation.js'

export async function handleList(cmd: ParsedCommand) {
  requireRepo(globalFlags.repo)
  const showRemote = Boolean(cmd.flags.remote)
  const showLocal = !showRemote
  const merged = cmd.flags.merged as string | undefined
  const notMerged = cmd.flags['no-merged'] as string | undefined

  let filtered = await getBranches(globalFlags.repo)
  if (showRemote) filtered = filtered.filter(b => b.isRemote)
  else if (showLocal) filtered = filtered.filter(b => !b.isRemote)

  if (merged !== undefined) {
    const mergedBranches = await getLocalBranchNames(globalFlags.repo, merged || undefined)
    filtered = filtered.filter(b => mergedBranches.includes(b.name))
  } else if (notMerged !== undefined) {
    const notMergedBranches = await getLocalBranchNames(globalFlags.repo, notMerged || undefined)
    filtered = filtered.filter(b => !notMergedBranches.includes(b.name))
  }

  if (globalFlags.output === 'json') { logJson(filtered); return }
  logText('CURRENT   NAME')
  for (const b of filtered) logText(`${b.isCurrent ? '*' : ' '}         ${b.name}`)
}
