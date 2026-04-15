import log from 'electron-log'
import type { AgentId, TerminalOption } from '../../shared/types.js'
import { getAgentSpec } from './agents.js'
import { startProcess } from './process.js'
import { openTerminal } from './launchers.js'

/**
 * Newlines in shell command lines are awkward to pass through both AppleScript
 * and child_process spawn-with-shell, and most agent CLIs accept a single-line
 * prompt as a positional argument. We collapse them to spaces. v2 should switch
 * to passing prompts via a temp file or stdin to preserve formatting.
 */
function normalizePrompt(prompt: string): string {
  return prompt.replace(/\r\n/g, '\n').replace(/\n+/g, ' ').trim()
}

export async function launchAgentBackground(opts: {
  agentId: AgentId
  prompt: string
  worktreePath: string
}): Promise<{ success: boolean; pid?: number; error?: string }> {
  const spec = getAgentSpec(opts.agentId)
  if (!spec) return { success: false, error: `Unknown agent: ${opts.agentId}` }
  const prompt = normalizePrompt(opts.prompt)
  if (!prompt) return { success: false, error: 'Prompt is empty' }
  const command = spec.buildBackgroundCommand(prompt)
  log.info(`Launching ${spec.id} (background) in ${opts.worktreePath}`)
  return startProcess(opts.worktreePath, command)
}

export async function launchAgentInTerminal(opts: {
  agentId: AgentId
  prompt: string
  worktreePath: string
  terminal: TerminalOption
}): Promise<{ success: boolean; error?: string }> {
  const spec = getAgentSpec(opts.agentId)
  if (!spec) return { success: false, error: `Unknown agent: ${opts.agentId}` }
  const prompt = normalizePrompt(opts.prompt)
  if (!prompt) return { success: false, error: 'Prompt is empty' }
  const command = spec.buildTerminalCommand(prompt)
  log.info(`Launching ${spec.id} (terminal: ${opts.terminal}) in ${opts.worktreePath}`)
  return openTerminal(opts.worktreePath, opts.terminal, { runCommand: command })
}
