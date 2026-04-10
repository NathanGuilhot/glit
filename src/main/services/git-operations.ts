import log from 'electron-log'
import path from 'path'
import fs from 'fs/promises'
import type { GitFileStatus, FileStatusWithStats, FileDiff, RevertLineSpec } from '../../shared/types.js'
import { runGitCommand, mapStatusCode } from './git.js'
import { parseDiff, synthesizeAdditionDiff } from '../diffParser.js'
import { errorResult } from './utils.js'

export async function getGitStatus(worktreePath: string): Promise<GitFileStatus[]> {
  log.info(`Getting git status for: ${worktreePath}`)
  try {
    const output = await runGitCommand(worktreePath, ['status', '--porcelain', '-uall'])
    if (!output.trim()) return []

    const results: GitFileStatus[] = []
    for (const line of output.split('\n')) {
      if (!line || line.length < 4) continue
      const x = line[0]!
      const y = line[1]!
      const rest = line.slice(3)

      let filePath = rest
      let oldPath: string | undefined
      const arrowIdx = rest.indexOf(' -> ')
      if (arrowIdx !== -1) {
        oldPath = rest.slice(0, arrowIdx)
        filePath = rest.slice(arrowIdx + 4)
      }

      if (x !== ' ' && x !== '?') {
        const status = mapStatusCode(x)
        if (status) results.push({ path: filePath, status, staged: true, oldPath })
      }

      if (y !== ' ') {
        if (x === '?' && y === '?') {
          results.push({ path: filePath, status: 'untracked', staged: false })
        } else if (y !== '?') {
          const status = mapStatusCode(y)
          if (status) results.push({ path: filePath, status, staged: false, oldPath })
        }
      }
    }
    return results
  } catch (error) {
    log.error('git:status failed:', error)
    return []
  }
}

export async function getGitStatusWithStats(worktreePath: string): Promise<FileStatusWithStats[]> {
  log.info(`Getting git status with stats for: ${worktreePath}`)
  try {
    const [statusOutput, numstatOutput] = await Promise.all([
      runGitCommand(worktreePath, ['status', '--porcelain', '-uall']),
      runGitCommand(worktreePath, ['diff', '--numstat', 'HEAD']).catch(() => ''),
    ])

    if (!statusOutput.trim()) return []

    const statsMap = new Map<string, { additions: number; deletions: number }>()
    for (const line of numstatOutput.split('\n')) {
      if (!line) continue
      const match = line.match(/^(\d+|-)\s+(\d+|-)\s+(.+)/)
      if (match) {
        const adds = match[1] === '-' ? 0 : parseInt(match[1]!, 10)
        const dels = match[2] === '-' ? 0 : parseInt(match[2]!, 10)
        let filePath = match[3]!
        const arrowIdx = filePath.indexOf(' => ')
        if (arrowIdx !== -1) {
          filePath = filePath.slice(arrowIdx + 4)
        }
        const braceMatch = filePath.match(/^(.*)?\{.*? => (.*?)\}(.*)$/)
        if (braceMatch) {
          filePath = (braceMatch[1] ?? '') + (braceMatch[2] ?? '') + (braceMatch[3] ?? '')
        }
        statsMap.set(filePath, { additions: adds, deletions: dels })
      }
    }

    const results: FileStatusWithStats[] = []
    const seen = new Set<string>()
    for (const line of statusOutput.split('\n')) {
      if (!line || line.length < 4) continue
      const x = line[0]!
      const y = line[1]!
      const rest = line.slice(3)

      let filePath = rest
      let oldPath: string | undefined
      const arrowIdx = rest.indexOf(' -> ')
      if (arrowIdx !== -1) {
        oldPath = rest.slice(0, arrowIdx)
        filePath = rest.slice(arrowIdx + 4)
      }

      if (seen.has(filePath)) continue

      let status: GitFileStatus['status'] | null = null
      let staged = false

      if (x === '?' && y === '?') {
        status = 'untracked'
      } else if (y !== ' ' && y !== '?') {
        status = mapStatusCode(y)
      } else if (x !== ' ' && x !== '?') {
        status = mapStatusCode(x)
        staged = true
      }

      if (status) {
        seen.add(filePath)
        const stats = statsMap.get(filePath) ?? { additions: 0, deletions: 0 }
        if (status === 'untracked' && stats.additions === 0) {
          try {
            const content = await fs.readFile(path.join(worktreePath, filePath), 'utf-8')
            if (content.endsWith('\n') && content.length > 0) {
              stats.additions = content.split('\n').length - 1
            } else if (content.length > 0) {
              stats.additions = content.split('\n').length
            }
          } catch {
            // binary or unreadable
          }
        }
        results.push({ path: filePath, status, staged, oldPath, additions: stats.additions, deletions: stats.deletions })
      }
    }
    return results
  } catch (error) {
    log.error('git:statusWithStats failed:', error)
    return []
  }
}

