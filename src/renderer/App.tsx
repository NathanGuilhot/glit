import React, { useEffect, useState, useCallback } from 'react'
import {
  Box,
  VStack,
} from '@chakra-ui/react'
import NiceModal from '@ebay/nice-modal-react'
import { useTranslation } from 'react-i18next'
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
import CleanupModal from './components/CleanupModal'
import WorktreePalette from './components/WorktreePalette'
import SettingsModal from './components/SettingsModal'
import NotGitRepo from './components/NotGitRepo'
import ErrorBoundary from './components/ErrorBoundary'
import { WorktreeCardSkeleton } from './components/WorktreeCard'
import { ModalRegistry } from './components/ModalRegistry'

function AppContent() {
  const { loading, repoInfo, settings, detectedBaseBranch, setFilter, refresh, worktrees, prStatuses } = useWorktree()
  const { handleDelete, handleSaveSettings, handleOpenTerminal, handleOpenIDE } = useAppActions()
  const api = useAPI()
  const { t } = useTranslation()
  const [mergedBranches, setMergedBranches] = useState<string[]>([])
  const [mergeRefLabel, setMergeRefLabel] = useState('')

  const worktreesWithMergedPR = worktrees.filter((wt) => prStatuses[wt.path]?.state === 'MERGED')
  const hasMergedPRWorktrees = worktreesWithMergedPR.length > 0
  const hasCleanupItems = hasMergedPRWorktrees || mergedBranches.length > 0

  useEffect(() => {
    if (!repoInfo?.isRepo || !detectedBaseBranch) return
    api.worktree
      .getMergedBranches(repoInfo.path, detectedBaseBranch)
      .then((result) => {
        setMergedBranches(result.branches)
        setMergeRefLabel(result.mergeRefLabel)
      })
  }, [api, repoInfo?.path, repoInfo?.isRepo, detectedBaseBranch, worktrees])

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
          (document.querySelector('input[data-filter-input]') as HTMLInputElement)?.focus()
          e.preventDefault()
          break
        case 'Escape':
          setFilter('')
          break
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [refresh, setFilter, openSettings, repoInfo, detectedBaseBranch, worktrees, handleOpenTerminal, handleOpenIDE])

  const openCleanup = useCallback(() => {
    if (!repoInfo) return
    NiceModal.show(CleanupModal, {
      repoPath: repoInfo.path,
      baseBranch: detectedBaseBranch,
      mergeRefLabel: mergeRefLabel || detectedBaseBranch,
      mergedPRWorktrees: worktreesWithMergedPR,
      mergedBranches,
      prStatuses,
    })
  }, [repoInfo, detectedBaseBranch, mergeRefLabel, worktreesWithMergedPR, mergedBranches, prStatuses])

  if (loading) {
    return (
      <Box h="100vh" display="flex" flexDirection="column" bg="gray.900" overflow="hidden">
        <Box h="28px" flexShrink={0} display="flex" alignItems="flex-end" pl="96px" pb="6px">
          <Box as="span" fontSize="sm" fontWeight="700" letterSpacing="-0.02em" style={{ pointerEvents: 'none' } as React.CSSProperties}>
            {t('app.title')}
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
          {t('app.title')}
        </Box>
      </Box>

      <Header
        onOpenCreate={() => repoInfo && NiceModal.show(CreateWorktreeModal, { repoPath: repoInfo.path, detectedBaseBranch })}
        onOpenSettings={openSettings}
        onOpenCleanup={openCleanup}
        hasCleanupItems={hasCleanupItems}
      />

      <FilterBar />

      <Box flex={1} overflowY="auto" px={5} pb={5}>
        <WorktreeList
          onDelete={(wt) => NiceModal.show(DeleteModal, { worktree: wt, onConfirm: handleDelete })}
          onChangeBranch={(wt) => repoInfo && NiceModal.show(ChangeBranchModal, {
            repoPath: repoInfo.path,
            currentBranch: wt.branch,
            onSuccess: refresh,
          })}
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
