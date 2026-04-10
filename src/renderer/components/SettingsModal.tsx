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
  Select,
  Switch,
  Divider,
  Badge,
  Alert,
  AlertIcon,
} from '@chakra-ui/react'
import NiceModal, { useModal } from '@ebay/nice-modal-react'
import { useTranslation } from 'react-i18next'
import type { AppSettings, IDEOption, TerminalOption } from '../../shared/types'
import { useAPI } from '../api'
import type { WorktreeWithDiff } from '../api'
import { SetupConfigEditor } from './SetupConfigEditor'
import { DevCommandsEditor } from './DevCommandsEditor'
import type { SetupConfig } from '../../shared/types'

const SettingsModal = NiceModal.create<{
  settings: AppSettings
  repoPath: string
  setupConfig: SetupConfig | null
  onSave: (settings: AppSettings) => Promise<void>
}>(({ settings, repoPath, setupConfig, onSave }) => {
  const modal = useModal()
  const api = useAPI()
  const { t } = useTranslation()

  const TERMINALS: { value: TerminalOption; label: string }[] = [
    { value: 'Terminal', label: t('settings.terminals.Terminal') },
    { value: 'iTerm2', label: t('settings.terminals.iTerm2') },
    { value: 'Hyper', label: t('settings.terminals.Hyper') },
    { value: 'Kitty', label: t('settings.terminals.Kitty') },
    { value: 'Alacritty', label: t('settings.terminals.Alacritty') },
    { value: 'Warp', label: t('settings.terminals.Warp') },
  ]

  const IDES: { value: IDEOption; label: string }[] = [
    { value: 'VSCode', label: t('settings.ides.VSCode') },
    { value: 'VSCodeInsiders', label: t('settings.ides.VSCodeInsiders') },
    { value: 'Cursor', label: t('settings.ides.Cursor') },
    { value: 'Zed', label: t('settings.ides.Zed') },
    { value: 'WebStorm', label: t('settings.ides.WebStorm') },
    { value: 'Sublime', label: t('settings.ides.Sublime') },
    { value: 'Antigravity', label: t('settings.ides.Antigravity') },
  ]

  const [terminal, setTerminal] = useState<TerminalOption>(settings.preferredTerminal)
  const [ide, setIde] = useState<IDEOption>(settings.preferredIDE)
  const [autoRefresh, setAutoRefresh] = useState(settings.autoRefresh)
  const [saving, setSaving] = useState(false)

  const [packages, setPackages] = useState<string[]>(setupConfig?.packages ?? [])
  const [envFiles, setEnvFiles] = useState<string[]>(setupConfig?.envFiles ?? [])
  const [commands, setCommands] = useState<string[]>(setupConfig?.commands ?? [])
  const [showDirtyWarning, setShowDirtyWarning] = useState(false)

  const [savedBaseline, setSavedBaseline] = useState({
    terminal: settings.preferredTerminal,
    ide: settings.preferredIDE,
    autoRefresh: settings.autoRefresh,
    packages: setupConfig?.packages ?? [],
    envFiles: setupConfig?.envFiles ?? [],
    commands: setupConfig?.commands ?? [],
  })

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
    setSavedBaseline({
      terminal,
      ide,
      autoRefresh,
      packages: packages.filter(Boolean),
      envFiles: envFiles.filter(Boolean),
      commands: commands.filter(Boolean),
    })
  }

  const setupChanged =
    JSON.stringify(packages.filter(Boolean)) !== JSON.stringify(savedBaseline.packages) ||
    JSON.stringify(envFiles.filter(Boolean)) !== JSON.stringify(savedBaseline.envFiles) ||
    JSON.stringify(commands.filter(Boolean)) !== JSON.stringify(savedBaseline.commands)

  const isDirty =
    terminal !== savedBaseline.terminal ||
    ide !== savedBaseline.ide ||
    autoRefresh !== savedBaseline.autoRefresh ||
    setupChanged

  const handleClose = () => {
    if (isDirty) {
      setShowDirtyWarning(true)
    } else {
      modal.hide()
    }
  }

  return (
    <Modal isOpen={modal.visible} onClose={handleClose} onCloseComplete={() => modal.remove()} size="md" isCentered scrollBehavior="inside">
      <ModalOverlay backdropFilter="blur(4px)" bg="blackAlpha.700" />
      <ModalContent bg="gray.800" borderColor="whiteAlpha.100" border="1px solid" maxH="85vh">
        <ModalHeader pb={2}>
          <HStack spacing={2}>
            <Text>{t('settings.title')}</Text>
            <Badge colorScheme="gray" variant="subtle" fontSize="xs">{t('settings.shortcut')}</Badge>
          </HStack>
        </ModalHeader>

        <ModalBody overflowY="auto">
          <VStack spacing={5} align="stretch">
            <FormControl>
              <FormLabel fontSize="sm">{t('settings.preferredTerminal.label')}</FormLabel>
              <Select
                value={terminal}
                onChange={(e) => setTerminal(e.target.value as TerminalOption)}
                bg="whiteAlpha.50"
                borderColor="whiteAlpha.200"
                fontSize="sm"
              >
                {TERMINALS.map((term) => (
                  <option key={term.value} value={term.value}>{term.label}</option>
                ))}
              </Select>
              <FormHelperText fontSize="xs" color="whiteAlpha.500">
                {t('settings.preferredTerminal.helper')}
              </FormHelperText>
            </FormControl>

            <FormControl>
              <FormLabel fontSize="sm">{t('settings.preferredIDE.label')}</FormLabel>
              <Select
                value={ide}
                onChange={(e) => setIde(e.target.value as IDEOption)}
                bg="whiteAlpha.50"
                borderColor="whiteAlpha.200"
                fontSize="sm"
              >
                {IDES.map((ideOpt) => (
                  <option key={ideOpt.value} value={ideOpt.value}>{ideOpt.label}</option>
                ))}
              </Select>
              <FormHelperText fontSize="xs" color="whiteAlpha.500">
                {t('settings.preferredIDE.helper')}
              </FormHelperText>
            </FormControl>

            <Divider borderColor="whiteAlpha.100" />

            <FormControl>
              <HStack justify="space-between" align="start">
                <VStack align="start" spacing={0}>
                  <FormLabel fontSize="sm" mb={0}>{t('settings.autoRefresh.label')}</FormLabel>
                  <Text fontSize="xs" color="whiteAlpha.500">{t('settings.autoRefresh.helper')}</Text>
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

            <SetupConfigEditor
              packages={packages}
              setPackages={setPackages}
              envFiles={envFiles}
              setEnvFiles={setEnvFiles}
              commands={commands}
              setCommands={setCommands}
              onBrowse={() => api.dialog.pickFile(repoPath)}
            />

            <Divider borderColor="whiteAlpha.100" />

            <DevCommandsEditor
              worktrees={worktrees}
              devCommands={devCommands}
              setDevCommands={setDevCommands}
            />
          </VStack>
        </ModalBody>

        <ModalFooter>
          <VStack align="stretch" spacing={3} w="full">
            {showDirtyWarning && (
              <Alert status="warning" borderRadius="md" bg="orange.900" border="1px solid" borderColor="orange.700" py={2}>
                <AlertIcon />
                <HStack justify="space-between" flex={1} flexWrap="wrap" gap={2}>
                  <Text fontSize="sm">{t('settings.dirtyWarning.message')}</Text>
                  <HStack spacing={2}>
                    <Button size="xs" variant="ghost" onClick={() => setShowDirtyWarning(false)}>{t('settings.dirtyWarning.keepEditing')}</Button>
                    <Button size="xs" colorScheme="orange" variant="outline" onClick={modal.hide}>{t('settings.dirtyWarning.discardAndClose')}</Button>
                  </HStack>
                </HStack>
              </Alert>
            )}
            <HStack spacing={3} justify="flex-end">
              <Button variant="ghost" onClick={handleClose}>{t('settings.cancel')}</Button>
              <Button
                colorScheme="brand"
                onClick={handleSave}
                isLoading={saving}
                isDisabled={!isDirty}
              >
                {t('settings.save')}
              </Button>
            </HStack>
          </VStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
})

export default SettingsModal
