import { Box, HStack, VStack, Heading, Text, Badge, IconButton, Tooltip, Spinner } from '@chakra-ui/react'
import { RefreshIcon, SettingsIcon, PlusIcon } from './Icons'
import { useWorktree } from '../contexts/WorktreeContext'

interface HeaderProps {
  onOpenCreate: () => void
  onOpenSettings: () => void
}

export default function Header({ onOpenCreate, onOpenSettings }: HeaderProps) {
  const { repoInfo, worktrees, refreshing, refresh } = useWorktree()

  return (
    <Box px={5} pb={3} flexShrink={0}>
      <HStack justify="space-between" align="center" flexWrap="wrap" gap={2}>
        <VStack align="start" spacing={0} minW={0} flex={1}>
          <Heading size="sm" fontWeight="700" letterSpacing="-0.02em">
            Glit ·.°
          </Heading>
          {repoInfo && (
            <HStack spacing={2}>
              <Text fontSize="11px" color="whiteAlpha.500" fontFamily="mono" noOfLines={1}>
                {repoInfo.displayPath ?? repoInfo.path}
              </Text>
              <Badge colorScheme="green" fontSize="9px" variant="subtle">
                {worktrees.length} worktree{worktrees.length !== 1 ? 's' : ''}
              </Badge>
            </HStack>
          )}
        </VStack>
        <HStack spacing={1}>
          <Tooltip label="New worktree (c)" placement="bottom">
            <IconButton
              aria-label="Create worktree"
              icon={<PlusIcon />}
              size="sm"
              variant="ghost"
              colorScheme="brand"
              onClick={onOpenCreate}
            />
          </Tooltip>
          <Tooltip label="Refresh (r)" placement="bottom">
            <IconButton
              aria-label="Refresh"
              icon={refreshing ? <Spinner size="xs" /> : <RefreshIcon />}
              size="sm"
              variant="ghost"
              onClick={refresh}
              isDisabled={refreshing}
            />
          </Tooltip>
          <Tooltip label="Settings (⌘,)" placement="bottom">
            <IconButton
              aria-label="Settings"
              icon={<SettingsIcon />}
              size="sm"
              variant="ghost"
              onClick={onOpenSettings}
            />
          </Tooltip>
        </HStack>
      </HStack>
    </Box>
  )
}
