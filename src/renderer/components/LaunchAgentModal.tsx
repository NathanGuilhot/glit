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
  Textarea,
  Select,
  RadioGroup,
  Radio,
  Stack,
  Alert,
  AlertIcon,
  Box,
  Spinner,
  Tooltip,
  useToast,
} from '@chakra-ui/react'
import NiceModal, { useModal } from '@ebay/nice-modal-react'
import { useTranslation } from 'react-i18next'
import type { AgentInfo } from '../../shared/types'
import { useAPI } from '../api'
import { useWorktree } from '../contexts/WorktreeContext'

const TERMINALS_NO_INJECT = new Set(['Hyper', 'Warp'])

type RunMode = 'background' | 'terminal'

interface LaunchAgentModalProps {
  worktreePath: string
  branch: string
}

const LaunchAgentModal = NiceModal.create<LaunchAgentModalProps>(({ worktreePath, branch }) => {
  const modal = useModal()
  const api = useAPI()
  const toast = useToast()
  const { t } = useTranslation()
  const { settings } = useWorktree()

  const [prompt, setPrompt] = useState('')
  const [agents, setAgents] = useState<AgentInfo[]>([])
  const [agentsLoading, setAgentsLoading] = useState(true)
  const [agentId, setAgentId] = useState<string>('')
  const [runMode, setRunMode] = useState<RunMode>('background')
  const [submitting, setSubmitting] = useState(false)
  const [progressLine, setProgressLine] = useState('')
  const [error, setError] = useState('')

  const terminal = settings.preferredTerminal
  const terminalSupportsInjection = !TERMINALS_NO_INJECT.has(terminal)
  const agentLabel = agents.find((a) => a.id === agentId)?.label ?? agentId

  // Load agents on open
  useEffect(() => {
    if (!modal.visible) return
    setAgentsLoading(true)
    api.agent
      .listAvailable()
      .then((list) => {
        setAgents(list)
        if (list.length > 0 && !agentId) setAgentId(list[0]!.id)
      })
      .catch(() => setAgents([]))
      .finally(() => setAgentsLoading(false))
    // intentionally only on first visible
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modal.visible])

  // If preferred terminal can't inject and the user picked terminal mode,
  // bounce them back to background and clear any old error.
  useEffect(() => {
    if (runMode === 'terminal' && !terminalSupportsInjection) {
      setRunMode('background')
    }
  }, [runMode, terminalSupportsInjection])

  const validate = (): string => {
    if (!prompt.trim()) return t('launchAgent.validation.promptRequired')
    if (!agentId) return t('launchAgent.validation.agentRequired')
    return ''
  }

  const handleSubmit = async () => {
    const err = validate()
    if (err) {
      setError(err)
      return
    }
    setError('')
    setSubmitting(true)

    try {
      setProgressLine(
        runMode === 'background'
          ? t('launchAgent.progress.launchingBackground', { agent: agentLabel })
          : t('launchAgent.progress.launchingTerminal', { terminal }),
      )

      const launch =
        runMode === 'background'
          ? await api.agent.launchBackground(agentId as AgentInfo['id'], prompt, worktreePath)
          : await api.agent.launchInTerminal(agentId as AgentInfo['id'], prompt, worktreePath, terminal)

      if (!launch.success) {
        throw new Error(launch.error ?? 'Launch failed')
      }

      toast({
        title: t('launchAgent.toast.launched', { agent: agentLabel }),
        status: 'success',
        duration: 3000,
      })
      modal.hide()
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      toast({
        title: t('launchAgent.toast.failed'),
        description: message,
        status: 'error',
        duration: 6000,
        isClosable: true,
      })
    } finally {
      setSubmitting(false)
      setProgressLine('')
    }
  }

  const noAgents = !agentsLoading && agents.length === 0
  const submitDisabled = submitting || noAgents || !prompt.trim() || !agentId

  return (
    <Modal
      isOpen={modal.visible}
      onClose={() => {
        if (submitting) return
        modal.hide()
      }}
      onCloseComplete={() => modal.remove()}
      size="lg"
      isCentered
      closeOnOverlayClick={!submitting}
    >
      <ModalOverlay backdropFilter="blur(4px)" bg="blackAlpha.700" />
      <ModalContent bg="gray.800" borderColor="whiteAlpha.100" border="1px solid">
        <ModalHeader pb={2}>{t('launchAgent.title', { branch })}</ModalHeader>

        <ModalBody>
          <VStack spacing={4} align="stretch">
            {noAgents && (
              <Alert status="warning" borderRadius="md" bg="orange.900" border="1px solid" borderColor="orange.700">
                <AlertIcon />
                <Text fontSize="sm">{t('launchAgent.alerts.noAgentsFound')}</Text>
              </Alert>
            )}

            <FormControl isInvalid={!!error && !prompt.trim()}>
              <FormLabel fontSize="sm">{t('launchAgent.fields.prompt')}</FormLabel>
              <Textarea
                value={prompt}
                onChange={(e) => {
                  setPrompt(e.target.value)
                  if (error) setError('')
                }}
                placeholder={t('launchAgent.placeholders.prompt')}
                autoFocus
                rows={5}
                fontFamily="mono"
                fontSize="sm"
                bg="whiteAlpha.50"
                borderColor="whiteAlpha.200"
                resize="vertical"
              />
            </FormControl>

            <FormControl isDisabled={noAgents}>
              <FormLabel fontSize="sm">{t('launchAgent.fields.agent')}</FormLabel>
              {agentsLoading ? (
                <HStack spacing={2}>
                  <Spinner size="xs" />
                  <Text fontSize="sm" color="whiteAlpha.500">{t('launchAgent.detecting')}</Text>
                </HStack>
              ) : (
                <Select
                  value={agentId}
                  onChange={(e) => setAgentId(e.target.value)}
                  bg="whiteAlpha.50"
                  borderColor="whiteAlpha.200"
                  fontSize="sm"
                  size="sm"
                >
                  {agents.map((a) => (
                    <option key={a.id} value={a.id} style={{ background: '#1A202C' }}>
                      {a.label}
                    </option>
                  ))}
                </Select>
              )}
            </FormControl>

            <FormControl>
              <FormLabel fontSize="sm">{t('launchAgent.fields.runMode')}</FormLabel>
              <RadioGroup value={runMode} onChange={(v) => setRunMode(v as RunMode)}>
                <Stack direction="row" spacing={4}>
                  <Radio value="background" colorScheme="brand" size="sm">
                    <Text fontSize="sm">{t('launchAgent.modes.background')}</Text>
                  </Radio>
                  <Tooltip
                    label={t('launchAgent.alerts.terminalNotSupported', { terminal })}
                    placement="top"
                    isDisabled={terminalSupportsInjection}
                    openDelay={200}
                  >
                    <Box>
                      <Radio
                        value="terminal"
                        colorScheme="brand"
                        size="sm"
                        isDisabled={!terminalSupportsInjection}
                      >
                        <Text fontSize="sm">{t('launchAgent.modes.terminal', { terminal })}</Text>
                      </Radio>
                    </Box>
                  </Tooltip>
                </Stack>
              </RadioGroup>
            </FormControl>

            {error && (
              <Text fontSize="xs" color="red.300">
                {error}
              </Text>
            )}

            {submitting && progressLine && (
              <HStack spacing={2}>
                <Spinner size="xs" color="brand.400" />
                <Text fontSize="xs" color="whiteAlpha.700">{progressLine}</Text>
              </HStack>
            )}
          </VStack>
        </ModalBody>

        <ModalFooter>
          <HStack spacing={3}>
            <Button variant="ghost" onClick={() => modal.hide()} isDisabled={submitting}>
              {t('launchAgent.buttons.cancel')}
            </Button>
            <Button
              colorScheme="brand"
              onClick={handleSubmit}
              isLoading={submitting}
              loadingText={progressLine || t('launchAgent.buttons.launching')}
              isDisabled={submitDisabled}
            >
              {runMode === 'background'
                ? t('launchAgent.buttons.launchBackground')
                : t('launchAgent.buttons.launchTerminal', { terminal })}
            </Button>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
})

export default LaunchAgentModal
