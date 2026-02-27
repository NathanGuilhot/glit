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
  FormControl,
  FormLabel,
  FormHelperText,
  Input,
  Select,
  Switch,
  Divider,
  Badge,
} from '@chakra-ui/react'
import type { AppSettings } from '../../shared/types'

interface SettingsModalProps {
  settings: AppSettings
  onSave: (settings: AppSettings) => Promise<void>
  onClose: () => void
}

const TERMINALS = [
  { value: 'Terminal', label: 'Terminal.app' },
  { value: 'iTerm2', label: 'iTerm2' },
  { value: 'Hyper', label: 'Hyper' },
  { value: 'Kitty', label: 'Kitty' },
  { value: 'Alacritty', label: 'Alacritty' },
  { value: 'Warp', label: 'Warp' },
]

export default function SettingsModal({ settings, onSave, onClose }: SettingsModalProps) {
  const [terminal, setTerminal] = useState(settings.preferredTerminal)
  const [baseBranch, setBaseBranch] = useState(settings.defaultBaseBranch)
  const [autoRefresh, setAutoRefresh] = useState(settings.autoRefresh)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await onSave({ preferredTerminal: terminal, defaultBaseBranch: baseBranch, autoRefresh })
    setSaving(false)
  }

  const isDirty =
    terminal !== settings.preferredTerminal ||
    baseBranch !== settings.defaultBaseBranch ||
    autoRefresh !== settings.autoRefresh

  return (
    <Modal isOpen onClose={onClose} size="md" isCentered>
      <ModalOverlay backdropFilter="blur(4px)" bg="blackAlpha.700" />
      <ModalContent bg="gray.800" borderColor="whiteAlpha.100" border="1px solid">
        <ModalHeader pb={2}>
          <HStack spacing={2}>
            <Text>Settings</Text>
            <Badge colorScheme="gray" variant="subtle" fontSize="xs">⌘,</Badge>
          </HStack>
        </ModalHeader>

        <ModalBody>
          <VStack spacing={5} align="stretch">
            <FormControl>
              <FormLabel fontSize="sm">Preferred terminal</FormLabel>
              <Select
                value={terminal}
                onChange={(e) => setTerminal(e.target.value)}
                bg="whiteAlpha.50"
                borderColor="whiteAlpha.200"
                fontSize="sm"
              >
                {TERMINALS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </Select>
              <FormHelperText fontSize="xs" color="whiteAlpha.500">
                Used when opening worktrees in terminal
              </FormHelperText>
            </FormControl>

            <Divider borderColor="whiteAlpha.100" />

            <FormControl>
              <FormLabel fontSize="sm">Default base branch</FormLabel>
              <Input
                value={baseBranch}
                onChange={(e) => setBaseBranch(e.target.value)}
                placeholder="main"
                fontFamily="mono"
                fontSize="sm"
                bg="whiteAlpha.50"
                borderColor="whiteAlpha.200"
              />
              <FormHelperText fontSize="xs" color="whiteAlpha.500">
                Default branch to fork from when creating new worktrees
              </FormHelperText>
            </FormControl>

            <Divider borderColor="whiteAlpha.100" />

            <FormControl>
              <HStack justify="space-between" align="start">
                <VStack align="start" spacing={0}>
                  <FormLabel fontSize="sm" mb={0}>Auto-refresh</FormLabel>
                  <Text fontSize="xs" color="whiteAlpha.500">Refresh worktree list automatically</Text>
                </VStack>
                <Switch
                  isChecked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  colorScheme="brand"
                  mt={0.5}
                />
              </HStack>
            </FormControl>
          </VStack>
        </ModalBody>

        <ModalFooter>
          <HStack spacing={3}>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button
              colorScheme="brand"
              onClick={handleSave}
              isLoading={saving}
              isDisabled={!isDirty}
            >
              Save settings
            </Button>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
