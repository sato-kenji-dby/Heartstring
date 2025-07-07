import type { Track } from '$types';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';

// 实现一个简单的事件发射器接口
interface PlayerServiceEvents {
  'playback-progress': (data: { currentTime: number; duration: number }) => void;
  'playback-ended': () => void;
  'playback-error': (error: Error) => void;
  'playback-started': (track: Track) => void;
  'playback-paused': (data: { currentTime: number }) => void;
  'playback-resumed': (data: { currentTime: number }) => void;
}

class PlayerService {
  private ffplayProcess: ChildProcessWithoutNullStreams | null = null;
  private currentTrack: Track | null = null;
  private pausedTime: number = 0;
  private isPaused: boolean = false;

  // 内部事件监听器存储
  private listeners: { [K in keyof PlayerServiceEvents]?: PlayerServiceEvents[K][] } = {};

  constructor() {
    // 构造函数不再接收 ipcRenderer 或 mainWindow
  }

  // 实现 on 方法
  on<K extends keyof PlayerServiceEvents>(eventName: K, listener: PlayerServiceEvents[K]): void {
    if (!this.listeners[eventName]) {
      this.listeners[eventName] = [];
    }
    this.listeners[eventName]?.push(listener);
  }

  // 实现 emit 方法 (保持 private)
  private emit<K extends keyof PlayerServiceEvents>(eventName: K, ...args: Parameters<PlayerServiceEvents[K]>): void {
    this.listeners[eventName]?.forEach(listener => {
      // @ts-ignore
      listener(...args);
    });
  }

  // 专用于测试的公共函数，仅在测试环境下可用
  public _testEmit<K extends keyof PlayerServiceEvents>(eventName: K, ...args: Parameters<PlayerServiceEvents[K]>): void {
    if (process.env.NODE_ENV === 'test') {
      this.emit(eventName, ...args);
    } else {
      console.warn('Attempted to call _testEmit outside of test environment.');
    }
  }

  play(track: Track, startTime: number = 0) {
    if (this.ffplayProcess) {
      this.stop(); // 停止当前播放
    }

    this.currentTrack = track;
    this.isPaused = false;
    this.pausedTime = startTime; // 设置起始播放时间

    const args = [
      '-i', track.path,
      '-nodisp', // 不显示视频窗口
      '-autoexit', // 播放结束后自动退出
      '-loglevel', 'error', // 只显示错误信息
      '-af', 'volume=1.0', // 默认音量
    ];

    if (startTime > 0) {
      args.unshift('-ss', startTime.toString()); // 从指定时间开始播放
    }

    this.ffplayProcess = spawn('ffplay', args);

    this.ffplayProcess.stderr.on('data', (data) => {
      const line = data.toString();
      const match = line.match(/^\s*(\d+\.\d+)/); // 匹配时间码，例如 "4.5 M-A: ..."
      if (match && match[1]) {
        const currentTime = parseFloat(match[1]);
        this.pausedTime = currentTime; // 更新暂停时间
        this.emit('playback-progress', { currentTime, duration: this.currentTrack?.duration || 0 });
      }
    });

    this.ffplayProcess.on('close', (code) => {
      const wasPaused = this.isPaused;
      this.ffplayProcess = null;
      this.currentTrack = null;
      this.pausedTime = 0;
      this.isPaused = false;

      if (code === 0) {
        this.emit('playback-ended');
      } else if (code !== null && !wasPaused) {
        this.emit('playback-error', new Error(`ffplay exited with code ${code}`));
      } else {
        console.log('FFplay process killed or paused.');
      }
    });

    this.ffplayProcess.on('error', (err) => {
      console.error('Failed to start ffplay process:', err);
      this.ffplayProcess = null;
      this.currentTrack = null;
      this.pausedTime = 0;
      this.isPaused = false;
      this.emit('playback-error', new Error(`Failed to start ffplay: ${err.message}`));
    });

    this.emit('playback-started', track);
  }

  stop() {
    if (this.ffplayProcess) {
      this.ffplayProcess.kill('SIGKILL'); // 强制终止进程
      this.ffplayProcess = null;
    }
    this.currentTrack = null;
    this.pausedTime = 0;
    this.isPaused = false;
  }

  pause() {
    if (this.ffplayProcess && !this.isPaused) {
      this.ffplayProcess.stdin.write('p'); // 发送 'p' 暂停
      this.isPaused = true;
      this.emit('playback-paused', { currentTime: this.pausedTime });
    }
  }

  resume() {
    if (this.ffplayProcess && this.isPaused) {
      this.ffplayProcess.stdin.write('p'); // 再次发送 'p' 恢复
      this.isPaused = false;
      this.emit('playback-resumed', { currentTime: this.pausedTime });
    } else if (this.currentTrack && this.pausedTime > 0) {
      // 如果进程已经关闭，从暂停时间重新开始播放
      this.play(this.currentTrack, this.pausedTime);
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

export { PlayerService };
