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
  FormControl,
  FormLabel,
  FormHelperText,
  Input,
  Select,
  Switch,
  Divider,
  Badge,
  IconButton,
  Alert,
  AlertIcon,
} from '@chakra-ui/react'
import NiceModal, { useModal } from '@ebay/nice-modal-react'
import type { AppSettings, SetupConfig, IDEOption, TerminalOption } from '../../shared/types'
import { useAPI } from '../api'
import type { WorktreeWithDiff } from '../api'
import { CloseIcon } from './Icons'
import { getBranchColor } from '../utils'

const TERMINALS: { value: TerminalOption; label: string }[] = [
  { value: 'Terminal', label: 'Terminal.app' },
  { value: 'iTerm2', label: 'iTerm2' },
  { value: 'Hyper', label: 'Hyper' },
  { value: 'Kitty', label: 'Kitty' },
  { value: 'Alacritty', label: 'Alacritty' },
  { value: 'Warp', label: 'Warp' },
]

const IDES: { value: IDEOption; label: string }[] = [
  { value: 'VSCode',    label: 'Visual Studio Code' },
  { value: 'Cursor',   label: 'Cursor' },
  { value: 'Zed',      label: 'Zed' },
  { value: 'WebStorm', label: 'WebStorm' },
  { value: 'Sublime',  label: 'Sublime Text' },
]

