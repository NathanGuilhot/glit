import { ipcMain, clipboard, dialog, shell, BrowserWindow, app } from 'electron'
import log from 'electron-log'
import { exec, spawn } from 'child_process'
import type { ChildProcess } from 'child_process'
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
  RepoInfo,
  RecentRepo,
  CreateWorktreeOptions,
  DeleteWorktreeOptions,
  RunningProcess,
  ProcessLog,
  DevCommandInfo,
} from '../shared/types.js'

const execAsync = promisify(exec)

let activeCreateController: AbortController | null = null
let activeRepoPath: string | null = null

const runningProcesses = new Map<string, { proc: ChildProcess; info: RunningProcess }>()
const processLogs = new Map<string, ProcessLog[]>()
const MAX_LOG_LINES = 500

app.on('will-quit', () => {
  for (const { proc } of runningProcesses.values()) {
    try { proc.kill('SIGTERM') } catch { /* ignore */ }
  }
})

const isDev = process.env.NODE_ENV !== 'production'

function getRepoPath(): string {
  if (activeRepoPath !== null) return activeRepoPath
  if (process.env['GLIT_REPO_PATH']) {
    return process.env['GLIT_REPO_PATH']
  }
  const args = process.argv.slice(isDev ? 2 : 1)
  const repoArg = args.find((a) => a && !a.startsWith('-') && !a.endsWith('.js'))
  if (repoArg) return repoArg
  return process.cwd()
}

function shortenPathForDisplay(fullPath: string): string {
  const home = process.env.HOME
  if (home && fullPath.startsWith(home)) {
    return '~' + fullPath.slice(home.length)
  }
  return fullPath
}

const defaultSettings: AppSettings = {
  preferredTerminal: 'Terminal',
  preferredIDE: 'VSCode',
  autoRefresh: true,
}

const store = new Store<{ settings: AppSettings; recentRepos: RecentRepo[]; devCommands: Record<string, string> }>({
  defaults: { settings: defaultSettings, recentRepos: [], devCommands: {} },
})

function addToRecentRepos(info: RepoInfo): void {
  if (!info.isRepo || !info.path || !info.name) return
  const existing = store.get('recentRepos', [])
  const filtered = existing.filter((r) => r.path !== info.path)
  const entry: RecentRepo = {
    path: info.path,
    name: info.name,
    displayPath: info.displayPath ?? shortenPathForDisplay(info.path),
    lastUsedAt: new Date().toISOString(),
  }
  store.set('recentRepos', [entry, ...filtered].slice(0, 10))
}

async function runGitCommand(cwd: string, args: string[], options?: { signal?: AbortSignal }): Promise<string> {
  const safeArgs = args.map(arg => /[^\w/-]/.test(arg) ? `'${arg.replace(/'/g, "'\\''")}'` : arg)
  const cmd = `git ${safeArgs.join(' ')}`
  log.debug(`Git: ${cmd} [${cwd}]`)
  const { stdout, stderr } = await execAsync(cmd, { cwd, signal: options?.signal })
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
      worktrees.push({ path: wtPath, displayPath: shortenPathForDisplay(wtPath), branch, isBare, isLocked, head })
    }
  }

  return worktrees
}

async function getWorktreeDiff(worktreePath: string): Promise<{ fileCount: number; insertionCount: number; deletionCount: number; isStale: boolean }> {
  try {
    // Check if path exists
    await fs.access(worktreePath)
    const [indexDiff, headDiff] = await Promise.all([
      runGitCommand(worktreePath, ['diff', '--numstat']),
      runGitCommand(worktreePath, ['diff', '--numstat', 'HEAD']),
    ])

    // Stale: working tree matches index (no user edits) but differs from HEAD (HEAD moved)
    if (!indexDiff.trim() && headDiff.trim()) {
      return { fileCount: 0, insertionCount: 0, deletionCount: 0, isStale: true }
    }

    if (!headDiff.trim()) {
      return { fileCount: 0, insertionCount: 0, deletionCount: 0, isStale: false }
    }

    const lines = headDiff.trim().split('\n')
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

    return { fileCount, insertionCount, deletionCount, isStale: false }
  } catch {
    return { fileCount: 0, insertionCount: 0, deletionCount: 0, isStale: false }
  }
}

