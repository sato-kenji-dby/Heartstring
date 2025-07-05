import { describe, it, expect, vi, beforeEach, type MockInstance } from 'vitest';
import { playerService } from '../playerService';
import { EventEmitter } from 'events';
import type { ChildProcessWithoutNullStreams } from 'child_process';

// Mock child_process.spawn
const mockProcess = new EventEmitter() as ChildProcessWithoutNullStreams;
mockProcess.kill = vi.fn() as unknown as (signal?: number | NodeJS.Signals | undefined) => boolean; // Explicitly type kill as a MockInstance

vi.mock('child_process', () => ({
  spawn: vi.fn(() => mockProcess) as unknown as MockInstance, // Explicitly type spawn as a MockInstance
}));

// Import the mocked spawn after mocking child_process
import { spawn } from 'child_process';

describe('PlayerService', () => {
  let mockSpawnProcess: ChildProcessWithoutNullStreams;

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
    // Clear all listeners on playerService
    playerService.removeAllListeners(); // 添加此行以清除事件监听器
    // Ensure spawn returns the same mocked process for each test
    mockSpawnProcess = mockProcess; // Directly assign the globally mocked process
    (mockSpawnProcess.kill as unknown as MockInstance).mockClear(); // Clear kill mock calls, cast to MockInstance
  });

  it('should call spawn with correct arguments when play() is called', () => {
    const filePath = '/path/to/audio.mp3';
    playerService.play(filePath);

    expect(spawn).toHaveBeenCalledWith('ffplay', ['-nodisp', '-autoexit', '-i', filePath]);
  });

  it('should call kill() on the process when stop() is called', () => {
    const filePath = '/path/to/audio.mp3';
    playerService.play(filePath); // Start a process
    playerService.stop();

    expect(mockSpawnProcess.kill).toHaveBeenCalledWith('SIGKILL');
  });

  it('should emit "playback-error" when the spawned process emits an "error" event', () => {
    const filePath = '/path/to/audio.mp3';
    const mockError = new Error('Test playback error');

    playerService.play(filePath);

    return new Promise<void>((resolve) => {
      playerService.on('playback-error', (err) => {
        expect(err).toBeInstanceOf(Error);
        expect((err as Error).message).toBe(mockError.message);
        resolve();
      });
      mockSpawnProcess.emit('error', mockError);
    });
  });

  it('should emit "playback-ended" when the spawned process "close"s with code 0', () => {
    const filePath = '/path/to/audio.mp3';

    playerService.play(filePath);

    return new Promise<void>((resolve) => {
      playerService.on('playback-ended', () => {
        resolve();
      });
      mockSpawnProcess.emit('close', 0);
    });
  });

  it('should emit "playback-error" when the spawned process "close"s with a non-zero code', () => {
    const filePath = '/path/to/audio.mp3';
    const errorCode = 1;

    playerService.play(filePath);

    return new Promise<void>((resolve) => {
      playerService.on('playback-error', (err) => {
        expect(err).toBeInstanceOf(Error);
        expect((err as Error).message).toBe(`ffplay exited with code ${errorCode}`);
        resolve();
      });
      mockSpawnProcess.emit('close', errorCode);
    });
  });

  it('should stop any existing process before starting a new one', () => {
    const filePath1 = '/path/to/audio1.mp3';
    const filePath2 = '/path/to/audio2.mp3';

    playerService.play(filePath1);
    const firstProcess = mockSpawnProcess; // Capture the first mocked process

    playerService.play(filePath2); // This should stop the first process

    expect(firstProcess.kill).toHaveBeenCalledWith('SIGKILL');
    expect(spawn).toHaveBeenCalledTimes(2); // spawn should be called twice
  });
});
