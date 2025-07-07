import type { Track } from './index.d'; // 导入 Track 类型

declare global {
  interface Window {
    audio: {
      play: (track: Track) => void;
      stop: () => void;
      pause: () => void;
      resume: () => void;
      addToQueue: (track: Track) => void;
      onPlaybackStarted: (callback: (track: Track) => void) => void;
      onPlaybackProgress: (callback: (data: { currentTime: number, duration: number }) => void) => void;
      onPlaybackPaused: (callback: (data: { currentTime: number }) => void) => void;
      onPlaybackResumed: (callback: (data: { currentTime: number }) => void) => void;
      onPlaybackEnded: (callback: () => void) => void;
      onPlaybackError: (callback: (errorMessage: string) => void) => void;
    };
  }
}
