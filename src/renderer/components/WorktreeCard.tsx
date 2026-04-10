import { useState } from 'react'
import {
  Box,
  HStack,
  VStack,
  Text,
  Tooltip,
  useToast,
} from '@chakra-ui/react'
import NiceModal from '@ebay/nice-modal-react'
import { useTranslation } from 'react-i18next'
import type { WorktreeWithDiff } from '../../shared/types'
import { TerminalIcon, IDEIcon, PlayIcon, StopIcon, LogsIcon } from './Icons'
import { useWorktree } from '../contexts/WorktreeContext'
import { useAppActions } from '../contexts/AppActionsContext'
import { useAPI } from '../api'
import { ProcessLogDrawer } from './ProcessLogDrawer'
import { RunCommandModal } from './RunCommandModal'
import { CodeReviewModal } from './CodeReviewModal'
import { CommitsModal } from './CommitsModal'
import { TooltipIconButton } from './TooltipIconButton'
import { WorktreeCardBadges } from './WorktreeCardBadges'
import { WorktreeCardMenu } from './WorktreeCardMenu'

interface WorktreeCardProps {
  worktree: WorktreeWithDiff
  onDelete?: (worktree: WorktreeWithDiff) => void
  onChangeBranch?: (worktree: WorktreeWithDiff) => void
}

export default function WorktreeCard({ worktree, onDelete, onChangeBranch }: WorktreeCardProps) {
  const { settings, prStatuses, repoInfo, detectedBaseBranch, runningProcesses, refresh } = useWorktree()
  const { handleCopyPath, handleCopyBranch, handleOpenTerminal, handleOpenIDE, handleOpenFinder, handleOpenPR, handleRunSetup, handleSyncWorktree } = useAppActions()
  const api = useAPI()
  const toast = useToast()
  const { t } = useTranslation()
  const [branchJustCopied, setBranchJustCopied] = useState(false)
  const [isRebasing, setIsRebasing] = useState(false)
  const [isPushing, setIsPushing] = useState(false)
  const [isPulling, setIsPulling] = useState(false)

  const isRoot = repoInfo?.path === worktree.path
  const shortPath = worktree.displayPath ?? worktree.path
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

  const handlePull = async () => {
    setIsPulling(true)
    try {
      const result = await api.git.pull(worktree.path)
      if (result.success) {
        toast({ title: t('worktreeCard.toast.pulled'), status: 'success', duration: 3000 })
        void refresh()
      } else if (result.hasUpstream === false) {
        toast({ title: t('worktreeCard.toast.pullNoUpstream'), status: 'warning', duration: 5000, isClosable: true })
      } else if (result.isNonFastForward) {
        toast({
          title: t('worktreeCard.toast.pullNonFastForward'),
          description: t('worktreeCard.toast.pullNonFastForwardDescription'),
          status: 'warning',
          duration: 8000,
          isClosable: true,
        })
      } else {
        toast({ title: t('worktreeCard.toast.pullFailed'), description: result.error, status: 'error', duration: 5000, isClosable: true })
      }
    } finally {
      setIsPulling(false)
    }
  }

  const handleViewCommits = () => {
    NiceModal.show(CommitsModal, {
      worktreePath: worktree.path,
      branch: branchDisplayText,
      baseBranch: detectedBaseBranch,
    })
  }

  const hasDiff = worktree.fileCount > 0
  const hasBranch = !!worktree.branch && !worktree.branch.startsWith('detached:') && !worktree.isBare
  const canCreatePR = !prStatus && hasBranch && worktree.branch !== detectedBaseBranch

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
          <WorktreeCardBadges
            worktree={worktree}
            isRoot={isRoot}
            branchDisplayText={branchDisplayText}
            branchJustCopied={branchJustCopied}
            onCopyBranch={handleCopyBranchClick}
            prStatus={prStatus}
            runningProcess={runningProcess}
            canCreatePR={canCreatePR}
            onCreatePR={() => handleOpenPR(worktree)}
          />

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

          <WorktreeCardMenu
            worktree={worktree}
            isRoot={isRoot}
            canRebase={canRebase}
            detectedBaseBranch={detectedBaseBranch}
            hasDiff={hasDiff}
            hasBranch={hasBranch}
            isRebasing={isRebasing}
            isPushing={isPushing}
            isPulling={isPulling}
            onOpenFinder={() => handleOpenFinder(worktree.path)}
            onChangeBranch={onChangeBranch ? () => onChangeBranch(worktree) : undefined}
            onRebase={handleRebase}
            onQuickCommit={handleQuickCommit}
            onPush={() => void handlePush(false)}
            onForcePush={() => void handlePush(true)}
            onPull={() => void handlePull()}
            onViewCommits={handleViewCommits}
            onRunSetup={() => handleRunSetup(worktree)}
            onConfigureRunCommand={() => openRunModal(true)}
            onSyncWorktree={() => handleSyncWorktree(worktree)}
            onDelete={onDelete ? () => onDelete(worktree) : undefined}
          />
        </HStack>
      </HStack>
    </Box>
  )
}
