import { execSync } from 'child_process'
import * as path from 'path'

import type { Worktree } from '../shared/types.js'
import { EXIT } from './constants.js'
import { getWorktrees } from './git.js'
import { exit, logError } from './logger.js'

export const isGitRepo = (repoPath: string): boolean => {
  try {
    execSync('git rev-parse --git-dir', { cwd: repoPath, encoding: 'utf-8', stdio: 'pipe' })
    return true
  } catch { return false }
}

export const requireRepo = (repoPath: string): void => {
  if (!isGitRepo(repoPath)) { logError(`not a git repository: ${repoPath}`); exit(EXIT.NOT_REPO) }
}

export const requireArg = (value: string | undefined, name: string): string => {
  if (!value) { logError(`missing required argument: ${name}`); exit(EXIT.INVALID_USAGE) }
  return value as string
}

export async function findWorktreeByPath(repoPath: string, targetPath: string): Promise<Worktree | undefined> {
  const worktrees = await getWorktrees(repoPath)
  const normalizedTarget = path.normalize(targetPath)
  return worktrees.find(wt => {
    const normalizedWtPath = path.normalize(wt.path)
    return normalizedWtPath === normalizedTarget || normalizedWtPath.endsWith(normalizedTarget)
  })
}
