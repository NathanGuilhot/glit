import { EXIT } from '../constants.js'
import { globalFlags } from '../flags.js'
import { exit, logError, logJson, logText } from '../logger.js'
import { getStore, saveStore } from '../store.js'
import type { AppSettings, ParsedCommand } from '../types.js'

export async function handleGet(cmd: ParsedCommand) {
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

export async function handleSet(cmd: ParsedCommand) {
  const key = cmd.args[0] as keyof AppSettings
  const value = cmd.args[1]
  if (!key || value === undefined) { logError('usage: glit settings set <key> <value>'); exit(EXIT.INVALID_USAGE) }

  const store = getStore()
  if (key === 'autoRefresh') store.settings[key] = value === 'true'
  else (store.settings as unknown as Record<string, unknown>)[key] = value
  saveStore(store)
  logText('Settings saved.')
}
