import React, { useEffect, useState, useCallback } from 'react'
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  HStack,
  VStack,
  Checkbox,
  Text,
  Spinner,
  Divider,
  useToast,
} from '@chakra-ui/react'
import NiceModal, { useModal } from '@ebay/nice-modal-react'
import { useAPI } from '../api'

const CleanBranchesModal = NiceModal.create<{
  repoPath: string
  baseBranch: string
}>(({ repoPath, baseBranch }) => {
  const modal = useModal()
  const api = useAPI()
  const toast = useToast()
  const [branches, setBranches] = useState<string[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)

  const [mergeRefLabel, setMergeRefLabel] = useState(baseBranch)

  useEffect(() => {
    api.worktree.getMergedBranches(repoPath, baseBranch).then((result) => {
      setBranches(result.branches)
      setSelected(new Set(result.branches))
      setMergeRefLabel(result.mergeRefLabel)
      setLoading(false)
    })
  }, [api, repoPath, baseBranch])

  const toggleBranch = useCallback((name: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }, [])

  const handleConfirm = useCallback(async () => {
    setDeleting(true)
    let deleted = 0
    let failed = 0
    for (const name of selected) {
      try {
        await api.branch.delete(repoPath, name)
        deleted++
      } catch {
        failed++
      }
    }
    setDeleting(false)
    if (failed === 0) {
      toast({ title: `Deleted ${deleted} branch${deleted !== 1 ? 'es' : ''}`, status: 'success', duration: 3000 })
    } else {
      toast({ title: `Deleted ${deleted}, failed ${failed}`, status: 'warning', duration: 4000 })
    }
    modal.hide()
  }, [api, repoPath, selected, toast, modal])

  const allSelected = branches.length > 0 && selected.size === branches.length
  const noneSelected = selected.size === 0

  return (
    <Modal isOpen={modal.visible} onClose={modal.hide} size="sm" isCentered>
      <ModalOverlay backdropFilter="blur(4px)" bg="blackAlpha.700" />
      <ModalContent bg="gray.800" borderColor="whiteAlpha.100" border="1px solid">
        <ModalHeader pb={2} fontSize="md">Clean merged branches</ModalHeader>
        <ModalBody>
          {loading ? (
            <HStack justify="center" py={4}>
              <Spinner size="sm" />
              <Text fontSize="sm" color="whiteAlpha.600">Finding merged branches…</Text>
            </HStack>
          ) : branches.length === 0 ? (
            <Text fontSize="sm" color="whiteAlpha.600">No local branches merged into <Text as="span" fontFamily="mono">{mergeRefLabel}</Text>.</Text>
          ) : (
            <VStack align="stretch" spacing={2}>
              <Text fontSize="xs" color="whiteAlpha.500">
                Branches merged into <Text as="span" fontFamily="mono">{mergeRefLabel}</Text>:
              </Text>
              <HStack spacing={2}>
                <Button size="xs" variant="ghost" onClick={() => setSelected(new Set(branches))} isDisabled={allSelected}>All</Button>
                <Button size="xs" variant="ghost" onClick={() => setSelected(new Set())} isDisabled={noneSelected}>None</Button>
              </HStack>
              <Divider borderColor="whiteAlpha.100" />
              <VStack align="stretch" spacing={1} maxH="200px" overflowY="auto">
                {branches.map((name) => (
                  <Checkbox
                    key={name}
                    isChecked={selected.has(name)}
                    onChange={() => toggleBranch(name)}
                    size="sm"
                    fontFamily="mono"
                    fontSize="sm"
                  >
                    {name}
                  </Checkbox>
                ))}
              </VStack>
            </VStack>
          )}
        </ModalBody>
        <ModalFooter>
          <HStack spacing={3}>
            <Button variant="ghost" onClick={modal.hide} isDisabled={deleting}>Cancel</Button>
            {branches.length > 0 && (
              <Button
                colorScheme="red"
                isDisabled={noneSelected || deleting}
                isLoading={deleting}
                onClick={handleConfirm}
              >
                Delete {selected.size} branch{selected.size !== 1 ? 'es' : ''}
              </Button>
            )}
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
})

export default CleanBranchesModal
