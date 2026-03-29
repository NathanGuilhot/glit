import { exec } from 'child_process'
import { promisify } from 'util'
import log from 'electron-log'
import path from 'path'
import fs from 'fs/promises'
import type { Worktree, BranchInfo, GitFileStatus } from '../../shared/types.js'
import { shortenPathForDisplay } from './settings.js'

const execAsync = promisify(exec)

export async function runGitCommand(cwd: string, args: string[], options?: { signal?: AbortSignal }): Promise<string> {
  const safeArgs = args.map(arg => /[^\w/-]/.test(arg) ? `'${arg.replace(/'/g, "'\\''")}'` : arg)
  const cmd = `git ${safeArgs.join(' ')}`
  log.debug(`Git: ${cmd} [${cwd}]`)
  const { stdout, stderr } = await execAsync(cmd, { cwd, signal: options?.signal })
  if (stderr) log.debug(`Git stderr: ${stderr}`)
  return stdout
}

export async function getWorktrees(repoPath: string): Promise<Worktree[]> {
  const output = await runGitCommand(repoPath, ['worktree', 'list', '--porcelain'])
  const worktrees: Worktree[] = []
  const entries = output.split('\n\n').filter(Boolean)

  for (const entry of entries) {
    const lines = entry.split('\n')
    let wtPath = ''
    let branch = ''
    let head = ''
    let isBare = false
    let isLocked = false

    for (const line of lines) {
      if (line.startsWith('worktree ')) {
        wtPath = line.slice(9)
      } else if (line.startsWith('branch ')) {
        branch = line.slice(7).replace('refs/heads/', '')
      } else if (line.startsWith('HEAD ')) {
        head = line.slice(5)
      } else if (line === 'bare') {
        isBare = true
      } else if (line.startsWith('locked')) {
        isLocked = true
      } else if (line.startsWith('detached')) {
        branch = `detached:${head.slice(0, 8)}`
      }
    }

    if (wtPath) {
      worktrees.push({ path: wtPath, displayPath: shortenPathForDisplay(wtPath), branch, isBare, isLocked, head })
    }
  }

  return worktrees
}

export async function getWorktreeDiff(worktreePath: string): Promise<{ fileCount: number; insertionCount: number; deletionCount: number; isStale: boolean }> {
  try {
    // Check if path exists
    await fs.access(worktreePath)
    const [indexDiff, headDiff] = await Promise.all([
      runGitCommand(worktreePath, ['diff', '--numstat']),
      runGitCommand(worktreePath, ['diff', '--numstat', 'HEAD']),
    ])

    // Stale: working tree matches index (no user edits) but differs from HEAD (HEAD moved)
    if (!indexDiff.trim() && headDiff.trim()) {
      return { fileCount: 0, insertionCount: 0, deletionCount: 0, isStale: true }
    }

    if (!headDiff.trim()) {
      return { fileCount: 0, insertionCount: 0, deletionCount: 0, isStale: false }
    }

    const lines = headDiff.trim().split('\n')
    let fileCount = 0
    let insertionCount = 0
    let deletionCount = 0

    for (const line of lines) {
      const match = line.match(/^(\d+|-)\s+(\d+|-)\s+/)
      if (match) {
        fileCount++
        insertionCount += match[1] === '-' ? 0 : parseInt(match[1]!, 10)
        deletionCount += match[2] === '-' ? 0 : parseInt(match[2]!, 10)
      }
    }

    // Include untracked files in the counts
    try {
      const lsOutput = await runGitCommand(worktreePath, ['ls-files', '--others', '--exclude-standard'])
      const untrackedFiles = lsOutput.trim().split('\n').filter(Boolean)
      for (const filePath of untrackedFiles) {
        try {
          const content = await fs.readFile(path.join(worktreePath, filePath), 'utf-8')
          let lineCount: number
          if (content.endsWith('\n') && content.length > 0) {
            lineCount = content.split('\n').length - 1
          } else if (content.length > 0) {
            lineCount = content.split('\n').length
          } else {
            lineCount = 0
          }
          fileCount++
          insertionCount += lineCount
        } catch {
          // binary or unreadable — skip
        }
      }
    } catch {
      // status command failed — skip untracked files
    }

    return { fileCount, insertionCount, deletionCount, isStale: false }
  } catch {
    return { fileCount: 0, insertionCount: 0, deletionCount: 0, isStale: false }
  }
}

