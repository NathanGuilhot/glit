import { Flex, VStack, Text, Code, Box, Badge } from '@chakra-ui/react'

interface NotGitRepoProps {
  path: string
}

export default function NotGitRepo({ path }: NotGitRepoProps) {
  return (
    <Flex h="100vh" align="center" justify="center" direction="column" gap={6} p={8}>
      <Box textAlign="center">
        <Text fontSize="4xl" mb={2}>🌿</Text>
        <Text fontSize="xl" fontWeight="700" mb={1}>
          Not a git repository
        </Text>
        <Text fontSize="sm" color="whiteAlpha.500" mb={4}>
          Glit needs to be run from inside a git repository
        </Text>

        <VStack spacing={2} align="start" bg="whiteAlpha.50" borderRadius="lg" p={4} border="1px solid" borderColor="whiteAlpha.100">
          <Text fontSize="xs" color="whiteAlpha.500" fontWeight="600" textTransform="uppercase" letterSpacing="wider">
            Current path
          </Text>
          <Code fontSize="xs" bg="transparent" color="whiteAlpha.700" wordBreak="break-all" textAlign="left">
            {path}
          </Code>
        </VStack>
      </Box>

      <VStack spacing={2} align="start">
        <Text fontSize="xs" color="whiteAlpha.400" fontWeight="600" textTransform="uppercase" letterSpacing="wider">
          How to use Glit
        </Text>
        <Box bg="gray.800" borderRadius="md" p={3} border="1px solid" borderColor="whiteAlpha.100">
          <VStack align="start" spacing={1.5}>
            <HintRow cmd="cd /path/to/your/repo" label="Navigate to a git repo" />
            <HintRow cmd="glit" label="Launch Glit" />
          </VStack>
        </Box>
        <Text fontSize="xs" color="whiteAlpha.400">
          Or run <Code fontSize="xs" bg="transparent">glit /path/to/repo</Code> directly
        </Text>
      </VStack>

      <Badge colorScheme="orange" variant="subtle" fontSize="xs">
        No worktrees to manage
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
