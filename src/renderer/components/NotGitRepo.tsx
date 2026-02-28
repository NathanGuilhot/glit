import { Flex, VStack, Text, Code, Box, Badge } from '@chakra-ui/react'
import { useTranslation, Trans } from 'react-i18next'

interface NotGitRepoProps {
  path: string
}

export default function NotGitRepo({ path }: NotGitRepoProps) {
  const { t } = useTranslation()

  return (
    <Flex h="100vh" align="center" justify="center" direction="column" gap={6} p={8}>
      <Box textAlign="center">
        <Text fontSize="4xl" mb={2}>🌿</Text>
        <Text fontSize="xl" fontWeight="700" mb={1}>
          {t('notGitRepo.title')}
        </Text>
        <Text fontSize="sm" color="whiteAlpha.500" mb={4}>
          {t('notGitRepo.subtitle')}
        </Text>

        <VStack spacing={2} align="start" bg="whiteAlpha.50" borderRadius="lg" p={4} border="1px solid" borderColor="whiteAlpha.100">
          <Text fontSize="xs" color="whiteAlpha.500" fontWeight="600" textTransform="uppercase" letterSpacing="wider">
            {t('notGitRepo.currentPath')}
          </Text>
          <Code fontSize="xs" bg="transparent" color="whiteAlpha.700" wordBreak="break-all" textAlign="left">
            {path}
          </Code>
        </VStack>
      </Box>

      <VStack spacing={2} align="start">
        <Text fontSize="xs" color="whiteAlpha.400" fontWeight="600" textTransform="uppercase" letterSpacing="wider">
          {t('notGitRepo.howToUse')}
        </Text>
        <Box bg="gray.800" borderRadius="md" p={3} border="1px solid" borderColor="whiteAlpha.100">
          <VStack align="start" spacing={1.5}>
            <HintRow cmd={t('notGitRepo.hints.navigateCmd')} label={t('notGitRepo.hints.navigate')} />
            <HintRow cmd={t('notGitRepo.hints.launchCmd')} label={t('notGitRepo.hints.launch')} />
          </VStack>
        </Box>
        <Text fontSize="xs" color="whiteAlpha.400">
          <Trans i18nKey="notGitRepo.directRun">
            Or run <Code fontSize="xs" bg="transparent">glit /path/to/repo</Code> directly
          </Trans>
        </Text>
      </VStack>

      <Badge colorScheme="orange" variant="subtle" fontSize="xs">
        {t('notGitRepo.noWorktrees')}
      </Badge>
    </Flex>
  )
}

function HintRow({ cmd, label }: { cmd: string; label: string }) {
  return (
    <Flex align="center" gap={3}>
      <Code fontSize="xs" bg="whiteAlpha.100" px={2} py={0.5} borderRadius="sm" color="brand.300">
        {cmd}
      </Code>
      <Text fontSize="xs" color="whiteAlpha.500">{label}</Text>
    </Flex>
  )
}
