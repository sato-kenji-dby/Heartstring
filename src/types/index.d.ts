// src/types/index.d.ts

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
