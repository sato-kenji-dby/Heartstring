import { describe, it, expect, vi, beforeEach } from 'vitest';
import { audioService } from '../audioService';
import { playerService } from '../playerService';
import { playerStore, type PlayerState, type Track } from '../stores/playerStore';
import { get } from 'svelte/store';

// Mock playerService to control its emitted events
vi.mock('../playerService', () => {
  const EventEmitter = require('events');
  const mockPlayerService = new EventEmitter();
  mockPlayerService.play = vi.fn();
  mockPlayerService.stop = vi.fn();
  mockPlayerService.pause = vi.fn();
  mockPlayerService.resume = vi.fn();
  return { playerService: mockPlayerService };
});

describe('AudioService', () => {
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

  beforeEach(() => {
    vi.clearAllMocks();
    playerStore.set(initialPlayerState); // Reset playerStore
    playerService.removeAllListeners(); // Clear listeners on the mocked playerService
    // Re-initialize audioService to ensure listeners are set up with fresh mocks
    // This is a common pattern when testing singletons that set up listeners in constructor
    // For simplicity, we'll just ensure the existing singleton is used and its listeners are active.
    // If audioService was not a singleton, we'd create a new instance here.
    // Since it is, we rely on its constructor being called once on import.
    // We just need to ensure playerService mock is ready before tests.
  });

  it('should delegate playTrack to playerService.play', () => {
    audioService.playTrack(mockTrack);
    expect(playerService.play).toHaveBeenCalledWith(mockTrack);
  });

  it('should delegate stopPlayback to playerService.stop and clear queue', () => {
    audioService.addToQueue(mockTrack); // Add something to queue
    expect(get(playerStore).queue).toEqual([mockTrack]);

    audioService.stopPlayback();
    expect(playerService.stop).toHaveBeenCalled();
    expect(get(playerStore).queue).toEqual([]); // Queue should be cleared
  });

  it('should delegate pausePlayback to playerService.pause', () => {
    audioService.pausePlayback();
    expect(playerService.pause).toHaveBeenCalled();
  });

  it('should delegate resumePlayback to playerService.resume', () => {
    audioService.resumePlayback();
    expect(playerService.resume).toHaveBeenCalled();
  });

  it('should update playerStore on "playback-started" event', () => {
    playerService.emit('playback-started', mockTrack);
    const state = get(playerStore);
    expect(state.currentTrack).toEqual(mockTrack);
    expect(state.isPlaying).toBe(true);
    expect(state.status).toBe('playing');
    expect(state.progress).toBe(0);
    expect(state.duration).toBe(mockTrack.duration);
  });

  it('should update playerStore on "playback-progress" event', () => {
    playerService.emit('playback-started', mockTrack); // Simulate start to set duration
    playerService.emit('playback-progress', { currentTime: 30, duration: 120 });
    const state = get(playerStore);
    expect(state.progress).toBe(30);
    expect(state.duration).toBe(120);
  });

  it('should update playerStore on "playback-paused" event', () => {
    playerService.emit('playback-started', mockTrack);
    playerService.emit('playback-paused', { currentTime: 60 });
    const state = get(playerStore);
    expect(state.isPlaying).toBe(false);
    expect(state.status).toBe('paused');
    expect(state.progress).toBe(60);
  });

  it('should update playerStore on "playback-resumed" event', () => {
    playerService.emit('playback-started', mockTrack);
    playerService.emit('playback-paused', { currentTime: 60 }); // Pause first
    playerService.emit('playback-resumed', { currentTime: 60 });
    const state = get(playerStore);
    expect(state.isPlaying).toBe(true);
    expect(state.status).toBe('playing');
    expect(state.progress).toBe(60);
  });

  it('should update playerStore on "playback-ended" event and play next in queue', () => {
    const track2: Track = { ...mockTrack, id: 2, title: 'Next Song' };
    audioService.addToQueue(track2); // Add track2 to queue
    playerService.emit('playback-started', mockTrack); // Play mockTrack

    playerService.emit('playback-ended'); // mockTrack ends

    const state = get(playerStore);
    expect(state.isPlaying).toBe(false);
    expect(state.status).toBe('stopped');
    expect(state.currentTrack).toBeNull();
    expect(state.progress).toBe(0);
    expect(playerService.play).toHaveBeenCalledWith(track2); // Should play next track
    expect(state.queue).toEqual([]); // Queue should be empty after playing track2
  });

  it('should update playerStore on "playback-error" event and play next in queue', () => {
    const track2: Track = { ...mockTrack, id: 2, title: 'Next Song' };
    audioService.addToQueue(track2); // Add track2 to queue
    playerService.emit('playback-started', mockTrack); // Play mockTrack

    playerService.emit('playback-error', new Error('Playback failed')); // mockTrack errors

    const state = get(playerStore);
    expect(state.isPlaying).toBe(false);
    expect(state.status).toBe('error');
    expect(playerService.play).toHaveBeenCalledWith(track2); // Should play next track
    expect(state.queue).toEqual([]); // Queue should be empty after playing track2
  });

  it('should add track to queue and update playerStore', () => {
    audioService.addToQueue(mockTrack);
    const state = get(playerStore);
    expect(state.queue).toEqual([mockTrack]);
  });

  it('should play next track from queue if current track is stopped and queue is not empty', () => {
    const track2: Track = { ...mockTrack, id: 2, title: 'Next Song' };
    audioService.addToQueue(track2); // Add track2 to queue
    playerStore.set({ ...initialPlayerState, status: 'stopped', currentTrack: null }); // Ensure stopped state

    // Since addToQueue has a subscribe that triggers playNext if stopped and queue not empty
    expect(playerService.play).toHaveBeenCalledWith(track2);
    expect(get(playerStore).queue).toEqual([]); // Queue should be empty
  });

  it('should not play next track if queue is empty on playback-ended', () => {
    playerService.emit('playback-started', mockTrack);
    playerService.emit('playback-ended'); // Queue is empty

    expect(playerService.play).not.toHaveBeenCalledWith(expect.anything()); // No next track played
    const state = get(playerStore);
    expect(state.currentTrack).toBeNull();
    expect(state.status).toBe('stopped');
  });

  it('should return the current queue', () => {
    audioService.addToQueue(mockTrack);
    const track2: Track = { ...mockTrack, id: 2, title: 'Another Song' };
    audioService.addToQueue(track2);
    expect(audioService.getQueue()).toEqual([mockTrack, track2]);
  });
});
