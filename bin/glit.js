#!/usr/bin/env node
import { spawn } from 'child_process'
import { dirname, join, resolve } from 'path'
import { fileURLToPath } from 'url'
import { existsSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const packageRoot = join(__dirname, '..')

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

const args = process.argv.slice(2)
const repoPath = args[0] ? resolve(args[0]) : process.cwd()

const child = spawn(electronBin, [mainEntry, repoPath], {
  stdio: 'inherit',
  env: { ...process.env, GLIT_REPO_PATH: repoPath, NODE_ENV: process.env.NODE_ENV || 'production' },
})

child.on('error', (err) => {
  console.error('Failed to launch Glit:', err.message)
  process.exit(1)
})

child.on('exit', (code) => {
  process.exit(code ?? 0)
})
