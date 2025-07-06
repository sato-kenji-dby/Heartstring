import { playerService } from './playerService';
import { playerStore, type Track } from './stores/playerStore';
import { get } from 'svelte/store'; // 导入 get 函数

class AudioService {
  private queue: Track[] = [];

  constructor() {
    this.setupListeners();
  }

  private setupListeners() {
    playerService.on('playback-started', (track: Track) => {
      playerStore.update(state => ({
        ...state,
        currentTrack: track,
        isPlaying: true,
        status: 'playing',
        progress: 0,
        duration: track.duration || 0, // Ensure duration is set
      }));
    });

    playerService.on('playback-progress', ({ currentTime, duration }: { currentTime: number, duration: number }) => {
      playerStore.update(state => ({
        ...state,
        progress: currentTime,
        duration: duration > 0 ? duration : state.duration, // Update duration if provided and valid
      }));
    });

    playerService.on('playback-paused', ({ currentTime }: { currentTime: number }) => {
      playerStore.update(state => ({
        ...state,
        isPlaying: false,
        status: 'paused',
        progress: currentTime,
      }));
    });

    playerService.on('playback-resumed', ({ currentTime }: { currentTime: number }) => {
      playerStore.update(state => ({
        ...state,
        isPlaying: true,
        status: 'playing',
        progress: currentTime,
      }));
    });

    playerService.on('playback-ended', () => {
      playerStore.update(state => ({
        ...state,
        isPlaying: false,
        status: 'stopped',
        progress: 0,
        currentTrack: null,
      }));
      this.playNext(); // 播放结束后自动播放下一首
    });

    playerService.on('playback-error', (error: Error) => {
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
    playerService.play(track);
  }

  stopPlayback() {
    playerService.stop();
    this.queue = []; // 停止时清空队列
    playerStore.update(state => ({ ...state, queue: [] }));
  }

  pausePlayback() {
    playerService.pause();
  }

  resumePlayback() {
    playerService.resume();
  }

  addToQueue(track: Track) {
    this.queue.push(track);
    playerStore.update(state => ({ ...state, queue: this.queue }));
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
      playerStore.update(state => ({
        ...state,
        currentTrack: null,
        isPlaying: false,
        status: 'stopped',
        progress: 0,
      }));
    }
  }
}

export const audioService = new AudioService();
