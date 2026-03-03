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
  Alert,
  AlertIcon,
  Box,
  Code,
  Badge,
  Divider,
  Spinner,
  Progress,
  useToast,
} from '@chakra-ui/react'
import NiceModal, { useModal } from '@ebay/nice-modal-react'
import { useTranslation } from 'react-i18next'
import type { SetupConfig, CreateProgress, BranchInfo } from '../../shared/types'
import { useAPI } from '../api'
import { useWorktree } from '../contexts/WorktreeContext'
import BranchSearchList from './BranchSearchList'

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
  const { t } = useTranslation()

  const hasSetup = setupConfig && (
    (setupConfig.packages?.length ?? 0) > 0 ||
    (setupConfig.envFiles?.length ?? 0) > 0 ||
    (setupConfig.commands?.length ?? 0) > 0
  )

  return (
    <VStack spacing={4}>
      <FormControl isInvalid={!!error}>
        <FormLabel fontSize="sm">{t('createWorktree.fields.branchName')}</FormLabel>
        <Input
          value={branchName}
          onChange={(e) => { setBranchName(e.target.value); setError('') }}
          placeholder={createNew ? t('createWorktree.placeholders.newBranch') : t('createWorktree.placeholders.existingBranch')}
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
          <FormLabel fontSize="sm" mb={0}>{t('createWorktree.fields.createNewBranch')}</FormLabel>
          <Switch
            isChecked={createNew}
            onChange={(e) => setCreateNew(e.target.checked)}
            colorScheme="brand"
          />
        </HStack>
      </FormControl>

      {createNew && (
        <FormControl>
          <FormLabel fontSize="sm">{t('createWorktree.fields.baseBranch')}</FormLabel>
          <BranchSearchList
            branches={branches.filter((b) => !b.isRemote)}
            selected={baseBranch}
            onSelect={setBaseBranch}
            currentBranch={branches.find((b) => b.isCurrent && !b.isRemote)?.name}
            isLoading={loadingBranches}
            maxH="200px"
          />
        </FormControl>
      )}

      {hasSetup && (
        <>
          <Divider borderColor="whiteAlpha.100" />
          <Box w="full">
            <HStack mb={2}>
              <Text fontSize="sm" fontWeight="600">{t('createWorktree.setupScript')}</Text>
              <Badge colorScheme="blue" variant="subtle" fontSize="xs">{t('createWorktree.badges.setupYaml')}</Badge>
            </HStack>
            <VStack align="start" spacing={1}>
              {(setupConfig?.packages ?? []).length > 0 && (
                <HStack>
                  <Badge colorScheme="green" variant="outline" fontSize="9px">{t('createWorktree.badges.packages')}</Badge>
                  <Code fontSize="xs" bg="transparent" color="whiteAlpha.600">
                    {setupConfig?.packages?.join(', ')}
                  </Code>
                </HStack>
              )}
              {(setupConfig?.envFiles ?? []).length > 0 && (
                <HStack>
                  <Badge colorScheme="yellow" variant="outline" fontSize="9px">{t('createWorktree.badges.envFiles')}</Badge>
                  <Code fontSize="xs" bg="transparent" color="whiteAlpha.600">
                    {setupConfig?.envFiles?.join(', ')}
                  </Code>
                </HStack>
              )}
              {(setupConfig?.commands ?? []).map((cmd: string, i: number) => (
                <HStack key={i}>
                  <Badge colorScheme="purple" variant="outline" fontSize="9px">{t('createWorktree.badges.cmd')}</Badge>
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
  const { t } = useTranslation()
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
          {t('createWorktree.progress.success')}
        </Alert>
      )}
    </VStack>
  )
}

const CreateWorktreeModal = NiceModal.create<{
  repoPath: string
  detectedBaseBranch: string
  initialBranchName?: string
}>(({ repoPath, detectedBaseBranch, initialBranchName = '' }) => {
  const modal = useModal()
  const api = useAPI()
  const toast = useToast()
  const { t } = useTranslation()
  const { createProgress, setCreateProgress, refresh } = useWorktree()

  const [branchName, setBranchName] = useState(initialBranchName)
  const [createNew, setCreateNew] = useState(!!initialBranchName)
  const [baseBranch, setBaseBranch] = useState(detectedBaseBranch)
  const [branches, setBranches] = useState<BranchInfo[]>([])
  const [setupConfig, setSetupConfig] = useState<SetupConfig | null>(null)
  const [loadingBranches, setLoadingBranches] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [error, setError] = useState('')

  const currentStep: ModalStep = createProgress ? 'progress' : 'form'
  const isWorking = submitting || (createProgress !== null && createProgress.step !== 'done' && createProgress.step !== 'error')
  const isDone = createProgress?.step === 'done'
  const isError = createProgress?.step === 'error'

  useEffect(() => {
    const loadData = async () => {
      const [branchList, config] = await Promise.all([
        api.branch.list(repoPath).catch(() => [] as BranchInfo[]),
        api.setup.preview(repoPath).catch(() => null),
      ])
      setBranches(branchList)
      const currentBranch = branchList.find((b) => b.isCurrent && !b.isRemote)
      setBaseBranch(currentBranch?.name ?? detectedBaseBranch)
      setSetupConfig(config)
      setLoadingBranches(false)
    }
    loadData()
  }, [api, repoPath, detectedBaseBranch])

  const validate = (): string => {
    if (!branchName.trim()) return t('createWorktree.validation.required')
    if (!/^[a-zA-Z0-9._/-]+$/.test(branchName)) return t('createWorktree.validation.invalidChars')
    return ''
  }

  const handleSubmit = async () => {
    const err = validate()
    if (err) { setError(err); return }
    setError('')
    setSubmitting(true)
    setCancelling(false)
    setCreateProgress({ step: 'creating', message: 'Starting...' })
    const result = await api.worktree.create({
      repoPath,
      branchName: branchName.trim(),
      createNewBranch: createNew,
      baseBranch: baseBranch || undefined,
    })
    setSubmitting(false)
    if (result.success) {
      toast({ title: t('createWorktree.toast.created'), description: result.worktree?.path, status: 'success', duration: 3000 })
      setCreateProgress(null)
      refresh()
      modal.hide()
    } else if (result.error !== 'cancelled') {
      toast({ title: t('createWorktree.toast.createFailed'), description: result.error, status: 'error', duration: 5000, isClosable: true })
      setCreateProgress(null)
    } else {
      setCreateProgress(null)
      setCancelling(false)
      modal.hide()
    }
  }

  const handleCancelClick = () => {
    if (isWorking) {
      setCancelling(true)
      void api.worktree.cancelCreate()
    } else {
      setCreateProgress(null)
      modal.hide()
    }
  }

  return (
    <Modal isOpen={modal.visible} onClose={handleCancelClick} onCloseComplete={() => modal.remove()} size="lg" isCentered>
      <ModalOverlay backdropFilter="blur(4px)" bg="blackAlpha.700" />
      <ModalContent bg="gray.800" borderColor="whiteAlpha.100" border="1px solid">
        <ModalHeader pb={2}>{t('createWorktree.title')}</ModalHeader>

        <ModalBody>
          {currentStep === 'progress' && createProgress ? (
            <CreateWorktreeProgress progress={createProgress} />
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
              loadingText={t('createWorktree.buttons.cancelling')}
            >
              {isDone ? t('createWorktree.buttons.close') : t('createWorktree.buttons.cancel')}
            </Button>
            {!isDone && !isError && (
              <Button
                colorScheme="brand"
                onClick={handleSubmit}
                isLoading={isWorking && !cancelling}
                loadingText={createProgress?.message ?? t('createWorktree.buttons.creating')}
                isDisabled={!branchName.trim() || cancelling}
              >
                {t('createWorktree.buttons.create')}
              </Button>
            )}
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
})

export default CreateWorktreeModal
