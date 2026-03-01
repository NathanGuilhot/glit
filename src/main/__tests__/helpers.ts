import { mkdtemp, rm, writeFile, mkdir } from 'fs/promises'
import { tmpdir } from 'os'
import path from 'path'
import { execSync } from 'child_process'

export interface TestRepo {
  repoPath: string
  cleanup: () => Promise<void>
}

/**
 * Creates a fresh git repository in a temp directory with an initial commit on 'main'.
 */
export async function createTestRepo(): Promise<TestRepo> {
  const baseDir = await mkdtemp(path.join(tmpdir(), 'glit-test-'))
  const repoPath = path.join(baseDir, 'repo')
  await mkdir(repoPath, { recursive: true })

  git(repoPath, 'init -b main')
  git(repoPath, 'config user.email "test@glit.dev"')
  git(repoPath, 'config user.name "Glit Test"')
  git(repoPath, 'config commit.gpgsign false')

  await writeFile(path.join(repoPath, 'README.md'), '# Test Repo\n')
  git(repoPath, 'add .')
  git(repoPath, 'commit -m "Initial commit"')

  return {
    repoPath,
    cleanup: async () => {
      await rm(baseDir, { recursive: true, force: true })
    },
  }
}

/**
 * Synchronous git command helper for test setup.
 */
export function git(cwd: string, command: string): string {
  return execSync(`git ${command}`, {
    cwd,
    encoding: 'utf-8',
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  }).trim()
}

/**
 * Creates a commit with a file change.
 */
export async function createCommit(
  repoPath: string,
  fileName: string,
  content: string,
  message: string,
): Promise<void> {
  const filePath = path.join(repoPath, fileName)
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, content)
  git(repoPath, `add ${fileName}`)
  git(repoPath, `commit -m "${message}"`)
}

/**
 * Creates a new branch from current HEAD and switches to it.
 */
export function createBranch(repoPath: string, branchName: string): void {
  git(repoPath, `checkout -b ${branchName}`)
}

/**
 * Switches to an existing branch.
 */
export function switchBranch(repoPath: string, branchName: string): void {
  git(repoPath, `checkout ${branchName}`)
}

/**
 * Creates a .glit/setup.yaml file in the repo.
 */
export async function createSetupConfig(
  repoPath: string,
  yamlContent: string,
): Promise<void> {
  const glitDir = path.join(repoPath, '.glit')
  await mkdir(glitDir, { recursive: true })
  await writeFile(path.join(glitDir, 'setup.yaml'), yamlContent)
}
