import { ipcMain, clipboard, dialog, shell, BrowserWindow, app } from 'electron'
import log from 'electron-log'
import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import fs from 'fs/promises'
import yaml from 'js-yaml'
import type {
  WorktreeWithDiff,
  SetupConfig,
  RepoInfo,
  CreateWorktreeOptions,
  DeleteWorktreeOptions,
  RunningProcess,
  ProcessLog,
  DevCommandInfo,
  RevertLineSpec,
} from '../shared/types.js'
import { sanitizeBranchForPath } from '../shared/branch.js'

import { runGitCommand, getWorktrees, getWorktreeDiff, getAheadBehind, getWorktreeLastActivity, getLocalBranchNames, getBranches, getDefaultBranch } from './services/git.js'
import { shortenPathForDisplay, addToRecentRepos, store, getSettings, setSettings, getRecentRepos, getSavedDevCommand, saveDevCommand, getAllDevCommands } from './services/settings.js'
import { openTerminal, openIDE } from './services/launchers.js'
import { runSetupSteps, previewSetupConfig, saveSetupConfig } from './services/setup.js'
import { initProcessService, sendWindowEvent, startProcess, stopProcess, listProcesses, getProcessLogs, cleanupAllProcesses } from './services/process.js'
import { errorResult } from './services/utils.js'
import { getGitStatus, getGitStatusWithStats, getGitDiff, revertLines, revertFile, applyEdit, deleteLine, insertLine, commitFiles, pushBranch } from './services/git-operations.js'

const execAsync = promisify(exec)

let activeCreateController: AbortController | null = null
let activeRepoPath: string | null = null

