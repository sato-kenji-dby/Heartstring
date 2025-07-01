const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openDirectoryDialog: () => ipcRenderer.invoke('open-directory-dialog'),
  getAllTracks: () => ipcRenderer.invoke('get-all-tracks')
});

contextBridge.exposeInMainWorld('audio', {
    play: (track) => ipcRenderer.send('play-track', track), // 更改事件名称和参数
    stop: () => ipcRenderer.send('stop-playback'),
    // 监听主进程发来的事件
    onPlaybackStarted: (callback) => ipcRenderer.on('playback-started', (event, ...args) => callback(...args)), // 新增事件
    onPlaybackEnded: (callback) => ipcRenderer.on('playback-ended', (event, ...args) => callback(...args)),
    onPlaybackError: (callback) => ipcRenderer.on('playback-error', (event, ...args) => callback(...args)),
    onPlaybackProgress: (callback) => ipcRenderer.on('playback-progress', (event, ...args) => callback(...args)) // 新增事件
});
