// src/api/ipc.ts
// 封装 Electron IPC Renderer 通信

declare global {
  interface Window {
    electron: {
      ipcRenderer: {
        send: (channel: string, ...args: any[]) => void;
        on: (channel: string, listener: (event: Electron.IpcRendererEvent, ...args: any[]) => void) => Electron.IpcRenderer;
        off: (channel: string, listener: (...args: any[]) => void) => Electron.IpcRenderer;
      };
    };
  }
}

// 检查 window.electron 是否存在，以避免 SSR 错误
const isElectron = typeof window !== 'undefined' && window.electron && window.electron.ipcRenderer;

export const ipcRenderer = isElectron ? window.electron.ipcRenderer : {
  send: () => {},
  on: () => { return {} as Electron.IpcRenderer; }, // 返回一个兼容 Electron.IpcRenderer 的对象
  off: () => { return {} as Electron.IpcRenderer; }, // 返回一个兼容 Electron.IpcRenderer 的对象
  invoke: async () => {},
};
