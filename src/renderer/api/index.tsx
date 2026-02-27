import React, { createContext, useContext } from 'react'
import type { GlitAPI } from '../../shared/types'

export type { GlitAPI }
export type {
  WorktreeWithDiff,
  BranchInfo,
  SetupConfig,
  CreateProgress,
  AppSettings,
  RepoInfo,
  CreateWorktreeOptions,
  DeleteWorktreeOptions,
} from '../../shared/types'

export interface API {
  worktree: {
    list: (repoPath: string) => ReturnType<GlitAPI['worktree']['list']>
    delete: (options: Parameters<GlitAPI['worktree']['delete']>[0]) => ReturnType<GlitAPI['worktree']['delete']>
    create: (options: Parameters<GlitAPI['worktree']['create']>[0]) => ReturnType<GlitAPI['worktree']['create']>
  }
  branch: {
    list: (repoPath: string) => ReturnType<GlitAPI['branch']['list']>
  }
  settings: {
    get: () => ReturnType<GlitAPI['settings']['get']>
    set: (settings: Parameters<GlitAPI['settings']['set']>[0]) => ReturnType<GlitAPI['settings']['set']>
  }
  setup: {
    preview: (repoPath: string) => ReturnType<GlitAPI['setup']['preview']>
    save: (repoPath: string, config: Parameters<GlitAPI['setup']['save']>[1]) => ReturnType<GlitAPI['setup']['save']>
  }
  clipboard: {
    copy: (text: string) => ReturnType<GlitAPI['clipboard']['copy']>
  }
  dialog: {
    pickFile: (repoPath: string) => ReturnType<GlitAPI['dialog']['pickFile']>
  }
  terminal: {
    open: (path: string, terminal?: string) => ReturnType<GlitAPI['terminal']['open']>
  }
  ide: {
    open: (path: string, ide?: string) => ReturnType<GlitAPI['ide']['open']>
  }
  repo: {
    detect: () => ReturnType<GlitAPI['repo']['detect']>
    defaultBranch: (repoPath: string) => ReturnType<GlitAPI['repo']['defaultBranch']>
  }
  shell: {
    openPath: (path: string) => ReturnType<GlitAPI['shell']['openPath']>
  }
  on: (channel: string, callback: (...args: unknown[]) => void) => () => void
}

export function createAPI(glit: GlitAPI): API {
  return {
    worktree: {
      list: glit.worktree.list,
      delete: glit.worktree.delete,
      create: glit.worktree.create,
    },
    branch: {
      list: glit.branch.list,
    },
    settings: {
      get: glit.settings.get,
      set: glit.settings.set,
    },
    setup: {
      preview: glit.setup.preview,
      save: glit.setup.save,
    },
    clipboard: {
      copy: glit.clipboard.copy,
    },
    dialog: {
      pickFile: glit.dialog.pickFile,
    },
    terminal: {
      open: glit.terminal.open,
    },
    ide: {
      open: glit.ide.open,
    },
    repo: {
      detect: glit.repo.detect,
      defaultBranch: glit.repo.defaultBranch,
    },
    shell: {
      openPath: glit.shell.openPath,
    },
    on: glit.on,
  }
}

export const defaultAPI = createAPI(window.glit)

const APIContext = createContext<API | null>(null)

export interface APIProviderProps {
  children: React.ReactNode
  api?: API
}

export function APIProvider({ children, api = defaultAPI }: APIProviderProps) {
  return <APIContext.Provider value={api}>{children}</APIContext.Provider>
}

export function useAPI(): API {
  const api = useContext(APIContext)
  if (!api) throw new Error('useAPI must be used within APIProvider')
  return api
}
