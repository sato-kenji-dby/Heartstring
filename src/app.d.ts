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

  interface License {
    name: string;
    version: string;
    licenses: string;
    repository?: string;
  }

  interface ElectronAPI {
    openDirectoryDialog: () => Promise<string | null>;
    getAllTracks: () => Promise<Track[]>;
    getLicenses: () => Promise<License[]>; // Added for acknowledgements page
  }

  interface IpcRendererAPI {
    send(channel: 'play-track', track: Track): void;
    send(channel: 'stop-playback'): void;
    send(channel: 'pause-playback'): void;
    send(channel: 'resume-playback'): void;
    send(channel: 'add-to-queue', track: Track): void;
    send(channel: 'play-next-track'): void; // 添加新的 send 方法重载

    on(
      channel: 'player-store-update',
      listener: (
        event: Electron.IpcRendererEvent,
        newState: Partial<PlayerState>
      ) => void
    ): Electron.IpcRenderer;
    on(
      channel: string,
      listener: (...args: unknown[]) => void
    ): Electron.IpcRenderer; // 通用 on 方法

    off: (
      channel: string,
      listener: (...args: unknown[]) => void
    ) => Electron.IpcRenderer;
    invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
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
