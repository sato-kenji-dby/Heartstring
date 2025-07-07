import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AudioService } from '../AudioService';
import { get } from 'svelte/store';
import { EventEmitter } from 'events';
import type { PlayerState, Track } from '$types';
// 移除 PlayerService 的类型导入，因为我们将直接模拟它
// import type { PlayerService } from '$core/player/PlayerService';
import { playerStore } from "$stores/playerStore";

// Mock ipcRenderer as it's a dependency of PlayerService
vi.mock('$api/ipc', () => {
  // 在这里创建 mockIpcRenderer，确保它在需要时可用
  const mockIpcRenderer = {
    invoke: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    send: vi.fn(),
  };
  return {
    ipcRenderer: mockIpcRenderer,
  };
});

// Mock the PlayerService class itself
vi.mock('$core/player/PlayerService', async () => {
  const EventEmitterActual = await vi.importActual<typeof import('events')>('events');

  // 创建一个模拟 PlayerService 类，它继承 EventEmitter 并包含 PlayerService 的方法
  class MockPlayerService extends EventEmitterActual.EventEmitter {
    constructor(ipcRenderer: any) { // 构造函数需要 ipcRenderer 参数
      super();
    }
    play = vi.fn();
    stop = vi.fn();
    pause = vi.fn();
    resume = vi.fn();
  }

  return {
    PlayerService: MockPlayerService, // 直接返回模拟类
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
  let mockedPlayerService: any; 
  let audioServiceInstance: AudioService; // 声明一个变量来持有 AudioService 实例
  const mockIpcRenderer = vi.mocked(
    { invoke: vi.fn(), on: vi.fn(), off: vi.fn(), send: vi.fn() },
  );
  
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers(); // 使用假计时器
    playerStore.set(initialPlayerState);
    vi.runAllTimers(); // 运行所有计时器，确保 store 更新完成

    const { PlayerService } = await import('$core/player/PlayerService');
    mockedPlayerService = new PlayerService(mockIpcRenderer);
    mockedPlayerService.removeAllListeners();

    // 在这里实例化 AudioService 并注入模拟的 PlayerService
    audioServiceInstance = new AudioService(mockedPlayerService);
  });

  afterEach(() => {
    vi.useRealTimers(); // 恢复真实计时器
  });

  it('should delegate playTrack to playerService.play', () => {
    audioServiceInstance.playTrack(mockTrack); // 使用 audioServiceInstance
    expect(mockedPlayerService.play).toHaveBeenCalledWith(mockTrack);
  });

  it('should delegate stopPlayback to playerService.stop and clear queue', () => {
    audioServiceInstance.addToQueue(mockTrack); // 使用 audioServiceInstance
    expect(get(playerStore).queue).toEqual([mockTrack]);

    audioServiceInstance.stopPlayback(); // 使用 audioServiceInstance
    expect(mockedPlayerService.stop).toHaveBeenCalled();
    expect(get(playerStore).queue).toEqual([]); // Queue should be cleared
  });

  it('should delegate pausePlayback to playerService.pause', () => {
    audioServiceInstance.pausePlayback(); // 使用 audioServiceInstance
    expect(mockedPlayerService.pause).toHaveBeenCalled();
  });

  it('should delegate resumePlayback to playerService.resume', () => {
    audioServiceInstance.resumePlayback(); // 使用 audioServiceInstance
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
    audioServiceInstance.addToQueue(track2); // Add track2 to queue
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
    audioServiceInstance.addToQueue(track2); // Add track2 to queue
    mockedPlayerService.emit('playback-started', mockTrack); // Play mockTrack

    mockedPlayerService.emit('playback-error', new Error('Playback failed')); // mockTrack errors

    const state = get(playerStore);
    expect(state.isPlaying).toBe(false);
    expect(state.status).toBe('error');
    expect(mockedPlayerService.play).toHaveBeenCalledWith(track2); // Should play next track
    expect(state.queue).toEqual([]); // Queue should be empty after playing track2
  });

  it('should add track to queue and update playerStore', () => {
    audioServiceInstance.addToQueue(mockTrack); // 使用 audioServiceInstance
    const state = get(playerStore);
    expect(state.queue).toEqual([mockTrack]);
  });

  it('should play next track from queue if current track is stopped and queue is not empty', () => {
    const track2: Track = { ...mockTrack, id: 2, title: 'Next Song' };
    playerStore.set({ ...initialPlayerState, status: 'stopped', currentTrack: null, queue: [] }); 
    audioServiceInstance.addToQueue(track2); // Add track2 to queue

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
    audioServiceInstance.addToQueue(mockTrack); // 使用 audioServiceInstance
    const track2: Track = { ...mockTrack, id: 2, title: 'Another Song' };
    audioServiceInstance.addToQueue(track2);
    expect(audioServiceInstance.getQueue()).toEqual([mockTrack, track2]);
  });
});
