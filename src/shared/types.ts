export interface Worktree {
  path: string
  displayPath?: string
  branch: string
  isBare: boolean
  isLocked: boolean
  head?: string
  lastActivity?: string
}

export interface DiffStats {
  fileCount: number
  insertionCount: number
  deletionCount: number
  aheadCount: number
  behindCount: number
  isStale: boolean
}

export interface WorktreeWithDiff extends Worktree, DiffStats {}

export interface BranchInfo {
  name: string
  isRemote: boolean
  isCurrent: boolean
}

export interface SetupConfig {
  packages?: string[]
  envFiles?: string[]
  commands?: string[]
  dev?: string
}

export interface RunningProcess {
  worktreePath: string
  command: string
  pid?: number
  port?: number
  startedAt: number
}

export interface ProcessLog {
  line: string
  isError: boolean
  ts: number
}

export interface DevCommandInfo {
  command: string | null
  pkgManager: 'npm' | 'yarn' | 'pnpm' | 'bun'
  scripts: string[]
}

export interface CreateProgress {
  step: 'creating' | 'packages' | 'env' | 'commands' | 'done' | 'error'
  message: string
  detail?: string
}

export type IDEOption = 'VSCode' | 'Cursor' | 'Zed' | 'WebStorm' | 'Sublime'
export type TerminalOption = 'Terminal' | 'iTerm2' | 'Hyper' | 'Kitty' | 'Alacritty' | 'Warp'

export interface AppSettings {
  preferredTerminal: TerminalOption
  preferredIDE: IDEOption
  autoRefresh: boolean
}

export interface RepoInfo {
  isRepo: boolean
  path: string
  displayPath?: string
  name?: string
}

export interface RecentRepo {
  path: string
  name: string
  displayPath: string
  lastUsedAt: string
}

export interface GitFileStatus {
  path: string
  status: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked' | 'copied'
  staged: boolean
  oldPath?: string
}

export interface CreateWorktreeOptions {
  repoPath: string
  branchName: string
  createNewBranch: boolean
  baseBranch?: string
  worktreePath?: string
}

export interface DeleteWorktreeOptions {
  repoPath: string
  worktreePath: string
  force?: boolean
  deleteFiles?: boolean
}

export interface PRStatus {
  number: number
  state: 'OPEN' | 'CLOSED' | 'MERGED'
  url: string
}

export interface GlitAPI {
  worktree: {
    list: (repoPath: string) => Promise<WorktreeWithDiff[]>
    delete: (options: DeleteWorktreeOptions) => Promise<{ success: boolean; error?: string }>
    create: (options: CreateWorktreeOptions) => Promise<{ success: boolean; error?: string; worktree?: Worktree }>
    cancelCreate: () => Promise<void>
    getMergedBranches: (repoPath: string, baseBranch: string) => Promise<{ branches: string[]; mergeRefLabel: string }>
    runSetup: (options: { repoPath: string; worktreePath: string }) => Promise<{ success: boolean; error?: string }>
    sync: (worktreePath: string) => Promise<{ success: boolean; error?: string }>
    detectDevCommand: (worktreePath: string) => Promise<DevCommandInfo>
  }
  branch: {
    list: (repoPath: string) => Promise<BranchInfo[]>
    checkout: (repoPath: string, branchName: string) => Promise<void>
    rebaseOnto: (repoPath: string, mainBranch: string) => Promise<{ success: boolean; branch?: string; hasConflicts?: boolean; error?: string }>
    delete: (repoPath: string, branchName: string) => Promise<void>
  }
  process: {
    start: (worktreePath: string, command: string) => Promise<{ success: boolean; pid?: number; error?: string }>
    stop: (worktreePath: string) => Promise<void>
    list: () => Promise<RunningProcess[]>
    getLogs: (worktreePath: string) => Promise<ProcessLog[]>
    saveCommand: (worktreePath: string, command: string) => Promise<void>
    getSavedCommand: (worktreePath: string) => Promise<string | null>
    getAllDevCommands: () => Promise<Record<string, string>>
  }
  settings: {
    get: () => Promise<AppSettings>
    set: (settings: Partial<AppSettings>) => Promise<void>
  }
  setup: {
    preview: (repoPath: string) => Promise<SetupConfig | null>
    save: (repoPath: string, config: SetupConfig) => Promise<void>
  }
  clipboard: {
    copy: (text: string) => Promise<void>
  }
  dialog: {
    pickFile: (repoPath: string) => Promise<string | null>
    pickFolder: () => Promise<string | null>
  }
  terminal: {
    open: (path: string, terminal?: string) => Promise<{ success: boolean; error?: string }>
  }
  ide: {
    open: (path: string, ide?: string) => Promise<{ success: boolean; error?: string }>
  }
  repo: {
    detect: () => Promise<RepoInfo>
    defaultBranch: (repoPath: string) => Promise<string>
    switch: (repoPath: string) => Promise<RepoInfo>
    listRecent: () => Promise<RecentRepo[]>
  }
  git: {
    status: (worktreePath: string) => Promise<GitFileStatus[]>
    commit: (worktreePath: string, files: string[], message: string) => Promise<{ success: boolean; error?: string }>
    push: (worktreePath: string, force?: boolean) => Promise<{ success: boolean; error?: string }>
  }
  pr: {
    getStatus: (worktreePath: string) => Promise<PRStatus | null>
  }
  shell: {
    openPath: (path: string) => Promise<string>
    openUrl: (url: string) => Promise<void>
  }
  on: (channel: string, callback: (...args: unknown[]) => void) => () => void
}

declare global {
  interface Window {
    glit: GlitAPI
  }
}
