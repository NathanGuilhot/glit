import React, { Component, type ReactNode, useEffect, useState, useCallback, useRef } from 'react'
import {
  Box,
  VStack,
  HStack,
  Text,
  Heading,
  IconButton,
  Input,
  InputGroup,
  InputLeftElement,
  Spinner,
  useToast,
  Flex,
  Badge,
  Tooltip,
  Button,
} from '@chakra-ui/react'
import type { WorktreeWithDiff, RepoInfo, AppSettings, CreateProgress, SetupConfig } from '../shared/types'
import WorktreeCard from './components/WorktreeCard'
import DeleteModal from './components/DeleteModal'
import CreateWorktreeModal from './components/CreateWorktreeModal'
import SettingsModal from './components/SettingsModal'
import NotGitRepo from './components/NotGitRepo'

// ─── Error Boundary ────────────────────────────────────────────────────────────

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info)
  }

  override render() {
    if (this.state.hasError) {
      return (
        <Flex h="100vh" align="center" justify="center" direction="column" gap={4} p={8}>
          <Text fontSize="2xl">Something went wrong</Text>
          <Text color="red.400" fontFamily="mono" fontSize="sm">
            {this.state.error?.message}
          </Text>
          <Button onClick={() => this.setState({ hasError: false, error: null })}>Try Again</Button>
        </Flex>
      )
    }
    return this.props.children
  }
}

// ─── Icons ─────────────────────────────────────────────────────────────────────

const RefreshIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10"></polyline>
    <polyline points="1 20 1 14 7 14"></polyline>
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
  </svg>
)

const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"></circle>
    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
  </svg>
)

const SettingsIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"></circle>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
  </svg>
)

const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"></line>
    <line x1="5" y1="12" x2="19" y2="12"></line>
  </svg>
)

// ─── Main App ──────────────────────────────────────────────────────────────────

