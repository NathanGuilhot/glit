import { globalFlags } from '../flags.js'
import { getBranches, getDefaultBranch, getLocalBranchNames } from '../git.js'
import { logJson, logText } from '../logger.js'
import type { ParsedCommand } from '../types.js'
import { requireRepo } from '../validation.js'

async function resolveMergeTarget(repoPath: string, flag: unknown): Promise<string> {
  return typeof flag === 'string' ? flag : getDefaultBranch(repoPath)
}

export async function handleList(cmd: ParsedCommand) {
  requireRepo(globalFlags.repo)
  const showRemote = Boolean(cmd.flags.remote)
  const showLocal = !showRemote
  const mergedFlag = cmd.flags.merged
  const notMergedFlag = cmd.flags['no-merged']

  let filtered = await getBranches(globalFlags.repo)
  if (showRemote) filtered = filtered.filter(b => b.isRemote)
  else if (showLocal) filtered = filtered.filter(b => !b.isRemote)

  if (mergedFlag !== undefined) {
    const target = await resolveMergeTarget(globalFlags.repo, mergedFlag)
    const mergedBranches = await getLocalBranchNames(globalFlags.repo, target)
    filtered = filtered.filter(b => mergedBranches.includes(b.name))
  } else if (notMergedFlag !== undefined) {
    const target = await resolveMergeTarget(globalFlags.repo, notMergedFlag)
    const notMergedBranches = await getLocalBranchNames(globalFlags.repo, target)
    filtered = filtered.filter(b => !notMergedBranches.includes(b.name))
  }

  if (globalFlags.output === 'json') { logJson(filtered); return }
  logText('CURRENT   NAME')
  for (const b of filtered) logText(`${b.isCurrent ? '*' : ' '}         ${b.name}`)
}
