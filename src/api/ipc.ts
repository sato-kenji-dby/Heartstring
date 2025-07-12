// src/api/ipc.ts
// 封装 Electron IPC Renderer 通信

// 定义 ipcRenderer 的具体类型
interface IpcRendererAPI {
  send: (channel: string, ...args: any[]) => void;
  on: (channel: string, listener: (event: Electron.IpcRendererEvent, ...args: any[]) => void) => Electron.IpcRenderer;
  off: (channel: string, listener: (...args: any[]) => void) => Electron.IpcRenderer;
  invoke: <T>(channel: string, ...args: any[]) => Promise<T>;
}

// 检查 window.ipcRenderer 是否存在，以避免 SSR 错误
const isElectron = typeof window !== 'undefined' && (window as any).ipcRenderer; // 使用 any 绕过类型检查，因为我们知道它存在

export const ipcRenderer: IpcRendererAPI = isElectron ? (window as any).ipcRenderer : {
  send: () => {},
  on: () => { return {} as Electron.IpcRenderer; },
  off: () => { return {} as Electron.IpcRenderer; },
  invoke: async () => Promise.resolve(), // 模拟 invoke，返回 Promise
};
