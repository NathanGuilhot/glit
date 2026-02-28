import { Box, HStack, VStack, Badge, IconButton, Tooltip, Spinner, Button, Menu, MenuButton, MenuList, MenuItem, MenuDivider, Text } from '@chakra-ui/react'
import { RefreshIcon, SettingsIcon, PlusIcon, ChevronDownIcon } from './Icons'
import { useWorktree } from '../contexts/WorktreeContext'
import { useAPI } from '../api'

interface HeaderProps {
  onOpenCreate: () => void
  onOpenSettings: () => void
  onOpenCleanup: () => void
  onOpenCleanBranches: () => void
  cleanupMode?: boolean
  hasMergedPRWorktrees?: boolean
}

export default function Header({ onOpenCreate, onOpenSettings, onOpenCleanup, onOpenCleanBranches, cleanupMode, hasMergedPRWorktrees }: HeaderProps) {
  const { repoInfo, worktrees, refreshing, refresh, recentRepos, switchRepo, switching } = useWorktree()
  const api = useAPI()

  return (
    <Box px={5} pb={3} flexShrink={0}>
      <HStack justify="space-between" align="center" flexWrap="wrap" gap={2}>
        <HStack spacing={2} minW={0} flex={1}>
          {repoInfo && (
            <HStack spacing={2}>
              <Menu isLazy placement="bottom-start">
                <MenuButton
                  as={Button}
                  size="xs"
                  variant="ghost"
                  px={1}
                  height="auto"
                  fontFamily="mono"
                  fontSize="11px"
                  color="whiteAlpha.500"
                  fontWeight="normal"
                  rightIcon={switching ? <Spinner size="xs" /> : <ChevronDownIcon boxSize={3} />}
                  isDisabled={switching}
                  _hover={{ color: 'whiteAlpha.800' }}
                >
                  {repoInfo.displayPath ?? repoInfo.path}
                </MenuButton>
                <MenuList>
                  {recentRepos.length === 0 ? (
                    <MenuItem isDisabled fontSize="sm">No recent repos</MenuItem>
                  ) : (
                    recentRepos.map((repo) => {
                      const isCurrent = repo.path === repoInfo.path
                      return (
                        <MenuItem
                          key={repo.path}
                          isDisabled={isCurrent}
                          onClick={() => switchRepo(repo.path)}
                        >
                          <VStack align="start" spacing={0}>
                            <HStack spacing={2}>
                              <Text fontWeight={isCurrent ? 'bold' : 'normal'} fontSize="sm">{repo.name}</Text>
                              {isCurrent && <Badge colorScheme="green" fontSize="9px" variant="subtle">current</Badge>}
                            </HStack>
                            <Text fontSize="10px" fontFamily="mono" color="whiteAlpha.500">{repo.displayPath}</Text>
                          </VStack>
                        </MenuItem>
                      )
                    })
                  )}
                  <MenuDivider />
                  <MenuItem
                    fontSize="sm"
                    onClick={async () => {
                      const picked = await api.dialog.pickFolder()
                      if (picked) await switchRepo(picked)
                    }}
                  >
                    Open other repo…
                  </MenuItem>
                </MenuList>
              </Menu>
              <Badge colorScheme="green" fontSize="9px" variant="subtle">
                {worktrees.length} worktree{worktrees.length !== 1 ? 's' : ''}
              </Badge>
            </HStack>
          )}
        </HStack>
        <HStack spacing={1}>
          {!cleanupMode && hasMergedPRWorktrees && (
            <Button size="sm" variant="ghost" colorScheme="orange" onClick={onOpenCleanup}>
              Clean up
            </Button>
          )}
          <Button size="sm" variant="ghost" colorScheme="red" onClick={onOpenCleanBranches}>
            Clean branches
          </Button>
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
