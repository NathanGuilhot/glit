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
  defaultBaseBranch: string
  autoRefresh: boolean
}

export interface RepoInfo {
  isRepo: boolean
  path: string
  displayPath?: string
  name?: string
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
    getMergedBranches: (repoPath: string, baseBranch: string) => Promise<string[]>
  }
  branch: {
    list: (repoPath: string) => Promise<BranchInfo[]>
    checkout: (repoPath: string, branchName: string) => Promise<void>
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
