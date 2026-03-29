import {
  VStack,
  HStack,
  Text,
  Input,
  Button,
  Badge,
  IconButton,
} from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'
import { CloseIcon } from './Icons'

interface SetupConfigEditorProps {
  packages: string[]
  setPackages: React.Dispatch<React.SetStateAction<string[]>>
  envFiles: string[]
  setEnvFiles: React.Dispatch<React.SetStateAction<string[]>>
  commands: string[]
  setCommands: React.Dispatch<React.SetStateAction<string[]>>
  onBrowse: () => Promise<string | null>
}

function updateItem(setter: React.Dispatch<React.SetStateAction<string[]>>, index: number, value: string) {
  setter((prev) => prev.map((v, i) => (i === index ? value : v)))
}

function removeItem(setter: React.Dispatch<React.SetStateAction<string[]>>, index: number) {
  setter((prev) => prev.filter((_, i) => i !== index))
}

function addItem(setter: React.Dispatch<React.SetStateAction<string[]>>) {
  setter((prev) => [...prev, ''])
}

function ListEditor({
  label,
  placeholder,
  items,
  setter,
  onBrowse,
}: {
  label: string
  placeholder: string
  items: string[]
  setter: React.Dispatch<React.SetStateAction<string[]>>
  onBrowse?: () => Promise<string | null>
}) {
  const { t } = useTranslation()

  return (
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
              {t('settings.browse')}
            </Button>
          )}
          <IconButton
            aria-label={t('settings.ariaLabels.remove')}
            icon={<CloseIcon />}
            size="sm"
            variant="ghost"
            colorScheme="red"
            onClick={() => removeItem(setter, i)}
          />
        </HStack>
      ))}
      <Button size="xs" variant="ghost" onClick={() => addItem(setter)} alignSelf="flex-start" color="whiteAlpha.500" _hover={{ color: 'whiteAlpha.800' }}>
        {t('settings.add')}
      </Button>
    </VStack>
  )
}

export function SetupConfigEditor({
  packages,
  setPackages,
  envFiles,
  setEnvFiles,
  commands,
  setCommands,
  onBrowse,
}: SetupConfigEditorProps) {
  const { t } = useTranslation()

  return (
    <VStack align="stretch" spacing={3}>
      <HStack spacing={2}>
        <Text fontSize="sm" fontWeight="semibold">{t('settings.setupScript.label')}</Text>
        <Badge colorScheme="gray" variant="subtle" fontSize="xs" fontFamily="mono">{t('settings.setupScript.badge')}</Badge>
      </HStack>
      <Text fontSize="xs" color="whiteAlpha.500">
        {t('settings.setupScript.helper')}
      </Text>

      <ListEditor label={t('settings.lists.packages')} placeholder={t('settings.placeholders.npmInstall')} items={packages} setter={setPackages} />
      <ListEditor label={t('settings.lists.envFiles')} placeholder={t('settings.placeholders.envFile')} items={envFiles} setter={setEnvFiles} onBrowse={onBrowse} />
      <ListEditor label={t('settings.lists.commands')} placeholder={t('settings.placeholders.command')} items={commands} setter={setCommands} />
    </VStack>
  )
}