async function getAheadBehind(
  worktreePath: string,
  branch: string,
): Promise<{ aheadCount: number; behindCount: number }> {
  try {
    if (!branch || branch.startsWith('detached:')) {
      return { aheadCount: 0, behindCount: 0 }
    }
    const out = await runGitCommand(worktreePath, [
      'rev-list', '--count', '--left-right', '@{upstream}...HEAD',
    ])
    const [behind = '0', ahead = '0'] = out.trim().split('\t')
    return {
      aheadCount: parseInt(ahead, 10) || 0,
      behindCount: parseInt(behind, 10) || 0,
    }
  } catch {
    return { aheadCount: 0, behindCount: 0 }
  }
}

async function getWorktreeLastActivity(worktreePath: string): Promise<string | undefined> {
  try {
    const output = await runGitCommand(worktreePath, ['log', '-1', '--format=%ar', 'HEAD'])
    return output.trim() || undefined
  } catch {
    return undefined
  }
}

async function getLocalBranchNames(
  repoPath: string,
  options?: { mergedInto?: string },
): Promise<string[]> {
  const args: string[] = ['branch', '--format=%(refname:short)']
  if (options?.mergedInto) args.push('--merged', options.mergedInto)
  const output = await runGitCommand(repoPath, args)
  return output.split('\n').map((l) => l.trim()).filter(Boolean)
}

