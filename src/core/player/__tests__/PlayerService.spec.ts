// src/core/player/__tests__/PlayerService.spec.ts

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import { PlayerService } from '../PlayerService';
import type { Track } from '$types';

// --- Mocks ---
// 模拟 'child_process' 模块
vi.mock('child_process');

// --- Mock 数据 ---
const mockTrack: Track = {
  id: 1,
  path: '/path/to/music.mp3',
  title: 'A Great Song',
  artist: 'The Mockers',
  album: 'Test Suite Hits',
  duration: 180,
};

// --- 辅助函数 ---
/**
 * 定义一个可控模拟进程的类型，只包含 PlayerService 实际使用的属性和方法。
 */
type ControllableMockProcess = {
  stdin: {
    write: vi.Mock<any[], any>;
  };
  stderr: {
    on: vi.Mock<any[], any>;
  };
  on: vi.Mock<any[], any>;
  kill: vi.Mock<any[], any>;

  // 用于在测试中触发事件的自定义方法
  triggerStderr: (data: string) => void;
  triggerClose: (code: number | null) => void;
  triggerError: (error: Error) => void;
};

/**
 * 创建一个可从外部控制的模拟子进程对象。
 * @returns {ControllableMockProcess} 一个符合我们定义的、类型安全的对象。
 */
const createMockProcess = (): ControllableMockProcess => {
  const eventListeners = new Map<string, (...args: any[]) => void>();
  const stderrListeners = new Map<string, (chunk: Buffer) => void>();

  return {
    stdin: { write: vi.fn() },
    stderr: {
      on: vi.fn((event: string, listener: (chunk: Buffer) => void) => {
        stderrListeners.set(event, listener);
      }),
    },
    on: vi.fn((event: string, listener: (...args: any[]) => void) => {
      eventListeners.set(event, listener);
    }),
    kill: vi.fn(),
    triggerStderr: (data: string) => {
      stderrListeners.get('data')?.(Buffer.from(data));
    },
    triggerClose: (code: number | null) => {
      eventListeners.get('close')?.(code);
    },
    triggerError: (error: Error) => {
      eventListeners.get('error')?.(error);
    },
  };
};

