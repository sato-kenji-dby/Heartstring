import { describe, it, expect, vi, beforeEach } from 'vitest';
import { audioService } from '$services/audio/AudioService';
import { get } from 'svelte/store';
import { EventEmitter } from 'events';
import type { PlayerState, Track } from '$types';
import type { PlayerService } from '$core/player/PlayerService';
import { playerStore } from '$stores/playerStore';

// 定义一个模拟 PlayerService 的接口，包含其方法和 EventEmitter 的特性
interface MockPlayerServiceType extends EventEmitter {
  play: typeof PlayerService.prototype.play;
  stop: typeof PlayerService.prototype.stop;
  pause: typeof PlayerService.prototype.pause;
  resume: typeof PlayerService.prototype.resume;
  // 可以根据需要添加其他公共方法
}

// Mock the PlayerService class itself
vi.mock('$core/player/PlayerService', () => {
  const EventEmitter = require('events');
  // 在 mock 工厂函数内部创建实例，以避免初始化顺序问题
  const mockPlayerServiceInstance: MockPlayerServiceType = new EventEmitter() as MockPlayerServiceType;
  mockPlayerServiceInstance.play = vi.fn();
  mockPlayerServiceInstance.stop = vi.fn();
  mockPlayerServiceInstance.pause = vi.fn();
  mockPlayerServiceInstance.resume = vi.fn();

  return {
    PlayerService: vi.fn(() => mockPlayerServiceInstance), // Return a mock constructor that returns our mock instance
  };
});

