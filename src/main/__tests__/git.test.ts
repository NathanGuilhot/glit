import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { existsSync } from 'fs'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { createTestRepo, git, createCommit, createBranch, switchBranch, createSetupConfig, type TestRepo } from './helpers.js'
import {
  runGitCommand,
  getWorktrees,
  getWorktreeDiff,
  getAheadBehind,
  getWorktreeLastActivity,
  getLocalBranchNames,
  getBranches,
  getDefaultBranch,
  createWorktree,
  deleteWorktree,
  syncWorktree,
  checkoutBranch,
  deleteBranch,
  rebaseOnto,
  getMergedBranches,
  runSetupSteps,
  shortenPathForDisplay,
} from '../git.js'

// ─── runGitCommand ──────────────────────────────────────────────────────────

describe('runGitCommand', () => {
  let repo: TestRepo

  beforeAll(async () => { repo = await createTestRepo() })
  afterAll(async () => { await repo.cleanup() })

  it('executes a git command and returns stdout', async () => {
    const output = await runGitCommand(repo.repoPath, ['rev-parse', '--show-toplevel'])
    expect(output.trim()).toBe(repo.repoPath)
  })

  it('throws on invalid git command', async () => {
    await expect(runGitCommand(repo.repoPath, ['not-a-real-command'])).rejects.toThrow()
  })
})

// ─── getWorktrees ───────────────────────────────────────────────────────────

describe('getWorktrees', () => {
  let repo: TestRepo

  beforeAll(async () => { repo = await createTestRepo() })
  afterAll(async () => { await repo.cleanup() })

  it('lists the main worktree for a fresh repo', async () => {
    const worktrees = await getWorktrees(repo.repoPath)
    expect(worktrees.length).toBeGreaterThanOrEqual(1)
    expect(worktrees[0]!.path).toBe(repo.repoPath)
    expect(worktrees[0]!.branch).toBe('main')
    expect(worktrees[0]!.isBare).toBe(false)
  })

  it('lists multiple worktrees after adding one', async () => {
    const wtPath = path.join(repo.repoPath, '..', 'wt-feature')
    git(repo.repoPath, `worktree add -b feature-a ${wtPath}`)

    const worktrees = await getWorktrees(repo.repoPath)
    expect(worktrees.length).toBe(2)

    const featureWt = worktrees.find(wt => wt.branch === 'feature-a')
    expect(featureWt).toBeDefined()
    expect(featureWt!.path).toBe(wtPath)

    // Cleanup
    git(repo.repoPath, `worktree remove ${wtPath}`)
    git(repo.repoPath, 'branch -D feature-a')
  })

  it('parses detached HEAD worktrees', async () => {
    const wtPath = path.join(repo.repoPath, '..', 'wt-detached')
    git(repo.repoPath, `worktree add --detach ${wtPath}`)

    const worktrees = await getWorktrees(repo.repoPath)
    const detached = worktrees.find(wt => wt.branch.startsWith('detached:'))
    expect(detached).toBeDefined()
    expect(detached!.branch).toMatch(/^detached:[0-9a-f]{8}$/)

    git(repo.repoPath, `worktree remove ${wtPath}`)
  })

  it('detects locked worktrees', async () => {
    const wtPath = path.join(repo.repoPath, '..', 'wt-locked')
    git(repo.repoPath, `worktree add -b locked-branch ${wtPath}`)
    git(repo.repoPath, `worktree lock ${wtPath}`)

    const worktrees = await getWorktrees(repo.repoPath)
    const locked = worktrees.find(wt => wt.branch === 'locked-branch')
    expect(locked).toBeDefined()
    expect(locked!.isLocked).toBe(true)

    git(repo.repoPath, `worktree unlock ${wtPath}`)
    git(repo.repoPath, `worktree remove ${wtPath}`)
    git(repo.repoPath, 'branch -D locked-branch')
  })
})

// ─── createWorktree ─────────────────────────────────────────────────────────

