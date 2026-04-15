import { EXIT } from '../constants.js'
import { globalFlags } from '../flags.js'
import { exit, logError, logJson, logText } from '../logger.js'
import { defaultSettings, getStore, saveStore } from '../store.js'
import type { AppSettings, ParsedCommand } from '../types.js'

export async function handleGet(cmd: ParsedCommand) {
  const store = getStore()
  const rawKey = cmd.args[0]

  if (rawKey) {
    if (!(rawKey in defaultSettings)) { logError(`unknown setting: ${rawKey}`); exit(EXIT.INVALID_USAGE) }
    const key = rawKey as keyof AppSettings
    const value = store.settings[key]
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
  const rawKey = cmd.args[0]
  const value = cmd.args[1]
  if (!rawKey || value === undefined) { logError('usage: glit settings set <key> <value>'); exit(EXIT.INVALID_USAGE) }
  if (!(rawKey in defaultSettings)) { logError(`unknown setting: ${rawKey}`); exit(EXIT.INVALID_USAGE) }
  const key = rawKey as keyof AppSettings

  const store = getStore()
  if (key === 'autoRefresh') store.settings[key] = value === 'true'
  else (store.settings as unknown as Record<string, unknown>)[key] = value
  saveStore(store)
  logText('Settings saved.')
}
