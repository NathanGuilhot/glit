import log from 'electron-log'

export function errorResult(msg: string, error: unknown): { success: false; error: string } {
  log.error(`${msg}:`, error)
  return { success: false, error: error instanceof Error ? error.message : String(error) }
}
