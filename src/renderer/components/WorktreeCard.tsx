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
import type { WorktreeWithDiff, IDEOption, TerminalOption, PRStatus } from '../../shared/types'
import { IDEIcon, TerminalIcon, TrashIcon, FolderIcon, DotsIcon, RefreshIcon, RebaseIcon } from './Icons'
import { useWorktree } from '../contexts/WorktreeContext'
import { useAppActions } from '../contexts/AppActionsContext'
import { useAPI } from '../api'

interface WorktreeCardProps {
  worktree: WorktreeWithDiff
  onDelete?: (worktree: WorktreeWithDiff) => void
  onChangeBranch?: (worktree: WorktreeWithDiff) => void
  isMerged?: boolean
}

function CardContent({
  worktree,
  branchColor,
  branchDisplayText,
  branchJustCopied,
  isMain,
  isMerged,
  isRoot,
  prStatus,
  shortPath,
  preferredTerminal,
  preferredIDE,
  onCopyBranchClick,
  onCopyPath,
  onOpenTerminal,
  onOpenIDE,
  onOpenFinder,
  onOpenUrl,
  onRunSetup,
  onDelete,
  onChangeBranch,
  onRebase,
  rebaseBranch,
  isRebasing,
}: {
  worktree: WorktreeWithDiff
  branchColor: string
  branchDisplayText: string
  branchJustCopied: boolean
  isMain: boolean
  isRoot: boolean
  isMerged?: boolean
  prStatus?: PRStatus | null
  shortPath: string
  preferredTerminal: TerminalOption
  preferredIDE: IDEOption
  onCopyBranchClick: () => void
  onCopyPath: (path: string) => void
  onOpenTerminal: (path: string) => void
  onOpenIDE: (path: string) => void
  onOpenFinder: (path: string) => void
  onOpenUrl: (url: string) => void
  onRunSetup: () => void
  onDelete?: () => void
  onChangeBranch?: () => void
  onRebase?: () => void
  rebaseBranch?: string
  isRebasing?: boolean
}) {
  const bg = 'whiteAlpha.50'
  const borderColor = isMerged ? 'orange.500' : 'whiteAlpha.100'
  const hoverBg = 'whiteAlpha.100'
  const hasDiff = worktree.fileCount > 0

  return (
    <Box
      bg={bg}
      border="1px solid"
      borderColor={borderColor}
      borderRadius="lg"
      px={4}
      py={3}
      _hover={{ bg: hoverBg, borderColor: 'whiteAlpha.200' }}
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
                onClick={onCopyBranchClick}
                transition="opacity 0.1s"
              >
                {branchJustCopied ? 'Copied!' : branchDisplayText}
              </Badge>
            </Tooltip>
            {isMain && (
              <Badge colorScheme="green" variant="outline" fontSize="9px">
                root
              </Badge>
            )}
            {isMerged && (
              <Badge colorScheme="orange" variant="subtle" fontSize="9px">
                merged
              </Badge>
            )}
            {worktree.isLocked && (
              <Badge colorScheme="orange" variant="subtle" fontSize="9px">
                locked
              </Badge>
            )}
            {prStatus && (
              <Tooltip label={`PR #${prStatus.number} — click to open`} placement="bottom" openDelay={200}>
                <Badge
                  colorScheme={prStatus.state === 'OPEN' ? 'green' : prStatus.state === 'MERGED' ? 'purple' : 'gray'}
                  variant="subtle"
                  fontSize="9px"
                  cursor="pointer"
                  onClick={() => onOpenUrl(prStatus.url)}
                  _hover={{ opacity: 0.8 }}
                >
                  {prStatus.state === 'OPEN' ? '● Open' : prStatus.state === 'MERGED' ? '✓ Merged' : '⊘ Closed'}
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
              onClick={() => onCopyPath(worktree.path)}
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
            <Tooltip label={`Open in ${preferredTerminal}`} placement="top" openDelay={200}>
              <IconButton
                aria-label="Open in terminal"
                icon={<TerminalIcon boxSize={4} color="whiteAlpha.800" />}
                size="xs"
                variant="ghost"
                colorScheme="whiteAlpha"
                onClick={() => onOpenTerminal(worktree.path)}
              />
            </Tooltip>
            <Tooltip label={`Open in ${preferredIDE}`} placement="top" openDelay={200}>
              <IconButton
                aria-label="Open in IDE"
                icon={<IDEIcon boxSize={4} color="whiteAlpha.800" />}
                size="xs"
                variant="ghost"
                colorScheme="whiteAlpha"
                onClick={() => onOpenIDE(worktree.path)}
              />
            </Tooltip>
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
                onClick={() => onOpenFinder(worktree.path)}
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
                    onClick={() => onChangeBranch()}
                    bg="transparent"
                    _hover={{ bg: 'whiteAlpha.100' }}
                    fontSize="sm"
                  >
                    Change branch
                  </MenuItem>
                </>
              )}
              {isRoot && onRebase && rebaseBranch && (
                <>
                  <MenuDivider borderColor="whiteAlpha.100" />
                  <MenuItem
                    icon={isRebasing ? <Spinner size="xs" /> : <RebaseIcon boxSize={4} color="whiteAlpha.700" />}
                    onClick={onRebase}
                    isDisabled={isRebasing}
                    bg="transparent"
                    _hover={{ bg: 'whiteAlpha.100' }}
                    fontSize="sm"
                  >
                    Rebase onto {rebaseBranch}
                  </MenuItem>
                </>
              )}
              <MenuItem
                icon={<RefreshIcon boxSize={4} color="whiteAlpha.700" />}
                onClick={onRunSetup}
                bg="transparent"
                _hover={{ bg: 'whiteAlpha.100' }}
                fontSize="sm"
              >
                Run setup
              </MenuItem>
              {!isMain && onDelete && (
                <>
                  <MenuDivider borderColor="whiteAlpha.100" />
                  <MenuItem
                    icon={<TrashIcon boxSize={4} color="red.400" />}
                    onClick={() => onDelete()}
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

function getBranchColor(branch: string): string {
  if (branch === 'main' || branch === 'master') return 'green'
  return 'gray'
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

export default function WorktreeCard({ worktree, onDelete, onChangeBranch, isMerged }: WorktreeCardProps) {
  const { settings, prStatuses, repoInfo, detectedBaseBranch } = useWorktree()
  const { handleCopyPath, handleCopyBranch, handleOpenTerminal, handleOpenIDE, handleOpenFinder, handleRunSetup } = useAppActions()
  const api = useAPI()
  const toast = useToast()
  const [branchJustCopied, setBranchJustCopied] = useState(false)
  const [isRebasing, setIsRebasing] = useState(false)

  const isRoot = repoInfo?.path === worktree.path
  const isMain = isRoot
  const shortPath = worktree.displayPath ?? worktree.path
  const branchColor = getBranchColor(worktree.branch)
  const branchDisplayText = worktree.branch || '(no branch)'

  const canRebase =
    isRoot &&
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
    if (!repoInfo || !detectedBaseBranch) return
    setIsRebasing(true)
    try {
      const result = await api.branch.rebaseOnto(repoInfo.path, detectedBaseBranch)
      if (result.success) {
        toast({ title: `Rebased onto ${detectedBaseBranch}`, status: 'success', duration: 3000 })
      } else {
        toast({
          title: 'Rebase failed',
          description: result.error,
          status: 'error',
          duration: 5000,
          isClosable: true,
        })
      }
    } finally {
      setIsRebasing(false)
    }
  }

  return (
    <CardContent
      worktree={worktree}
      branchColor={branchColor}
      branchDisplayText={branchDisplayText}
      branchJustCopied={branchJustCopied}
      isMain={isMain}
      isRoot={isRoot}
      isMerged={isMerged}
      prStatus={prStatuses[worktree.path]}
      shortPath={shortPath}
      preferredTerminal={settings.preferredTerminal}
      preferredIDE={settings.preferredIDE}
      onCopyBranchClick={handleCopyBranchClick}
      onCopyPath={handleCopyPath}
      onOpenTerminal={handleOpenTerminal}
      onOpenIDE={handleOpenIDE}
      onOpenFinder={handleOpenFinder}
      onOpenUrl={api.shell.openUrl}
      onRunSetup={() => handleRunSetup(worktree)}
      onDelete={onDelete ? () => onDelete(worktree) : undefined}
      onChangeBranch={onChangeBranch ? () => onChangeBranch(worktree) : undefined}
      onRebase={canRebase ? handleRebase : undefined}
      rebaseBranch={detectedBaseBranch ?? undefined}
      isRebasing={isRebasing}
    />
  )
}
