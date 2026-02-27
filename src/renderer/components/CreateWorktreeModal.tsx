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
  FormErrorMessage,
  Input,
  Switch,
  Select,
  Alert,
  AlertIcon,
  Box,
  Code,
  Badge,
  Divider,
  Spinner,
  Progress,
} from '@chakra-ui/react'
import type { AppSettings, SetupConfig, CreateProgress, BranchInfo } from '../../shared/types'
import { useAPI } from '../api'

interface CreateWorktreeModalProps {
  repoPath: string
  settings: AppSettings
  progress: CreateProgress | null
  cancelling?: boolean
  onConfirm: (branchName: string, createNew: boolean, baseBranch: string) => Promise<void>
  onCancel?: () => void
  onClose: () => void
}

type ModalStep = 'form' | 'progress'

const steps: CreateProgress['step'][] = ['creating', 'packages', 'env', 'commands', 'done']

function getStepIndex(step: CreateProgress['step']): number {
  return steps.indexOf(step)
}

interface CreateWorktreeFormProps {
  branchName: string
  setBranchName: (v: string) => void
  createNew: boolean
  setCreateNew: (v: boolean) => void
  baseBranch: string
  setBaseBranch: (v: string) => void
  branches: BranchInfo[]
  loadingBranches: boolean
  setupConfig: SetupConfig | null
  error: string
  setError: (v: string) => void
  onSubmit: () => void
}

function CreateWorktreeForm({
  branchName,
  setBranchName,
  createNew,
  setCreateNew,
  baseBranch,
  setBaseBranch,
  branches,
  loadingBranches,
  setupConfig,
  error,
  setError,
  onSubmit,
}: CreateWorktreeFormProps) {
  const hasSetup = setupConfig && (
    (setupConfig.packages?.length ?? 0) > 0 ||
    (setupConfig.envFiles?.length ?? 0) > 0 ||
    (setupConfig.commands?.length ?? 0) > 0
  )

  return (
    <VStack spacing={4}>
      <FormControl isInvalid={!!error}>
        <FormLabel fontSize="sm">Branch name</FormLabel>
        <Input
          value={branchName}
          onChange={(e) => { setBranchName(e.target.value); setError('') }}
          placeholder={createNew ? 'feature/my-feature' : 'existing-branch'}
          onKeyDown={(e) => { if (e.key === 'Enter') onSubmit() }}
          autoFocus
          fontFamily="mono"
          fontSize="sm"
          bg="whiteAlpha.50"
          borderColor="whiteAlpha.200"
          list="branch-suggestions"
        />
        {!createNew && (
          <datalist id="branch-suggestions">
            {branches.map((b) => (
              <option key={b.name} value={b.name} />
            ))}
          </datalist>
        )}
        {error && <FormErrorMessage>{error}</FormErrorMessage>}
      </FormControl>

      <FormControl>
        <HStack justify="space-between">
          <FormLabel fontSize="sm" mb={0}>Create new branch</FormLabel>
          <Switch
            isChecked={createNew}
            onChange={(e) => setCreateNew(e.target.checked)}
            colorScheme="brand"
          />
        </HStack>
      </FormControl>

      {createNew && (
        <FormControl>
          <FormLabel fontSize="sm">Base branch</FormLabel>
          {loadingBranches ? (
            <HStack><Spinner size="xs" /><Text fontSize="sm" color="whiteAlpha.500">Loading branches...</Text></HStack>
          ) : (
            <Select
              value={baseBranch}
              onChange={(e) => setBaseBranch(e.target.value)}
              bg="whiteAlpha.50"
              borderColor="whiteAlpha.200"
              fontSize="sm"
              fontFamily="mono"
            >
              {branches
                .filter((b) => !b.isRemote)
                .map((b) => (
                  <option key={b.name} value={b.name}>
                    {b.name}{b.isCurrent ? ' (current)' : ''}
                  </option>
                ))}
            </Select>
          )}
        </FormControl>
      )}

      {hasSetup && (
        <>
          <Divider borderColor="whiteAlpha.100" />
          <Box w="full">
            <HStack mb={2}>
              <Text fontSize="sm" fontWeight="600">Setup script</Text>
              <Badge colorScheme="blue" variant="subtle" fontSize="xs">.glit/setup.yaml</Badge>
            </HStack>
            <VStack align="start" spacing={1}>
              {(setupConfig?.packages ?? []).length > 0 && (
                <HStack>
                  <Badge colorScheme="green" variant="outline" fontSize="9px">packages</Badge>
                  <Code fontSize="xs" bg="transparent" color="whiteAlpha.600">
                    {setupConfig?.packages?.join(', ')}
                  </Code>
                </HStack>
              )}
              {(setupConfig?.envFiles ?? []).length > 0 && (
                <HStack>
                  <Badge colorScheme="yellow" variant="outline" fontSize="9px">env files</Badge>
                  <Code fontSize="xs" bg="transparent" color="whiteAlpha.600">
                    {setupConfig?.envFiles?.join(', ')}
                  </Code>
                </HStack>
              )}
              {(setupConfig?.commands ?? []).map((cmd: string, i: number) => (
                <HStack key={i}>
                  <Badge colorScheme="purple" variant="outline" fontSize="9px">cmd</Badge>
                  <Code fontSize="xs" bg="transparent" color="whiteAlpha.600" noOfLines={1}>
                    {cmd}
                  </Code>
                </HStack>
              ))}
            </VStack>
          </Box>
        </>
      )}
    </VStack>
  )
}

