import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { useToast } from '@chakra-ui/react'
import type { WorktreeWithDiff, RepoInfo, RecentRepo, AppSettings, CreateProgress, PRStatus } from '../../shared/types'
import { type API, defaultAPI } from '../api'

interface WorktreeContextValue {
  repoInfo: RepoInfo | null
  worktrees: WorktreeWithDiff[]
  prStatuses: Record<string, PRStatus | null>
  settings: AppSettings
  detectedBaseBranch: string
  loading: boolean
  refreshing: boolean
  switching: boolean
  filter: string
  setFilter: (filter: string) => void
  refresh: () => Promise<void>
  recentRepos: RecentRepo[]
  switchRepo: (path: string) => Promise<void>
  createProgress: CreateProgress | null
  setCreateProgress: (progress: CreateProgress | null) => void
}

const WorktreeContext = createContext<WorktreeContextValue | null>(null)

export function useWorktree() {
  const ctx = useContext(WorktreeContext)
  if (!ctx) throw new Error('useWorktree must be used within WorktreeProvider')
  return ctx
}

interface WorktreeProviderProps {
  children: ReactNode
  api?: API
}

export function WorktreeProvider({ children, api = defaultAPI }: WorktreeProviderProps) {
  const toast = useToast()
  const [repoInfo, setRepoInfo] = useState<RepoInfo | null>(null)
  const [worktrees, setWorktrees] = useState<WorktreeWithDiff[]>([])
  const [settings, setSettings] = useState<AppSettings>({
    preferredTerminal: 'Terminal',
    preferredIDE: 'VSCode',
    autoRefresh: true,
  })
  const [detectedBaseBranch, setDetectedBaseBranch] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [switching, setSwitching] = useState(false)
  const [recentRepos, setRecentRepos] = useState<RecentRepo[]>([])
  const [filter, setFilterState] = useState(() => sessionStorage.getItem('glit:filter') ?? '')
  const [createProgress, setCreateProgress] = useState<CreateProgress | null>(null)

  const setFilter = useCallback((value: string) => {
    setFilterState(value)
    sessionStorage.setItem('glit:filter', value)
  }, [])
  const [prStatuses, setPrStatuses] = useState<Record<string, PRStatus | null>>({})

  const loadRepo = useCallback(async () => {
    try {
      const info = await api.repo.detect()
      setRepoInfo(info)
      if (!info.isRepo) {
        setLoading(false)
        return
      }
      const [wts, cfg, detectedBranch, recent] = await Promise.all([
        api.worktree.list(info.path),
        api.settings.get(),
        api.repo.defaultBranch(info.path),
        api.repo.listRecent(),
      ])
      setWorktrees(wts)
      setSettings(cfg)
      setDetectedBaseBranch(detectedBranch)
      setRecentRepos(recent)
      Promise.all(wts.map(async (wt) => {
        const status = await api.pr.getStatus(wt.path)
        return [wt.path, status] as const
      })).then((entries) => setPrStatuses(Object.fromEntries(entries)))
    } catch (err) {
      toast({ title: 'Failed to load repository', description: String(err), status: 'error', duration: 5000, isClosable: true })
    } finally {
      setLoading(false)
    }
  }, [api, toast])

  const refresh = useCallback(async () => {
    if (!repoInfo?.isRepo) return
    setRefreshing(true)
    try {
      const wts = await api.worktree.list(repoInfo.path)
      setWorktrees(wts)
      Promise.all(wts.map(async (wt) => {
        const status = await api.pr.getStatus(wt.path)
        return [wt.path, status] as const
      })).then((entries) => setPrStatuses(Object.fromEntries(entries)))
    } catch (err) {
      toast({ title: 'Failed to refresh', description: String(err), status: 'error', duration: 3000 })
    } finally {
      setRefreshing(false)
    }
  }, [api, repoInfo, toast])

  useEffect(() => {
    loadRepo()
  }, [loadRepo])

  useEffect(() => {
    const unsub = api.on('create:progress', (data: unknown) => {
      setCreateProgress(data as CreateProgress)
    })
    return unsub
  }, [api])

  const switchRepo = useCallback(async (newPath: string) => {
    if (newPath === repoInfo?.path) return
    setSwitching(true)
    try {
      const info = await api.repo.switch(newPath)
      if (!info.isRepo) {
        toast({ title: 'Not a git repository', description: newPath, status: 'error', duration: 4000, isClosable: true })
        return
      }
      setRepoInfo(info)
      setWorktrees([])
      setFilter('')
      setPrStatuses({})
      const [wts, cfg, detectedBranch, recent] = await Promise.all([
        api.worktree.list(info.path),
        api.settings.get(),
        api.repo.defaultBranch(info.path),
        api.repo.listRecent(),
      ])
      setWorktrees(wts)
      setSettings(cfg)
      setDetectedBaseBranch(detectedBranch)
      setRecentRepos(recent)
      Promise.all(wts.map(async (wt) => {
        const status = await api.pr.getStatus(wt.path)
        return [wt.path, status] as const
      })).then((entries) => setPrStatuses(Object.fromEntries(entries)))
    } catch (err) {
      toast({ title: 'Failed to switch repository', description: String(err), status: 'error', duration: 5000, isClosable: true })
    } finally {
      setSwitching(false)
    }
  }, [api, repoInfo, toast, setFilter])

  const filtered = worktrees.filter((wt) => {
    if (!filter) return true
    const q = filter.toLowerCase()
    return wt.path.toLowerCase().includes(q) || wt.branch.toLowerCase().includes(q)
  })

  const value: WorktreeContextValue = {
    repoInfo,
    worktrees: filter ? filtered : worktrees,
    prStatuses,
    settings,
    detectedBaseBranch,
    loading,
    refreshing,
    switching,
    filter,
    setFilter,
    refresh,
    recentRepos,
    switchRepo,
    createProgress,
    setCreateProgress,
  }

  return (
    <WorktreeContext.Provider value={value}>
      {children}
    </WorktreeContext.Provider>
  )
}
