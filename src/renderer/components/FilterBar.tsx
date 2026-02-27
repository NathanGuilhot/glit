import { useRef } from 'react'
import { Box, Input, InputGroup, InputLeftElement } from '@chakra-ui/react'
import { SearchIcon } from './Icons'
import { useWorktree } from '../contexts/WorktreeContext'

export default function FilterBar() {
  const { filter, setFilter } = useWorktree()
  const filterRef = useRef<HTMLInputElement>(null)

  return (
    <Box px={5} pb={3} flexShrink={0}>
      <InputGroup size="sm">
        <InputLeftElement pointerEvents="none" color="whiteAlpha.400">
          <SearchIcon />
        </InputLeftElement>
        <Input
          ref={filterRef}
          placeholder="Filter by branch or path… (/)"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          bg="whiteAlpha.50"
          border="1px solid"
          borderColor="whiteAlpha.100"
          _focus={{ borderColor: 'brand.400', bg: 'whiteAlpha.100' }}
          _placeholder={{ color: 'whiteAlpha.300' }}
          borderRadius="md"
          fontFamily="mono"
          fontSize="xs"
        />
      </InputGroup>
    </Box>
  )
}
