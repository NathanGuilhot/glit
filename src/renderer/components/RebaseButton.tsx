import { useState } from 'react'
import { Button, useToast } from '@chakra-ui/react'
import { useWorktree } from '../contexts/WorktreeContext'
import { useAPI } from '../api'

export default function RebaseButton() {
  const { repoInfo, worktrees, detectedBaseBranch } = useWorktree()
  const api = useAPI()
  const toast = useToast()
  const [loading, setLoading] = useState(false)

  if (!repoInfo?.isRepo || !detectedBaseBranch) return null

  const rootWorktree = worktrees.find((wt) => wt.path === repoInfo.path)
  if (
    !rootWorktree ||
    rootWorktree.isBare ||
    !rootWorktree.branch ||
    rootWorktree.branch.startsWith('detached:') ||
    rootWorktree.branch === detectedBaseBranch
  ) return null

  const handleRebase = async () => {
    setLoading(true)
    try {
      const result = await api.branch.rebaseOnto(repoInfo.path, detectedBaseBranch)
      if (result.success) {
        toast({ title: `Rebased onto ${detectedBaseBranch}`, status: 'success', duration: 3000 })
      } else {
        toast({
          title: 'Rebase failed',
          description: result.error,
          status: 'error',
          duration: 5000,
          isClosable: true,
        })
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      size="sm"
      variant="ghost"
      colorScheme="purple"
      onClick={handleRebase}
      isLoading={loading}
      loadingText="Rebasing…"
    >
      Rebase onto {detectedBaseBranch}
    </Button>
  )
}