// --- Test Suite ---
describe('PlayerService Unit Tests', () => {
  let playerService: PlayerService;
  let mockProcess: ControllableMockProcess;

  // 捕获 spawn 函数的 mock 实例
  const mockedSpawn = vi.mocked(spawn);

  beforeEach(() => {
    playerService = new PlayerService();
    mockProcess = createMockProcess();
    
    // 模拟 spawn 返回我们的可控 mock 进程
    // 使用类型断言是合理的，因为我们确保 mock 对象满足 PlayerService 在运行时所需的所有接口。
    mockedSpawn.mockReturnValue(mockProcess as unknown as ChildProcessWithoutNullStreams);

    // 监控 console.error，以便验证错误日志，同时保持测试输出干净
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    // 清理所有 mocks 和 spies，确保测试之间完全独立
    vi.restoreAllMocks();
  });

  // ===================================
  // ===      成功场景 (Success Scenarios)      ===
  // ===================================

  describe('play()', () => {
    it('should spawn ffplay with correct arguments and emit "playback-started"', () => {
      // 安排 (Arrange)
      const startedSpy = vi.fn();
      playerService.on('playback-started', startedSpy);

      // 行动 (Act)
      playerService.play(mockTrack);

      // 断言 (Assert)
      expect(mockedSpawn).toHaveBeenCalledTimes(1);
      expect(mockedSpawn).toHaveBeenCalledWith('ffplay', [
        '-i', mockTrack.path,
        '-nodisp', '-autoexit', '-loglevel', 'error',
        '-af', 'volume=1.0'
      ]);

      expect(startedSpy).toHaveBeenCalledTimes(1);
      expect(startedSpy).toHaveBeenCalledWith(mockTrack);
      expect(playerService.getCurrentTrack()).toEqual(mockTrack);
      expect(playerService.getIsPaused()).toBe(false);
    });

    it('should spawn ffplay with -ss argument when startTime is provided', () => {
      // 安排 (Arrange)
      const startTime = 30;

      // 行动 (Act)
      playerService.play(mockTrack, startTime);

      // 断言 (Assert)
      expect(mockedSpawn).toHaveBeenCalledWith('ffplay', [
        '-ss', String(startTime),
        '-i', mockTrack.path,
        '-nodisp', '-autoexit', '-loglevel', 'error',
        '-af', 'volume=1.0'
      ]);
    });

    it('should stop any existing playback before starting a new track', () => {
      // 安排 (Arrange)
      const newTrack = { ...mockTrack, id: 2, path: '/path/to/another.flac' };
      
      playerService.play(mockTrack); // 第一次播放
      const firstProcessKillSpy = mockProcess.kill;

      const secondMockProcess = createMockProcess();
      mockedSpawn.mockReturnValue(secondMockProcess as unknown as ChildProcessWithoutNullStreams);

      // 行动 (Act)
      playerService.play(newTrack); // 第二次播放

      // 断言 (Assert)
      expect(firstProcessKillSpy).toHaveBeenCalledTimes(1); // 第一次播放的进程被 kill
      expect(mockedSpawn).toHaveBeenCalledTimes(2); // spawn 被调用了两次
      expect(playerService.getCurrentTrack()).toEqual(newTrack);
    });
  });

  // ===================================
  // ===  边界与边缘情况 (Edge & Boundary Cases)  ===
  // ===================================

  describe('stop()', () => {
    it('should kill the process and reset all state when a track is playing', () => {
      // 安排 (Arrange)
      playerService.play(mockTrack);

      // 行动 (Act)
      playerService.stop();

      // 断言 (Assert)
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGKILL');
      expect(playerService.getCurrentTrack()).toBeNull();
      expect(playerService.getPausedTime()).toBe(0);
      expect(playerService.getIsPaused()).toBe(false);
    });

    it('should do nothing if no track is playing', () => {
      // 安排 (Arrange) - 默认状态下没有播放
      
      // 行动 (Act)
      playerService.stop();

      // 断言 (Assert)
      expect(mockProcess.kill).not.toHaveBeenCalled();
    });
  });

  describe('pause()', () => {
    it('should write "p" to stdin, update state, and emit "playback-paused" when playing', () => {
      // 安排 (Arrange)
      const pausedSpy = vi.fn();
      playerService.on('playback-paused', pausedSpy);
      playerService.play(mockTrack);
      mockProcess.triggerStderr('50.1 M-A: ...'); // 模拟进度更新以设置 pausedTime

      // 行动 (Act)
      playerService.pause();

      // 断言 (Assert)
      expect(mockProcess.stdin.write).toHaveBeenCalledWith('p');
      expect(playerService.getIsPaused()).toBe(true);
      expect(pausedSpy).toHaveBeenCalledWith({ currentTime: 50.1 });
    });

    it('should do nothing if not playing', () => {
        // 安排 (Arrange) - 默认状态下没有播放
        
        // 行动 (Act)
        playerService.pause();

        // 断言 (Assert)
        expect(mockProcess.stdin.write).not.toHaveBeenCalled();
    });
  });

  describe('resume()', () => {
    it('should write "p" to stdin and emit "playback-resumed" if currently paused', () => {
      // 安排 (Arrange)
      const resumedSpy = vi.fn();
      playerService.on('playback-resumed', resumedSpy);
      playerService.play(mockTrack);
      mockProcess.triggerStderr('35.0 M-A: ...'); // 模拟进度更新
      playerService.pause(); // 进入暂停状态

      // 行动 (Act)
      playerService.resume();

      // 断言 (Assert)
      expect(mockProcess.stdin.write).toHaveBeenCalledWith('p');
      expect(playerService.getIsPaused()).toBe(false);
      expect(resumedSpy).toHaveBeenCalledWith({ currentTime: 35.0 });
    });

  });

  // ===================================
  // === 失败与错误处理 (Failure & Error Handling) ===
  // ===================================

  describe('Event Handling', () => {
    it('should emit "playback-progress" on receiving stderr time data', () => {
      // 安排 (Arrange)
      const progressSpy = vi.fn();
      playerService.on('playback-progress', progressSpy);
      playerService.play(mockTrack);

      // 行动 (Act)
      mockProcess.triggerStderr('4.5 M-A:   0.000 fd=   0 aq=    0KB vq=    0KB sq=    0B f=0/0   \r');
      
      // 断言 (Assert)
      expect(progressSpy).toHaveBeenCalledWith({ currentTime: 4.5, duration: mockTrack.duration });
      expect(playerService.getPausedTime()).toBe(4.5);
    });

    it('should emit "playback-ended" and reset state when process closes with code 0', () => {
      // 安排 (Arrange)
      const endedSpy = vi.fn();
      playerService.on('playback-ended', endedSpy);
      playerService.play(mockTrack);

      // 行动 (Act)
      mockProcess.triggerClose(0);

      // 断言 (Assert)
      expect(endedSpy).toHaveBeenCalledTimes(1);
      expect(playerService.getCurrentTrack()).toBeNull();
      expect(playerService.getIsPaused()).toBe(false);
    });

    it('should emit "playback-error" when process closes with a non-zero code', () => {
      // 安排 (Arrange)
      const errorSpy = vi.fn();
      playerService.on('playback-error', errorSpy);
      playerService.play(mockTrack);

      // 行动 (Act)
      mockProcess.triggerClose(1);

      // 断言 (Assert)
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledWith(expect.any(Error));
      expect(errorSpy.mock.calls[0][0].message).toContain('ffplay exited with code 1');
      expect(playerService.getCurrentTrack()).toBeNull();
    });

    it('should emit "playback-error" when process emits an error event', () => {
      // 安排 (Arrange)
      const errorSpy = vi.fn();
      const spawnError = new Error('ffplay not found in PATH');
      playerService.on('playback-error', errorSpy);
      playerService.play(mockTrack);

      // 行动 (Act)
      mockProcess.triggerError(spawnError);
      
      // 断言 (Assert)
      expect(errorSpy).toHaveBeenCalledWith(expect.any(Error));
      expect(errorSpy.mock.calls[0][0].message).toContain(`Failed to start ffplay: ${spawnError.message}`);
    });
  });

  describe('on() method', () => {
    it('should register a listener that can be triggered', () => {
      // 安排 (Arrange)
      const myCustomListener = vi.fn();
      playerService.on('playback-started', myCustomListener);

      // 行动 (Act)
      playerService.play(mockTrack);

      // 断言 (Assert)
      expect(myCustomListener).toHaveBeenCalledTimes(1);
      expect(myCustomListener).toHaveBeenCalledWith(mockTrack);
    });
  });
});
