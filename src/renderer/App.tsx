import React, { useEffect, useState, useCallback } from 'react'
import {
  Box,
  Flex,
  Text,
  Spinner,
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
import SettingsModal from './components/SettingsModal'
import NotGitRepo from './components/NotGitRepo'
import ErrorBoundary from './components/ErrorBoundary'

function AppContent() {
  const { loading, repoInfo, settings, createProgress, setFilter, refresh, setCreateProgress } = useWorktree()
  const { handleDelete, handleSaveSettings } = useAppActions()
  const api = useAPI()
  const [setupConfig, setSetupConfig] = useState<SetupConfig | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<WorktreeWithDiff | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  const toast = useToast()

  const handleCreate = useCallback(async (branchName: string, createNew: boolean, baseBranch: string) => {
    if (!repoInfo) return
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
    } else {
      toast({ title: 'Create failed', description: result.error, status: 'error', duration: 5000, isClosable: true })
      setCreateProgress(null)
    }
  }, [api, repoInfo, setCreateProgress, refresh, toast])

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
        case ',':
          if (e.metaKey) openSettings()
          break
        case '/':
          (document.querySelector('input[placeholder*="Filter"]') as HTMLInputElement)?.focus()
          e.preventDefault()
          break
        case 'Escape':
          setFilter('')
          break
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [refresh, setFilter, openSettings])

  const handleDeleteConfirm = async (worktree: WorktreeWithDiff, force: boolean, deleteFiles: boolean) => {
    await handleDelete(worktree, force, deleteFiles)
    setDeleteTarget(null)
  }

  if (loading) {
    return (
      <Flex h="100vh" align="center" justify="center" direction="column" gap={4}>
        <Spinner size="xl" color="brand.400" thickness="3px" />
        <Text color="whiteAlpha.600">Loading repository...</Text>
      </Flex>
    )
  }

  if (repoInfo && !repoInfo.isRepo) {
    return <NotGitRepo path={repoInfo.path} />
  }

  return (
    <Box h="100vh" display="flex" flexDirection="column" bg="gray.900" overflow="hidden">
      <Box h="28px" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties} flexShrink={0} />

      <Header onOpenCreate={() => setShowCreate(true)} onOpenSettings={openSettings} />

      <FilterBar />

      <Box flex={1} overflowY="auto" px={5} pb={5}>
        <WorktreeList onDelete={(wt) => setDeleteTarget(wt)} />
      </Box>

      <ShortcutHints />

      {deleteTarget && (
        <DeleteModal
          worktree={deleteTarget}
          onConfirm={handleDeleteConfirm}
          onClose={() => setDeleteTarget(null)}
        />
      )}

      {showCreate && repoInfo && (
        <CreateWorktreeModal
          repoPath={repoInfo.path}
          settings={settings}
          progress={createProgress}
          onConfirm={handleCreate}
          onClose={() => setShowCreate(false)}
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