export async function getGitDiff(worktreePath: string, filePath: string): Promise<FileDiff> {
  log.info(`Getting diff for: ${filePath} in ${worktreePath}`)
  try {
    const statusOutput = await runGitCommand(worktreePath, ['status', '--porcelain', '-uall', '--', filePath])
    let status: GitFileStatus['status'] = 'modified'
    let isUntracked = false

    for (const line of statusOutput.split('\n')) {
      if (!line || line.length < 4) continue
      const x = line[0]!
      const y = line[1]!
      if (x === '?' && y === '?') {
        status = 'untracked'
        isUntracked = true
      } else if (y === 'D' || x === 'D') {
        status = 'deleted'
      } else if (y === 'A' || x === 'A') {
        status = 'added'
      } else if (y === 'R' || x === 'R') {
        status = 'renamed'
      }
    }

    if (isUntracked) {
      try {
        const content = await fs.readFile(path.join(worktreePath, filePath), 'utf-8')
        return synthesizeAdditionDiff(content, filePath)
      } catch {
        return { path: filePath, status: 'untracked', hunks: [], isBinary: true, additions: 0, deletions: 0 }
      }
    }

    let rawDiff = ''
    try {
      rawDiff = await runGitCommand(worktreePath, ['diff', 'HEAD', '--', filePath])
    } catch {
      try {
        rawDiff = await runGitCommand(worktreePath, ['diff', '--cached', 'HEAD', '--', filePath])
      } catch {
        // fall through
      }
    }

    if (!rawDiff.trim()) {
      try {
        rawDiff = await runGitCommand(worktreePath, ['diff', '--cached', '--', filePath])
        if (rawDiff.trim()) {
          status = 'added'
        }
      } catch {
        // fall through
      }
    }

    return parseDiff(rawDiff, filePath, status)
  } catch (error) {
    log.error('git:diff failed:', error)
    return { path: filePath, status: 'modified', hunks: [], isBinary: false, additions: 0, deletions: 0 }
  }
}

export async function revertLines(worktreePath: string, filePath: string, linesToRevert: RevertLineSpec[]): Promise<{ success: boolean; error?: string }> {
  log.info(`Reverting ${linesToRevert.length} lines in: ${filePath}`)
  try {
    const fullPath = path.join(worktreePath, filePath)
    const currentContent = await fs.readFile(fullPath, 'utf-8')
    const currentLines = currentContent.split('\n')

    let originalLines: string[] = []
    try {
      const original = await runGitCommand(worktreePath, ['show', `HEAD:${filePath}`])
      originalLines = original.split('\n')
    } catch {
      // File doesn't exist in HEAD (new file)
    }

    const additionsToRevert = linesToRevert
      .filter(l => l.type === 'add' && l.newLineNumber != null)
      .map(l => l.newLineNumber!)
      .sort((a, b) => b - a)

    const removalsToRevert = linesToRevert
      .filter(l => l.type === 'remove' && l.oldLineNumber != null)
      .sort((a, b) => (b.oldLineNumber ?? 0) - (a.oldLineNumber ?? 0))

    for (const newLineNum of additionsToRevert) {
      const idx = newLineNum - 1
      if (idx >= 0 && idx < currentLines.length) {
        currentLines.splice(idx, 1)
      }
    }

    for (const spec of removalsToRevert) {
      if (spec.oldLineNumber == null) continue
      const oldIdx = spec.oldLineNumber - 1
      if (oldIdx >= 0 && oldIdx < originalLines.length) {
        const lineContent = originalLines[oldIdx]!
        const insertIdx = Math.min(oldIdx, currentLines.length)
        currentLines.splice(insertIdx, 0, lineContent)
      }
    }

    await fs.writeFile(fullPath, currentLines.join('\n'), 'utf-8')
    return { success: true }
  } catch (error) {
    return errorResult('git:revertLines failed', error)
  }
}

