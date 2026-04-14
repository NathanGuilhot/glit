import * as fs from 'fs'
import * as path from 'path'

import { EXIT } from '../constants.js'
import { globalFlags } from '../flags.js'
import {
  getAheadBehind,
  getDefaultBranch,
  getLocalBranchNames,
  getWorktreeDiff,
  getWorktreeLastActivity,
  getWorktrees,
  runGit,
} from '../git.js'
import { exit, logError, logJson, logText } from '../logger.js'
import type { ParsedCommand } from '../types.js'
import { findWorktreeByPath, requireArg, requireRepo } from '../validation.js'

export async function handleList(cmd: ParsedCommand) {
  requireRepo(globalFlags.repo)

  const format = (cmd.flags.format as string) || 'simple'
  const branchFilter = (cmd.flags.branch as string)?.toLowerCase()

  const worktrees = await getWorktrees(globalFlags.repo)
  const worktreesWithStats = await Promise.all(worktrees.map(async (wt) => {
    const [diff, aheadBehind, lastActivity] = await Promise.all([
      getWorktreeDiff(wt.path),
      getAheadBehind(wt.path, wt.branch),
      getWorktreeLastActivity(wt.path),
    ])
    return { ...wt, ...diff, ...aheadBehind, lastActivity, isCurrent: wt.path === globalFlags.repo }
  }))

  const filtered = branchFilter
    ? worktreesWithStats.filter(wt => wt.branch.toLowerCase().includes(branchFilter))
    : worktreesWithStats

  if (globalFlags.output === 'json') { logJson(filtered); return }

  if (format === 'detail') {
    logText('PATH                      BRANCH       DIFF        UPSTREAM              LAST ACTIVITY')
    for (const wt of filtered) {
      const upstream = wt.hasUpstream ? `${wt.aheadCount} ahead, ${wt.behindCount} behind` : '—'
      const diffStr = wt.fileCount > 0 ? `+${wt.insertionCount}/-${wt.deletionCount}` : 'clean'
      logText(`${(wt.displayPath ?? wt.path).padEnd(24)} ${wt.branch.padEnd(12)} ${diffStr.padEnd(12)} ${upstream.padEnd(22)} ${wt.lastActivity || '—'}`)
    }
  } else {
    logText('WORKTREE          BRANCH       STATUS')
    for (const wt of filtered) {
      const status = wt.isCurrent ? 'current' : (wt.isStale ? 'stale' : 'ok')
      logText(`${(wt.displayPath ?? wt.path).padEnd(18)} ${wt.branch.padEnd(12)} ${status}`)
    }
  }
}

export async function handleCreate(cmd: ParsedCommand) {
  requireRepo(globalFlags.repo)
  const branchName = requireArg(cmd.args[0], '<branch-name>')
  const baseBranch = (cmd.flags.base as string) || await getDefaultBranch(globalFlags.repo)
  const worktreePath = (cmd.flags.path as string) || path.join(globalFlags.repo, '..', `glit-worktrees`, branchName.replace(/\//g, '-'))
  const noSetup = Boolean(cmd.flags['no-setup'])
  const dryRun = Boolean(cmd.flags['dry-run'])

  const existingBranches = await getLocalBranchNames(globalFlags.repo)
  if (existingBranches.includes(branchName)) {
    logError(`branch already exists: ${branchName}`)
    exit(EXIT.WORKTREE_EXISTS)
  }

  if (fs.existsSync(worktreePath)) {
    logError(`worktree path already exists: ${worktreePath}`)
    exit(EXIT.WORKTREE_EXISTS)
  }

  if (dryRun) {
    logText('[dry-run] Would create worktree:')
    logText(`  branch: ${branchName}`)
    logText(`  base: ${baseBranch}`)
    logText(`  path: ${worktreePath}`)
    logText(`  setup: ${noSetup ? 'skipped' : 'run after creation'}`)
    return
  }

  try {
    logText('Creating worktree...')
    await runGit(globalFlags.repo, ['worktree', 'add', '-b', branchName, worktreePath, baseBranch])
    if (!noSetup) logText('Running setup...')
    logText(`Worktree created at: ${worktreePath}`)
  } catch (err: unknown) {
    const msg = (err as { message?: string }).message || String(err)
    logError(`failed to create worktree: ${msg}`)
    if (msg.includes('already exists')) exit(EXIT.WORKTREE_EXISTS)
    exit(EXIT.GENERAL)
  }
}

export async function handleDelete(cmd: ParsedCommand) {
  requireRepo(globalFlags.repo)
  const worktreePath = requireArg(cmd.args[0], '<worktree-path>')
  const force = Boolean(cmd.flags.force)
  const deleteFiles = Boolean(cmd.flags['delete-files'])
  const noGc = Boolean(cmd.flags['no-gc'])

  const wt = await findWorktreeByPath(globalFlags.repo, worktreePath)
  if (!wt) { logError(`worktree not found: ${worktreePath}`); exit(EXIT.WORKTREE_NOT_FOUND) }
  const worktree = wt!
  if (worktree.path === globalFlags.repo) { logError('cannot delete the current worktree'); exit(EXIT.INVALID_USAGE) }
  if (!force && !globalFlags.quiet) logText(`Confirm delete of worktree at ${worktree.path}? [y/N]`)

  try {
    const args = ['worktree', 'remove', worktree.path]
    if (force) args.push('--force')
    if (deleteFiles) args.push('--detach')
    await runGit(globalFlags.repo, args)
    logText('Deleted worktree.')
  } catch (err: unknown) {
    logError(`failed to delete worktree: ${(err as { message?: string }).message || String(err)}`)
    exit(EXIT.GENERAL)
  }

  if (!noGc) runGit(globalFlags.repo, ['worktree', 'prune']).catch(() => {})
}
