import { useMemo } from 'react'
import {
  Box,
  VStack,
  HStack,
  Text,
  Checkbox,
  Input,
  InputGroup,
  InputLeftElement,
  Textarea,
  Button,
  Tooltip,
} from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'
import type { FileStatusWithStats } from '../../../shared/types'

const statusColors: Record<string, string> = {
  modified: 'yellow.300',
  added: 'green.300',
  deleted: 'red.300',
  renamed: 'blue.300',
  untracked: 'green.300',
  copied: 'blue.300',
}

const statusLabels: Record<string, string> = {
  modified: 'M',
  added: 'A',
  deleted: 'D',
  renamed: 'R',
  untracked: '?',
  copied: 'C',
}

interface FileListPanelProps {
  files: FileStatusWithStats[]
  selectedFiles: Set<string>
  activeFile: string | null
  fileFilter: string
  commitMessage: string
  committing: boolean
  onToggleFile: (path: string) => void
  onToggleAll: () => void
  onSelectFile: (path: string) => void
  onFilterChange: (filter: string) => void
  onCommitMessageChange: (message: string) => void
  onCommit: () => void
}

export function FileListPanel({
  files,
  selectedFiles,
  activeFile,
  fileFilter,
  commitMessage,
  committing,
  onToggleFile,
  onToggleAll,
  onSelectFile,
  onFilterChange,
  onCommitMessageChange,
  onCommit,
}: FileListPanelProps) {
  const { t } = useTranslation()

  const filteredFiles = useMemo(() => {
    if (!fileFilter) return files
    const lower = fileFilter.toLowerCase()
    return files.filter(f => f.path.toLowerCase().includes(lower))
  }, [files, fileFilter])

  const allSelected = selectedFiles.size === files.length && files.length > 0

  return (
    <VStack
      w="280px"
      minW="280px"
      h="full"
      minH={0}
      spacing={0}
      borderRight="1px solid"
      borderColor="whiteAlpha.100"
      bg="gray.900"
      overflow="hidden"
    >
      {/* Search */}
      <Box w="full" p={2} borderBottom="1px solid" borderColor="whiteAlpha.100">
        <InputGroup size="sm">
          <InputLeftElement pointerEvents="none" h="full">
            <Text fontSize="xs" color="whiteAlpha.400">/</Text>
          </InputLeftElement>
          <Input
            value={fileFilter}
            onChange={e => onFilterChange(e.target.value)}
            placeholder={t('codeReview.filterFiles')}
            fontSize="xs"
            bg="whiteAlpha.50"
            borderColor="whiteAlpha.100"
            _focus={{ borderColor: 'brand.400', boxShadow: 'none' }}
            _placeholder={{ color: 'whiteAlpha.300' }}
          />
        </InputGroup>
      </Box>

      {/* Select all + count */}
      <HStack w="full" px={3} py={1.5} justify="space-between" borderBottom="1px solid" borderColor="whiteAlpha.100">
        <Text
          fontSize="11px"
          color="brand.300"
          cursor="pointer"
          _hover={{ textDecoration: 'underline' }}
          onClick={onToggleAll}
        >
          {allSelected ? t('codeReview.deselectAll') : t('codeReview.selectAll')}
        </Text>
        <Text fontSize="10px" color="whiteAlpha.400">
          {selectedFiles.size}/{files.length} {t('codeReview.files')}
        </Text>
      </HStack>

      {/* File list */}
      <Box flex={1} w="full" overflowY="auto" overflowX="hidden" minH={0}>
        {filteredFiles.map(file => {
          const isActive = activeFile === file.path
          const basename = file.path.split('/').pop() ?? file.path
          const dirname = file.path.includes('/') ? file.path.slice(0, file.path.lastIndexOf('/')) : ''

          return (
            <HStack
              key={file.path}
              px={2}
              py={1.5}
              spacing={2}
              cursor="pointer"
              bg={isActive ? 'whiteAlpha.100' : 'transparent'}
              borderLeft={isActive ? '2px solid' : '2px solid transparent'}
              borderLeftColor={isActive ? 'brand.400' : 'transparent'}
              _hover={{ bg: isActive ? 'whiteAlpha.100' : 'whiteAlpha.50' }}
              onClick={() => onSelectFile(file.path)}
              transition="all 0.1s"
            >
              <Checkbox
                isChecked={selectedFiles.has(file.path)}
                onChange={e => {
                  e.stopPropagation()
                  onToggleFile(file.path)
                }}
                onClick={e => e.stopPropagation()}
                size="sm"
                colorScheme="brand"
              />
              <Text
                fontSize="10px"
                fontFamily="mono"
                fontWeight="600"
                color={statusColors[file.status] ?? 'whiteAlpha.500'}
                w="12px"
                textAlign="center"
                flexShrink={0}
              >
                {statusLabels[file.status] ?? '?'}
              </Text>
              <Tooltip
                label={file.path}
                openDelay={400}
                placement="right"
                hasArrow
                fontSize="xs"
                fontFamily="mono"
              >
                <VStack align="start" spacing={0} flex={1} minW={0}>
                  <Text fontSize="11px" fontFamily="mono" color="whiteAlpha.800" noOfLines={1}>
                    {basename}
                  </Text>
                  {dirname && (
                    <Text fontSize="9px" fontFamily="mono" color="whiteAlpha.400" noOfLines={1}>
                      {dirname}
                    </Text>
                  )}
                </VStack>
              </Tooltip>
              <HStack spacing={1} flexShrink={0}>
                {file.additions > 0 && (
                  <Text fontSize="10px" fontFamily="mono" color="green.400">+{file.additions}</Text>
                )}
                {file.deletions > 0 && (
                  <Text fontSize="10px" fontFamily="mono" color="red.400">-{file.deletions}</Text>
                )}
              </HStack>
            </HStack>
          )
        })}
      </Box>

      {/* Commit area */}
      <VStack w="full" p={2} spacing={2} borderTop="1px solid" borderColor="whiteAlpha.100" flexShrink={0}>
        <Textarea
          value={commitMessage}
          onChange={e => onCommitMessageChange(e.target.value)}
          placeholder={t('codeReview.messagePlaceholder')}
          fontSize="xs"
          bg="whiteAlpha.50"
          borderColor="whiteAlpha.100"
          _focus={{ borderColor: 'brand.400', boxShadow: 'none' }}
          _placeholder={{ color: 'whiteAlpha.300' }}
          rows={3}
          resize="none"
        />
        <Button
          w="full"
          size="sm"
          colorScheme="brand"
          onClick={onCommit}
          isDisabled={!commitMessage.trim() || selectedFiles.size === 0 || committing}
          isLoading={committing}
          loadingText={t('codeReview.committing')}
        >
          {t('codeReview.commitCount', { count: selectedFiles.size })}
        </Button>
      </VStack>
    </VStack>
  )
}
