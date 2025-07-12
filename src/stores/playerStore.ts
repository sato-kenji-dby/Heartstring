import { writable } from 'svelte/store';
import type { Track, PlayerState } from '$types';
import { ipcRenderer } from '$api/ipc';

const createPlayerStore = () => {
  const { subscribe, update } = writable<PlayerState>({
    currentTrack: null,
    isPlaying: false,
    progress: 0,
    duration: 0,
    status: 'stopped',
    queue: [],
  });

  // 监听来自主进程的统一状态更新
  ipcRenderer.on('player-store-update', (event, newState: Partial<PlayerState>) => {
    update(state => ({ ...state, ...newState }));
  });

  // 返回公共接口
  return {
    subscribe,
    play: (track: Track) => {
      ipcRenderer.send('play-track', track);
    },
    pause: () => {
      ipcRenderer.send('pause-playback');
    },
    resume: () => {
      ipcRenderer.send('resume-playback');
    },
    stop: () => {
      ipcRenderer.send('stop-playback');
    },
    addToQueue: (track: Track) => {
      ipcRenderer.send('add-to-queue', track);
    }
  };
};

export const playerStore = createPlayerStore();
