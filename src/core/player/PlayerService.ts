// src/lib/playerService.js
import type { Track } from '../../types'; // 导入 Track 接口

interface IpcRenderer {
  send: (channel: string, ...args: any[]) => void;
  on: (channel: string, listener: (event: Electron.IpcRendererEvent, ...args: any[]) => void) => Electron.IpcRenderer;
  off: (channel: string, listener: (...args: any[]) => void) => Electron.IpcRenderer;
}

// 实现一个简单的事件发射器接口
interface PlayerServiceEvents {
  'playback-progress': (data: { currentTime: number; duration: number }) => void;
  'playback-ended': () => void;
  'playback-error': (error: Error) => void;
  'playback-started': (track: Track) => void;
  'playback-paused': (data: { currentTime: number }) => void;
  'playback-resumed': (data: { currentTime: number }) => void;
}

class PlayerService { // 不再继承 EventEmitter
  private ipcRenderer: IpcRenderer;
  private currentTrack: Track | null = null;
  private pausedTime: number = 0; // 记录暂停时的播放时间
  private isPaused: boolean = false; // 标记是否处于暂停状态

  // 内部事件监听器存储
  private listeners: { [K in keyof PlayerServiceEvents]?: PlayerServiceEvents[K][] } = {};

  constructor(ipcRenderer: IpcRenderer) {
    // super(); // 移除 super() 调用
    this.ipcRenderer = ipcRenderer;
    this.setupIpcListeners();
  }

  // 实现 on 方法
  on<K extends keyof PlayerServiceEvents>(eventName: K, listener: PlayerServiceEvents[K]): void {
    if (!this.listeners[eventName]) {
      this.listeners[eventName] = [];
    }
    this.listeners[eventName]?.push(listener);
  }

  // 实现 emit 方法
  private emit<K extends keyof PlayerServiceEvents>(eventName: K, ...args: Parameters<PlayerServiceEvents[K]>): void {
    this.listeners[eventName]?.forEach(listener => {
      // @ts-ignore
      listener(...args);
    });
  }

  private setupIpcListeners() {
    // 监听主进程转发的 ffplay stderr 数据
    this.ipcRenderer.on('ffplay-stderr', (event, data: string) => {
      const line = data.toString();
      const match = line.match(/^\s*(\d+\.\d+)/); // 匹配时间码，例如 "4.5 M-A: ..."
      if (match && match[1]) {
        const currentTime = parseFloat(match[1]);
        this.pausedTime = currentTime; // 更新暂停时间
        this.emit('playback-progress', { currentTime, duration: this.currentTrack?.duration || 0 });
      }
    });

    // 监听主进程通知的 ffplay 进程关闭事件
    this.ipcRenderer.on('playback-closed', (event, { code }: { code: number }) => {
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
    this.ipcRenderer.on('playback-error', (event, errorMessage: string) => {
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
    this.ipcRenderer.send('play-track', { filePath: track.path, startTime });
    this.emit('playback-started', track);
  }

  stop() {
    this.ipcRenderer.send('stop-playback');
    this.currentTrack = null;
    this.pausedTime = 0;
    this.isPaused = false;
  }

  pause() {
    if (this.currentTrack) {
      this.isPaused = true; // 标记为暂停状态
      this.ipcRenderer.send('pause-playback');
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
