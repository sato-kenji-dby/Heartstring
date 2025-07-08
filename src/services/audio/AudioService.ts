import { PlayerService } from '$core/player/PlayerService';
import { playerStore } from '$stores/playerStore';
import type { Track } from '$types';
import { get } from 'svelte/store';

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
      playerStore.update(state => ({
        ...state,
        currentTrack: track,
        isPlaying: true,
        status: 'playing',
        progress: 0,
        duration: track.duration || 0,
      }));
      if (this.sendToRenderer) {
        this.sendToRenderer('playback-started', track);
      }
    });

    this.playerService.on('playback-progress', ({ currentTime, duration }: { currentTime: number, duration: number }) => {
      playerStore.update(state => ({
        ...state,
        progress: currentTime,
        duration: duration > 0 ? duration : state.duration,
      }));
      if (this.sendToRenderer) {
        this.sendToRenderer('playback-progress', { currentTime, duration });
      }
    });

    this.playerService.on('playback-paused', ({ currentTime }: { currentTime: number }) => {
      playerStore.update(state => ({
        ...state,
        isPlaying: false,
        status: 'paused',
        progress: currentTime,
      }));
      if (this.sendToRenderer) {
        this.sendToRenderer('playback-paused', { currentTime });
      }
    });

    this.playerService.on('playback-resumed', ({ currentTime }: { currentTime: number }) => {
      playerStore.update(state => ({
        ...state,
        isPlaying: true,
        status: 'playing',
        progress: currentTime,
      }));
      if (this.sendToRenderer) {
        this.sendToRenderer('playback-resumed', { currentTime });
      }
    });

    this.playerService.on('playback-ended', () => {
      playerStore.update(state => ({
        ...state,
        isPlaying: false,
        progress: 0,
        currentTrack: null,
      }));
      if (this.sendToRenderer) {
        this.sendToRenderer('playback-ended');
      }
      this.playNext();
    });

    this.playerService.on('playback-error', (error: Error) => {
      console.error('AudioService received playback error:', error);
      playerStore.update(state => ({
        ...state,
        isPlaying: false,
        status: 'error',
      }));
      if (this.sendToRenderer) {
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
    playerStore.update(state => ({ ...state, queue: [] }));
  }

  pausePlayback() {
    this.playerService.pause();
  }

  resumePlayback() {
    this.playerService.resume();
  }

  addToQueue(track: Track) {
    this.queue.push(track);
    playerStore.update(state => ({ ...state, queue: [...this.queue] }));
    console.log('Added to queue:', track.title, 'Current queue length:', this.queue.length);
  }

  getQueue(): Track[] {
    return this.queue;
  }

  playNext() {
    if (this.queue.length > 0) {
      const nextTrack = this.queue.shift();
      if (nextTrack) {
        this.playTrack(nextTrack);
        playerStore.update(state => ({ ...state, queue: this.queue }));
      }
    } else {
      console.log('Queue is empty. No next track to play.');
      playerStore.update(state => {
        if (state.status !== 'error') {
          return {
            ...state,
            currentTrack: null,
            isPlaying: false,
            status: 'stopped',
            progress: 0,
          };
        }
        return state;
      });
    }
  }
}

// 移除这里的实例化，因为 AudioService 将在主进程中实例化
// export const audioService = new AudioService(new PlayerService(ipcRenderer));