describe('AudioService', () => {
  const mockTrack: Track = {
    id: 1,
    title: 'Test Song',
    artist: 'Test Artist',
    album: 'Test Album',
    path: '/path/to/test/audio.mp3',
    duration: 120,
  };

  const initialPlayerState: PlayerState = {
    currentTrack: null,
    isPlaying: false,
    progress: 0,
    duration: 0,
    status: 'stopped',
    queue: [],
  };

  // Declare a variable to hold the mocked playerService instance
  let mockedPlayerService: MockPlayerServiceType;

  beforeEach(() => {
    vi.clearAllMocks();
    playerStore.set(initialPlayerState); // Reset playerStore

    // Get the mocked instance that AudioService will use
    // This relies on the vi.mock factory returning the same instance every time PlayerService is instantiated
    const { PlayerService } = require('../playerService');
    mockedPlayerService = new PlayerService();
    mockedPlayerService.removeAllListeners(); // Clear listeners on the mocked playerService instance
  });

  it('should delegate playTrack to playerService.play', () => {
    audioService.playTrack(mockTrack);
    expect(mockedPlayerService.play).toHaveBeenCalledWith(mockTrack);
  });

  it('should delegate stopPlayback to playerService.stop and clear queue', () => {
    audioService.addToQueue(mockTrack); // Add something to queue
    expect(get(playerStore).queue).toEqual([mockTrack]);

    audioService.stopPlayback();
    expect(mockedPlayerService.stop).toHaveBeenCalled();
    expect(get(playerStore).queue).toEqual([]); // Queue should be cleared
  });

  it('should delegate pausePlayback to playerService.pause', () => {
    audioService.pausePlayback();
    expect(mockedPlayerService.pause).toHaveBeenCalled();
  });

  it('should delegate resumePlayback to playerService.resume', () => {
    audioService.resumePlayback();
    expect(mockedPlayerService.resume).toHaveBeenCalled();
  });

  it('should update playerStore on "playback-started" event', () => {
    mockedPlayerService.emit('playback-started', mockTrack);
    const state = get(playerStore);
    expect(state.currentTrack).toEqual(mockTrack);
    expect(state.isPlaying).toBe(true);
    expect(state.status).toBe('playing');
    expect(state.progress).toBe(0);
    expect(state.duration).toBe(mockTrack.duration);
  });

  it('should update playerStore on "playback-progress" event', () => {
    mockedPlayerService.emit('playback-started', mockTrack); // Simulate start to set duration
    mockedPlayerService.emit('playback-progress', { currentTime: 30, duration: 120 });
    const state = get(playerStore);
    expect(state.progress).toBe(30);
    expect(state.duration).toBe(120);
  });

  it('should update playerStore on "playback-paused" event', () => {
    mockedPlayerService.emit('playback-started', mockTrack);
    mockedPlayerService.emit('playback-paused', { currentTime: 60 });
    const state = get(playerStore);
    expect(state.isPlaying).toBe(false);
    expect(state.status).toBe('paused');
    expect(state.progress).toBe(60);
  });

  it('should update playerStore on "playback-resumed" event', () => {
    mockedPlayerService.emit('playback-started', mockTrack);
    mockedPlayerService.emit('playback-paused', { currentTime: 60 }); // Pause first
    mockedPlayerService.emit('playback-resumed', { currentTime: 60 });
    const state = get(playerStore);
    expect(state.isPlaying).toBe(true);
    expect(state.status).toBe('playing');
    expect(state.progress).toBe(60);
  });

  it('should update playerStore on "playback-ended" event and play next in queue', () => {
    const track2: Track = { ...mockTrack, id: 2, title: 'Next Song' };
    audioService.addToQueue(track2); // Add track2 to queue
    mockedPlayerService.emit('playback-started', mockTrack); // Play mockTrack

    mockedPlayerService.emit('playback-ended'); // mockTrack ends

    const state = get(playerStore);
    expect(state.isPlaying).toBe(false);
    expect(state.status).toBe('stopped');
    expect(state.currentTrack).toBeNull();
    expect(state.progress).toBe(0);
    expect(mockedPlayerService.play).toHaveBeenCalledWith(track2); // Should play next track
    expect(state.queue).toEqual([]); // Queue should be empty after playing track2
  });

  it('should update playerStore on "playback-error" event and play next in queue', () => {
    const track2: Track = { ...mockTrack, id: 2, title: 'Next Song' };
    audioService.addToQueue(track2); // Add track2 to queue
    mockedPlayerService.emit('playback-started', mockTrack); // Play mockTrack

    mockedPlayerService.emit('playback-error', new Error('Playback failed')); // mockTrack errors

    const state = get(playerStore);
    expect(state.isPlaying).toBe(false);
    expect(state.status).toBe('error');
    expect(mockedPlayerService.play).toHaveBeenCalledWith(track2); // Should play next track
    expect(state.queue).toEqual([]); // Queue should be empty after playing track2
  });

  it('should add track to queue and update playerStore', () => {
    audioService.addToQueue(mockTrack);
    const state = get(playerStore);
    expect(state.queue).toEqual([mockTrack]);
  });

  it('should play next track from queue if current track is stopped and queue is not empty', () => {
    const track2: Track = { ...mockTrack, id: 2, title: 'Next Song' };
    audioService.addToQueue(track2); // Add track2 to queue
    playerStore.set({ ...initialPlayerState, status: 'stopped', currentTrack: null }); // Ensure stopped state

    // Since addToQueue has a subscribe that triggers playNext if stopped and queue not empty
    expect(mockedPlayerService.play).toHaveBeenCalledWith(track2);
    expect(get(playerStore).queue).toEqual([]); // Queue should be empty
  });

  it('should not play next track if queue is empty on playback-ended', () => {
    mockedPlayerService.emit('playback-started', mockTrack);
    mockedPlayerService.emit('playback-ended'); // Queue is empty

    expect(mockedPlayerService.play).not.toHaveBeenCalledWith(expect.anything()); // No next track played
    const state = get(playerStore);
    expect(state.currentTrack).toBeNull();
    expect(state.status).toBe('stopped');
  });

  it('should return the current queue', () => {
    audioService.addToQueue(mockTrack);
    const track2: Track = { ...mockTrack, id: 2, title: 'Another Song' };
    audioService.addToQueue(track2);
    expect(audioService.getQueue()).toEqual([mockTrack, track2]);
  });
});
