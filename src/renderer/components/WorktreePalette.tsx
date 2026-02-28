import { useState, useCallback, useRef, useEffect } from 'react'
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalBody,
  Input,
  Box,
  HStack,
  Text,
  InputGroup,
  InputLeftElement,
} from '@chakra-ui/react'
import type { WorktreeWithDiff } from '../../shared/types'

interface WorktreePaletteProps {
  worktrees: WorktreeWithDiff[]
  onOpenTerminal: (path: string) => Promise<void>
  onOpenIDE: (path: string) => Promise<void>
  onOpenCreate: (initialBranch: string) => void
  onClose: () => void
}

function scoreWorktree(wt: WorktreeWithDiff, q: string): number {
  const branch = wt.branch.toLowerCase()
  const path = wt.path.toLowerCase()
  if (branch === q) return 4
  if (branch.startsWith(q)) return 3
  if (branch.includes(q)) return 2
  if (path.includes(q)) return 1
  return 0
}

export default function WorktreePalette({
  worktrees,
  onOpenTerminal,
  onOpenIDE,
  onOpenCreate,
  onClose,
}: WorktreePaletteProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  const q = query.trim().toLowerCase()
  const filteredWorktrees = q === ''
    ? worktrees
    : worktrees.filter(wt => scoreWorktree(wt, q) > 0).sort((a, b) => scoreWorktree(b, q) - scoreWorktree(a, q))

  const showCreate = q !== ''
  const totalItems = filteredWorktrees.length + (showCreate ? 1 : 0)

  useEffect(() => {
    if (selectedIndex >= totalItems && totalItems > 0) {
      setSelectedIndex(totalItems - 1)
    }
  }, [totalItems, selectedIndex])

  useEffect(() => {
    if (!listRef.current) return
    const selectedEl = listRef.current.querySelector('[data-selected="true"]')
    selectedEl?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(i => totalItems > 0 ? (i + 1) % totalItems : 0)
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(i => totalItems > 0 ? (i - 1 + totalItems) % totalItems : 0)
        break
      case 'Enter': {
        e.preventDefault()
        if (showCreate && selectedIndex === filteredWorktrees.length) {
          onOpenCreate(query.trim())
          onClose()
        } else {
          const wt = filteredWorktrees[selectedIndex]
          if (wt) {
            if (e.metaKey) {
              void onOpenIDE(wt.path)
            } else {
              void onOpenTerminal(wt.path)
            }
            onClose()
          }
        }
        break
      }
    }
  }, [query, selectedIndex, filteredWorktrees, showCreate, totalItems, onOpenTerminal, onOpenIDE, onOpenCreate, onClose])

  return (
    <Modal isOpen onClose={onClose} size="xl" isCentered>
      <ModalOverlay backdropFilter="blur(4px)" bg="blackAlpha.700" />
      <ModalContent bg="gray.800" borderColor="whiteAlpha.100" border="1px solid" overflow="hidden">
        <ModalBody p={0}>
          <InputGroup>
            <InputLeftElement pointerEvents="none" h="full" pl={2}>
              <Text color="whiteAlpha.400" fontSize="sm">🔍</Text>
            </InputLeftElement>
            <Input
              value={query}
              onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0) }}
              onKeyDown={handleKeyDown}
              placeholder="Filter or type branch name…"
              autoFocus
              variant="unstyled"
              pl={9}
              pr={4}
              py={4}
              fontSize="sm"
              fontFamily="mono"
              borderBottom="1px solid"
              borderColor="whiteAlpha.100"
              borderRadius={0}
              _placeholder={{ color: 'whiteAlpha.400' }}
            />
          </InputGroup>

          <Box ref={listRef} maxH="360px" overflowY="auto">
            {filteredWorktrees.map((wt, i) => {
              const isSelected = i === selectedIndex
              return (
                <Box
                  key={wt.path}
                  data-selected={isSelected ? 'true' : undefined}
                  px={4}
                  py={2.5}
                  bg={isSelected ? 'brand.900' : 'transparent'}
                  borderLeft="2px solid"
                  borderColor={isSelected ? 'brand.400' : 'transparent'}
                  cursor="pointer"
                  onClick={() => { void onOpenTerminal(wt.path); onClose() }}
                  onMouseEnter={() => setSelectedIndex(i)}
                  _hover={{ bg: isSelected ? 'brand.900' : 'whiteAlpha.50' }}
                >
                  <HStack justify="space-between" spacing={3}>
                    <HStack spacing={3} flex={1} minW={0}>
                      <Text
                        fontSize="sm"
                        fontFamily="mono"
                        fontWeight={isSelected ? '600' : 'normal'}
                        color={isSelected ? 'white' : 'whiteAlpha.800'}
                        flexShrink={0}
                      >
                        {wt.branch}
                      </Text>
                      <Text fontSize="xs" fontFamily="mono" color="whiteAlpha.400" isTruncated>
                        {wt.displayPath || wt.path}
                      </Text>
                    </HStack>
                    <HStack spacing={2} flexShrink={0}>
                      {wt.aheadCount > 0 && (
                        <Text fontSize="xs" color="green.400" fontFamily="mono">↑{wt.aheadCount}</Text>
                      )}
                      {wt.behindCount > 0 && (
                        <Text fontSize="xs" color="orange.400" fontFamily="mono">↓{wt.behindCount}</Text>
                      )}
                      {wt.fileCount > 0 && (
                        <Text fontSize="xs" color="whiteAlpha.500" fontFamily="mono">+{wt.fileCount} files</Text>
                      )}
                    </HStack>
                  </HStack>
                </Box>
              )
            })}

            {showCreate && (
              <Box
                data-selected={selectedIndex === filteredWorktrees.length ? 'true' : undefined}
                px={4}
                py={2.5}
                bg={selectedIndex === filteredWorktrees.length ? 'brand.900' : 'transparent'}
                borderLeft="2px solid"
                borderColor={selectedIndex === filteredWorktrees.length ? 'brand.400' : 'transparent'}
                cursor="pointer"
                onClick={() => { onOpenCreate(query.trim()); onClose() }}
                onMouseEnter={() => setSelectedIndex(filteredWorktrees.length)}
                _hover={{ bg: selectedIndex === filteredWorktrees.length ? 'brand.900' : 'whiteAlpha.50' }}
              >
                <Text fontSize="sm" color={selectedIndex === filteredWorktrees.length ? 'white' : 'whiteAlpha.600'}>
                  + Create new worktree "{query.trim()}"
                </Text>
              </Box>
            )}
          </Box>

          <Box px={4} py={2} borderTop="1px solid" borderColor="whiteAlpha.50">
            <HStack spacing={4} justify="center">
              {[['↑↓', 'navigate'], ['↵', 'terminal'], ['⌘↵', 'IDE'], ['esc', 'close']].map(([key, label]) => (
                <HStack key={key} spacing={1}>
                  <Text
                    fontSize="10px"
                    fontFamily="mono"
                    bg="whiteAlpha.100"
                    px={1.5}
                    py={0.5}
                    borderRadius="sm"
                    color="whiteAlpha.600"
                  >
                    {key}
                  </Text>
                  <Text fontSize="10px" color="whiteAlpha.400">{label}</Text>
                </HStack>
              ))}
            </HStack>
          </Box>
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}
