import { useState } from 'react'
import {
  Box,
  HStack,
  VStack,
  Text,
  Badge,
  IconButton,
  Tooltip,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  MenuDivider,
  Skeleton,
  Spinner,
  useToast,
} from '@chakra-ui/react'
import NiceModal from '@ebay/nice-modal-react'
import { useTranslation } from 'react-i18next'
import type { WorktreeWithDiff } from '../../shared/types'
import { IDEIcon, TerminalIcon, TrashIcon, FolderIcon, DotsIcon, RefreshIcon, RebaseIcon, SyncIcon, PlayIcon, StopIcon, LogsIcon, CommitIcon, PushIcon } from './Icons'
import { useWorktree } from '../contexts/WorktreeContext'
import { useAppActions } from '../contexts/AppActionsContext'
import { useAPI } from '../api'
import { ProcessLogDrawer } from './ProcessLogDrawer'
import { RunCommandModal } from './RunCommandModal'
import { CodeReviewModal } from './CodeReviewModal'
import { TooltipIconButton } from './TooltipIconButton'
import { getBranchColor } from '../utils'

interface WorktreeCardProps {
  worktree: WorktreeWithDiff
  onDelete?: (worktree: WorktreeWithDiff) => void
  onChangeBranch?: (worktree: WorktreeWithDiff) => void
}

export function WorktreeCardSkeleton() {
  return (
    <Box
      bg="whiteAlpha.50"
      border="1px solid"
      borderColor="whiteAlpha.100"
      borderRadius="lg"
      px={4}
      py={3}
    >
      <HStack spacing={3} align="start">
        <VStack align="start" spacing={2} flex={1}>
          <Skeleton height="18px" width="120px" borderRadius="md" startColor="whiteAlpha.100" endColor="whiteAlpha.200" />
          <Skeleton height="11px" width="220px" borderRadius="md" startColor="whiteAlpha.50" endColor="whiteAlpha.150" />
          <Skeleton height="10px" width="80px" borderRadius="md" startColor="whiteAlpha.50" endColor="whiteAlpha.100" />
        </VStack>
        <HStack spacing={2} flexShrink={0} alignItems="center">
          <Skeleton height="14px" width="50px" borderRadius="md" startColor="whiteAlpha.50" endColor="whiteAlpha.150" />
        </HStack>
      </HStack>
    </Box>
  )
}

