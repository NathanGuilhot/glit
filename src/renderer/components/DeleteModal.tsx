import { useState } from 'react'
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Text,
  VStack,
  HStack,
  Badge,
  Checkbox,
  Alert,
  AlertIcon,
  Code,
  Box,
} from '@chakra-ui/react'
import NiceModal, { useModal } from '@ebay/nice-modal-react'
import { useTranslation } from 'react-i18next'
import type { WorktreeWithDiff } from '../../shared/types'

const DeleteModal = NiceModal.create<{
  worktree: WorktreeWithDiff
  onConfirm: (worktree: WorktreeWithDiff, force: boolean, deleteFiles: boolean) => Promise<void>
}>(({ worktree, onConfirm }) => {
  const modal = useModal()
  const { t } = useTranslation()
  const [force, setForce] = useState(false)
  const [deleteFiles, setDeleteFiles] = useState(false)
  const [loading, setLoading] = useState(false)

  const hasDiff = worktree.fileCount > 0

  const handleConfirm = async () => {
    setLoading(true)
    await onConfirm(worktree, force || hasDiff, deleteFiles)
    setLoading(false)
    modal.hide()
  }

  return (
    <Modal isOpen={modal.visible} onClose={modal.hide} onCloseComplete={() => modal.remove()} size="md" isCentered>
      <ModalOverlay backdropFilter="blur(4px)" bg="blackAlpha.700" />
      <ModalContent bg="gray.800" borderColor="whiteAlpha.100" border="1px solid">
        <ModalHeader pb={2}>
          <HStack spacing={3}>
            <Text>{t('deleteWorktree.title')}</Text>
          </HStack>
        </ModalHeader>

        <ModalBody>
          <VStack align="start" spacing={4}>
            <Box w="full" bg="whiteAlpha.50" borderRadius="md" p={3} border="1px solid" borderColor="whiteAlpha.100">
              <VStack align="start" spacing={1}>
                <Badge colorScheme="purple" variant="subtle">
                  {worktree.branch}
                </Badge>
                <Code fontSize="xs" bg="transparent" color="whiteAlpha.600" wordBreak="break-all">
                  {worktree.displayPath ?? worktree.path}
                </Code>
              </VStack>
            </Box>

            {hasDiff && (
              <Alert status="warning" borderRadius="md" bg="orange.900" border="1px solid" borderColor="orange.700">
                <AlertIcon />
                <VStack align="start" spacing={0}>
                  <Text fontSize="sm" fontWeight="600">{t('deleteWorktree.uncommittedChanges')}</Text>
                  <Text fontSize="xs" color="whiteAlpha.700">
                    {t('deleteWorktree.diffSummary', { count: worktree.fileCount, insertions: worktree.insertionCount, deletions: worktree.deletionCount })}
                  </Text>
                </VStack>
              </Alert>
            )}

            <VStack align="start" spacing={3} w="full">
              {hasDiff && (
                <Checkbox
                  isChecked={force || hasDiff}
                  isReadOnly={hasDiff}
                  onChange={(e) => setForce(e.target.checked)}
                  colorScheme="orange"
                >
                  <Text fontSize="sm">{t('deleteWorktree.forceDelete')}</Text>
                </Checkbox>
              )}

              <Checkbox
                isChecked={deleteFiles}
                onChange={(e) => setDeleteFiles(e.target.checked)}
                colorScheme="red"
              >
                <VStack align="start" spacing={0}>
                  <Text fontSize="sm">{t('deleteWorktree.deleteFiles')}</Text>
                  <Text fontSize="xs" color="whiteAlpha.500">{t('deleteWorktree.deleteFilesPermanent')}</Text>
                </VStack>
              </Checkbox>
            </VStack>

            <Text fontSize="xs" color="whiteAlpha.400">
              {t('deleteWorktree.warningBase')}
              {deleteFiles ? t('deleteWorktree.warningAndDeleteFiles') : ''}.
              {!deleteFiles && t('deleteWorktree.warningKeepFiles')}
            </Text>
          </VStack>
        </ModalBody>

        <ModalFooter>
          <HStack spacing={3}>
            <Button variant="ghost" onClick={modal.hide} isDisabled={loading}>
              {t('deleteWorktree.cancel')}
            </Button>
            <Button
              colorScheme="red"
              onClick={handleConfirm}
              isLoading={loading}
              loadingText={t('deleteWorktree.deleting')}
            >
              {t('deleteWorktree.delete')}
            </Button>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
})

export default DeleteModal
