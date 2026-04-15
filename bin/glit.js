#!/usr/bin/env node
import { spawn } from 'child_process'
import { dirname, join, resolve } from 'path'
import { fileURLToPath } from 'url'
import { existsSync, statSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const packageRoot = join(__dirname, '..')

const args = process.argv.slice(2)
const ELECTRON_FLAGS = ['--electron', '-e', '--foreground', '-f']
const CLI_COMMANDS = new Set(['worktree', 'branch', 'git', 'settings', 'repo', 'open', 'process', 'help', 'version'])

const electronRequested = args.some(a => ELECTRON_FLAGS.includes(a))
const foreground = args.includes('--foreground') || args.includes('-f')
const firstArg = args[0] || ''

function isExistingDir(p) {
  try { return statSync(resolve(p)).isDirectory() } catch { return false }
}

// Route to Electron when: explicitly requested, or first arg is an existing directory
// (preserves legacy `glit /some/repo` behavior).
const isBarePathMode = args.length > 0 && !firstArg.startsWith('-') && !CLI_COMMANDS.has(firstArg) && isExistingDir(firstArg)
const isCliMode = !electronRequested && args.length > 0 && !isBarePathMode

function runAndExit(cmd, cmdArgs, extraEnv = {}) {
  const child = spawn(cmd, cmdArgs, { stdio: 'inherit', env: { ...process.env, ...extraEnv } })
  child.on('error', (err) => {
    console.error('Failed to run:', err.message)
    process.exit(1)
  })
  child.on('exit', (code) => process.exit(code ?? 0))
}

if (isCliMode) {
  const cliEntry = join(packageRoot, 'dist', 'cli', 'index.js')
  const cliSource = join(packageRoot, 'src', 'cli', 'index.ts')
  const tsxBin = join(packageRoot, 'node_modules', '.bin', 'tsx')

  if (existsSync(cliEntry))       runAndExit('node', [cliEntry, ...args])
  else if (existsSync(tsxBin))    runAndExit(tsxBin, [cliSource, ...args])
  else if (existsSync(cliSource)) runAndExit('npx', ['tsx', cliSource, ...args])
  else {
    console.error('Error: CLI not built. Run npm run build:cli or use tsx during development.')
    console.error('Note: For development, run: npx tsx src/cli/index.ts <command>')
    process.exit(1)
  }
} else {
  const electronBin = join(packageRoot, 'node_modules', '.bin', 'electron')
  const mainEntry = join(packageRoot, 'dist', 'main', 'index.js')

  if (!existsSync(electronBin)) {
    console.error('Error: electron not found. Run npm install in', packageRoot)
    process.exit(1)
  }
  if (!existsSync(mainEntry)) {
    console.error('Error: app not built. Run npm run package in', packageRoot)
    process.exit(1)
  }

  const filteredArgs = args.filter(a => !ELECTRON_FLAGS.includes(a))
  const repoPath = filteredArgs[0] ? resolve(filteredArgs[0]) : process.cwd()
  const electronEnv = { GLIT_REPO_PATH: repoPath, NODE_ENV: process.env.NODE_ENV || 'production' }

  if (foreground) {
    runAndExit(electronBin, [mainEntry, repoPath], electronEnv)
  } else {
    const child = spawn(electronBin, [mainEntry, repoPath], {
      detached: true,
      stdio: 'ignore',
      env: { ...process.env, ...electronEnv },
    })
    child.on('error', (err) => {
      console.error('Failed to launch Glit:', err.message)
      process.exit(1)
    })
    child.unref()
  }
}
