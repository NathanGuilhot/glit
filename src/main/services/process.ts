import { spawn } from 'child_process'
import type { ChildProcess } from 'child_process'
import log from 'electron-log'
import type { BrowserWindow } from 'electron'
import type { RunningProcess, ProcessLog } from '../../shared/types.js'

const runningProcesses = new Map<string, { proc: ChildProcess; info: RunningProcess }>()
const processLogs = new Map<string, ProcessLog[]>()
const MAX_LOG_LINES = 500

// Needs getWindow for sending events
let _getWindow: (() => BrowserWindow | null) | null = null

export function initProcessService(getWindow: () => BrowserWindow | null): void {
  _getWindow = getWindow
}

export function sendWindowEvent(channel: string, data: unknown): void {
  const win = _getWindow?.()
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

export async function startProcess(worktreePath: string, command: string): Promise<{ success: boolean; pid?: number; error?: string }> {
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
    sendWindowEvent('process:output', { worktreePath, line, isError })
    if (!info.port) {
      const port = detectPort(line)
      if (port) {
        info.port = port
        sendWindowEvent('process:status', { worktreePath, status: 'running', port, pid: proc.pid })
      }
    }
  }

  pipeLines(proc.stdout, false, handleLine)
  pipeLines(proc.stderr, true, handleLine)

  proc.on('close', (code) => {
    log.info(`Process closed: ${worktreePath}, code: ${code}`)
    runningProcesses.delete(worktreePath)
    sendWindowEvent('process:status', { worktreePath, status: 'stopped', exitCode: code ?? undefined })
  })

  proc.on('error', (err) => {
    log.error(`Process error in ${worktreePath}`, err)
    runningProcesses.delete(worktreePath)
    sendWindowEvent('process:status', { worktreePath, status: 'error', error: err.message })
  })

  sendWindowEvent('process:status', { worktreePath, status: 'running', pid: proc.pid })
  return { success: true, pid: proc.pid }
}

export async function stopProcess(worktreePath: string): Promise<void> {
  const entry = runningProcesses.get(worktreePath)
  if (!entry) return
  log.info(`Stopping process: ${worktreePath}`)
  entry.proc.kill('SIGTERM')
  setTimeout(() => {
    if (runningProcesses.has(worktreePath)) {
      entry.proc.kill('SIGKILL')
    }
  }, 3000)
}

export function listProcesses(): RunningProcess[] {
  return Array.from(runningProcesses.values()).map(({ info }) => ({ ...info }))
}

export function getProcessLogs(worktreePath: string): ProcessLog[] {
  return processLogs.get(worktreePath) ?? []
}

export function cleanupAllProcesses(): void {
  for (const { proc } of runningProcesses.values()) {
    try { proc.kill('SIGTERM') } catch { /* ignore */ }
  }
}
