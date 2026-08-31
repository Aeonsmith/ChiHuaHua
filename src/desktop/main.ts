import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'node:path';
import { GameEngine } from '../engine/engine';
import { TorManager } from '../network/tor-manager';
import { SaveManager } from '../storage/save-manager';
import { GameAction } from '../types';

let mainWindow: BrowserWindow | null = null;
const engine = new GameEngine();
const torManager = new TorManager();
const saveManager = new SaveManager();

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 1024,
    minHeight: 720,
    backgroundColor: '#0a0d0a',
    title: 'Blockbuster: Underground - Terminal Console',
    icon: path.join(__dirname, '..', '..', 'assets', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
    engine.stop();
  });

  // Start engine loop and push state to renderer on change
  engine.start();
  engine.subscribe((state) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('game:state-update', state);
    }
  });

  // Initial Tor proxy check
  torManager.checkSocksProxy().then((info) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('tor:status-update', info);
    }
  }).catch(() => {});
}

// IPC Handlers
ipcMain.handle('game:get-state', () => {
  return engine.getState();
});

ipcMain.handle('game:dispatch', (_, action: GameAction) => {
  engine.dispatch(action);
  return engine.getState();
});

ipcMain.handle('game:save', () => {
  const state = engine.getState();
  return saveManager.saveGame(state);
});

ipcMain.handle('game:load', () => {
  const loaded = saveManager.loadGame();
  if (loaded) {
    engine.dispatch({ type: 'LOAD_SAVED_STATE', state: loaded });
    return true;
  }
  return false;
});

ipcMain.handle('game:nuke', () => {
  engine.dispatch({ type: 'NUKE_STATE' });
  return engine.getState();
});

ipcMain.handle('tor:get-status', () => {
  return torManager.getStatus();
});

ipcMain.handle('tor:check-proxy', async () => {
  const info = await torManager.checkSocksProxy();
  return info;
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