describe('createWorktree', () => {
  let repo: TestRepo

  beforeAll(async () => { repo = await createTestRepo() })
  afterAll(async () => { await repo.cleanup() })

  it('creates a worktree with a new branch', async () => {
    const wtPath = path.join(repo.repoPath, '..', 'wt-new-branch')
    const result = await createWorktree(repo.repoPath, {
      repoPath: repo.repoPath,
      branchName: 'new-feature',
      createNewBranch: true,
      worktreePath: wtPath,
    })

    expect(result.worktreePath).toBe(wtPath)
    expect(result.branch).toBe('new-feature')
    expect(existsSync(wtPath)).toBe(true)

    const worktrees = await getWorktrees(repo.repoPath)
    expect(worktrees.find(wt => wt.branch === 'new-feature')).toBeDefined()

    git(repo.repoPath, `worktree remove ${wtPath}`)
    git(repo.repoPath, 'branch -D new-feature')
  })

  it('creates a worktree from an existing branch', async () => {
    git(repo.repoPath, 'branch existing-branch')
    const wtPath = path.join(repo.repoPath, '..', 'wt-existing')

    const result = await createWorktree(repo.repoPath, {
      repoPath: repo.repoPath,
      branchName: 'existing-branch',
      createNewBranch: false,
      worktreePath: wtPath,
    })

    expect(result.worktreePath).toBe(wtPath)
    expect(existsSync(wtPath)).toBe(true)

    git(repo.repoPath, `worktree remove ${wtPath}`)
    git(repo.repoPath, 'branch -D existing-branch')
  })

  it('creates a worktree with a new branch from a specific base', async () => {
    // Create a commit on main, then create a branch from main
    await createCommit(repo.repoPath, 'base-file.txt', 'base content', 'Base commit')
    const wtPath = path.join(repo.repoPath, '..', 'wt-from-base')

    const result = await createWorktree(repo.repoPath, {
      repoPath: repo.repoPath,
      branchName: 'from-base',
      createNewBranch: true,
      baseBranch: 'main',
      worktreePath: wtPath,
    })

    expect(result.worktreePath).toBe(wtPath)
    // Verify the worktree exists and has the base file
    expect(existsSync(path.join(wtPath, 'base-file.txt'))).toBe(true)

    git(repo.repoPath, `worktree remove ${wtPath}`)
    git(repo.repoPath, 'branch -D from-base')
  })
})

// ─── deleteWorktree ─────────────────────────────────────────────────────────

describe('deleteWorktree', () => {
  let repo: TestRepo

  beforeAll(async () => { repo = await createTestRepo() })
  afterAll(async () => { await repo.cleanup() })

  it('removes a clean worktree', async () => {
    const wtPath = path.join(repo.repoPath, '..', 'wt-to-delete')
    git(repo.repoPath, `worktree add -b del-branch ${wtPath}`)

    const result = await deleteWorktree(repo.repoPath, {
      repoPath: repo.repoPath,
      worktreePath: wtPath,
    })
    expect(result.success).toBe(true)

    const worktrees = await getWorktrees(repo.repoPath)
    expect(worktrees.find(wt => wt.branch === 'del-branch')).toBeUndefined()

    git(repo.repoPath, 'branch -D del-branch')
  })

  it('force-removes a dirty worktree', async () => {
    const wtPath = path.join(repo.repoPath, '..', 'wt-dirty-delete')
    git(repo.repoPath, `worktree add -b dirty-branch ${wtPath}`)

    // Make the worktree dirty
    await writeFile(path.join(wtPath, 'dirty-file.txt'), 'uncommitted changes')

    const result = await deleteWorktree(repo.repoPath, {
      repoPath: repo.repoPath,
      worktreePath: wtPath,
      force: true,
    })
    expect(result.success).toBe(true)

    git(repo.repoPath, 'branch -D dirty-branch')
  })

  it('deletes files on disk when deleteFiles is true', async () => {
    const wtPath = path.join(repo.repoPath, '..', 'wt-delete-files')
    git(repo.repoPath, `worktree add -b delete-files-branch ${wtPath}`)

    const result = await deleteWorktree(repo.repoPath, {
      repoPath: repo.repoPath,
      worktreePath: wtPath,
      deleteFiles: true,
    })
    expect(result.success).toBe(true)
    expect(existsSync(wtPath)).toBe(false)

    git(repo.repoPath, 'branch -D delete-files-branch')
  })
})

// ─── getWorktreeDiff ────────────────────────────────────────────────────────

describe('getWorktreeDiff', () => {
  let repo: TestRepo

  beforeAll(async () => { repo = await createTestRepo() })
  afterAll(async () => { await repo.cleanup() })

  it('returns zeros for a clean worktree', async () => {
    const diff = await getWorktreeDiff(repo.repoPath)
    expect(diff.fileCount).toBe(0)
    expect(diff.insertionCount).toBe(0)
    expect(diff.deletionCount).toBe(0)
    expect(diff.isStale).toBe(false)
  })

  it('counts modifications correctly', async () => {
    await writeFile(path.join(repo.repoPath, 'README.md'), '# Modified\nNew line\n')

    const diff = await getWorktreeDiff(repo.repoPath)
    expect(diff.fileCount).toBe(1)
    expect(diff.insertionCount).toBeGreaterThan(0)
    expect(diff.isStale).toBe(false)

    // Reset
    git(repo.repoPath, 'checkout -- .')
  })

  it('returns zeros for a nonexistent path', async () => {
    const diff = await getWorktreeDiff('/nonexistent/path')
    expect(diff.fileCount).toBe(0)
    expect(diff.insertionCount).toBe(0)
    expect(diff.deletionCount).toBe(0)
    expect(diff.isStale).toBe(false)
  })
})

