// src/api/ipc.ts
// 封装 Electron IPC Renderer 通信

// 定义 ipcRenderer 的具体类型
interface IpcRendererAPI {
  send: (channel: string, ...args: unknown[]) => void;
  on: (
    channel: string,
    listener: (event: Electron.IpcRendererEvent, ...args: unknown[]) => void
  ) => Electron.IpcRenderer;
  off: (
    channel: string,
    listener: (...args: unknown[]) => void
  ) => Electron.IpcRenderer;
  invoke: <T>(channel: string, ...args: unknown[]) => Promise<T>;
}

// 检查 window.ipcRenderer 是否存在，以避免 SSR 错误
const isElectron =
  typeof window !== 'undefined' &&
  (window as { ipcRenderer: IpcRendererAPI }).ipcRenderer;

export const ipcRenderer: IpcRendererAPI = isElectron
  ? (window as unknown as { ipcRenderer: IpcRendererAPI }).ipcRenderer
  : {
      send: () => {},
      on: () => {
        return {} as Electron.IpcRenderer;
      },
      off: () => {
        return {} as Electron.IpcRenderer;
      },
      invoke: async <T>(): Promise<T> => Promise.resolve({} as T), // 模拟 invoke，返回 Promise
    };
