import { exec } from 'child_process'
import { promisify } from 'util'
import log from 'electron-log'
import path from 'path'
import fs from 'fs/promises'
import yaml from 'js-yaml'
import type { SetupConfig } from '../../shared/types.js'

const execAsync = promisify(exec)

export async function runSetupSteps(repoPath: string, worktreePath: string): Promise<void> {
  const configPath = path.join(repoPath, '.glit', 'setup.yaml')
  const configContent = await fs.readFile(configPath, 'utf-8') // throws if missing
  const config = yaml.load(configContent) as SetupConfig

  if (config.packages?.length) {
    for (const pkgCmd of config.packages) {
      try { await execAsync(pkgCmd, { cwd: worktreePath }) }
      catch (e) { log.warn(`Package command failed: ${pkgCmd}`, e) }
    }
  }
  if (config.envFiles?.length) {
    for (const envFile of config.envFiles) {
      try {
        const srcPath = path.join(repoPath, envFile)
        const destPath = path.join(worktreePath, envFile)
        await fs.mkdir(path.dirname(destPath), { recursive: true })
        await fs.copyFile(srcPath, destPath)
      } catch (e) { log.warn(`Env file copy failed: ${envFile}`, e) }
    }
  }
  if (config.commands?.length) {
    for (const cmd of config.commands) {
      try { await execAsync(cmd, { cwd: worktreePath }) }
      catch (e) { log.warn(`Setup command failed: ${cmd}`, e) }
    }
  }
}

export async function previewSetupConfig(repoPath: string): Promise<SetupConfig | null> {
  log.info(`Previewing setup config for: ${repoPath}`)
  try {
    const configPath = path.join(repoPath, '.glit', 'setup.yaml')
    const content = await fs.readFile(configPath, 'utf-8')
    return yaml.load(content) as SetupConfig
  } catch {
    return null
  }
}

export async function saveSetupConfig(repoPath: string, config: SetupConfig): Promise<void> {
  const glitDir = path.join(repoPath, '.glit')
  const configPath = path.join(glitDir, 'setup.yaml')
  await fs.mkdir(glitDir, { recursive: true })
  await fs.writeFile(configPath, yaml.dump(config), 'utf-8')
}
