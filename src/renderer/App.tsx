import React, { useEffect, useState, useCallback } from 'react'
import {
  Box,
  VStack,
  useToast,
} from '@chakra-ui/react'
import NiceModal from '@ebay/nice-modal-react'
import type { WorktreeWithDiff } from '../shared/types'
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
import { ModalRegistry } from './components/ModalRegistry'

function AppContent() {
  const { loading, repoInfo, settings, detectedBaseBranch, setFilter, refresh, worktrees, prStatuses } = useWorktree()
  const { handleDelete, handleBatchDelete, handleSaveSettings, handleOpenTerminal, handleOpenIDE } = useAppActions()
  const api = useAPI()
  const [cleanupMode, setCleanupMode] = useState(false)

  const worktreesWithMergedPR = worktrees.filter((wt) => prStatuses[wt.path]?.state === 'MERGED')
  const hasMergedPRWorktrees = worktreesWithMergedPR.length > 0

  const toast = useToast()

  const openSettings = useCallback(async () => {
    if (!repoInfo) return
    const config = repoInfo.isRepo ? await api.setup.preview(repoInfo.path) : null
    NiceModal.show(SettingsModal, {
      settings,
      repoPath: repoInfo.path,
      setupConfig: config,
      onSave: handleSaveSettings,
    })
  }, [api, repoInfo, settings, handleSaveSettings])

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
          if (!e.metaKey && !e.ctrlKey && repoInfo) {
            NiceModal.show(CreateWorktreeModal, { repoPath: repoInfo.path, detectedBaseBranch })
          }
          break
        case 'k':
          if (e.metaKey && repoInfo) {
            e.preventDefault()
            NiceModal.show(WorktreePalette, {
              worktrees,
              repoPath: repoInfo.path,
              detectedBaseBranch,
              onOpenTerminal: handleOpenTerminal,
              onOpenIDE: handleOpenIDE,
            })
          }
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
  }, [refresh, setFilter, openSettings, cleanupMode, repoInfo, detectedBaseBranch, worktrees, handleOpenTerminal, handleOpenIDE])

  const handleDeleteConfirm = async (worktree: WorktreeWithDiff, force: boolean, deleteFiles: boolean) => {
    await handleDelete(worktree, force, deleteFiles)
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
        onOpenCreate={() => repoInfo && NiceModal.show(CreateWorktreeModal, { repoPath: repoInfo.path, detectedBaseBranch })}
        onOpenSettings={openSettings}
        onOpenCleanup={handleEnterCleanup}
        onOpenCleanBranches={() => repoInfo && NiceModal.show(CleanBranchesModal, { repoPath: repoInfo.path, baseBranch: detectedBaseBranch })}
        cleanupMode={cleanupMode}
        hasMergedPRWorktrees={hasMergedPRWorktrees}
      />

      <FilterBar />

      <Box flex={1} overflowY="auto" px={5} pb={5}>
        <WorktreeList
          onDelete={(wt) => NiceModal.show(DeleteModal, { worktree: wt, onConfirm: handleDeleteConfirm })}
          onChangeBranch={(wt) => repoInfo && NiceModal.show(ChangeBranchModal, {
            repoPath: repoInfo.path,
            currentBranch: wt.branch,
            onSuccess: refresh,
          })}
          cleanupMode={cleanupMode}
          worktreesWithMergedPR={worktreesWithMergedPR}
          onBatchDelete={handleBatchDeleteConfirm}
        />
      </Box>

      <ShortcutHints />
    </Box>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <APIProvider>
        <WorktreeProvider>
          <AppActionsProvider>
            <ModalRegistry>
              <AppContent />
            </ModalRegistry>
          </AppActionsProvider>
        </WorktreeProvider>
      </APIProvider>
    </ErrorBoundary>
  )
}
