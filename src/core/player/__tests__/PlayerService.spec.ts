import { describe, it, expect, vi, beforeEach } from 'vitest';
import { type Track } from '$types';
import { PlayerService } from '../PlayerService';
import { spawn } from 'child_process'; // 导入 spawn

// 模拟 child_process 模块
vi.mock('child_process', () => {
  const mockStderrOn = vi.fn();
  const mockProcessOn = vi.fn();
  const mockKill = vi.fn();
  const mockStdinWrite = vi.fn();

  const mockSpawnImplementation = vi.fn(() => ({
    stderr: {
      on: mockStderrOn,
    },
    on: mockProcessOn,
    kill: mockKill,
    stdin: {
      write: mockStdinWrite,
    },
  }));

  return {
    spawn: mockSpawnImplementation, // 直接返回模拟的实现
  };
});

describe('PlayerService', () => {
  let playerServiceInstance: PlayerService;
  const mockTrack: Track = {
    id: 1,
    title: 'Test Song',
    artist: 'Test Artist',
    album: 'Test Album',
    path: '/path/to/test/audio.mp3',
    duration: 120,
  };

  // 辅助函数：触发模拟的 ffplay stderr 事件
  const triggerStderr = (data: string) => {
    const stderrOnCallback = (spawn as ReturnType<typeof vi.fn>).mock.results[0].value.stderr.on.mock.calls.find(
      (call: any[]) => call[0] === 'data'
    )?.[1];
    if (stderrOnCallback) {
      stderrOnCallback(Buffer.from(data));
    }
  };

  // 辅助函数：触发模拟的 ffplay close 事件
  const triggerClose = (code: number | null, playerService: PlayerService) => {
    const closeOnCallback = (spawn as ReturnType<typeof vi.fn>).mock.results[0].value.on.mock.calls.find(
      (call: any[]) => call[0] === 'close'
    )?.[1];
    if (closeOnCallback) {
      closeOnCallback(code);
      // 模拟 PlayerService 内部的 ffplayProcess 被设置为 null
      // @ts-ignore
      playerService.ffplayProcess = null; 
    }
  };

  // 辅助函数：触发模拟的 ffplay error 事件
  const triggerError = (error: Error) => {
    const errorOnCallback = (spawn as ReturnType<typeof vi.fn>).mock.results[0].value.on.mock.calls.find(
      (call: any[]) => call[0] === 'error'
    )?.[1];
    if (errorOnCallback) {
      errorOnCallback(error);
    }
  };

  beforeEach(() => {
    vi.clearAllMocks(); // 清除所有模拟的调用历史和状态
    playerServiceInstance = new PlayerService();
  });

  it('should spawn ffplay process and emit "playback-started" when play() is called', () => {
    const startedSpy = vi.fn();
    playerServiceInstance.on('playback-started', startedSpy);

    playerServiceInstance.play(mockTrack);

    expect(spawn).toHaveBeenCalledWith('ffplay', ['-i', mockTrack.path, '-nodisp', '-autoexit', '-loglevel', 'error', '-af', 'volume=1.0']);
    expect(playerServiceInstance.getCurrentTrack()).toEqual(mockTrack);
    expect(playerServiceInstance.getIsPaused()).toBe(false);
    expect(startedSpy).toHaveBeenCalledWith(mockTrack);
  });

  it('should spawn ffplay process with startTime when play() is called with startTime', () => {
    const startTime = 30;
    playerServiceInstance.play(mockTrack, startTime);
    expect(spawn).toHaveBeenCalledWith('ffplay', ['-ss', startTime.toString(), '-i', mockTrack.path, '-nodisp', '-autoexit', '-loglevel', 'error', '-af', 'volume=1.0']);
  });

  it('should kill ffplay process and reset state when stop() is called', () => {
    playerServiceInstance.play(mockTrack); // Start a process
    const mockProcess = (spawn as ReturnType<typeof vi.fn>).mock.results[0].value;

    playerServiceInstance.stop();

    expect(mockProcess.kill).toHaveBeenCalledWith('SIGKILL');
    expect(playerServiceInstance.getCurrentTrack()).toBeNull();
    expect(playerServiceInstance.getPausedTime()).toBe(0);
    expect(playerServiceInstance.getIsPaused()).toBe(false);
  });

  it('should send "p" to stdin and emit "playback-paused" when pause() is called', () => {
    playerServiceInstance.play(mockTrack); // Start a process
    const mockProcess = (spawn as ReturnType<typeof vi.fn>).mock.results[0].value;
    const pausedSpy = vi.fn();
    playerServiceInstance.on('playback-paused', pausedSpy);

    // Simulate some progress to set pausedTime
    triggerStderr('50.0 M-A:   0.000 fd=   0 aq=    0KB vq=    0KB sq=    0B f=0/0   \r');

    playerServiceInstance.pause();

    expect(mockProcess.stdin.write).toHaveBeenCalledWith('p');
    expect(playerServiceInstance.getIsPaused()).toBe(true);
    expect(pausedSpy).toHaveBeenCalledWith({ currentTime: 50 });
  });

  it('should send "p" to stdin and emit "playback-resumed" when resume() is called and paused', () => {
    playerServiceInstance.play(mockTrack); // Start a process
    const mockProcess = (spawn as ReturnType<typeof vi.fn>).mock.results[0].value;
    const resumedSpy = vi.fn();
    playerServiceInstance.on('playback-resumed', resumedSpy);

    // Simulate pause
    playerServiceInstance.pause();
    vi.clearAllMocks(); // Clear previous stdin.write call

    playerServiceInstance.resume();

    expect(mockProcess.stdin.write).toHaveBeenCalledWith('p');
    expect(playerServiceInstance.getIsPaused()).toBe(false);
    expect(resumedSpy).toHaveBeenCalledWith({ currentTime: 0 }); // pausedTime is 0 initially
  });

  it('should restart playback from pausedTime when resume() is called and process is not active', () => {
    playerServiceInstance.play(mockTrack); // Start a process
    const mockProcess = (spawn as ReturnType<typeof vi.fn>).mock.results[0].value;
    
    // Simulate some progress and then process close (e.g., manual kill or error)
    triggerStderr('50.0 M-A:   0.000 fd=   0 aq=    0KB vq=    0KB sq=    0B f=0/0   \r');
    triggerClose(null, playerServiceInstance); // Simulate process killed without explicit pause

    const resumedSpy = vi.fn();
    playerServiceInstance.on('playback-resumed', resumedSpy);

    (spawn as ReturnType<typeof vi.fn>).mockClear(); // 清除 spawn 的调用历史

    playerServiceInstance.resume();

    expect(spawn).toHaveBeenCalledWith('ffplay', ['-ss', '50', '-i', mockTrack.path, '-nodisp', '-autoexit', '-loglevel', 'error', '-af', 'volume=1.0']);
    expect(resumedSpy).toHaveBeenCalledWith({ currentTime: 50 });
  });

  it('should emit "playback-progress" when ffplay stderr data is received', () => {
    const progressSpy = vi.fn();
    playerServiceInstance.on('playback-progress', progressSpy);
    playerServiceInstance.play(mockTrack); // Set currentTrack for duration

    triggerStderr('4.5 M-A:   0.000 fd=   0 aq=    0KB vq=    0KB sq=    0B f=0/0   \r');

    expect(progressSpy).toHaveBeenCalledWith({ currentTime: 4.5, duration: mockTrack.duration });
    expect(playerServiceInstance.getPausedTime()).toBe(4.5);
  });

  it('should emit "playback-ended" when ffplay process closes with code 0', () => {
    const endedSpy = vi.fn();
    playerServiceInstance.on('playback-ended', endedSpy);
    playerServiceInstance.play(mockTrack); // Set currentTrack

    triggerClose(0, playerServiceInstance);

    expect(endedSpy).toHaveBeenCalled();
    expect(playerServiceInstance.getCurrentTrack()).toBeNull();
    expect(playerServiceInstance.getPausedTime()).toBe(0);
    expect(playerServiceInstance.getIsPaused()).toBe(false);
  });

  it('should emit "playback-error" when ffplay process closes with non-zero code and not paused', () => {
    const errorSpy = vi.fn();
    playerServiceInstance.on('playback-error', errorSpy);
    playerServiceInstance.play(mockTrack); // Set currentTrack

    triggerClose(1, playerServiceInstance);

    expect(errorSpy).toHaveBeenCalledWith(expect.any(Error));
    expect(errorSpy.mock.calls[0][0].message).toBe('ffplay exited with code 1');
    expect(playerServiceInstance.getCurrentTrack()).toBeNull();
    expect(playerServiceInstance.getPausedTime()).toBe(0);
    expect(playerServiceInstance.getIsPaused()).toBe(false);
  });

  it('should emit "playback-error" when ffplay process emits an error', () => {
    const errorSpy = vi.fn();
    playerServiceInstance.on('playback-error', errorSpy);
    playerServiceInstance.play(mockTrack); // Set currentTrack

    const mockError = new Error('Failed to find ffplay executable.');
    triggerError(mockError);

    expect(errorSpy).toHaveBeenCalledWith(expect.any(Error));
    expect(errorSpy.mock.calls[0][0].message).toBe(`Failed to start ffplay: ${mockError.message}`);
    expect(playerServiceInstance.getCurrentTrack()).toBeNull();
    expect(playerServiceInstance.getPausedTime()).toBe(0);
    expect(playerServiceInstance.getIsPaused()).toBe(false);
  });
});
