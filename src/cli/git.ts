import { execSync } from 'child_process'
import * as fs from 'fs'

import type { BranchInfo, GitFileStatus, Worktree } from '../shared/types.js'
import { logVerbose } from './logger.js'

export async function runGit(cwd: string, args: string[]): Promise<string> {
  const safeArgs = args.map(arg => /[^\w/-]/.test(arg) ? `'${arg.replace(/'/g, "'\\''")}'` : arg)
  const cmd = `git ${safeArgs.join(' ')}`
  logVerbose(`Git: ${cmd} [${cwd}]`)
  try {
    return execSync(cmd, { cwd, encoding: 'utf-8' }) as string
  } catch (err: unknown) {
    const error = err as { stderr?: string }
    if (error.stderr) logVerbose(`Git stderr: ${error.stderr}`)
    throw err
  }
}

export function shortenPath(fullPath: string): string {
  const home = process.env.HOME
  return (home && fullPath.startsWith(home)) ? `~${fullPath.slice(home.length)}` : fullPath
}

export async function getWorktrees(repoPath: string): Promise<Worktree[]> {
  const output = await runGit(repoPath, ['worktree', 'list', '--porcelain'])
  const worktrees: Worktree[] = []

  for (const entry of output.split('\n\n').filter(Boolean)) {
    const lines = entry.split('\n')
    let wtPath = '', branch = '', head = '', isBare = false, isLocked = false

    for (const line of lines) {
      if (line.startsWith('worktree ')) wtPath = line.slice(9)
      else if (line.startsWith('branch ')) branch = line.slice(7).replace('refs/heads/', '')
      else if (line.startsWith('HEAD ')) head = line.slice(5)
      else if (line === 'bare') isBare = true
      else if (line.startsWith('locked')) isLocked = true
      else if (line.startsWith('detached')) branch = `detached:${head.slice(0, 8)}`
    }

    if (wtPath) worktrees.push({ path: wtPath, displayPath: shortenPath(wtPath), branch, isBare, isLocked, head })
  }
  return worktrees
}

