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
  useColorModeValue,
} from '@chakra-ui/react'
import type { WorktreeWithDiff, AppSettings } from '../../shared/types'
import { CopyIcon, TerminalIcon, TrashIcon, FolderIcon, DotsIcon } from './Icons'

interface WorktreeCardProps {
  worktree: WorktreeWithDiff
  onCopyPath: (path: string) => void
  onCopyBranch: (branch: string) => void
  onOpenTerminal: (path: string) => void
  onOpenFinder: (path: string) => void
  onDelete: (worktree: WorktreeWithDiff) => void
  settings: AppSettings
}

function getBranchColor(branch: string): string {
  if (branch === 'main' || branch === 'master') return 'green'
  if (branch.startsWith('feature/') || branch.startsWith('feat/')) return 'blue'
  if (branch.startsWith('fix/') || branch.startsWith('bugfix/') || branch.startsWith('hotfix/')) return 'red'
  if (branch.startsWith('release/') || branch.startsWith('chore/')) return 'orange'
  if (branch.startsWith('detached:')) return 'gray'
  return 'purple'
}

function shortenPath(fullPath: string): string {
  const home = '/Users/'
  if (fullPath.startsWith(home)) {
    const afterHome = fullPath.slice(home.length)
    const slash = afterHome.indexOf('/')
    return slash === -1 ? '~/' + afterHome : '~/' + afterHome.slice(slash + 1)
  }
  return fullPath
}

export default function WorktreeCard({
  worktree,
  onCopyPath,
  onCopyBranch,
  onOpenTerminal,
  onOpenFinder,
  onDelete,
  settings,
}: WorktreeCardProps) {
  const [branchJustCopied, setBranchJustCopied] = useState(false)
  const bg = useColorModeValue('white', 'whiteAlpha.50')
  const borderColor = useColorModeValue('gray.200', 'whiteAlpha.100')
  const hoverBg = useColorModeValue('gray.50', 'whiteAlpha.100')

  const isMain = worktree.branch === 'main' || worktree.branch === 'master'
  const hasDiff = worktree.fileCount > 0
  const shortPath = shortenPath(worktree.path)
  const branchColor = getBranchColor(worktree.branch)
  const branchDisplayText = worktree.branch || '(no branch)'

  const handleCopyBranchClick = () => {
    onCopyBranch(branchDisplayText)
    setBranchJustCopied(true)
    setTimeout(() => setBranchJustCopied(false), 1500)
  }

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
      <HStack spacing={3} align="start">
        {/* Main info */}
        <VStack align="start" spacing={1} flex={1} minW={0}>
          {/* Branch + badges row */}
          <HStack spacing={2} flexWrap="wrap">
            <Tooltip label={branchJustCopied ? 'Copied!' : 'Click to copy branch'} placement="bottom" openDelay={500}>
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
            {isMain && (
              <Badge colorScheme="green" variant="outline" fontSize="9px">
                main
              </Badge>
            )}
            {worktree.isLocked && (
              <Badge colorScheme="orange" variant="subtle" fontSize="9px">
                locked
              </Badge>
            )}
          </HStack>

          {/* Path - click to copy */}
          <Tooltip label="Click to copy path" placement="bottom" openDelay={500}>
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
        </VStack>

        {/* Diff stats */}
        <HStack spacing={3} flexShrink={0} align="center">
          {hasDiff ? (
            <HStack spacing={2}>
              <Text fontSize="12px" color="green.400" fontFamily="mono" fontWeight="600">
                +{worktree.insertionCount}
              </Text>
              <Text fontSize="12px" color="red.400" fontFamily="mono" fontWeight="600">
                -{worktree.deletionCount}
              </Text>
              <Text fontSize="11px" color="whiteAlpha.400">
                {worktree.fileCount} file{worktree.fileCount !== 1 ? 's' : ''}
              </Text>
            </HStack>
          ) : (
            <Text fontSize="11px" color="whiteAlpha.300">clean</Text>
          )}

          {/* Quick actions */}
          <HStack spacing={0} opacity={0} _groupHover={{ opacity: 1 }} transition="opacity 0.15s">
            <Tooltip label={`Open in ${settings.preferredTerminal}`} placement="top">
              <IconButton
                aria-label="Open in terminal"
                icon={<TerminalIcon boxSize={4} color="whiteAlpha.800" />}
                size="xs"
                variant="ghost"
                colorScheme="whiteAlpha"
                onClick={() => onOpenTerminal(worktree.path)}
              />
            </Tooltip>
            <Tooltip label="Copy path" placement="top">
              <IconButton
                aria-label="Copy path"
                icon={<CopyIcon boxSize={4} color="whiteAlpha.800" />}
                size="xs"
                variant="ghost"
                colorScheme="whiteAlpha"
                onClick={() => onCopyPath(worktree.path)}
              />
            </Tooltip>
          </HStack>

          {/* More menu */}
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
              {!isMain && (
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
