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
  Input,
  VStack,
  HStack,
  Text,
  Badge,
  Wrap,
  WrapItem,
  Spinner,
} from '@chakra-ui/react'
import NiceModal, { useModal } from '@ebay/nice-modal-react'
import { useTranslation } from 'react-i18next'
import type { DevCommandInfo } from '../../shared/types'
import { useAPI } from '../api'

interface RunCommandModalProps {
  worktreePath: string
  branch: string
  onConfirm: (command: string) => void
}

export const RunCommandModal = NiceModal.create<RunCommandModalProps>(({ worktreePath, branch, onConfirm }) => {
  const modal = useModal()
  const api = useAPI()
  const { t } = useTranslation()
  const [command, setCommand] = useState('')
  const [info, setInfo] = useState<DevCommandInfo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.worktree.detectDevCommand(worktreePath),
      api.process.getSavedCommand(worktreePath),
    ]).then(([detected, saved]) => {
      setInfo(detected)
      setCommand(saved ?? detected.command ?? '')
    }).catch(() => {
      setCommand('')
    }).finally(() => setLoading(false))
  }, [api, worktreePath])

  const handleConfirm = async () => {
    if (!command.trim()) return
    await api.process.saveCommand(worktreePath, command.trim())
    modal.hide()
    onConfirm(command.trim())
  }

  return (
    <Modal isOpen={modal.visible} onClose={modal.hide} onCloseComplete={() => modal.remove()} size="md">
      <ModalOverlay />
      <ModalContent bg="gray.800" borderColor="whiteAlpha.100" border="1px solid">
        <ModalHeader fontSize="md" pb={2}>
          <HStack spacing={2}>
            <Text>{t('runCommand.title')}</Text>
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
              <Text fontSize="sm" color="whiteAlpha.600">{t('runCommand.detecting')}</Text>
            </HStack>
          ) : (
            <VStack align="start" spacing={3}>
              <Input
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                placeholder={t('runCommand.placeholder')}
                fontFamily="mono"
                fontSize="sm"
                bg="gray.900"
                borderColor="whiteAlpha.200"
                _focus={{ borderColor: 'brand.400', boxShadow: 'none' }}
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') void handleConfirm() }}
              />
              {info && info.scripts.length > 0 && (
                <VStack align="start" spacing={1} w="full">
                  <Text fontSize="11px" color="whiteAlpha.500">{t('runCommand.availableScripts')}</Text>
                  <Wrap spacing={1}>
                    {info.scripts.map((script) => (
                      <WrapItem key={script}>
                        <Badge
                          colorScheme="gray"
                          variant="subtle"
                          fontSize="xs"
                          fontFamily="mono"
                          cursor="pointer"
                          _hover={{ bg: 'whiteAlpha.200' }}
                          onClick={() => setCommand(`${info.pkgManager} run ${script}`)}
                        >
                          {script}
                        </Badge>
                      </WrapItem>
                    ))}
                  </Wrap>
                </VStack>
              )}
              <Text fontSize="11px" color="whiteAlpha.400">
                {t('runCommand.note')}
              </Text>
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
            onClick={() => void handleConfirm()}
            isDisabled={!command.trim() || loading}
          >
            {t('runCommand.run')}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
})
