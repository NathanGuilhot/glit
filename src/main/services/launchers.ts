import { exec } from 'child_process'
import { promisify } from 'util'
import log from 'electron-log'
import type { TerminalOption, IDEOption } from '../../shared/types.js'

const execAsync = promisify(exec)

export async function openTerminal(worktreePath: string, terminal: TerminalOption): Promise<{ success: boolean; error?: string }> {
  log.info(`Opening terminal at: ${worktreePath}, terminal: ${terminal}`)
  try {
    const escapedPath = worktreePath.replace(/'/g, "'\\''")
    let cmd = ''

    if (terminal === 'iTerm2' || (terminal as string) === 'iTerm') {
      cmd = `osascript -e 'tell application "iTerm"
  activate
  if (count of windows) = 0 then
    create window with default profile
    tell current session of current window
      write text "cd ${escapedPath}"
    end tell
  else
    tell current window
      create tab with default profile
      tell current session
        write text "cd ${escapedPath}"
      end tell
    end tell
  end if
end tell'`
    } else if (terminal === 'Hyper') {
      cmd = `open -a Hyper ${JSON.stringify(worktreePath)}`
    } else if (terminal === 'Kitty') {
      cmd = `kitty --directory ${JSON.stringify(worktreePath)}`
    } else if (terminal === 'Alacritty') {
      cmd = `alacritty --working-directory ${JSON.stringify(worktreePath)}`
    } else if (terminal === 'Warp') {
      const encodedPath = encodeURIComponent(worktreePath)
      cmd = `open "warp://action/new_tab?path=${encodedPath}"`
    } else {
      // Terminal.app and default
      cmd = `osascript -e 'tell application "Terminal"
  activate
  if (count of windows) = 0 then
    do script "cd ${escapedPath}"
  else
    do script "cd ${escapedPath}" in front window
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
