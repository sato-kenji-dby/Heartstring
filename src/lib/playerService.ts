// src/lib/playerService.js
import { EventEmitter } from 'events';
import type { Track } from './stores/playerStore'; // 导入 Track 接口

// 声明 Electron 暴露的 API
declare global {
  interface Window {
    electron: {
      ipcRenderer: {
        send: (channel: string, ...args: any[]) => void;
        on: (channel: string, listener: (event: Electron.IpcRendererEvent, ...args: any[]) => void) => Electron.IpcRenderer;
        off: (channel: string, listener: (...args: any[]) => void) => Electron.IpcRenderer;
      };
    };
  }
}

class PlayerService extends EventEmitter {
  private currentTrack: Track | null = null;
  private pausedTime: number = 0; // 记录暂停时的播放时间
  private isPaused: boolean = false; // 标记是否处于暂停状态

  constructor() {
    super();
    this.setupIpcListeners();
  }

  private setupIpcListeners() {
    // 监听主进程转发的 ffplay stderr 数据
    window.electron.ipcRenderer.on('ffplay-stderr', (event, data: string) => {
      const line = data.toString();
      const match = line.match(/^\s*(\d+\.\d+)/); // 匹配时间码，例如 "4.5 M-A: ..."
      if (match && match[1]) {
        const currentTime = parseFloat(match[1]);
        this.pausedTime = currentTime; // 更新暂停时间
        this.emit('playback-progress', { currentTime, duration: this.currentTrack?.duration || 0 });
      }
    });

    // 监听主进程通知的 ffplay 进程关闭事件
    window.electron.ipcRenderer.on('playback-closed', (event, { code }: { code: number }) => {
      if (code === 0) {
        this.emit('playback-ended');
      } else if (code !== null && !this.isPaused) {
        this.emit('playback-error', new Error(`ffplay exited with code ${code}`));
      } else {
        console.log('FFplay process killed by SIGKILL or paused.');
      }
      this.currentTrack = null;
      this.pausedTime = 0;
      this.isPaused = false;
    });

    // 监听主进程通知的 ffplay 进程错误事件
    window.electron.ipcRenderer.on('playback-error', (event, errorMessage: string) => {
      console.error('ffplay process error:', errorMessage);
      this.emit('playback-error', new Error(errorMessage));
      this.currentTrack = null;
      this.pausedTime = 0;
      this.isPaused = false;
    });
  }

  play(track: Track, startTime: number = 0) {
    this.currentTrack = track;
    this.isPaused = false; // 开始播放时重置暂停状态
    window.electron.ipcRenderer.send('play-track', { filePath: track.path, startTime });
    this.emit('playback-started', track);
  }

  stop() {
    window.electron.ipcRenderer.send('stop-playback');
    this.currentTrack = null;
    this.pausedTime = 0;
    this.isPaused = false;
  }

  pause() {
    if (this.currentTrack) {
      this.isPaused = true; // 标记为暂停状态
      window.electron.ipcRenderer.send('pause-playback');
      this.emit('playback-paused', { currentTime: this.pausedTime });
    }
  }

  resume() {
    if (this.currentTrack && this.pausedTime > 0) {
      this.play(this.currentTrack, this.pausedTime); // 从暂停时间开始播放
      this.emit('playback-resumed', { currentTime: this.pausedTime });
    } else {
      console.log('No track to resume or no paused time recorded.');
    }
  }

  getCurrentTrack(): Track | null {
    return this.currentTrack;
  }

  getPausedTime(): number {
    return this.pausedTime;
  }

  getIsPaused(): boolean {
    return this.isPaused;
  }
}

export { PlayerService }; // 导出类
export const playerService = new PlayerService(); // 导出实例
