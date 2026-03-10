import type { FileDiff, DiffHunk, DiffLine, GitFileStatus } from '../shared/types.js'

const hunkHeaderRegex = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)/

export function parseDiff(rawDiff: string, filePath: string, status: GitFileStatus['status']): FileDiff {
  const result: FileDiff = {
    path: filePath,
    status,
    hunks: [],
    isBinary: false,
    additions: 0,
    deletions: 0,
  }

  if (!rawDiff.trim()) return result

  if (rawDiff.includes('Binary files') && rawDiff.includes('differ')) {
    result.isBinary = true
    return result
  }

  const lines = rawDiff.split('\n')
  let currentHunk: DiffHunk | null = null
  let oldLine = 0
  let newLine = 0

  // Check for rename
  for (const line of lines) {
    if (line.startsWith('rename from ')) {
      result.oldPath = line.slice(12)
    } else if (line.startsWith('--- a/')) {
      // only set oldPath for renames, not regular diffs
    }
  }

  for (const line of lines) {
    const hunkMatch = hunkHeaderRegex.exec(line)
    if (hunkMatch) {
      currentHunk = {
        header: line,
        oldStart: parseInt(hunkMatch[1]!, 10),
        oldCount: hunkMatch[2] !== undefined ? parseInt(hunkMatch[2], 10) : 1,
        newStart: parseInt(hunkMatch[3]!, 10),
        newCount: hunkMatch[4] !== undefined ? parseInt(hunkMatch[4], 10) : 1,
        lines: [],
      }
      result.hunks.push(currentHunk)
      oldLine = currentHunk.oldStart
      newLine = currentHunk.newStart
      continue
    }

    if (!currentHunk) continue

    // Skip "\ No newline at end of file"
    if (line.startsWith('\\ ')) continue

    const prefix = line[0]
    const content = line.slice(1)

    if (prefix === '+') {
      const diffLine: DiffLine = { type: 'add', content, oldLineNumber: null, newLineNumber: newLine }
      currentHunk.lines.push(diffLine)
      result.additions++
      newLine++
    } else if (prefix === '-') {
      const diffLine: DiffLine = { type: 'remove', content, oldLineNumber: oldLine, newLineNumber: null }
      currentHunk.lines.push(diffLine)
      result.deletions++
      oldLine++
    } else if (prefix === ' ') {
      const diffLine: DiffLine = { type: 'context', content, oldLineNumber: oldLine, newLineNumber: newLine }
      currentHunk.lines.push(diffLine)
      oldLine++
      newLine++
    }
  }

  return result
}

export function synthesizeAdditionDiff(content: string, filePath: string): FileDiff {
  const lines = content.split('\n')
  // Remove trailing empty line that comes from trailing newline
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop()

  const diffLines: DiffLine[] = lines.map((line, i) => ({
    type: 'add' as const,
    content: line,
    oldLineNumber: null,
    newLineNumber: i + 1,
  }))

  return {
    path: filePath,
    status: 'untracked',
    hunks: diffLines.length > 0 ? [{
      header: `@@ -0,0 +1,${diffLines.length} @@`,
      oldStart: 0,
      oldCount: 0,
      newStart: 1,
      newCount: diffLines.length,
      lines: diffLines,
    }] : [],
    isBinary: false,
    additions: diffLines.length,
    deletions: 0,
  }
}