// ─── syncWorktree ───────────────────────────────────────────────────────────

describe('syncWorktree', () => {
  let repo: TestRepo

  beforeAll(async () => { repo = await createTestRepo() })
  afterAll(async () => { await repo.cleanup() })

  it('resets uncommitted changes', async () => {
    await writeFile(path.join(repo.repoPath, 'README.md'), '# Changed content\n')
    const diffBefore = await getWorktreeDiff(repo.repoPath)
    expect(diffBefore.fileCount).toBeGreaterThan(0)

    const result = await syncWorktree(repo.repoPath)
    expect(result.success).toBe(true)

    const diffAfter = await getWorktreeDiff(repo.repoPath)
    expect(diffAfter.fileCount).toBe(0)
    expect(diffAfter.insertionCount).toBe(0)
    expect(diffAfter.deletionCount).toBe(0)
  })
})

// ─── getAheadBehind ─────────────────────────────────────────────────────────

describe('getAheadBehind', () => {
  let repo: TestRepo

  beforeAll(async () => { repo = await createTestRepo() })
  afterAll(async () => { await repo.cleanup() })

  it('returns zeros for detached HEAD', async () => {
    const result = await getAheadBehind(repo.repoPath, 'detached:abc12345')
    expect(result.aheadCount).toBe(0)
    expect(result.behindCount).toBe(0)
  })

  it('returns zeros when no upstream is configured', async () => {
    const result = await getAheadBehind(repo.repoPath, 'main')
    expect(result.aheadCount).toBe(0)
    expect(result.behindCount).toBe(0)
  })
})

// ─── getWorktreeLastActivity ────────────────────────────────────────────────

describe('getWorktreeLastActivity', () => {
  let repo: TestRepo

  beforeAll(async () => { repo = await createTestRepo() })
  afterAll(async () => { await repo.cleanup() })

  it('returns a relative time string', async () => {
    const activity = await getWorktreeLastActivity(repo.repoPath)
    expect(activity).toBeDefined()
    // The initial commit was just created, so it should say something like "X seconds ago"
    expect(activity).toMatch(/ago/)
  })
})

// ─── getLocalBranchNames / getBranches ──────────────────────────────────────

describe('getLocalBranchNames', () => {
  let repo: TestRepo

  beforeAll(async () => {
    repo = await createTestRepo()
    createBranch(repo.repoPath, 'feature-x')
    createBranch(repo.repoPath, 'feature-y')
    switchBranch(repo.repoPath, 'main')
  })
  afterAll(async () => { await repo.cleanup() })

  it('lists all local branches', async () => {
    const names = await getLocalBranchNames(repo.repoPath)
    expect(names).toContain('main')
    expect(names).toContain('feature-x')
    expect(names).toContain('feature-y')
  })

  it('filters by merged branches', async () => {
    // feature-x and feature-y were created from main HEAD, so they're all at the same commit
    const merged = await getLocalBranchNames(repo.repoPath, { mergedInto: 'main' })
    expect(merged).toContain('feature-x')
    expect(merged).toContain('feature-y')
  })
})

describe('getBranches', () => {
  let repo: TestRepo

  beforeAll(async () => {
    repo = await createTestRepo()
    createBranch(repo.repoPath, 'dev')
    switchBranch(repo.repoPath, 'main')
  })
  afterAll(async () => { await repo.cleanup() })

  it('returns local branches with isCurrent flag', async () => {
    const branches = await getBranches(repo.repoPath)
    const localBranches = branches.filter(b => !b.isRemote)

    expect(localBranches.length).toBeGreaterThanOrEqual(2)

    const mainBranch = localBranches.find(b => b.name === 'main')
    expect(mainBranch).toBeDefined()
    expect(mainBranch!.isCurrent).toBe(true)

    const devBranch = localBranches.find(b => b.name === 'dev')
    expect(devBranch).toBeDefined()
    expect(devBranch!.isCurrent).toBe(false)
  })
})

// ─── getDefaultBranch ───────────────────────────────────────────────────────

