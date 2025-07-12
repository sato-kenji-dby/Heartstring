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

  interface IpcRendererAPI {
    send: (channel: string, ...args: any[]) => void;
    on: (channel: string, listener: (...args: any[]) => void) => Electron.IpcRenderer;
    off: (channel: string, listener: (...args: any[]) => void) => Electron.IpcRenderer;
    invoke: (channel: string, ...args: any[]) => Promise<any>;
  }

  interface Window {
    electronAPI: ElectronAPI;
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
