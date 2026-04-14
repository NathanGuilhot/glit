#!/usr/bin/env node
import { spawn } from 'child_process'
import { dirname, join, resolve } from 'path'
import { fileURLToPath } from 'url'
import { existsSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const packageRoot = join(__dirname, '..')

// Check if running in CLI mode (no electron flags, just glit command)
const args = process.argv.slice(2)
const electronFlags = ['--electron', '-e', '--foreground', '-f']
const isCliMode = !args.some(arg => electronFlags.includes(arg)) && args.length > 0
const foreground = args.includes('--foreground') || args.includes('-f')

// CLI mode: run the TypeScript CLI directly via tsx or use pre-built
if (isCliMode) {
  const cliEntry = join(packageRoot, 'dist', 'cli', 'index.js')
  const cliSource = join(packageRoot, 'src', 'cli', 'index.ts')

  // Try to use the compiled CLI first
  if (existsSync(cliEntry)) {
    // Use Node.js directly since CLI is JS
    const child = spawn('node', [cliEntry, ...args], {
      stdio: 'inherit',
      env: { ...process.env },
    })
    child.on('error', (err) => {
      console.error('Failed to run CLI:', err.message)
      process.exit(1)
    })
    child.on('exit', (code) => {
      process.exit(code ?? 0)
    })
  } else if (existsSync(cliSource)) {
    // Fall back to tsx for development
    const tsxBin = join(packageRoot, 'node_modules', '.bin', 'tsx')
    if (existsSync(tsxBin)) {
      const child = spawn(tsxBin, [cliSource, ...args], {
        stdio: 'inherit',
        env: { ...process.env },
      })
      child.on('error', (err) => {
        console.error('Failed to run CLI:', err.message)
        process.exit(1)
      })
      child.on('exit', (code) => {
        process.exit(code ?? 0)
      })
    } else {
      // Last resort: try npx tsx
      const child = spawn('npx', ['tsx', cliSource, ...args], {
        stdio: 'inherit',
        env: { ...process.env },
      })
      child.on('error', (err) => {
        console.error('Failed to run CLI:', err.message)
        process.exit(1)
      })
      child.on('exit', (code) => {
        process.exit(code ?? 0)
      })
    }
  } else {
    console.error('Error: CLI not built. Run npm run build:cli or use tsx during development.')
    console.error('Note: For development, run: npx tsx src/cli/index.ts <command>')
    process.exit(1)
  }
} else {
  // Electron mode (original behavior)
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

  // Filter out launcher-only flags before passing to Electron
  const filteredArgs = args.filter(arg => !electronFlags.includes(arg))
  const repoPath = filteredArgs[0] ? resolve(filteredArgs[0]) : process.cwd()

  const spawnEnv = { ...process.env, GLIT_REPO_PATH: repoPath, NODE_ENV: process.env.NODE_ENV || 'production' }

  if (foreground) {
    const child = spawn(electronBin, [mainEntry, repoPath], {
      stdio: 'inherit',
      env: spawnEnv,
    })
    child.on('error', (err) => {
      console.error('Failed to launch Glit:', err.message)
      process.exit(1)
    })
    child.on('exit', (code) => {
      process.exit(code ?? 0)
    })
  } else {
    const child = spawn(electronBin, [mainEntry, repoPath], {
      detached: true,
      stdio: 'ignore',
      env: spawnEnv,
    })
    child.on('error', (err) => {
      console.error('Failed to launch Glit:', err.message)
      process.exit(1)
    })
    child.unref()
  }
}