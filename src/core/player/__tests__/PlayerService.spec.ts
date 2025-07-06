import { describe, it, expect, vi, beforeEach } from 'vitest';
import { type Track } from '$types'; // 使用别名
import { PlayerService } from '../PlayerService'; // 导入真实的 PlayerService
describe('PlayerService', () => {
  let playerServiceInstance: PlayerService; // 使用真实的 PlayerService 类型
  let mockIpcRenderer: {
    send: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
    off: ReturnType<typeof vi.fn>;
  };
  // 用于存储 ipcRenderer.on 注册的监听器
  const ipcListeners: { [channel: string]: Function[] } = {};

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
    // 重置 ipcListeners
    for (const channel in ipcListeners) {
      delete ipcListeners[channel];
    }

    mockIpcRenderer = {
      send: vi.fn(),
      on: vi.fn((channel, listener) => {
        if (!ipcListeners[channel]) {
          ipcListeners[channel] = [];
        }
        ipcListeners[channel].push(listener);
      }),
      off: vi.fn((channel, listener) => {
        if (ipcListeners[channel]) {
          ipcListeners[channel] = ipcListeners[channel].filter(l => l !== listener);
        }
      }),
    };
    playerServiceInstance = new PlayerService(mockIpcRenderer); // 实例化真实的 PlayerService 并注入模拟的 ipcRenderer
  });

  it('should send "play-track" IPC message when play() is called', () => {
    playerServiceInstance.play(mockTrack);
    expect(mockIpcRenderer.send).toHaveBeenCalledWith('play-track', { filePath: mockTrack.path, startTime: 0 });
    expect(playerServiceInstance.getCurrentTrack()).toEqual(mockTrack);
    expect(playerServiceInstance.getIsPaused()).toBe(false);
  });

  it('should send "play-track" IPC message with startTime when resuming', () => {
    playerServiceInstance.play(mockTrack, 30);
    expect(mockIpcRenderer.send).toHaveBeenCalledWith('play-track', { filePath: mockTrack.path, startTime: 30 });
  });

  it('should send "stop-playback" IPC message when stop() is called', () => {
    playerServiceInstance.stop();
    expect(mockIpcRenderer.send).toHaveBeenCalledWith('stop-playback');
    expect(playerServiceInstance.getCurrentTrack()).toBeNull();
    expect(playerServiceInstance.getPausedTime()).toBe(0);
    expect(playerServiceInstance.getIsPaused()).toBe(false);
  });

  it('should send "pause-playback" IPC message when pause() is called', () => {
    playerServiceInstance.play(mockTrack); // Simulate playing a track
    playerServiceInstance.pause();
    expect(mockIpcRenderer.send).toHaveBeenCalledWith('pause-playback');
    expect(playerServiceInstance.getIsPaused()).toBe(true);
  });

  it('should call play with pausedTime when resume() is called', () => {
    playerServiceInstance.play(mockTrack); // Simulate playing
    // Manually set pausedTime for testing resume
    // In a real scenario, this would be updated by 'ffplay-stderr'
    // 真实的 PlayerService 会通过 ipcRenderer.on 接收到 ffplay-stderr 消息来更新 pausedTime
    // 这里我们直接模拟 ipcRenderer.on 触发 ffplay-stderr 事件
    const event = {} as Electron.IpcRendererEvent; // 模拟事件对象
    const ffplayStderrListener = ipcListeners['ffplay-stderr'][0];
    ffplayStderrListener(event, '50.0 M-A:   0.000 fd=   0 aq=    0KB vq=    0KB sq=    0B f=0/0   \r');

    playerServiceInstance.pause(); // This will set isPaused to true and send pause-playback
    mockIpcRenderer.send.mockClear(); // Clear previous send calls

    playerServiceInstance.resume();
    expect(mockIpcRenderer.send).toHaveBeenCalledWith('play-track', { filePath: mockTrack.path, startTime: 50 });
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
      // 触发 ipcRenderer.on 注册的 'ffplay-stderr' 监听器
      const event = {} as Electron.IpcRendererEvent; // 模拟事件对象
      const ffplayStderrListener = ipcListeners['ffplay-stderr'][0];
      ffplayStderrListener(event, mockData);
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
      // 触发 ipcRenderer.on 注册的 'playback-closed' 监听器
      const event = {} as Electron.IpcRendererEvent; // 模拟事件对象
      const playbackClosedListener = ipcListeners['playback-closed'][0];
      playbackClosedListener(event, { code: 0 });
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
      // 触发 ipcRenderer.on 注册的 'playback-closed' 监听器
      const event = {} as Electron.IpcRendererEvent; // 模拟事件对象
      const playbackClosedListener = ipcListeners['playback-closed'][0];
      playbackClosedListener(event, { code: errorCode });
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
      // 触发 ipcRenderer.on 注册的 'playback-error' 监听器
      const event = {} as Electron.IpcRendererEvent; // 模拟事件对象
      const playbackErrorListener = ipcListeners['playback-error'][0];
      playbackErrorListener(event, errorMessage);
    });
  });
});
