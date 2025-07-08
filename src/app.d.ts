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
    play: (track: Track) => void;
    stop: () => void;
    pause: () => void; // 新增：暂停
    resume: () => void; // 新增：恢复
    addToQueue: (track: Track) => void;
    getQueue: () => Promise<Track[]>;
    onPlaybackStarted: (callback: (track: Track) => void) => Electron.IpcRenderer;
    onPlaybackEnded: (callback: () => void) => Electron.IpcRenderer;
    onPlaybackError: (callback: (errorMessage: string) => void) => Electron.IpcRenderer;
    onPlaybackProgress: (callback: (data: { currentTime: number }) => void) => Electron.IpcRenderer;
    onQueueUpdated: (callback: (queue: Track[]) => void) => Electron.IpcRenderer;
    onPlaybackPaused: (callback: (data: { currentTime: number }) => void) => Electron.IpcRenderer; // 新增：播放暂停事件
    onPlaybackResumed: (callback: (data: { currentTime: number }) => void) => Electron.IpcRenderer; // 新增：播放恢复事件
  }

  interface IpcRendererAPI {
    send: (channel: string, ...args: any[]) => void;
    on: (channel: string, listener: (...args: any[]) => void) => Electron.IpcRenderer;
    off: (channel: string, listener: (...args: any[]) => void) => Electron.IpcRenderer;
    invoke: (channel: string, ...args: any[]) => Promise<any>;
  }

  interface Window {
    electronAPI: ElectronAPI;
    audio: AudioAPI;
    ipcRenderer: IpcRendererAPI; // 添加 ipcRenderer
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
