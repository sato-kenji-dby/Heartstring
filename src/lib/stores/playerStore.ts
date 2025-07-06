import { writable } from 'svelte/store';

export interface Track {
  id: number; // Changed from string to number to match MusicTrack
  title: string;
  artist: string;
  album: string;
  path: string;
  duration: number; // in seconds
}

export interface PlayerState {
  currentTrack: Track | null;
  isPlaying: boolean;
  progress: number; // current playback time in seconds
  duration: number; // total duration of current track in seconds
  status: 'playing' | 'paused' | 'stopped' | 'error';
  queue: Track[]; // Add queue to player state
}

const initialPlayerState: PlayerState = {
  currentTrack: null,
  isPlaying: false,
  progress: 0,
  duration: 0,
  status: 'stopped',
  queue: [], // Initialize queue
};

export const playerStore = writable<PlayerState>(initialPlayerState);
