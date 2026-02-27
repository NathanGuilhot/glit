import { contextBridge, ipcRenderer } from 'electron'
import type { GlitAPI, DeleteWorktreeOptions, CreateWorktreeOptions, SetupConfig } from '../shared/types'

const api: GlitAPI = {
  worktree: {
    list: (repoPath: string) => ipcRenderer.invoke('worktree:list', repoPath),
    delete: (options: DeleteWorktreeOptions) => ipcRenderer.invoke('worktree:delete', options),
    create: (options: CreateWorktreeOptions) => ipcRenderer.invoke('worktree:create', options),
  },
  branch: {
    list: (repoPath: string) => ipcRenderer.invoke('branch:list', repoPath),
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (settings) => ipcRenderer.invoke('settings:set', settings),
  },
  setup: {
    preview: (repoPath: string) => ipcRenderer.invoke('setup:preview', repoPath),
    save: (repoPath: string, config: SetupConfig) => ipcRenderer.invoke('setup:save', repoPath, config),
  },
  clipboard: {
    copy: (text: string) => ipcRenderer.invoke('clipboard:copy', text),
  },
  dialog: {
    pickFile: (repoPath: string) => ipcRenderer.invoke('dialog:pickFile', repoPath),
  },
  terminal: {
    open: (path: string, terminal?: string) => ipcRenderer.invoke('terminal:open', path, terminal),
  },
  repo: {
    detect: () => ipcRenderer.invoke('repo:detect'),
    defaultBranch: (repoPath: string) => ipcRenderer.invoke('repo:defaultBranch', repoPath),
  },
  shell: {
    openPath: (path: string) => ipcRenderer.invoke('shell:openPath', path),
  },
  on: (channel: string, callback: (...args: unknown[]) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => callback(...args)
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  },
}

contextBridge.exposeInMainWorld('glit', api)
