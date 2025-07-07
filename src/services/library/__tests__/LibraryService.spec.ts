// src/LibraryService.spec.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs'; // We'll mock this
import { parseFile } from 'music-metadata'; // We'll mock this
import { scanDirectory } from '../LibraryService'; // Import the function to test
import { type Track } from '$types'; // Import the Track type

// Mock music-metadata and fs modules
vi.mock('music-metadata', () => ({
  parseFile: vi.fn(),
}));
vi.mock('fs', () => ({
  readdir: vi.fn(),
  stat: vi.fn(),
}));

// Helper function to create mock FileStat objects
const createMockFileStat = (isDirectory: boolean, isFile: boolean = !isDirectory) => ({
  isDirectory: vi.fn().mockReturnValue(isDirectory),
  isFile: vi.fn().mockReturnValue(isFile),
});

// Mock parsed metadata for different file types
const mockMp3Metadata = {
  common: {
    title: 'Mock Song Title',
    artist: ['Mock Artist'],
    album: 'Mock Album',
    duration: 180, // seconds
  },
  format: {
    duration: 180,
  },
};

const mockFlacMetadata = {
  common: {
    title: 'Flac Title',
    artist: ['Flac Artist'],
    album: 'Flac Album',
    duration: 240,
  },
  format: {
    duration: 240,
  },
};

const mockWavMetadata = {
  common: {
    title: 'Wav Tune',
    artist: ['Wav Performer'],
    album: 'Wav Collection',
    duration: 120,
  },
  format: {
    duration: 120,
  },
};

const mockM4aMetadata = {
  common: {
    title: 'M4a Jam',
    artist: ['M4a Maestro'],
    album: 'M4a Archive',
    duration: 300,
  },
  format: {
    duration: 300,
  },
};

// Mock metadata for a file with missing properties
const mockPartialMetadata = {
  common: {
    // title: 'Missing Title', // Missing title
    artist: ['Partial Artist'],
    album: 'Partial Album',
    duration: 150,
  },
  format: {
    duration: 150,
  },
};


