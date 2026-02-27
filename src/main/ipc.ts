import { ipcMain, clipboard, dialog, BrowserWindow } from 'electron'
import log from 'electron-log'
import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import fs from 'fs/promises'
import yaml from 'js-yaml'
import Store from 'electron-store'
import type {
  Worktree,
  WorktreeWithDiff,
  BranchInfo,
  SetupConfig,
  AppSettings,
  CreateWorktreeOptions,
  DeleteWorktreeOptions,
  CreateProgress,
} from '../shared/types.js'

const execAsync = promisify(exec)

const isDev = process.env.NODE_ENV !== 'production'

function getRepoPath(): string {
  // CLI sets GLIT_REPO_PATH env var
  if (process.env['GLIT_REPO_PATH']) {
    return process.env['GLIT_REPO_PATH']
  }
  // Check argv for path argument
  const args = process.argv.slice(isDev ? 2 : 1)
  const repoArg = args.find((a) => a && !a.startsWith('-') && !a.endsWith('.js'))
  if (repoArg) return repoArg
  return process.cwd()
}

const defaultSettings: AppSettings = {
  preferredTerminal: 'Terminal',
  defaultBaseBranch: '',
  autoRefresh: true,
}

const store = new Store<{ settings: AppSettings }>({
  defaults: { settings: defaultSettings },
})

async function runGitCommand(cwd: string, args: string[]): Promise<string> {
  const cmd = `git ${args.join(' ')}`
  log.debug(`Git: ${cmd} [${cwd}]`)
  const { stdout, stderr } = await execAsync(cmd, { cwd })
  if (stderr) log.debug(`Git stderr: ${stderr}`)
  return stdout
}


async function getWorktrees(repoPath: string): Promise<Worktree[]> {
  const output = await runGitCommand(repoPath, ['worktree', 'list', '--porcelain'])
  const worktrees: Worktree[] = []
  const entries = output.split('\n\n').filter(Boolean)

  for (const entry of entries) {
    const lines = entry.split('\n')
    let wtPath = ''
    let branch = ''
    let head = ''
    let isBare = false
    let isLocked = false

    for (const line of lines) {
      if (line.startsWith('worktree ')) {
        wtPath = line.slice(9)
      } else if (line.startsWith('branch ')) {
        branch = line.slice(7).replace('refs/heads/', '')
      } else if (line.startsWith('HEAD ')) {
        head = line.slice(5)
      } else if (line === 'bare') {
        isBare = true
      } else if (line.startsWith('locked')) {
        isLocked = true
      } else if (line.startsWith('detached')) {
        branch = `detached:${head.slice(0, 8)}`
      }
    }

    if (wtPath) {
      worktrees.push({ path: wtPath, branch, isBare, isLocked, head })
    }
  }

  return worktrees
}

async function getWorktreeDiff(worktreePath: string): Promise<{ fileCount: number; insertionCount: number; deletionCount: number }> {
  try {
    // Check if path exists
    await fs.access(worktreePath)
    const output = await runGitCommand(worktreePath, ['diff', '--numstat', 'HEAD'])
    if (!output.trim()) {
      return { fileCount: 0, insertionCount: 0, deletionCount: 0 }
    }

    const lines = output.trim().split('\n')
    let fileCount = 0
    let insertionCount = 0
    let deletionCount = 0

    for (const line of lines) {
      const match = line.match(/^(\d+|-)\s+(\d+|-)\s+/)
      if (match) {
        fileCount++
        insertionCount += match[1] === '-' ? 0 : parseInt(match[1]!, 10)
        deletionCount += match[2] === '-' ? 0 : parseInt(match[2]!, 10)
      }
    }

    return { fileCount, insertionCount, deletionCount }
  } catch {
    return { fileCount: 0, insertionCount: 0, deletionCount: 0 }
  }
}

async function getBranches(repoPath: string): Promise<BranchInfo[]> {
  const branches: BranchInfo[] = []
  let currentBranch = ''

  try {
    const localOutput = await runGitCommand(repoPath, ['branch'])
    const localLines = localOutput.split('\n').filter(Boolean)
    const currentLine = localLines.find((b) => b.startsWith('*'))
    currentBranch = currentLine?.slice(2).trim() ?? ''

    for (const line of localLines) {
      const name = line.replace(/^\*\s*/, '').trim()
      if (name) {
        branches.push({ name, isRemote: false, isCurrent: name === currentBranch })
      }
    }
  } catch {
    log.warn('Failed to get local branches')
  }

  try {
    const remoteOutput = await runGitCommand(repoPath, ['branch', '-r'])
    for (const line of remoteOutput.split('\n').filter(Boolean)) {
      const name = line.trim()
      if (name && !name.includes('HEAD')) {
        branches.push({ name, isRemote: true, isCurrent: false })
      }
    }
  } catch {
    log.warn('Failed to get remote branches')
  }

  return branches
}

