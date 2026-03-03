/** Characters allowed in branch names by Glit (subset of what Git allows) */
const BRANCH_NAME_RE = /^[a-zA-Z0-9._/+@{}-]+$/

export function isValidBranchName(name: string): boolean {
  return BRANCH_NAME_RE.test(name)
}

/** Convert a branch name into a filesystem-safe directory name */
export function sanitizeBranchForPath(branchName: string): string {
  return branchName.replace(/[^a-zA-Z0-9._+-]/g, '-')
}
