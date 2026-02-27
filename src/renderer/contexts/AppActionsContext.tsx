import { createContext, useContext, useCallback, type ReactNode } from 'react'
import { useToast } from '@chakra-ui/react'
import type { WorktreeWithDiff, AppSettings } from '../../shared/types'
import { useWorktree } from './WorktreeContext'
import { type API, defaultAPI } from '../api'

interface AppActionsContextValue {
  handleDelete: (worktree: WorktreeWithDiff, force: boolean, deleteFiles: boolean) => Promise<void>
  handleBatchDelete: (worktrees: WorktreeWithDiff[]) => Promise<{ deleted: number; failed: number }>
  handleCopyPath: (worktreePath: string) => Promise<void>
  handleCopyBranch: (branch: string) => Promise<void>
  handleOpenTerminal: (worktreePath: string) => Promise<void>
  handleOpenIDE: (worktreePath: string) => Promise<void>
  handleOpenFinder: (worktreePath: string) => Promise<void>
  handleSaveSettings: (newSettings: AppSettings) => Promise<void>
}

const AppActionsContext = createContext<AppActionsContextValue | null>(null)

export function useAppActions() {
  const ctx = useContext(AppActionsContext)
  if (!ctx) throw new Error('useAppActions must be used within AppActionsProvider')
  return ctx
}

interface AppActionsProviderProps {
  children: ReactNode
  api?: API
}

export function AppActionsProvider({ children, api = defaultAPI }: AppActionsProviderProps) {
  const toast = useToast()
  const { repoInfo, refresh, settings } = useWorktree()

  const handleDelete = useCallback(async (worktree: WorktreeWithDiff, force: boolean, deleteFiles: boolean) => {
    if (!repoInfo) return
    const result = await api.worktree.delete({
      repoPath: repoInfo.path,
      worktreePath: worktree.path,
      force,
      deleteFiles,
    })
    if (result.success) {
      toast({ title: 'Worktree deleted', status: 'success', duration: 2000 })
      refresh()
    } else {
      toast({ title: 'Delete failed', description: result.error, status: 'error', duration: 5000, isClosable: true })
    }
  }, [api, repoInfo, refresh, toast])

  const handleBatchDelete = useCallback(async (worktrees: WorktreeWithDiff[]): Promise<{ deleted: number; failed: number }> => {
    if (!repoInfo) return { deleted: 0, failed: 0 }
    let deleted = 0
    let failed = 0
    for (const wt of worktrees) {
      const result = await api.worktree.delete({
        repoPath: repoInfo.path,
        worktreePath: wt.path,
        force: true,
        deleteFiles: false,
      })
      if (result.success) {
        deleted++
      } else {
        failed++
      }
    }
    refresh()
    return { deleted, failed }
  }, [api, repoInfo, refresh])

  const handleCopyPath = useCallback(async (worktreePath: string) => {
    await api.clipboard.copy(worktreePath)
    toast({ title: 'Path copied', status: 'success', duration: 1500, position: 'bottom-right' })
  }, [api, toast])

  const handleCopyBranch = useCallback(async (branch: string) => {
    await api.clipboard.copy(branch)
    toast({ title: 'Branch copied', status: 'success', duration: 1500, position: 'bottom-right' })
  }, [api, toast])

  const handleOpenTerminal = useCallback(async (worktreePath: string) => {
    const result = await api.terminal.open(worktreePath, settings.preferredTerminal)
    if (!result.success) {
      toast({ title: 'Failed to open terminal', description: result.error, status: 'error', duration: 4000 })
    }
  }, [api, settings.preferredTerminal, toast])

  const handleOpenIDE = useCallback(async (worktreePath: string) => {
    const result = await api.ide.open(worktreePath, settings.preferredIDE)
    if (!result.success) {
      toast({ title: 'Failed to open IDE', description: result.error, status: 'error', duration: 4000 })
    }
  }, [api, settings.preferredIDE, toast])

  const handleOpenFinder = useCallback(async (worktreePath: string) => {
    await api.shell.openPath(worktreePath)
  }, [api])

  const handleSaveSettings = useCallback(async (newSettings: AppSettings) => {
    await api.settings.set(newSettings)
    toast({ title: 'Settings saved', status: 'success', duration: 1500 })
  }, [api, toast])

  const value: AppActionsContextValue = {
    handleDelete,
    handleBatchDelete,
    handleCopyPath,
    handleCopyBranch,
    handleOpenTerminal,
    handleOpenIDE,
    handleOpenFinder,
    handleSaveSettings,
  }

  return (
    <AppActionsContext.Provider value={value}>
      {children}
    </AppActionsContext.Provider>
  )
}
