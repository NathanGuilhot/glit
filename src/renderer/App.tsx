import React, { useEffect, useState, useCallback } from 'react'
import {
  Box,
  VStack,
  useToast,
} from '@chakra-ui/react'
import type { WorktreeWithDiff, SetupConfig } from '../shared/types'
import { WorktreeProvider, useWorktree } from './contexts/WorktreeContext'
import { AppActionsProvider, useAppActions } from './contexts/AppActionsContext'
import { APIProvider, useAPI } from './api'
import Header from './components/Header'
import FilterBar from './components/FilterBar'
import WorktreeList from './components/WorktreeList'
import ShortcutHints from './components/ShortcutHints'
import DeleteModal from './components/DeleteModal'
import CreateWorktreeModal from './components/CreateWorktreeModal'
import ChangeBranchModal from './components/ChangeBranchModal'
import CleanBranchesModal from './components/CleanBranchesModal'
import WorktreePalette from './components/WorktreePalette'
import SettingsModal from './components/SettingsModal'
import NotGitRepo from './components/NotGitRepo'
import ErrorBoundary from './components/ErrorBoundary'
import { WorktreeCardSkeleton } from './components/WorktreeCard'

function AppContent() {
  const { loading, repoInfo, settings, detectedBaseBranch, createProgress, setFilter, refresh, setCreateProgress, worktrees, prStatuses } = useWorktree()
  const { handleDelete, handleBatchDelete, handleSaveSettings, handleOpenTerminal, handleOpenIDE } = useAppActions()
  const api = useAPI()
  const [setupConfig, setSetupConfig] = useState<SetupConfig | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<WorktreeWithDiff | null>(null)
  const [changeBranchTarget, setChangeBranchTarget] = useState<WorktreeWithDiff | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [showPalette, setShowPalette] = useState(false)
  const [paletteInitialBranch, setPaletteInitialBranch] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [cleanupMode, setCleanupMode] = useState(false)
  const [showCleanBranches, setShowCleanBranches] = useState(false)
  const [cancellingCreate, setCancellingCreate] = useState(false)

  const worktreesWithMergedPR = worktrees.filter((wt) => prStatuses[wt.path]?.state === 'MERGED')
  const hasMergedPRWorktrees = worktreesWithMergedPR.length > 0

  const toast = useToast()

  const handleCreate = useCallback(async (branchName: string, createNew: boolean, baseBranch: string) => {
    if (!repoInfo) return
    setCancellingCreate(false)
    setCreateProgress({ step: 'creating', message: 'Starting...' })
    const result = await api.worktree.create({
      repoPath: repoInfo.path,
      branchName,
      createNewBranch: createNew,
      baseBranch: baseBranch || undefined,
    })
    if (result.success) {
      toast({ title: 'Worktree created', description: result.worktree?.path, status: 'success', duration: 3000 })
      setShowCreate(false)
      setCreateProgress(null)
      refresh()
    } else if (result.error !== 'cancelled') {
      toast({ title: 'Create failed', description: result.error, status: 'error', duration: 5000, isClosable: true })
      setCreateProgress(null)
    } else {
      setCreateProgress(null)
      setShowCreate(false)
      setCancellingCreate(false)
    }
  }, [api, repoInfo, setCreateProgress, refresh, toast])

  const handleCancelCreate = useCallback(async () => {
    setCancellingCreate(true)
    await api.worktree.cancelCreate()
  }, [api])

  const handleOpenCreateFromPalette = useCallback((initialBranch: string) => {
    setPaletteInitialBranch(initialBranch)
    setShowPalette(false)
    setShowCreate(true)
  }, [])

  const openSettings = useCallback(async () => {
    if (repoInfo?.isRepo) {
      const config = await api.setup.preview(repoInfo.path)
      setSetupConfig(config)
    }
    setShowSettings(true)
  }, [api, repoInfo])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        if (e.key === 'Escape') e.target.blur()
        return
      }
      switch (e.key) {
        case 'r':
          if (!e.metaKey && !e.ctrlKey) refresh()
          break
        case 'c':
          if (!e.metaKey && !e.ctrlKey) setShowCreate(true)
          break
        case 'k':
          if (e.metaKey) { e.preventDefault(); setShowPalette(true) }
          break
        case ',':
          if (e.metaKey) openSettings()
          break
        case '/':
          (document.querySelector('input[placeholder*="Filter"]') as HTMLInputElement)?.focus()
          e.preventDefault()
          break
        case 'Escape':
          if (cleanupMode) setCleanupMode(false)
          else setFilter('')
          break
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [refresh, setFilter, openSettings, cleanupMode])

  const handleDeleteConfirm = async (worktree: WorktreeWithDiff, force: boolean, deleteFiles: boolean) => {
    await handleDelete(worktree, force, deleteFiles)
    setDeleteTarget(null)
  }

  const handleEnterCleanup = useCallback(() => {
    setCleanupMode(true)
    const count = worktreesWithMergedPR.length
    toast({
      title: `${count} worktree${count !== 1 ? 's' : ''} with merged PR`,
      status: 'info',
      duration: 3000,
    })
  }, [worktreesWithMergedPR.length, toast])

  const handleBatchDeleteConfirm = useCallback(async (worktreesToDelete: WorktreeWithDiff[]) => {
    const { deleted, failed } = await handleBatchDelete(worktreesToDelete)
    if (failed === 0) {
      toast({ title: `Deleted ${deleted} worktree${deleted !== 1 ? 's' : ''}`, status: 'success', duration: 3000 })
    } else {
      toast({ title: `Deleted ${deleted}, failed ${failed}`, status: 'warning', duration: 4000 })
    }
    setCleanupMode(false)
    await refresh()
  }, [handleBatchDelete, toast, refresh])

  if (loading) {
    return (
      <Box h="100vh" display="flex" flexDirection="column" bg="gray.900" overflow="hidden">
        <Box h="28px" flexShrink={0} display="flex" alignItems="flex-end" pl="96px" pb="6px">
          <Box as="span" fontSize="sm" fontWeight="700" letterSpacing="-0.02em" style={{ pointerEvents: 'none' } as React.CSSProperties}>
            Glit ·.°
          </Box>
        </Box>
        <Box px={5} pb={3} flexShrink={0}>
          <Box h="20px" w="100px" bg="whiteAlpha.100" borderRadius="md" mb={2} />
          <Box h="12px" w="180px" bg="whiteAlpha.50" borderRadius="md" />
        </Box>
        <Box flex={1} overflowY="auto" px={5} pb={5}>
          <VStack spacing={2} align="stretch">
            <WorktreeCardSkeleton />
            <WorktreeCardSkeleton />
            <WorktreeCardSkeleton />
          </VStack>
        </Box>
      </Box>
    )
  }

  if (repoInfo && !repoInfo.isRepo) {
    return <NotGitRepo path={repoInfo.path} />
  }

  return (
    <Box h="100vh" display="flex" flexDirection="column" bg="gray.900" overflow="hidden">
      <Box
        h="38px"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        flexShrink={0}
        display="flex"
        alignItems="flex-end"
        pl="96px"
        pb="6px"
      >
        <Box
          as="span"
          fontSize="sm"
          fontWeight="700"
          letterSpacing="-0.02em"
          style={{ pointerEvents: 'none' } as React.CSSProperties}
        >
          Glit ·.°
        </Box>
      </Box>

      <Header
        onOpenCreate={() => setShowCreate(true)}
        onOpenSettings={openSettings}
        onOpenCleanup={handleEnterCleanup}
        onOpenCleanBranches={() => setShowCleanBranches(true)}
        cleanupMode={cleanupMode}
        hasMergedPRWorktrees={hasMergedPRWorktrees}
      />

      <FilterBar />

      <Box flex={1} overflowY="auto" px={5} pb={5}>
        <WorktreeList
          onDelete={(wt) => setDeleteTarget(wt)}
          onChangeBranch={(wt) => setChangeBranchTarget(wt)}
          cleanupMode={cleanupMode}
          worktreesWithMergedPR={worktreesWithMergedPR}
          onBatchDelete={handleBatchDeleteConfirm}
        />
      </Box>

      <ShortcutHints />

      {deleteTarget && (
        <DeleteModal
          worktree={deleteTarget}
          onConfirm={handleDeleteConfirm}
          onClose={() => setDeleteTarget(null)}
        />
      )}

      {changeBranchTarget && repoInfo && (
        <ChangeBranchModal
          repoPath={repoInfo.path}
          currentBranch={changeBranchTarget.branch}
          onSuccess={refresh}
          onClose={() => setChangeBranchTarget(null)}
        />
      )}

      {showPalette && repoInfo && (
        <WorktreePalette
          worktrees={worktrees}
          onOpenTerminal={handleOpenTerminal}
          onOpenIDE={handleOpenIDE}
          onOpenCreate={handleOpenCreateFromPalette}
          onClose={() => setShowPalette(false)}
        />
      )}

      {showCreate && repoInfo && (
        <CreateWorktreeModal
          repoPath={repoInfo.path}
          detectedBaseBranch={detectedBaseBranch}
          progress={createProgress}
          cancelling={cancellingCreate}
          initialBranchName={paletteInitialBranch}
          onConfirm={handleCreate}
          onCancel={handleCancelCreate}
          onClose={() => { setShowCreate(false); setPaletteInitialBranch('') }}
        />
      )}

      {showSettings && repoInfo && (
        <SettingsModal
          settings={settings}
          repoPath={repoInfo.path}
          setupConfig={setupConfig}
          onSave={handleSaveSettings}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showCleanBranches && repoInfo && (
        <CleanBranchesModal
          repoPath={repoInfo.path}
          baseBranch={detectedBaseBranch}
          onClose={() => setShowCleanBranches(false)}
        />
      )}
    </Box>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <APIProvider>
        <WorktreeProvider>
          <AppActionsProvider>
            <AppContent />
          </AppActionsProvider>
        </WorktreeProvider>
      </APIProvider>
    </ErrorBoundary>
  )
}
