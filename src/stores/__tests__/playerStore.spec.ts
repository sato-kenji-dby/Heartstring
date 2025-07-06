import { describe, it, expect, beforeEach } from 'vitest';
import { playerStore } from '$stores/playerStore';
import { type PlayerState, type Track } from '$types';
import { get } from 'svelte/store';

describe('playerStore', () => {
  const initialPlayerState: PlayerState = {
    currentTrack: null,
    isPlaying: false,
    progress: 0,
    duration: 0,
    status: 'stopped',
    queue: [],
  };

  const mockTrack: Track = {
    id: 1,
    title: 'Test Song',
    artist: 'Test Artist',
    album: 'Test Album',
    path: '/path/to/test/audio.mp3',
    duration: 120,
  };

  beforeEach(() => {
    // Reset the store to its initial state before each test
    playerStore.set(initialPlayerState);
  });

  it('should have the correct initial state', () => {
    expect(get(playerStore)).toEqual(initialPlayerState);
  });

  it('should update currentTrack and playback status when a track starts playing', () => {
    playerStore.update(state => ({
      ...state,
      currentTrack: mockTrack,
      isPlaying: true,
      status: 'playing',
      duration: mockTrack.duration,
    }));

    const currentState = get(playerStore);
    expect(currentState.currentTrack).toEqual(mockTrack);
    expect(currentState.isPlaying).toBe(true);
    expect(currentState.status).toBe('playing');
    expect(currentState.duration).toBe(mockTrack.duration);
  });

  it('should update progress and duration', () => {
    playerStore.update(state => ({
      ...state,
      progress: 30,
      duration: 150,
    }));

    const currentState = get(playerStore);
    expect(currentState.progress).toBe(30);
    expect(currentState.duration).toBe(150);
  });

  it('should update status to paused and isPlaying to false when paused', () => {
    playerStore.update(state => ({
      ...state,
      isPlaying: true,
      status: 'playing',
      currentTrack: mockTrack,
    }));

    playerStore.update(state => ({
      ...state,
      isPlaying: false,
      status: 'paused',
      progress: 60,
    }));

    const currentState = get(playerStore);
    expect(currentState.isPlaying).toBe(false);
    expect(currentState.status).toBe('paused');
    expect(currentState.progress).toBe(60);
  });

  it('should update status to stopped and reset state when playback ends', () => {
    playerStore.update(state => ({
      ...state,
      currentTrack: mockTrack,
      isPlaying: true,
      status: 'playing',
      progress: 100,
    }));

    playerStore.update(state => ({
      ...state,
      isPlaying: false,
      status: 'stopped',
      progress: 0,
      currentTrack: null,
    }));

    const currentState = get(playerStore);
    expect(currentState.isPlaying).toBe(false);
    expect(currentState.status).toBe('stopped');
    expect(currentState.progress).toBe(0);
    expect(currentState.currentTrack).toBeNull();
  });

  it('should update status to error when an error occurs', () => {
    playerStore.update(state => ({
      ...state,
      isPlaying: false,
      status: 'error',
    }));

    const currentState = get(playerStore);
    expect(currentState.isPlaying).toBe(false);
    expect(currentState.status).toBe('error');
  });

  it('should add tracks to the queue', () => {
    const track2: Track = { ...mockTrack, id: 2, title: 'Another Song' };
    playerStore.update(state => ({
      ...state,
      queue: [...state.queue, mockTrack, track2],
    }));

    const currentState = get(playerStore);
    expect(currentState.queue).toEqual([mockTrack, track2]);
    expect(currentState.queue.length).toBe(2);
  });

  it('should clear the queue when stopped', () => {
    playerStore.update(state => ({
      ...state,
      queue: [mockTrack],
    }));

    playerStore.update(state => ({
      ...state,
      queue: [],
      status: 'stopped',
    }));

    const currentState = get(playerStore);
    expect(currentState.queue).toEqual([]);
  });
});
