import { contextBridge, ipcRenderer } from 'electron'
import type { GlitAPI, DeleteWorktreeOptions, CreateWorktreeOptions, SetupConfig } from '../shared/types'

const api: GlitAPI = {
  worktree: {
    list: (repoPath: string) => ipcRenderer.invoke('worktree:list', repoPath),
    delete: (options: DeleteWorktreeOptions) => ipcRenderer.invoke('worktree:delete', options),
    create: (options: CreateWorktreeOptions) => ipcRenderer.invoke('worktree:create', options),
    cancelCreate: () => ipcRenderer.invoke('worktree:cancelCreate'),
  },
  branch: {
    list: (repoPath: string) => ipcRenderer.invoke('branch:list', repoPath),
    checkout: (repoPath: string, branchName: string) => ipcRenderer.invoke('branch:checkout', repoPath, branchName),
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
    pickFolder: () => ipcRenderer.invoke('dialog:pickFolder'),
  },
  terminal: {
    open: (path: string, terminal?: string) => ipcRenderer.invoke('terminal:open', path, terminal),
  },
  ide: {
    open: (path: string, ide?: string) => ipcRenderer.invoke('ide:open', path, ide),
  },
  repo: {
    detect: () => ipcRenderer.invoke('repo:detect'),
    defaultBranch: (repoPath: string) => ipcRenderer.invoke('repo:defaultBranch', repoPath),
    switch: (repoPath: string) => ipcRenderer.invoke('repo:switch', repoPath),
    listRecent: () => ipcRenderer.invoke('repo:listRecent'),
  },
  pr: {
    getStatus: (worktreePath: string) => ipcRenderer.invoke('pr:getStatus', worktreePath),
  },
  shell: {
    openPath: (path: string) => ipcRenderer.invoke('shell:openPath', path),
    openUrl: (url: string) => ipcRenderer.invoke('shell:openUrl', url),
  },
  on: (channel: string, callback: (...args: unknown[]) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => callback(...args)
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  },
}

contextBridge.exposeInMainWorld('glit', api)
