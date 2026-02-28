import { useState, useEffect } from 'react'
import {
  VStack,
  Input,
  InputGroup,
  InputLeftElement,
  List,
  ListItem,
  Text,
  HStack,
  Box,
  Spinner,
} from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'
import { SearchIcon } from './Icons'
import type { BranchInfo } from '../../shared/types'

interface BranchSearchListProps {
  branches: BranchInfo[]
  selected: string | null
  onSelect: (branch: string) => void
  currentBranch?: string
  disableCurrent?: boolean
  maxH?: string
  isLoading?: boolean
}

export default function BranchSearchList({
  branches,
  selected,
  onSelect,
  currentBranch,
  disableCurrent = false,
  maxH = '240px',
  isLoading = false,
}: BranchSearchListProps) {
  const { t } = useTranslation()

  const [rawQuery, setRawQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(rawQuery)
    }, 200)
    return () => clearTimeout(timer)
  }, [rawQuery])

  const filtered = branches.filter((b) =>
    b.name.toLowerCase().includes(debouncedQuery.toLowerCase())
  )

  if (isLoading) {
    return (
      <HStack>
        <Spinner size="xs" />
        <Text fontSize="sm" color="whiteAlpha.500">Loading branches...</Text>
      </HStack>
    )
  }

  return (
    <VStack align="stretch" spacing={2}>
      <InputGroup size="sm">
        <InputLeftElement pointerEvents="none">
          <SearchIcon boxSize={3} color="whiteAlpha.400" />
        </InputLeftElement>
        <Input
          value={rawQuery}
          onChange={(e) => setRawQuery(e.target.value)}
          placeholder="Search branches..."
          bg="whiteAlpha.50"
          borderColor="whiteAlpha.200"
          fontSize="sm"
          fontFamily="mono"
        />
      </InputGroup>

      <Box
        maxH={maxH}
        overflowY="auto"
        borderRadius="md"
        border="1px solid"
        borderColor="whiteAlpha.100"
      >
        {filtered.length === 0 ? (
          <Text fontSize="sm" color="whiteAlpha.400" px={3} py={2}>
            {t('branchSearchList.noMatch', { query: debouncedQuery })}
          </Text>
        ) : (
          <List>
            {filtered.map((branch) => {
              const isCurrent = branch.name === currentBranch
              const isSelected = branch.name === selected
              const isDisabled = disableCurrent && isCurrent

              return (
                <ListItem
                  key={branch.name}
                  px={3}
                  py={2}
                  cursor={isDisabled ? 'default' : 'pointer'}
                  bg={isSelected ? 'brand.500' : isCurrent ? 'whiteAlpha.50' : 'transparent'}
                  _hover={
                    isDisabled
                      ? {}
                      : { bg: isSelected ? 'brand.600' : 'whiteAlpha.100' }
                  }
                  onClick={() => {
                    if (!isDisabled) onSelect(branch.name)
                  }}
                  borderBottom="1px solid"
                  borderColor="whiteAlpha.50"
                >
                  <HStack justify="space-between">
                    <Text fontSize="sm">{branch.name}</Text>
                    {isCurrent && (
                      <Text fontSize="xs" color="green.400">{t('branchSearchList.current')}</Text>
                    )}
                  </HStack>
                </ListItem>
              )
            })}
          </List>
        )}
      </Box>
    </VStack>
  )
}
