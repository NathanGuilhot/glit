#!/usr/bin/env node
import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

import type { Worktree, BranchInfo, GitFileStatus } from '../shared/types.js'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface GlobalFlags {
  repo: string
  output: 'text' | 'json'
  color: 'always' | 'never' | 'auto'
  quiet: boolean
  verbose: number
  json: boolean
  help: boolean
  version: boolean
}

interface ParsedCommand {
  command: string
  subcommand?: string
  args: string[]
  flags: Record<string, string | boolean | string[] | number>
}

type CommandHandler = (cmd: ParsedCommand) => Promise<void>

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const VERSION = '0.3.2'
const EXIT = {
  SUCCESS: 0,
  GENERAL: 1,
  INVALID_USAGE: 2,
  NOT_REPO: 3,
  WORKTREE_NOT_FOUND: 4,
  WORKTREE_EXISTS: 5,
  BRANCH_NOT_FOUND: 6,
  REBASE_CONFLICT: 7,
  UPSTREAM_NOT_CONFIGURED: 8,
  INTERRUPTED: 130,
} as const

// ─────────────────────────────────────────────────────────────────────────────
// Global State
// ─────────────────────────────────────────────────────────────────────────────

const globalFlags: GlobalFlags = {
  repo: process.cwd(),
  output: 'text',
  color: 'auto',
  quiet: false,
  verbose: 0,
  json: false,
  help: false,
  version: false,
}

// ─────────────────────────────────────────────────────────────────────────────
// Output Utilities
// ─────────────────────────────────────────────────────────────────────────────

const logVerbose = (msg: string): void => {
  if (globalFlags.verbose > 0) process.stderr.write(`[verbose] ${msg}\n`)
}

const logError = (msg: string, hint?: string): void => {
  process.stderr.write(`glit: ${msg}\n`)
  if (hint) process.stderr.write(`  Hint: ${hint}\n`)
}

const logJson = (data: unknown): void => {
  process.stdout.write(JSON.stringify(data, null, 2) + '\n')
}

const logText = (msg: string): void => {
  if (!globalFlags.quiet) process.stdout.write(msg + '\n')
}

const exit = (code: number): never => process.exit(code)

// ─────────────────────────────────────────────────────────────────────────────
// Git Commands
// ─────────────────────────────────────────────────────────────────────────────

async function runGit(cwd: string, args: string[]): Promise<string> {
  const safeArgs = args.map(arg => /[^\w/-]/.test(arg) ? `'${arg.replace(/'/g, "'\\''")}'` : arg)
  const cmd = `git ${safeArgs.join(' ')}`
  logVerbose(`Git: ${cmd} [${cwd}]`)
  try {
    return execSync(cmd, { cwd, encoding: 'utf-8' }) as string
  } catch (err: unknown) {
    const error = err as { stderr?: string }
    if (error.stderr) logVerbose(`Git stderr: ${error.stderr}`)
    throw err
  }
}

function shortenPath(fullPath: string): string {
  const home = process.env.HOME
  return (home && fullPath.startsWith(home)) ? `~${fullPath.slice(home.length)}` : fullPath
}

async function getWorktrees(repoPath: string): Promise<Worktree[]> {
  const output = await runGit(repoPath, ['worktree', 'list', '--porcelain'])
  const worktrees: Worktree[] = []

  for (const entry of output.split('\n\n').filter(Boolean)) {
    const lines = entry.split('\n')
    let wtPath = '', branch = '', head = '', isBare = false, isLocked = false

    for (const line of lines) {
      if (line.startsWith('worktree ')) wtPath = line.slice(9)
      else if (line.startsWith('branch ')) branch = line.slice(7).replace('refs/heads/', '')
      else if (line.startsWith('HEAD ')) head = line.slice(5)
      else if (line === 'bare') isBare = true
      else if (line.startsWith('locked')) isLocked = true
      else if (line.startsWith('detached')) branch = `detached:${head.slice(0, 8)}`
    }

    if (wtPath) worktrees.push({ path: wtPath, displayPath: shortenPath(wtPath), branch, isBare, isLocked, head })
  }
  return worktrees
}