interface CreateWorktreeProgressProps {
  progress: CreateProgress
}

function CreateWorktreeProgress({ progress }: CreateWorktreeProgressProps) {
  const isDone = progress.step === 'done'
  const isError = progress.step === 'error'
  const isWorking = !isDone && !isError

  const progressPercent = (getStepIndex(progress.step) / (steps.length - 1)) * 100
  const colorScheme = isError ? 'red' : isDone ? 'green' : 'brand'

  return (
    <VStack spacing={4} py={2}>
      <Progress
        value={progressPercent}
        w="full"
        colorScheme={colorScheme}
        borderRadius="full"
        hasStripe={isWorking}
        isAnimated={isWorking}
        size="sm"
      />
      <HStack spacing={3} w="full">
        {isWorking && <Spinner size="sm" color="brand.400" />}
        <VStack align="start" spacing={0} flex={1}>
          <Text fontSize="sm" fontWeight="600" color={isError ? 'red.300' : isDone ? 'green.300' : 'white'}>
            {progress.message}
          </Text>
          {progress.detail && (
            <Code fontSize="xs" bg="transparent" color="whiteAlpha.600">
              {progress.detail}
            </Code>
          )}
        </VStack>
      </HStack>

      {isDone && (
        <Alert status="success" borderRadius="md" bg="green.900" border="1px solid" borderColor="green.700">
          <AlertIcon />
          Worktree created successfully!
        </Alert>
      )}
    </VStack>
  )
}

export default function CreateWorktreeModal({
  repoPath,
  settings,
  progress,
  cancelling = false,
  onConfirm,
  onCancel,
  onClose,
}: CreateWorktreeModalProps) {
  const api = useAPI()
  const [branchName, setBranchName] = useState('')
  const [createNew, setCreateNew] = useState(false)
  const [baseBranch, setBaseBranch] = useState(settings.defaultBaseBranch)
  const [branches, setBranches] = useState<BranchInfo[]>([])
  const [setupConfig, setSetupConfig] = useState<SetupConfig | null>(null)
  const [loadingBranches, setLoadingBranches] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const currentStep: ModalStep = progress ? 'progress' : 'form'
  const isWorking = submitting || (progress !== null && progress.step !== 'done' && progress.step !== 'error')
  const isDone = progress?.step === 'done'
  const isError = progress?.step === 'error'

  useEffect(() => {
    const loadData = async () => {
      const [branchList, config] = await Promise.all([
        api.branch.list(repoPath).catch(() => [] as BranchInfo[]),
        api.setup.preview(repoPath).catch(() => null),
      ])
      setBranches(branchList)
      const currentBranch = branchList.find((b) => b.isCurrent && !b.isRemote)
      setBaseBranch(currentBranch?.name ?? settings.defaultBaseBranch)
      setSetupConfig(config)
      setLoadingBranches(false)
    }
    loadData()
  }, [api, repoPath, settings])

  const validate = (): string => {
    if (!branchName.trim()) return 'Branch name is required'
    if (!/^[a-zA-Z0-9._/-]+$/.test(branchName)) return 'Invalid branch name characters'
    return ''
  }

  const handleSubmit = async () => {
    const err = validate()
    if (err) { setError(err); return }
    setError('')
    setSubmitting(true)
    await onConfirm(branchName.trim(), createNew, baseBranch)
    setSubmitting(false)
  }

  const handleCancelClick = () => {
    if (isWorking && onCancel) {
      onCancel()
    } else {
      onClose()
    }
  }

  return (
    <Modal isOpen onClose={handleCancelClick} size="lg" isCentered>
      <ModalOverlay backdropFilter="blur(4px)" bg="blackAlpha.700" />
      <ModalContent bg="gray.800" borderColor="whiteAlpha.100" border="1px solid">
        <ModalHeader pb={2}>New Worktree</ModalHeader>

        <ModalBody>
          {currentStep === 'progress' && progress ? (
            <CreateWorktreeProgress progress={progress} />
          ) : (
            <CreateWorktreeForm
              branchName={branchName}
              setBranchName={setBranchName}
              createNew={createNew}
              setCreateNew={setCreateNew}
              baseBranch={baseBranch}
              setBaseBranch={setBaseBranch}
              branches={branches}
              loadingBranches={loadingBranches}
              setupConfig={setupConfig}
              error={error}
              setError={setError}
              onSubmit={handleSubmit}
            />
          )}
        </ModalBody>

        <ModalFooter>
          <HStack spacing={3}>
            <Button
              variant="ghost"
              onClick={handleCancelClick}
              isLoading={cancelling}
              loadingText="Cancelling…"
            >
              {isDone ? 'Close' : 'Cancel'}
            </Button>
            {!isDone && !isError && (
              <Button
                colorScheme="brand"
                onClick={handleSubmit}
                isLoading={isWorking && !cancelling}
                loadingText={progress?.message ?? 'Creating worktree…'}
                isDisabled={!branchName.trim() || cancelling}
              >
                Create worktree
              </Button>
            )}
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
