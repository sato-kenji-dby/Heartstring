import { contextBridge, ipcRenderer } from 'electron';
import type { Track } from './src/types'; // 导入 Track 类型

console.log('[Preload] Preload script started.');

contextBridge.exposeInMainWorld('electronAPI', { // 将 'electron' 改为 'electronAPI'
  openDirectoryDialog: () => ipcRenderer.invoke('open-directory-dialog'),
  getAllTracks: () => ipcRenderer.invoke('get-all-tracks'),
});

contextBridge.exposeInMainWorld('ipcRenderer', { // 直接暴露 ipcRenderer
  send: (channel: string, ...args: any[]) => ipcRenderer.send(channel, ...args),
  on: (channel: string, listener: (...args: any[]) => void) => ipcRenderer.on(channel, listener),
  off: (channel: string, listener: (...args: any[]) => void) => ipcRenderer.off(channel, listener),
  invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args),
});

console.log('[Preload] "electronAPI" and "ipcRenderer" exposed.');

// 暴露 window.audio API
contextBridge.exposeInMainWorld('audio', {
  play: (track: Track) => ipcRenderer.send('play-track', track),
  stop: () => ipcRenderer.send('stop-playback'),
  pause: () => ipcRenderer.send('pause-playback'),
  resume: () => ipcRenderer.send('resume-playback'),
  addToQueue: (track: Track) => ipcRenderer.send('add-to-queue', track),
  
  // 监听主进程发来的播放事件
  onPlaybackStarted: (callback: (track: Track) => void) => {
    ipcRenderer.on('playback-started', (_, track) => callback(track));
  },
  onPlaybackProgress: (callback: (data: { currentTime: number, duration: number }) => void) => {
    ipcRenderer.on('playback-progress', (_, data) => callback(data));
  },
  onPlaybackPaused: (callback: (data: { currentTime: number }) => void) => {
    ipcRenderer.on('playback-paused', (_, data) => callback(data));
  },
  onPlaybackResumed: (callback: (data: { currentTime: number }) => void) => {
    ipcRenderer.on('playback-resumed', (_, data) => callback(data));
  },
  onPlaybackEnded: (callback: () => void) => {
    ipcRenderer.on('playback-ended', callback);
  },
  onPlaybackError: (callback: (errorMessage: string) => void) => {
    ipcRenderer.on('playback-error', (_, errorMessage) => callback(errorMessage));
  },
});
