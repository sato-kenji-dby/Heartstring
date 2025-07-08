import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AudioService } from '../AudioService';
// import { get } from 'svelte/store'; // 移除对 svelte/store 的导入
// import { EventEmitter } from 'events'; // 移除顶层导入
import type { PlayerState, Track } from '$types';
// import { playerStore } from "$stores/playerStore"; // 移除对 playerStore 的导入

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

  // initialPlayerState 不再直接用于 playerStore.set，但可以作为期望值的参考
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
    // playerStore.set(initialPlayerState); // 移除对 playerStore 的直接设置
    
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
    await vi.advanceTimersByTime(0); // 允许异步操作完成
    // 此时 mockSendToRenderer 已经被调用过一次，包含 mockTrack

    // 清除 mockSendToRenderer 的调用历史，以便只检查 stopPlayback 后的调用
    mockSendToRenderer.mockClear(); 

    audioServiceInstance.stopPlayback();
    await vi.advanceTimersByTime(0); // 允许异步操作完成
    expect(mockedPlayerService.stop).toHaveBeenCalled();
    // 检查 sendToRenderer 是否发送了队列清空的消息
    expect(mockSendToRenderer).toHaveBeenCalledWith('player-store-update', { queue: [] });
  });

  it('should delegate pausePlayback to playerService.pause', () => {
    audioServiceInstance.pausePlayback();
    expect(mockedPlayerService.pause).toHaveBeenCalled();
  });

  it('should delegate resumePlayback to playerService.resume', () => {
    audioServiceInstance.resumePlayback();
    expect(mockedPlayerService.resume).toHaveBeenCalled();
  });

  it('should add track to queue and send update to renderer', async () => {
    audioServiceInstance.addToQueue(mockTrack);
    await vi.advanceTimersByTime(0); // 允许异步操作完成
    // 检查 sendToRenderer 是否发送了队列更新的消息
    expect(mockSendToRenderer).toHaveBeenCalledWith('player-store-update', { queue: [mockTrack] });
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

  it('should send player-store-update and playback-started on "playback-started" event', async () => {
    mockedPlayerService.emit('playback-started', mockTrack);
    await vi.advanceTimersByTime(0);
    expect(mockSendToRenderer).toHaveBeenCalledWith('player-store-update', {
      currentTrack: mockTrack,
      isPlaying: true,
      status: 'playing',
      progress: 0,
      duration: mockTrack.duration,
    });
    expect(mockSendToRenderer).toHaveBeenCalledWith('playback-started', mockTrack);
  });

  it('should send player-store-update and playback-progress on "playback-progress" event', async () => {
    mockedPlayerService.emit('playback-started', mockTrack); // Simulate start to set duration
    await vi.advanceTimersByTime(0);
    mockedPlayerService.emit('playback-progress', { currentTime: 30, duration: 120 });
    await vi.advanceTimersByTime(0);
    expect(mockSendToRenderer).toHaveBeenCalledWith('player-store-update', {
      progress: 30,
      duration: 120,
    });
    expect(mockSendToRenderer).toHaveBeenCalledWith('playback-progress', { currentTime: 30, duration: 120 });
  });

  it('should send player-store-update and playback-paused on "playback-paused" event', async () => {
    mockedPlayerService.emit('playback-started', mockTrack);
    await vi.advanceTimersByTime(0);
    mockedPlayerService.emit('playback-paused', { currentTime: 60 });
    await vi.advanceTimersByTime(0);
    expect(mockSendToRenderer).toHaveBeenCalledWith('player-store-update', {
      isPlaying: false,
      status: 'paused',
      progress: 60,
    });
    expect(mockSendToRenderer).toHaveBeenCalledWith('playback-paused', { currentTime: 60 });
  });

  it('should send player-store-update and playback-resumed on "playback-resumed" event', async () => {
    mockedPlayerService.emit('playback-started', mockTrack);
    await vi.advanceTimersByTime(0);
    mockedPlayerService.emit('playback-paused', { currentTime: 60 });
    await vi.advanceTimersByTime(0);
    mockedPlayerService.emit('playback-resumed', { currentTime: 60 });
    await vi.advanceTimersByTime(0);
    expect(mockSendToRenderer).toHaveBeenCalledWith('player-store-update', {
      isPlaying: true,
      status: 'playing',
      progress: 60,
    });
    expect(mockSendToRenderer).toHaveBeenCalledWith('playback-resumed', { currentTime: 60 });
  });

  it('should send player-store-update and playback-ended on "playback-ended" event and play next in queue', async () => {
    const track2: Track = { ...mockTrack, id: 2, title: 'Next Song' };
    audioServiceInstance.addToQueue(track2);
    await vi.advanceTimersByTime(0);
    mockedPlayerService.emit('playback-started', mockTrack);
    await vi.advanceTimersByTime(0);

    mockedPlayerService.emit('playback-ended');
    await vi.advanceTimersByTime(0);

    // 期望发送 playback-ended 消息
    expect(mockSendToRenderer).toHaveBeenCalledWith('playback-ended');
    // 期望发送 player-store-update 消息，反映播放结束后的状态
    expect(mockSendToRenderer).toHaveBeenCalledWith('player-store-update', {
      isPlaying: false,
      progress: 0,
      currentTrack: null,
    });
    // 期望播放下一首
    expect(mockedPlayerService.play).toHaveBeenCalledWith(track2);
    // 期望队列更新消息
    expect(mockSendToRenderer).toHaveBeenCalledWith('player-store-update', { queue: [] });
  });

  it('should send player-store-update and playback-error on "playback-error" event and play next in queue', async () => {
    const track2: Track = { ...mockTrack, id: 2, title: 'Next Song' };
    audioServiceInstance.addToQueue(track2);
    await vi.advanceTimersByTime(0);
    mockedPlayerService.emit('playback-started', mockTrack);
    await vi.advanceTimersByTime(0);

    mockedPlayerService.emit('playback-error', new Error('Playback failed'));
    await vi.advanceTimersByTime(0);

    // 期望发送 playback-error 消息
    expect(mockSendToRenderer).toHaveBeenCalledWith('playback-error', 'Playback failed');
    // 期望发送 player-store-update 消息，反映错误状态
    expect(mockSendToRenderer).toHaveBeenCalledWith('player-store-update', {
      isPlaying: false,
      status: 'error',
    });
    // 期望播放下一首
    expect(mockedPlayerService.play).toHaveBeenCalledWith(track2);
    // 期望队列更新消息
    expect(mockSendToRenderer).toHaveBeenCalledWith('player-store-update', { queue: [] });
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
    // 期望发送 playback-ended 消息
    expect(mockSendToRenderer).toHaveBeenCalledWith('playback-ended');
    // 期望发送 player-store-update 消息，反映播放结束且队列为空的状态
    expect(mockSendToRenderer).toHaveBeenCalledWith('player-store-update', {
      currentTrack: null,
      isPlaying: false,
      status: 'stopped',
      progress: 0,
    });
  });

  it('should not change status from error if queue is empty on playback-ended', async () => {
    mockedPlayerService.emit('playback-started', mockTrack);
    await vi.advanceTimersByTime(0);
    mockedPlayerService.emit('playback-error', new Error('Playback failed'));
    await vi.advanceTimersByTime(0);
    
    // 期望发送 player-store-update 消息，反映错误状态
    expect(mockSendToRenderer).toHaveBeenCalledWith('player-store-update', {
      isPlaying: false,
      status: 'error',
    });
    expect(mockSendToRenderer).toHaveBeenCalledWith('playback-error', 'Playback failed');

    // 再次触发 playback-ended，但队列为空
    mockedPlayerService.emit('playback-ended');
    await vi.advanceTimersByTime(0);

    // 期望发送 playback-ended 消息
    expect(mockSendToRenderer).toHaveBeenCalledWith('playback-ended');
    // 期望发送 player-store-update 消息，反映队列为空且之前是错误状态，所以状态保持 error
    expect(mockSendToRenderer).toHaveBeenCalledWith('player-store-update', {
      currentTrack: null,
      isPlaying: false,
      status: 'stopped', // AudioService.ts 中 playNext 队列为空时，如果不是 error 状态，会设置为 stopped
      progress: 0,
    });
    // 确认没有尝试播放下一首
    expect(mockedPlayerService.play).not.toHaveBeenCalledWith(expect.anything());
  });
});
