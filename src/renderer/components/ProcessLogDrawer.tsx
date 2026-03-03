import { useEffect, useRef, useState } from 'react'
import {
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerHeader,
  DrawerOverlay,
  DrawerContent,
  Box,
  Text,
  HStack,
  Badge,
  VStack,
} from '@chakra-ui/react'
import NiceModal, { useModal } from '@ebay/nice-modal-react'
import { useTranslation } from 'react-i18next'
import type { ProcessLog } from '../../shared/types'
import { useAPI } from '../api'

interface ProcessLogDrawerProps {
  worktreePath: string
  branch: string
}

export const ProcessLogDrawer = NiceModal.create<ProcessLogDrawerProps>(({ worktreePath, branch }) => {
  const modal = useModal()
  const api = useAPI()
  const { t } = useTranslation()
  const [logs, setLogs] = useState<ProcessLog[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    api.process.getLogs(worktreePath).then(setLogs).catch(() => {})
  }, [api, worktreePath])

  useEffect(() => {
    const unsub = api.on('process:output', (data: unknown) => {
      const event = data as { worktreePath: string; line: string; isError: boolean }
      if (event.worktreePath !== worktreePath) return
      setLogs((prev) => {
        const next = [...prev, { line: event.line, isError: event.isError, ts: Date.now() }]
        return next.slice(-500)
      })
    })
    return unsub
  }, [api, worktreePath])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  return (
    <Drawer isOpen={modal.visible} onClose={modal.hide} onCloseComplete={() => modal.remove()} placement="bottom" size="md">
      <DrawerOverlay />
      <DrawerContent bg="gray.900" borderTop="1px solid" borderColor="whiteAlpha.100">
        <DrawerCloseButton color="whiteAlpha.600" />
        <DrawerHeader py={3} px={4} borderBottom="1px solid" borderColor="whiteAlpha.100">
          <HStack spacing={2}>
            <Text fontSize="sm" fontWeight="600" color="whiteAlpha.900">{t('processLog.title')}</Text>
            <Badge colorScheme="gray" variant="subtle" fontSize="xs" fontFamily="mono" maxW="300px" isTruncated>
              {branch}
            </Badge>
          </HStack>
        </DrawerHeader>
        <DrawerBody p={0}>
          <Box
            h="320px"
            overflowY="auto"
            bg="gray.950"
            fontFamily="mono"
            fontSize="11px"
            px={4}
            py={3}
          >
            {logs.length === 0 ? (
              <Text color="whiteAlpha.300" fontStyle="italic">{t('processLog.noOutput')}</Text>
            ) : (
              <VStack align="start" spacing={0}>
                {logs.map((log, i) => (
                  <Text
                    key={i}
                    color={log.isError ? 'red.300' : 'whiteAlpha.800'}
                    whiteSpace="pre-wrap"
                    wordBreak="break-all"
                    lineHeight="1.6"
                  >
                    {log.line}
                  </Text>
                ))}
                <Box ref={bottomRef} />
              </VStack>
            )}
          </Box>
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  )
})
