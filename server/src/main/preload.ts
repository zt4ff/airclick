// Disable no-unused-vars, broken for spread args
/* eslint no-unused-vars: off */
import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

export type Channels =
  | 'ipc-example'
  | 'start-server'
  | 'stop-server'
  | 'server-status'
  | 'client-connected'
  | 'client-disconnected';

const electronHandler = {
  ipcRenderer: {
    sendMessage(channel: Channels, ...args: unknown[]) {
      ipcRenderer.send(channel, ...args);
    },
    on(channel: Channels, func: (...args: unknown[]) => void) {
      const subscription = (_event: IpcRendererEvent, ...args: unknown[]) =>
        func(...args);
      ipcRenderer.on(channel, subscription);

      return () => {
        ipcRenderer.removeListener(channel, subscription);
      };
    },
    once(channel: Channels, func: (...args: unknown[]) => void) {
      ipcRenderer.once(channel, (_event, ...args) => func(...args));
    },
  },
  server: {
    start() {
      ipcRenderer.send('start-server');
    },
    stop() {
      ipcRenderer.send('stop-server');
    },
    onStatusChange(
      callback: (status: {
        running: boolean;
        url: string;
        connectedClients: number;
      }) => void,
    ) {
      const subscription = (_event: IpcRendererEvent, status: any) =>
        callback(status);
      ipcRenderer.on('server-status', subscription);
      return () => {
        ipcRenderer.removeListener('server-status', subscription);
      };
    },
    onClientConnected(callback: (count: number) => void) {
      const subscription = (_event: IpcRendererEvent, count: number) =>
        callback(count);
      ipcRenderer.on('client-connected', subscription);
      return () => {
        ipcRenderer.removeListener('client-connected', subscription);
      };
    },
    onClientDisconnected(callback: (count: number) => void) {
      const subscription = (_event: IpcRendererEvent, count: number) =>
        callback(count);
      ipcRenderer.on('client-disconnected', subscription);
      return () => {
        ipcRenderer.removeListener('client-disconnected', subscription);
      };
    },
  },
};

contextBridge.exposeInMainWorld('electron', electronHandler);

export type ElectronHandler = typeof electronHandler;