describe('getDefaultBranch', () => {
  it('detects main when it exists', async () => {
    const repo = await createTestRepo()
    try {
      const branch = await getDefaultBranch(repo.repoPath)
      expect(branch).toBe('main')
    } finally {
      await repo.cleanup()
    }
  })

  it('detects master as fallback', async () => {
    const repo = await createTestRepo()
    try {
      // Rename main to master
      git(repo.repoPath, 'branch -m main master')
      const branch = await getDefaultBranch(repo.repoPath)
      expect(branch).toBe('master')
    } finally {
      await repo.cleanup()
    }
  })

  it('falls back to current branch when neither main nor master exist', async () => {
    const repo = await createTestRepo()
    try {
      git(repo.repoPath, 'branch -m main development')
      const branch = await getDefaultBranch(repo.repoPath)
      expect(branch).toBe('development')
    } finally {
      await repo.cleanup()
    }
  })
})

// ─── checkoutBranch / deleteBranch ──────────────────────────────────────────

describe('checkoutBranch', () => {
  let repo: TestRepo

  beforeAll(async () => {
    repo = await createTestRepo()
    createBranch(repo.repoPath, 'switch-target')
    switchBranch(repo.repoPath, 'main')
  })
  afterAll(async () => { await repo.cleanup() })

  it('switches to another branch', async () => {
    await checkoutBranch(repo.repoPath, 'switch-target')
    const current = git(repo.repoPath, 'branch --show-current')
    expect(current).toBe('switch-target')

    // Switch back
    await checkoutBranch(repo.repoPath, 'main')
  })
})

describe('deleteBranch', () => {
  let repo: TestRepo

  beforeAll(async () => { repo = await createTestRepo() })
  afterAll(async () => { await repo.cleanup() })

  it('deletes a fully-merged branch', async () => {
    createBranch(repo.repoPath, 'merged-branch')
    switchBranch(repo.repoPath, 'main')

    await deleteBranch(repo.repoPath, 'merged-branch')

    const names = await getLocalBranchNames(repo.repoPath)
    expect(names).not.toContain('merged-branch')
  })

  it('fails to delete an unmerged branch with -d', async () => {
    createBranch(repo.repoPath, 'unmerged-branch')
    await createCommit(repo.repoPath, 'unmerged.txt', 'data', 'Unmerged commit')
    switchBranch(repo.repoPath, 'main')

    await expect(deleteBranch(repo.repoPath, 'unmerged-branch')).rejects.toThrow()

    // Cleanup
    git(repo.repoPath, 'branch -D unmerged-branch')
  })
})

// ─── rebaseOnto ─────────────────────────────────────────────────────────────

describe('rebaseOnto', () => {
  let repo: TestRepo

  beforeEach(async () => { repo = await createTestRepo() })
  afterAll(async () => { await repo?.cleanup() })

  it('successfully rebases a feature branch onto main', async () => {
    // Create a feature branch with its own commit
    createBranch(repo.repoPath, 'feature-rebase')
    await createCommit(repo.repoPath, 'feature.txt', 'feature work', 'Feature commit')

    // Add a commit on main
    switchBranch(repo.repoPath, 'main')
    await createCommit(repo.repoPath, 'main-update.txt', 'main work', 'Main update')

    // Go back to feature and rebase
    switchBranch(repo.repoPath, 'feature-rebase')
    const result = await rebaseOnto(repo.repoPath, 'main')
    expect(result.success).toBe(true)
    expect(result.branch).toBe('feature-rebase')

    // Verify feature.txt and main-update.txt both exist after rebase
    expect(existsSync(path.join(repo.repoPath, 'feature.txt'))).toBe(true)
    expect(existsSync(path.join(repo.repoPath, 'main-update.txt'))).toBe(true)

    await repo.cleanup()
  })

  it('detects rebase conflicts', async () => {
    // Create conflicting changes
    createBranch(repo.repoPath, 'conflicting-branch')
    await createCommit(repo.repoPath, 'README.md', 'branch version', 'Branch change')

    switchBranch(repo.repoPath, 'main')
    await createCommit(repo.repoPath, 'README.md', 'main version', 'Main change')

    switchBranch(repo.repoPath, 'conflicting-branch')
    const result = await rebaseOnto(repo.repoPath, 'main')
    expect(result.success).toBe(false)
    expect(result.hasConflicts).toBe(true)

    // Abort the rebase to clean up
    git(repo.repoPath, 'rebase --abort')
    await repo.cleanup()
  })
})

// ─── getMergedBranches ──────────────────────────────────────────────────────

