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
  IconButton,
} from '@chakra-ui/react'
import type { AppSettings, SetupConfig } from '../../shared/types'
import { CloseIcon } from './Icons'

interface SettingsModalProps {
  settings: AppSettings
  repoPath: string
  setupConfig: SetupConfig | null
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

export default function SettingsModal({ settings, repoPath, setupConfig, onSave, onClose }: SettingsModalProps) {
  const [terminal, setTerminal] = useState(settings.preferredTerminal)
  const [baseBranch, setBaseBranch] = useState(settings.defaultBaseBranch)
  const [autoRefresh, setAutoRefresh] = useState(settings.autoRefresh)
  const [saving, setSaving] = useState(false)

  const [packages, setPackages] = useState<string[]>(setupConfig?.packages ?? [])
  const [envFiles, setEnvFiles] = useState<string[]>(setupConfig?.envFiles ?? [])
  const [commands, setCommands] = useState<string[]>(setupConfig?.commands ?? [])

  const handleSave = async () => {
    setSaving(true)
    await onSave({ preferredTerminal: terminal, defaultBaseBranch: baseBranch, autoRefresh })
    const filteredPackages = packages.filter(Boolean)
    const filteredEnvFiles = envFiles.filter(Boolean)
    const filteredCommands = commands.filter(Boolean)
    if (filteredPackages.length || filteredEnvFiles.length || filteredCommands.length) {
      await window.glit.setup.save(repoPath, {
        packages: filteredPackages.length ? filteredPackages : undefined,
        envFiles: filteredEnvFiles.length ? filteredEnvFiles : undefined,
        commands: filteredCommands.length ? filteredCommands : undefined,
      })
    } else if (setupConfig !== null) {
      await window.glit.setup.save(repoPath, {})
    }
    setSaving(false)
  }

  const setupChanged =
    JSON.stringify(packages.filter(Boolean)) !== JSON.stringify(setupConfig?.packages ?? []) ||
    JSON.stringify(envFiles.filter(Boolean)) !== JSON.stringify(setupConfig?.envFiles ?? []) ||
    JSON.stringify(commands.filter(Boolean)) !== JSON.stringify(setupConfig?.commands ?? [])

  const isDirty =
    terminal !== settings.preferredTerminal ||
    baseBranch !== settings.defaultBaseBranch ||
    autoRefresh !== settings.autoRefresh ||
    setupChanged

  const updateItem = (setter: React.Dispatch<React.SetStateAction<string[]>>, index: number, value: string) => {
    setter((prev) => prev.map((v, i) => (i === index ? value : v)))
  }

  const removeItem = (setter: React.Dispatch<React.SetStateAction<string[]>>, index: number) => {
    setter((prev) => prev.filter((_, i) => i !== index))
  }

  const addItem = (setter: React.Dispatch<React.SetStateAction<string[]>>) => {
    setter((prev) => [...prev, ''])
  }

  const renderListEditor = (
    label: string,
    placeholder: string,
    items: string[],
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    onBrowse?: () => Promise<string | null>,
  ) => (
    <VStack align="stretch" spacing={1}>
      <Text fontSize="xs" fontWeight="semibold" color="whiteAlpha.600" textTransform="uppercase" letterSpacing="wider">
        {label}
      </Text>
      {items.map((item, i) => (
        <HStack key={i} spacing={1}>
          <Input
            value={item}
            onChange={(e) => updateItem(setter, i, e.target.value)}
            placeholder={placeholder}
            fontFamily="mono"
            fontSize="xs"
            size="sm"
            bg="whiteAlpha.50"
            borderColor="whiteAlpha.200"
          />
          {onBrowse && (
            <Button
              size="sm"
              variant="ghost"
              color="whiteAlpha.500"
              _hover={{ color: 'whiteAlpha.800' }}
              onClick={async () => {
                const picked = await onBrowse()
                if (picked !== null) updateItem(setter, i, picked)
              }}
            >
              Browse…
            </Button>
          )}
          <IconButton
            aria-label="Remove"
            icon={<CloseIcon />}
            size="sm"
            variant="ghost"
            colorScheme="red"
            onClick={() => removeItem(setter, i)}
          />
        </HStack>
      ))}
      <Button size="xs" variant="ghost" onClick={() => addItem(setter)} alignSelf="flex-start" color="whiteAlpha.500" _hover={{ color: 'whiteAlpha.800' }}>
        + Add
      </Button>
    </VStack>
  )

  return (
    <Modal isOpen onClose={onClose} size="md" isCentered scrollBehavior="inside">
      <ModalOverlay backdropFilter="blur(4px)" bg="blackAlpha.700" />
      <ModalContent bg="gray.800" borderColor="whiteAlpha.100" border="1px solid" maxH="85vh">
        <ModalHeader pb={2}>
          <HStack spacing={2}>
            <Text>Settings</Text>
            <Badge colorScheme="gray" variant="subtle" fontSize="xs">⌘,</Badge>
          </HStack>
        </ModalHeader>

        <ModalBody overflowY="auto">
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

            <Divider borderColor="whiteAlpha.100" />

            <VStack align="stretch" spacing={3}>
              <HStack spacing={2}>
                <Text fontSize="sm" fontWeight="semibold">Setup script</Text>
                <Badge colorScheme="gray" variant="subtle" fontSize="xs" fontFamily="mono">.glit/setup.yaml</Badge>
              </HStack>
              <Text fontSize="xs" color="whiteAlpha.500">
                Runs automatically when a new worktree is created
              </Text>

              {renderListEditor('Packages', 'npm install', packages, setPackages)}
              {renderListEditor('Env files', '.env', envFiles, setEnvFiles,
                () => window.glit.dialog.pickFile(repoPath)
              )}
              {renderListEditor('Commands', 'echo hello', commands, setCommands)}
            </VStack>
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
