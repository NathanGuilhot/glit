import type { CommandHandler } from '../types.js'
import * as branch from './branch.js'
import * as git from './git.js'
import * as open from './open.js'
import * as proc from './process.js'
import * as repo from './repo.js'
import * as settings from './settings.js'
import * as worktree from './worktree.js'

export const COMMANDS: Record<string, { handlers: Record<string, CommandHandler> }> = {
  worktree: {
    handlers: {
      list: worktree.handleList,
      create: worktree.handleCreate,
      delete: worktree.handleDelete,
    },
  },
  branch: {
    handlers: { list: branch.handleList },
  },
  git: {
    handlers: {
      status: git.handleStatus,
      commit: git.handleCommit,
      push: git.handlePush,
      pull: git.handlePull,
    },
  },
  settings: {
    handlers: { get: settings.handleGet, set: settings.handleSet },
  },
  repo: {
    handlers: { detect: repo.handleDetect },
  },
  open: {
    handlers: { terminal: open.handleTerminal, ide: open.handleIde },
  },
  process: {
    handlers: { list: proc.handleList },
  },
}
