import {
  Box,
  HStack,
  VStack,
  Skeleton,
} from '@chakra-ui/react'

export function WorktreeCardSkeleton() {
  return (
    <Box
      bg="whiteAlpha.50"
      border="1px solid"
      borderColor="whiteAlpha.100"
      borderRadius="lg"
      px={4}
      py={3}
    >
      <HStack spacing={3} align="start">
        <VStack align="start" spacing={2} flex={1}>
          <Skeleton height="18px" width="120px" borderRadius="md" startColor="whiteAlpha.100" endColor="whiteAlpha.200" />
          <Skeleton height="11px" width="220px" borderRadius="md" startColor="whiteAlpha.50" endColor="whiteAlpha.150" />
          <Skeleton height="10px" width="80px" borderRadius="md" startColor="whiteAlpha.50" endColor="whiteAlpha.100" />
        </VStack>
        <HStack spacing={2} flexShrink={0} alignItems="center">
          <Skeleton height="14px" width="50px" borderRadius="md" startColor="whiteAlpha.50" endColor="whiteAlpha.150" />
        </HStack>
      </HStack>
    </Box>
  )
}
