import { Flex, VStack, HStack, Text, Code, Box, Button, Spinner } from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'
import { FolderIcon } from './Icons'
import { useAPI } from '../api'
import { useWorktree } from '../contexts/WorktreeContext'

interface NotGitRepoProps {
  path: string
}

export default function NotGitRepo({ path }: NotGitRepoProps) {
  const { t } = useTranslation()
  const api = useAPI()
  const { recentRepos, switchRepo, switching } = useWorktree()

  const handleChooseFolder = async () => {
    const picked = await api.dialog.pickFolder()
    if (picked) await switchRepo(picked)
  }

  return (
    <Flex h="100vh" align="center" justify="center" direction="column" gap={6} p={8}>
      <Box textAlign="center" maxW="480px">
        <Flex
          boxSize="64px"
          borderRadius="full"
          bg="whiteAlpha.50"
          border="1px solid"
          borderColor="whiteAlpha.200"
          align="center"
          justify="center"
          mx="auto"
          mb={4}
        >
          <FolderIcon boxSize={6} color="whiteAlpha.700" />
        </Flex>
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

      <VStack spacing={3} w="100%" maxW="480px">
        <Button
          leftIcon={switching ? <Spinner size="xs" /> : <FolderIcon boxSize={4} />}
          colorScheme="brand"
          onClick={handleChooseFolder}
          isDisabled={switching}
          w="100%"
        >
          {t('notGitRepo.chooseFolder')}
        </Button>

        {recentRepos.length > 0 && (
          <VStack spacing={1.5} align="stretch" w="100%">
            <Text fontSize="xs" color="whiteAlpha.400" fontWeight="600" textTransform="uppercase" letterSpacing="wider" pl={1}>
              {t('notGitRepo.recentRepos')}
            </Text>
            <VStack spacing={1} align="stretch" bg="whiteAlpha.50" borderRadius="md" p={2} border="1px solid" borderColor="whiteAlpha.100">
              {recentRepos.slice(0, 5).map((repo) => (
                <Button
                  key={repo.path}
                  variant="ghost"
                  size="sm"
                  justifyContent="flex-start"
                  onClick={() => switchRepo(repo.path)}
                  isDisabled={switching}
                  h="auto"
                  py={2}
                  px={2}
                >
                  <VStack align="start" spacing={0} w="100%">
                    <Text fontSize="sm" fontWeight="500">{repo.name}</Text>
                    <Text fontSize="10px" fontFamily="mono" color="whiteAlpha.500" wordBreak="break-all" textAlign="left">
                      {repo.displayPath}
                    </Text>
                  </VStack>
                </Button>
              ))}
            </VStack>
          </VStack>
        )}
      </VStack>

      <HStack spacing={2} pt={2} color="whiteAlpha.400">
        <Text fontSize="xs">{t('notGitRepo.cliHint')}</Text>
        <Code fontSize="xs" bg="whiteAlpha.100" px={2} py={0.5} borderRadius="sm" color="brand.300">
          {t('notGitRepo.cliCmd')}
        </Code>
      </HStack>
    </Flex>
  )
}