async function getBranches(repoPath: string): Promise<BranchInfo[]> {
  const branches: BranchInfo[] = []

  try {
    const [localNames, currentBranch] = await Promise.all([
      getLocalBranchNames(repoPath),
      runGitCommand(repoPath, ['branch', '--show-current']).then((out) => out.trim()),
    ])
    for (const name of localNames) {
      branches.push({ name, isRemote: false, isCurrent: name === currentBranch })
    }
  } catch {
    log.warn('Failed to get local branches')
  }

  try {
    const remoteOutput = await runGitCommand(repoPath, ['branch', '-r', '--format=%(refname:short)'])
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
    const names = await getLocalBranchNames(repoPath)
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

function sendWindowEvent(getWindow: () => BrowserWindow | null, channel: string, data: unknown): void {
  const win = getWindow()
  if (win && !win.isDestroyed()) {
    win.webContents.send(channel, data)
  }
}

function detectPort(line: string): number | null {
  const match = line.match(/(?:localhost|127\.0\.0\.1|0\.0\.0\.0):(\d{2,5})/)
  if (match) return parseInt(match[1]!, 10)
  const portMatch = line.match(/(?:port|PORT)\s*[:\s]\s*(\d{2,5})/)
  if (portMatch) return parseInt(portMatch[1]!, 10)
  return null
}

function appendProcessLog(worktreePath: string, line: string, isError: boolean): void {
  const logs = processLogs.get(worktreePath) ?? []
  logs.push({ line, isError, ts: Date.now() })
  if (logs.length > MAX_LOG_LINES) logs.shift()
  processLogs.set(worktreePath, logs)
}

function pipeLines(stream: NodeJS.ReadableStream | null | undefined, isError: boolean, onLine: (line: string, isError: boolean) => void): void {
  let buf = ''
  stream?.on('data', (data: Buffer) => {
    buf += data.toString()
    let nl: number
    while ((nl = buf.indexOf('\n')) !== -1) {
      const line = buf.slice(0, nl).replace(/\r$/, '')
      buf = buf.slice(nl + 1)
      if (line) onLine(line, isError)
    }
  })
}

async function runSetupSteps(repoPath: string, worktreePath: string): Promise<void> {
  const configPath = path.join(repoPath, '.glit', 'setup.yaml')
  const configContent = await fs.readFile(configPath, 'utf-8') // throws if missing
  const config = yaml.load(configContent) as SetupConfig

  if (config.packages?.length) {
    for (const pkgCmd of config.packages) {
      try { await execAsync(pkgCmd, { cwd: worktreePath }) }
      catch (e) { log.warn(`Package command failed: ${pkgCmd}`, e) }
    }
  }
  if (config.envFiles?.length) {
    for (const envFile of config.envFiles) {
      try {
        const srcPath = path.join(repoPath, envFile)
        const destPath = path.join(worktreePath, envFile)
        await fs.mkdir(path.dirname(destPath), { recursive: true })
        await fs.copyFile(srcPath, destPath)
      } catch (e) { log.warn(`Env file copy failed: ${envFile}`, e) }
    }
  }
  if (config.commands?.length) {
    for (const cmd of config.commands) {
      try { await execAsync(cmd, { cwd: worktreePath }) }
      catch (e) { log.warn(`Setup command failed: ${cmd}`, e) }
    }
  }
}

export function setupIpcHandlers(getWindow: () => BrowserWindow | null): void {
  ipcMain.handle('repo:detect', async () => {
    const cwd = getRepoPath()
    const displayPath = shortenPathForDisplay(cwd)
    try {
      await runGitCommand(cwd, ['rev-parse', '--git-dir'])
      const name = path.basename(cwd)
      const info: RepoInfo = { isRepo: true, path: cwd, displayPath, name }
      addToRecentRepos(info)
      return info
    } catch {
      return { isRepo: false, path: cwd, displayPath }
    }
  })

  ipcMain.handle('repo:switch', async (_event, repoPath: string) => {
    const displayPath = shortenPathForDisplay(repoPath)
    try {
      await runGitCommand(repoPath, ['rev-parse', '--git-dir'])
      const name = path.basename(repoPath)
      const info: RepoInfo = { isRepo: true, path: repoPath, displayPath, name }
      activeRepoPath = repoPath
      addToRecentRepos(info)
      return info
    } catch {
      return { isRepo: false, path: repoPath, displayPath }
    }
  })

  ipcMain.handle('repo:listRecent', async () => {
    return store.get('recentRepos', [])
  })

  ipcMain.handle('worktree:list', async (_event, repoPath: string) => {
    log.info(`Listing worktrees for: ${repoPath}`)
    const worktrees = await getWorktrees(repoPath)
    const result: WorktreeWithDiff[] = []
    await Promise.all(
      worktrees.map(async (wt) => {
        const [diff, remote, lastActivity] = await Promise.all([
          getWorktreeDiff(wt.path),
          getAheadBehind(wt.path, wt.branch),
          getWorktreeLastActivity(wt.path),
        ])
        result.push({ ...wt, ...diff, ...remote, lastActivity })
      }),
    )
    const repoPathNormalized = path.normalize(repoPath)
    result.sort((a, b) => {
      const aIsRoot = path.normalize(a.path) === repoPathNormalized
      const bIsRoot = path.normalize(b.path) === repoPathNormalized
      if (aIsRoot && !bIsRoot) return 1
      if (!aIsRoot && bIsRoot) return -1
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

    const controller = new AbortController()
    activeCreateController = controller
    const { signal } = controller

    const safeName = branchName.replace(/[^a-zA-Z0-9._-]/g, '-')
    const worktreePath = customPath ?? path.join(repoPath, '..', `glit-worktrees`, safeName)

    // Resolve the effective base branch, falling back to auto-detected default
    let effectiveBase = baseBranch
    if (createNewBranch && effectiveBase) {
      try {
        await runGitCommand(repoPath, ['rev-parse', '--verify', effectiveBase], { signal })
      } catch {
        if (signal.aborted) {
          activeCreateController = null
          return { success: false, error: 'cancelled' }
        }
        log.warn(`Base branch "${effectiveBase}" not found, falling back to auto-detected default`)
        effectiveBase = await getDefaultBranch(repoPath)
      }
    }

    try {
      sendWindowEvent(getWindow, 'create:progress', { step: 'creating', message: 'Creating worktree...' })

      const args = ['worktree', 'add']
      if (createNewBranch) {
        args.push('-b', branchName, worktreePath)
        if (effectiveBase) args.push(effectiveBase)
      } else {
        args.push(worktreePath, branchName)
      }
      await runGitCommand(repoPath, args, { signal })
      log.info(`Worktree created at: ${worktreePath}`)

      // Load and run setup
      if (!signal.aborted) {
        try {
          sendWindowEvent(getWindow, 'create:progress', { step: 'packages', message: 'Running setup...' })
          await runSetupSteps(repoPath, worktreePath)
        } catch (e) {
          if (!signal.aborted) {
            if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
              log.info('No .glit/setup.yaml found, skipping setup')
            } else {
              log.warn('Setup failed during create', e)
            }
          }
        }
      }

      if (signal.aborted) {
        activeCreateController = null
        return { success: false, error: 'cancelled' }
      }

      sendWindowEvent(getWindow, 'create:progress', { step: 'done', message: 'Worktree ready!' })
      activeCreateController = null
      return {
        success: true,
        worktree: { path: worktreePath, displayPath: shortenPathForDisplay(worktreePath), branch: branchName, isBare: false, isLocked: false },
      }
    } catch (error) {
      activeCreateController = null
      if (signal.aborted) {
        return { success: false, error: 'cancelled' }
      }
      log.error('Error creating worktree:', error)
      const msg = error instanceof Error ? error.message : String(error)
      sendWindowEvent(getWindow, 'create:progress', { step: 'error', message: 'Failed to create worktree', detail: msg })
      return { success: false, error: msg }
    }
  })

  ipcMain.handle('worktree:cancelCreate', async () => {
    if (activeCreateController) {
      log.info('Cancelling worktree creation')
      activeCreateController.abort()
    }
  })

  ipcMain.handle('worktree:sync', async (_event, worktreePath: string) => {
    log.info(`Syncing working tree: ${worktreePath}`)
    try {
      await runGitCommand(worktreePath, ['reset', '--hard', 'HEAD'])
      return { success: true }
    } catch (error) {
      log.error('Error syncing worktree:', error)
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  })

  ipcMain.handle('worktree:runSetup', async (_event, { repoPath, worktreePath }: { repoPath: string; worktreePath: string }) => {
    log.info(`Re-running setup for: ${worktreePath}`)
    try {
      await runSetupSteps(repoPath, worktreePath)
      return { success: true }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        log.info('No .glit/setup.yaml found, skipping re-run')
        return { success: true }
      }
      log.error('Setup re-run failed:', error)
      return { success: false, error: error instanceof Error ? error.message : String(error) }
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

  ipcMain.handle('dialog:pickFolder', async () => {
    const win = getWindow()
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory', 'createDirectory'],
    })
    if (result.canceled || !result.filePaths[0]) return null
    return result.filePaths[0]
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

  ipcMain.handle('ide:open', async (_event, worktreePath: string, ide?: string) => {
    const resolvedIDE = ide ?? store.get('settings').preferredIDE ?? 'VSCode'
    log.info(`Opening IDE at: ${worktreePath}, ide: ${resolvedIDE}`)
    try {
      let cmd = ''
      if (resolvedIDE === 'Cursor')        cmd = `cursor ${JSON.stringify(worktreePath)}`
      else if (resolvedIDE === 'Zed')      cmd = `zed ${JSON.stringify(worktreePath)}`
      else if (resolvedIDE === 'WebStorm') cmd = `open -a WebStorm ${JSON.stringify(worktreePath)}`
      else if (resolvedIDE === 'Sublime')  cmd = `subl ${JSON.stringify(worktreePath)}`
      else                                 cmd = `code ${JSON.stringify(worktreePath)}`
      await execAsync(cmd)
      return { success: true }
    } catch (error) {
      log.error('Error opening IDE:', error)
      const msg = error instanceof Error ? error.message : String(error)
      return { success: false, error: msg }
    }
  })

  ipcMain.handle('settings:get', async () => {
    return { ...defaultSettings, ...store.get('settings', defaultSettings) }
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

  ipcMain.handle('branch:checkout', async (_event, repoPath: string, branchName: string) => {
    log.info(`Checking out branch: ${branchName} in ${repoPath}`)
    await runGitCommand(repoPath, ['checkout', '--ignore-other-worktrees', branchName])
  })

  ipcMain.handle('branch:rebaseOnto', async (_event, repoPath: string, mainBranch: string) => {
    log.info(`Rebasing ${repoPath} onto ${mainBranch}`)
    try {
      const currentBranch = (await runGitCommand(repoPath, ['branch', '--show-current'])).trim()
      if (!currentBranch) return { success: false, error: 'Not on a branch (detached HEAD)' }
      try {
        await execAsync('git fetch origin --quiet', { cwd: repoPath, timeout: 10000 })
      } catch {
        log.warn('git fetch failed, proceeding with local state')
      }
      await runGitCommand(repoPath, ['rebase', mainBranch])
      return { success: true, branch: currentBranch }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      const hasConflicts = /conflict/i.test(msg) || /CONFLICT/.test(msg)
      return { success: false, hasConflicts, error: msg }
    }
  })

  ipcMain.handle('branch:delete', async (_event, repoPath: string, branchName: string) => {
    log.info(`Deleting branch: ${branchName} in ${repoPath}`)
    await runGitCommand(repoPath, ['branch', '-d', branchName])
  })

  ipcMain.handle('worktree:getMergedBranches', async (_event, repoPath: string, baseBranch: string) => {
    log.info(`Getting merged branches: ${repoPath} (base: ${baseBranch})`)
    try {
      const remoteRef = `origin/${baseBranch}`
      let mergeRef = baseBranch
      try {
        await runGitCommand(repoPath, ['rev-parse', '--verify', remoteRef])
        mergeRef = remoteRef
      } catch {
        // fall through
      }
      const [mergedNames, currentBranch, worktrees] = await Promise.all([
        getLocalBranchNames(repoPath, { mergedInto: mergeRef }),
        runGitCommand(repoPath, ['branch', '--show-current']).then((out) => out.trim()),
        getWorktrees(repoPath),
      ])
      const worktreeBranches = new Set(worktrees.map((wt) => wt.branch).filter((b) => !b.startsWith('detached:')))
      const exclude = new Set([baseBranch, currentBranch, ...worktreeBranches])
      const branches = mergedNames.filter((name) => !exclude.has(name))
      const mergeRefLabel = mergeRef === remoteRef ? remoteRef : `${baseBranch} (local)`
      return { branches, mergeRefLabel }
    } catch (error) {
      log.warn('getMergedBranches failed:', error)
      return []
    }
  })

  ipcMain.handle('pr:getStatus', async (_event, worktreePath: string) => {
    try {
      const { stdout } = await execAsync('gh pr view --json state,number,url', { cwd: worktreePath })
      const data = JSON.parse(stdout)
      return { number: data.number, state: data.state, url: data.url }
    } catch {
      return null
    }
  })

  ipcMain.handle('shell:openUrl', async (_event, url: string) => {
    await shell.openExternal(url)
  })

  ipcMain.handle('shell:openPath', async (_event, filePath: string) => {
    return shell.openPath(filePath)
  })

  // Dev command detection
  ipcMain.handle('worktree:detectDevCommand', async (_event, worktreePath: string): Promise<DevCommandInfo> => {
    let pkgManager: DevCommandInfo['pkgManager'] = 'npm'
    try {
      const files = await fs.readdir(worktreePath)
      if (files.includes('bun.lockb')) pkgManager = 'bun'
      else if (files.includes('pnpm-lock.yaml')) pkgManager = 'pnpm'
      else if (files.includes('yarn.lock')) pkgManager = 'yarn'
    } catch { /* ignore */ }

    try {
      const setupPath = path.join(worktreePath, '.glit', 'setup.yaml')
      const content = await fs.readFile(setupPath, 'utf-8')
      const config = yaml.load(content) as SetupConfig
      if (config.dev) {
        return { command: config.dev, pkgManager, scripts: [] }
      }
    } catch { /* ignore */ }

    let scripts: string[] = []
    try {
      const pkgPath = path.join(worktreePath, 'package.json')
      const pkgContent = await fs.readFile(pkgPath, 'utf-8')
      const pkg = JSON.parse(pkgContent) as { scripts?: Record<string, string> }
      scripts = Object.keys(pkg.scripts ?? {})
    } catch { /* ignore */ }

    const defaultScript = scripts.includes('dev') ? 'dev' : scripts.includes('start') ? 'start' : null
    const command = defaultScript ? `${pkgManager} run ${defaultScript}` : null
    return { command, pkgManager, scripts }
  })

  ipcMain.handle('process:getSavedCommand', async (_event, worktreePath: string): Promise<string | null> => {
    const devCommands = store.get('devCommands', {})
    return devCommands[worktreePath] ?? null
  })

  ipcMain.handle('process:saveCommand', async (_event, worktreePath: string, command: string) => {
    const devCommands = store.get('devCommands', {})
    store.set('devCommands', { ...devCommands, [worktreePath]: command })
  })

  ipcMain.handle('process:getAllDevCommands', async (): Promise<Record<string, string>> => {
    return store.get('devCommands', {})
  })

  ipcMain.handle('process:start', async (_event, worktreePath: string, command: string) => {
    const existing = runningProcesses.get(worktreePath)
    if (existing) {
      try { existing.proc.kill('SIGTERM') } catch { /* ignore */ }
      runningProcesses.delete(worktreePath)
    }
    processLogs.set(worktreePath, [])
    log.info(`Starting process in ${worktreePath}: ${command}`)

    const proc = spawn(command, [], { cwd: worktreePath, shell: true, env: { ...process.env } })
    const info: RunningProcess = { worktreePath, command, pid: proc.pid, startedAt: Date.now() }
    runningProcesses.set(worktreePath, { proc, info })

    const handleLine = (line: string, isError: boolean) => {
      appendProcessLog(worktreePath, line, isError)
      sendWindowEvent(getWindow, 'process:output', { worktreePath, line, isError })
      if (!info.port) {
        const port = detectPort(line)
        if (port) {
          info.port = port
          sendWindowEvent(getWindow, 'process:status', { worktreePath, status: 'running', port, pid: proc.pid })
        }
      }
    }

    pipeLines(proc.stdout, false, handleLine)
    pipeLines(proc.stderr, true, handleLine)

    proc.on('close', (code) => {
      log.info(`Process closed: ${worktreePath}, code: ${code}`)
      runningProcesses.delete(worktreePath)
      sendWindowEvent(getWindow, 'process:status', { worktreePath, status: 'stopped', exitCode: code ?? undefined })
    })

    proc.on('error', (err) => {
      log.error(`Process error in ${worktreePath}`, err)
      runningProcesses.delete(worktreePath)
      sendWindowEvent(getWindow, 'process:status', { worktreePath, status: 'error', error: err.message })
    })

    sendWindowEvent(getWindow, 'process:status', { worktreePath, status: 'running', pid: proc.pid })
    return { success: true, pid: proc.pid }
  })

  ipcMain.handle('process:stop', async (_event, worktreePath: string) => {
    const entry = runningProcesses.get(worktreePath)
    if (!entry) return
    log.info(`Stopping process: ${worktreePath}`)
    entry.proc.kill('SIGTERM')
    setTimeout(() => {
      if (runningProcesses.has(worktreePath)) {
        entry.proc.kill('SIGKILL')
      }
    }, 3000)
  })

  ipcMain.handle('process:list', async (): Promise<RunningProcess[]> => {
    return Array.from(runningProcesses.values()).map(({ info }) => ({ ...info }))
  })

  ipcMain.handle('process:getLogs', async (_event, worktreePath: string): Promise<ProcessLog[]> => {
    return processLogs.get(worktreePath) ?? []
  })
}
