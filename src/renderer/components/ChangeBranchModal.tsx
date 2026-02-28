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
} from '@chakra-ui/react'
import NiceModal, { useModal } from '@ebay/nice-modal-react'
import { useTranslation } from 'react-i18next'
import { useAPI, type BranchInfo } from '../api'
import BranchSearchList from './BranchSearchList'

const ChangeBranchModal = NiceModal.create<{
  repoPath: string
  currentBranch: string
  onSuccess: () => void
}>(({ repoPath, currentBranch, onSuccess }) => {
  const modal = useModal()
  const api = useAPI()
  const { t } = useTranslation()
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
      modal.hide()
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={modal.visible} onClose={modal.hide} size="md" isCentered scrollBehavior="inside">
      <ModalOverlay backdropFilter="blur(4px)" bg="blackAlpha.700" />
      <ModalContent bg="gray.800" borderColor="whiteAlpha.100" border="1px solid">
        <ModalHeader pb={2}>
          <Text>{t('changeBranch.title')}</Text>
        </ModalHeader>

        <ModalBody>
          <VStack align="stretch" spacing={3}>
            <Text fontSize="sm" color="whiteAlpha.600">
              {t('changeBranch.subtitle')}
            </Text>
            <BranchSearchList
              branches={branches}
              selected={selectedBranch}
              onSelect={setSelectedBranch}
              currentBranch={currentBranch}
              disableCurrent={true}
              maxH="260px"
            />
            {error && (
              <Text fontSize="sm" color="red.400">{error}</Text>
            )}
          </VStack>
        </ModalBody>

        <ModalFooter>
          <HStack spacing={3}>
            <Button variant="ghost" onClick={modal.hide} isDisabled={loading}>
              {t('changeBranch.cancel')}
            </Button>
            <Button
              colorScheme="brand"
              onClick={handleConfirm}
              isLoading={loading}
              isDisabled={!selectedBranch || selectedBranch === currentBranch}
              loadingText={t('changeBranch.checkingOut')}
            >
              {t('changeBranch.checkout')}
            </Button>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
})

export default ChangeBranchModal
