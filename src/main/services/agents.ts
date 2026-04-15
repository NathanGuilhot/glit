import { exec } from 'child_process'
import { promisify } from 'util'
import log from 'electron-log'
import type { AgentId, AgentInfo } from '../../shared/types.js'

const execAsync = promisify(exec)

export interface AgentSpec extends AgentInfo {
  /** how to build the non-interactive (background) command */
  buildBackgroundCommand: (prompt: string) => string
  /** how to build the interactive (terminal) command */
  buildTerminalCommand: (prompt: string) => string
}

/**
 * POSIX single-quote escape — wraps the string in single quotes and escapes
 * any embedded single quotes via the standard `'\''` sequence. Safe for sh,
 * bash, zsh argument quoting.
 */
export function shellQuote(s: string): string {
  return `'${s.replace(/'/g, "'\\''")}'`
}

export const SUPPORTED_AGENTS: AgentSpec[] = [
  {
    id: 'claude',
    label: 'Claude Code',
    buildBackgroundCommand: (p) => `claude -p ${shellQuote(p)}`,
    buildTerminalCommand: (p) => `claude ${shellQuote(p)}`,
  },
  {
    id: 'codex',
    label: 'Codex',
    buildBackgroundCommand: (p) => `codex exec ${shellQuote(p)}`,
    buildTerminalCommand: (p) => `codex ${shellQuote(p)}`,
  },
  {
    id: 'opencode',
    label: 'OpenCode',
    // `opencode <arg>` treats the positional as a PROJECT PATH, not a prompt.
    // To seed the TUI with an initial prompt we have to use `--prompt`.
    buildBackgroundCommand: (p) => `opencode run ${shellQuote(p)}`,
    buildTerminalCommand: (p) => `opencode --prompt ${shellQuote(p)}`,
  },
  {
    id: 'gemini',
    label: 'Gemini CLI',
    // Gemini CLI has no "interactive with initial prompt" mode — `-p` is the
    // only flag that passes a prompt, and it runs non-interactively. Use it
    // for both modes so the prompt actually reaches the model.
    buildBackgroundCommand: (p) => `gemini -p ${shellQuote(p)}`,
    buildTerminalCommand: (p) => `gemini -p ${shellQuote(p)}`,
  },
  {
    id: 'cursor-agent',
    label: 'Cursor Agent',
    buildBackgroundCommand: (p) => `cursor-agent -p ${shellQuote(p)}`,
    buildTerminalCommand: (p) => `cursor-agent ${shellQuote(p)}`,
  },
  {
    id: 'copilot',
    label: 'GitHub Copilot CLI',
    // Copilot CLI's interactive mode (bare `copilot`) does not accept a
    // pre-filled initial prompt. `-p` / `--prompt` is the only way to
    // pass one, and it runs non-interactively (completes the task then
    // exits). Mirror the Gemini approach and use `-p` for both modes so
    // the prompt actually reaches the model.
    buildBackgroundCommand: (p) => `copilot -p ${shellQuote(p)}`,
    buildTerminalCommand: (p) => `copilot -p ${shellQuote(p)}`,
  },
]

export function getAgentSpec(id: AgentId): AgentSpec | undefined {
  return SUPPORTED_AGENTS.find((a) => a.id === id)
}

async function isCommandAvailable(binary: string): Promise<boolean> {
  const lookup = process.platform === 'win32' ? `where ${binary}` : `command -v ${binary}`
  try {
    await execAsync(lookup, { shell: process.env.SHELL ?? '/bin/sh', timeout: 2000 })
    return true
  } catch {
    return false
  }
}

export async function detectAvailableAgents(): Promise<AgentInfo[]> {
  log.info('Detecting available agents on PATH')
  const checks = await Promise.all(
    SUPPORTED_AGENTS.map(async (a) => ((await isCommandAvailable(a.id)) ? a : null)),
  )
  const found = checks.filter((a): a is AgentSpec => a !== null)
  log.info(`Detected ${found.length} agent(s): ${found.map((a) => a.id).join(', ') || 'none'}`)
  return found.map(({ id, label }) => ({ id, label }))
}
