import { PlayerService } from '$core/player/PlayerService';
import { playerStore } from '$stores/playerStore';//'$stores/playerStore';
import type { Track } from '$types';
import { get } from 'svelte/store'; // 导入 get 函数
import { ipcRenderer } from '$api/ipc';//'$api/ipc'; // 导入 ipcRenderer

export class AudioService {
  private queue: Track[] = [];
  private playerService: PlayerService; // 添加 playerService 实例

  constructor(playerService: PlayerService) {
    this.playerService = playerService; // 实例化 PlayerService
    this.setupListeners();
  }

  private setupListeners() {
    this.playerService.on('playback-started', (track: Track) => {
      playerStore.update(state => ({
        ...state,
        currentTrack: track,
        isPlaying: true,
        status: 'playing',
        progress: 0,
        duration: track.duration || 0, // Ensure duration is set
      }));
    });

    this.playerService.on('playback-progress', ({ currentTime, duration }: { currentTime: number, duration: number }) => {
      playerStore.update(state => ({
        ...state,
        progress: currentTime,
        duration: duration > 0 ? duration : state.duration, // Update duration if provided and valid
      }));
    });

    this.playerService.on('playback-paused', ({ currentTime }: { currentTime: number }) => {
      playerStore.update(state => ({
        ...state,
        isPlaying: false,
        status: 'paused',
        progress: currentTime,
      }));
    });

    this.playerService.on('playback-resumed', ({ currentTime }: { currentTime: number }) => {
      playerStore.update(state => ({
        ...state,
        isPlaying: true,
        status: 'playing',
        progress: currentTime,
      }));
    });

    this.playerService.on('playback-ended', () => {
      playerStore.update(state => ({
        ...state,
        isPlaying: false,
        status: 'stopped',
        progress: 0,
        currentTrack: null,
      }));
      this.playNext(); // 播放结束后自动播放下一首
    });

    this.playerService.on('playback-error', (error: Error) => {
      console.error('AudioService received playback error:', error);
      playerStore.update(state => ({
        ...state,
        isPlaying: false,
        status: 'error',
        // Optionally, clear currentTrack or set error message
      }));
      this.playNext(); // 播放错误后也尝试播放下一首
    });
  }

  playTrack(track: Track) {
    this.playerService.play(track);
  }

  stopPlayback() {
    this.playerService.stop();
    this.queue = []; // 停止时清空队列
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
    // 自动播放下一首的逻辑应该由 playback-ended 或 playback-error 事件触发
    // 如果当前没有播放，并且队列中有歌曲，则自动播放第一首
    if (get(playerStore).status === 'stopped' && !get(playerStore).currentTrack && this.queue.length === 1) {
      this.playNext();
    }
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

// export const audioService = new AudioService(new PlayerService(ipcRenderer));
