import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import fs from 'fs/promises'
import yaml from 'js-yaml'
import type {
  Worktree,
  WorktreeWithDiff,
  BranchInfo,
  SetupConfig,
  CreateWorktreeOptions,
  DeleteWorktreeOptions,
} from '../shared/types.js'

const execAsync = promisify(exec)

export interface GitLogger {
  debug: (...args: unknown[]) => void
  info: (...args: unknown[]) => void
  warn: (...args: unknown[]) => void
  error: (...args: unknown[]) => void
}

let logger: GitLogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
}

export function setLogger(l: GitLogger): void {
  logger = l
}

export function shortenPathForDisplay(fullPath: string): string {
  const home = process.env.HOME
  if (home && fullPath.startsWith(home)) {
    return '~' + fullPath.slice(home.length)
  }
  return fullPath
}

export async function runGitCommand(cwd: string, args: string[], options?: { signal?: AbortSignal }): Promise<string> {
  const safeArgs = args.map(arg => /[^\w/-]/.test(arg) ? `'${arg.replace(/'/g, "'\\''")}'` : arg)
  const cmd = `git ${safeArgs.join(' ')}`
  logger.debug(`Git: ${cmd} [${cwd}]`)
  const { stdout, stderr } = await execAsync(cmd, { cwd, signal: options?.signal })
  if (stderr) logger.debug(`Git stderr: ${stderr}`)
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
    logger.warn('Failed to get local branches')
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
    logger.warn('Failed to get remote branches')
  }

  return branches
}

export async function getDefaultBranch(repoPath: string): Promise<string> {
  try {
    const out = await runGitCommand(repoPath, ['symbolic-ref', 'refs/remotes/origin/HEAD'])
    const branch = out.trim().replace('refs/remotes/origin/', '')
    if (branch) return branch
  } catch {
    // not set – fall through
  }

  try {
    const names = await getLocalBranchNames(repoPath)
    if (names.includes('main')) return 'main'
    if (names.includes('master')) return 'master'
  } catch {
    // fall through
  }

  try {
    const out = await runGitCommand(repoPath, ['rev-parse', '--abbrev-ref', 'HEAD'])
    const branch = out.trim()
    if (branch && branch !== 'HEAD') return branch
  } catch {
    // fall through
  }

  return 'main'
}

export async function runSetupSteps(repoPath: string, worktreePath: string): Promise<void> {
  const configPath = path.join(repoPath, '.glit', 'setup.yaml')
  const configContent = await fs.readFile(configPath, 'utf-8')
  const config = yaml.load(configContent) as SetupConfig

  if (config.packages?.length) {
    for (const pkgCmd of config.packages) {
      try { await execAsync(pkgCmd, { cwd: worktreePath }) }
      catch (e) { logger.warn(`Package command failed: ${pkgCmd}`, e) }
    }
  }
  if (config.envFiles?.length) {
    for (const envFile of config.envFiles) {
      try {
        const srcPath = path.join(repoPath, envFile)
        const destPath = path.join(worktreePath, envFile)
        await fs.mkdir(path.dirname(destPath), { recursive: true })
        await fs.copyFile(srcPath, destPath)
      } catch (e) { logger.warn(`Env file copy failed: ${envFile}`, e) }
    }
  }
  if (config.commands?.length) {
    for (const cmd of config.commands) {
      try { await execAsync(cmd, { cwd: worktreePath }) }
      catch (e) { logger.warn(`Setup command failed: ${cmd}`, e) }
    }
  }
}

export async function createWorktree(
  repoPath: string,
  options: CreateWorktreeOptions,
  signal?: AbortSignal,
): Promise<{ worktreePath: string; branch: string }> {
  const { branchName, createNewBranch = false, baseBranch, worktreePath: customPath } = options

  const safeName = branchName.replace(/[^a-zA-Z0-9._-]/g, '-')
  const worktreePath = customPath ?? path.join(repoPath, '..', 'glit-worktrees', safeName)

  let effectiveBase = baseBranch
  if (createNewBranch && effectiveBase) {
    try {
      await runGitCommand(repoPath, ['rev-parse', '--verify', effectiveBase], { signal })
    } catch {
      if (signal?.aborted) {
        throw new Error('cancelled')
      }
      logger.warn(`Base branch "${effectiveBase}" not found, falling back to auto-detected default`)
      effectiveBase = await getDefaultBranch(repoPath)
    }
  }

  const args = ['worktree', 'add']
  if (createNewBranch) {
    args.push('-b', branchName, worktreePath)
    if (effectiveBase) args.push(effectiveBase)
  } else {
    args.push(worktreePath, branchName)
  }
  await runGitCommand(repoPath, args, { signal })
  logger.info(`Worktree created at: ${worktreePath}`)

  return { worktreePath, branch: branchName }
}

