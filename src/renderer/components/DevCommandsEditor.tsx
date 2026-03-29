import {
  VStack,
  HStack,
  Text,
  Input,
  Badge,
  IconButton,
} from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'
import type { WorktreeWithDiff } from '../../shared/types'
import { useAPI } from '../api'
import { CloseIcon } from './Icons'
import { getBranchColor } from '../utils'

interface DevCommandsEditorProps {
  worktrees: WorktreeWithDiff[]
  devCommands: Record<string, string>
  setDevCommands: React.Dispatch<React.SetStateAction<Record<string, string>>>
}

export function DevCommandsEditor({ worktrees, devCommands, setDevCommands }: DevCommandsEditorProps) {
  const api = useAPI()
  const { t } = useTranslation()

  const handleCommandBlur = async (worktreePath: string, value: string) => {
    await api.process.saveCommand(worktreePath, value)
  }

  return (
    <VStack align="stretch" spacing={3}>
      <VStack align="stretch" spacing={0}>
        <Text fontSize="sm" fontWeight="semibold">{t('settings.runCommands.title')}</Text>
        <Text fontSize="xs" color="whiteAlpha.500">{t('settings.runCommands.helper')}</Text>
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
            placeholder={t('settings.runCommands.placeholder')}
            fontFamily="mono"
            fontSize="xs"
            size="sm"
            bg="whiteAlpha.50"
            borderColor="whiteAlpha.200"
          />
          <IconButton
            aria-label={t('settings.ariaLabels.clearCommand')}
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
  )
}
