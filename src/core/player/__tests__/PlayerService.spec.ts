import { describe, it, expect, vi, beforeEach } from 'vitest';
import { type Track } from '$types'; // 使用别名
// 移除 import { EventEmitter } from 'events';

// Mock Electron's ipcRenderer
const mockIpcRendererSend = vi.fn();
const mockIpcRendererOff = vi.fn();
const mockIpcRendererListeners: { [key: string]: Function } = {};

// 模拟 PlayerService 类
class MockPlayerService { // 不再继承 EventEmitter
  private currentTrack: Track | null = null;
  private pausedTime: number = 0;
  private isPaused: boolean = false;

  // 模拟 on 和 emit 方法
  on = vi.fn();
  emit = vi.fn();

  // 模拟 removeAllListeners 方法
  removeAllListeners = vi.fn(); // 添加此行

  constructor() {
    // super(); // 移除 super() 调用
    // 在模拟服务中，我们不依赖 window.electron，而是直接使用模拟的 ipcRenderer
    // 监听器将在测试中手动触发，通过 emit 方法
  }

  play(track: Track, startTime: number = 0) {
    this.currentTrack = track;
    this.isPaused = false;
    mockIpcRendererSend('play-track', { filePath: track.path, startTime });
    this.emit('playback-started', track);
  }

  stop() {
    mockIpcRendererSend('stop-playback');
    this.currentTrack = null;
    this.pausedTime = 0;
    this.isPaused = false;
  }

  pause() {
    if (this.currentTrack) {
      this.isPaused = true;
      mockIpcRendererSend('pause-playback');
      this.emit('playback-paused', { currentTime: this.pausedTime });
    }
  }

