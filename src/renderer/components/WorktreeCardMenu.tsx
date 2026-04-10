import {
  IconButton,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  MenuDivider,
  Spinner,
} from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'
import type { WorktreeWithDiff } from '../../shared/types'
import { FolderIcon, DotsIcon, RefreshIcon, RebaseIcon, SyncIcon, PlayIcon, CommitIcon, PushIcon, PullIcon, HistoryIcon, TrashIcon } from './Icons'

interface WorktreeCardMenuProps {
  worktree: WorktreeWithDiff
  isRoot: boolean
  canRebase: boolean
  detectedBaseBranch: string | undefined
  hasDiff: boolean
  hasBranch: boolean
  isRebasing: boolean
  isPushing: boolean
  isPulling: boolean
  onOpenFinder: () => void
  onChangeBranch?: () => void
  onRebase: () => void
  onQuickCommit: () => void
  onPush: () => void
  onForcePush: () => void
  onPull: () => void
  onViewCommits: () => void
  onRunSetup: () => void
  onConfigureRunCommand: () => void
  onSyncWorktree: () => void
  onDelete?: () => void
}

export function WorktreeCardMenu({
  worktree,
  isRoot,
  canRebase,
  detectedBaseBranch,
  hasDiff,
  hasBranch,
  isRebasing,
  isPushing,
  isPulling,
  onOpenFinder,
  onChangeBranch,
  onRebase,
  onQuickCommit,
  onPush,
  onForcePush,
  onPull,
  onViewCommits,
  onRunSetup,
  onConfigureRunCommand,
  onSyncWorktree,
  onDelete,
}: WorktreeCardMenuProps) {
  const { t } = useTranslation()

  return (
    <Menu isLazy placement="bottom-end" strategy="fixed">
      <MenuButton
        as={IconButton}
        aria-label={t('worktreeCard.ariaLabels.moreActions')}
        icon={<DotsIcon boxSize={4} color="whiteAlpha.800" />}
        size="xs"
        variant="ghost"
        colorScheme="whiteAlpha"
      />
      <MenuList bg="gray.800" borderColor="whiteAlpha.100" minW="180px" py={1}>
        <MenuItem
          icon={<FolderIcon boxSize={4} color="whiteAlpha.700" />}
          onClick={onOpenFinder}
          bg="transparent"
          _hover={{ bg: 'whiteAlpha.100' }}
          fontSize="sm"
        >
          {t('worktreeCard.menu.openInFinder')}
        </MenuItem>
        {isRoot && onChangeBranch && (
          <>
            <MenuDivider borderColor="whiteAlpha.100" />
            <MenuItem
              onClick={onChangeBranch}
              bg="transparent"
              _hover={{ bg: 'whiteAlpha.100' }}
              fontSize="sm"
            >
              {t('worktreeCard.menu.changeBranch')}
            </MenuItem>
          </>
        )}
        {hasBranch && (
          <>
            <MenuDivider borderColor="whiteAlpha.100" />
            <MenuItem
              icon={<HistoryIcon boxSize={4} color="whiteAlpha.700" />}
              onClick={onViewCommits}
              bg="transparent"
              _hover={{ bg: 'whiteAlpha.100' }}
              fontSize="sm"
            >
              {t('worktreeCard.menu.viewCommits')}
            </MenuItem>
          </>
        )}
        {canRebase && detectedBaseBranch && (
          <MenuItem
            icon={isRebasing ? <Spinner size="xs" /> : <RebaseIcon boxSize={4} color="whiteAlpha.700" />}
            onClick={onRebase}
            isDisabled={isRebasing}
            bg="transparent"
            _hover={{ bg: 'whiteAlpha.100' }}
            fontSize="sm"
          >
            {t('worktreeCard.menu.rebaseOnto', { branch: detectedBaseBranch })}
          </MenuItem>
        )}
        {hasDiff && (
          <MenuItem
            icon={<CommitIcon boxSize={4} color="whiteAlpha.700" />}
            onClick={onQuickCommit}
            bg="transparent"
            _hover={{ bg: 'whiteAlpha.100' }}
            fontSize="sm"
          >
            {t('worktreeCard.menu.quickCommit')}
          </MenuItem>
        )}
        {hasBranch && worktree.hasUpstream && (
          <MenuItem
            icon={isPulling ? <Spinner size="xs" /> : <PullIcon boxSize={4} color="whiteAlpha.700" />}
            onClick={onPull}
            isDisabled={isPulling}
            bg="transparent"
            _hover={{ bg: 'whiteAlpha.100' }}
            fontSize="sm"
          >
            {t('worktreeCard.menu.pull')}
          </MenuItem>
        )}
        {worktree.aheadCount > 0 && (
          <MenuItem
            icon={isPushing ? <Spinner size="xs" /> : <PushIcon boxSize={4} color="whiteAlpha.700" />}
            onClick={onPush}
            isDisabled={isPushing}
            bg="transparent"
            _hover={{ bg: 'whiteAlpha.100' }}
            fontSize="sm"
          >
            {t('worktreeCard.menu.push')}
          </MenuItem>
        )}
        {hasBranch && (
          <MenuItem
            icon={isPushing ? <Spinner size="xs" /> : <PushIcon boxSize={4} color="whiteAlpha.700" />}
            onClick={onForcePush}
            isDisabled={isPushing}
            bg="transparent"
            _hover={{ bg: 'whiteAlpha.100' }}
            fontSize="sm"
          >
            {t('worktreeCard.menu.forcePush')}
          </MenuItem>
        )}
        <MenuDivider borderColor="whiteAlpha.100" />
        <MenuItem
          icon={<RefreshIcon boxSize={4} color="whiteAlpha.700" />}
          onClick={onRunSetup}
          bg="transparent"
          _hover={{ bg: 'whiteAlpha.100' }}
          fontSize="sm"
        >
          {t('worktreeCard.menu.runSetup')}
        </MenuItem>
        <MenuItem
          icon={<PlayIcon boxSize={4} color="whiteAlpha.700" />}
          onClick={onConfigureRunCommand}
          bg="transparent"
          _hover={{ bg: 'whiteAlpha.100' }}
          fontSize="sm"
        >
          {t('worktreeCard.menu.configureRunCommand')}
        </MenuItem>
        {worktree.isStale && (
          <>
            <MenuDivider borderColor="whiteAlpha.100" />
            <MenuItem
              icon={<SyncIcon boxSize={4} color="yellow.300" />}
              onClick={onSyncWorktree}
              bg="transparent"
              _hover={{ bg: 'whiteAlpha.100' }}
              fontSize="sm"
            >
              {t('worktreeCard.menu.syncWorkingTree')}
            </MenuItem>
          </>
        )}
        {!isRoot && onDelete && (
          <>
            <MenuDivider borderColor="whiteAlpha.100" />
            <MenuItem
              icon={<TrashIcon boxSize={4} color="red.400" />}
              onClick={onDelete}
              bg="transparent"
              _hover={{ bg: 'red.900' }}
              color="red.400"
              fontSize="sm"
            >
              {t('worktreeCard.menu.deleteWorktree')}
            </MenuItem>
          </>
        )}
      </MenuList>
    </Menu>
  )
}
