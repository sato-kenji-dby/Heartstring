import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AudioService } from '../AudioService';
import { get } from 'svelte/store';
// import { EventEmitter } from 'events'; // 移除顶层导入
import type { PlayerState, Track } from '$types';
import { playerStore } from "$stores/playerStore";

// --- Mocks ---
// 模拟 PlayerService 模块
vi.mock('$core/player/PlayerService', () => {
  // 使用 require 确保 EventEmitter 同步加载，避免 ReferenceError
  const { EventEmitter } = require('events'); 
  class MockPlayerService extends EventEmitter {
    play = vi.fn((track: Track) => {
      // 模拟播放开始，触发事件
      this.emit('playback-started', track);
    });
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
  }
  return { PlayerService: MockPlayerService }; // 返回模拟类
});

// 声明 mockedPlayerService，以便在 describe 作用域内访问
let mockedPlayerService: any; 

describe('AudioService Unit Tests', () => {
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

  let audioServiceInstance: AudioService;
  let mockSendToRenderer: ReturnType<typeof vi.fn>; // 模拟 sendToRenderer 函数

  beforeEach(async () => {
    vi.clearAllMocks(); // 确保在每次测试前清除所有 mocks
    vi.useFakeTimers();
    playerStore.set(initialPlayerState);
    
    // 在 beforeEach 内部声明并实例化 mockedPlayerService
    const { PlayerService } = await import('$core/player/PlayerService');
    const mockedPlayerServiceInstance = new PlayerService(); // 获取模拟实例

    audioServiceInstance = new AudioService(mockedPlayerServiceInstance); // 使用局部变量

    // 将 mockedPlayerService 赋值给一个在 describe 作用域内的变量，以便在 it 块中访问
    mockedPlayerService = mockedPlayerServiceInstance; 

    mockSendToRenderer = vi.fn();
    audioServiceInstance.setMainWindowSender(mockSendToRenderer);
    
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks(); // 清理所有 mocks 和 spies
    vi.useRealTimers(); // 恢复真实定时器
  });

  // ===================================
  // ===      核心功能 (Core Functionality)      ===
  // ===================================

  it('should delegate playTrack to playerService.play', () => {
    audioServiceInstance.playTrack(mockTrack);
    expect(mockedPlayerService.play).toHaveBeenCalledWith(mockTrack);
  });

  it('should delegate stopPlayback to playerService.stop and clear queue', async () => {
    audioServiceInstance.addToQueue(mockTrack);
    await vi.advanceTimersByTime(0); // 允许 store 更新
    expect(get(playerStore).queue).toEqual([mockTrack]);

    audioServiceInstance.stopPlayback();
    await vi.advanceTimersByTime(0); // 允许 store 更新
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

  it('should add track to queue and update playerStore', async () => {
    audioServiceInstance.addToQueue(mockTrack);
    await vi.advanceTimersByTime(0); // 允许 store 更新
    const state = get(playerStore);
    expect(state.queue).toEqual([mockTrack]);
  });

  it('should return the current queue', async () => {
    audioServiceInstance.addToQueue(mockTrack);
    await vi.advanceTimersByTime(0);
    const track2: Track = { ...mockTrack, id: 2, title: 'Another Song' };
    audioServiceInstance.addToQueue(track2);
    await vi.advanceTimersByTime(0);
    expect(audioServiceInstance.getQueue()).toEqual([mockTrack, track2]);
  });

  // ===================================
  // ===      事件处理 (Event Handling)      ===
  // ===================================

  it('should update playerStore and send to renderer on "playback-started" event', async () => {
    mockedPlayerService.emit('playback-started', mockTrack);
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
    mockedPlayerService.emit('playback-started', mockTrack); // Simulate start to set duration
    await vi.advanceTimersByTime(0);
    mockedPlayerService.emit('playback-progress', { currentTime: 30, duration: 120 });
    await vi.advanceTimersByTime(0);
    const state = get(playerStore);
    expect(state.progress).toBe(30);
    expect(state.duration).toBe(120);
    expect(mockSendToRenderer).toHaveBeenCalledWith('playback-progress', { currentTime: 30, duration: 120 });
  });

  it('should update playerStore and send to renderer on "playback-paused" event', async () => {
    mockedPlayerService.emit('playback-started', mockTrack);
    await vi.advanceTimersByTime(0);
    mockedPlayerService.emit('playback-paused', { currentTime: 60 });
    await vi.advanceTimersByTime(0);
    const state = get(playerStore);
    expect(state.isPlaying).toBe(false);
    expect(state.status).toBe('paused');
    expect(state.progress).toBe(60);
    expect(mockSendToRenderer).toHaveBeenCalledWith('playback-paused', { currentTime: 60 });
  });

  it('should update playerStore and send to renderer on "playback-resumed" event', async () => {
    mockedPlayerService.emit('playback-started', mockTrack);
    await vi.advanceTimersByTime(0);
    mockedPlayerService.emit('playback-paused', { currentTime: 60 });
    await vi.advanceTimersByTime(0);
    mockedPlayerService.emit('playback-resumed', { currentTime: 60 });
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
    mockedPlayerService.emit('playback-started', mockTrack);
    await vi.advanceTimersByTime(0);

    mockedPlayerService.emit('playback-ended');
    await vi.advanceTimersByTime(0);

    const state = get(playerStore);
    expect(state.isPlaying).toBe(true); // 因为会立即播放下一首
    expect(state.status).toBe('playing'); // 因为会立即播放下一首
    expect(state.currentTrack).toEqual(track2); // 应该更新为下一首
    expect(state.progress).toBe(0);
    expect(mockedPlayerService.play).toHaveBeenCalledWith(track2);
    expect(state.queue).toEqual([]);
    expect(mockSendToRenderer).toHaveBeenCalledWith('playback-ended');
  });

  it('should update playerStore and send to renderer on "playback-error" event and play next in queue', async () => {
    const track2: Track = { ...mockTrack, id: 2, title: 'Next Song' };
    audioServiceInstance.addToQueue(track2);
    await vi.advanceTimersByTime(0);
    mockedPlayerService.emit('playback-started', mockTrack);
    await vi.advanceTimersByTime(0);

    mockedPlayerService.emit('playback-error', new Error('Playback failed'));
    await vi.advanceTimersByTime(0);

    const state = get(playerStore);
    expect(state.isPlaying).toBe(true); // 因为会立即播放下一首
    expect(state.status).toBe('playing'); // 因为会立即播放下一首
    expect(state.currentTrack).toEqual(track2); // 应该更新为下一首
    expect(mockedPlayerService.play).toHaveBeenCalledWith(track2);
    expect(state.queue).toEqual([]);
    expect(mockSendToRenderer).toHaveBeenCalledWith('playback-error', 'Playback failed');
    expect(console.error).toHaveBeenCalledWith('AudioService received playback error:', expect.any(Error));
  });

  // ===================================
  // ===      边界与边缘情况 (Edge & Boundary Cases)      ===
  // ===================================

  it('should not play next track if queue is empty on playback-ended', async () => {
    mockedPlayerService.emit('playback-started', mockTrack);
    await vi.advanceTimersByTime(0);
    mockedPlayerService.emit('playback-ended');
    await vi.advanceTimersByTime(0);

    expect(mockedPlayerService.play).not.toHaveBeenCalledWith(expect.anything());
    const state = get(playerStore);
    expect(state.currentTrack).toBeNull();
    expect(state.status).toBe('stopped');
    expect(mockSendToRenderer).toHaveBeenCalledWith('playback-ended');
  });

  it('should not change status from error if queue is empty on playback-ended', async () => {
    mockedPlayerService.emit('playback-started', mockTrack);
    await vi.advanceTimersByTime(0);
    mockedPlayerService.emit('playback-error', new Error('Playback failed'));
    await vi.advanceTimersByTime(0);
    
    // 此时状态应为 'error'
    expect(get(playerStore).status).toBe('error');

    // 再次触发 playback-ended，但队列为空
    mockedPlayerService.emit('playback-ended');
    await vi.advanceTimersByTime(0);

    // 状态不应从 'error' 变为 'stopped'
    expect(get(playerStore).status).toBe('error');
    expect(get(playerStore).currentTrack).toBeNull();
    expect(get(playerStore).isPlaying).toBe(false);
  });
});