async function getDefaultBranch(repoPath: string): Promise<string> {
  // Try to read the remote HEAD symref (e.g. refs/remotes/origin/HEAD -> origin/master)
  try {
    const out = await runGitCommand(repoPath, ['symbolic-ref', 'refs/remotes/origin/HEAD'])
    const branch = out.trim().replace('refs/remotes/origin/', '')
    if (branch) return branch
  } catch {
    // not set – fall through
  }

  // Fall back: look for 'main' or 'master' in local branches
  try {
    const out = await runGitCommand(repoPath, ['branch'])
    const names = out.split('\n').map((l) => l.replace(/^\*\s*/, '').trim()).filter(Boolean)
    if (names.includes('main')) return 'main'
    if (names.includes('master')) return 'master'
  } catch {
    // fall through
  }

  // Last resort: current branch
  try {
    const out = await runGitCommand(repoPath, ['rev-parse', '--abbrev-ref', 'HEAD'])
    const branch = out.trim()
    if (branch && branch !== 'HEAD') return branch
  } catch {
    // fall through
  }

  return 'main'
}

async function sendProgress(getWindow: () => BrowserWindow | null, data: CreateProgress): Promise<void> {
  const win = getWindow()
  if (win && !win.isDestroyed()) {
    win.webContents.send('create:progress', data)
  }
}

