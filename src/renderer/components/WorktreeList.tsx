import {
  VStack, Flex, Text, Button,
} from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'
import { useWorktree } from '../contexts/WorktreeContext'
import WorktreeCard from './WorktreeCard'
import type { WorktreeWithDiff } from '../../shared/types'

interface WorktreeListProps {
  onDelete: (worktree: WorktreeWithDiff) => void
  onChangeBranch: (worktree: WorktreeWithDiff) => void
}

export default function WorktreeList({ onDelete, onChangeBranch }: WorktreeListProps) {
  const { worktrees, filter, setFilter } = useWorktree()
  const { t } = useTranslation()

  if (worktrees.length === 0) {
    return (
      <Flex align="center" justify="center" h="200px" direction="column" gap={3}>
        {filter ? (
          <>
            <Text color="whiteAlpha.400" fontSize="sm">{t('worktreeList.noMatch', { filter })}</Text>
            <Button size="xs" variant="ghost" onClick={() => setFilter('')}>{t('worktreeList.clearFilter')}</Button>
          </>
        ) : (
          <Text color="whiteAlpha.400" fontSize="sm">{t('worktreeList.createFirstWorktree')}</Text>
        )}
      </Flex>
    )
  }

  return (
    <VStack spacing={2} align="stretch">
      {worktrees.map((wt) => (
        <WorktreeCard
          key={wt.path}
          worktree={wt}
          onDelete={onDelete}
          onChangeBranch={onChangeBranch}
        />
      ))}
    </VStack>
  )
}
