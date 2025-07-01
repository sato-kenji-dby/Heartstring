// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
  interface Track {
    id: number;
    path: string;
    title: string;
    artist: string;
    album: string;
    duration: number;
  }

  interface PlaybackStatus {
    isPlaying: boolean;
    currentTrack: Track | null; // 存储当前播放的轨道信息
    currentTime: number;
  }

  interface ElectronAPI {
    openDirectoryDialog: () => Promise<string | null>;
    getAllTracks: () => Promise<Track[]>;
  }

  interface AudioAPI {
    play: (track: Track) => void; // 更改参数类型
    stop: () => void;
    onPlaybackStarted: (callback: (track: Track) => void) => Electron.IpcRenderer; // 新增事件
    onPlaybackEnded: (callback: () => void) => Electron.IpcRenderer;
    onPlaybackError: (callback: (errorMessage: string) => void) => Electron.IpcRenderer;
    onPlaybackProgress: (callback: (data: { currentTime: number }) => void) => Electron.IpcRenderer; // 新增事件
  }

  interface Window {
    electronAPI: ElectronAPI;
    audio: AudioAPI;
  }

	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