export function setupIpcHandlers(getWindow: () => BrowserWindow | null): void {
  log.info('Setting up IPC handlers...')

  ipcMain.handle('repo:detect', async () => {
    const cwd = getRepoPath()
    try {
      await runGitCommand(cwd, ['rev-parse', '--git-dir'])
      const name = path.basename(cwd)
      return { isRepo: true, path: cwd, name }
    } catch {
      return { isRepo: false, path: cwd }
    }
  })

  ipcMain.handle('worktree:list', async (_event, repoPath: string) => {
    log.info(`Listing worktrees for: ${repoPath}`)
    const worktrees = await getWorktrees(repoPath)
    const result: WorktreeWithDiff[] = []
    await Promise.all(
      worktrees.map(async (wt) => {
        const diff = await getWorktreeDiff(wt.path)
        result.push({ ...wt, ...diff })
      }),
    )
    // Sort: main worktree first, then by branch name
    result.sort((a, b) => {
      if (!a.isBare && b.isBare) return -1
      if (a.isBare && !b.isBare) return 1
      return a.branch.localeCompare(b.branch)
    })
    return result
  })

  ipcMain.handle('worktree:delete', async (_event, options: DeleteWorktreeOptions) => {
    const { repoPath, worktreePath, force = false, deleteFiles = false } = options
    log.info(`Deleting worktree: ${worktreePath}, force: ${force}, deleteFiles: ${deleteFiles}`)
    try {
      const args = ['worktree', 'remove', worktreePath]
      if (force) args.push('--force')
      await runGitCommand(repoPath, args)
      if (deleteFiles) {
        await fs.rm(worktreePath, { recursive: true, force: true })
      }
      return { success: true }
    } catch (error) {
      log.error('Error deleting worktree:', error)
      const msg = error instanceof Error ? error.message : String(error)
      return { success: false, error: msg }
    }
  })

  ipcMain.handle('worktree:create', async (_event, options: CreateWorktreeOptions) => {
    const { repoPath, branchName, createNewBranch = false, baseBranch, worktreePath: customPath } = options
    log.info(`Creating worktree: ${branchName} in ${repoPath}, newBranch: ${createNewBranch}`)

    const safeName = branchName.replace(/[^a-zA-Z0-9._-]/g, '-')
    const worktreePath = customPath ?? path.join(repoPath, '..', `glit-worktrees`, safeName)

    // Resolve the effective base branch, falling back to auto-detected default
    let effectiveBase = baseBranch
    if (createNewBranch && effectiveBase) {
      try {
        await runGitCommand(repoPath, ['rev-parse', '--verify', effectiveBase])
      } catch {
        log.warn(`Base branch "${effectiveBase}" not found, falling back to auto-detected default`)
        effectiveBase = await getDefaultBranch(repoPath)
      }
    }

    try {
      await sendProgress(getWindow, { step: 'creating', message: 'Creating worktree...' })

      const args = ['worktree', 'add']
      if (createNewBranch) {
        args.push('-b', branchName, worktreePath)
        if (effectiveBase) args.push(effectiveBase)
      } else {
        args.push(worktreePath, branchName)
      }
      await runGitCommand(repoPath, args)
      log.info(`Worktree created at: ${worktreePath}`)

      // Load and run setup
      const configPath = path.join(repoPath, '.glit', 'setup.yaml')
      try {
        const configContent = await fs.readFile(configPath, 'utf-8')
        const config = yaml.load(configContent) as SetupConfig

        if (config.packages?.length) {
          await sendProgress(getWindow, { step: 'packages', message: 'Installing packages...' })
          for (const pkgCmd of config.packages) {
            try {
              await sendProgress(getWindow, { step: 'packages', message: 'Installing packages...', detail: pkgCmd })
              await execAsync(pkgCmd, { cwd: worktreePath })
            } catch (e) {
              log.warn(`Package command failed: ${pkgCmd}`, e)
            }
          }
        }

        if (config.envFiles?.length) {
          await sendProgress(getWindow, { step: 'env', message: 'Copying env files...' })
          for (const envFile of config.envFiles) {
            try {
              const srcPath = path.join(repoPath, envFile)
              const destPath = path.join(worktreePath, envFile)
              await fs.mkdir(path.dirname(destPath), { recursive: true })
              await fs.copyFile(srcPath, destPath)
            } catch (e) {
              log.warn(`Env file copy failed: ${envFile}`, e)
            }
          }
        }

        if (config.commands?.length) {
          await sendProgress(getWindow, { step: 'commands', message: 'Running setup commands...' })
          for (const cmd of config.commands) {
            try {
              await sendProgress(getWindow, { step: 'commands', message: 'Running setup commands...', detail: cmd })
              await execAsync(cmd, { cwd: worktreePath })
            } catch (e) {
              log.warn(`Setup command failed: ${cmd}`, e)
            }
          }
        }
      } catch {
        log.info('No .glit/setup.yaml found, skipping setup')
      }

      await sendProgress(getWindow, { step: 'done', message: 'Worktree ready!' })
      return {
        success: true,
        worktree: { path: worktreePath, branch: branchName, isBare: false, isLocked: false },
      }
    } catch (error) {
      log.error('Error creating worktree:', error)
      const msg = error instanceof Error ? error.message : String(error)
      await sendProgress(getWindow, { step: 'error', message: 'Failed to create worktree', detail: msg })
      return { success: false, error: msg }
    }
  })

  ipcMain.handle('setup:preview', async (_event, repoPath: string) => {
    log.info(`Previewing setup config for: ${repoPath}`)
    try {
      const configPath = path.join(repoPath, '.glit', 'setup.yaml')
      const content = await fs.readFile(configPath, 'utf-8')
      return yaml.load(content) as SetupConfig
    } catch {
      return null
    }
  })

  ipcMain.handle('setup:save', async (_event, repoPath: string, config: SetupConfig) => {
    const glitDir = path.join(repoPath, '.glit')
    const configPath = path.join(glitDir, 'setup.yaml')
    await fs.mkdir(glitDir, { recursive: true })
    await fs.writeFile(configPath, yaml.dump(config), 'utf-8')
  })

  ipcMain.handle('dialog:pickFile', async (_event, repoPath: string) => {
    const win = getWindow()
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      defaultPath: repoPath,
      properties: ['openFile'],
    })
    if (result.canceled || !result.filePaths[0]) return null
    return path.relative(repoPath, result.filePaths[0])
  })

  ipcMain.handle('clipboard:copy', async (_event, text: string) => {
    clipboard.writeText(text)
  })

  ipcMain.handle('terminal:open', async (_event, worktreePath: string, terminal?: string) => {
    const term = terminal ?? store.get('settings').preferredTerminal ?? 'Terminal'
    log.info(`Opening terminal at: ${worktreePath}, terminal: ${term}`)
    try {
      const escapedPath = worktreePath.replace(/'/g, "'\\''")
      let cmd = ''

      if (term === 'iTerm2' || term === 'iTerm') {
        cmd = `osascript -e 'tell application "iTerm"
  activate
  if (count of windows) = 0 then
    create window with default profile
    tell current session of current window
      write text "cd ${escapedPath}"
    end tell
  else
    tell current window
      create tab with default profile
      tell current session
        write text "cd ${escapedPath}"
      end tell
    end tell
  end if
end tell'`
      } else if (term === 'Hyper') {
        cmd = `open -a Hyper ${JSON.stringify(worktreePath)}`
      } else if (term === 'Kitty') {
        cmd = `kitty --directory ${JSON.stringify(worktreePath)}`
      } else if (term === 'Alacritty') {
        cmd = `alacritty --working-directory ${JSON.stringify(worktreePath)}`
      } else if (term === 'Warp') {
        const encodedPath = encodeURIComponent(worktreePath)
        cmd = `open "warp://action/new_tab?path=${encodedPath}"`
      } else {
        // Terminal.app and default
        cmd = `osascript -e 'tell application "Terminal"
  activate
  if (count of windows) = 0 then
    do script "cd ${escapedPath}"
  else
    do script "cd ${escapedPath}" in front window
  end if
end tell'`
      }

      await execAsync(cmd)
      return { success: true }
    } catch (error) {
      log.error('Error opening terminal:', error)
      const msg = error instanceof Error ? error.message : String(error)
      return { success: false, error: msg }
    }
  })

  ipcMain.handle('settings:get', async () => {
    return store.get('settings', defaultSettings)
  })

  ipcMain.handle('settings:set', async (_event, newSettings: Partial<AppSettings>) => {
    const current = store.get('settings', defaultSettings)
    store.set('settings', { ...current, ...newSettings })
  })

  ipcMain.handle('repo:defaultBranch', async (_event, repoPath: string) => {
    log.info(`Detecting default branch for: ${repoPath}`)
    return getDefaultBranch(repoPath)
  })

  ipcMain.handle('branch:list', async (_event, repoPath: string) => {
    log.info(`Listing branches for: ${repoPath}`)
    return getBranches(repoPath)
  })

  log.info('IPC handlers setup complete')
}
