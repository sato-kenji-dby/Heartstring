import { describe, it, expect, vi, beforeEach } from 'vitest';
import { type Track } from '../stores/playerStore';
import { PlayerService } from '../playerService'; // 导入 PlayerService 类

// Mock Electron's ipcRenderer
const mockIpcRendererSend = vi.fn();
const mockIpcRendererOff = vi.fn();
const mockIpcRendererListeners: { [key: string]: Function } = {};

// Mock the global window.electron object
// This needs to be outside vi.mock factory to avoid hoisting issues
Object.defineProperty(window, 'electron', {
  value: {
    ipcRenderer: {
      send: mockIpcRendererSend,
      on: (channel: string, listener: Function) => {
        mockIpcRendererListeners[channel] = listener;
        return { off: mockIpcRendererOff }; // Return a mock for off
      },
      off: mockIpcRendererOff,
    },
  },
  writable: true,
});

vi.mock('../playerService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../playerService')>();
  return {
    ...actual,
    PlayerService: actual.PlayerService, // Ensure the actual class is used
    playerService: new actual.PlayerService(), // Re-instantiate the singleton
  };
});

describe('PlayerService', () => {
  // Re-import playerService after the mock is set up
  // This ensures the singleton is the mocked one
  let playerServiceInstance: PlayerService;

  const mockTrack: Track = {
    id: 1,
    title: 'Test Song',
    artist: 'Test Artist',
    album: 'Test Album',
    path: '/path/to/test/audio.mp3',
    duration: 120,
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    // Dynamically import playerService here to ensure mocks are applied
    const { playerService } = await import('../playerService');
    playerServiceInstance = playerService; // Use the singleton instance
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
      // Manually trigger the IPC listener
      mockIpcRendererListeners['ffplay-stderr'](null, mockData);
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
      mockIpcRendererListeners['playback-closed'](null, { code: 0 });
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
      mockIpcRendererListeners['playback-closed'](null, { code: errorCode });
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
      mockIpcRendererListeners['playback-error'](null, errorMessage);
    });
  });
});
