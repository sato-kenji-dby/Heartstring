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
  ipcRenderer.on('player-store-update', (event, newState) => {
    update((state) => ({ ...state, ...(newState as Partial<PlayerState>) }));
  });

  // 返回公共接口
  return {
    subscribe,
    play: (track: Track) => {
      ipcRenderer.send('play-track', track);
    },
    /**
     * 仅播放单曲并清空队列（用于库中直接点播）
     */
    playSingleTrack: (track: Track) => {
      ipcRenderer.send('play-single-track', track);
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
    },
    next: () => {
      ipcRenderer.send('play-next-track');
    },
  };
};

export const playerStore = createPlayerStore();
