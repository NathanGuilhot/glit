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

interface WorktreeCardProps {
  worktree: WorktreeWithDiff
  onCopyPath: (path: string) => void
  onOpenTerminal: (path: string) => void
  onOpenFinder: (path: string) => void
  onDelete: (worktree: WorktreeWithDiff) => void
  settings: AppSettings
}

const CopyIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
  </svg>
)

const TerminalIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="4 17 10 11 4 5"></polyline>
    <line x1="12" y1="19" x2="20" y2="19"></line>
  </svg>
)

const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"></polyline>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>
  </svg>
)

const FolderIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
  </svg>
)

const DotsIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="5" r="1"></circle>
    <circle cx="12" cy="12" r="1"></circle>
    <circle cx="12" cy="19" r="1"></circle>
  </svg>
)

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
  onOpenTerminal,
  onOpenFinder,
  onDelete,
  settings,
}: WorktreeCardProps) {
  const bg = useColorModeValue('white', 'whiteAlpha.50')
  const borderColor = useColorModeValue('gray.200', 'whiteAlpha.100')
  const hoverBg = useColorModeValue('gray.50', 'whiteAlpha.100')

  const isMain = worktree.branch === 'main' || worktree.branch === 'master'
  const hasDiff = worktree.fileCount > 0
  const shortPath = shortenPath(worktree.path)
  const branchColor = getBranchColor(worktree.branch)

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
            <Badge colorScheme={branchColor} variant="subtle" fontSize="xs" px={2} py={0.5}>
              {worktree.branch || '(no branch)'}
            </Badge>
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
                icon={<TerminalIcon />}
                size="xs"
                variant="ghost"
                colorScheme="whiteAlpha"
                onClick={() => onOpenTerminal(worktree.path)}
              />
            </Tooltip>
            <Tooltip label="Copy path" placement="top">
              <IconButton
                aria-label="Copy path"
                icon={<CopyIcon />}
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
              icon={<DotsIcon />}
              size="xs"
              variant="ghost"
              colorScheme="whiteAlpha"
            />
            <MenuList bg="gray.800" borderColor="whiteAlpha.100" minW="180px" py={1}>
              <MenuItem
                icon={<TerminalIcon />}
                onClick={() => onOpenTerminal(worktree.path)}
                bg="transparent"
                _hover={{ bg: 'whiteAlpha.100' }}
                fontSize="sm"
              >
                Open in {settings.preferredTerminal}
              </MenuItem>
              <MenuItem
                icon={<CopyIcon />}
                onClick={() => onCopyPath(worktree.path)}
                bg="transparent"
                _hover={{ bg: 'whiteAlpha.100' }}
                fontSize="sm"
              >
                Copy path
              </MenuItem>
              <MenuItem
                icon={<FolderIcon />}
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
                    icon={<TrashIcon />}
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