export async function getWorktreeDiff(wtPath: string) {
  try {
    fs.accessSync(wtPath)
    const [indexDiff, headDiff] = await Promise.all([
      runGit(wtPath, ['diff', '--numstat']),
      runGit(wtPath, ['diff', '--numstat', 'HEAD']).catch(() => ''),
    ])

    if (!indexDiff.trim() && headDiff.trim()) return { fileCount: 0, insertionCount: 0, deletionCount: 0, isStale: true }
    if (!headDiff.trim()) return { fileCount: 0, insertionCount: 0, deletionCount: 0, isStale: false }

    let fileCount = 0, insertionCount = 0, deletionCount = 0
    for (const line of headDiff.trim().split('\n')) {
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

export async function getAheadBehind(wtPath: string, branch: string) {
  if (!branch || branch.startsWith('detached:')) return { aheadCount: 0, behindCount: 0, hasUpstream: false }
  try { await runGit(wtPath, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}']) }
  catch { return { aheadCount: 0, behindCount: 0, hasUpstream: false } }

  try {
    const out = await runGit(wtPath, ['rev-list', '--count', '--left-right', '@{upstream}...HEAD'])
    const [behind = '0', ahead = '0'] = out.trim().split('\t')
    return { aheadCount: parseInt(ahead, 10) || 0, behindCount: parseInt(behind, 10) || 0, hasUpstream: true }
  } catch {
    return { aheadCount: 0, behindCount: 0, hasUpstream: true }
  }
}

export async function getWorktreeLastActivity(wtPath: string): Promise<string | undefined> {
  try { return (await runGit(wtPath, ['log', '-1', '--format=%ar', 'HEAD'])).trim() || undefined }
  catch { return undefined }
}

export async function getBranches(repoPath: string): Promise<BranchInfo[]> {
  const branches: BranchInfo[] = []

  try {
    const localNames = (await runGit(repoPath, ['branch', '--format=%(refname:short)'])).split('\n').map(l => l.trim()).filter(Boolean)
    const currentBranch = (await runGit(repoPath, ['branch', '--show-current'])).trim()
    for (const name of localNames) branches.push({ name, isRemote: false, isCurrent: name === currentBranch })
  } catch { logVerbose('Failed to get local branches') }

  try {
    const remoteOutput = await runGit(repoPath, ['branch', '-r', '--format=%(refname:short)'])
    for (const name of remoteOutput.split('\n').filter(Boolean)) {
      const n = name.trim()
      if (n && !n.includes('HEAD')) branches.push({ name: n, isRemote: true, isCurrent: false })
    }
  } catch { logVerbose('Failed to get remote branches') }

  return branches
}

export async function getLocalBranchNames(repoPath: string, mergedInto?: string): Promise<string[]> {
  const args: string[] = ['branch', '--format=%(refname:short)']
  if (mergedInto) args.push('--merged', mergedInto)
  return (await runGit(repoPath, args)).split('\n').map(l => l.trim()).filter(Boolean)
}

export async function getDefaultBranch(repoPath: string): Promise<string> {
  try {
    const out = await runGit(repoPath, ['symbolic-ref', 'refs/remotes/origin/HEAD'])
    const branch = out.trim().replace('refs/remotes/origin/', '')
    if (branch) return branch
  } catch { /* fall through */ }

  try {
    const names = await getLocalBranchNames(repoPath)
    if (names.includes('main')) return 'main'
    if (names.includes('master')) return 'master'
  } catch { /* fall through */ }

  try {
    const out = await runGit(repoPath, ['rev-parse', '--abbrev-ref', 'HEAD'])
    const branch = out.trim()
    if (branch && branch !== 'HEAD') return branch
  } catch { /* fall through */ }

  return 'main'
}

const STATUS_CODE_MAP: Record<string, GitFileStatus['status']> = {
  M: 'modified', A: 'added', D: 'deleted', R: 'renamed', C: 'copied'
}

export async function getGitStatus(wtPath: string): Promise<GitFileStatus[]> {
  try {
    const output = await runGit(wtPath, ['status', '--porcelain', '-uall'])
    if (!output.trim()) return []

    const results: GitFileStatus[] = []
    for (const line of output.split('\n')) {
      if (!line || line.length < 4) continue
      const x = line[0]!
      const y = line[1]!
      const rest = line.slice(3)

      let filePath = rest, oldPath: string | undefined
      const arrowIdx = rest.indexOf(' -> ')
      if (arrowIdx !== -1) { oldPath = rest.slice(0, arrowIdx); filePath = rest.slice(arrowIdx + 4) }

      if (x !== ' ' && x !== '?') {
        const status = STATUS_CODE_MAP[x!]
        if (status) results.push({ path: filePath, status, staged: true, oldPath })
      }

      if (y !== ' ') {
        if (x === '?' && y === '?') results.push({ path: filePath, status: 'untracked', staged: false })
        else if (y !== '?' && y !== undefined) {
          const status = STATUS_CODE_MAP[y]
          if (status) results.push({ path: filePath, status, staged: false, oldPath })
        }
      }
    }
    return results
  } catch { return [] }
}

export async function commitFiles(wtPath: string, files: string[], message: string) {
  try {
    await runGit(wtPath, ['add', '--', ...files])
    await runGit(wtPath, ['commit', '-m', message])
    return { success: true }
  } catch (err: unknown) {
    return { success: false, error: (err as { message?: string }).message || String(err) }
  }
}

export async function pushBranch(wtPath: string, force?: boolean) {
  try {
    let hasUpstream = true
    try { await runGit(wtPath, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}']) }
    catch { hasUpstream = false }

    if (!hasUpstream) {
      const branch = (await runGit(wtPath, ['branch', '--show-current'])).trim()
      if (!branch) return { success: false, error: 'Cannot push detached HEAD' }
      await runGit(wtPath, ['push', '--set-upstream', 'origin', branch])
    } else {
      await runGit(wtPath, force ? ['push', '--force-with-lease'] : ['push'])
    }
    return { success: true }
  } catch (err: unknown) {
    return { success: false, error: (err as { message?: string }).message || String(err) }
  }
}

export async function pullBranch(wtPath: string) {
  try { await runGit(wtPath, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}']) }
  catch { return { success: false, hasUpstream: false, error: 'No upstream branch configured' } }

  try {
    await runGit(wtPath, ['pull', '--ff-only'])
    return { success: true, hasUpstream: true }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    const isNonFastForward = /non[- ]fast[- ]forward|not possible to fast.?forward|diverg/i.test(msg)
    return { success: false, hasUpstream: true, isNonFastForward, error: msg }
  }
}
