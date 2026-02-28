export function getBranchColor(branch: string): string {
  if (branch === 'main' || branch === 'master') return 'green'
  return 'gray'
}
