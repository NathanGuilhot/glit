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
  RecentRepo,
  CreateWorktreeOptions,
  DeleteWorktreeOptions,
  PRStatus,
  RunningProcess,
  ProcessLog,
  DevCommandInfo,
  GitFileStatus,
  FileStatusWithStats,
  FileDiff,
  DiffHunk,
  DiffLine,
  RevertLineSpec,
  CommitEntry,
} from '../../shared/types'

export type API = GlitAPI

export const defaultAPI: API = window.glit

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
