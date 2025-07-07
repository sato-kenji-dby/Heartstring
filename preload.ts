import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    send: (channel: string, ...args: any[]) => ipcRenderer.send(channel, ...args),
    on: (channel: string, listener: (...args: any[]) => void) => ipcRenderer.on(channel, listener),
    off: (channel: string, listener: (...args: any[]) => void) => ipcRenderer.off(channel, listener),
    invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args),
  },
  openDirectoryDialog: () => ipcRenderer.invoke('open-directory-dialog'),
  getAllTracks: () => ipcRenderer.invoke('get-all-tracks'),
});
