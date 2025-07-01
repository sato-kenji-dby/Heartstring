const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openDirectoryDialog: () => ipcRenderer.invoke('open-directory-dialog'),
  getAllTracks: () => ipcRenderer.invoke('get-all-tracks')
});
