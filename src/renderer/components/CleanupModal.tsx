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
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()

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
      parts.push(wtFailed === 0
        ? t('cleanup.toast.worktrees', { count: wtDeleted })
        : t('cleanup.toast.worktreesPartial', { deleted: wtDeleted, total: wtDeleted + wtFailed }))
    }
    if (branchDeleted + branchFailed > 0) {
      parts.push(branchFailed === 0
        ? t('cleanup.toast.branches', { count: branchDeleted })
        : t('cleanup.toast.branchesPartial', { deleted: branchDeleted, total: branchDeleted + branchFailed }))
    }
    if (wtFailed === 0 && branchFailed === 0 && parts.length > 0) {
      toast({ title: t('cleanup.toast.cleanedUp', { items: parts.join(', ') }), status: 'success', duration: 3000 })
    } else if (parts.length > 0) {
      toast({ title: t('cleanup.toast.partial', { items: parts.join(', ') }), status: 'warning', duration: 4000 })
    }
    modal.hide()
  }, [api, repoPath, selectedWorktrees, selectedBranches, mergedPRWorktrees, handleBatchDelete, refresh, toast, modal, t])

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
    if (selectedWorktrees.size > 0) parts.push(t('cleanup.confirm.removeWorktrees', { count: selectedWorktrees.size }))
    if (selectedBranches.size > 0) parts.push(t('cleanup.confirm.deleteBranches', { count: selectedBranches.size }))
    return parts.length > 0 ? parts.join(t('cleanup.confirm.and')) : t('cleanup.confirm.cleanUp')
  })()

  return (
    <Modal isOpen={modal.visible} onClose={modal.hide} onCloseComplete={() => modal.remove()} size="sm" isCentered>
      <ModalOverlay backdropFilter="blur(4px)" bg="blackAlpha.700" />
      <ModalContent bg="gray.800" borderColor="whiteAlpha.100" border="1px solid">
        <ModalHeader pb={2} fontSize="md">{t('cleanup.title')}</ModalHeader>
        <ModalBody>
          <VStack align="stretch" spacing={4}>
            {hasWorktrees && (
              <VStack align="stretch" spacing={2}>
                <Text fontSize="xs" color="whiteAlpha.500">
                  {t('cleanup.worktreesWithMergedPRs')}
                </Text>
                <HStack spacing={2}>
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => setSelectedWorktrees(new Set(mergedPRWorktrees.map((wt) => wt.path)))}
                    isDisabled={allWorktreesSelected}
                  >
                    {t('cleanup.all')}
                  </Button>
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => setSelectedWorktrees(new Set())}
                    isDisabled={noWorktreesSelected}
                  >
                    {t('cleanup.none')}
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
                  {t('cleanup.branchesMergedInto', { ref: mergeRefLabel })}
                </Text>
                <HStack spacing={2}>
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => setSelectedBranches(new Set(mergedBranches))}
                    isDisabled={allBranchesSelected}
                  >
                    {t('cleanup.all')}
                  </Button>
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => setSelectedBranches(new Set())}
                    isDisabled={noBranchesSelected}
                  >
                    {t('cleanup.none')}
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
              {t('cleanup.cancel')}
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
