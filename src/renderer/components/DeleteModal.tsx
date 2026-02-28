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
import type { WorktreeWithDiff } from '../../shared/types'

const DeleteModal = NiceModal.create<{
  worktree: WorktreeWithDiff
  onConfirm: (worktree: WorktreeWithDiff, force: boolean, deleteFiles: boolean) => Promise<void>
}>(({ worktree, onConfirm }) => {
  const modal = useModal()
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
    <Modal isOpen={modal.visible} onClose={modal.hide} size="md" isCentered>
      <ModalOverlay backdropFilter="blur(4px)" bg="blackAlpha.700" />
      <ModalContent bg="gray.800" borderColor="whiteAlpha.100" border="1px solid">
        <ModalHeader pb={2}>
          <HStack spacing={3}>
            <Text>Delete Worktree</Text>
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
                  <Text fontSize="sm" fontWeight="600">Uncommitted changes</Text>
                  <Text fontSize="xs" color="whiteAlpha.700">
                    +{worktree.insertionCount} -{worktree.deletionCount} across {worktree.fileCount} file{worktree.fileCount !== 1 ? 's' : ''}
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
                  <Text fontSize="sm">Force delete (discard uncommitted changes)</Text>
                </Checkbox>
              )}

              <Checkbox
                isChecked={deleteFiles}
                onChange={(e) => setDeleteFiles(e.target.checked)}
                colorScheme="red"
              >
                <VStack align="start" spacing={0}>
                  <Text fontSize="sm">Also delete directory files</Text>
                  <Text fontSize="xs" color="whiteAlpha.500">Permanently removes all files from disk</Text>
                </VStack>
              </Checkbox>
            </VStack>

            <Text fontSize="xs" color="whiteAlpha.400">
              This action will unregister the worktree from git
              {deleteFiles ? ' and delete all files' : ''}.
              {!deleteFiles && ' The directory will remain on disk.'}
            </Text>
          </VStack>
        </ModalBody>

        <ModalFooter>
          <HStack spacing={3}>
            <Button variant="ghost" onClick={modal.hide} isDisabled={loading}>
              Cancel
            </Button>
            <Button
              colorScheme="red"
              onClick={handleConfirm}
              isLoading={loading}
              loadingText="Deleting..."
            >
              Delete worktree
            </Button>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
})

export default DeleteModal