function AppContent() {
  const toast = useToast()
  const [repoInfo, setRepoInfo] = useState<RepoInfo | null>(null)
  const [worktrees, setWorktrees] = useState<WorktreeWithDiff[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter] = useState('')
  const [settings, setSettings] = useState<AppSettings>({
    preferredTerminal: 'Terminal',
    defaultBaseBranch: '',
    autoRefresh: true,
  })

  // Modal states
  const [deleteTarget, setDeleteTarget] = useState<WorktreeWithDiff | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [createProgress, setCreateProgress] = useState<CreateProgress | null>(null)
  const [setupConfig, setSetupConfig] = useState<SetupConfig | null>(null)

  const filterRef = useRef<HTMLInputElement>(null)

  // ── Data loading ──────────────────────────────────────────────────────────

  const loadRepo = useCallback(async () => {
    try {
      const info = await window.glit.repo.detect()
      setRepoInfo(info)
      if (!info.isRepo) {
        setLoading(false)
        return
      }
      const [wts, cfg, detectedBranch] = await Promise.all([
        window.glit.worktree.list(info.path),
        window.glit.settings.get(),
        window.glit.repo.defaultBranch(info.path),
      ])
      setWorktrees(wts)
      setSettings({ ...cfg, defaultBaseBranch: cfg.defaultBaseBranch || detectedBranch })
    } catch (err) {
      toast({ title: 'Failed to load repository', description: String(err), status: 'error', duration: 5000, isClosable: true })
    } finally {
      setLoading(false)
    }
  }, [toast])

  const refresh = useCallback(async () => {
    if (!repoInfo?.isRepo) return
    setRefreshing(true)
    try {
      const wts = await window.glit.worktree.list(repoInfo.path)
      setWorktrees(wts)
    } catch (err) {
      toast({ title: 'Failed to refresh', description: String(err), status: 'error', duration: 3000 })
    } finally {
      setRefreshing(false)
    }
  }, [repoInfo, toast])

  useEffect(() => {
    loadRepo()
  }, [loadRepo])

  // Subscribe to create:progress events
  useEffect(() => {
    const unsub = window.glit.on('create:progress', (data: unknown) => {
      setCreateProgress(data as CreateProgress)
    })
    return unsub
  }, [])

  const openSettings = useCallback(async () => {
    if (repoInfo?.isRepo) {
      const config = await window.glit.setup.preview(repoInfo.path)
      setSetupConfig(config)
    }
    setShowSettings(true)
  }, [repoInfo])

  // ── Keyboard shortcuts ────────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Skip if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        if (e.key === 'Escape') (e.target as HTMLInputElement).blur()
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
          filterRef.current?.focus()
          e.preventDefault()
          break
        case 'Escape':
          setFilter('')
          break
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [refresh, openSettings])

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleDelete = async (worktree: WorktreeWithDiff, force: boolean, deleteFiles: boolean) => {
    if (!repoInfo) return
    const result = await window.glit.worktree.delete({
      repoPath: repoInfo.path,
      worktreePath: worktree.path,
      force,
      deleteFiles,
    })
    if (result.success) {
      toast({ title: 'Worktree deleted', status: 'success', duration: 2000 })
      setDeleteTarget(null)
      refresh()
    } else {
      toast({ title: 'Delete failed', description: result.error, status: 'error', duration: 5000, isClosable: true })
    }
  }

  const handleCreate = async (branchName: string, createNew: boolean, baseBranch: string) => {
    if (!repoInfo) return
    setCreateProgress({ step: 'creating', message: 'Starting...' })
    const result = await window.glit.worktree.create({
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
  }

  const handleCopyPath = async (worktreePath: string) => {
    await window.glit.clipboard.copy(worktreePath)
    toast({ title: 'Path copied', status: 'success', duration: 1500, position: 'bottom-right' })
  }

  const handleOpenTerminal = async (worktreePath: string) => {
    const result = await window.glit.terminal.open(worktreePath, settings.preferredTerminal)
    if (!result.success) {
      toast({ title: 'Failed to open terminal', description: result.error, status: 'error', duration: 4000 })
    }
  }

  const handleOpenFinder = async (worktreePath: string) => {
    await window.glit.shell.openPath(worktreePath)
  }

  const handleSaveSettings = async (newSettings: AppSettings) => {
    await window.glit.settings.set(newSettings)
    setSettings(newSettings)
    toast({ title: 'Settings saved', status: 'success', duration: 1500 })
    setShowSettings(false)
  }

  // ── Filter ────────────────────────────────────────────────────────────────

  const filtered = worktrees.filter((wt) => {
    if (!filter) return true
    const q = filter.toLowerCase()
    return wt.path.toLowerCase().includes(q) || wt.branch.toLowerCase().includes(q)
  })

  // ── Render ────────────────────────────────────────────────────────────────

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
      {/* Title bar drag region */}
      <Box h="28px" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties} flexShrink={0} />

      {/* Header */}
      <Box px={5} pb={3} flexShrink={0}>
        <HStack justify="space-between" align="center">
          <VStack align="start" spacing={0}>
            <Heading size="sm" fontWeight="700" letterSpacing="-0.02em">
              Glit
            </Heading>
            {repoInfo && (
              <HStack spacing={2}>
                <Text fontSize="11px" color="whiteAlpha.500" fontFamily="mono" noOfLines={1} maxW="400px">
                  {repoInfo.path}
                </Text>
                <Badge colorScheme="green" fontSize="9px" variant="subtle">
                  {worktrees.length} worktree{worktrees.length !== 1 ? 's' : ''}
                </Badge>
              </HStack>
            )}
          </VStack>
          <HStack spacing={1}>
            <Tooltip label="New worktree (c)" placement="bottom">
              <IconButton
                aria-label="Create worktree"
                icon={<PlusIcon />}
                size="sm"
                variant="ghost"
                colorScheme="brand"
                onClick={() => setShowCreate(true)}
              />
            </Tooltip>
            <Tooltip label="Refresh (r)" placement="bottom">
              <IconButton
                aria-label="Refresh"
                icon={refreshing ? <Spinner size="xs" /> : <RefreshIcon />}
                size="sm"
                variant="ghost"
                onClick={refresh}
                isDisabled={refreshing}
              />
            </Tooltip>
            <Tooltip label="Settings (⌘,)" placement="bottom">
              <IconButton
                aria-label="Settings"
                icon={<SettingsIcon />}
                size="sm"
                variant="ghost"
                onClick={openSettings}
              />
            </Tooltip>
          </HStack>
        </HStack>
      </Box>

      {/* Search */}
      <Box px={5} pb={3} flexShrink={0}>
        <InputGroup size="sm">
          <InputLeftElement pointerEvents="none" color="whiteAlpha.400">
            <SearchIcon />
          </InputLeftElement>
          <Input
            ref={filterRef}
            placeholder="Filter by branch or path… (/)"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            bg="whiteAlpha.50"
            border="1px solid"
            borderColor="whiteAlpha.100"
            _focus={{ borderColor: 'brand.400', bg: 'whiteAlpha.100' }}
            _placeholder={{ color: 'whiteAlpha.300' }}
            borderRadius="md"
            fontFamily="mono"
            fontSize="xs"
          />
        </InputGroup>
      </Box>

      {/* Worktree list */}
      <Box flex={1} overflowY="auto" px={5} pb={5}>
        {filtered.length === 0 ? (
          <Flex align="center" justify="center" h="200px" direction="column" gap={3}>
            {filter ? (
              <>
                <Text color="whiteAlpha.400" fontSize="sm">No worktrees match &ldquo;{filter}&rdquo;</Text>
                <Button size="xs" variant="ghost" onClick={() => setFilter('')}>Clear filter</Button>
              </>
            ) : (
              <Text color="whiteAlpha.400" fontSize="sm">No worktrees found</Text>
            )}
          </Flex>
        ) : (
          <VStack spacing={2} align="stretch">
            {filtered.map((wt) => (
              <WorktreeCard
                key={wt.path}
                worktree={wt}
                onCopyPath={handleCopyPath}
                onOpenTerminal={handleOpenTerminal}
                onOpenFinder={handleOpenFinder}
                onDelete={(wt) => setDeleteTarget(wt)}
                settings={settings}
              />
            ))}
          </VStack>
        )}
      </Box>

      {/* Shortcut hint */}
      <Box px={5} py={2} borderTop="1px solid" borderColor="whiteAlpha.50" flexShrink={0}>
        <HStack spacing={4} justify="center">
          {[
            ['c', 'create'],
            ['r', 'refresh'],
            ['/', 'filter'],
            ['⌘,', 'settings'],
          ].map(([key, label]) => (
            <HStack key={key} spacing={1}>
              <Text
                fontSize="10px"
                fontFamily="mono"
                bg="whiteAlpha.100"
                px={1.5}
                py={0.5}
                borderRadius="sm"
                color="whiteAlpha.600"
              >
                {key}
              </Text>
              <Text fontSize="10px" color="whiteAlpha.400">{label}</Text>
            </HStack>
          ))}
        </HStack>
      </Box>

      {/* Modals */}
      {deleteTarget && (
        <DeleteModal
          worktree={deleteTarget}
          onConfirm={handleDelete}
          onClose={() => setDeleteTarget(null)}
        />
      )}

      {showCreate && repoInfo && (
        <CreateWorktreeModal
          repoPath={repoInfo.path}
          settings={settings}
          progress={createProgress}
          onConfirm={handleCreate}
          onClose={() => { setShowCreate(false); setCreateProgress(null) }}
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
      <AppContent />
    </ErrorBoundary>
  )
}
