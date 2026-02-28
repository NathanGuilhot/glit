import { useState } from 'react'
import {
  VStack, Flex, Text, Button, HStack,
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter,
} from '@chakra-ui/react'
import { useWorktree } from '../contexts/WorktreeContext'
import WorktreeCard from './WorktreeCard'
import type { WorktreeWithDiff } from '../../shared/types'

interface WorktreeListProps {
  onDelete: (worktree: WorktreeWithDiff) => void
  onChangeBranch: (worktree: WorktreeWithDiff) => void
  cleanupMode?: boolean
  mergedBranches?: string[]
  onExitCleanup?: () => void
  onBatchDelete?: (worktrees: WorktreeWithDiff[]) => void
}

export default function WorktreeList({ onDelete, onChangeBranch, cleanupMode, mergedBranches, onBatchDelete }: WorktreeListProps) {
  const { worktrees, filter, setFilter } = useWorktree()
  const [showBatchConfirm, setShowBatchConfirm] = useState(false)

  const mergedWorktrees = cleanupMode && mergedBranches
    ? worktrees.filter((wt) => mergedBranches.includes(wt.branch))
    : []

  if (worktrees.length === 0) {
    return (
      <Flex align="center" justify="center" h="200px" direction="column" gap={3}>
        {filter ? (
          <>
            <Text color="whiteAlpha.400" fontSize="sm">No worktrees match "{filter}"</Text>
            <Button size="xs" variant="ghost" onClick={() => setFilter('')}>Clear filter</Button>
          </>
        ) : (
          <Text color="whiteAlpha.400" fontSize="sm">Create your first worktree (c)</Text>
        )}
      </Flex>
    )
  }

  return (
    <VStack spacing={2} align="stretch">
      {cleanupMode && mergedWorktrees.length > 0 && onBatchDelete && (
        <Button
          size="xs"
          colorScheme="orange"
          variant="solid"
          alignSelf="flex-end"
          onClick={() => setShowBatchConfirm(true)}
        >
          Delete all ({mergedWorktrees.length})
        </Button>
      )}
      {worktrees.map((wt) => (
        <WorktreeCard
          key={wt.path}
          worktree={wt}
          onDelete={onDelete}
          onChangeBranch={onChangeBranch}
          isMerged={cleanupMode && mergedBranches?.includes(wt.branch)}
        />
      ))}

      {showBatchConfirm && (
        <Modal isOpen onClose={() => setShowBatchConfirm(false)} size="sm" isCentered>
          <ModalOverlay backdropFilter="blur(4px)" bg="blackAlpha.700" />
          <ModalContent bg="gray.800" borderColor="whiteAlpha.100" border="1px solid">
            <ModalHeader pb={2} fontSize="md">Remove merged worktrees?</ModalHeader>
            <ModalBody>
              <Text fontSize="sm" color="whiteAlpha.700">
                This will remove {mergedWorktrees.length} worktree{mergedWorktrees.length !== 1 ? 's' : ''} whose branches are merged into the base branch. This cannot be undone.
              </Text>
            </ModalBody>
            <ModalFooter>
              <HStack spacing={3}>
                <Button variant="ghost" onClick={() => setShowBatchConfirm(false)}>Cancel</Button>
                <Button
                  colorScheme="orange"
                  onClick={() => {
                    setShowBatchConfirm(false)
                    onBatchDelete?.(mergedWorktrees)
                  }}
                >
                  Remove {mergedWorktrees.length} worktree{mergedWorktrees.length !== 1 ? 's' : ''}
                </Button>
              </HStack>
            </ModalFooter>
          </ModalContent>
        </Modal>
      )}
    </VStack>
  )
}
