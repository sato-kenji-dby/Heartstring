import type { Track } from '$types';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';

// 实现一个简单的事件发射器接口
interface PlayerServiceEvents {
  'playback-progress': (data: {
    currentTime: number;
    duration: number;
  }) => void;
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
  private isPlayingOrStarting: boolean = false;

  // 内部事件监听器存储
  private listeners: {
    [K in keyof PlayerServiceEvents]?: PlayerServiceEvents[K][];
  } = {};

  constructor() {
    // 构造函数不再接收 ipcRenderer 或 mainWindow
  }

  // 实现 on 方法
  on<K extends keyof PlayerServiceEvents>(
    eventName: K,
    listener: PlayerServiceEvents[K]
  ): void {
    if (!this.listeners[eventName]) {
      this.listeners[eventName] = [];
    }
    this.listeners[eventName]?.push(listener);
  }

  // 实现 emit 方法 (保持 private)
  private emit<K extends keyof PlayerServiceEvents>(
    eventName: K,
    ...args: Parameters<PlayerServiceEvents[K]>
  ): void {
    this.listeners[eventName]?.forEach((listener) => {
      // @ts-ignore
      listener(...args);
    });
  }

  // 专用于测试的公共函数，仅在测试环境下可用
  public _testEmit<K extends keyof PlayerServiceEvents>(
    eventName: K,
    ...args: Parameters<PlayerServiceEvents[K]>
  ): void {
    if (process.env.NODE_ENV === 'test') {
      this.emit(eventName, ...args);
    } else {
      console.warn('Attempted to call _testEmit outside of test environment.');
    }
  }

  play(track: Track, startTime: number = 0) {
    // 无论如何，在开始新播放前，确保旧进程被终止并清理状态
    if (this.ffplayProcess) {
      this.stop();
    }

    // 确保在开始新播放前，播放器状态是干净的
    this.isPlayingOrStarting = true; // 在这里设置为 true，表示开始播放流程
    this.isPaused = false; // 确保不是暂停状态
    this.pausedTime = startTime; // 设置起始播放时间
    this.currentTrack = track; // 设置当前曲目

    const args = [
      '-i',
      track.path,
      '-ss',
      startTime.toString(), // 确保从正确的时间开始播放
      '-nodisp', // 不显示视频窗口
      '-autoexit', // 播放结束后自动退出
      // '-loglevel', 'error', // 只显示错误信息 - 移除此行
      '-stats', // 显示播放统计信息，包括时间
      '-af',
      'volume=1.0', // 默认音量
    ];

    // 移除重复的 startTime 参数添加，因为已经在 args 数组中添加了
    // if (startTime > 0) {
    //   args.unshift('-ss', startTime.toString()); // 从指定时间开始播放
    // }

    this.ffplayProcess = spawn('ffplay', args);

    this.ffplayProcess.stderr.on('data', (data) => {
      const line = data.toString();
      // 匹配 ffplay -stats 输出的进度信息，例如 "  4.5 M-A: ..."
      // 或者 "frame= 100 fps= 30 q=2.0 size=N/A time=00:00:03.33 bitrate=N/A speed=1.0x    "
      const match = line.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d{2})/);
      if (match) {
        const hours = parseInt(match[1]);
        const minutes = parseInt(match[2]);
        const seconds = parseFloat(match[3]);
        const currentTime = hours * 3600 + minutes * 60 + seconds;
        this.pausedTime = currentTime; // 更新暂停时间
        this.emit('playback-progress', {
          currentTime,
          duration: this.currentTrack?.duration || 0,
        });
      } else {
        // 尝试匹配旧的格式，以防万一
        const oldMatch = line.match(/^\s*(\d+\.\d+)/);
        if (oldMatch && oldMatch[1]) {
          const currentTime = parseFloat(oldMatch[1]);
          this.pausedTime = currentTime; // 更新暂停时间
          this.emit('playback-progress', {
            currentTime,
            duration: this.currentTrack?.duration || 0,
          });
        }
      }
    });

    this.ffplayProcess.on('close', (code) => {
      const wasPaused = this.isPaused; // 记录是否是暂停状态
      this.ffplayProcess = null;
      this.isPlayingOrStarting = false; // 进程关闭，不再是播放或启动状态

      if (code === 0) {
        // 正常播放结束
        this.currentTrack = null; // 播放结束才清空当前曲目
        this.isPaused = false; // 正常结束时才重置 isPaused
        this.pausedTime = 0; // 正常结束时重置暂停时间
        this.emit('playback-ended');
      } else if (code !== null && !wasPaused) {
        // 进程因错误退出，且不是因为暂停
        this.currentTrack = null; // 错误时清空当前曲目
        this.isPaused = false; // 错误时才重置 isPaused
        this.pausedTime = 0; // 错误时重置暂停时间
        this.emit(
          'playback-error',
          new Error(`ffplay exited with code ${code}`)
        );
      } else {
        // 进程被杀死（例如，由于暂停或停止），或者其他非零退出码但处于暂停状态
        // 此时 currentTrack 不应被清空，以便恢复播放
        console.log('FFplay process killed or paused.');
        // 如果是暂停导致的关闭 (wasPaused 为 true)，则不重置 isPaused，保持其为 true
        // 否则，如果是其他非正常退出，则重置状态
        if (!wasPaused) {
          this.currentTrack = null;
          this.isPaused = false;
          this.pausedTime = 0; // 非暂停导致的关闭，重置暂停时间
        }
      }
    });

    this.ffplayProcess.on('error', (err) => {
      console.error('Failed to start ffplay process:', err);
      this.ffplayProcess = null;
      this.currentTrack = null;
      this.pausedTime = 0;
      this.isPaused = false;
      this.isPlayingOrStarting = false; // 在出错时解锁
      this.emit(
        'playback-error',
        new Error(`Failed to start ffplay: ${err.message}`)
      );
    });

    // 确保 duration 在播放开始时被正确设置，以避免 NaN
    if (track.duration) {
      this.emit('playback-progress', {
        currentTime: startTime,
        duration: track.duration,
      });
    }

    this.emit('playback-started', track);
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.ffplayProcess) {
        // 监听 'close' 事件，确保进程真正关闭后再 resolve
        this.ffplayProcess.on('close', () => {
          console.log('FFplay process confirmed closed after stop.');
          this.ffplayProcess = null;
          this.currentTrack = null;
          this.pausedTime = 0;
          this.isPaused = false;
          this.isPlayingOrStarting = false; // 确保 stop 时也解锁
          resolve();
        });
        this.ffplayProcess.kill('SIGKILL'); // 强制终止进程
      } else {
        this.currentTrack = null;
        this.pausedTime = 0;
        this.isPaused = false;
        this.isPlayingOrStarting = false; // 确保 stop 时也解锁
        resolve(); // 没有进程，直接 resolve
      }
    });
  }

  pause() {
    if (this.ffplayProcess) {
      // 无论是否已暂停，只要进程存在就杀死
      this.ffplayProcess.kill('SIGKILL');
      this.ffplayProcess = null; // 确保进程引用被清除
    }
    if (!this.isPaused) {
      // 只有在未暂停状态下才触发事件
      this.isPaused = true;
      this.emit('playback-paused', { currentTime: this.pausedTime });
    }
  }

  resume() {
    if (this.currentTrack && this.isPaused) {
      // 只有在暂停状态且有当前曲目时才恢复
      this.isPaused = false; // 恢复前先设置为 false
      this.play(this.currentTrack, this.pausedTime); // 从暂停时间重新播放
      this.emit('playback-resumed', { currentTime: this.pausedTime });
    } else {
      console.log('No track to resume or not in paused state.');
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
