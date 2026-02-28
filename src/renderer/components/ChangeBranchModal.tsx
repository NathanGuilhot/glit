import { useState, useEffect } from 'react'
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
  List,
  ListItem,
} from '@chakra-ui/react'
import { useAPI, BranchInfo } from '../api'

interface ChangeBranchModalProps {
  repoPath: string
  currentBranch: string
  onSuccess: () => void
  onClose: () => void
}

export default function ChangeBranchModal({ repoPath, currentBranch, onSuccess, onClose }: ChangeBranchModalProps) {
  const api = useAPI()
  const [branches, setBranches] = useState<BranchInfo[]>([])
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.branch.list(repoPath).then((branches) => {
      setBranches(branches.filter((b) => !b.isRemote))
    }).catch(() => {
      setBranches([])
    })
  }, [api, repoPath])

  const handleConfirm = async () => {
    if (!selectedBranch) return
    setLoading(true)
    setError(null)
    try {
      await api.branch.checkout(repoPath, selectedBranch)
      onSuccess()
      onClose()
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  const handleSelect = (branchName: string) => {
    if (branchName !== currentBranch) {
      setSelectedBranch(branchName)
    }
  }

  return (
    <Modal isOpen onClose={onClose} size="md" isCentered scrollBehavior="inside">
      <ModalOverlay backdropFilter="blur(4px)" bg="blackAlpha.700" />
      <ModalContent bg="gray.800" borderColor="whiteAlpha.100" border="1px solid">
        <ModalHeader pb={2}>
          <Text>Change Branch</Text>
        </ModalHeader>

        <ModalBody>
          <VStack align="stretch" spacing={3}>
            <Text fontSize="sm" color="whiteAlpha.600">
              Select a branch to checkout in the root repository
            </Text>
            <List spacing={1} maxH="300px" overflowY="auto" borderRadius="md" border="1px solid" borderColor="whiteAlpha.100">
              {branches.map((branch) => (
                <ListItem
                  key={branch.name}
                  px={3}
                  py={2}
                  cursor="pointer"
                  bg={selectedBranch === branch.name ? 'brand.500' : branch.name === currentBranch ? 'whiteAlpha.50' : 'transparent'}
                  _hover={{ bg: selectedBranch === branch.name ? 'brand.600' : 'whiteAlpha.100' }}
                  onClick={() => handleSelect(branch.name)}
                  borderBottom="1px solid"
                  borderColor="whiteAlpha.50"
                >
                  <HStack justify="space-between">
                    <Text fontSize="sm">{branch.name}</Text>
                    {branch.name === currentBranch && (
                      <Text fontSize="xs" color="green.400">(current)</Text>
                    )}
                  </HStack>
                </ListItem>
              ))}
            </List>
            {error && (
              <Text fontSize="sm" color="red.400">{error}</Text>
            )}
          </VStack>
        </ModalBody>

        <ModalFooter>
          <HStack spacing={3}>
            <Button variant="ghost" onClick={onClose} isDisabled={loading}>
              Cancel
            </Button>
            <Button
              colorScheme="brand"
              onClick={handleConfirm}
              isLoading={loading}
              isDisabled={!selectedBranch || selectedBranch === currentBranch}
              loadingText="Checking out..."
            >
              Checkout
            </Button>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
