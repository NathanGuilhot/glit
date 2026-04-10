import { useEffect, useMemo, useState } from 'react'
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  Box,
  Text,
  HStack,
  VStack,
  Badge,
  Spinner,
  useToast,
  Tooltip,
} from '@chakra-ui/react'
import NiceModal, { useModal } from '@ebay/nice-modal-react'
import { useTranslation } from 'react-i18next'
import type { CommitEntry, CommitCategory } from '../../shared/types'
import { useAPI } from '../api'

interface CommitsModalProps {
  worktreePath: string
  branch: string
  baseBranch?: string
}

interface CategoryStyle {
  rowBg: string
  borderColor: string
  textColor: string
  hashColor: string
  dotBg: string
  dotBorder: string
  dotSize: string
}

const STYLES: Record<CommitCategory, CategoryStyle> = {
  unique: {
    rowBg: 'whiteAlpha.50',
    borderColor: 'brand.400',
    textColor: 'whiteAlpha.900',
    hashColor: 'whiteAlpha.700',
    dotBg: 'brand.400',
    dotBorder: 'brand.400',
    dotSize: '7px',
  },
  shared: {
    rowBg: 'transparent',
    borderColor: 'whiteAlpha.200',
    textColor: 'whiteAlpha.700',
    hashColor: 'whiteAlpha.500',
    dotBg: 'transparent',
    dotBorder: 'brand.400',
    dotSize: '7px',
  },
  base: {
    rowBg: 'transparent',
    borderColor: 'transparent',
    textColor: 'whiteAlpha.500',
    hashColor: 'whiteAlpha.400',
    dotBg: 'whiteAlpha.300',
    dotBorder: 'whiteAlpha.300',
    dotSize: '4px',
  },
}

function LegendDot({ category }: { category: CommitCategory }) {
  const s = STYLES[category]
  return (
    <Box
      w={s.dotSize}
      h={s.dotSize}
      borderRadius="full"
      bg={s.dotBg}
      border="1.5px solid"
      borderColor={s.dotBorder}
      flexShrink={0}
    />
  )
}

export const CommitsModal = NiceModal.create<CommitsModalProps>(({ worktreePath, branch, baseBranch }) => {
  const modal = useModal()
  const api = useAPI()
  const { t } = useTranslation()
  const toast = useToast()
  const [commits, setCommits] = useState<CommitEntry[] | null>(null)

  useEffect(() => {
    if (!modal.visible) return
    let cancelled = false
    setCommits(null)
    api.git
      .getCommits(worktreePath, baseBranch)
      .then((result) => {
        if (!cancelled) setCommits(result)
      })
      .catch(() => {
        if (!cancelled) setCommits([])
      })
    return () => {
      cancelled = true
    }
  }, [api, worktreePath, baseBranch, modal.visible])

  const copyHash = (hash: string) => {
    void api.clipboard.copy(hash)
    toast({ title: t('commits.toast.hashCopied'), status: 'success', duration: 1500 })
  }

  const showHighlight = !!baseBranch && baseBranch !== branch
  const hasShared = useMemo(() => commits?.some((c) => c.category === 'shared') ?? false, [commits])
  const hasUnique = useMemo(() => commits?.some((c) => c.category === 'unique') ?? false, [commits])

  return (
    <Modal
      isOpen={modal.visible}
      onClose={modal.hide}
      onCloseComplete={() => modal.remove()}
      size="lg"
      isCentered
      scrollBehavior="inside"
    >
      <ModalOverlay backdropFilter="blur(4px)" bg="blackAlpha.700" />
      <ModalContent bg="gray.800" borderColor="whiteAlpha.100" border="1px solid" maxH="85vh">
        <ModalHeader py={3} px={4} borderBottom="1px solid" borderColor="whiteAlpha.100">
          <VStack align="start" spacing={2}>
            <HStack spacing={2}>
              <Text fontSize="sm" fontWeight="600" color="whiteAlpha.900">
                {t('commits.title')}
              </Text>
              <Badge colorScheme="gray" variant="subtle" fontSize="xs" fontFamily="mono" maxW="280px" isTruncated>
                {branch}
              </Badge>
            </HStack>
            {showHighlight && (
              <VStack align="start" spacing={1}>
                <Text fontSize="11px" color="whiteAlpha.500">
                  {t('commits.vsBase', { base: baseBranch })}
                </Text>
                {(hasUnique || hasShared) && (
                  <HStack spacing={3} fontSize="10px" color="whiteAlpha.500">
                    {hasUnique && (
                      <HStack spacing={1.5}>
                        <LegendDot category="unique" />
                        <Text>{t('commits.legendUnique')}</Text>
                      </HStack>
                    )}
                    {hasShared && (
                      <HStack spacing={1.5}>
                        <LegendDot category="shared" />
                        <Text>{t('commits.legendShared')}</Text>
                      </HStack>
                    )}
                  </HStack>
                )}
              </VStack>
            )}
          </VStack>
        </ModalHeader>
        <ModalCloseButton color="whiteAlpha.600" top={3} />
        <ModalBody p={0}>
          {commits === null ? (
            <HStack justify="center" py={10}>
              <Spinner size="sm" color="whiteAlpha.600" />
              <Text fontSize="sm" color="whiteAlpha.500">
                {t('commits.loading')}
              </Text>
            </HStack>
          ) : commits.length === 0 ? (
            <Box py={10} textAlign="center">
              <Text fontSize="sm" color="whiteAlpha.400" fontStyle="italic">
                {t('commits.empty')}
              </Text>
            </Box>
          ) : (
            <VStack align="stretch" spacing={0} py={1}>
              {commits.map((c) => {
                const category: CommitCategory = showHighlight ? c.category : 'base'
                const s = STYLES[category]
                return (
                  <HStack
                    key={c.hash}
                    spacing={3}
                    px={4}
                    py={2}
                    align="center"
                    bg={s.rowBg}
                    borderLeft="2px solid"
                    borderLeftColor={s.borderColor}
                    _hover={{ bg: 'whiteAlpha.100' }}
                    transition="background 0.1s"
                  >
                    <Box
                      w={s.dotSize}
                      h={s.dotSize}
                      borderRadius="full"
                      bg={s.dotBg}
                      border="1.5px solid"
                      borderColor={s.dotBorder}
                      flexShrink={0}
                    />
                    <Tooltip label={c.hash} placement="top" openDelay={300}>
                      <Text
                        fontSize="11px"
                        fontFamily="mono"
                        color={s.hashColor}
                        cursor="pointer"
                        _hover={{ color: 'brand.300' }}
                        onClick={() => copyHash(c.hash)}
                        flexShrink={0}
                      >
                        {c.shortHash}
                      </Text>
                    </Tooltip>
                    <Text
                      fontSize="13px"
                      color={s.textColor}
                      noOfLines={1}
                      flex={1}
                      minW={0}
                    >
                      {c.subject}
                    </Text>
                    <Text fontSize="10px" color="whiteAlpha.400" flexShrink={0} noOfLines={1} maxW="150px">
                      {c.author} · {c.relativeDate}
                    </Text>
                  </HStack>
                )
              })}
            </VStack>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  )
})

export default CommitsModal
