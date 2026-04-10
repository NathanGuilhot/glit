import { createContext, useContext, useCallback, type ReactNode } from 'react'
import { useToast } from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'
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
  handleRunSetup: (worktree: WorktreeWithDiff) => Promise<void>
  handleSyncWorktree: (worktree: WorktreeWithDiff) => Promise<void>
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
  const { t } = useTranslation()
  const { repoInfo, refresh, settings, setSettings } = useWorktree()

  const handleDelete = useCallback(async (worktree: WorktreeWithDiff, force: boolean, deleteFiles: boolean) => {
    if (!repoInfo) return
    const result = await api.worktree.delete({
      repoPath: repoInfo.path,
      worktreePath: worktree.path,
      force,
      deleteFiles,
    })
    if (result.success) {
      toast({ title: t('actions.toast.worktreeDeleted'), status: 'success', duration: 2000 })
      refresh()
    } else {
      toast({ title: t('actions.toast.deleteFailed'), description: result.error, status: 'error', duration: 5000, isClosable: true })
    }
  }, [api, repoInfo, refresh, toast, t])

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
    toast({ title: t('actions.toast.pathCopied'), status: 'success', duration: 1500, position: 'bottom-right' })
  }, [api, toast, t])

  const handleCopyBranch = useCallback(async (branch: string) => {
    await api.clipboard.copy(branch)
    toast({ title: t('actions.toast.branchCopied'), status: 'success', duration: 1500, position: 'bottom-right' })
  }, [api, toast, t])

  const handleOpenTerminal = useCallback(async (worktreePath: string) => {
    const result = await api.terminal.open(worktreePath, settings.preferredTerminal)
    if (!result.success) {
      toast({ title: t('actions.toast.failedToOpenTerminal'), description: result.error, status: 'error', duration: 4000 })
    }
  }, [api, settings.preferredTerminal, toast, t])

  const handleOpenIDE = useCallback(async (worktreePath: string) => {
    const result = await api.ide.open(worktreePath, settings.preferredIDE)
    if (!result.success) {
      toast({ title: t('actions.toast.failedToOpenIDE'), description: result.error, status: 'error', duration: 4000 })
    }
  }, [api, settings.preferredIDE, toast, t])

  const handleOpenFinder = useCallback(async (worktreePath: string) => {
    await api.shell.openPath(worktreePath)
  }, [api])

  const handleSaveSettings = useCallback(async (newSettings: AppSettings) => {
    await api.settings.set(newSettings)
    setSettings(newSettings)
    toast({ title: t('actions.toast.settingsSaved'), status: 'success', duration: 1500 })
  }, [api, setSettings, toast, t])

  const handleRunSetup = useCallback(async (worktree: WorktreeWithDiff) => {
    if (!repoInfo) return
    const id = toast({ title: t('actions.toast.runningSetup'), status: 'loading', duration: null, isClosable: false })
    const result = await api.worktree.runSetup({ repoPath: repoInfo.path, worktreePath: worktree.path })
    toast.close(id)
    if (result.success) {
      toast({ title: t('actions.toast.setupComplete'), status: 'success', duration: 3000 })
    } else {
      toast({ title: t('actions.toast.setupFailed'), description: result.error, status: 'error', duration: 5000, isClosable: true })
    }
  }, [api, repoInfo, toast, t])

  const handleSyncWorktree = useCallback(async (worktree: WorktreeWithDiff) => {
    const id = toast({ title: t('actions.toast.syncing'), status: 'loading', duration: null, isClosable: false })
    const result = await api.worktree.sync(worktree.path)
    toast.close(id)
    if (result.success) {
      toast({ title: t('actions.toast.synced'), status: 'success', duration: 3000 })
      refresh()
    } else {
      toast({ title: t('actions.toast.syncFailed'), description: result.error, status: 'error', duration: 5000, isClosable: true })
    }
  }, [api, toast, refresh, t])

  const value: AppActionsContextValue = {
    handleDelete,
    handleBatchDelete,
    handleCopyPath,
    handleCopyBranch,
    handleOpenTerminal,
    handleOpenIDE,
    handleOpenFinder,
    handleSaveSettings,
    handleRunSetup,
    handleSyncWorktree,
  }

  return (
    <AppActionsContext.Provider value={value}>
      {children}
    </AppActionsContext.Provider>
  )
}