export default function WorktreeCard({ worktree, onDelete, onChangeBranch }: WorktreeCardProps) {
  const { settings, prStatuses, repoInfo, detectedBaseBranch, runningProcesses, refresh } = useWorktree()
  const { handleCopyPath, handleCopyBranch, handleOpenTerminal, handleOpenIDE, handleOpenFinder, handleRunSetup, handleSyncWorktree } = useAppActions()
  const api = useAPI()
  const toast = useToast()
  const { t } = useTranslation()
  const [branchJustCopied, setBranchJustCopied] = useState(false)
  const [isRebasing, setIsRebasing] = useState(false)
  const [isPushing, setIsPushing] = useState(false)

  const isRoot = repoInfo?.path === worktree.path
  const shortPath = worktree.displayPath ?? worktree.path
  const branchColor = getBranchColor(worktree.branch)
  const branchDisplayText = worktree.branch || t('worktreeCard.noBranch')
  const runningProcess = runningProcesses[worktree.path]
  const prStatus = prStatuses[worktree.path]

  const canRebase =
    !!detectedBaseBranch &&
    !worktree.isBare &&
    !!worktree.branch &&
    !worktree.branch.startsWith('detached:') &&
    worktree.branch !== detectedBaseBranch

  const handleCopyBranchClick = () => {
    handleCopyBranch(branchDisplayText)
    setBranchJustCopied(true)
    setTimeout(() => setBranchJustCopied(false), 1500)
  }

  const handleRebase = async () => {
    if (!detectedBaseBranch) return
    setIsRebasing(true)
    try {
      const result = await api.branch.rebaseOnto(worktree.path, detectedBaseBranch)
      if (result.success) {
        toast({ title: t('worktreeCard.toast.rebased', { branch: detectedBaseBranch }), status: 'success', duration: 3000 })
        refresh()
      } else {
        toast({
          title: result.hasConflicts ? t('worktreeCard.toast.rebaseConflicts') : t('worktreeCard.toast.rebaseFailed'),
          description: result.hasConflicts ? t('worktreeCard.toast.rebaseConflictsDescription', { branch: worktree.branch }) : result.error,
          status: result.hasConflicts ? 'warning' : 'error',
          duration: result.hasConflicts ? 8000 : 5000,
          isClosable: true,
        })
      }
    } finally {
      setIsRebasing(false)
    }
  }

  const openRunModal = (clearSaved = false) => {
    if (clearSaved) {
      void api.process.saveCommand(worktree.path, '')
    }
    NiceModal.show(RunCommandModal, {
      worktreePath: worktree.path,
      branch: branchDisplayText,
      onConfirm: (command: string) => {
        void api.process.start(worktree.path, command)
      },
    })
  }

  const handleRun = async () => {
    const saved = await api.process.getSavedCommand(worktree.path)
    if (saved) {
      void api.process.start(worktree.path, saved)
    } else {
      openRunModal()
    }
  }

  const handleStop = () => {
    void api.process.stop(worktree.path)
  }

  const handleOpenLogs = () => {
    NiceModal.show(ProcessLogDrawer, { worktreePath: worktree.path, branch: branchDisplayText })
  }

  const handleQuickCommit = () => {
    NiceModal.show(CodeReviewModal, { worktreePath: worktree.path, branch: branchDisplayText })
  }

  const handlePush = async (force = false) => {
    setIsPushing(true)
    try {
      const result = await api.git.push(worktree.path, force)
      if (result.success) {
        toast({ title: force ? t('worktreeCard.toast.forcePushed') : t('worktreeCard.toast.pushed'), status: 'success', duration: 3000 })
        void refresh()
      } else {
        toast({ title: t('worktreeCard.toast.pushFailed'), description: result.error, status: 'error', duration: 5000, isClosable: true })
      }
    } finally {
      setIsPushing(false)
    }
  }

  const hasDiff = worktree.fileCount > 0
  const hasBranch = !!worktree.branch && !worktree.branch.startsWith('detached:') && !worktree.isBare

  return (
    <Box
      bg="whiteAlpha.50"
      border="1px solid"
      borderColor="whiteAlpha.100"
      borderRadius="lg"
      px={4}
      py={3}
      _hover={{ bg: 'whiteAlpha.100', borderColor: 'whiteAlpha.200' }}
      transition="all 0.15s ease"
      position="relative"
      role="group"
    >
      <HStack spacing={[2, 3]} align="start">
        <VStack align="start" spacing={1} flex={1} minW={0}>
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
                onClick={handleCopyBranchClick}
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

          <Tooltip label={t('worktreeCard.tooltips.clickToCopyPath')} placement="bottom" openDelay={200}>
            <Text
              fontSize="11px"
              fontFamily="mono"
              color="whiteAlpha.500"
              noOfLines={1}
              cursor="pointer"
              _hover={{ color: 'brand.300' }}
              onClick={() => handleCopyPath(worktree.path)}
              transition="color 0.1s"
            >
              {shortPath}
            </Text>
          </Tooltip>
          {worktree.lastActivity && (
            <Text fontSize="10px" color="whiteAlpha.400">
              {worktree.lastActivity}
            </Text>
          )}
        </VStack>

        <HStack spacing={3} flexShrink={0} align="center">
          <Box display={["none", "flex"]} alignItems="center">
            <HStack spacing={2}>
              {hasDiff ? (
                <>
                  <Text fontSize="12px" color="green.400" fontFamily="mono" fontWeight="600">
                    +{worktree.insertionCount}
                  </Text>
                  <Text fontSize="12px" color="red.400" fontFamily="mono" fontWeight="600">
                    -{worktree.deletionCount}
                  </Text>
                  <Text fontSize="11px" color="whiteAlpha.400">
                    {t('worktreeCard.fileCount', { count: worktree.fileCount })}
                  </Text>
                </>
              ) : (
                <Text fontSize="11px" color="whiteAlpha.300">{t('worktreeCard.clean')}</Text>
              )}
              {worktree.aheadCount > 0 && (
                <Text fontSize="12px" color="whiteAlpha.600" fontFamily="mono" fontWeight="600">
                  ↑{worktree.aheadCount}
                </Text>
              )}
              {worktree.behindCount > 0 && (
                <Text fontSize="12px" color="whiteAlpha.600" fontFamily="mono" fontWeight="600">
                  ↓{worktree.behindCount}
                </Text>
              )}
            </HStack>
          </Box>

          <HStack spacing={0} opacity={0} _groupHover={{ opacity: 1 }} transition="opacity 0.15s">
            {runningProcess ? (
              <>
                <TooltipIconButton label={t('worktreeCard.tooltips.viewLogs')} icon={<LogsIcon boxSize={4} color="whiteAlpha.800" />} onClick={handleOpenLogs} />
                <TooltipIconButton label={t('worktreeCard.tooltips.stopProcess')} icon={<StopIcon boxSize={3.5} color="red.400" />} onClick={handleStop} />
              </>
            ) : (
              <TooltipIconButton label={t('worktreeCard.tooltips.runDevCommand')} icon={<PlayIcon boxSize={3.5} color="whiteAlpha.800" />} onClick={() => void handleRun()} />
            )}
            <TooltipIconButton label={t('worktreeCard.tooltips.openInTerminal', { terminal: settings.preferredTerminal })} icon={<TerminalIcon boxSize={4} color="whiteAlpha.800" />} onClick={() => handleOpenTerminal(worktree.path)} />
            <TooltipIconButton label={t('worktreeCard.tooltips.openInIDE', { ide: settings.preferredIDE })} icon={<IDEIcon boxSize={4} color="whiteAlpha.800" />} onClick={() => handleOpenIDE(worktree.path)} />
          </HStack>

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
                onClick={() => handleOpenFinder(worktree.path)}
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
                    onClick={() => onChangeBranch(worktree)}
                    bg="transparent"
                    _hover={{ bg: 'whiteAlpha.100' }}
                    fontSize="sm"
                  >
                    {t('worktreeCard.menu.changeBranch')}
                  </MenuItem>
                </>
              )}
              {canRebase && detectedBaseBranch && (
                <>
                  <MenuDivider borderColor="whiteAlpha.100" />
                  <MenuItem
                    icon={isRebasing ? <Spinner size="xs" /> : <RebaseIcon boxSize={4} color="whiteAlpha.700" />}
                    onClick={handleRebase}
                    isDisabled={isRebasing}
                    bg="transparent"
                    _hover={{ bg: 'whiteAlpha.100' }}
                    fontSize="sm"
                  >
                    {t('worktreeCard.menu.rebaseOnto', { branch: detectedBaseBranch })}
                  </MenuItem>
                </>
              )}
              {hasDiff && (
                <MenuItem
                  icon={<CommitIcon boxSize={4} color="whiteAlpha.700" />}
                  onClick={handleQuickCommit}
                  bg="transparent"
                  _hover={{ bg: 'whiteAlpha.100' }}
                  fontSize="sm"
                >
                  {t('worktreeCard.menu.quickCommit')}
                </MenuItem>
              )}
              {worktree.aheadCount > 0 && (
                <MenuItem
                  icon={isPushing ? <Spinner size="xs" /> : <PushIcon boxSize={4} color="whiteAlpha.700" />}
                  onClick={() => void handlePush(false)}
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
                  onClick={() => void handlePush(true)}
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
                onClick={() => handleRunSetup(worktree)}
                bg="transparent"
                _hover={{ bg: 'whiteAlpha.100' }}
                fontSize="sm"
              >
                {t('worktreeCard.menu.runSetup')}
              </MenuItem>
              <MenuItem
                icon={<PlayIcon boxSize={4} color="whiteAlpha.700" />}
                onClick={() => openRunModal(true)}
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
                    onClick={() => handleSyncWorktree(worktree)}
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
                    onClick={() => onDelete(worktree)}
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
        </HStack>
      </HStack>
    </Box>
  )
}