export async function deleteWorktree(
  repoPath: string,
  options: DeleteWorktreeOptions,
): Promise<{ success: boolean; error?: string }> {
  const { worktreePath, force = false, deleteFiles = false } = options
  try {
    const args = ['worktree', 'remove', worktreePath]
    if (force) args.push('--force')
    await runGitCommand(repoPath, args)
    if (deleteFiles) {
      await fs.rm(worktreePath, { recursive: true, force: true })
    }
    return { success: true }
  } catch (error) {
    logger.error('Error deleting worktree:', error)
    const msg = error instanceof Error ? error.message : String(error)
    return { success: false, error: msg }
  }
}

export async function syncWorktree(worktreePath: string): Promise<{ success: boolean; error?: string }> {
  try {
    await runGitCommand(worktreePath, ['reset', '--hard', 'HEAD'])
    return { success: true }
  } catch (error) {
    logger.error('Error syncing worktree:', error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export async function checkoutBranch(repoPath: string, branchName: string): Promise<void> {
  await runGitCommand(repoPath, ['checkout', '--ignore-other-worktrees', branchName])
}

export async function deleteBranch(repoPath: string, branchName: string): Promise<void> {
  await runGitCommand(repoPath, ['branch', '-d', branchName])
}

export async function rebaseOnto(
  repoPath: string,
  mainBranch: string,
): Promise<{ success: boolean; branch?: string; hasConflicts?: boolean; error?: string }> {
  try {
    const currentBranch = (await runGitCommand(repoPath, ['branch', '--show-current'])).trim()
    if (!currentBranch) return { success: false, error: 'Not on a branch (detached HEAD)' }
    try {
      await execAsync('git fetch origin --quiet', { cwd: repoPath, timeout: 10000 })
    } catch {
      logger.warn('git fetch failed, proceeding with local state')
    }
    await runGitCommand(repoPath, ['rebase', mainBranch])
    return { success: true, branch: currentBranch }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    const hasConflicts = /conflict/i.test(msg) || /CONFLICT/.test(msg)
    return { success: false, hasConflicts, error: msg }
  }
}

export async function getMergedBranches(
  repoPath: string,
  baseBranch: string,
): Promise<{ branches: string[]; mergeRefLabel: string }> {
  const remoteRef = `origin/${baseBranch}`
  let mergeRef = baseBranch
  try {
    await runGitCommand(repoPath, ['rev-parse', '--verify', remoteRef])
    mergeRef = remoteRef
  } catch {
    // fall through
  }
  const [mergedNames, currentBranch, worktrees] = await Promise.all([
    getLocalBranchNames(repoPath, { mergedInto: mergeRef }),
    runGitCommand(repoPath, ['branch', '--show-current']).then((out) => out.trim()),
    getWorktrees(repoPath),
  ])
  const worktreeBranches = new Set(worktrees.map((wt) => wt.branch).filter((b) => !b.startsWith('detached:')))
  const exclude = new Set([baseBranch, currentBranch, ...worktreeBranches])
  const branches = mergedNames.filter((name) => !exclude.has(name))
  const mergeRefLabel = mergeRef === remoteRef ? remoteRef : `${baseBranch} (local)`
  return { branches, mergeRefLabel }
}

export async function listWorktreesWithDiff(repoPath: string): Promise<WorktreeWithDiff[]> {
  const worktrees = await getWorktrees(repoPath)
  const result: WorktreeWithDiff[] = []
  await Promise.all(
    worktrees.map(async (wt) => {
      const [diff, remote, lastActivity] = await Promise.all([
        getWorktreeDiff(wt.path),
        getAheadBehind(wt.path, wt.branch),
        getWorktreeLastActivity(wt.path),
      ])
      result.push({ ...wt, ...diff, ...remote, lastActivity })
    }),
  )
  const repoPathNormalized = path.normalize(repoPath)
  result.sort((a, b) => {
    const aIsRoot = path.normalize(a.path) === repoPathNormalized
    const bIsRoot = path.normalize(b.path) === repoPathNormalized
    if (aIsRoot && !bIsRoot) return 1
    if (!aIsRoot && bIsRoot) return -1
    return a.branch.localeCompare(b.branch)
  })
  return result
}
