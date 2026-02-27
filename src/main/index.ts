import { app, BrowserWindow, shell, ipcMain } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import log from 'electron-log'
import { setupIpcHandlers } from './ipc.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

log.initialize()
log.transports.file.level = 'info'
log.transports.console.level = 'debug'
log.info('Glit starting...')

let mainWindow: BrowserWindow | null = null

process.on('uncaughtException', (error: Error) => {
  log.error('Uncaught exception:', error)
})

process.on('unhandledRejection', (reason: unknown) => {
  log.error('Unhandled rejection:', reason)
})

const isDev = !app.isPackaged && process.env['NODE_ENV'] !== 'production'

async function checkForUpdates(): Promise<void> {
  if (isDev) return
  try {
    const { autoUpdater } = await import('electron-updater')
    autoUpdater.logger = log
    autoUpdater.checkForUpdatesAndNotify()
  } catch (error) {
    log.warn('Auto-updater not available:', error)
  }
}

function createWindow(): void {
  log.info('Creating main window...')

  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minHeight: 500,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'Glit',
    titleBarStyle: 'hiddenInset',
    vibrancy: 'sidebar',
    backgroundColor: '#1a1a2e',
    show: false,
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  log.info('Main window created')
}

ipcMain.handle('shell:openPath', async (_event, filePath: string) => {
  return shell.openPath(filePath)
})

app.whenReady().then(() => {
  log.info('App ready')
  setupIpcHandlers(() => mainWindow)
  createWindow()
  checkForUpdates()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  log.info('All windows closed')
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('quit', () => {
  log.info('App quitting')
})

export { mainWindow }
