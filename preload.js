const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openDirectoryDialog: () => ipcRenderer.invoke('open-directory-dialog'),
  getAllTracks: () => ipcRenderer.invoke('get-all-tracks')
});

contextBridge.exposeInMainWorld('audio', {
    play: (track) => ipcRenderer.send('play-track', track),
    stop: () => ipcRenderer.send('stop-playback'),
    pause: () => ipcRenderer.send('pause-playback'), // 新增：暂停
    resume: () => ipcRenderer.send('resume-playback'), // 新增：恢复
    addToQueue: (track) => ipcRenderer.send('add-to-queue', track),
    getQueue: () => ipcRenderer.invoke('get-queue'),
    onPlaybackStarted: (callback) => ipcRenderer.on('playback-started', (event, ...args) => callback(...args)),
    onPlaybackEnded: (callback) => ipcRenderer.on('playback-ended', (event, ...args) => callback(...args)),
    onPlaybackError: (callback) => ipcRenderer.on('playback-error', (event, ...args) => callback(...args)),
    onPlaybackProgress: (callback) => ipcRenderer.on('playback-progress', (event, ...args) => callback(...args)),
    onQueueUpdated: (callback) => ipcRenderer.on('queue-updated', (event, ...args) => callback(...args)),
    onPlaybackPaused: (callback) => ipcRenderer.on('playback-paused', (event, ...args) => callback(...args)), // 新增：播放暂停事件
    onPlaybackResumed: (callback) => ipcRenderer.on('playback-resumed', (event, ...args) => callback(...args)) // 新增：播放恢复事件
});
