import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AudioService } from '../AudioService';
import { get } from 'svelte/store';
import { EventEmitter } from 'events';
import type { PlayerState, Track } from '$types';
import { playerStore } from "$stores/playerStore";
import type { PlayerService as ActualPlayerService } from '$core/player/PlayerService'; // 导入真实的 PlayerService 类型

// 模拟 PlayerService 模块
vi.mock('$core/player/PlayerService', () => {
  // 创建一个继承 EventEmitter 的模拟类，这样它的实例就有了 public 的 emit 方法
  class MockPlayerService extends EventEmitter {
    play = vi.fn();
    stop = vi.fn();
    pause = vi.fn();
    resume = vi.fn();
    // 模拟 PlayerService 的其他属性，以满足类型检查
    ffplayProcess = null;
    currentTrack = null;
    pausedTime = 0;
    isPaused = false;
    getCurrentTrack = vi.fn(() => null);
    getPausedTime = vi.fn(() => 0);
    getIsPaused = vi.fn(() => false);

    // 模拟 _testEmit 方法
    _testEmit = vi.fn((eventName: string, ...args: any[]) => {
      this.emit(eventName, ...args);
    });
  }
  return { PlayerService: MockPlayerService }; // 返回模拟类
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

  // 使用 any 类型来避免复杂的类型断言，因为我们完全模拟了 PlayerService
  let mockedPlayerService: any; 
  let audioServiceInstance: AudioService;
  let mockSendToRenderer: ReturnType<typeof vi.fn>; // 模拟 sendToRenderer 函数

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    playerStore.set(initialPlayerState);
    
    // 重新导入 PlayerService 以获取模拟实例
    const { PlayerService } = await import('$core/player/PlayerService'); // 使用 await
    mockedPlayerService = new PlayerService(); // 获取模拟实例，它现在是 MockPlayerService 的实例

    audioServiceInstance = new AudioService(mockedPlayerService);

    mockSendToRenderer = vi.fn();
    audioServiceInstance.setMainWindowSender(mockSendToRenderer); // 设置模拟的 sendToRenderer
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should delegate playTrack to playerService.play', () => {
    audioServiceInstance.playTrack(mockTrack);
    expect(mockedPlayerService.play).toHaveBeenCalledWith(mockTrack);
  });

  it('should delegate stopPlayback to playerService.stop and clear queue', async () => {
    audioServiceInstance.addToQueue(mockTrack);
    await vi.advanceTimersByTime(0);
    expect(get(playerStore).queue).toEqual([mockTrack]);

    audioServiceInstance.stopPlayback();
    await vi.advanceTimersByTime(0);
    expect(mockedPlayerService.stop).toHaveBeenCalled();
    expect(get(playerStore).queue).toEqual([]);
  });

  it('should delegate pausePlayback to playerService.pause', () => {
    audioServiceInstance.pausePlayback();
    expect(mockedPlayerService.pause).toHaveBeenCalled();
  });

  it('should delegate resumePlayback to playerService.resume', () => {
    audioServiceInstance.resumePlayback();
    expect(mockedPlayerService.resume).toHaveBeenCalled();
  });

  it('should update playerStore and send to renderer on "playback-started" event', async () => {
    mockedPlayerService._testEmit('playback-started', mockTrack); // 调用 _testEmit
    await vi.advanceTimersByTime(0);
    const state = get(playerStore);
    expect(state.currentTrack).toEqual(mockTrack);
    expect(state.isPlaying).toBe(true);
    expect(state.status).toBe('playing');
    expect(state.progress).toBe(0);
    expect(state.duration).toBe(mockTrack.duration);
    expect(mockSendToRenderer).toHaveBeenCalledWith('playback-started', mockTrack);
  });

  it('should update playerStore and send to renderer on "playback-progress" event', async () => {
    mockedPlayerService._testEmit('playback-started', mockTrack); // Simulate start to set duration
    await vi.advanceTimersByTime(0);
    mockedPlayerService._testEmit('playback-progress', { currentTime: 30, duration: 120 }); // 调用 _testEmit
    await vi.advanceTimersByTime(0);
    const state = get(playerStore);
    expect(state.progress).toBe(30);
    expect(state.duration).toBe(120);
    expect(mockSendToRenderer).toHaveBeenCalledWith('playback-progress', { currentTime: 30, duration: 120 });
  });

  it('should update playerStore and send to renderer on "playback-paused" event', async () => {
    mockedPlayerService._testEmit('playback-started', mockTrack);
    await vi.advanceTimersByTime(0);
    mockedPlayerService._testEmit('playback-paused', { currentTime: 60 }); // 调用 _testEmit
    await vi.advanceTimersByTime(0);
    const state = get(playerStore);
    expect(state.isPlaying).toBe(false);
    expect(state.status).toBe('paused');
    expect(state.progress).toBe(60);
    expect(mockSendToRenderer).toHaveBeenCalledWith('playback-paused', { currentTime: 60 });
  });

  it('should update playerStore and send to renderer on "playback-resumed" event', async () => {
    mockedPlayerService._testEmit('playback-started', mockTrack);
    await vi.advanceTimersByTime(0);
    mockedPlayerService._testEmit('playback-paused', { currentTime: 60 });
    await vi.advanceTimersByTime(0);
    mockedPlayerService._testEmit('playback-resumed', { currentTime: 60 }); // 调用 _testEmit
    await vi.advanceTimersByTime(0);
    const state = get(playerStore);
    expect(state.isPlaying).toBe(true);
    expect(state.status).toBe('playing');
    expect(state.progress).toBe(60);
    expect(mockSendToRenderer).toHaveBeenCalledWith('playback-resumed', { currentTime: 60 });
  });

  it('should update playerStore and send to renderer on "playback-ended" event and play next in queue', async () => {
    const track2: Track = { ...mockTrack, id: 2, title: 'Next Song' };
    audioServiceInstance.addToQueue(track2);
    await vi.advanceTimersByTime(0);
    mockedPlayerService._testEmit('playback-started', mockTrack);
    await vi.advanceTimersByTime(0);

    mockedPlayerService._testEmit('playback-ended'); // 调用 _testEmit
    await vi.advanceTimersByTime(0);

    const state = get(playerStore);
    expect(state.isPlaying).toBe(false);
    expect(state.status).toBe('stopped');
    expect(state.currentTrack).toBeNull();
    expect(state.progress).toBe(0);
    expect(mockedPlayerService.play).toHaveBeenCalledWith(track2);
    expect(state.queue).toEqual([]);
    expect(mockSendToRenderer).toHaveBeenCalledWith('playback-ended');
  });

  it('should update playerStore and send to renderer on "playback-error" event and play next in queue', async () => {
    const track2: Track = { ...mockTrack, id: 2, title: 'Next Song' };
    audioServiceInstance.addToQueue(track2);
    await vi.advanceTimersByTime(0);
    mockedPlayerService._testEmit('playback-started', mockTrack);
    await vi.advanceTimersByTime(0);

    mockedPlayerService._testEmit('playback-error', new Error('Playback failed')); // 调用 _testEmit
    await vi.advanceTimersByTime(0);

    const state = get(playerStore);
    expect(state.isPlaying).toBe(false);
    expect(state.status).toBe('error');
    expect(mockedPlayerService.play).toHaveBeenCalledWith(track2);
    expect(state.queue).toEqual([]);
    expect(mockSendToRenderer).toHaveBeenCalledWith('playback-error', 'Playback failed');
  });

  it('should add track to queue and update playerStore', async () => {
    audioServiceInstance.addToQueue(mockTrack);
    await vi.advanceTimersByTime(0);
    const state = get(playerStore);
    expect(state.queue).toEqual([mockTrack]);
  });

  it('should not play next track if queue is empty on playback-ended', async () => {
    mockedPlayerService._testEmit('playback-started', mockTrack);
    await vi.advanceTimersByTime(0);
    mockedPlayerService._testEmit('playback-ended');
    await vi.advanceTimersByTime(0);

    expect(mockedPlayerService.play).not.toHaveBeenCalledWith(expect.anything());
    const state = get(playerStore);
    expect(state.currentTrack).toBeNull();
    expect(state.status).toBe('stopped');
    expect(mockSendToRenderer).toHaveBeenCalledWith('playback-ended');
  });

  it('should return the current queue', async () => {
    audioServiceInstance.addToQueue(mockTrack);
    await vi.advanceTimersByTime(0);
    const track2: Track = { ...mockTrack, id: 2, title: 'Another Song' };
    audioServiceInstance.addToQueue(track2);
    await vi.advanceTimersByTime(0);
    expect(audioServiceInstance.getQueue()).toEqual([mockTrack, track2]);
  });
});