app.on('will-quit', () => {
  cleanupAllProcesses()
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

export function setupIpcHandlers(getWindow: () => BrowserWindow | null): void {
  initProcessService(getWindow)

  // ── Repo ──────────────────────────────────────────────────────────

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

  ipcMain.handle('repo:listRecent', async () => getRecentRepos())

  ipcMain.handle('repo:defaultBranch', async (_event, repoPath: string) => {
    log.info(`Detecting default branch for: ${repoPath}`)
    return getDefaultBranch(repoPath)
  })

  // ── Worktree ──────────────────────────────────────────────────────

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
      return errorResult('Error deleting worktree', error)
    }
  })

  ipcMain.handle('worktree:create', async (_event, options: CreateWorktreeOptions) => {
    const { repoPath, branchName, createNewBranch = false, baseBranch, worktreePath: customPath } = options
    log.info(`Creating worktree: ${branchName} in ${repoPath}, newBranch: ${createNewBranch}`)

    const controller = new AbortController()
    activeCreateController = controller
    const { signal } = controller

    // Strip remote prefix so git creates a local tracking branch instead of detached HEAD
    let resolvedBranch = branchName
    if (!createNewBranch) {
      try {
        const remotesOut = await runGitCommand(repoPath, ['remote'])
        const remotes = remotesOut.split('\n').map(r => r.trim()).filter(Boolean)
        for (const remote of remotes) {
          if (branchName.startsWith(remote + '/')) {
            resolvedBranch = branchName.slice(remote.length + 1)
            break
          }
        }
      } catch {
        if (branchName.startsWith('origin/')) {
          resolvedBranch = branchName.slice(7)
        }
      }
    }

    const safeName = sanitizeBranchForPath(resolvedBranch)
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
      sendWindowEvent('create:progress', { step: 'creating', message: 'Creating worktree...' })

      const args = ['worktree', 'add']
      if (createNewBranch) {
        args.push('-b', branchName, worktreePath)
        if (effectiveBase) args.push(effectiveBase)
      } else {
        args.push(worktreePath, resolvedBranch)
      }
      await runGitCommand(repoPath, args, { signal })
      log.info(`Worktree created at: ${worktreePath}`)

      // Load and run setup
      if (!signal.aborted) {
        try {
          sendWindowEvent('create:progress', { step: 'packages', message: 'Running setup...' })
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

      sendWindowEvent('create:progress', { step: 'done', message: 'Worktree ready!' })
      activeCreateController = null
      return {
        success: true,
        worktree: { path: worktreePath, displayPath: shortenPathForDisplay(worktreePath), branch: resolvedBranch, isBare: false, isLocked: false },
      }
    } catch (error) {
      activeCreateController = null
      if (signal.aborted) {
        return { success: false, error: 'cancelled' }
      }
      log.error('Error creating worktree:', error)
      const msg = error instanceof Error ? error.message : String(error)
      sendWindowEvent('create:progress', { step: 'error', message: 'Failed to create worktree', detail: msg })
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
      return errorResult('Error syncing worktree', error)
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
      return errorResult('Setup re-run failed', error)
    }
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

  // ── Branch ────────────────────────────────────────────────────────

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

  // ── Process ───────────────────────────────────────────────────────

  ipcMain.handle('process:start', async (_event, worktreePath: string, command: string) => {
    return startProcess(worktreePath, command)
  })

  ipcMain.handle('process:stop', async (_event, worktreePath: string) => {
    await stopProcess(worktreePath)
  })

  ipcMain.handle('process:list', async (): Promise<RunningProcess[]> => {
    return listProcesses()
  })

  ipcMain.handle('process:getLogs', async (_event, worktreePath: string): Promise<ProcessLog[]> => {
    return getProcessLogs(worktreePath)
  })

  ipcMain.handle('process:getSavedCommand', async (_event, worktreePath: string): Promise<string | null> => {
    return getSavedDevCommand(worktreePath)
  })

  ipcMain.handle('process:saveCommand', async (_event, worktreePath: string, command: string) => {
    saveDevCommand(worktreePath, command)
  })

  ipcMain.handle('process:getAllDevCommands', async (): Promise<Record<string, string>> => {
    return getAllDevCommands()
  })

  // ── Settings ──────────────────────────────────────────────────────

  ipcMain.handle('settings:get', async () => getSettings())

  ipcMain.handle('settings:set', async (_event, newSettings) => {
    setSettings(newSettings)
  })

  // ── Setup ─────────────────────────────────────────────────────────

  ipcMain.handle('setup:preview', async (_event, repoPath: string) => {
    return previewSetupConfig(repoPath)
  })

  ipcMain.handle('setup:save', async (_event, repoPath: string, config: SetupConfig) => {
    await saveSetupConfig(repoPath, config)
  })

  // ── Terminal / IDE ────────────────────────────────────────────────

  ipcMain.handle('terminal:open', async (_event, worktreePath: string, terminal?: string) => {
    const term = (terminal ?? store.get('settings').preferredTerminal ?? 'Terminal') as import('../shared/types.js').TerminalOption
    return openTerminal(worktreePath, term)
  })

  ipcMain.handle('ide:open', async (_event, worktreePath: string, ide?: string) => {
    const resolvedIDE = (ide ?? store.get('settings').preferredIDE ?? 'VSCode') as import('../shared/types.js').IDEOption
    return openIDE(worktreePath, resolvedIDE)
  })

  // ── Dialog / Clipboard / Shell ────────────────────────────────────

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

  ipcMain.handle('shell:openUrl', async (_event, url: string) => {
    await shell.openExternal(url)
  })

  ipcMain.handle('shell:openPath', async (_event, filePath: string) => {
    return shell.openPath(filePath)
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

  // ── Git operations ────────────────────────────────────────────────

  ipcMain.handle('git:status', async (_event, worktreePath: string) => {
    return getGitStatus(worktreePath)
  })

  ipcMain.handle('git:commit', async (_event, worktreePath: string, files: string[], message: string) => {
    return commitFiles(worktreePath, files, message)
  })

  ipcMain.handle('git:push', async (_event, worktreePath: string, force?: boolean) => {
    return pushBranch(worktreePath, force)
  })

  ipcMain.handle('git:statusWithStats', async (_event, worktreePath: string) => {
    return getGitStatusWithStats(worktreePath)
  })

  ipcMain.handle('git:diff', async (_event, worktreePath: string, filePath: string) => {
    return getGitDiff(worktreePath, filePath)
  })

  ipcMain.handle('git:revertLines', async (_event, worktreePath: string, filePath: string, linesToRevert: RevertLineSpec[]) => {
    return revertLines(worktreePath, filePath, linesToRevert)
  })

  ipcMain.handle('git:revertFile', async (_event, worktreePath: string, filePath: string) => {
    return revertFile(worktreePath, filePath)
  })

  ipcMain.handle('git:applyEdit', async (_event, worktreePath: string, filePath: string, lineNumber: number, newContent: string) => {
    return applyEdit(worktreePath, filePath, lineNumber, newContent)
  })

  ipcMain.handle('git:deleteLine', async (_event, worktreePath: string, filePath: string, lineNumber: number) => {
    return deleteLine(worktreePath, filePath, lineNumber)
  })

  ipcMain.handle('git:insertLine', async (_event, worktreePath: string, filePath: string, afterLineNumber: number, content: string) => {
    return insertLine(worktreePath, filePath, afterLineNumber, content)
  })
}
