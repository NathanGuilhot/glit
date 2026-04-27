import { exec } from 'child_process'
import { promisify } from 'util'
import log from 'electron-log'
import type { TerminalOption, IDEOption } from '../../shared/types.js'

const execAsync = promisify(exec)

export interface OpenTerminalOptions {
  /**
   * Optional shell command to run after `cd`-ing into the worktree.
   * Hyper and Warp do not support post-launch command injection;
   * passing this option with those terminals returns a typed error.
   */
  runCommand?: string
}

export const TERMINALS_WITHOUT_COMMAND_INJECTION: TerminalOption[] = ['Hyper', 'Warp']

export async function openTerminal(
  worktreePath: string,
  terminal: TerminalOption,
  options: OpenTerminalOptions = {},
): Promise<{ success: boolean; error?: string }> {
  const { runCommand } = options
  log.info(`Opening terminal at: ${worktreePath}, terminal: ${terminal}${runCommand ? ' (with command)' : ''}`)

  if (runCommand && TERMINALS_WITHOUT_COMMAND_INJECTION.includes(terminal)) {
    const msg = `${terminal} does not support running a command on launch`
    log.warn(msg)
    return { success: false, error: msg }
  }

  try {
    const escapedPath = worktreePath.replace(/'/g, "'\\''")
    // Builds the literal that will appear *inside* the AppleScript double-quoted
    // string. The string travels through three layers we need to escape for:
    //   1. AppleScript double-quoted literal — escape `\` → `\\`, `"` → `\"`
    //   2. Outer shell single-quoted `osascript -e '...'` — escape `'` → `'\''`
    // (The path is already pre-escaped for layer 2 above as `escapedPath` to
    // preserve the existing behavior for paths with single quotes.)
    const buildAppleScriptInner = (cmd?: string): string => {
      if (!cmd) return `cd ${escapedPath}`
      const a = cmd.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
      const shellSafe = a.replace(/'/g, "'\\''")
      return `cd ${escapedPath} && ${shellSafe}`
    }
    let cmd = ''

    if (terminal === 'iTerm2' || (terminal as string) === 'iTerm') {
      const inner = buildAppleScriptInner(runCommand)
      cmd = `osascript -e 'tell application "iTerm"
  activate
  if (count of windows) = 0 then
    create window with default profile
    tell current session of current window
      write text "${inner}"
    end tell
  else
    tell current window
      create tab with default profile
      tell current session
        write text "${inner}"
      end tell
    end tell
  end if
end tell'`
    } else if (terminal === 'Hyper') {
      cmd = `open -a Hyper ${JSON.stringify(worktreePath)}`
    } else if (terminal === 'Kitty') {
      if (runCommand) {
        // --hold keeps the window open after the command exits so the user
        // can read the agent output / drop into a shell follow-up.
        cmd = `kitty --directory ${JSON.stringify(worktreePath)} --hold sh -c ${JSON.stringify(runCommand)}`
      } else {
        cmd = `kitty --directory ${JSON.stringify(worktreePath)}`
      }
    } else if (terminal === 'Alacritty') {
      if (runCommand) {
        // -e replaces the shell with the given program; we wrap in `sh -c`
        // so the user can pass arbitrary command lines, and follow with
        // `exec $SHELL` so the user lands in an interactive shell after.
        cmd = `alacritty --working-directory ${JSON.stringify(worktreePath)} -e sh -c ${JSON.stringify(`${runCommand}; exec $SHELL`)}`
      } else {
        cmd = `alacritty --working-directory ${JSON.stringify(worktreePath)}`
      }
    } else if (terminal === 'Warp') {
      const encodedPath = encodeURIComponent(worktreePath)
      cmd = `open "warp://action/new_tab?path=${encodedPath}"`
    } else {
      // Terminal.app and default
      const inner = buildAppleScriptInner(runCommand)
      cmd = `osascript -e 'tell application "Terminal"
  activate
  if (count of windows) = 0 then
    do script "${inner}"
  else
    do script "${inner}" in front window
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
}

export async function openIDE(worktreePath: string, ide: IDEOption): Promise<{ success: boolean; error?: string }> {
  log.info(`Opening IDE at: ${worktreePath}, ide: ${ide}`)
  try {
    let cmd = ''
    if (ide === 'Cursor')              cmd = `cursor ${JSON.stringify(worktreePath)}`
    else if (ide === 'Zed')            cmd = `zed ${JSON.stringify(worktreePath)}`
    else if (ide === 'WebStorm')       cmd = `open -a WebStorm ${JSON.stringify(worktreePath)}`
    else if (ide === 'Sublime')        cmd = `subl ${JSON.stringify(worktreePath)}`
    else if (ide === 'VSCodeInsiders') cmd = `open -a "Visual Studio Code - Insiders" ${JSON.stringify(worktreePath)}`
    else if (ide === 'Antigravity')    cmd = `open -a Antigravity ${JSON.stringify(worktreePath)}`
    else                               cmd = `code ${JSON.stringify(worktreePath)}`
    await execAsync(cmd)
    return { success: true }
  } catch (error) {
    log.error('Error opening IDE:', error)
    const msg = error instanceof Error ? error.message : String(error)
    return { success: false, error: msg }
  }
}
