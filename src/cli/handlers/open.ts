import { exec } from 'child_process'
import { promisify } from 'util'

import { EXIT } from '../constants.js'
import { globalFlags } from '../flags.js'
import { exit, logError, logText } from '../logger.js'
import { getStore } from '../store.js'
import type { ParsedCommand } from '../types.js'
import { requireRepo } from '../validation.js'

const execAsync = promisify(exec)

function terminalCommand(wtPath: string, terminal: string): string {
  const quoted = JSON.stringify(wtPath)
  const escaped = wtPath.replace(/'/g, "'\\''")
  switch (terminal) {
    case 'iTerm2':
    case 'iTerm':
      return `osascript -e 'tell application "iTerm"
  activate
  if (count of windows) = 0 then
    create window with default profile
    tell current session of current window
      write text "cd ${escaped}"
    end tell
  else
    tell current window
      create tab with default profile
      tell current session
        write text "cd ${escaped}"
      end tell
    end tell
  end if
end tell'`
    case 'Hyper':     return `open -a Hyper ${quoted}`
    case 'Kitty':     return `kitty --directory ${quoted}`
    case 'Alacritty': return `alacritty --working-directory ${quoted}`
    case 'Warp':      return `open "warp://action/new_tab?path=${encodeURIComponent(wtPath)}"`
    default:          return `osascript -e 'tell application "Terminal"
  activate
  if (count of windows) = 0 then
    do script "cd ${escaped}"
  else
    do script "cd ${escaped}" in front window
  end if
end tell'`
  }
}

function ideCommand(wtPath: string, ide: string): string {
  const quoted = JSON.stringify(wtPath)
  switch (ide) {
    case 'Cursor':         return `cursor ${quoted}`
    case 'Zed':            return `zed ${quoted}`
    case 'WebStorm':       return `open -a WebStorm ${quoted}`
    case 'Sublime':        return `subl ${quoted}`
    case 'VSCodeInsiders': return `open -a "Visual Studio Code - Insiders" ${quoted}`
    case 'Antigravity':    return `open -a Antigravity ${quoted}`
    default:               return `code ${quoted}`
  }
}

export async function handleTerminal(cmd: ParsedCommand) {
  const wtPath = cmd.args[0] || globalFlags.repo
  requireRepo(wtPath)
  const terminal = (cmd.flags.terminal as string) || getStore().settings.preferredTerminal
  try {
    await execAsync(terminalCommand(wtPath, terminal))
    logText(`Opened ${terminal} at ${wtPath}`)
  } catch (err: unknown) {
    logError(`failed to open terminal: ${(err as { message?: string }).message || String(err)}`)
    exit(EXIT.GENERAL)
  }
}

export async function handleIde(cmd: ParsedCommand) {
  const wtPath = cmd.args[0] || globalFlags.repo
  requireRepo(wtPath)
  const ide = (cmd.flags.ide as string) || getStore().settings.preferredIDE
  try {
    await execAsync(ideCommand(wtPath, ide))
    logText(`Opened ${ide} at ${wtPath}`)
  } catch (err: unknown) {
    logError(`failed to open IDE: ${(err as { message?: string }).message || String(err)}`)
    exit(EXIT.GENERAL)
  }
}
