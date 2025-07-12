import { PlayerService } from '$core/player/PlayerService';
import type { Track } from '$types';

export class AudioService {
  private queue: Track[] = [];
  private playerService: PlayerService;
  private sendToRenderer: ((channel: string, ...args: any[]) => void) | null = null; // 用于向渲染进程发送消息

  constructor(playerService: PlayerService) {
    this.playerService = playerService;
    this.setupListeners();
  }

  // 设置用于向渲染进程发送消息的函数
  setMainWindowSender(sender: (channel: string, ...args: any[]) => void) {
    this.sendToRenderer = sender;
  }

  private setupListeners() {
    this.playerService.on('playback-started', (track: Track) => {
      if (this.sendToRenderer) {
        this.sendToRenderer('player-store-update', {
          currentTrack: track,
          isPlaying: true,
          status: 'playing',
          progress: 0,
          duration: track.duration || 0,
        });
        this.sendToRenderer('playback-started', track);
      }
    });

    this.playerService.on('playback-progress', ({ currentTime, duration }: { currentTime: number, duration: number }) => {
      // console.log(`[AudioService] Received playback-progress: currentTime=${currentTime}, duration=${duration}`); // 添加日志
      if (this.sendToRenderer) {
        this.sendToRenderer('player-store-update', {
          progress: currentTime,
          duration: duration > 0 ? duration : undefined,
        });
        this.sendToRenderer('playback-progress', { currentTime, duration }); // 也可以保留这个，用于更细粒度的监听
      }
    });

    this.playerService.on('playback-paused', ({ currentTime }: { currentTime: number }) => {
      if (this.sendToRenderer) {
        this.sendToRenderer('player-store-update', {
          isPlaying: false,
          status: 'paused',
          progress: currentTime,
        });
        this.sendToRenderer('playback-paused', { currentTime });
      }
    });

    this.playerService.on('playback-resumed', ({ currentTime }: { currentTime: number }) => {
      if (this.sendToRenderer) {
        this.sendToRenderer('player-store-update', {
          isPlaying: true,
          status: 'playing',
          progress: currentTime,
        });
        this.sendToRenderer('playback-resumed', { currentTime });
      }
    });

    this.playerService.on('playback-ended', () => {
      if (this.sendToRenderer) {
        this.sendToRenderer('player-store-update', {
          isPlaying: false,
          progress: 0,
          currentTrack: null,
        });
        this.sendToRenderer('playback-ended');
      }
      this.playNext();
    });

    this.playerService.on('playback-error', (error: Error) => {
      console.error('AudioService received playback error:', error);
      if (this.sendToRenderer) {
        this.sendToRenderer('player-store-update', {
          isPlaying: false,
          status: 'error',
        });
        this.sendToRenderer('playback-error', error.message);
      }
      this.playNext();
    });
  }

  playTrack(track: Track) {
    this.playerService.play(track);
  }

  stopPlayback() {
    this.playerService.stop();
    this.queue = [];
    if (this.sendToRenderer) {
      this.sendToRenderer('player-store-update', { queue: [] });
    }
  }

  pausePlayback() {
    this.playerService.pause();
  }

  resumePlayback() {
    this.playerService.resume();
  }

  addToQueue(track: Track) {
    this.queue.push(track);
    if (this.sendToRenderer) {
      this.sendToRenderer('player-store-update', { queue: [...this.queue] });
    }
    console.log('Added to queue:', track.title, 'Current queue length:', this.queue.length);
  }

  getQueue(): Track[] {
    return this.queue;
  }

  async playNext() { // 将 playNext 方法改为 async
    if (this.queue.length > 0) {
      const nextTrack = this.queue.shift();
      if (nextTrack) {
        // 在播放下一首之前，确保当前播放已完全停止
        console.log('Stopping current playback before playing next track...');
        await this.playerService.stop(); // 等待 stop 操作完成

        this.playTrack(nextTrack);
        if (this.sendToRenderer) {
          this.sendToRenderer('player-store-update', { queue: this.queue });
        }
      }
    } else {
      console.log('Queue is empty. No next track to play.');
      // 如果队列为空，也确保停止播放并重置状态
      await this.playerService.stop(); 
      if (this.sendToRenderer) {
        this.sendToRenderer('player-store-update', {
          currentTrack: null,
          isPlaying: false,
          status: 'stopped',
          progress: 0,
        });
      }
    }
  }
}
