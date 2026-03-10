import { useEffect, useState, useCallback, useRef } from 'react'
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  HStack,
  Text,
  Badge,
  Spinner,
  useToast,
} from '@chakra-ui/react'
import NiceModal, { useModal } from '@ebay/nice-modal-react'
import { useTranslation } from 'react-i18next'
import type { FileStatusWithStats, FileDiff, RevertLineSpec } from '../../shared/types'
import { useAPI } from '../api'
import { useWorktree } from '../contexts/WorktreeContext'
import { FileListPanel } from './code-review/FileListPanel'
import { DiffViewer } from './code-review/DiffViewer'

interface CodeReviewModalProps {
  worktreePath: string
  branch: string
}

export const CodeReviewModal = NiceModal.create<CodeReviewModalProps>(({ worktreePath, branch }) => {
  const modal = useModal()
  const api = useAPI()
  const toast = useToast()
  const { t } = useTranslation()
  const { refresh } = useWorktree()

  const [files, setFiles] = useState<FileStatusWithStats[]>([])
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [activeFile, setActiveFile] = useState<string | null>(null)
  const [currentDiff, setCurrentDiff] = useState<FileDiff | null>(null)
  const [diffLoading, setDiffLoading] = useState(false)
  const [filesLoading, setFilesLoading] = useState(true)
  const [selectedLines, setSelectedLines] = useState<Set<string>>(new Set())
  const [commitMessage, setCommitMessage] = useState('')
  const [committing, setCommitting] = useState(false)
  const [fileFilter, setFileFilter] = useState('')
  const diffCache = useRef(new Map<string, FileDiff>())
  const lastToggled = useRef<string | null>(null)
  const diffScrollRef = useRef<HTMLDivElement>(null)

  // Load files
  const loadFiles = useCallback(async () => {
    setFilesLoading(true)
    try {
      const result = await api.git.statusWithStats(worktreePath)
      setFiles(result)
      setSelectedFiles(new Set(result.map(f => f.path)))
    } catch {
      setFiles([])
    } finally {
      setFilesLoading(false)
    }
  }, [api, worktreePath])

  useEffect(() => {
    void loadFiles()
  }, [loadFiles])

  // Load diff for active file
  const loadDiff = useCallback(async (filePath: string) => {
    const cached = diffCache.current.get(filePath)
    if (cached) {
      setCurrentDiff(cached)
      return
    }
    setDiffLoading(true)
    try {
      const result = await api.git.diff(worktreePath, filePath)
      diffCache.current.set(filePath, result)
      setCurrentDiff(result)
    } catch {
      setCurrentDiff(null)
    } finally {
      setDiffLoading(false)
    }
  }, [api, worktreePath])

  useEffect(() => {
    if (activeFile) {
      setSelectedLines(new Set())
      void loadDiff(activeFile)
    } else {
      setCurrentDiff(null)
    }
  }, [activeFile, loadDiff])

  // Auto-select first file
  useEffect(() => {
    if (files.length > 0 && !activeFile) {
      setActiveFile(files[0]!.path)
    }
  }, [files, activeFile])

  const toggleFile = useCallback((path: string) => {
    setSelectedFiles(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }, [])

  const toggleAll = useCallback(() => {
    if (selectedFiles.size === files.length) {
      setSelectedFiles(new Set())
    } else {
      setSelectedFiles(new Set(files.map(f => f.path)))
    }
  }, [selectedFiles.size, files])

  const selectFile = useCallback((path: string) => {
    setActiveFile(path)
  }, [])

  const handleToggleLine = useCallback((key: string, shiftKey: boolean) => {
    setSelectedLines(prev => {
      const next = new Set(prev)
      if (shiftKey && lastToggled.current && currentDiff) {
        // Range select: toggle all lines between lastToggled and current
        const [lastHunk, lastLine] = lastToggled.current.split(':').map(Number)
        const [curHunk, curLine] = key.split(':').map(Number)
        if (lastHunk !== undefined && lastLine !== undefined && curHunk !== undefined && curLine !== undefined) {
          // Simple range: only works within same hunk
          if (lastHunk === curHunk) {
            const start = Math.min(lastLine, curLine)
            const end = Math.max(lastLine, curLine)
            for (let i = start; i <= end; i++) {
              const k = `${curHunk}:${i}`
              const line = currentDiff.hunks[curHunk]?.lines[i]
              if (line && line.type !== 'context') {
                next.add(k)
              }
            }
          }
        }
      } else {
        if (next.has(key)) next.delete(key)
        else next.add(key)
      }
      lastToggled.current = key
      return next
    })
  }, [currentDiff])

  const refreshActiveFile = useCallback(async () => {
    if (!activeFile) return
    diffCache.current.delete(activeFile)
    try {
      const result = await api.git.diff(worktreePath, activeFile)
      diffCache.current.set(activeFile, result)
      setCurrentDiff(result)
    } catch {
      setCurrentDiff(null)
    }
    // Also refresh file list
    try {
      const result = await api.git.statusWithStats(worktreePath)
      setFiles(result)
      // Remove files from selection that no longer exist
      setSelectedFiles(prev => {
        const validPaths = new Set(result.map(f => f.path))
        const next = new Set([...prev].filter(p => validPaths.has(p)))
        return next
      })
      // If active file no longer exists in the list, clear it
      if (!result.some(f => f.path === activeFile)) {
        setActiveFile(result.length > 0 ? result[0]!.path : null)
      }
    } catch { /* ignore */ }
  }, [activeFile, api, worktreePath])

  const handleRevertFile = useCallback(async () => {
    if (!activeFile) return
    try {
      const result = await api.git.revertFile(worktreePath, activeFile)
      if (result.success) {
        toast({ title: t('codeReview.toast.fileReverted'), status: 'success', duration: 3000 })
        diffCache.current.delete(activeFile)
        // Refresh everything
        const newFiles = await api.git.statusWithStats(worktreePath)
        setFiles(newFiles)
        setSelectedFiles(prev => {
          const validPaths = new Set(newFiles.map(f => f.path))
          const next = new Set([...prev].filter(p => validPaths.has(p)))
          return next
        })
        if (!newFiles.some(f => f.path === activeFile)) {
          setActiveFile(newFiles.length > 0 ? newFiles[0]!.path : null)
          setCurrentDiff(null)
        } else {
          await refreshActiveFile()
        }
        setSelectedLines(new Set())
      } else {
        toast({ title: t('codeReview.toast.revertFailed'), description: result.error, status: 'error', duration: 5000, isClosable: true })
      }
    } catch {
      toast({ title: t('codeReview.toast.revertFailed'), status: 'error', duration: 5000 })
    }
  }, [activeFile, api, worktreePath, toast, t, refreshActiveFile])

  const handleRevertLines = useCallback(async () => {
    if (!activeFile || !currentDiff || selectedLines.size === 0) return
    const specs: RevertLineSpec[] = []
    for (const key of selectedLines) {
      const [hunkIdx, lineIdx] = key.split(':').map(Number)
      if (hunkIdx === undefined || lineIdx === undefined) continue
      const line = currentDiff.hunks[hunkIdx]?.lines[lineIdx]
      if (!line || line.type === 'context') continue
      specs.push({
        type: line.type,
        newLineNumber: line.newLineNumber ?? undefined,
        oldLineNumber: line.oldLineNumber ?? undefined,
      })
    }
    if (specs.length === 0) return
    try {
      const result = await api.git.revertLines(worktreePath, activeFile, specs)
      if (result.success) {
        toast({ title: t('codeReview.toast.linesReverted', { count: specs.length }), status: 'success', duration: 3000 })
        setSelectedLines(new Set())
        await refreshActiveFile()
      } else {
        toast({ title: t('codeReview.toast.revertFailed'), description: result.error, status: 'error', duration: 5000, isClosable: true })
      }
    } catch {
      toast({ title: t('codeReview.toast.revertFailed'), status: 'error', duration: 5000 })
    }
  }, [activeFile, currentDiff, selectedLines, api, worktreePath, toast, t, refreshActiveFile])

  const handleRevertHunk = useCallback(async (hunkIdx: number) => {
    if (!activeFile || !currentDiff) return
    const hunk = currentDiff.hunks[hunkIdx]
    if (!hunk) return
    const specs: RevertLineSpec[] = hunk.lines
      .filter((l): l is typeof l & { type: 'add' | 'remove' } => l.type !== 'context')
      .map(l => ({
        type: l.type,
        newLineNumber: l.newLineNumber ?? undefined,
        oldLineNumber: l.oldLineNumber ?? undefined,
      }))
    if (specs.length === 0) return
    try {
      const result = await api.git.revertLines(worktreePath, activeFile, specs)
      if (result.success) {
        toast({ title: t('codeReview.toast.hunkReverted'), status: 'success', duration: 3000 })
        setSelectedLines(new Set())
        await refreshActiveFile()
      } else {
        toast({ title: t('codeReview.toast.revertFailed'), description: result.error, status: 'error', duration: 5000, isClosable: true })
      }
    } catch {
      toast({ title: t('codeReview.toast.revertFailed'), status: 'error', duration: 5000 })
    }
  }, [activeFile, currentDiff, api, worktreePath, toast, t, refreshActiveFile])

  const handleApplyEdit = useCallback(async (lineNumber: number, newContent: string) => {
    if (!activeFile) return
    const savedScroll = diffScrollRef.current?.scrollTop ?? 0
    try {
      const result = await api.git.applyEdit(worktreePath, activeFile, lineNumber, newContent)
      if (result.success) {
        await refreshActiveFile()
        requestAnimationFrame(() => {
          if (diffScrollRef.current) {
            diffScrollRef.current.scrollTop = savedScroll
          }
        })
      } else {
        toast({ title: t('codeReview.toast.editFailed'), description: result.error, status: 'error', duration: 5000, isClosable: true })
      }
    } catch {
      toast({ title: t('codeReview.toast.editFailed'), status: 'error', duration: 5000 })
    }
  }, [activeFile, api, worktreePath, toast, t, refreshActiveFile])

  const handleDeleteLine = useCallback(async (lineNumber: number) => {
    if (!activeFile) return
    const savedScroll = diffScrollRef.current?.scrollTop ?? 0
    try {
      const result = await api.git.deleteLine(worktreePath, activeFile, lineNumber)
      if (result.success) {
        await refreshActiveFile()
        requestAnimationFrame(() => {
          if (diffScrollRef.current) {
            diffScrollRef.current.scrollTop = savedScroll
          }
        })
      } else {
        toast({ title: t('codeReview.toast.editFailed'), description: result.error, status: 'error', duration: 5000, isClosable: true })
      }
    } catch {
      toast({ title: t('codeReview.toast.editFailed'), status: 'error', duration: 5000 })
    }
  }, [activeFile, api, worktreePath, toast, t, refreshActiveFile])

  const handleCommit = useCallback(async () => {
    if (!commitMessage.trim() || selectedFiles.size === 0) return
    setCommitting(true)
    try {
      const result = await api.git.commit(worktreePath, Array.from(selectedFiles), commitMessage.trim())
      if (result.success) {
        toast({ title: t('codeReview.toast.committed'), status: 'success', duration: 3000 })
        modal.hide()
        void refresh()
      } else {
        toast({ title: t('codeReview.toast.commitFailed'), description: result.error, status: 'error', duration: 5000, isClosable: true })
      }
    } finally {
      setCommitting(false)
    }
  }, [commitMessage, selectedFiles, api, worktreePath, toast, t, modal, refresh])

  return (
    <Modal isOpen={modal.visible} onClose={modal.hide} size="full">
      <ModalOverlay />
      <ModalContent
        maxW="95vw"
        maxH="90vh"
        w="95vw"
        h="90vh"
        minH="unset"
        bg="gray.800"
        borderColor="whiteAlpha.100"
        border="1px solid"
        borderRadius="xl"
        overflow="hidden"
        my="5vh"
        display="flex"
        flexDirection="column"
      >
        <ModalHeader fontSize="md" pb={2} borderBottom="1px solid" borderColor="whiteAlpha.100" flexShrink={0}>
          <HStack spacing={2}>
            <Text>{t('codeReview.title')}</Text>
            <Badge colorScheme="gray" variant="subtle" fontSize="xs" fontFamily="mono" maxW="300px" isTruncated>
              {branch}
            </Badge>
            {filesLoading && <Spinner size="xs" color="brand.400" />}
          </HStack>
        </ModalHeader>
        <ModalCloseButton color="whiteAlpha.600" />
        <ModalBody p={0} display="flex" overflow="hidden" flex={1} minH={0}>
          <HStack spacing={0} h="full" w="full" align="stretch" minH={0}>
            <FileListPanel
              files={files}
              selectedFiles={selectedFiles}
              activeFile={activeFile}
              fileFilter={fileFilter}
              commitMessage={commitMessage}
              committing={committing}
              onToggleFile={toggleFile}
              onToggleAll={toggleAll}
              onSelectFile={selectFile}
              onFilterChange={setFileFilter}
              onCommitMessageChange={setCommitMessage}
              onCommit={() => void handleCommit()}
            />
            <DiffViewer
              diff={currentDiff}
              loading={diffLoading}
              selectedLines={selectedLines}
              scrollRef={diffScrollRef}
              onToggleLine={handleToggleLine}
              onRevertFile={() => void handleRevertFile()}
              onRevertLines={() => void handleRevertLines()}
              onRevertHunk={(idx) => void handleRevertHunk(idx)}
              onApplyEdit={(ln, content) => void handleApplyEdit(ln, content)}
              onDeleteLine={(ln) => void handleDeleteLine(ln)}
            />
          </HStack>
        </ModalBody>
      </ModalContent>
    </Modal>
  )
})
