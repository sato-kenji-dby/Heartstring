// src/services/__tests__/libraryScanner.spec.ts

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'path';

// --- Mocks ---
// 模拟 'fs/promises' 模块
vi.mock('fs/promises', async (importOriginal) => {
  const original = await importOriginal<typeof import('fs/promises')>();
  return {
    ...original,
    readdir: vi.fn(), // 我们只模拟 readdir
  };
});

// 模拟 'music-metadata' 模块。
// 由于它在函数内部通过 await import() 加载，Vitest 的顶层 mock 依然能正确拦截。
vi.mock('music-metadata', () => ({
  parseFile: vi.fn(),
}));

// 动态导入被 mock 的模块，以便我们访问它们的 mock 函数
let fs: any;
let mm: any;

// 导入被测试的函数
import { scanDirectory } from '../LibraryService';

// --- Test Suite ---
describe('scanDirectory Unit Tests', () => {
  beforeEach(async () => {
    // 在每个测试前，获取已 mock 的模块实例
    fs = await import('fs/promises');
    mm = await import('music-metadata');
    // 监控 console.error，以便验证错误日志，同时保持测试输出干净
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    // 清理所有 mocks 和 spies，确保测试之间完全独立
    vi.restoreAllMocks();
  });

  // --- 辅助函数 ---
  // 创建模拟 Dirent 对象的辅助函数，以匹配 fs.readdir({ withFileTypes: true }) 的返回类型
  const createDirent = (name: string, type: 'dir' | 'file') => ({
    name,
    isDirectory: () => type === 'dir',
    isFile: () => type === 'file',
  });

  // 模拟元数据
  const mockMetadata = (title: string, overrides: object = {}) => ({
    common: {
      title,
      artist: 'Mock Artist',
      album: 'Mock Album',
      ...overrides,
    },
    format: { duration: 180 },
  });

  // ===================================
  // ===      成功场景 (Success Scenarios)      ===
  // ===================================

  it('should scan a flat directory, process supported files, and ignore unsupported ones', async () => {
    const fakeDir = '/music';
    const entries = [
      createDirent('song.mp3', 'file'),
      createDirent('track.flac', 'file'),
      createDirent('audio.WAV', 'file'), // 测试大小写不敏感
      createDirent('sound.M4A', 'file'),
      createDirent('cover.jpg', 'file'), // 不支持的文件
      createDirent('notes.txt', 'file'), // 不支持的文件
    ];

    // 安排 (Arrange)
    fs.readdir.mockResolvedValue(entries);
    mm.parseFile.mockImplementation((filePath: string) =>
      Promise.resolve(mockMetadata(`Title for ${path.basename(filePath)}`))
    );

    // 行动 (Act)
    const tracks = await scanDirectory(fakeDir);

    // 断言 (Assert)
    expect(fs.readdir).toHaveBeenCalledWith(fakeDir, { withFileTypes: true });
    expect(tracks).toHaveLength(4);
    expect(mm.parseFile).toHaveBeenCalledTimes(4);
    expect(tracks[0].title).toBe('Title for song.mp3');
  });

  it('should recursively scan a multi-level directory structure', async () => {
    const rootDir = '/library';
    const rockDir = path.join(rootDir, 'Rock');
    const popDir = path.join(rootDir, 'Pop');

    // 安排 (Arrange)
    fs.readdir.mockImplementation(async (dirPath: string) => {
      if (dirPath === rootDir) {
        return [
          createDirent('song1.mp3', 'file'),
          createDirent('Rock', 'dir'),
          createDirent('Pop', 'dir'),
        ];
      }
      if (dirPath === rockDir) {
        return [createDirent('song2.flac', 'file')];
      }
      if (dirPath === popDir) {
        return [createDirent('song3.wav', 'file')];
      }
      return [];
    });

    mm.parseFile.mockResolvedValue(mockMetadata('A Great Song'));

    // 行动 (Act)
    const tracks = await scanDirectory(rootDir);

    // 断言 (Assert)
    expect(tracks).toHaveLength(3);
    expect(fs.readdir).toHaveBeenCalledWith(rootDir, { withFileTypes: true });
    expect(fs.readdir).toHaveBeenCalledWith(rockDir, { withFileTypes: true });
    expect(fs.readdir).toHaveBeenCalledWith(popDir, { withFileTypes: true });
    expect(mm.parseFile).toHaveBeenCalledWith(path.join(rootDir, 'song1.mp3'));
    expect(mm.parseFile).toHaveBeenCalledWith(path.join(rockDir, 'song2.flac'));
    expect(mm.parseFile).toHaveBeenCalledWith(path.join(popDir, 'song3.wav'));
  });

  it('should handle missing metadata tags by using fallback values', async () => {
    const fakeDir = '/music/partial';
    fs.readdir.mockResolvedValue([createDirent('song.mp3', 'file')]);
    mm.parseFile.mockResolvedValue({
      // 模拟一个只有部分标签的元数据对象
      common: { artist: 'Just an Artist' },
      format: { duration: 123 },
    });

    const tracks = await scanDirectory(fakeDir);

    expect(tracks).toHaveLength(1);
    expect(tracks[0].title).toBe('song.mp3'); // 回退到文件名
    expect(tracks[0].artist).toBe('Just an Artist');
    expect(tracks[0].album).toBe('Unknown Album'); // 回退到默认值
    expect(tracks[0].duration).toBe(123);
  });

  // ===================================
  // ===  边界与边缘情况 (Edge & Boundary Cases)  ===
  // ===================================

  it('should return an empty array for an empty directory', async () => {
    const fakeDir = '/empty';
    fs.readdir.mockResolvedValue([]);

    const tracks = await scanDirectory(fakeDir);

    expect(tracks).toEqual([]);
    expect(mm.parseFile).not.toHaveBeenCalled();
  });

  it('should return an empty array for a directory with only unsupported files', async () => {
    const fakeDir = '/no-music';
    fs.readdir.mockResolvedValue([
      createDirent('image.png', 'file'),
      createDirent('document.pdf', 'file'),
    ]);

    const tracks = await scanDirectory(fakeDir);

    expect(tracks).toEqual([]);
    expect(mm.parseFile).not.toHaveBeenCalled();
  });

  it('should return an empty array for a directory with only empty subdirectories', async () => {
    const fakeDir = '/folders';
    const subDir = path.join(fakeDir, 'empty_subdir');

    fs.readdir.mockImplementation(async (dirPath: string) => {
      if (dirPath === fakeDir) return [createDirent('empty_subdir', 'dir')];
      if (dirPath === subDir) return []; // 子目录是空的
      return [];
    });

    const tracks = await scanDirectory(fakeDir);

    expect(tracks).toEqual([]);
    expect(mm.parseFile).not.toHaveBeenCalled();
  });

  it('should handle deeply nested directories correctly', async () => {
    const L1 = '/L1';
    const L2 = path.join(L1, 'L2');
    const L3 = path.join(L2, 'L3');

    fs.readdir.mockImplementation(async (p: string) => {
      if (p === L1) return [createDirent('L2', 'dir')];
      if (p === L2) return [createDirent('L3', 'dir')];
      if (p === L3) return [createDirent('deep-song.m4a', 'file')];
      return [];
    });

    mm.parseFile.mockResolvedValue(mockMetadata('Deep Song'));

    const tracks = await scanDirectory(L1);

    expect(tracks).toHaveLength(1);
    expect(tracks[0].path).toBe(path.join(L3, 'deep-song.m4a'));
  });

  // ===================================
  // === 失败与错误处理 (Failure & Error Handling) ===
  // ===================================

  it('should return an empty array and log error if the root directory cannot be read', async () => {
    const fakeDir = '/non-existent';
    const error = new Error('ENOENT: no such file or directory');
    fs.readdir.mockRejectedValue(error);

    const tracks = await scanDirectory(fakeDir);

    expect(tracks).toEqual([]);
    expect(console.error).toHaveBeenCalledWith(
      `Error reading directory ${fakeDir}:`,
      error
    );
  });

  it('should skip a file and log error if metadata parsing fails', async () => {
    const fakeDir = '/corrupted';
    const badFile = path.join(fakeDir, 'bad.flac');
    const parseError = new Error('Corrupted metadata');

    fs.readdir.mockResolvedValue([
      createDirent('good.mp3', 'file'),
      createDirent('bad.flac', 'file'),
    ]);

    mm.parseFile.mockImplementation(async (filePath: string) => {
      if (filePath === badFile) throw parseError;
      return mockMetadata('Good Song');
    });

    const tracks = await scanDirectory(fakeDir);

    expect(tracks).toHaveLength(1);
    expect(tracks[0].title).toBe('Good Song');
    expect(console.error).toHaveBeenCalledWith(
      `Error reading metadata for ${badFile}:`,
      parseError
    );
  });

  it('should skip a subdirectory and log error if it cannot be read, but continue with others', async () => {
    const rootDir = '/mixed-permissions';
    const goodDir = path.join(rootDir, 'good');
    const badDir = path.join(rootDir, 'bad');
    const accessError = new Error('EACCES: permission denied');

    fs.readdir.mockImplementation(async (dirPath: string) => {
      if (dirPath === rootDir)
        return [
          createDirent('root.mp3', 'file'),
          createDirent('good', 'dir'),
          createDirent('bad', 'dir'),
        ];
      if (dirPath === goodDir) return [createDirent('good-song.wav', 'file')];
      if (dirPath === badDir) throw accessError; // 此目录读取失败
      return [];
    });

    mm.parseFile.mockResolvedValue(mockMetadata('A Song'));

    const tracks = await scanDirectory(rootDir);

    expect(tracks).toHaveLength(2); // root.mp3 和 good-song.wav
    expect(mm.parseFile).toHaveBeenCalledTimes(2);
    expect(console.error).toHaveBeenCalledWith(
      `Error reading directory ${badDir}:`,
      accessError
    );
  });
});
