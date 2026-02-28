import { app, BrowserWindow, Menu } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import log from 'electron-log'
import { setupIpcHandlers } from './ipc.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

app.setName('Glit')

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
    minWidth: 280,
    minHeight: 500,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'Glit ·.°',
    titleBarStyle: 'hiddenInset',
    vibrancy: 'sidebar',
    backgroundColor: '#1a1a2e',
    icon: path.join(__dirname, '../../build/icon.png'),
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

const isMac = process.platform === 'darwin'

app.whenReady().then(() => {
  log.info('App ready')
  const menuTemplate: Parameters<typeof Menu.buildFromTemplate>[0] = [
    ...(isMac
      ? [
          {
            label: 'Glit',
            submenu: [
              {
                label: 'About Glit',
                click: () => {
                  app.setAboutPanelOptions({
                    applicationName: 'Glit',
                    applicationVersion: app.getVersion(),
                  })
                  app.showAboutPanel()
                },
              },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const },
            ],
          },
        ]
      : []),
    {
      label: 'File',
      submenu: [isMac ? { role: 'close' as const } : { role: 'quit' as const }],
    },
    { role: 'editMenu' as const },
    { role: 'viewMenu' as const },
    { role: 'windowMenu' as const },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate))
  setupIpcHandlers(() => mainWindow)
  createWindow()
  checkForUpdates()

  if (process.platform === 'darwin') {
    try {
      app.dock?.setIcon(path.join(__dirname, '../../build/icon.png'))
    } catch (error) {
      log.warn('Could not set dock icon:', error)
    }
  }

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
