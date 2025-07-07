import { writable } from 'svelte/store';
import type { Track, PlayerState } from '$types';

const initialPlayerState: PlayerState = {
  currentTrack: null,
  isPlaying: false,
  progress: 0,
  duration: 0,
  status: 'stopped',
  queue: [], // Initialize queue
};

export const playerStore = writable<PlayerState>(initialPlayerState);
