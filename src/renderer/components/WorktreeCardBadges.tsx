import {
  HStack,
  Badge,
  Tooltip,
} from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'
import type { WorktreeWithDiff, PRStatus, RunningProcess } from '../../shared/types'
import { useAPI } from '../api'
import { getBranchColor } from '../utils'

interface WorktreeCardBadgesProps {
  worktree: WorktreeWithDiff
  isRoot: boolean
  branchDisplayText: string
  branchJustCopied: boolean
  onCopyBranch: () => void
  prStatus: PRStatus | null | undefined
  runningProcess: RunningProcess | undefined
}

export function WorktreeCardBadges({
  worktree,
  isRoot,
  branchDisplayText,
  branchJustCopied,
  onCopyBranch,
  prStatus,
  runningProcess,
}: WorktreeCardBadgesProps) {
  const api = useAPI()
  const { t } = useTranslation()
  const branchColor = getBranchColor(worktree.branch)

  return (
    <HStack spacing={2} flexWrap="wrap">
      <Tooltip label={branchJustCopied ? t('worktreeCard.tooltips.copied') : t('worktreeCard.tooltips.clickToCopyBranch')} placement="bottom" openDelay={200}>
        <Badge
          colorScheme={branchColor}
          variant="subtle"
          fontSize="xs"
          px={2}
          py={0.5}
          cursor="pointer"
          _hover={{ opacity: 0.9 }}
          onClick={onCopyBranch}
          transition="opacity 0.1s"
        >
          {branchJustCopied ? t('worktreeCard.tooltips.copied') : branchDisplayText}
        </Badge>
      </Tooltip>
      {isRoot && (
        <Badge colorScheme="green" variant="outline" fontSize="9px">
          {t('worktreeCard.badges.root')}
        </Badge>
      )}
      {worktree.isLocked && (
        <Badge colorScheme="orange" variant="subtle" fontSize="9px">
          {t('worktreeCard.badges.locked')}
        </Badge>
      )}
      {worktree.isStale && (
        <Badge colorScheme="yellow" variant="subtle" fontSize="9px">{t('worktreeCard.badges.stale')}</Badge>
      )}
      {prStatus && (
        <Tooltip label={t('worktreeCard.tooltips.openPR', { number: prStatus.number })} placement="bottom" openDelay={200}>
          <Badge
            colorScheme={prStatus.state === 'OPEN' ? 'green' : prStatus.state === 'MERGED' ? 'purple' : 'gray'}
            variant="subtle"
            fontSize="9px"
            cursor="pointer"
            onClick={() => api.shell.openUrl(prStatus.url)}
            _hover={{ opacity: 0.8 }}
          >
            {prStatus.state === 'OPEN' ? t('worktreeCard.prState.open') : prStatus.state === 'MERGED' ? t('worktreeCard.prState.merged') : t('worktreeCard.prState.closed')}
          </Badge>
        </Tooltip>
      )}
      {runningProcess && (
        <Tooltip
          label={runningProcess.port ? t('worktreeCard.tooltips.openLocalhost', { port: runningProcess.port }) : t('worktreeCard.tooltips.processRunning')}
          placement="bottom"
          openDelay={200}
        >
          <Badge
            colorScheme="green"
            variant="subtle"
            fontSize="9px"
            cursor={runningProcess.port ? 'pointer' : 'default'}
            onClick={runningProcess.port ? () => api.shell.openUrl(`http://localhost:${runningProcess.port}`) : undefined}
            _hover={runningProcess.port ? { opacity: 0.8 } : undefined}
          >
            {runningProcess.port ? t('worktreeCard.badges.runningWithPort', { port: runningProcess.port }) : t('worktreeCard.badges.runningNoPort')}
          </Badge>
        </Tooltip>
      )}
    </HStack>
  )
}
