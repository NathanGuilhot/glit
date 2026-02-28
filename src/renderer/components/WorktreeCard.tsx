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
import type { WorktreeWithDiff } from '../../shared/types'
import { IDEIcon, TerminalIcon, TrashIcon, FolderIcon, DotsIcon, RefreshIcon, RebaseIcon, SyncIcon, PlayIcon, StopIcon, LogsIcon } from './Icons'
import { useWorktree } from '../contexts/WorktreeContext'
import { useAppActions } from '../contexts/AppActionsContext'
import { useAPI } from '../api'
import { ProcessLogDrawer } from './ProcessLogDrawer'
import { RunCommandModal } from './RunCommandModal'
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
  const { settings, prStatuses, repoInfo, detectedBaseBranch, runningProcesses } = useWorktree()
  const { handleCopyPath, handleCopyBranch, handleOpenTerminal, handleOpenIDE, handleOpenFinder, handleRunSetup, handleSyncWorktree } = useAppActions()
  const api = useAPI()
  const toast = useToast()
  const [branchJustCopied, setBranchJustCopied] = useState(false)
  const [isRebasing, setIsRebasing] = useState(false)

  const isRoot = repoInfo?.path === worktree.path
  const shortPath = worktree.displayPath ?? worktree.path
  const branchColor = getBranchColor(worktree.branch)
  const branchDisplayText = worktree.branch || '(no branch)'
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
        toast({ title: `Rebased onto ${detectedBaseBranch}`, status: 'success', duration: 3000 })
      } else {
        toast({
          title: result.hasConflicts ? 'Conflicts — resolve in your IDE' : 'Rebase failed',
          description: result.hasConflicts ? `Conflicts in ${worktree.branch}. Run \`git rebase --abort\` to cancel.` : result.error,
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

  const hasDiff = worktree.fileCount > 0

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
            <Tooltip label={branchJustCopied ? 'Copied!' : 'Click to copy branch'} placement="bottom" openDelay={200}>
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
                {branchJustCopied ? 'Copied!' : branchDisplayText}
              </Badge>
            </Tooltip>
            {isRoot && (
              <Badge colorScheme="green" variant="outline" fontSize="9px">
                root
              </Badge>
            )}
            {worktree.isLocked && (
              <Badge colorScheme="orange" variant="subtle" fontSize="9px">
                locked
              </Badge>
            )}
            {worktree.isStale && (
              <Badge colorScheme="yellow" variant="subtle" fontSize="9px">stale</Badge>
            )}
            {prStatus && (
              <Tooltip label={`PR #${prStatus.number} — click to open`} placement="bottom" openDelay={200}>
                <Badge
                  colorScheme={prStatus.state === 'OPEN' ? 'green' : prStatus.state === 'MERGED' ? 'purple' : 'gray'}
                  variant="subtle"
                  fontSize="9px"
                  cursor="pointer"
                  onClick={() => api.shell.openUrl(prStatus.url)}
                  _hover={{ opacity: 0.8 }}
                >
                  {prStatus.state === 'OPEN' ? '● Open' : prStatus.state === 'MERGED' ? '✓ Merged' : '⊘ Closed'}
                </Badge>
              </Tooltip>
            )}
            {runningProcess && (
              <Tooltip
                label={runningProcess.port ? `Open http://localhost:${runningProcess.port}` : 'Process running'}
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
                  ● {runningProcess.port ? `:${runningProcess.port}` : 'running'}
                </Badge>
              </Tooltip>
            )}
          </HStack>

          <Tooltip label="Click to copy path" placement="bottom" openDelay={200}>
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
                    {worktree.fileCount} file{worktree.fileCount !== 1 ? 's' : ''}
                  </Text>
                </>
              ) : (
                <Text fontSize="11px" color="whiteAlpha.300">clean</Text>
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
                <TooltipIconButton label="View logs" icon={<LogsIcon boxSize={4} color="whiteAlpha.800" />} onClick={handleOpenLogs} />
                <TooltipIconButton label="Stop process" icon={<StopIcon boxSize={3.5} color="red.400" />} onClick={handleStop} />
              </>
            ) : (
              <TooltipIconButton label="Run dev command" icon={<PlayIcon boxSize={3.5} color="whiteAlpha.800" />} onClick={() => void handleRun()} />
            )}
            <TooltipIconButton label={`Open in ${settings.preferredTerminal}`} icon={<TerminalIcon boxSize={4} color="whiteAlpha.800" />} onClick={() => handleOpenTerminal(worktree.path)} />
            <TooltipIconButton label={`Open in ${settings.preferredIDE}`} icon={<IDEIcon boxSize={4} color="whiteAlpha.800" />} onClick={() => handleOpenIDE(worktree.path)} />
          </HStack>

          <Menu>
            <MenuButton
              as={IconButton}
              aria-label="More actions"
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
                Open in Finder
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
                    Change branch
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
                    Rebase onto {detectedBaseBranch}
                  </MenuItem>
                </>
              )}
              <MenuItem
                icon={<RefreshIcon boxSize={4} color="whiteAlpha.700" />}
                onClick={() => handleRunSetup(worktree)}
                bg="transparent"
                _hover={{ bg: 'whiteAlpha.100' }}
                fontSize="sm"
              >
                Run setup
              </MenuItem>
              <MenuItem
                icon={<PlayIcon boxSize={4} color="whiteAlpha.700" />}
                onClick={() => openRunModal(true)}
                bg="transparent"
                _hover={{ bg: 'whiteAlpha.100' }}
                fontSize="sm"
              >
                Configure run command…
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
                    Sync working tree
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
                    Delete worktree
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