const SettingsModal = NiceModal.create<{
  settings: AppSettings
  repoPath: string
  setupConfig: SetupConfig | null
  onSave: (settings: AppSettings) => Promise<void>
}>(({ settings, repoPath, setupConfig, onSave }) => {
  const modal = useModal()
  const api = useAPI()
  const [terminal, setTerminal] = useState<TerminalOption>(settings.preferredTerminal)
  const [ide, setIde] = useState<IDEOption>(settings.preferredIDE)
  const [autoRefresh, setAutoRefresh] = useState(settings.autoRefresh)
  const [saving, setSaving] = useState(false)

  const [packages, setPackages] = useState<string[]>(setupConfig?.packages ?? [])
  const [envFiles, setEnvFiles] = useState<string[]>(setupConfig?.envFiles ?? [])
  const [commands, setCommands] = useState<string[]>(setupConfig?.commands ?? [])
  const [showDirtyWarning, setShowDirtyWarning] = useState(false)

  const [worktrees, setWorktrees] = useState<WorktreeWithDiff[]>([])
  const [devCommands, setDevCommands] = useState<Record<string, string>>({})

  useEffect(() => {
    Promise.all([
      api.worktree.list(repoPath),
      api.process.getAllDevCommands(),
    ]).then(([wts, cmds]) => {
      setWorktrees(wts)
      setDevCommands(cmds)
    })
  }, [api, repoPath])

  const handleSave = async () => {
    setSaving(true)
    await onSave({ preferredTerminal: terminal, preferredIDE: ide, autoRefresh })
    const filteredPackages = packages.filter(Boolean)
    const filteredEnvFiles = envFiles.filter(Boolean)
    const filteredCommands = commands.filter(Boolean)
    if (filteredPackages.length || filteredEnvFiles.length || filteredCommands.length) {
      await api.setup.save(repoPath, {
        packages: filteredPackages.length ? filteredPackages : undefined,
        envFiles: filteredEnvFiles.length ? filteredEnvFiles : undefined,
        commands: filteredCommands.length ? filteredCommands : undefined,
      })
    } else if (setupConfig !== null) {
      await api.setup.save(repoPath, {})
    }
    setSaving(false)
  }

  const setupChanged =
    JSON.stringify(packages.filter(Boolean)) !== JSON.stringify(setupConfig?.packages ?? []) ||
    JSON.stringify(envFiles.filter(Boolean)) !== JSON.stringify(setupConfig?.envFiles ?? []) ||
    JSON.stringify(commands.filter(Boolean)) !== JSON.stringify(setupConfig?.commands ?? [])

  const isDirty =
    terminal !== settings.preferredTerminal ||
    ide !== settings.preferredIDE ||
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

  const handleCommandBlur = async (worktreePath: string, value: string) => {
    await api.process.saveCommand(worktreePath, value)
  }

  const handleClose = () => {
    if (isDirty) {
      setShowDirtyWarning(true)
    } else {
      modal.hide()
    }
  }

  return (
    <Modal isOpen={modal.visible} onClose={handleClose} size="md" isCentered scrollBehavior="inside">
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
                onChange={(e) => setTerminal(e.target.value as TerminalOption)}
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

            <FormControl>
              <FormLabel fontSize="sm">Preferred IDE</FormLabel>
              <Select
                value={ide}
                onChange={(e) => setIde(e.target.value as IDEOption)}
                bg="whiteAlpha.50"
                borderColor="whiteAlpha.200"
                fontSize="sm"
              >
                {IDES.map((i) => (
                  <option key={i.value} value={i.value}>{i.label}</option>
                ))}
              </Select>
              <FormHelperText fontSize="xs" color="whiteAlpha.500">
                Used when opening worktrees in an editor
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
                () => api.dialog.pickFile(repoPath)
              )}
              {renderListEditor('Commands', 'echo hello', commands, setCommands)}
            </VStack>

            <Divider borderColor="whiteAlpha.100" />

            <VStack align="stretch" spacing={3}>
              <VStack align="stretch" spacing={0}>
                <Text fontSize="sm" fontWeight="semibold">Run Commands</Text>
                <Text fontSize="xs" color="whiteAlpha.500">Dev command to run per worktree. Changes save immediately.</Text>
              </VStack>

              {worktrees.map((wt) => (
                <HStack key={wt.path} spacing={2} align="center">
                  <Badge
                    colorScheme={getBranchColor(wt.branch)}
                    variant="subtle"
                    fontSize="xs"
                    flexShrink={0}
                  >
                    {wt.branch}
                  </Badge>
                  <Input
                    value={devCommands[wt.path] ?? ''}
                    onChange={(e) => setDevCommands((prev) => ({ ...prev, [wt.path]: e.target.value }))}
                    onBlur={(e) => handleCommandBlur(wt.path, e.target.value)}
                    placeholder="e.g. bun run dev"
                    fontFamily="mono"
                    fontSize="xs"
                    size="sm"
                    bg="whiteAlpha.50"
                    borderColor="whiteAlpha.200"
                  />
                  <IconButton
                    aria-label="Clear command"
                    icon={<CloseIcon />}
                    size="sm"
                    variant="ghost"
                    colorScheme="red"
                    isDisabled={!devCommands[wt.path]}
                    onClick={() => {
                      setDevCommands((prev) => ({ ...prev, [wt.path]: '' }))
                      void api.process.saveCommand(wt.path, '')
                    }}
                  />
                </HStack>
              ))}
            </VStack>
          </VStack>
        </ModalBody>

        <ModalFooter>
          <VStack align="stretch" spacing={3} w="full">
            {showDirtyWarning && (
              <Alert status="warning" borderRadius="md" bg="orange.900" border="1px solid" borderColor="orange.700" py={2}>
                <AlertIcon />
                <HStack justify="space-between" flex={1} flexWrap="wrap" gap={2}>
                  <Text fontSize="sm">You have unsaved changes.</Text>
                  <HStack spacing={2}>
                    <Button size="xs" variant="ghost" onClick={() => setShowDirtyWarning(false)}>Keep editing</Button>
                    <Button size="xs" colorScheme="orange" variant="outline" onClick={modal.hide}>Discard & close</Button>
                  </HStack>
                </HStack>
              </Alert>
            )}
            <HStack spacing={3} justify="flex-end">
              <Button variant="ghost" onClick={handleClose}>Cancel</Button>
              <Button
                colorScheme="brand"
                onClick={handleSave}
                isLoading={saving}
                isDisabled={!isDirty}
              >
                Save settings
              </Button>
            </HStack>
          </VStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
})

export default SettingsModal
