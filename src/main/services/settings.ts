import Store from 'electron-store'
import type { AppSettings, RepoInfo, RecentRepo } from '../../shared/types.js'

export function shortenPathForDisplay(fullPath: string): string {
  const home = process.env.HOME
  if (home && fullPath.startsWith(home)) {
    return '~' + fullPath.slice(home.length)
  }
  return fullPath
}

export const defaultSettings: AppSettings = {
  preferredTerminal: 'Terminal',
  preferredIDE: 'VSCode',
  autoRefresh: true,
}

export const store = new Store<{ settings: AppSettings; recentRepos: RecentRepo[]; devCommands: Record<string, string> }>({
  defaults: { settings: defaultSettings, recentRepos: [], devCommands: {} },
})

export function addToRecentRepos(info: RepoInfo): void {
  if (!info.isRepo || !info.path || !info.name) return
  const existing = store.get('recentRepos', [])
  const filtered = existing.filter((r) => r.path !== info.path)
  const entry: RecentRepo = {
    path: info.path,
    name: info.name,
    displayPath: info.displayPath ?? shortenPathForDisplay(info.path),
    lastUsedAt: new Date().toISOString(),
  }
  store.set('recentRepos', [entry, ...filtered].slice(0, 10))
}

export function getSavedDevCommand(worktreePath: string): string | null {
  return store.get('devCommands', {})[worktreePath] ?? null
}

export function saveDevCommand(worktreePath: string, command: string): void {
  const devCommands = store.get('devCommands', {})
  devCommands[worktreePath] = command
  store.set('devCommands', devCommands)
}

export function getAllDevCommands(): Record<string, string> {
  return store.get('devCommands', {})
}

export function getSettings(): AppSettings {
  return { ...defaultSettings, ...store.get('settings', defaultSettings) }
}

export function setSettings(newSettings: Partial<AppSettings>): void {
  const current = getSettings()
  store.set('settings', { ...current, ...newSettings })
}

export function getRecentRepos(): RecentRepo[] {
  return store.get('recentRepos', [])
}