describe('getMergedBranches', () => {
  let repo: TestRepo

  beforeAll(async () => {
    repo = await createTestRepo()

    // Create branches that are merged (same commit as main)
    git(repo.repoPath, 'branch merged-a')
    git(repo.repoPath, 'branch merged-b')

    // Create a branch with extra commits (not merged)
    createBranch(repo.repoPath, 'not-merged')
    await createCommit(repo.repoPath, 'extra.txt', 'extra', 'Extra commit')
    switchBranch(repo.repoPath, 'main')
  })
  afterAll(async () => { await repo.cleanup() })

  it('identifies merged branches', async () => {
    const result = await getMergedBranches(repo.repoPath, 'main')
    expect(result.branches).toContain('merged-a')
    expect(result.branches).toContain('merged-b')
    expect(result.branches).not.toContain('not-merged')
  })

  it('excludes the base branch and current branch from results', async () => {
    const result = await getMergedBranches(repo.repoPath, 'main')
    expect(result.branches).not.toContain('main')
  })

  it('excludes branches checked out in worktrees', async () => {
    const wtPath = path.join(repo.repoPath, '..', 'wt-merged-a')
    git(repo.repoPath, `worktree add ${wtPath} merged-a`)

    const result = await getMergedBranches(repo.repoPath, 'main')
    expect(result.branches).not.toContain('merged-a')
    expect(result.branches).toContain('merged-b')

    git(repo.repoPath, `worktree remove ${wtPath}`)
  })

  it('uses local merge ref label when no remote exists', async () => {
    const result = await getMergedBranches(repo.repoPath, 'main')
    expect(result.mergeRefLabel).toBe('main (local)')
  })
})

// ─── runSetupSteps ──────────────────────────────────────────────────────────

describe('runSetupSteps', () => {
  let repo: TestRepo

  beforeAll(async () => { repo = await createTestRepo() })
  afterAll(async () => { await repo.cleanup() })

  it('runs shell commands from setup.yaml', async () => {
    const wtPath = path.join(repo.repoPath, '..', 'wt-setup-cmd')
    git(repo.repoPath, `worktree add -b setup-cmd ${wtPath}`)

    await createSetupConfig(repo.repoPath, `commands:\n  - touch setup-ran.txt\n`)
    await runSetupSteps(repo.repoPath, wtPath)

    expect(existsSync(path.join(wtPath, 'setup-ran.txt'))).toBe(true)

    git(repo.repoPath, `worktree remove --force ${wtPath}`)
    git(repo.repoPath, 'branch -D setup-cmd')
  })

  it('copies env files from repo to worktree', async () => {
    const wtPath = path.join(repo.repoPath, '..', 'wt-setup-env')
    git(repo.repoPath, `worktree add -b setup-env ${wtPath}`)

    // Create .env file in the repo root
    await writeFile(path.join(repo.repoPath, '.env'), 'SECRET=test123\n')
    await createSetupConfig(repo.repoPath, `envFiles:\n  - .env\n`)
    await runSetupSteps(repo.repoPath, wtPath)

    expect(existsSync(path.join(wtPath, '.env'))).toBe(true)

    git(repo.repoPath, `worktree remove --force ${wtPath}`)
    git(repo.repoPath, 'branch -D setup-env')
  })

  it('creates nested directories for env files', async () => {
    const wtPath = path.join(repo.repoPath, '..', 'wt-setup-nested')
    git(repo.repoPath, `worktree add -b setup-nested ${wtPath}`)

    await mkdir(path.join(repo.repoPath, 'config'), { recursive: true })
    await writeFile(path.join(repo.repoPath, 'config', '.env.local'), 'KEY=value\n')
    await createSetupConfig(repo.repoPath, `envFiles:\n  - config/.env.local\n`)
    await runSetupSteps(repo.repoPath, wtPath)

    expect(existsSync(path.join(wtPath, 'config', '.env.local'))).toBe(true)

    git(repo.repoPath, `worktree remove --force ${wtPath}`)
    git(repo.repoPath, 'branch -D setup-nested')
  })

  it('throws ENOENT when no setup.yaml exists', async () => {
    const repoWithoutSetup = await createTestRepo()
    try {
      await expect(runSetupSteps(repoWithoutSetup.repoPath, repoWithoutSetup.repoPath)).rejects.toThrow()
    } finally {
      await repoWithoutSetup.cleanup()
    }
  })
})

// ─── shortenPathForDisplay ──────────────────────────────────────────────────

describe('shortenPathForDisplay', () => {
  it('replaces HOME prefix with ~', () => {
    const home = process.env.HOME
    if (home) {
      const result = shortenPathForDisplay(`${home}/projects/glit`)
      expect(result).toBe('~/projects/glit')
    }
  })

  it('returns path unchanged when not under HOME', () => {
    const result = shortenPathForDisplay('/var/log/app.log')
    expect(result).toBe('/var/log/app.log')
  })
})
