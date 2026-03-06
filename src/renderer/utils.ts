export function getBranchColor(branch: string): string {
  if (branch === 'main' || branch === 'master') return 'green'
  return 'gray'
}

export function truncateMiddle(path: string, maxLen: number = 40): string {
  if (path.length <= maxLen) return path
  const parts = path.split('/')
  const filename = parts[parts.length - 1] ?? path
  if (filename.length >= maxLen - 2) return '…' + filename.slice(-(maxLen - 1))
  const available = maxLen - filename.length - 2
  const prefix = path.slice(0, available)
  return prefix + '…/' + filename
}
