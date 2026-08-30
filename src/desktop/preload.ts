import { contextBridge, ipcRenderer } from 'electron';
import { GameAction, GameState, TorCircuitInfo } from '../types';

export interface DesktopAPI {
  getState: () => Promise<GameState>;
  dispatch: (action: GameAction) => Promise<GameState>;
  onStateUpdate: (callback: (state: GameState) => void) => () => void;
  getTorStatus: () => Promise<TorCircuitInfo>;
  checkTorProxy: () => Promise<TorCircuitInfo>;
  onTorStatusUpdate: (callback: (info: TorCircuitInfo) => void) => () => void;
}

const api: DesktopAPI = {
  getState: () => ipcRenderer.invoke('game:get-state'),
  dispatch: (action: GameAction) => ipcRenderer.invoke('game:dispatch', action),
  onStateUpdate: (callback: (state: GameState) => void) => {
    const handler = (_: any, state: GameState) => callback(state);
    ipcRenderer.on('game:state-update', handler);
    return () => ipcRenderer.removeListener('game:state-update', handler);
  },
  getTorStatus: () => ipcRenderer.invoke('tor:get-status'),
  checkTorProxy: () => ipcRenderer.invoke('tor:check-proxy'),
  onTorStatusUpdate: (callback: (info: TorCircuitInfo) => void) => {
    const handler = (_: any, info: TorCircuitInfo) => callback(info);
    ipcRenderer.on('tor:status-update', handler);
    return () => ipcRenderer.removeListener('tor:status-update', handler);
  }
};

contextBridge.exposeInMainWorld('api', api);