async function getWorktreeDiff(wtPath: string) {
  try {
    fs.accessSync(wtPath)
    const [indexDiff, headDiff] = await Promise.all([
      runGit(wtPath, ['diff', '--numstat']),
      runGit(wtPath, ['diff', '--numstat', 'HEAD']).catch(() => ''),
    ])

    if (!indexDiff.trim() && headDiff.trim()) return { fileCount: 0, insertionCount: 0, deletionCount: 0, isStale: true }
    if (!headDiff.trim()) return { fileCount: 0, insertionCount: 0, deletionCount: 0, isStale: false }

    let fileCount = 0, insertionCount = 0, deletionCount = 0
    for (const line of headDiff.trim().split('\n')) {
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

async function getAheadBehind(wtPath: string, branch: string) {
  if (!branch || branch.startsWith('detached:')) return { aheadCount: 0, behindCount: 0, hasUpstream: false }
  try { await runGit(wtPath, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}']) }
  catch { return { aheadCount: 0, behindCount: 0, hasUpstream: false } }

  try {
    const out = await runGit(wtPath, ['rev-list', '--count', '--left-right', '@{upstream}...HEAD'])
    const [behind = '0', ahead = '0'] = out.trim().split('\t')
    return { aheadCount: parseInt(ahead, 10) || 0, behindCount: parseInt(behind, 10) || 0, hasUpstream: true }
  } catch {
    return { aheadCount: 0, behindCount: 0, hasUpstream: true }
  }
}

async function getWorktreeLastActivity(wtPath: string): Promise<string | undefined> {
  try { return (await runGit(wtPath, ['log', '-1', '--format=%ar', 'HEAD'])).trim() || undefined }
  catch { return undefined }
}

async function getBranches(repoPath: string): Promise<BranchInfo[]> {
  const branches: BranchInfo[] = []

  try {
    const localNames = (await runGit(repoPath, ['branch', '--format=%(refname:short)'])).split('\n').map(l => l.trim()).filter(Boolean)
    const currentBranch = (await runGit(repoPath, ['branch', '--show-current'])).trim()
    for (const name of localNames) branches.push({ name, isRemote: false, isCurrent: name === currentBranch })
  } catch { logVerbose('Failed to get local branches') }

  try {
    const remoteOutput = await runGit(repoPath, ['branch', '-r', '--format=%(refname:short)'])
    for (const name of remoteOutput.split('\n').filter(Boolean)) {
      const n = name.trim()
      if (n && !n.includes('HEAD')) branches.push({ name: n, isRemote: true, isCurrent: false })
    }
  } catch { logVerbose('Failed to get remote branches') }

  return branches
}

async function getLocalBranchNames(repoPath: string, mergedInto?: string): Promise<string[]> {
  const args: string[] = ['branch', '--format=%(refname:short)']
  if (mergedInto) args.push('--merged', mergedInto)
  return (await runGit(repoPath, args)).split('\n').map(l => l.trim()).filter(Boolean)
}

async function getDefaultBranch(repoPath: string): Promise<string> {
  try {
    const out = await runGit(repoPath, ['symbolic-ref', 'refs/remotes/origin/HEAD'])
    const branch = out.trim().replace('refs/remotes/origin/', '')
    if (branch) return branch
  } catch { /* fall through */ }

  try {
    const names = await getLocalBranchNames(repoPath)
    if (names.includes('main')) return 'main'
    if (names.includes('master')) return 'master'
  } catch { /* fall through */ }

  try {
    const out = await runGit(repoPath, ['rev-parse', '--abbrev-ref', 'HEAD'])
    const branch = out.trim()
    if (branch && branch !== 'HEAD') return branch
  } catch { /* fall through */ }

  return 'main'
}

const STATUS_CODE_MAP: Record<string, GitFileStatus['status']> = {
  M: 'modified', A: 'added', D: 'deleted', R: 'renamed', C: 'copied'
}

async function getGitStatus(wtPath: string): Promise<GitFileStatus[]> {
  try {
    const output = await runGit(wtPath, ['status', '--porcelain', '-uall'])
    if (!output.trim()) return []

    const results: GitFileStatus[] = []
    for (const line of output.split('\n')) {
      if (!line || line.length < 4) continue
      const x = line[0]!
      const y = line[1]!
      const rest = line.slice(3)

      let filePath = rest, oldPath: string | undefined
      const arrowIdx = rest.indexOf(' -> ')
      if (arrowIdx !== -1) { oldPath = rest.slice(0, arrowIdx); filePath = rest.slice(arrowIdx + 4) }

      if (x !== ' ' && x !== '?') {
        const status = STATUS_CODE_MAP[x!]
        if (status) results.push({ path: filePath, status, staged: true, oldPath })
      }

      if (y !== ' ') {
        if (x === '?' && y === '?') results.push({ path: filePath, status: 'untracked', staged: false })
        else if (y !== '?' && y !== undefined) {
          const status = STATUS_CODE_MAP[y]
          if (status) results.push({ path: filePath, status, staged: false, oldPath })
        }
      }
    }
    return results
  } catch { return [] }
}

async function commitFiles(wtPath: string, files: string[], message: string) {
  try {
    await runGit(wtPath, ['add', '--', ...files])
    await runGit(wtPath, ['commit', '-m', message])
    return { success: true }
  } catch (err: unknown) {
    return { success: false, error: (err as { message?: string }).message || String(err) }
  }
}

async function pushBranch(wtPath: string, force?: boolean) {
  try {
    let hasUpstream = true
    try { await runGit(wtPath, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}']) }
    catch { hasUpstream = false }

    if (!hasUpstream) {
      const branch = (await runGit(wtPath, ['branch', '--show-current'])).trim()
      if (!branch) return { success: false, error: 'Cannot push detached HEAD' }
      await runGit(wtPath, ['push', '--set-upstream', 'origin', branch])
    } else {
      await runGit(wtPath, force ? ['push', '--force-with-lease'] : ['push'])
    }
    return { success: true }
  } catch (err: unknown) {
    return { success: false, error: (err as { message?: string }).message || String(err) }
  }
}

async function pullBranch(wtPath: string) {
  try { await runGit(wtPath, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}']) }
  catch { return { success: false, hasUpstream: false, error: 'No upstream branch configured' } }

  try {
    await runGit(wtPath, ['pull', '--ff-only'])
    return { success: true, hasUpstream: true }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    const isNonFastForward = /non[- ]fast[- ]forward|not possible to fast.?forward|diverg/i.test(msg)
    return { success: false, hasUpstream: true, isNonFastForward, error: msg }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Settings
// ─────────────────────────────────────────────────────────────────────────────

interface AppSettings {
  preferredTerminal: string
  preferredIDE: string
  autoRefresh: boolean
}

interface StoreData {
  settings: AppSettings
  recentRepos: { path: string; name: string; displayPath: string; lastUsedAt: string }[]
  devCommands: Record<string, string>
}

const defaultSettings: AppSettings = {
  preferredTerminal: 'Terminal',
  preferredIDE: 'VSCode',
  autoRefresh: true,
}

const getStorePath = (): string => {
  const home = process.env.HOME || ''
  const configHome = process.env.XDG_CONFIG_HOME || path.join(home, '.config')
  return path.join(configHome, 'glit', 'config.json')
}

const getStore = (): StoreData => {
  try {
    return JSON.parse(fs.readFileSync(getStorePath(), 'utf-8'))
  } catch {
    return { settings: { ...defaultSettings }, recentRepos: [], devCommands: {} }
  }
}

const saveStore = (data: StoreData): void => {
  const storePath = getStorePath()
  const dir = path.dirname(storePath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(storePath, JSON.stringify(data, null, 2), 'utf-8')
}

// ─────────────────────────────────────────────────────────────────────────────
// Argument Parsing
// ─────────────────────────────────────────────────────────────────────────────

const SUBCOMMANDS = new Set(['list', 'create', 'delete', 'sync', 'setup', 'checkout', 'rebase', 'start', 'stop', 'logs', 'get', 'set', 'preview', 'edit', 'validate', 'detect', 'switch', 'list-recent', 'terminal', 'ide', 'status', 'commit', 'push', 'pull', 'open', 'recent'])

function parseArgs(args: string[]): ParsedCommand {
  const cmd: ParsedCommand = { command: '', args: [], flags: {} }
  let i = 0

  while (i < args.length) {
    const arg = args[i]!

    if (arg === '--') { cmd.args.push(...args.slice(i + 1)); break }

    if (arg.startsWith('--')) {
      const flag = arg.slice(2)
      if (flag.includes('=')) {
        const [key, value] = flag.split('=', 2)
        cmd.flags[key!] = value!
      } else if (['repo', 'output', 'color'].includes(flag)) {
        cmd.flags[flag] = args[++i] ?? 'true'
      } else {
        cmd.flags[flag] = true
      }
    } else if (arg.startsWith('-') && arg !== '-') {
      for (const short of arg.slice(1)) {
        if (short === 'r') cmd.flags.repo = args[++i] ?? 'true'
        else if (short === 'o') cmd.flags.output = args[++i] ?? 'text'
        else if (short === 'q') cmd.flags.quiet = true
        else if (short === 'v') cmd.flags.verbose = ((cmd.flags.verbose as number) || 0) + 1
        else if (short === 'h') cmd.flags.help = true
        else if (short === 'V') cmd.flags.version = true
        else if (short === 'j') cmd.flags.json = true
        else cmd.flags[short] = true
      }
    } else if (!cmd.command) {
      cmd.command = arg
    } else if (!cmd.subcommand && SUBCOMMANDS.has(arg)) {
      cmd.subcommand = arg
    } else {
      cmd.args.push(arg)
    }
    i++
  }
  return cmd
}

function applyEnvOverrides(): void {
  if (process.env.GLIT_REPO_PATH) globalFlags.repo = process.env.GLIT_REPO_PATH
  if (process.env.GLIT_OUTPUT) globalFlags.output = process.env.GLIT_OUTPUT as 'text' | 'json'
  if (process.env.GLIT_COLOR) globalFlags.color = process.env.GLIT_COLOR as 'always' | 'never' | 'auto'
  if (process.env.GLIT_DEBUG) globalFlags.verbose = 1
}

function applyFlags(cmd: ParsedCommand): void {
  if (cmd.flags.repo) globalFlags.repo = String(cmd.flags.repo)
  if (cmd.flags.output) globalFlags.output = cmd.flags.output as 'text' | 'json'
  if (cmd.flags.color) globalFlags.color = cmd.flags.color as 'always' | 'never' | 'auto'
  if (cmd.flags.quiet) globalFlags.quiet = true
  if (cmd.flags.verbose) globalFlags.verbose = Number(cmd.flags.verbose)
  if (cmd.flags.json) globalFlags.output = 'json'
  if (cmd.flags.help) globalFlags.help = true
  if (cmd.flags.version) globalFlags.version = true
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation Helpers
// ─────────────────────────────────────────────────────────────────────────────

const isGitRepo = (repoPath: string): boolean => {
  try {
    execSync('git rev-parse --git-dir', { cwd: repoPath, encoding: 'utf-8', stdio: 'pipe' })
    return true
  } catch { return false }
}

const requireRepo = (repoPath: string): void => {
  if (!isGitRepo(repoPath)) { logError(`not a git repository: ${repoPath}`); exit(EXIT.NOT_REPO) }
}

const requireArg = (value: string | undefined, name: string): string => {
  if (!value) { logError(`missing required argument: ${name}`); exit(EXIT.INVALID_USAGE) }
  return value as string
}

async function findWorktreeByPath(repoPath: string, targetPath: string): Promise<Worktree | undefined> {
  const worktrees = await getWorktrees(repoPath)
  const normalizedTarget = path.normalize(targetPath)
  return worktrees.find(wt => {
    const normalizedWtPath = path.normalize(wt.path)
    return normalizedWtPath === normalizedTarget || normalizedWtPath.endsWith(normalizedTarget)
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Help Text
// ─────────────────────────────────────────────────────────────────────────────

const HELP_TEXT: Record<string, string> = {
  '': `glit v${VERSION} - Git worktree manager

Usage: glit <command> [options] [args]

Global options:
  --repo <path>, -r <path>   Git repository path (default: cwd)
  --output <format>, -o <format>  Output format: text or json (default: text)
  --color <when>             Color: always, never, or auto (default: auto)
  --quiet, -q                Suppress informational output
  --verbose, -v               Enable verbose output (can repeat)
  --json, -j                  Output as JSON
  --help, -h                 Show this help
  --version, -V              Show version

Commands:
  worktree                   Manage worktrees (list, create, delete, sync, setup)
  branch                     Manage branches (list, checkout, rebase, delete)
  process                    Manage dev processes (start, stop, list, logs)
  settings                   Get/set settings (get, set)
  setup                      Manage setup.yaml (preview, edit, validate)
  repo                       Manage repositories (detect, switch, list-recent)
  open                       Open in terminal or IDE
  git                        Run git commands (status, commit, push, pull)
  pr                         GitHub PR operations (status, open)

Run 'glit <command> --help' for command-specific help.`,

  'worktree': `Usage: glit worktree <subcommand> [options]

Subcommands:
  list [options]            List all worktrees
  create <branch> [options]  Create a new worktree
  delete <path> [options]   Delete a worktree
  sync <path>                Sync worktree to HEAD
  setup <path>               Re-run setup for a worktree

Run 'glit worktree <subcommand> --help' for subcommand-specific help.`,

  'worktree list': `Usage: glit worktree list [options]

Options:
  --format <style>           Table style: simple, compact, detail (default: simple)
  --branch <pattern>        Filter by branch name (case-insensitive substring)`,

  'worktree create': `Usage: glit worktree create <branch-name> [options]

Options:
  --base <branch>           Base branch (default: auto-detected main/master)
  --path <dir>              Worktree directory path
  --no-setup                Skip running setup after creation
  --dry-run                 Show what would be created without creating
  --force                   Force creation even if worktree exists`,

  'worktree delete': `Usage: glit worktree delete <worktree-path> [options]

Options:
  --force                   Delete even with uncommitted changes
  --delete-files            Also remove working directory files
  --no-gc                   Skip git worktree prune after deletion`,

  'branch': `Usage: glit branch <subcommand> [options]

Subcommands:
  list [options]            List branches
  checkout <name>           Checkout a branch
  rebase <branch> [opts]    Rebase current branch
  delete <name> [options]   Delete a branch`,

  'branch list': `Usage: glit branch list [options]

Options:
  --local                   Show only local branches (default)
  --remote                  Show only remote branches
  --merged [<branch>]       Show branches merged into branch
  --no-merged [<branch>]    Show branches NOT merged into branch`,

  'git': `Usage: glit git <subcommand> [options]

Subcommands:
  status                     Show git status
  commit [-m <msg>] [files]  Commit files
  push [--force]             Push branch
  pull                      Pull with --ff-only`,
}

function showHelp(command?: string, subcommand?: string): void {
  const key = subcommand ? `${command ?? ''} ${subcommand}` : (command ?? '')
  const fallback = HELP_TEXT[command ?? ''] || HELP_TEXT[''] || ''
  const text = HELP_TEXT[key] || fallback
  logText(text)
}

// ─────────────────────────────────────────────────────────────────────────────
// Command Handlers
// ─────────────────────────────────────────────────────────────────────────────

async function handleWorktreeList(cmd: ParsedCommand) {
  requireRepo(globalFlags.repo)

  const format = (cmd.flags.format as string) || 'simple'
  const branchFilter = (cmd.flags.branch as string)?.toLowerCase()

  const worktrees = await getWorktrees(globalFlags.repo)
  const worktreesWithStats = await Promise.all(worktrees.map(async (wt) => {
    const [diff, aheadBehind, lastActivity] = await Promise.all([
      getWorktreeDiff(wt.path),
      getAheadBehind(wt.path, wt.branch),
      getWorktreeLastActivity(wt.path),
    ])
    return { ...wt, ...diff, ...aheadBehind, lastActivity, isCurrent: wt.path === globalFlags.repo }
  }))

  const filtered = branchFilter
    ? worktreesWithStats.filter(wt => wt.branch.toLowerCase().includes(branchFilter))
    : worktreesWithStats

  if (globalFlags.output === 'json') { logJson(filtered); return }

  if (format === 'detail') {
    logText('PATH                      BRANCH       DIFF        UPSTREAM              LAST ACTIVITY')
    for (const wt of filtered) {
      const upstream = wt.hasUpstream ? `${wt.aheadCount} ahead, ${wt.behindCount} behind` : '—'
      const diffStr = wt.fileCount > 0 ? `+${wt.insertionCount}/-${wt.deletionCount}` : 'clean'
      logText(`${(wt.displayPath ?? wt.path).padEnd(24)} ${wt.branch.padEnd(12)} ${diffStr.padEnd(12)} ${upstream.padEnd(22)} ${wt.lastActivity || '—'}`)
    }
  } else {
    logText('WORKTREE          BRANCH       STATUS')
    for (const wt of filtered) {
      const status = wt.isCurrent ? 'current' : (wt.isStale ? 'stale' : 'ok')
      logText(`${(wt.displayPath ?? wt.path).padEnd(18)} ${wt.branch.padEnd(12)} ${status}`)
    }
  }
}

async function handleWorktreeCreate(cmd: ParsedCommand) {
  requireRepo(globalFlags.repo)
  const branchName = requireArg(cmd.args[0], '<branch-name>')
  const baseBranch = (cmd.flags.base as string) || await getDefaultBranch(globalFlags.repo)
  const worktreePath = (cmd.flags.path as string) || path.join(globalFlags.repo, '..', `glit-worktrees`, branchName.replace(/\//g, '-'))
  const noSetup = Boolean(cmd.flags['no-setup'])
  const dryRun = Boolean(cmd.flags['dry-run'])

  // Validate inputs: check if branch already exists
  const existingBranches = await getLocalBranchNames(globalFlags.repo)
  if (existingBranches.includes(branchName)) {
    logError(`branch already exists: ${branchName}`)
    exit(EXIT.WORKTREE_EXISTS)
  }

  // Validate inputs: check if worktree path already exists
  if (fs.existsSync(worktreePath)) {
    logError(`worktree path already exists: ${worktreePath}`)
    exit(EXIT.WORKTREE_EXISTS)
  }

  // Dry-run: show what would be created and exit
  if (dryRun) {
    logText('[dry-run] Would create worktree:')
    logText(`  branch: ${branchName}`)
    logText(`  base: ${baseBranch}`)
    logText(`  path: ${worktreePath}`)
    logText(`  setup: ${noSetup ? 'skipped' : 'run after creation'}`)
    return
  }

  try {
    logText('Creating worktree...')
    await runGit(globalFlags.repo, ['worktree', 'add', '-b', branchName, worktreePath, baseBranch])
    if (!noSetup) logText('Running setup...')
    logText(`Worktree created at: ${worktreePath}`)
  } catch (err: unknown) {
    const msg = (err as { message?: string }).message || String(err)
    logError(`failed to create worktree: ${msg}`)
    if (msg.includes('already exists')) exit(EXIT.WORKTREE_EXISTS)
    exit(EXIT.GENERAL)
  }
}

async function handleWorktreeDelete(cmd: ParsedCommand) {
  requireRepo(globalFlags.repo)
  const worktreePath = requireArg(cmd.args[0], '<worktree-path>')
  const force = Boolean(cmd.flags.force)
  const deleteFiles = Boolean(cmd.flags['delete-files'])
  const noGc = Boolean(cmd.flags['no-gc'])

  const wt = await findWorktreeByPath(globalFlags.repo, worktreePath)
  if (!wt) { logError(`worktree not found: ${worktreePath}`); exit(EXIT.WORKTREE_NOT_FOUND) }
  const worktree = wt!
  if (worktree.path === globalFlags.repo) { logError('cannot delete the current worktree'); exit(EXIT.INVALID_USAGE) }
  if (!force && !globalFlags.quiet) logText(`Confirm delete of worktree at ${worktree.path}? [y/N]`)

  try {
    const args = ['worktree', 'remove', worktree.path]
    if (force) args.push('--force')
    if (deleteFiles) args.push('--detach')
    await runGit(globalFlags.repo, args)
    logText('Deleted worktree.')
  } catch (err: unknown) {
    logError(`failed to delete worktree: ${(err as { message?: string }).message || String(err)}`)
    exit(EXIT.GENERAL)
  }

  if (!noGc) runGit(globalFlags.repo, ['worktree', 'prune']).catch(() => {})
}

async function handleBranchList(cmd: ParsedCommand) {
  requireRepo(globalFlags.repo)
  const showRemote = Boolean(cmd.flags.remote)
  const showLocal = !showRemote
  const merged = cmd.flags.merged as string | undefined
  const notMerged = cmd.flags['no-merged'] as string | undefined

  let filtered = await getBranches(globalFlags.repo)
  if (showRemote) filtered = filtered.filter(b => b.isRemote)
  else if (showLocal) filtered = filtered.filter(b => !b.isRemote)

  if (merged !== undefined) {
    const mergedBranches = await getLocalBranchNames(globalFlags.repo, merged || undefined)
    filtered = filtered.filter(b => mergedBranches.includes(b.name))
  } else if (notMerged !== undefined) {
    const notMergedBranches = await getLocalBranchNames(globalFlags.repo, notMerged || undefined)
    filtered = filtered.filter(b => !notMergedBranches.includes(b.name))
  }

  if (globalFlags.output === 'json') { logJson(filtered); return }
  logText('CURRENT   NAME')
  for (const b of filtered) logText(`${b.isCurrent ? '*' : ' '}         ${b.name}`)
}

async function handleGitStatus() {
  requireRepo(globalFlags.repo)
  const status = await getGitStatus(globalFlags.repo)
  if (globalFlags.output === 'json') { logJson(status); return }
  for (const s of status) logText(`${s.staged ? 'Y' : ' '}${s.status[0]!.toUpperCase()} ${s.path}`)
}

async function handleGitCommit(cmd: ParsedCommand) {
  requireRepo(globalFlags.repo)
  const messageIdx = cmd.args.indexOf('-m')
  const message = messageIdx !== -1 ? cmd.args[messageIdx + 1] : undefined
  const files = cmd.args.filter(a => a !== '-m' && a !== message)

  if (!message) { logError('missing required argument: -m <message>'); exit(EXIT.INVALID_USAGE) }

  const result = await commitFiles(globalFlags.repo, files.length > 0 ? files : ['.'], message as string)
  if (!result.success) { logError(`commit failed: ${result.error}`); exit(EXIT.GENERAL) }
  logText('Committed.')
}

async function handleGitPush(cmd: ParsedCommand) {
  requireRepo(globalFlags.repo)
  const result = await pushBranch(globalFlags.repo, Boolean(cmd.flags.force))
  if (!result.success) { logError(`push failed: ${result.error}`); exit(EXIT.GENERAL) }
  logText('Pushed.')
}

async function handleGitPull() {
  requireRepo(globalFlags.repo)
  const result = await pullBranch(globalFlags.repo)
  if (!result.success) {
    logError(`pull failed: ${result.error}`)
    if (result.isNonFastForward) exit(EXIT.REBASE_CONFLICT)
    exit(EXIT.GENERAL)
  }
  logText('Pulled.')
}

async function handleSettingsGet(cmd: ParsedCommand) {
  const store = getStore()
  const key = cmd.args[0] as keyof AppSettings | undefined

  if (key) {
    const value = store.settings[key]
    if (value === undefined) { logError(`unknown setting: ${key}`); exit(EXIT.INVALID_USAGE) }
    if (globalFlags.output === 'json') logJson({ [key]: value })
    else logText(`${key}  ${value}`)
  } else {
    if (globalFlags.output === 'json') logJson(store.settings)
    else {
      logText(`preferredTerminal  ${store.settings.preferredTerminal}`)
      logText(`preferredIDE  ${store.settings.preferredIDE}`)
      logText(`autoRefresh  ${store.settings.autoRefresh}`)
    }
  }
}

async function handleSettingsSet(cmd: ParsedCommand) {
  const key = cmd.args[0] as keyof AppSettings
  const value = cmd.args[1]
  if (!key || value === undefined) { logError('usage: glit settings set <key> <value>'); exit(EXIT.INVALID_USAGE) }

  const store = getStore()
  if (key === 'autoRefresh') store.settings[key] = value === 'true'
  else (store.settings as unknown as Record<string, unknown>)[key] = value
  saveStore(store)
  logText('Settings saved.')
}

async function handleRepoDetect() {
  const cwd = process.cwd()
  const isRepo = isGitRepo(cwd)
  const name = path.basename(cwd)
  const displayPath = cwd.replace(process.env.HOME || '', '~')

  if (globalFlags.output === 'json') logJson({ isRepo, path: cwd, displayPath, name })
  else logText(`${displayPath}  ${isRepo ? '✓ git repo (current)' : '✗ not a git repo'}`)
}

async function handleOpenTerminal(cmd: ParsedCommand) {
  const wtPath = cmd.args[0] || globalFlags.repo
  requireRepo(wtPath)
  const terminal = (cmd.flags.terminal as string) || getStore().settings.preferredTerminal
  logText(`Opening terminal at ${wtPath} with ${terminal}...`)
  // Stub: implement terminal opening
}

async function handleOpenIde(cmd: ParsedCommand) {
  const wtPath = cmd.args[0] || globalFlags.repo
  requireRepo(wtPath)
  const ide = (cmd.flags.ide as string) || getStore().settings.preferredIDE
  logText(`Opening ${ide} at ${wtPath}...`)
  // Stub: implement IDE opening
}

async function handleProcessList() {
  const store = getStore()
  const running = Object.entries(store.devCommands)
  if (running.length === 0) { logText('No running processes.'); return }
  logText('WORKTREE                  COMMAND')
  for (const [wtPath, command] of running) logText(`${wtPath.padEnd(24)} ${command}`)
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Dispatch
// ─────────────────────────────────────────────────────────────────────────────

const COMMANDS: Record<string, { subcommand?: boolean; handlers: Record<string, CommandHandler> }> = {
  worktree: {
    handlers: { list: handleWorktreeList, create: handleWorktreeCreate, delete: handleWorktreeDelete },
  },
  branch: {
    handlers: { list: handleBranchList },
  },
  git: {
    handlers: { status: handleGitStatus, commit: handleGitCommit, push: handleGitPush, pull: handleGitPull },
  },
  settings: {
    handlers: { get: handleSettingsGet, set: handleSettingsSet },
  },
  repo: {
    handlers: { detect: handleRepoDetect },
  },
  open: {
    handlers: { terminal: handleOpenTerminal, ide: handleOpenIde },
  },
  process: {
    handlers: { list: handleProcessList },
  },
}

async function dispatch(cmd: ParsedCommand): Promise<void> {
  // Handle special cases
  if (cmd.command === 'help' || cmd.command === '') { showHelp(); return }
  if (cmd.command === 'version' || cmd.command === '--version' || cmd.command === '-V') { logText(`glit v${VERSION}`); return }

  const command = COMMANDS[cmd.command]
  if (!command) { logError(`Unknown command: ${cmd.command}`); logText("Run 'glit --help' for usage."); exit(EXIT.INVALID_USAGE) }
  const cmdDef = command!

  const subcommand = cmd.subcommand ?? ''
  const handler = cmdDef.handlers[subcommand]
  if (!handler) {
    const available = Object.keys(cmdDef.handlers).join(', ')
    logError(`unknown ${cmd.command} subcommand: ${subcommand || '(none)'}`)
    logText(`Available subcommands: ${available}`)
    exit(EXIT.INVALID_USAGE)
  }

  await handler!(cmd)
}

// ─────────────────────────────────────────────────────────────────────────────
// Entry Point
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const rawArgs = process.argv.slice(2)
  applyEnvOverrides()
  const cmd = parseArgs(rawArgs)
  applyFlags(cmd)

  if (globalFlags.version) { logText(`glit v${VERSION}`); exit(EXIT.SUCCESS) }
  if (globalFlags.help) { showHelp(cmd.command || undefined, cmd.subcommand); exit(EXIT.SUCCESS) }

  await dispatch(cmd)
  exit(EXIT.SUCCESS)
}

main().catch((err) => {
  logError(err instanceof Error ? err.message : String(err))
  exit(EXIT.GENERAL)
})