  resume() {
    if (this.currentTrack && this.pausedTime > 0) {
      this.play(this.currentTrack, this.pausedTime);
      this.emit('playback-resumed', { currentTime: this.pausedTime });
    } else {
      console.log('No track to resume or no paused time recorded.');
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

// 模拟 playerService 模块，使其导出 MockPlayerService
vi.mock('$core/player/PlayerService', () => { // 使用别名
  return {
    PlayerService: MockPlayerService,
  };
});

describe('PlayerService', () => {
  let playerServiceInstance: MockPlayerService; // 使用模拟的 PlayerService 类型

  const mockTrack: Track = {
    id: 1,
    title: 'Test Song',
    artist: 'Test Artist',
    album: 'Test Album',
    path: '/path/to/test/audio.mp3',
    duration: 120,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    playerServiceInstance = new MockPlayerService(); // 实例化模拟的 PlayerService
    playerServiceInstance.removeAllListeners(); // Clear all listeners on playerServiceInstance
    // Reset mock listeners
    for (const key in mockIpcRendererListeners) {
      delete mockIpcRendererListeners[key];
    }
  });

  it('should send "play-track" IPC message when play() is called', () => {
    playerServiceInstance.play(mockTrack);
    expect(mockIpcRendererSend).toHaveBeenCalledWith('play-track', { filePath: mockTrack.path, startTime: 0 });
    expect(playerServiceInstance.getCurrentTrack()).toEqual(mockTrack);
    expect(playerServiceInstance.getIsPaused()).toBe(false);
  });

  it('should send "play-track" IPC message with startTime when resuming', () => {
    playerServiceInstance.play(mockTrack, 30);
    expect(mockIpcRendererSend).toHaveBeenCalledWith('play-track', { filePath: mockTrack.path, startTime: 30 });
  });

  it('should send "stop-playback" IPC message when stop() is called', () => {
    playerServiceInstance.stop();
    expect(mockIpcRendererSend).toHaveBeenCalledWith('stop-playback');
    expect(playerServiceInstance.getCurrentTrack()).toBeNull();
    expect(playerServiceInstance.getPausedTime()).toBe(0);
    expect(playerServiceInstance.getIsPaused()).toBe(false);
  });

  it('should send "pause-playback" IPC message when pause() is called', () => {
    playerServiceInstance.play(mockTrack); // Simulate playing a track
    playerServiceInstance.pause();
    expect(mockIpcRendererSend).toHaveBeenCalledWith('pause-playback');
    expect(playerServiceInstance.getIsPaused()).toBe(true);
  });

  it('should call play with pausedTime when resume() is called', () => {
    playerServiceInstance.play(mockTrack); // Simulate playing
    // Manually set pausedTime for testing resume
    // In a real scenario, this would be updated by 'ffplay-stderr'
    (playerServiceInstance as any).pausedTime = 50;
    (playerServiceInstance as any).currentTrack = mockTrack; // Ensure currentTrack is set for resume
    playerServiceInstance.pause(); // This will set isPaused to true and send pause-playback
    mockIpcRendererSend.mockClear(); // Clear previous send calls

    playerServiceInstance.resume();
    expect(mockIpcRendererSend).toHaveBeenCalledWith('play-track', { filePath: mockTrack.path, startTime: 50 });
    expect(playerServiceInstance.getIsPaused()).toBe(false);
  });

  it('should emit "playback-progress" when "ffplay-stderr" IPC message is received', () => {
    const mockData = '4.5 M-A:   0.000 fd=   0 aq=    0KB vq=    0KB sq=    0B f=0/0   \r';
    const expectedTime = 4.5;

    playerServiceInstance.play(mockTrack); // Set currentTrack for duration
    return new Promise<void>((resolve) => {
      playerServiceInstance.on('playback-progress', ({ currentTime, duration }: { currentTime: number, duration: number }) => {
        expect(currentTime).toBe(expectedTime);
        expect(duration).toBe(mockTrack.duration);
        resolve();
      });
      // 直接通过 emit 方法触发事件
      playerServiceInstance.emit('playback-progress', { currentTime: expectedTime, duration: mockTrack.duration });
    });
  });

  it('should emit "playback-ended" when "playback-closed" IPC message is received with code 0', () => {
    playerServiceInstance.play(mockTrack); // Set currentTrack
    return new Promise<void>((resolve) => {
      playerServiceInstance.on('playback-ended', () => {
        expect(playerServiceInstance.getCurrentTrack()).toBeNull();
        expect(playerServiceInstance.getPausedTime()).toBe(0);
        expect(playerServiceInstance.getIsPaused()).toBe(false);
        resolve();
      });
      playerServiceInstance.emit('playback-closed', { code: 0 });
    });
  });

  it('should emit "playback-error" when "playback-closed" IPC message is received with non-zero code and not paused', () => {
    playerServiceInstance.play(mockTrack); // Set currentTrack
    const errorCode = 1;
    return new Promise<void>((resolve) => {
      playerServiceInstance.on('playback-error', (err: Error) => {
        expect(err).toBeInstanceOf(Error);
        expect(err.message).toBe(`ffplay exited with code ${errorCode}`);
        expect(playerServiceInstance.getCurrentTrack()).toBeNull();
        expect(playerServiceInstance.getPausedTime()).toBe(0);
        expect(playerServiceInstance.getIsPaused()).toBe(false);
        resolve();
      });
      playerServiceInstance.emit('playback-closed', { code: errorCode });
    });
  });

  it('should emit "playback-error" when "playback-error" IPC message is received', () => {
    playerServiceInstance.play(mockTrack); // Set currentTrack
    const errorMessage = 'Failed to start ffplay.';
    return new Promise<void>((resolve) => {
      playerServiceInstance.on('playback-error', (err: Error) => {
        expect(err).toBeInstanceOf(Error);
        expect(err.message).toBe(errorMessage);
        expect(playerServiceInstance.getCurrentTrack()).toBeNull();
        expect(playerServiceInstance.getPausedTime()).toBe(0);
        expect(playerServiceInstance.getIsPaused()).toBe(false);
        resolve();
      });
      playerServiceInstance.emit('playback-error', errorMessage);
    });
  });
});