describe('scanDirectory', () => {
  let mockReaddir: ReturnType<typeof vi.fn>;
  let mockStat: ReturnType<typeof vi.fn>;
  let mockParseFile: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Reset mocks before each test to ensure isolation
    mockReaddir = vi.mocked(fs.readdir);
    mockStat = vi.mocked(fs.stat);
    mockParseFile = vi.mocked(parseFile);

    // Reset mock implementations
    mockReaddir.mockReset();
    mockStat.mockReset();
    mockParseFile.mockReset();

    // Set default mock implementations that are unlikely to be hit,
    // to catch unexpected calls if any.
    mockReaddir.mockRejectedValue(new Error('readdir not implemented'));
    mockStat.mockRejectedValue(new Error('stat not implemented'));
    mockParseFile.mockRejectedValue(new Error('parseFile not implemented'));
  });

  afterEach(() => {
    vi.restoreAllMocks(); // Restore all mocks after each test
  });

  // --- Success Scenarios ---

  it('should return an empty array for an empty directory', async () => {
    const mockDir = '/fake/empty/dir';
    mockReaddir.mockResolvedValue([]); // No files in the directory

    const tracks = await scanDirectory(mockDir);

    expect(mockReaddir).toHaveBeenCalledWith(mockDir);
    expect(mockStat).not.toHaveBeenCalled(); // No files to stat
    expect(mockParseFile).not.toHaveBeenCalled();
    expect(tracks).toEqual([]);
  });

  it('should scan a directory with only supported audio files', async () => {
    const mockDir = '/fake/music/dir';
    const files = ['song1.mp3', 'song2.flac', 'song3.wav', 'song4.m4a', 'image.jpg', 'document.txt'];

    // Mock readdir to return the list of files and directories
    mockReaddir.mockResolvedValue(files);

    // Mock stat for each entry
    mockStat.mockImplementation((filePath) => {
      if (filePath === '/fake/music/dir/song1.mp3') return createMockFileStat(false);
      if (filePath === '/fake/music/dir/song2.flac') return createMockFileStat(false);
      if (filePath === '/fake/music/dir/song3.wav') return createMockFileStat(false);
      if (filePath === '/fake/music/dir/song4.m4a') return createMockFileStat(false);
      if (filePath === '/fake/music/dir/image.jpg') return createMockFileStat(false);
      if (filePath === '/fake/music/dir/document.txt') return createMockFileStat(false);
      return Promise.reject(new Error(`Stat not mocked for ${filePath}`));
    });

    // Mock parseFile for each supported audio file
    mockParseFile.mockImplementation((filePath) => {
      if (filePath === '/fake/music/dir/song1.mp3') return Promise.resolve(mockMp3Metadata);
      if (filePath === '/fake/music/dir/song2.flac') return Promise.resolve(mockFlacMetadata);
      if (filePath === '/fake/music/dir/song3.wav') return Promise.resolve(mockWavMetadata);
      if (filePath === '/fake/music/dir/song4.m4a') return Promise.resolve(mockM4aMetadata);
      return Promise.reject(new Error(`ParseFile not mocked for ${filePath}`));
    });

    const tracks = await scanDirectory(mockDir);

    expect(mockReaddir).toHaveBeenCalledWith(mockDir);
    expect(mockStat).toHaveBeenCalledTimes(files.length); // Stat called for all entries
    expect(mockParseFile).toHaveBeenCalledTimes(4); // ParseFile called only for supported files

    // Verify the returned tracks
    expect(tracks.length).toBe(4);

    // Check specific track details (using absolute paths)
    const expectedMp3Path = path.resolve('/fake/music/dir/song1.mp3');
    const mp3Track = tracks.find(t => t.path === expectedMp3Path);
    expect(mp3Track).toEqual({
      id: 0,
      path: expectedMp3Path,
      title: 'Mock Song Title',
      artist: 'Mock Artist',
      album: 'Mock Album',
      duration: 180,
    });

    const expectedFlacPath = path.resolve('/fake/music/dir/song2.flac');
    const flacTrack = tracks.find(t => t.path === expectedFlacPath);
    expect(flacTrack).toEqual({
      id: 0,
      path: expectedFlacPath,
      title: 'Flac Title',
      artist: 'Flac Artist',
      album: 'Flac Album',
      duration: 240,
    });

    const expectedWavPath = path.resolve('/fake/music/dir/song3.wav');
    const wavTrack = tracks.find(t => t.path === expectedWavPath);
    expect(wavTrack).toEqual({
      id: 0,
      path: expectedWavPath,
      title: 'Wav Tune',
      artist: 'Wav Performer',
      album: 'Wav Collection',
      duration: 120,
    });

    const expectedM4aPath = path.resolve('/fake/music/dir/song4.m4a');
    const m4aTrack = tracks.find(t => t.path === expectedM4aPath);
    expect(m4aTrack).toEqual({
      id: 0,
      path: expectedM4aPath,
      title: 'M4a Jam',
      artist: 'M4a Maestro',
      album: 'M4a Archive',
      duration: 300,
    });
  });

  it('should handle case-insensitive file extensions', async () => {
    const mockDir = '/fake/case/dir';
    const files = ['Song.MP3', 'Another.FLAC', 'Test.Wav'];

    mockReaddir.mockResolvedValue(files);
    mockStat.mockImplementation((filePath) => createMockFileStat(false));
    mockParseFile.mockImplementation((filePath) => {
      if (filePath.endsWith('.MP3')) return Promise.resolve(mockMp3Metadata);
      if (filePath.endsWith('.FLAC')) return Promise.resolve(mockFlacMetadata);
      if (filePath.endsWith('.Wav')) return Promise.resolve(mockWavMetadata);
      return Promise.reject(new Error(`ParseFile not mocked for ${filePath}`));
    });

    const tracks = await scanDirectory(mockDir);

    expect(mockParseFile).toHaveBeenCalledTimes(3);
    expect(tracks.length).toBe(3);
  });

  it('should recursively scan subdirectories', async () => {
    const mockDir = '/fake/recursive/dir';
    const subDir = 'subdir';
    const files = ['main_song.mp3', subDir]; // main_song.mp3 and a subdirectory

    const subDirFiles = ['sub_song.flac'];

    // Mock readdir for the main directory
    mockReaddir.mockImplementation((dirPath) => {
      if (dirPath === mockDir) return Promise.resolve(files);
      if (dirPath === path.join(mockDir, subDir)) return Promise.resolve(subDirFiles);
      return Promise.reject(new Error(`readdir not mocked for ${dirPath}`));
    });

    // Mock stat for entries
    mockStat.mockImplementation((filePath) => {
      if (filePath === path.join(mockDir, 'main_song.mp3')) return createMockFileStat(false);
      if (filePath === path.join(mockDir, subDir)) return createMockFileStat(true); // This is a directory
      if (filePath === path.join(mockDir, subDir, 'sub_song.flac')) return createMockFileStat(false);
      return Promise.reject(new Error(`Stat not mocked for ${filePath}`));
    });

    // Mock parseFile for audio files
    mockParseFile.mockImplementation((filePath) => {
      if (filePath === path.join(mockDir, 'main_song.mp3')) return Promise.resolve(mockMp3Metadata);
      if (filePath === path.join(mockDir, subDir, 'sub_song.flac')) return Promise.resolve(mockFlacMetadata);
      return Promise.reject(new Error(`ParseFile not mocked for ${filePath}`));
    });

    const tracks = await scanDirectory(mockDir);

    expect(mockReaddir).toHaveBeenCalledWith(mockDir);
    expect(mockReaddir).toHaveBeenCalledWith(path.join(mockDir, subDir)); // Called for subdirectory
    expect(mockStat).toHaveBeenCalledTimes(3); // 1 for file, 1 for dir, 1 for subfile
    expect(mockParseFile).toHaveBeenCalledTimes(2); // For both audio files
    expect(tracks.length).toBe(2);

    const expectedMainTrackPath = path.resolve('/fake/recursive/dir/main_song.mp3');
    const mainTrack = tracks.find(t => t.path === expectedMainTrackPath);
    expect(mainTrack).toBeDefined();
    expect(mainTrack?.title).toBe('Mock Song Title');

    const expectedSubTrackPath = path.resolve('/fake/recursive/dir/subdir/sub_song.flac');
    const subTrack = tracks.find(t => t.path === expectedSubTrackPath);
    expect(subTrack).toBeDefined();
    expect(subTrack?.title).toBe('Flac Title');
  });

  it('should use filename as title if metadata title is missing', async () => {
    const mockDir = '/fake/missing/title/dir';
    const files = ['no_title.mp3'];

    mockReaddir.mockResolvedValue(files);
    mockStat.mockImplementation((filePath) => createMockFileStat(false));
    mockParseFile.mockResolvedValue(mockPartialMetadata); // Metadata with missing title

    const tracks = await scanDirectory(mockDir);

    expect(tracks.length).toBe(1);
    expect(tracks[0].title).toBe('no_title'); // Should fallback to filename
    expect(tracks[0].path).toBe(path.resolve('/fake/missing/title/dir/no_title.mp3'));
    expect(tracks[0].artist).toBe('Partial Artist');
    expect(tracks[0].album).toBe('Partial Album');
    expect(tracks[0].duration).toBe(150);
  });

  it('should use "Unknown Artist" and "Unknown Album" if metadata is missing', async () => {
    const mockDir = '/fake/unknown/metadata/dir';
    const files = ['blank.mp3'];

    const blankMetadata = {
      common: { duration: 100 }, // Only duration available
      format: { duration: 100 },
    };

    mockReaddir.mockResolvedValue(files);
    mockStat.mockImplementation((filePath) => createMockFileStat(false));
    mockParseFile.mockResolvedValue(blankMetadata);

    const tracks = await scanDirectory(mockDir);

    expect(tracks.length).toBe(1);
    expect(tracks[0].title).toBe('blank'); // Fallback title
    expect(tracks[0].artist).toBe('Unknown Artist'); // Default
    expect(tracks[0].album).toBe('Unknown Album'); // Default
    expect(tracks[0].duration).toBe(100);
  });

  // --- Failure Scenarios ---

  it('should skip files that cause parseFile errors and log an error', async () => {
    const mockDir = '/fake/error/parsing/dir';
    const files = ['good.mp3', 'bad.mp3', 'another_good.flac'];

    // Mock console.error to spy on it
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    mockReaddir.mockResolvedValue(files);
    mockStat.mockImplementation((filePath) => createMockFileStat(false));

    mockParseFile.mockImplementation((filePath) => {
      if (filePath === '/fake/error/parsing/dir/good.mp3') return Promise.resolve(mockMp3Metadata);
      if (filePath === '/fake/error/parsing/dir/bad.mp3') return Promise.reject(new Error('Invalid MP3 format'));
      if (filePath === '/fake/error/parsing/dir/another_good.flac') return Promise.resolve(mockFlacMetadata);
      return Promise.reject(new Error(`ParseFile not mocked for ${filePath}`));
    });

    const tracks = await scanDirectory(mockDir);

    expect(mockParseFile).toHaveBeenCalledTimes(3);
    expect(tracks.length).toBe(2); // Only good files should be in the result

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith('Error parsing metadata for /fake/error/parsing/dir/bad.mp3: Invalid MP3 format');

    consoleErrorSpy.mockRestore(); // Restore console.error
  });

  it('should skip entries that cause stat errors and log an error', async () => {
    const mockDir = '/fake/error/stat/dir';
    const files = ['valid_file.mp3', 'permission_denied.wav'];

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    mockReaddir.mockResolvedValue(files);
    mockStat.mockImplementation((filePath) => {
      if (filePath === '/fake/error/stat/dir/valid_file.mp3') return createMockFileStat(false);
      if (filePath === '/fake/error/stat/dir/permission_denied.wav') return Promise.reject(new Error('Permission denied'));
      return Promise.reject(new Error(`Stat not mocked for ${filePath}`));
    });

    mockParseFile.mockImplementation((filePath) => {
      if (filePath === '/fake/error/stat/dir/valid_file.mp3') return Promise.resolve(mockMp3Metadata);
      return Promise.reject(new Error(`ParseFile not mocked for ${filePath}`));
    });

    const tracks = await scanDirectory(mockDir);

    expect(mockStat).toHaveBeenCalledTimes(2);
    expect(mockParseFile).toHaveBeenCalledTimes(1); // Only called for valid_file.mp3
    expect(tracks.length).toBe(1);

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith('Error getting stats for /fake/error/stat/dir/permission_denied.wav: Permission denied');

    consoleErrorSpy.mockRestore();
  });

  it('should return an empty array and log an error if the directory does not exist', async () => {
    const mockDir = '/fake/non/existent/dir';
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Mock readdir to reject with an error indicating directory not found
    mockReaddir.mockRejectedValue(new Error(`ENOENT: no such file or directory, scandir '${mockDir}'`));

    const tracks = await scanDirectory(mockDir);

    expect(mockReaddir).toHaveBeenCalledWith(mockDir);
    expect(mockStat).not.toHaveBeenCalled();
    expect(mockParseFile).not.toHaveBeenCalled();
    expect(tracks).toEqual([]);

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(`Error reading directory ${mockDir}: ENOENT: no such file or directory, scandir '${mockDir}'`);

    consoleErrorSpy.mockRestore();
  });

  it('should return an empty array and log an error for permission denied on directory', async () => {
    const mockDir = '/fake/no/permission/dir';
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Mock readdir to reject with a permission denied error
    mockReaddir.mockRejectedValue(new Error(`EACCES: permission denied, scandir '${mockDir}'`));

    const tracks = await scanDirectory(mockDir);

    expect(mockReaddir).toHaveBeenCalledWith(mockDir);
    expect(mockStat).not.toHaveBeenCalled();
    expect(mockParseFile).not.toHaveBeenCalled();
    expect(tracks).toEqual([]);

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(`Error reading directory ${mockDir}: EACCES: permission denied, scandir '${mockDir}'`);

    consoleErrorSpy.mockRestore();
  });

  it('should handle a mix of supported, unsupported, and malformed files gracefully', async () => {
    const mockDir = '/fake/mixed/dir';
    const files = ['song1.mp3', 'song2.flac', 'unsupported.txt', 'corrupt.wav', 'song3.m4a'];

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    mockReaddir.mockResolvedValue(files);
    mockStat.mockImplementation((filePath) => createMockFileStat(false)); // All entries are files

    mockParseFile.mockImplementation((filePath) => {
      if (filePath === '/fake/mixed/dir/song1.mp3') return Promise.resolve(mockMp3Metadata);
      if (filePath === '/fake/mixed/dir/song2.flac') return Promise.resolve(mockFlacMetadata);
      if (filePath === '/fake/mixed/dir/corrupt.wav') return Promise.reject(new Error('Malformed WAV data'));
      if (filePath === '/fake/mixed/dir/song3.m4a') return Promise.resolve(mockM4aMetadata);
      return Promise.reject(new Error(`ParseFile not mocked for ${filePath}`));
    });

    const tracks = await scanDirectory(mockDir);

    expect(mockReaddir).toHaveBeenCalledWith(mockDir);
    expect(mockStat).toHaveBeenCalledTimes(files.length);
    expect(mockParseFile).toHaveBeenCalledTimes(4); // Called for mp3, flac, corrupt.wav, m4a
    expect(tracks.length).toBe(3); // unsupported.txt is skipped, corrupt.wav causes an error

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith('Error parsing metadata for /fake/mixed/dir/corrupt.wav: Malformed WAV data');

    consoleErrorSpy.mockRestore();
  });

  // Test recursion with subdirectories containing errors
  it('should recursively scan subdirectories and handle errors within them', async () => {
    const mockDir = '/fake/recursive/errors';
    const subDir = 'sub';
    const files = ['main_good.mp3', subDir]; // main_good.mp3 and a subdirectory

    const subDirFiles = ['sub_bad.flac', 'sub_good.wav'];

    // Mock readdir for the main directory
    mockReaddir.mockImplementation((dirPath) => {
      if (dirPath === mockDir) return Promise.resolve(files);
      if (dirPath === path.join(mockDir, subDir)) return Promise.resolve(subDirFiles);
      return Promise.reject(new Error(`readdir not mocked for ${dirPath}`));
    });

    // Mock stat for entries
    mockStat.mockImplementation((filePath) => {
      if (filePath === path.join(mockDir, 'main_good.mp3')) return createMockFileStat(false);
      if (filePath === path.join(mockDir, subDir)) return createMockFileStat(true); // Directory
      if (filePath === path.join(mockDir, subDir, 'sub_bad.flac')) return createMockFileStat(false);
      if (filePath === path.join(mockDir, subDir, 'sub_good.wav')) return createMockFileStat(false);
      return Promise.reject(new Error(`Stat not mocked for ${filePath}`));
    });

    // Mock parseFile for audio files
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    mockParseFile.mockImplementation((filePath) => {
      if (filePath === path.join(mockDir, 'main_good.mp3')) return Promise.resolve(mockMp3Metadata);
      if (filePath === path.join(mockDir, subDir, 'sub_bad.flac')) return Promise.reject(new Error('Corrupt FLAC'));
      if (filePath === path.join(mockDir, subDir, 'sub_good.wav')) return Promise.resolve(mockWavMetadata);
      return Promise.reject(new Error(`ParseFile not mocked for ${filePath}`));
    });

    const tracks = await scanDirectory(mockDir);

    expect(mockReaddir).toHaveBeenCalledWith(mockDir);
    expect(mockReaddir).toHaveBeenCalledWith(path.join(mockDir, subDir));
    expect(mockStat).toHaveBeenCalledTimes(4); // 1 for main_good, 1 for sub dir, 1 for sub_bad, 1 for sub_good
    expect(mockParseFile).toHaveBeenCalledTimes(3); // main_good, sub_bad, sub_good
    expect(tracks.length).toBe(2); // main_good and sub_good

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith('Error parsing metadata for /fake/recursive/errors/subdir/sub_bad.flac: Corrupt FLAC');

    consoleErrorSpy.mockRestore();
  });
});