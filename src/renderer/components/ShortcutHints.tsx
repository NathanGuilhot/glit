import { Box, HStack, Text } from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'

export default function ShortcutHints() {
  const { t } = useTranslation()

  const shortcuts = [
    ['⌘K', t('shortcutHints.palette')],
    ['c', t('shortcutHints.create')],
    ['r', t('shortcutHints.refresh')],
    ['/', t('shortcutHints.filter')],
    ['⌘,', t('shortcutHints.settings')],
  ]

  return (
    <Box px={5} py={2} borderTop="1px solid" borderColor="whiteAlpha.50" flexShrink={0}>
      <HStack spacing={4} justify="center" flexWrap="wrap" gap={[1, 2]}>
        {shortcuts.map(([key, label]) => (
          <HStack key={key} spacing={1}>
            <Text
              fontSize="10px"
              fontFamily="mono"
              bg="whiteAlpha.100"
              px={1.5}
              py={0.5}
              borderRadius="sm"
              color="whiteAlpha.600"
            >
              {key}
            </Text>
            <Text fontSize="10px" color="whiteAlpha.400">{label}</Text>
          </HStack>
        ))}
      </HStack>
    </Box>
  )
}
