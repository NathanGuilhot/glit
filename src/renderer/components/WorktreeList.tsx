import { VStack, Flex, Text, Button, Box, HStack } from '@chakra-ui/react'
import { useWorktree } from '../contexts/WorktreeContext'
import WorktreeCard from './WorktreeCard'
import type { WorktreeWithDiff } from '../../shared/types'

interface WorktreeListProps {
  onDelete: (worktree: WorktreeWithDiff) => void
  cleanupMode?: boolean
  mergedBranches?: string[]
  onExitCleanup?: () => void
  onBatchDelete?: (worktrees: WorktreeWithDiff[]) => void
}

export default function WorktreeList({ onDelete, cleanupMode, mergedBranches, onBatchDelete }: WorktreeListProps) {
  const { worktrees, filter, setFilter } = useWorktree()

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
          <Text color="whiteAlpha.400" fontSize="sm">No worktrees found</Text>
        )}
      </Flex>
    )
  }

  return (
    <VStack spacing={2} align="stretch">
      {cleanupMode && (
        <Box
          bg="orange.900"
          border="1px solid"
          borderColor="orange.600"
          borderRadius="md"
          px={4}
          py={3}
          mb={1}
        >
          <HStack justify="space-between" align="center">
            <Text fontSize="sm" color="orange.200" fontWeight="500">
              {mergedWorktrees.length} worktree{mergedWorktrees.length !== 1 ? 's' : ''} with merged branches found
            </Text>
            {mergedWorktrees.length > 0 && onBatchDelete && (
              <Button
                size="xs"
                colorScheme="orange"
                variant="solid"
                onClick={() => {
                  if (window.confirm(`Delete ${mergedWorktrees.length} merged worktree${mergedWorktrees.length !== 1 ? 's' : ''}? This cannot be undone.`)) {
                    onBatchDelete(mergedWorktrees)
                  }
                }}
              >
                Delete all ({mergedWorktrees.length})
              </Button>
            )}
          </HStack>
        </Box>
      )}
      {worktrees.map((wt) => (
        <WorktreeCard
          key={wt.path}
          worktree={wt}
          onDelete={onDelete}
          isMerged={cleanupMode && mergedBranches?.includes(wt.branch)}
        />
      ))}
    </VStack>
  )
}
