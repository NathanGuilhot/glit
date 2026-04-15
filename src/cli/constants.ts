import { createRequire } from 'module'

const pkg = createRequire(import.meta.url)('../../package.json') as { version: string }
export const VERSION = pkg.version

export const EXIT = {
  SUCCESS: 0,
  GENERAL: 1,
  INVALID_USAGE: 2,
  NOT_REPO: 3,
  WORKTREE_NOT_FOUND: 4,
  WORKTREE_EXISTS: 5,
  BRANCH_NOT_FOUND: 6,
  REBASE_CONFLICT: 7,
  UPSTREAM_NOT_CONFIGURED: 8,
  INTERRUPTED: 130,
} as const

export const SUBCOMMANDS = new Set([
  'list', 'create', 'delete', 'get', 'set', 'detect',
  'terminal', 'ide', 'status', 'commit', 'push', 'pull',
])