export async function revertFile(worktreePath: string, filePath: string): Promise<{ success: boolean; error?: string }> {
  log.info(`Reverting file: ${filePath} in ${worktreePath}`)
  try {
    try {
      await runGitCommand(worktreePath, ['ls-files', '--error-unmatch', '--', filePath])
      await runGitCommand(worktreePath, ['checkout', 'HEAD', '--', filePath])
    } catch {
      const fullPath = path.join(worktreePath, filePath)
      await fs.unlink(fullPath)
    }
    return { success: true }
  } catch (error) {
    return errorResult('git:revertFile failed', error)
  }
}

export async function applyEdit(worktreePath: string, filePath: string, lineNumber: number, newContent: string): Promise<{ success: boolean; error?: string }> {
  log.info(`Applying edit to ${filePath}:${lineNumber} in ${worktreePath}`)
  try {
    const fullPath = path.join(worktreePath, filePath)
    const content = await fs.readFile(fullPath, 'utf-8')
    const lines = content.split('\n')
    const idx = lineNumber - 1
    if (idx < 0 || idx >= lines.length) {
      return { success: false, error: `Line ${lineNumber} out of range (file has ${lines.length} lines)` }
    }
    lines[idx] = newContent
    await fs.writeFile(fullPath, lines.join('\n'), 'utf-8')
    return { success: true }
  } catch (error) {
    return errorResult('git:applyEdit failed', error)
  }
}

export async function deleteLine(worktreePath: string, filePath: string, lineNumber: number): Promise<{ success: boolean; error?: string }> {
  log.info(`Deleting line ${lineNumber} from ${filePath} in ${worktreePath}`)
  try {
    const fullPath = path.join(worktreePath, filePath)
    const content = await fs.readFile(fullPath, 'utf-8')
    const lines = content.split('\n')
    const idx = lineNumber - 1
    if (idx < 0 || idx >= lines.length) {
      return { success: false, error: `Line ${lineNumber} out of range (file has ${lines.length} lines)` }
    }
    lines.splice(idx, 1)
    await fs.writeFile(fullPath, lines.join('\n'), 'utf-8')
    return { success: true }
  } catch (error) {
    return errorResult('git:deleteLine failed', error)
  }
}

export async function insertLine(worktreePath: string, filePath: string, afterLineNumber: number, content: string): Promise<{ success: boolean; error?: string }> {
  log.info(`Inserting line after ${afterLineNumber} in ${filePath} in ${worktreePath}`)
  try {
    const fullPath = path.join(worktreePath, filePath)
    const fileContent = await fs.readFile(fullPath, 'utf-8')
    const lines = fileContent.split('\n')
    const idx = afterLineNumber
    if (idx < 0 || idx > lines.length) {
      return { success: false, error: `Line ${afterLineNumber} out of range (file has ${lines.length} lines)` }
    }
    lines.splice(idx, 0, content)
    await fs.writeFile(fullPath, lines.join('\n'), 'utf-8')
    return { success: true }
  } catch (error) {
    return errorResult('git:insertLine failed', error)
  }
}

export async function commitFiles(worktreePath: string, files: string[], message: string): Promise<{ success: boolean; error?: string }> {
  log.info(`Committing ${files.length} files in: ${worktreePath}`)
  try {
    await runGitCommand(worktreePath, ['add', '--', ...files])
    await runGitCommand(worktreePath, ['commit', '-m', message])
    return { success: true }
  } catch (error) {
    return errorResult('git:commit failed', error)
  }
}

export async function pushBranch(worktreePath: string, force?: boolean): Promise<{ success: boolean; error?: string }> {
  log.info(`Pushing from: ${worktreePath}, force: ${force ?? false}`)
  try {
    const args = ['push']
    if (force) args.push('--force-with-lease')
    await runGitCommand(worktreePath, args)
    return { success: true }
  } catch (error) {
    return errorResult('git:push failed', error)
  }
}

export async function pullBranch(
  worktreePath: string,
): Promise<{ success: boolean; hasUpstream?: boolean; isNonFastForward?: boolean; error?: string }> {
  log.info(`Pulling in: ${worktreePath}`)
  try {
    await runGitCommand(worktreePath, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'])
  } catch {
    return { success: false, hasUpstream: false, error: 'No upstream branch configured' }
  }
  try {
    await runGitCommand(worktreePath, ['pull', '--ff-only'])
    return { success: true, hasUpstream: true }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    const isNonFastForward = /non[- ]fast[- ]forward|not possible to fast.?forward|diverg/i.test(msg)
    return { success: false, hasUpstream: true, isNonFastForward, error: msg }
  }
}
