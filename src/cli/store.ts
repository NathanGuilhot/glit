import * as fs from 'fs'
import * as path from 'path'

import type { AppSettings, StoreData } from './types.js'

export const defaultSettings: AppSettings = {
  preferredTerminal: 'Terminal',
  preferredIDE: 'VSCode',
  autoRefresh: true,
}

export const getStorePath = (): string => {
  const home = process.env.HOME || ''
  const configHome = process.env.XDG_CONFIG_HOME || path.join(home, '.config')
  return path.join(configHome, 'glit', 'config.json')
}

export const getStore = (): StoreData => {
  try {
    return JSON.parse(fs.readFileSync(getStorePath(), 'utf-8'))
  } catch {
    return { settings: { ...defaultSettings }, recentRepos: [], devCommands: {} }
  }
}

export const saveStore = (data: StoreData): void => {
  const storePath = getStorePath()
  const dir = path.dirname(storePath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(storePath, JSON.stringify(data, null, 2), 'utf-8')
}