export async function getAheadBehind(
  worktreePath: string,
  branch: string,
): Promise<{ aheadCount: number; behindCount: number }> {
  try {
    if (!branch || branch.startsWith('detached:')) {
      return { aheadCount: 0, behindCount: 0 }
    }
    const out = await runGitCommand(worktreePath, [
      'rev-list', '--count', '--left-right', '@{upstream}...HEAD',
    ])
    const [behind = '0', ahead = '0'] = out.trim().split('\t')
    return {
      aheadCount: parseInt(ahead, 10) || 0,
      behindCount: parseInt(behind, 10) || 0,
    }
  } catch {
    return { aheadCount: 0, behindCount: 0 }
  }
}

export async function getWorktreeLastActivity(worktreePath: string): Promise<string | undefined> {
  try {
    const output = await runGitCommand(worktreePath, ['log', '-1', '--format=%ar', 'HEAD'])
    return output.trim() || undefined
  } catch {
    return undefined
  }
}

export async function getLocalBranchNames(
  repoPath: string,
  options?: { mergedInto?: string },
): Promise<string[]> {
  const args: string[] = ['branch', '--format=%(refname:short)']
  if (options?.mergedInto) args.push('--merged', options.mergedInto)
  const output = await runGitCommand(repoPath, args)
  return output.split('\n').map((l) => l.trim()).filter(Boolean)
}

export async function getBranches(repoPath: string): Promise<BranchInfo[]> {
  const branches: BranchInfo[] = []

  try {
    const [localNames, currentBranch] = await Promise.all([
      getLocalBranchNames(repoPath),
      runGitCommand(repoPath, ['branch', '--show-current']).then((out) => out.trim()),
    ])
    for (const name of localNames) {
      branches.push({ name, isRemote: false, isCurrent: name === currentBranch })
    }
  } catch {
    log.warn('Failed to get local branches')
  }

  try {
    const remoteOutput = await runGitCommand(repoPath, ['branch', '-r', '--format=%(refname:short)'])
    for (const line of remoteOutput.split('\n').filter(Boolean)) {
      const name = line.trim()
      if (name && !name.includes('HEAD')) {
        branches.push({ name, isRemote: true, isCurrent: false })
      }
    }
  } catch {
    log.warn('Failed to get remote branches')
  }

  return branches
}

export async function getDefaultBranch(repoPath: string): Promise<string> {
  // Try to read the remote HEAD symref (e.g. refs/remotes/origin/HEAD -> origin/master)
  try {
    const out = await runGitCommand(repoPath, ['symbolic-ref', 'refs/remotes/origin/HEAD'])
    const branch = out.trim().replace('refs/remotes/origin/', '')
    if (branch) return branch
  } catch {
    // not set – fall through
  }

  // Fall back: look for 'main' or 'master' in local branches
  try {
    const names = await getLocalBranchNames(repoPath)
    if (names.includes('main')) return 'main'
    if (names.includes('master')) return 'master'
  } catch {
    // fall through
  }

  // Last resort: current branch
  try {
    const out = await runGitCommand(repoPath, ['rev-parse', '--abbrev-ref', 'HEAD'])
    const branch = out.trim()
    if (branch && branch !== 'HEAD') return branch
  } catch {
    // fall through
  }

  return 'main'
}

export function mapStatusCode(code: string): GitFileStatus['status'] | null {
  switch (code) {
    case 'M': return 'modified'
    case 'A': return 'added'
    case 'D': return 'deleted'
    case 'R': return 'renamed'
    case 'C': return 'copied'
    default: return null
  }
}
