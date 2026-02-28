import React, { useState, useCallback } from 'react'
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  HStack,
  VStack,
  Checkbox,
  Text,
  Divider,
  useToast,
} from '@chakra-ui/react'
import NiceModal, { useModal } from '@ebay/nice-modal-react'
import type { WorktreeWithDiff, PRStatus } from '../../shared/types'
import { useAPI } from '../api'
import { useAppActions } from '../contexts/AppActionsContext'
import { useWorktree } from '../contexts/WorktreeContext'

const CleanupModal = NiceModal.create<{
  repoPath: string
  baseBranch: string
  mergeRefLabel: string
  mergedPRWorktrees: WorktreeWithDiff[]
  mergedBranches: string[]
  prStatuses: Record<string, PRStatus | null>
}>(({ repoPath, mergeRefLabel, mergedPRWorktrees, mergedBranches, prStatuses }) => {
  const modal = useModal()
  const api = useAPI()
  const { handleBatchDelete } = useAppActions()
  const { refresh } = useWorktree()
  const toast = useToast()

  const [selectedWorktrees, setSelectedWorktrees] = useState<Set<string>>(
    () => new Set(mergedPRWorktrees.map((wt) => wt.path))
  )
  const [selectedBranches, setSelectedBranches] = useState<Set<string>>(() => new Set(mergedBranches))
  const [deleting, setDeleting] = useState(false)

  const toggleWorktree = useCallback((path: string) => {
    setSelectedWorktrees((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }, [])

  const toggleBranch = useCallback((name: string) => {
    setSelectedBranches((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }, [])

  const handleConfirm = useCallback(async () => {
    setDeleting(true)
    const worktreesToDelete = mergedPRWorktrees.filter((wt) => selectedWorktrees.has(wt.path))
    let wtDeleted = 0
    let wtFailed = 0
    if (worktreesToDelete.length > 0) {
      const result = await handleBatchDelete(worktreesToDelete)
      wtDeleted = result.deleted
      wtFailed = result.failed
    }
    let branchDeleted = 0
    let branchFailed = 0
    for (const name of selectedBranches) {
      try {
        await api.branch.delete(repoPath, name)
        branchDeleted++
      } catch {
        branchFailed++
      }
    }
    setDeleting(false)
    await refresh()
    const parts: string[] = []
    if (wtDeleted + wtFailed > 0) {
      parts.push(wtFailed === 0 ? `${wtDeleted} worktree${wtDeleted !== 1 ? 's' : ''}` : `${wtDeleted}/${wtDeleted + wtFailed} worktrees`)
    }
    if (branchDeleted + branchFailed > 0) {
      parts.push(branchFailed === 0 ? `${branchDeleted} branch${branchDeleted !== 1 ? 'es' : ''}` : `${branchDeleted}/${branchDeleted + branchFailed} branches`)
    }
    if (wtFailed === 0 && branchFailed === 0 && parts.length > 0) {
      toast({ title: `Cleaned up: ${parts.join(', ')}`, status: 'success', duration: 3000 })
    } else if (parts.length > 0) {
      toast({ title: `Partial: ${parts.join(', ')}`, status: 'warning', duration: 4000 })
    }
    modal.hide()
  }, [api, repoPath, selectedWorktrees, selectedBranches, mergedPRWorktrees, handleBatchDelete, refresh, toast, modal])

  const allWorktreesSelected = mergedPRWorktrees.length > 0 && selectedWorktrees.size === mergedPRWorktrees.length
  const noWorktreesSelected = selectedWorktrees.size === 0
  const allBranchesSelected = mergedBranches.length > 0 && selectedBranches.size === mergedBranches.length
  const noBranchesSelected = selectedBranches.size === 0
  const hasWorktrees = mergedPRWorktrees.length > 0
  const hasBranches = mergedBranches.length > 0
  const canConfirm =
    (hasWorktrees && !noWorktreesSelected) || (hasBranches && !noBranchesSelected)

  const confirmLabel = (() => {
    const parts: string[] = []
    if (selectedWorktrees.size > 0) parts.push(`Remove ${selectedWorktrees.size} worktree${selectedWorktrees.size !== 1 ? 's' : ''}`)
    if (selectedBranches.size > 0) parts.push(`Delete ${selectedBranches.size} branch${selectedBranches.size !== 1 ? 'es' : ''}`)
    return parts.length > 0 ? parts.join(' and ') : 'Clean up'
  })()

  return (
    <Modal isOpen={modal.visible} onClose={modal.hide} size="sm" isCentered>
      <ModalOverlay backdropFilter="blur(4px)" bg="blackAlpha.700" />
      <ModalContent bg="gray.800" borderColor="whiteAlpha.100" border="1px solid">
        <ModalHeader pb={2} fontSize="md">Clean up</ModalHeader>
        <ModalBody>
          <VStack align="stretch" spacing={4}>
            {hasWorktrees && (
              <VStack align="stretch" spacing={2}>
                <Text fontSize="xs" color="whiteAlpha.500">
                  Worktrees with merged PRs:
                </Text>
                <HStack spacing={2}>
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => setSelectedWorktrees(new Set(mergedPRWorktrees.map((wt) => wt.path)))}
                    isDisabled={allWorktreesSelected}
                  >
                    All
                  </Button>
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => setSelectedWorktrees(new Set())}
                    isDisabled={noWorktreesSelected}
                  >
                    None
                  </Button>
                </HStack>
                <VStack align="stretch" spacing={1} maxH="120px" overflowY="auto">
                  {mergedPRWorktrees.map((wt) => {
                    const pr = prStatuses[wt.path]
                    const label = pr ? `${wt.branch} (PR #${pr.number})` : wt.branch
                    return (
                      <Checkbox
                        key={wt.path}
                        isChecked={selectedWorktrees.has(wt.path)}
                        onChange={() => toggleWorktree(wt.path)}
                        size="sm"
                        fontFamily="mono"
                        fontSize="sm"
                      >
                        {label}
                      </Checkbox>
                    )
                  })}
                </VStack>
              </VStack>
            )}
            {hasWorktrees && hasBranches && <Divider borderColor="whiteAlpha.100" />}
            {hasBranches && (
              <VStack align="stretch" spacing={2}>
                <Text fontSize="xs" color="whiteAlpha.500">
                  Branches merged into <Text as="span" fontFamily="mono">{mergeRefLabel}</Text>:
                </Text>
                <HStack spacing={2}>
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => setSelectedBranches(new Set(mergedBranches))}
                    isDisabled={allBranchesSelected}
                  >
                    All
                  </Button>
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => setSelectedBranches(new Set())}
                    isDisabled={noBranchesSelected}
                  >
                    None
                  </Button>
                </HStack>
                <VStack align="stretch" spacing={1} maxH="120px" overflowY="auto">
                  {mergedBranches.map((name) => (
                    <Checkbox
                      key={name}
                      isChecked={selectedBranches.has(name)}
                      onChange={() => toggleBranch(name)}
                      size="sm"
                      fontFamily="mono"
                      fontSize="sm"
                    >
                      {name}
                    </Checkbox>
                  ))}
                </VStack>
              </VStack>
            )}
          </VStack>
        </ModalBody>
        <ModalFooter>
          <HStack spacing={3}>
            <Button variant="ghost" onClick={modal.hide} isDisabled={deleting}>
              Cancel
            </Button>
            {canConfirm && (
              <Button
                colorScheme="red"
                isDisabled={deleting}
                isLoading={deleting}
                onClick={handleConfirm}
              >
                {confirmLabel}
              </Button>
            )}
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
})

export default CleanupModal
