export interface GlobalFlags {
  repo: string
  output: 'text' | 'json'
  color: 'always' | 'never' | 'auto'
  quiet: boolean
  verbose: number
  json: boolean
  help: boolean
  version: boolean
}

export interface ParsedCommand {
  command: string
  subcommand?: string
  args: string[]
  flags: Record<string, string | boolean | string[] | number>
}

export type CommandHandler = (cmd: ParsedCommand) => Promise<void>

export interface AppSettings {
  preferredTerminal: string
  preferredIDE: string
  autoRefresh: boolean
}

export interface StoreData {
  settings: AppSettings
  recentRepos: { path: string; name: string; displayPath: string; lastUsedAt: string }[]
  devCommands: Record<string, string>
}
