import { useEffect, useState } from 'react'
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  Button,
  Textarea,
  VStack,
  HStack,
  Text,
  Badge,
  Checkbox,
  Spinner,
  Box,
  Tooltip,
  useToast,
} from '@chakra-ui/react'
import NiceModal, { useModal } from '@ebay/nice-modal-react'
import { useTranslation } from 'react-i18next'
import type { GitFileStatus } from '../../shared/types'
import { useAPI } from '../api'
import { useWorktree } from '../contexts/WorktreeContext'
import { truncateMiddle } from '../utils'

interface QuickCommitModalProps {
  worktreePath: string
  branch: string
}

const statusColors: Record<GitFileStatus['status'], string> = {
  modified: 'yellow.300',
  added: 'green.300',
  deleted: 'red.300',
  renamed: 'blue.300',
  untracked: 'green.300',
  copied: 'blue.300',
}

const statusLabels: Record<GitFileStatus['status'], string> = {
  modified: 'M',
  added: 'A',
  deleted: 'D',
  renamed: 'R',
  untracked: '?',
  copied: 'C',
}

export const QuickCommitModal = NiceModal.create<QuickCommitModalProps>(({ worktreePath, branch }) => {
  const modal = useModal()
  const api = useAPI()
  const toast = useToast()
  const { t } = useTranslation()
  const { refresh } = useWorktree()
  const [files, setFiles] = useState<GitFileStatus[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [committing, setCommitting] = useState(false)

  useEffect(() => {
    setLoading(true)
    api.git.status(worktreePath).then((result) => {
      setFiles(result)
      setSelected(new Set(result.map((f) => f.path)))
    }).catch(() => {
      setFiles([])
    }).finally(() => setLoading(false))
  }, [api, worktreePath])

  const allSelected = selected.size === files.length && files.length > 0
  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(files.map((f) => f.path)))
    }
  }

  const toggleFile = (path: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const handleCommit = async () => {
    if (!message.trim() || selected.size === 0) return
    setCommitting(true)
    try {
      const result = await api.git.commit(worktreePath, Array.from(selected), message.trim())
      if (result.success) {
        toast({ title: t('quickCommit.toast.committed'), status: 'success', duration: 3000 })
        modal.hide()
        void refresh()
      } else {
        toast({ title: t('quickCommit.toast.commitFailed'), description: result.error, status: 'error', duration: 5000, isClosable: true })
      }
    } finally {
      setCommitting(false)
    }
  }

  return (
    <Modal isOpen={modal.visible} onClose={modal.hide} size="lg">
      <ModalOverlay />
      <ModalContent bg="gray.800" borderColor="whiteAlpha.100" border="1px solid">
        <ModalHeader fontSize="md" pb={2}>
          <HStack spacing={2}>
            <Text>{t('quickCommit.title')}</Text>
            <Badge colorScheme="gray" variant="subtle" fontSize="xs" fontFamily="mono" maxW="240px" isTruncated>
              {branch}
            </Badge>
          </HStack>
        </ModalHeader>
        <ModalCloseButton color="whiteAlpha.600" />
        <ModalBody pb={2}>
          {loading ? (
            <HStack justify="center" py={4}>
              <Spinner size="sm" color="brand.400" />
            </HStack>
          ) : files.length === 0 ? (
            <Text fontSize="sm" color="whiteAlpha.500" textAlign="center" py={4}>
              {t('quickCommit.noChanges')}
            </Text>
          ) : (
            <VStack align="start" spacing={3}>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t('quickCommit.messagePlaceholder')}
                fontSize="sm"
                bg="gray.900"
                borderColor="whiteAlpha.200"
                _focus={{ borderColor: 'brand.400', boxShadow: 'none' }}
                rows={3}
                resize="vertical"
                autoFocus
              />
              <HStack justify="space-between" w="full">
                <Text
                  fontSize="11px"
                  color="brand.300"
                  cursor="pointer"
                  _hover={{ textDecoration: 'underline' }}
                  onClick={toggleAll}
                >
                  {allSelected ? t('quickCommit.deselectAll') : t('quickCommit.selectAll')}
                </Text>
                <Text fontSize="11px" color="whiteAlpha.400">
                  {selected.size}/{files.length}
                </Text>
              </HStack>
              <Box w="full" maxH="250px" overflowY="auto" borderRadius="md" bg="gray.900" border="1px solid" borderColor="whiteAlpha.100">
                {files.map((file) => (
                  <HStack
                    key={`${file.path}-${file.staged}`}
                    px={3}
                    py={1.5}
                    spacing={2}
                    _hover={{ bg: 'whiteAlpha.50' }}
                    cursor="pointer"
                    onClick={() => toggleFile(file.path)}
                  >
                    <Checkbox
                      isChecked={selected.has(file.path)}
                      onChange={() => toggleFile(file.path)}
                      size="sm"
                      colorScheme="brand"
                    />
                    <Text fontSize="xs" fontFamily="mono" fontWeight="600" color={statusColors[file.status]} w="14px" textAlign="center">
                      {statusLabels[file.status]}
                    </Text>
                    <Tooltip
                      label={file.oldPath ? `${file.oldPath} → ${file.path}` : file.path}
                      openDelay={200}
                      placement="top"
                      hasArrow
                      fontSize="xs"
                      fontFamily="mono"
                    >
                      <Text
                        fontSize="xs"
                        fontFamily="mono"
                        color="whiteAlpha.800"
                        flex={1}
                        cursor="pointer"
                        _hover={{ textDecoration: 'underline' }}
                        onClick={(e) => {
                          e.stopPropagation()
                          const fullPath = file.oldPath ? `${file.oldPath} → ${file.path}` : file.path
                          void navigator.clipboard.writeText(fullPath)
                          toast({ title: t('quickCommit.pathCopied', 'Path copied'), status: 'info', duration: 1500 })
                        }}
                      >
                        {file.oldPath
                          ? `${truncateMiddle(file.oldPath, 22)} → ${truncateMiddle(file.path, 22)}`
                          : truncateMiddle(file.path, 50)}
                      </Text>
                    </Tooltip>
                    {file.staged && (
                      <Badge colorScheme="green" variant="subtle" fontSize="9px">{t('quickCommit.staged')}</Badge>
                    )}
                  </HStack>
                ))}
              </Box>
            </VStack>
          )}
        </ModalBody>
        <ModalFooter pt={2} gap={2}>
          <Button size="sm" variant="ghost" colorScheme="whiteAlpha" onClick={modal.hide}>
            {t('runCommand.cancel')}
          </Button>
          <Button
            size="sm"
            colorScheme="brand"
            onClick={() => void handleCommit()}
            isDisabled={!message.trim() || selected.size === 0 || loading || committing}
            isLoading={committing}
            loadingText={t('quickCommit.committing')}
          >
            {t('quickCommit.commit')}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
})
